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
   */
  async resolveTarget(target: Target): Promise<TargetResolutionResult> {
    const results: TargetResolutionResult[] = [];

    // Try different resolution strategies in order of preference
    if (target.kind === 'text') {
      results.push(await this.resolveByText(target));
    } else if (target.kind === 'aria') {
      results.push(await this.resolveByAria(target));
    } else if (target.kind === 'href') {
      results.push(await this.resolveByHref(target));
    } else if (target.kind === 'selector') {
      results.push(await this.resolveBySelector(target));
    }

    // If region is specified, try region-scoped resolution
    if (target.region && target.region !== 'any') {
      if (target.kind === 'text') {
        results.push(await this.resolveByRegionText(target));
      } else if (target.kind === 'aria') {
        results.push(await this.resolveByRegionAria(target));
      }
    }

    // Return the best result (highest confidence with valid element)
    const validResults = results.filter(r => r.element && r.confidence > 0);
    if (validResults.length === 0) {
      return {
        element: null,
        selector: '',
        method: target.kind,
        confidence: 0,
        error: `No valid elements found for target: ${JSON.stringify(target)}`,
      };
    }

    // Sort by confidence and return the best match
    validResults.sort((a, b) => b.confidence - a.confidence);
    return validResults[0];
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
