// SSD Puppeteer Runner
// Main test runner with dataLayer tracking, network monitoring, and SPA detection
// ============================================================================

import puppeteer, { Browser, Page } from 'puppeteer';
import { TestSpec, TestResult, DataLayerEvent, TrackingHit } from '../types/ssd';
import { SSDTargetResolver } from './ssdTargetResolver';
import { SSDExpectationMatcher, ExpectationContext } from './ssdExpectationMatcher';
import { SSDConsentHandler } from './ssdConsentHandler';

export interface RunOptions {
  headless?: boolean;
  consent?: 'accept' | 'reject' | 'both';
  timeout?: number;
  navTimeoutMs?: number;
  requestTimeoutMs?: number;
  spaRouteTimeoutMs?: number;
  fuzzy?: boolean;
  screenshotDir?: string;
  allowedHosts?: string[];
  allowedTracking?: string[];
  allowedCDNs?: string[];
}

export interface RunResult {
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

export class SSDRunnerError extends Error {
  constructor(message: string, public stepIndex?: number) {
    super(message);
    this.name = 'SSDRunnerError';
  }
}

export class SSDPuppeteerRunner {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private dataLayerEvents: DataLayerEvent[] = [];
  private trackingHits: TrackingHit[] = [];
  private screenshotDir: string;
  private timeout: number;
  private navTimeout: number;
  private requestTimeout: number;
  private spaRouteTimeout: number;
  private fuzzy: boolean;

  constructor(options: { screenshotDir?: string; timeout?: number; navTimeoutMs?: number; requestTimeoutMs?: number; spaRouteTimeoutMs?: number; fuzzy?: boolean } = {}) {
    this.screenshotDir = options.screenshotDir || 'screenshots';
    this.timeout = options.timeout || 30000;
    this.navTimeout = options.navTimeoutMs || 30000;
    this.requestTimeout = options.requestTimeoutMs || 10000;
    this.spaRouteTimeout = options.spaRouteTimeoutMs || 5000;
    this.fuzzy = options.fuzzy || false;
  }

  /**
   * Run the complete test specification
   */
  async runTests(testSpec: TestSpec, options: RunOptions = {}): Promise<RunResult> {
    const startTime = Date.now();
    let results: TestResult[] = [];
    let consentProfiles: string[] = [];

    // Update timeouts from options
    if (options.navTimeoutMs) {
      this.navTimeout = options.navTimeoutMs;
    }
    if (options.requestTimeoutMs) {
      this.requestTimeout = options.requestTimeoutMs;
    }
    if (options.spaRouteTimeoutMs) {
      this.spaRouteTimeout = options.spaRouteTimeoutMs;
    }
    if (options.fuzzy !== undefined) {
      this.fuzzy = options.fuzzy;
    }

    try {
      // Initialize browser and page
      await this.initializeBrowser(options);

      // Determine consent profiles to run
      if (options.consent === 'both') {
        consentProfiles = ['accept', 'reject'];
      } else if (options.consent) {
        consentProfiles = [options.consent];
      } else {
        consentProfiles = testSpec.consent || ['accept'];
      }

      // Run tests for each consent profile
      for (const profile of consentProfiles) {
        const profileResults = await this.runTestsForProfile(testSpec, profile, options);
        results = results.concat(profileResults);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      return {
        summary: {
          steps: results.length,
          passed: results.filter(r => r.status === 'PASS').length,
          failed: results.filter(r => r.status === 'FAIL').length,
          duration,
          consentProfiles,
        },
        results,
        artifacts: {
          screenshotsFolder: this.screenshotDir,
          rawLogsPath: `${this.screenshotDir}/raw-logs.json`,
        },
      };

    } finally {
      await this.cleanup();
    }
  }

  /**
   * Initialize browser and page
   */
  private async initializeBrowser(options: RunOptions): Promise<void> {
    this.browser = await puppeteer.launch({
      headless: options.headless !== false ? "new" : false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
      ],
    });

    this.page = await this.browser.newPage();

    // Set up dataLayer tracking
    await this.setupDataLayerTracking();

    // Set up network monitoring
    await this.setupNetworkMonitoring(options);

    // Set up SPA detection
    await this.setupSPADetection();

    // Set viewport and user agent
    await this.page.setViewport({ width: 1280, height: 720 });
    await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

    // Set up navigation allowlist
    if (this.page) {
      await this.page.setRequestInterception(true);
      this.page.on('request', (request) => {
        try {
          const url = new URL(request.url());
          const isAllowed = this.isRequestAllowed(url, options);
          
          if (isAllowed) {
            request.continue();
          } else {
            request.abort();
          }
        } catch (error) {
          // If request is already terminated, ignore the error
          console.warn('Request handling error (likely already terminated):', error);
        }
      });
    }
  }

