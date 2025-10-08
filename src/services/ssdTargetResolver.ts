// SSD Target Resolver
// Robust target resolution system with region scoping and multiple selector strategies
// ============================================================================

import { Page, ElementHandle } from 'puppeteer';
import { Target } from '../types/ssd';

export interface TargetResolutionResult {
  element: ElementHandle<Element> | null;
  selector: string;
  method: 'text' | 'aria' | 'href' | 'selector' | 'region_text' | 'region_aria';
  confidence: number;
  error?: string;
}

export class TargetResolutionError extends Error {
  constructor(message: string, public target: Target, public method: string) {
    super(message);
    this.name = 'TargetResolutionError';
  }
}

export class SSDTargetResolver {
  private page: Page;
  private timeout: number;

  constructor(page: Page, timeout: number = 5000) {
    this.page = page;
    this.timeout = timeout;
  }

  /**
   * Resolve a target to a clickable element
   * Resolution order: region scope → text → aria → href → selector
   */
  async resolveTarget(target: Target): Promise<TargetResolutionResult> {
    const results: TargetResolutionResult[] = [];
    const candidates: string[] = [];

    // Handle special cases for ambiguous targets
    if (target.value === 'to-be-determined' || target.value === 'TBD' || target.value === 'TODO') {
      return this.resolveAmbiguousTarget(target);
    }

    // If region is specified, try region-scoped resolution first
    if (target.region && target.region !== 'any') {
      if (target.kind === 'text') {
        const regionResult = await this.resolveByRegionText(target);
        results.push(regionResult);
        if (regionResult.element) candidates.push(`region-text: ${regionResult.selector}`);
      } else if (target.kind === 'aria') {
        const regionResult = await this.resolveByRegionAria(target);
        results.push(regionResult);
        if (regionResult.element) candidates.push(`region-aria: ${regionResult.selector}`);
      }
    }

    // Try different resolution strategies in order of preference
    if (target.kind === 'text') {
      const textResult = await this.resolveByText(target);
      results.push(textResult);
      if (textResult.element) candidates.push(`text: ${textResult.selector}`);
    } else if (target.kind === 'aria') {
      const ariaResult = await this.resolveByAria(target);
      results.push(ariaResult);
      if (ariaResult.element) candidates.push(`aria: ${ariaResult.selector}`);
    } else if (target.kind === 'href') {
      const hrefResult = await this.resolveByHref(target);
      results.push(hrefResult);
      if (hrefResult.element) candidates.push(`href: ${hrefResult.selector}`);
    } else if (target.kind === 'selector') {
      const selectorResult = await this.resolveBySelector(target);
      results.push(selectorResult);
      if (selectorResult.element) candidates.push(`selector: ${selectorResult.selector}`);
    }

    // Return the best result (highest confidence with valid element)
    const validResults = results.filter(r => r.element && r.confidence > 0);
    if (validResults.length === 0) {
      // Try alternative approaches for better debugging
      const alternativeCandidates = await this.findAlternativeCandidates(target);
      candidates.push(...alternativeCandidates);
      
      return {
        element: null,
        selector: '',
        method: target.kind,
        confidence: 0,
        error: `No valid elements found for target: ${JSON.stringify(target)}. Candidates evaluated: ${candidates.join(', ')}`,
      };
    }

    // Sort by confidence and return the best match
    validResults.sort((a, b) => b.confidence - a.confidence);
    const bestResult = validResults[0];
    
    // Log which method succeeded for debugging
    console.log(`Target resolved using ${bestResult.method}: ${bestResult.selector}`);
    if (candidates.length > 1) {
      console.log(`Other candidates considered: ${candidates.filter(c => !c.includes(bestResult.selector)).join(', ')}`);
    }
    
    return bestResult;
  }

