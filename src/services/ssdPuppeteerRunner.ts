// SSD Puppeteer Runner Service
// ============================================================================

import puppeteer, { Browser, Page } from 'puppeteer';
import { TestSpec, TestResult, DataLayerEvent, TrackingHit } from '../types/ssd';
import { isUrlAllowed } from './ssdValidation';

export interface RunnerConfig {
  headless: boolean;
  stepTimeoutMs: number;
  navTimeoutMs: number;
  allowedHosts: string[];
  screenshotDir: string;
  consentProfiles: string[];
}

export interface RunnerResult {
  summary: {
    steps: number;
    passed: number;
    failed: number;
    duration: number;
    consentProfiles: string[];
  };
  results: TestResult[];
  artifacts: {
    screenshotsFolder: string;
    rawLogsPath: string;
  };
}

export class SSDPuppeteerRunner {
  private config: RunnerConfig;
  private browser: Browser | null = null;
  private dataLayerEvents: DataLayerEvent[] = [];
  private trackingHits: TrackingHit[] = [];
  private screenshotCounter = 0;

  constructor(config: RunnerConfig) {
    this.config = config;
  }

  async runTests(testSpec: TestSpec): Promise<RunnerResult> {
    const startTime = Date.now();
    let results: TestResult[] = [];
    let passed = 0;
    let failed = 0;

    try {
      // Launch browser
      this.browser = await puppeteer.launch({
        headless: this.config.headless,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--window-size=1920,1080',
        ],
      });

      // Process each consent profile
      for (const consentProfile of this.config.consentProfiles) {
        const page = await this.browser.newPage();
        
        try {
          // Set up monitoring
          await this.setupMonitoring(page);
          
          // Navigate to the site
          await page.goto(testSpec.site, { 
            waitUntil: 'networkidle2',
            timeout: this.config.navTimeoutMs 
          });

          // Handle consent if needed
          if (consentProfile !== 'accept') {
            await this.handleConsent(page, consentProfile);
          }

          // Run tests for this consent profile
          const profileResults = await this.runTestsForProfile(
            page, 
            testSpec, 
            consentProfile
          );
          
          results.push(...profileResults);
          passed += profileResults.filter(r => r.status === 'PASS').length;
          failed += profileResults.filter(r => r.status === 'FAIL').length;

        } finally {
          await page.close();
        }
      }

      const duration = Date.now() - startTime;

      return {
        summary: {
          steps: results.length,
          passed,
          failed,
          duration,
          consentProfiles: this.config.consentProfiles,
        },
        results,
        artifacts: {
          screenshotsFolder: this.config.screenshotDir,
          rawLogsPath: `${this.config.screenshotDir}/raw-logs.json`,
        },
      };

    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }

  private async setupMonitoring(page: Page): Promise<void> {
    // Monitor dataLayer pushes
    await page.evaluateOnNewDocument(() => {
      const originalPush = window.dataLayer?.push;
      if (originalPush) {
        window.dataLayer.push = function(...args: any[]) {
          const result = originalPush.apply(this, args);
          // Store the event for later retrieval
          (window as any).__ssdDataLayerEvents = (window as any).__ssdDataLayerEvents || [];
          (window as any).__ssdDataLayerEvents.push({
            timestamp: Date.now(),
            payload: args[0]
          });
          return result;
        };
      }
    });

    // Monitor network requests
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const url = request.url();
      const domain = new URL(url).hostname;
      
      // Track common tracking domains
      const trackingDomains = [
        'google-analytics.com',
        'googletagmanager.com',
        'g.doubleclick.net',
        'facebook.com',
        'connect.facebook.net',
        'analytics.google.com',
        'www.google-analytics.com',
      ];

      if (trackingDomains.some(d => domain.includes(d))) {
        this.trackingHits.push({
          timestamp: Date.now(),
          url,
          method: request.method(),
          domain,
        });
      }

      request.continue();
    });

    // Monitor SPA navigation
    await page.evaluateOnNewDocument(() => {
      const originalPushState = history.pushState;
      const originalReplaceState = history.replaceState;
      
      history.pushState = function(...args) {
        (window as any).__ssdNavigationEvents = (window as any).__ssdNavigationEvents || [];
        (window as any).__ssdNavigationEvents.push({
          type: 'pushState',
          timestamp: Date.now(),
          url: args[2]
        });
        return originalPushState.apply(this, args);
      };
      
      history.replaceState = function(...args) {
        (window as any).__ssdNavigationEvents = (window as any).__ssdNavigationEvents || [];
        (window as any).__ssdNavigationEvents.push({
          type: 'replaceState',
          timestamp: Date.now(),
          url: args[2]
        });
        return originalReplaceState.apply(this, args);
      };
    });
  }

  private async handleConsent(page: Page, consentProfile: string): Promise<void> {
    if (consentProfile === 'reject') {
      // Try to find and click "Reject All" or similar buttons
      const rejectSelectors = [
        'button[data-testid*="reject"]',
        'button[class*="reject"]',
        'button:contains("Reject")',
        'button:contains("Decline")',
        'button:contains("No thanks")',
        '[data-consent="reject"]',
        '.consent-reject',
        '#reject-all',
      ];

      for (const selector of rejectSelectors) {
        try {
          const element = await page.$(selector);
          if (element) {
            await element.click();
            await page.waitForTimeout(1000);
            break;
          }
        } catch (error) {
          // Continue trying other selectors
        }
      }
    } else if (consentProfile === 'accept') {
      // Try to find and click "Accept All" or similar buttons
      const acceptSelectors = [
        'button[data-testid*="accept"]',
        'button[class*="accept"]',
        'button:contains("Accept")',
        'button:contains("Allow")',
        'button:contains("I agree")',
        '[data-consent="accept"]',
        '.consent-accept',
        '#accept-all',
      ];

      for (const selector of acceptSelectors) {
        try {
          const element = await page.$(selector);
          if (element) {
            await element.click();
            await page.waitForTimeout(1000);
            break;
          }
        } catch (error) {
          // Continue trying other selectors
        }
      }
    }
  }

  private async runTestsForProfile(
    page: Page, 
    testSpec: TestSpec, 
    consentProfile: string
  ): Promise<TestResult[]> {
    const results: TestResult[] = [];

    for (const test of testSpec.tests) {
      for (let stepIndex = 0; stepIndex < test.steps.length; stepIndex++) {
        const step = test.steps[stepIndex];
        const stepStartTime = Date.now();

        try {
          // Execute the step
          await this.executeStep(page, step, testSpec);
          
          // Verify expectations
          const expectationsMet = await this.verifyExpectations(page, step);
          
          // Take screenshot
          const screenshotPath = await this.takeScreenshot(page, test.section, stepIndex);

          // Get captured events
          const dataLayerEvents = await this.getDataLayerEvents(page);
          const trackingHits = this.getTrackingHits();

          const stepEndTime = Date.now();
          const duration = stepEndTime - stepStartTime;

          results.push({
            section: test.section,
            stepIndex,
            description: step.description,
            status: expectationsMet ? 'PASS' : 'FAIL',
            reasons: expectationsMet ? [] : ['Expectations not met'],
            evidence: {
              screenshotPathOrB64: screenshotPath,
              dataLayerEvents,
              trackingHits,
            },
            timings: {
              startTime: stepStartTime,
              endTime: stepEndTime,
              duration,
            },
          });

          if (expectationsMet) {
            // Increment passed counter
          } else {
            // Increment failed counter
          }

        } catch (error) {
          const stepEndTime = Date.now();
          const duration = stepEndTime - stepStartTime;

          results.push({
            section: test.section,
            stepIndex,
            description: step.description,
            status: 'FAIL',
            reasons: [error instanceof Error ? error.message : 'Unknown error'],
            evidence: {
              screenshotPathOrB64: await this.takeScreenshot(page, test.section, stepIndex),
              dataLayerEvents: await this.getDataLayerEvents(page),
              trackingHits: this.getTrackingHits(),
            },
            timings: {
              startTime: stepStartTime,
              endTime: stepEndTime,
              duration,
            },
          });
        }
      }
    }

    return results;
  }

  private async executeStep(page: Page, step: any, testSpec: TestSpec): Promise<void> {
    // Check if navigation is allowed
    if (step.action === 'navigate' && step.target?.value) {
      const targetUrl = step.target.value;
      if (!isUrlAllowed(targetUrl, testSpec.allowed_hosts || [])) {
        throw new Error(`Navigation to ${targetUrl} is not allowed`);
      }
    }

    switch (step.action) {
      case 'click':
        await this.clickElement(page, step.target);
        break;
      case 'input':
        await this.inputText(page, step.target, step.value);
        break;
      case 'wait_for_selector':
        await this.waitForSelector(page, step.target);
        break;
      case 'wait_for_text':
        await this.waitForText(page, step.target);
        break;
      case 'navigate':
        await this.navigate(page, step.target);
        break;
      case 'maybe_set_quantity':
        await this.maybeSetQuantity(page, step.target, step.value);
        break;
      case 'choose_payment':
        await this.choosePayment(page, step.target);
        break;
      case 'complete_order':
        await this.completeOrder(page);
        break;
      case 'custom':
        await this.executeCustomAction(page, step);
        break;
      default:
        throw new Error(`Unknown action: ${step.action}`);
    }
  }

  private async clickElement(page: Page, target: any): Promise<void> {
    if (!target) throw new Error('Target required for click action');

    const element = await this.findElement(page, target);
    if (!element) {
      throw new Error(`Element not found: ${target.value}`);
    }

    await element.click();
    await page.waitForTimeout(500); // Wait for any animations
  }

  private async inputText(page: Page, target: any, value: string): Promise<void> {
    if (!target) throw new Error('Target required for input action');
    if (!value) throw new Error('Value required for input action');

    const element = await this.findElement(page, target);
    if (!element) {
      throw new Error(`Element not found: ${target.value}`);
    }

    await element.click();
    await element.type(value);
  }

  private async waitForSelector(page: Page, target: any): Promise<void> {
    if (!target) throw new Error('Target required for wait_for_selector action');

    await page.waitForSelector(target.value, { 
      timeout: this.config.stepTimeoutMs 
    });
  }

  private async waitForText(page: Page, target: any): Promise<void> {
    if (!target) throw new Error('Target required for wait_for_text action');

    await page.waitForFunction(
      (text) => document.body.innerText.includes(text),
      { timeout: this.config.stepTimeoutMs },
      target.value
    );
  }

  private async navigate(page: Page, target: any): Promise<void> {
    if (!target) throw new Error('Target required for navigate action');

    await page.goto(target.value, { 
      waitUntil: 'networkidle2',
      timeout: this.config.navTimeoutMs 
    });
  }

  private async maybeSetQuantity(page: Page, target: any, value: string): Promise<void> {
    // Try to find quantity input and set it
    const quantitySelectors = [
      'input[name="quantity"]',
      'input[type="number"]',
      '.quantity-input',
      '[data-testid*="quantity"]',
    ];

    for (const selector of quantitySelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          await element.click();
          await element.type(value);
          return;
        }
      } catch (error) {
        // Continue trying other selectors
      }
    }

    // If no quantity input found, try clicking increment/decrement buttons
    if (target) {
      await this.clickElement(page, target);
    }
  }

  private async choosePayment(page: Page, target: any): Promise<void> {
    // Try to find and select payment method
    if (target) {
      await this.clickElement(page, target);
    } else {
      // Try common payment method selectors
      const paymentSelectors = [
        'input[name="payment_method"]',
        '.payment-method',
        '[data-testid*="payment"]',
      ];

      for (const selector of paymentSelectors) {
        try {
          const element = await page.$(selector);
          if (element) {
            await element.click();
            break;
          }
        } catch (error) {
          // Continue trying other selectors
        }
      }
    }
  }

  private async completeOrder(page: Page): Promise<void> {
    // Try to find and click order completion button
    const orderSelectors = [
      'button[type="submit"]',
      'button:contains("Place Order")',
      'button:contains("Complete Order")',
      'button:contains("Buy Now")',
      '.order-button',
      '[data-testid*="order"]',
    ];

    for (const selector of orderSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          await element.click();
          break;
        }
      } catch (error) {
        // Continue trying other selectors
      }
    }
  }

  private async executeCustomAction(page: Page, step: any): Promise<void> {
    // Execute custom JavaScript if provided
    if (step.customScript) {
      await page.evaluate(step.customScript);
    } else {
      throw new Error('Custom action requires customScript property');
    }
  }

  private async findElement(page: Page, target: any): Promise<any> {
    const { kind, value, region } = target;

    switch (kind) {
      case 'text':
        return await page.$x(`//*[contains(text(), "${value}")]`).then(elements => elements[0]);
      case 'selector':
        return await page.$(value);
      case 'aria':
        return await page.$(`[aria-label="${value}"]`);
      case 'href':
        return await page.$(`a[href*="${value}"]`);
      default:
        throw new Error(`Unknown target kind: ${kind}`);
    }
  }

  private async verifyExpectations(page: Page, step: any): Promise<boolean> {
    if (!step.expect || step.expect.length === 0) {
      return true; // No expectations to verify
    }

    for (const expectation of step.expect) {
      const met = await this.verifyExpectation(page, expectation);
      if (!met) {
        return false;
      }
    }

    return true;
  }

  private async verifyExpectation(page: Page, expectation: any): Promise<boolean> {
    switch (expectation.type) {
      case 'dataLayer':
        return await this.verifyDataLayerExpectation(expectation);
      case 'ga4':
      case 'gtm':
        return await this.verifyTrackingExpectation(expectation);
      case 'network':
        return await this.verifyNetworkExpectation(expectation);
      case 'navigation':
        return await this.verifyNavigationExpectation(page, expectation);
      case 'no_repeat_on_reload':
        return await this.verifyNoRepeatOnReload(page, expectation);
      default:
        return false;
    }
  }

  private async verifyDataLayerExpectation(expectation: any): Promise<boolean> {
    const events = this.dataLayerEvents;
    
    if (expectation.event) {
      const matchingEvents = events.filter(e => e.payload?.event === expectation.event);
      if (matchingEvents.length === 0) return false;

      if (expectation.params_subset) {
        return matchingEvents.some(e => 
          this.isSubset(expectation.params_subset, e.payload)
        );
      }
    }

    if (expectation.contains && expectation.near_previous_n) {
      const recentEvents = events.slice(-expectation.near_previous_n);
      return recentEvents.some(e => 
        this.isSubset(expectation.contains, e.payload)
      );
    }

    return true;
  }

  private async verifyTrackingExpectation(expectation: any): Promise<boolean> {
    const hits = this.trackingHits;
    
    if (expectation.url_contains) {
      return hits.some(hit => hit.url.includes(expectation.url_contains));
    }

    return true;
  }

  private async verifyNetworkExpectation(expectation: any): Promise<boolean> {
    return await this.verifyTrackingExpectation(expectation);
  }

  private async verifyNavigationExpectation(page: Page, expectation: any): Promise<boolean> {
    const currentUrl = page.url();
    
    if (expectation.url_matches) {
      const regex = new RegExp(expectation.url_matches);
      return regex.test(currentUrl);
    }

    if (expectation.url_contains) {
      return currentUrl.includes(expectation.url_contains);
    }

    return true;
  }

  private async verifyNoRepeatOnReload(page: Page, expectation: any): Promise<boolean> {
    const beforeReload = this.dataLayerEvents.length;
    await page.reload({ waitUntil: 'networkidle2' });
    const afterReload = this.dataLayerEvents.length;
    
    // Check if the specific event fired again
    if (expectation.for_event) {
      const newEvents = this.dataLayerEvents.slice(beforeReload);
      return !newEvents.some(e => e.payload?.event === expectation.for_event);
    }

    return true;
  }

  private isSubset(subset: any, obj: any): boolean {
    if (typeof subset !== 'object' || subset === null) {
      return subset === obj;
    }

    if (typeof obj !== 'object' || obj === null) {
      return false;
    }

    for (const key in subset) {
      if (!(key in obj) || !this.isSubset(subset[key], obj[key])) {
        return false;
      }
    }

    return true;
  }

  private async takeScreenshot(page: Page, section: string, stepIndex: number): Promise<string> {
    this.screenshotCounter++;
    const filename = `screenshot-${section}-${stepIndex}-${this.screenshotCounter}.png`;
    const filepath = `${this.config.screenshotDir}/${filename}`;
    
    await page.screenshot({ 
      path: filepath,
      fullPage: true 
    });
    
    return filepath;
  }

  private async getDataLayerEvents(page: Page): Promise<DataLayerEvent[]> {
    return await page.evaluate(() => {
      return (window as any).__ssdDataLayerEvents || [];
    });
  }

  private getTrackingHits(): TrackingHit[] {
    return [...this.trackingHits];
  }
}

// Factory function
export function createSSDPuppeteerRunner(config: RunnerConfig): SSDPuppeteerRunner {
  return new SSDPuppeteerRunner(config);
}