  /**
   * Set up dataLayer tracking
   */
  private async setupDataLayerTracking(): Promise<void> {
    if (!this.page) return;

    await this.page.evaluateOnNewDocument(() => {
      // Override dataLayer.push to capture events
      if (window.dataLayer) {
        const originalPush = window.dataLayer.push;
        window.dataLayer.push = function(...args: any[]) {
          const result = originalPush.apply(this, args);
          
          // Emit custom event for our tracking
          window.dispatchEvent(new CustomEvent('dataLayerPush', {
            detail: {
              timestamp: Date.now(),
              payload: args[0],
            }
          }));
          
          return result;
        };
      } else {
        // Initialize dataLayer if it doesn't exist
        window.dataLayer = [];
        window.dataLayer.push = function(...args: any[]) {
          window.dataLayer.push.apply(this, args);
          
          window.dispatchEvent(new CustomEvent('dataLayerPush', {
            detail: {
              timestamp: Date.now(),
              payload: args[0],
            }
          }));
        };
      }
    });

    // Listen for dataLayer events
    this.page.on('console', (msg) => {
      if (msg.type() === 'log' && msg.text().includes('dataLayer')) {
        // Handle console-based dataLayer events if needed
      }
    });
  }

  /**
   * Set up network monitoring
   */
  private async setupNetworkMonitoring(options: RunOptions = {}): Promise<void> {
    if (!this.page) return;

    // Get tracking domains from options or use defaults
    const trackingDomains = options.allowedTracking || [
      'google-analytics.com',
      'googletagmanager.com',
      'g.doubleclick.net',
      'facebook.com/tr',
      'connect.facebook.net',
      'analytics.google.com',
      'www.google-analytics.com',
    ];

    this.page.on('request', (request) => {
      const url = request.url();
      const domain = new URL(url).hostname;
      
      // Track requests to configured analytics domains
      if (trackingDomains.some(d => domain.includes(d))) {
        this.trackingHits.push({
          timestamp: Date.now(),
          url,
          method: request.method(),
          domain,
        });
      }
    });

    this.page.on('response', (response) => {
      const url = response.url();
      const domain = new URL(url).hostname;
      
      if (trackingDomains.some(d => domain.includes(d))) {
        // Update existing tracking hit with status
        const existingHit = this.trackingHits.find(hit => hit.url === url && !hit.status);
        if (existingHit) {
          existingHit.status = response.status();
        }
      }
    });
  }

  /**
   * Set up SPA detection
   */
  private async setupSPADetection(): Promise<void> {
    if (!this.page) return;

    await this.page.evaluateOnNewDocument(() => {
      // Patch history methods to detect route changes
      const originalPushState = history.pushState;
      const originalReplaceState = history.replaceState;

      history.pushState = function(...args: any[]) {
        const result = originalPushState.apply(this, args);
        window.dispatchEvent(new CustomEvent('spaRouteChange', {
          detail: {
            type: 'pushState',
            url: args[2] || location.href,
            timestamp: Date.now(),
          }
        }));
        return result;
      };

      history.replaceState = function(...args: any[]) {
        const result = originalReplaceState.apply(this, args);
        window.dispatchEvent(new CustomEvent('spaRouteChange', {
          detail: {
            type: 'replaceState',
            url: args[2] || location.href,
            timestamp: Date.now(),
          }
        }));
        return result;
      };

      // Listen for popstate events
      window.addEventListener('popstate', () => {
        window.dispatchEvent(new CustomEvent('spaRouteChange', {
          detail: {
            type: 'popstate',
            url: location.href,
            timestamp: Date.now(),
          }
        }));
      });
    });
  }

  /**
   * Run tests for a specific consent profile
   */
  private async runTestsForProfile(
    testSpec: TestSpec,
    consentProfile: string,
    options: RunOptions
  ): Promise<TestResult[]> {
    if (!this.page) throw new SSDRunnerError('Page not initialized');

    const results: TestResult[] = [];

    try {
      // Navigate to the site
      await this.page.goto(testSpec.site, { waitUntil: 'networkidle2', timeout: this.navTimeout });

      // Apply consent profile
      if (consentProfile === 'accept' || consentProfile === 'reject') {
        const consentHandler = new SSDConsentHandler(this.page);
        await consentHandler.applyConsentProfile(consentProfile);
      }

      // Run each test section
      for (const test of testSpec.tests) {
        const testResults = await this.runTestSection(test, testSpec, options);
        results.push(...testResults);
      }

    } catch (error) {
      console.error(`Error running tests for consent profile ${consentProfile}:`, error);
    }

    return results;
  }