  /**
   * Resolve ambiguous targets by trying common patterns
   */
  private async resolveAmbiguousTarget(target: Target): Promise<TargetResolutionResult> {
    console.log(`[resolver] Resolving ambiguous target: ${target.value}`);
    
    // Try common header link patterns
    const headerPatterns = [
      'a[href]', // Any link with href
      'nav a', // Links in navigation
      'header a', // Links in header
      'button', // Any button
      '[role="button"]', // Elements with button role
      'a[class*="menu"]', // Menu links
      'a[class*="nav"]', // Navigation links
    ];

    for (const pattern of headerPatterns) {
      try {
        console.log(`[resolver] Trying pattern: ${pattern}`);
        const element = await this.page.waitForSelector(pattern, { timeout: 2000 }).catch(() => null);
        
        if (element) {
          const isVisible = await this.isElementVisibleAndClickable(element);
          if (isVisible) {
            console.log(`[resolver] ✅ Found clickable element with pattern: ${pattern}`);
            return {
              element,
              selector: pattern,
              method: 'selector',
              confidence: 0.6,
            };
          }
        }
      } catch (error) {
        console.log(`[resolver] Pattern ${pattern} failed:`, error.message);
      }
    }

    // If nothing found, return error with suggestions
    return {
      element: null,
      selector: 'ambiguous-target',
      method: 'selector',
      confidence: 0.0,
      error: `Could not resolve ambiguous target "${target.value}". Tried common patterns: ${headerPatterns.join(', ')}`,
    };
  }

