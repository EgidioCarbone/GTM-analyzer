// SSD Consent Handler
// Consent profile support (accept/reject) with CMP interaction
// ============================================================================

import { Page } from 'puppeteer';
import { SSD_DEFAULTS, getConfigValue } from '../config/ssd-defaults';

export interface ConsentProfile {
  name: 'accept' | 'reject';
  description: string;
  selectors: string[];
  iframeSelectors?: string[];
  waitForSelector?: string;
  timeout?: number;
}

export interface ConsentResult {
  success: boolean;
  profile: ConsentProfile;
  method: string;
  error?: string;
  screenshot?: string;
}

export class ConsentHandlerError extends Error {
  constructor(message: string, public profile: ConsentProfile) {
    super(message);
    this.name = 'ConsentHandlerError';
  }
}

export class SSDConsentHandler {
  private page: Page;
  private timeout: number;

  // Common CMP selectors for different consent management platforms
  private readonly consentProfiles: ConsentProfile[];

  constructor(page: Page, timeout?: number) {
    this.page = page;
    this.timeout = timeout || getConfigValue('CONSENT_BANNER_TIMEOUT_MS', SSD_DEFAULTS.timeout.consent.bannerInteraction, val => Number.parseInt(val, 10));
    
    // Build consent profiles from centralized configuration
    this.consentProfiles = this.buildConsentProfiles();
  }
  
  /**
   * Build consent profiles from centralized CMP selectors
   */
  private buildConsentProfiles(): ConsentProfile[] {
    const cmpConfig = SSD_DEFAULTS.cmp;
    const bannerTimeout = getConfigValue('CONSENT_BANNER_DETECTION_MS', SSD_DEFAULTS.timeout.consent.bannerDetection, val => Number.parseInt(val, 10));
    
    return [
      {
        name: 'accept',
        description: 'Accept all cookies',
        selectors: [
          ...cmpConfig.onetrust.accept,
          ...cmpConfig.cookiebot.accept,
          ...cmpConfig.trustarc.accept,
          ...cmpConfig.generic.accept,
          // Additional CMP-specific patterns
          '.cky-btn-accept',
          '#cookie_action_close_header',
          '.truste_consent_accept',
          '#truste_consent_button',
          '[data-optanongroupid="C0001"]',
        ],
        iframeSelectors: [
          'iframe[src*="consent"]',
          'iframe[src*="cookie"]',
          'iframe[id*="consent"]',
          'iframe[id*="cookie"]',
        ],
        waitForSelector: '.consent-banner, #consent-banner, .cookie-banner, #cookie-banner',
        timeout: bannerTimeout,
      },
      {
        name: 'reject',
        description: 'Reject all cookies',
        selectors: [
          ...cmpConfig.onetrust.reject,
          ...cmpConfig.cookiebot.reject,
          ...cmpConfig.trustarc.reject,
          ...cmpConfig.generic.reject,
          // Additional CMP-specific patterns
          '.cky-btn-decline',
          '#cookie_action_close_header_reject',
          '.truste_consent_reject',
          '[data-optanongroupid="C0002"]',
          '.ot-pc-refuse-all-handler',
        ],
        iframeSelectors: [
          'iframe[src*="consent"]',
          'iframe[src*="cookie"]',
          'iframe[id*="consent"]',
          'iframe[id*="cookie"]',
        ],
        waitForSelector: '.consent-banner, #consent-banner, .cookie-banner, #cookie-banner',
        timeout: bannerTimeout,
      },
    ];
  }