  /**
   * Run a single test section
   */
  private async runTestSection(
    test: any,
    testSpec: TestSpec,
    options: RunOptions
  ): Promise<TestResult[]> {
    if (!this.page) throw new SSDRunnerError('Page not initialized');

    const results: TestResult[] = [];
    const targetResolver = new SSDTargetResolver(this.page, this.timeout);
    const expectationMatcher = new SSDExpectationMatcher(this.page, { fuzzy: this.fuzzy });

    for (let stepIndex = 0; stepIndex < test.steps.length; stepIndex++) {
      const step = test.steps[stepIndex];
      const stepStartTime = Date.now();

      try {
        // Execute the step
        await this.executeStep(step, targetResolver);

        // Wait for SPA route changes or async operations
        try {
          const waitReason = await this.waitForSPARouteChange();
          console.log(`[Step ${stepIndex}] SPA wait completed: ${waitReason}`);
        } catch (error) {
          console.warn(`[Step ${stepIndex}] SPA wait failed, continuing:`, error);
        }

        // Check expectations
        const expectationContext: ExpectationContext = {
          dataLayerEvents: this.dataLayerEvents,
          trackingHits: this.trackingHits,
          currentUrl: this.page.url(),
          stepStartTime,
          stepEndTime: Date.now(),
        };

        let stepPassed = true;
        const reasons: string[] = [];

        if (step.expect && step.expect.length > 0) {
          for (const expectation of step.expect) {
            const matchResult = await expectationMatcher.matchExpectation(expectation, expectationContext);
            if (!matchResult.passed) {
              stepPassed = false;
              reasons.push(matchResult.reason);
            }
          }
        }

        // Take screenshot
        const screenshot = await this.takeScreenshot(stepIndex, test.section);

        // Create result
        const result: TestResult = {
          section: test.section,
          stepIndex,
          description: step.description,
          status: stepPassed ? 'PASS' : 'FAIL',
          reasons: reasons.length > 0 ? reasons : undefined,
          evidence: {
            screenshotPathOrB64: screenshot,
            dataLayerEvents: this.dataLayerEvents.filter(e => 
              e.timestamp >= stepStartTime && e.timestamp <= Date.now()
            ),
            trackingHits: this.trackingHits.filter(h => 
              h.timestamp >= stepStartTime && h.timestamp <= Date.now()
            ),
          },
          timings: {
            startTime: stepStartTime,
            endTime: Date.now(),
            duration: Date.now() - stepStartTime,
          },
        };

        results.push(result);

      } catch (error) {
        // Handle step execution error
        const stepPath = `tests[${testSpec.tests.indexOf(test)}].steps[${stepIndex}]`;
        const failureScreenshot = await this.takeFailureScreenshot(stepPath);
        const regularScreenshot = await this.takeScreenshot(stepIndex, test.section);
        
        const result: TestResult = {
          section: test.section,
          stepIndex,
          description: step.description,
          status: 'FAIL',
          reasons: [error instanceof Error ? error.message : 'Unknown error'],
          evidence: {
            screenshotPathOrB64: failureScreenshot || regularScreenshot,
            dataLayerEvents: [],
            trackingHits: [],
          },
          timings: {
            startTime: stepStartTime,
            endTime: Date.now(),
            duration: Date.now() - stepStartTime,
          },
        };

        results.push(result);
      }
    }

    return results;
  }

  /**
   * Execute a single step
   */
  private async executeStep(step: any, targetResolver: SSDTargetResolver): Promise<void> {
    if (!this.page) throw new SSDRunnerError('Page not initialized');

    switch (step.action) {
      case 'click':
        await this.executeClickStep(step, targetResolver);
        break;
      case 'input':
        await this.executeInputStep(step, targetResolver);
        break;
      case 'wait_for_selector':
        await this.executeWaitForSelectorStep(step);
        break;
      case 'wait_for_text':
        await this.executeWaitForTextStep(step);
        break;
      case 'navigate':
        await this.executeNavigateStep(step);
        break;
      case 'maybe_set_quantity':
        await this.executeMaybeSetQuantityStep(step, targetResolver);
        break;
      case 'choose_payment':
        await this.executeChoosePaymentStep(step, targetResolver);
        break;
      case 'complete_order':
        await this.executeCompleteOrderStep(step, targetResolver);
        break;
      case 'custom':
        await this.executeCustomStep(step);
        break;
      default:
        throw new SSDRunnerError(`Unknown action: ${step.action}`);
    }
  }