  /**
   * Resolve target by visible text content
   */
  private async resolveByText(target: Target): Promise<TargetResolutionResult> {
    try {
      // Try exact text match first
      const exactSelector = `text=${target.value}`;
      const exactElement = await this.page.waitForSelector(exactSelector, { timeout: 1000 }).catch(() => null);
      
      if (exactElement) {
        const isVisible = await this.isElementVisibleAndClickable(exactElement);
        if (isVisible) {
          return {
            element: exactElement,
            selector: exactSelector,
            method: 'text',
            confidence: 0.9,
          };
        }
      }

      // Try case-insensitive text match
      const caseInsensitiveSelector = `text=${target.value.toLowerCase()}`;
      const caseInsensitiveElement = await this.page.waitForSelector(caseInsensitiveSelector, { timeout: 1000 }).catch(() => null);
      
      if (caseInsensitiveElement) {
        const isVisible = await this.isElementVisibleAndClickable(caseInsensitiveElement);
        if (isVisible) {
          return {
            element: caseInsensitiveElement,
            selector: caseInsensitiveSelector,
            method: 'text',
            confidence: 0.8,
          };
        }
      }

      // Try partial text match
      const partialSelector = `text*=${target.value}`;
      const partialElement = await this.page.waitForSelector(partialSelector, { timeout: 1000 }).catch(() => null);
      
      if (partialElement) {
        const isVisible = await this.isElementVisibleAndClickable(partialElement);
        if (isVisible) {
          return {
            element: partialElement,
            selector: partialSelector,
            method: 'text',
            confidence: 0.7,
          };
        }
      }

      return {
        element: null,
        selector: '',
        method: 'text',
        confidence: 0,
        error: `No elements found with text: ${target.value}`,
      };

    } catch (error) {
      return {
        element: null,
        selector: '',
        method: 'text',
        confidence: 0,
        error: `Text resolution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Resolve target by ARIA attributes
   */
  private async resolveByAria(target: Target): Promise<TargetResolutionResult> {
    try {
      // Try aria-label
      const ariaLabelSelector = `[aria-label*="${target.value}"]`;
      const ariaLabelElement = await this.page.waitForSelector(ariaLabelSelector, { timeout: 1000 }).catch(() => null);
      
      if (ariaLabelElement) {
        const isVisible = await this.isElementVisibleAndClickable(ariaLabelElement);
        if (isVisible) {
          return {
            element: ariaLabelElement,
            selector: ariaLabelSelector,
            method: 'aria',
            confidence: 0.9,
          };
        }
      }

      // Try aria-describedby
      const ariaDescribedBySelector = `[aria-describedby*="${target.value}"]`;
      const ariaDescribedByElement = await this.page.waitForSelector(ariaDescribedBySelector, { timeout: 1000 }).catch(() => null);
      
      if (ariaDescribedByElement) {
        const isVisible = await this.isElementVisibleAndClickable(ariaDescribedByElement);
        if (isVisible) {
          return {
            element: ariaDescribedByElement,
            selector: ariaDescribedBySelector,
            method: 'aria',
            confidence: 0.8,
          };
        }
      }

      // Try role-based selector
      const roleSelector = `[role="${target.value}"]`;
      const roleElement = await this.page.waitForSelector(roleSelector, { timeout: 1000 }).catch(() => null);
      
      if (roleElement) {
        const isVisible = await this.isElementVisibleAndClickable(roleElement);
        if (isVisible) {
          return {
            element: roleElement,
            selector: roleSelector,
            method: 'aria',
            confidence: 0.7,
          };
        }
      }

      return {
        element: null,
        selector: '',
        method: 'aria',
        confidence: 0,
        error: `No elements found with ARIA attribute: ${target.value}`,
      };

    } catch (error) {
      return {
        element: null,
        selector: '',
        method: 'aria',
        confidence: 0,
        error: `ARIA resolution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Resolve target by href attribute
   */
  private async resolveByHref(target: Target): Promise<TargetResolutionResult> {
    try {
      // Try exact href match
      const exactSelector = `a[href="${target.value}"]`;
      const exactElement = await this.page.waitForSelector(exactSelector, { timeout: 1000 }).catch(() => null);
      
      if (exactElement) {
        const isVisible = await this.isElementVisibleAndClickable(exactElement);
        if (isVisible) {
          return {
            element: exactElement,
            selector: exactSelector,
            method: 'href',
            confidence: 0.9,
          };
        }
      }

      // Try partial href match
      const partialSelector = `a[href*="${target.value}"]`;
      const partialElement = await this.page.waitForSelector(partialSelector, { timeout: 1000 }).catch(() => null);
      
      if (partialElement) {
        const isVisible = await this.isElementVisibleAndClickable(partialElement);
        if (isVisible) {
          return {
            element: partialElement,
            selector: partialSelector,
            method: 'href',
            confidence: 0.8,
          };
        }
      }

      return {
        element: null,
        selector: '',
        method: 'href',
        confidence: 0,
        error: `No elements found with href: ${target.value}`,
      };

    } catch (error) {
      return {
        element: null,
        selector: '',
        method: 'href',
        confidence: 0,
        error: `Href resolution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Resolve target by CSS selector
   */
  private async resolveBySelector(target: Target): Promise<TargetResolutionResult> {
    try {
      const element = await this.page.waitForSelector(target.value, { timeout: 1000 }).catch(() => null);
      
      if (element) {
        const isVisible = await this.isElementVisibleAndClickable(element);
        if (isVisible) {
          return {
            element,
            selector: target.value,
            method: 'selector',
            confidence: 0.9,
          };
        }
      }

      return {
        element: null,
        selector: '',
        method: 'selector',
        confidence: 0,
        error: `No elements found with selector: ${target.value}`,
      };

    } catch (error) {
      return {
        element: null,
        selector: '',
        method: 'selector',
        confidence: 0,
        error: `Selector resolution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Resolve target by region-scoped text search
   */
  private async resolveByRegionText(target: Target): Promise<TargetResolutionResult> {
    try {
      const regionSelector = this.getRegionSelector(target.region!);
      const regionElement = await this.page.waitForSelector(regionSelector, { timeout: 1000 }).catch(() => null);
      
      if (!regionElement) {
        return {
          element: null,
          selector: '',
          method: 'region_text',
          confidence: 0,
          error: `Region not found: ${target.region}`,
        };
      }

      // Search for text within the region
      const textElement = await regionElement.$(`text=${target.value}`).catch(() => null);
      
      if (textElement) {
        const isVisible = await this.isElementVisibleAndClickable(textElement);
        if (isVisible) {
          return {
            element: textElement,
            selector: `${regionSelector} >> text=${target.value}`,
            method: 'region_text',
            confidence: 0.8,
          };
        }
      }

      return {
        element: null,
        selector: '',
        method: 'region_text',
        confidence: 0,
        error: `No text elements found in ${target.region} region: ${target.value}`,
      };

    } catch (error) {
      return {
        element: null,
        selector: '',
        method: 'region_text',
        confidence: 0,
        error: `Region text resolution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Resolve target by region-scoped ARIA search
   */
  private async resolveByRegionAria(target: Target): Promise<TargetResolutionResult> {
    try {
      const regionSelector = this.getRegionSelector(target.region!);
      const regionElement = await this.page.waitForSelector(regionSelector, { timeout: 1000 }).catch(() => null);
      
      if (!regionElement) {
        return {
          element: null,
          selector: '',
          method: 'region_aria',
          confidence: 0,
          error: `Region not found: ${target.region}`,
        };
      }

      // Search for ARIA elements within the region
      const ariaElement = await regionElement.$(`[aria-label*="${target.value}"]`).catch(() => null);
      
      if (ariaElement) {
        const isVisible = await this.isElementVisibleAndClickable(ariaElement);
        if (isVisible) {
          return {
            element: ariaElement,
            selector: `${regionSelector} >> [aria-label*="${target.value}"]`,
            method: 'region_aria',
            confidence: 0.8,
          };
        }
      }

      return {
        element: null,
        selector: '',
        method: 'region_aria',
        confidence: 0,
        error: `No ARIA elements found in ${target.region} region: ${target.value}`,
      };

    } catch (error) {
      return {
        element: null,
        selector: '',
        method: 'region_aria',
        confidence: 0,
        error: `Region ARIA resolution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Get CSS selector for a region
   */
  private getRegionSelector(region: string): string {
    switch (region) {
      case 'header':
        return 'header, .header, [role="banner"], #header';
      case 'main':
        return 'main, .main, [role="main"], #main, .content';
      case 'footer':
        return 'footer, .footer, [role="contentinfo"], #footer';
      default:
        return 'body';
    }
  }

  /**
   * Find alternative candidates when primary resolution fails
   */
  private async findAlternativeCandidates(target: Target): Promise<string[]> {
    const candidates: string[] = [];
    
    try {
      // Look for similar text content
      if (target.kind === 'text') {
        const similarTexts = await this.page.evaluate((searchText) => {
          const elements = Array.from(document.querySelectorAll('button, a, input[type="button"], input[type="submit"]'));
          return elements
            .map(el => {
              const text = el.textContent?.trim() || '';
              const ariaLabel = el.getAttribute('aria-label') || '';
              const title = el.getAttribute('title') || '';
              return { text, ariaLabel, title, tagName: el.tagName };
            })
            .filter(item => 
              item.text.toLowerCase().includes(searchText.toLowerCase()) ||
              item.ariaLabel.toLowerCase().includes(searchText.toLowerCase()) ||
              item.title.toLowerCase().includes(searchText.toLowerCase())
            )
            .slice(0, 5)
            .map(item => `${item.tagName}: "${item.text || item.ariaLabel || item.title}"`);
        }, target.value);
        
        candidates.push(...similarTexts);
      }
      
      // Look for buttons and links with similar attributes
      const similarElements = await this.page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('button, a, input[type="button"], input[type="submit"]'));
        return elements
          .map(el => {
            const text = el.textContent?.trim() || '';
            const ariaLabel = el.getAttribute('aria-label') || '';
            const className = el.className || '';
            const id = el.id || '';
            return { text, ariaLabel, className, id, tagName: el.tagName };
          })
          .filter(item => item.text || item.ariaLabel)
          .slice(0, 5)
          .map(item => `${item.tagName}: "${item.text || item.ariaLabel}" (class: ${item.className}, id: ${item.id})`);
      });
      
      candidates.push(...similarElements);
      
    } catch (error) {
      console.error('Error finding alternative candidates:', error);
    }
    
    return candidates;
  }

  /**
   * Check if element is visible and clickable
   */
  private async isElementVisibleAndClickable(element: ElementHandle<Element>): Promise<boolean> {
    try {
      const isVisible = await element.isVisible();
      if (!isVisible) return false;

      const isEnabled = await element.isEnabled();
      if (!isEnabled) return false;

      // Check if element is in viewport
      const boundingBox = await element.boundingBox();
      if (!boundingBox) return false;

      // Check if element is clickable (not covered by other elements)
      const isClickable = await this.page.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        const elementAtPoint = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return elementAtPoint === el || el.contains(elementAtPoint);
      }, element);

      return isClickable;
    } catch (error) {
      return false;
    }
  }
}