  /**
   * Apply consent profile to the current page
   */
  async applyConsentProfile(profileName: 'accept' | 'reject'): Promise<ConsentResult> {
    const profile = this.consentProfiles.find(p => p.name === profileName);
    if (!profile) {
      throw new ConsentHandlerError(`Unknown consent profile: ${profileName}`, profile!);
    }

    try {
      // Wait for consent banner to appear
      if (profile.waitForSelector) {
        await this.waitForConsentBanner(profile);
      }

      // Try to find and click consent button
      const result = await this.findAndClickConsentButton(profile);
      
      if (result.success) {
        // Wait a bit for the consent to be processed
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      return result;

    } catch (error) {
      return {
        success: false,
        profile,
        method: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Wait for consent banner to appear
   */
  private async waitForConsentBanner(profile: ConsentProfile): Promise<void> {
    const timeout = profile.timeout || this.timeout;
    
    try {
      await this.page.waitForSelector(profile.waitForSelector!, { timeout });
    } catch (error) {
      // Consent banner might not appear on this page, that's okay
      console.log(`Consent banner not found: ${profile.waitForSelector}`);
    }
  }

  /**
   * Find and click consent button
   */
  private async findAndClickConsentButton(profile: ConsentProfile): Promise<ConsentResult> {
    // Try main page selectors first
    for (const selector of profile.selectors) {
      try {
        const element = await this.page.$(selector);
        if (element) {
          const isVisible = await element.isVisible();
          if (isVisible) {
            await element.click();
            return {
              success: true,
              profile,
              method: `main_page_selector: ${selector}`,
            };
          }
        }
      } catch (error) {
        // Continue to next selector
        continue;
      }
    }

    // Try iframe selectors
    if (profile.iframeSelectors) {
      for (const iframeSelector of profile.iframeSelectors) {
        try {
          const iframe = await this.page.$(iframeSelector);
          if (iframe) {
            const frame = await iframe.contentFrame();
            if (frame) {
              for (const selector of profile.selectors) {
                try {
                  const element = await frame.$(selector);
                  if (element) {
                    const isVisible = await element.isVisible();
                    if (isVisible) {
                      await element.click();
                      return {
                        success: true,
                        profile,
                        method: `iframe_selector: ${iframeSelector} -> ${selector}`,
                      };
                    }
                  }
                } catch (error) {
                  // Continue to next selector
                  continue;
                }
              }
            }
          }
        } catch (error) {
          // Continue to next iframe
          continue;
        }
      }
    }

    // Try generic text-based search
    const textSearchResult = await this.findAndClickByText(profile);
    if (textSearchResult.success) {
      return textSearchResult;
    }

    return {
      success: false,
      profile,
      method: 'not_found',
      error: 'No consent button found with any known selectors',
    };
  }

  /**
   * Find and click consent button by text content
   */
  private async findAndClickByText(profile: ConsentProfile): Promise<ConsentResult> {
    const textPatterns = this.getTextPatterns(profile.name);
    
    for (const pattern of textPatterns) {
      try {
        // Search in main page
        const element = await this.page.$(`text=${pattern}`);
        if (element) {
          const isVisible = await element.isVisible();
          if (isVisible) {
            await element.click();
            return {
              success: true,
              profile,
              method: `text_search: ${pattern}`,
            };
          }
        }

        // Search in iframes
        const iframes = await this.page.$$('iframe');
        for (const iframe of iframes) {
          try {
            const frame = await iframe.contentFrame();
            if (frame) {
              const iframeElement = await frame.$(`text=${pattern}`);
              if (iframeElement) {
                const isVisible = await iframeElement.isVisible();
                if (isVisible) {
                  await iframeElement.click();
                  return {
                    success: true,
                    profile,
                    method: `iframe_text_search: ${pattern}`,
                  };
                }
              }
            }
          } catch (error) {
            // Continue to next iframe
            continue;
          }
        }
      } catch (error) {
        // Continue to next pattern
        continue;
      }
    }

    return {
      success: false,
      profile,
      method: 'text_search_failed',
      error: 'No consent button found by text search',
    };
  }

  /**
   * Get text patterns for consent profile
   */
  private getTextPatterns(profileName: 'accept' | 'reject'): string[] {
    if (profileName === 'accept') {
      return [
        'Accept All',
        'Accept',
        'Allow All',
        'Allow',
        'I Accept',
        'I Agree',
        'OK',
        'Continue',
        'Yes',
        'Agree',
        'Accept Cookies',
        'Accept All Cookies',
      ];
    } else {
      return [
        'Reject All',
        'Reject',
        'Decline All',
        'Decline',
        'No Thanks',
        'No',
        'Reject Cookies',
        'Reject All Cookies',
        'Decline Cookies',
        'Decline All Cookies',
      ];
    }
  }

  /**
   * Check if consent banner is present
   */
  async isConsentBannerPresent(): Promise<boolean> {
    const commonSelectors = [
      '.consent-banner',
      '#consent-banner',
      '.cookie-banner',
      '#cookie-banner',
      '.privacy-banner',
      '#privacy-banner',
      '[data-testid*="consent"]',
      '[data-testid*="cookie"]',
    ];

    for (const selector of commonSelectors) {
      try {
        const element = await this.page.$(selector);
        if (element) {
          const isVisible = await element.isVisible();
          if (isVisible) {
            return true;
          }
        }
      } catch (error) {
        // Continue to next selector
        continue;
      }
    }

    return false;
  }

  /**
   * Get consent banner text content
   */
  async getConsentBannerText(): Promise<string> {
    const commonSelectors = [
      '.consent-banner',
      '#consent-banner',
      '.cookie-banner',
      '#cookie-banner',
      '.privacy-banner',
      '#privacy-banner',
    ];

    for (const selector of commonSelectors) {
      try {
        const element = await this.page.$(selector);
        if (element) {
          const isVisible = await element.isVisible();
          if (isVisible) {
            const text = await element.textContent();
            if (text && text.trim()) {
              return text.trim();
            }
          }
        }
      } catch (error) {
        // Continue to next selector
        continue;
      }
    }

    return '';
  }

  /**
   * Take screenshot of consent banner
   */
  async takeConsentBannerScreenshot(): Promise<string | null> {
    try {
      const commonSelectors = [
        '.consent-banner',
        '#consent-banner',
        '.cookie-banner',
        '#cookie-banner',
        '.privacy-banner',
        '#privacy-banner',
      ];

      for (const selector of commonSelectors) {
        try {
          const element = await this.page.$(selector);
          if (element) {
            const isVisible = await element.isVisible();
            if (isVisible) {
              const screenshot = await element.screenshot({ encoding: 'base64' });
              return screenshot as string;
            }
          }
        } catch (error) {
          // Continue to next selector
          continue;
        }
      }

      // If no specific banner found, take full page screenshot
      const screenshot = await this.page.screenshot({ encoding: 'base64' });
      return screenshot as string;

    } catch (error) {
      console.error('Failed to take consent banner screenshot:', error);
      return null;
    }
  }

  /**
   * Wait for consent banner to disappear
   */
  async waitForConsentBannerToDisappear(timeout: number = 5000): Promise<boolean> {
    try {
      const commonSelectors = [
        '.consent-banner',
        '#consent-banner',
        '.cookie-banner',
        '#cookie-banner',
        '.privacy-banner',
        '#privacy-banner',
      ];

      for (const selector of commonSelectors) {
        try {
          await this.page.waitForFunction(
            (sel) => {
              const element = document.querySelector(sel);
              return !element || element.style.display === 'none' || !element.offsetParent;
            },
            { timeout },
            selector
          );
          return true;
        } catch (error) {
          // Continue to next selector
          continue;
        }
      }

      return false;
    } catch (error) {
      return false;
    }
  }
}