  /**
   * Execute click step
   */
  private async executeClickStep(step: any, targetResolver: SSDTargetResolver): Promise<void> {
    if (!step.target) throw new SSDRunnerError('Click step requires target');

    console.log(`[Click Step] Resolving target: ${JSON.stringify(step.target)}`);
    const resolution = await targetResolver.resolveTarget(step.target);
    
    if (!resolution.element) {
      const errorMsg = `Could not resolve target for click: ${resolution.error || 'Unknown error'}. Target: ${JSON.stringify(step.target)}`;
      console.error(`[Click Step] ❌ ${errorMsg}`);
      throw new SSDRunnerError(errorMsg);
    }

    console.log(`[Click Step] ✅ Target resolved: ${resolution.selector} (method: ${resolution.method}, confidence: ${resolution.confidence})`);
    
    try {
      await resolution.element.click();
      console.log(`[Click Step] ✅ Click executed successfully`);
    } catch (clickError) {
      console.error(`[Click Step] ❌ Click failed:`, clickError);
      throw new SSDRunnerError(`Click failed: ${clickError.message}`);
    }
    
    // Wait for SPA route changes after click
    try {
      const waitReason = await this.waitForSPARouteChange();
      console.log(`[Click Step] SPA wait completed: ${waitReason}`);
    } catch (error) {
      console.warn(`[Click Step] SPA wait failed, continuing:`, error);
    }
  }

  /**
   * Execute input step
   */
  private async executeInputStep(step: any, targetResolver: SSDTargetResolver): Promise<void> {
    if (!step.target) throw new SSDRunnerError('Input step requires target');
    if (!step.value) throw new SSDRunnerError('Input step requires value');

    const resolution = await targetResolver.resolveTarget(step.target);
    if (!resolution.element) {
      throw new SSDRunnerError(`Could not resolve target for input: ${resolution.error}`);
    }

    await resolution.element.type(step.value);
  }

  /**
   * Execute wait for selector step
   */
  private async executeWaitForSelectorStep(step: any): Promise<void> {
    if (!step.target) throw new SSDRunnerError('Wait for selector step requires target');

    await this.page!.waitForSelector(step.target.value, { timeout: this.timeout });
  }

  /**
   * Execute wait for text step
   */
  private async executeWaitForTextStep(step: any): Promise<void> {
    if (!step.target) throw new SSDRunnerError('Wait for text step requires target');

    await this.page!.waitForSelector(`text=${step.target.value}`, { timeout: this.timeout });
  }

  /**
   * Execute navigate step
   */
  private async executeNavigateStep(step: any): Promise<void> {
    if (!step.target) {
      // If no target, treat as wait for state change
      console.log('Navigate step without target - waiting for state change');
      try {
        const waitReason = await this.waitForSPARouteChange();
        console.log(`[Navigate Step] SPA wait completed: ${waitReason}`);
      } catch (error) {
        console.warn(`[Navigate Step] SPA wait failed, continuing:`, error);
      }
      return;
    }

    const url = step.target.value;
    
    try {
      // Handle relative URLs
      if (url.startsWith('/') || url.startsWith('./') || url.startsWith('../')) {
        const currentUrl = this.page!.url();
        const resolvedUrl = new URL(url, currentUrl).href;
        console.log(`Resolved relative URL: ${url} -> ${resolvedUrl}`);
        await this.page!.goto(resolvedUrl, { waitUntil: 'networkidle2', timeout: this.timeout });
      } else if (url.startsWith('http://') || url.startsWith('https://')) {
        // Absolute URL
        await this.page!.goto(url, { waitUntil: 'networkidle2', timeout: this.timeout });
      } else {
        // Treat as relative path
        const currentUrl = this.page!.url();
        const resolvedUrl = new URL(url, currentUrl).href;
        console.log(`Treated as relative path: ${url} -> ${resolvedUrl}`);
        await this.page!.goto(resolvedUrl, { waitUntil: 'networkidle2', timeout: this.timeout });
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('Cannot navigate to invalid URL')) {
        throw new SSDRunnerError(`Invalid URL for navigation: ${url}. Please use absolute URLs or relative paths starting with '/'.`);
      }
      throw error;
    }
  }

  /**
   * Execute maybe set quantity step
   */
  private async executeMaybeSetQuantityStep(step: any, targetResolver: SSDTargetResolver): Promise<void> {
    if (!step.target) throw new SSDRunnerError('Maybe set quantity step requires target');

    const resolution = await targetResolver.resolveTarget(step.target);
    if (!resolution.element) {
      throw new SSDRunnerError(`Could not resolve target for quantity: ${resolution.error}`);
    }

    // Try to set quantity to 1 if not already set
    const currentValue = await resolution.element.evaluate((el: any) => el.value);
    if (!currentValue || currentValue === '0') {
      await resolution.element.type('1');
    }
  }

  /**
   * Execute choose payment step
   */
  private async executeChoosePaymentStep(step: any, targetResolver: SSDTargetResolver): Promise<void> {
    if (!step.target) throw new SSDRunnerError('Choose payment step requires target');

    const resolution = await targetResolver.resolveTarget(step.target);
    if (!resolution.element) {
      throw new SSDRunnerError(`Could not resolve target for payment: ${resolution.error}`);
    }

    await resolution.element.click();
  }

  /**
   * Execute complete order step
   */
  private async executeCompleteOrderStep(step: any, targetResolver: SSDTargetResolver): Promise<void> {
    // This is a complex step that might involve multiple actions
    // For now, we'll look for common "complete order" buttons
    const commonSelectors = [
      'button[data-testid*="complete"]',
      'button[data-testid*="submit"]',
      'button[data-testid*="order"]',
      'button:contains("Complete Order")',
      'button:contains("Place Order")',
      'button:contains("Submit Order")',
      'button:contains("Buy Now")',
      'button:contains("Purchase")',
    ];

    for (const selector of commonSelectors) {
      try {
        const element = await this.page!.$(selector);
        if (element) {
          const isVisible = await element.isVisible();
          if (isVisible) {
            await element.click();
            return;
          }
        }
      } catch (error) {
        // Continue to next selector
        continue;
      }
    }

    throw new SSDRunnerError('Could not find complete order button');
  }

  /**
   * Execute custom step
   */
  private async executeCustomStep(step: any): Promise<void> {
    // Custom steps would need to be implemented based on specific requirements
    throw new SSDRunnerError('Custom steps not yet implemented');
  }

  /**
   * Take screenshot of current page
   */
  private async takeScreenshot(stepIndex: number, section: string): Promise<string> {
    if (!this.page) return '';

    try {
      const filename = `${section.replace(/\s+/g, '_')}_step_${stepIndex}_${Date.now()}.png`;
      const filepath = `${this.screenshotDir}/${filename}`;
      
      await this.page.screenshot({ path: filepath, fullPage: true });
      
      // Also return base64 for immediate use
      const base64 = await this.page.screenshot({ encoding: 'base64' });
      return base64;
    } catch (error) {
      console.error('Failed to take screenshot:', error);
      return '';
    }
  }

  /**
   * Take screenshot on failure with specific naming
   */
  private async takeFailureScreenshot(stepPath: string): Promise<string> {
    if (!this.page) return '';

    try {
      const filename = `${stepPath}_fail.png`;
      const filepath = `${this.screenshotDir}/${filename}`;
      
      await this.page.screenshot({ path: filepath, fullPage: true });
      
      // Also return base64 for immediate use
      const base64 = await this.page.screenshot({ encoding: 'base64' });
      return base64;
    } catch (error) {
      console.error('Failed to take failure screenshot:', error);
      return '';
    }
  }

  /**
   * Wait for SPA route change using Promise.race
   */
  private async waitForSPARouteChange(): Promise<string> {
    if (!this.page) throw new SSDRunnerError('Page not initialized');

    return new Promise((resolve, reject) => {
      let resolved = false;
      let resolutionReason = '';

      // 1. Listen for custom spaRouteChange event
      const spaRouteHandler = (event: any) => {
        if (resolved) return;
        resolved = true;
        resolutionReason = 'spaRouteChange event';
        console.log(`[SPA Wait] Resolved by: ${resolutionReason}`);
        resolve(resolutionReason);
      };

      // 2. Wait for navigation
      const navigationPromise = this.page!.waitForNavigation({ 
        waitUntil: 'networkidle2',
        timeout: this.spaRouteTimeout 
      }).then(() => {
        if (resolved) return;
        resolved = true;
        resolutionReason = 'page.waitForNavigation';
        console.log(`[SPA Wait] Resolved by: ${resolutionReason}`);
        return resolutionReason;
      }).catch((error) => {
        if (resolved) return;
        resolved = true;
        resolutionReason = 'page.waitForNavigation (timeout)';
        console.log(`[SPA Wait] Resolved by: ${resolutionReason}`);
        return resolutionReason;
      });

      // 3. Timeout fallback
      const timeoutPromise = new Promise<string>((timeoutResolve) => {
        setTimeout(() => {
          if (resolved) return;
          resolved = true;
          resolutionReason = 'explicit timeout';
          console.log(`[SPA Wait] Resolved by: ${resolutionReason}`);
          timeoutResolve(resolutionReason);
        }, this.spaRouteTimeout);
      });

      // Set up event listener
      this.page!.on('spaRouteChange', spaRouteHandler);

      // Race between all conditions
      Promise.race([
        navigationPromise,
        timeoutPromise
      ]).then((reason) => {
        // Clean up event listener
        this.page!.off('spaRouteChange', spaRouteHandler);
        if (!resolved) {
          resolved = true;
          resolutionReason = reason;
          console.log(`[SPA Wait] Resolved by: ${resolutionReason}`);
          resolve(resolutionReason);
        }
      }).catch((error) => {
        // Clean up event listener
        this.page!.off('spaRouteChange', spaRouteHandler);
        if (!resolved) {
          resolved = true;
          resolutionReason = 'error';
          console.log(`[SPA Wait] Resolved by: ${resolutionReason} - ${error.message}`);
          reject(error);
        }
      });
    });
  }

  /**
   * Check if a request should be allowed based on allowlist configuration
   */
  private isRequestAllowed(url: URL, options: RunOptions = {}): boolean {
    const hostname = url.hostname;
    const pathname = url.pathname;
    
    // Always allow data: and blob: protocols
    if (url.protocol === 'data:' || url.protocol === 'blob:') {
      return true;
    }
    
    // Always allow the main site and allowed hosts
    if (options.allowedHosts && options.allowedHosts.includes(hostname)) {
      return true;
    }
    
    // Allow tracking domains
    const trackingDomains = options.allowedTracking || [
      'google-analytics.com',
      'googletagmanager.com',
      'g.doubleclick.net',
      'facebook.com/tr',
      'connect.facebook.net',
      'analytics.google.com',
      'www.google-analytics.com',
    ];
    
    if (trackingDomains.some(domain => hostname.includes(domain))) {
      return true;
    }
    
    // Allow CDN domains (extended with common hosts)
    const cdnDomains = options.allowedCDNs || [
      'cdnjs.cloudflare.com',
      'unpkg.com',
      'jsdelivr.net',
      'fonts.googleapis.com',
      'fonts.gstatic.com',
      // Extended common hosts
      '*.gstatic.com',
      '*.googleapis.com',
      '*.googletagmanager.com',
      '*.google-analytics.com',
      'fonts.gstatic.com',
      'fonts.googleapis.com',
      '*.cloudflare.com',
      '*.cdn.jsdelivr.net',
      '*.unpkg.com',
    ];
    
    if (cdnDomains.some(domain => {
      // Handle wildcard domains
      if (domain.startsWith('*.')) {
        const baseDomain = domain.substring(2);
        return hostname.endsWith(baseDomain);
      }
      return hostname.includes(domain);
    })) {
      return true;
    }
    
    // Allow common CMP domains (consent management platforms)
    const cmpDomains = [
      'consent.trustarc.com',
      'consent.cookiebot.com',
      'consent.one-trust.com',
      'consent.cookieyes.com',
      'consent.quantcast.com',
      'consent.iubenda.com'
    ];
    
    if (cmpDomains.some(domain => hostname.includes(domain))) {
      return true;
    }
    
    // Allow common resource types
    const resourceType = pathname.split('.').pop()?.toLowerCase();
    const allowedExtensions = ['css', 'js', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'woff', 'woff2', 'ttf', 'eot', 'webp', 'avif'];
    
    if (resourceType && allowedExtensions.includes(resourceType)) {
      return true;
    }
    
    // Allow same-origin requests
    if (url.origin === this.page?.url()) {
      return true;
    }
    
    // Block everything else
    console.log(`Blocked request to: ${url.href}`);
    return false;
  }

  /**
   * Clean up browser resources
   */
  private async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
    this.page = null;
    this.dataLayerEvents = [];
    this.trackingHits = [];
  }
}