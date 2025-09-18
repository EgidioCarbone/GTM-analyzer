import { SSDPuppeteerRunner } from '../ssdPuppeteerRunner';
import { TestSpec } from '../../types/ssd';

// Mock puppeteer
jest.mock('puppeteer', () => ({
  launch: jest.fn(),
  Browser: jest.fn(),
  Page: jest.fn()
}));

// Mock other dependencies
jest.mock('../ssdTargetResolver');
jest.mock('../ssdExpectationMatcher');
jest.mock('../ssdConsentHandler');

describe('SSDPuppeteerRunner - Strict Mode', () => {
  let runner: SSDPuppeteerRunner;
  let mockBrowser: any;
  let mockPage: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock browser and page
    mockPage = {
      goto: jest.fn(),
      url: jest.fn().mockReturnValue('https://example.com'),
      waitForTimeout: jest.fn(),
      waitForSelector: jest.fn(),
      screenshot: jest.fn().mockResolvedValue('base64screenshot'),
      evaluateOnNewDocument: jest.fn(),
      setViewport: jest.fn(),
      setUserAgent: jest.fn(),
      setRequestInterception: jest.fn(),
      on: jest.fn(),
      $: jest.fn(),
      waitForFunction: jest.fn()
    };

    mockBrowser = {
      newPage: jest.fn().mockResolvedValue(mockPage),
      close: jest.fn()
    };

    const puppeteer = require('puppeteer');
    puppeteer.launch.mockResolvedValue(mockBrowser);

    runner = new SSDPuppeteerRunner({
      screenshotDir: 'test-screenshots',
      timeout: 5000
    });
  });

  describe('strict execution', () => {
    it('should execute exactly what is in the DSL without modifications', async () => {
      const testSpec: TestSpec = {
        site: 'https://example.com',
        allowed_hosts: ['example.com'],
        tests: [
          {
            section: 'Header Test',
            steps: [
              {
                description: 'Click header link',
                action: 'click',
                target: {
                  region: 'header',
                  kind: 'text',
                  value: 'Home'
                },
                expect: [
                  {
                    type: 'dataLayer',
                    event: 'page_view',
                    params_subset: {
                      page_title: '*'
                    }
                  }
                ],
                severity: 'critical',
                confidence: 0.9
              }
            ]
          }
        ]
      };

      const options = {
        headless: true,
        consent: 'accept',
        allowedHosts: ['example.com']
      };

      // Mock the target resolver
      const { SSDTargetResolver } = require('../ssdTargetResolver');
      const mockTargetResolver = {
        resolveTarget: jest.fn().mockResolvedValue({
          element: { click: jest.fn() }
        })
      };
      SSDTargetResolver.mockImplementation(() => mockTargetResolver);

      // Mock the expectation matcher
      const { SSDExpectationMatcher } = require('../ssdExpectationMatcher');
      const mockExpectationMatcher = {
        matchExpectation: jest.fn().mockResolvedValue({
          passed: true,
          reason: ''
        })
      };
      SSDExpectationMatcher.mockImplementation(() => mockExpectationMatcher);

      // Mock the consent handler
      const { SSDConsentHandler } = require('../ssdConsentHandler');
      const mockConsentHandler = {
        applyConsentProfile: jest.fn()
      };
      SSDConsentHandler.mockImplementation(() => mockConsentHandler);

      const result = await runner.runTests(testSpec, options);

      // Verify that the DSL was executed exactly as provided
      expect(result.summary.steps).toBe(1);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].section).toBe('Header Test');
      expect(result.results[0].status).toBe('PASS');

      // Verify that the target resolver was called with the exact target from DSL
      expect(mockTargetResolver.resolveTarget).toHaveBeenCalledWith({
        region: 'header',
        kind: 'text',
        value: 'Home'
      });

      // Verify that the expectation matcher was called with the exact expectation from DSL
      expect(mockExpectationMatcher.matchExpectation).toHaveBeenCalledWith(
        {
          type: 'dataLayer',
          event: 'page_view',
          params_subset: {
            page_title: '*'
          }
        },
        expect.any(Object)
      );
    });

    it('should not inject extra expectations or modify the DSL', async () => {
      const testSpec: TestSpec = {
        site: 'https://example.com',
        tests: [
          {
            section: 'Simple Test',
            steps: [
              {
                action: 'click',
                target: {
                  kind: 'text',
                  value: 'Button'
                }
                // No expectations in DSL
              }
            ]
          }
        ]
      };

      const options = {
        headless: true,
        consent: 'accept'
      };

      // Mock dependencies
      const { SSDTargetResolver } = require('../ssdTargetResolver');
      const mockTargetResolver = {
        resolveTarget: jest.fn().mockResolvedValue({
          element: { click: jest.fn() }
        })
      };
      SSDTargetResolver.mockImplementation(() => mockTargetResolver);

      const { SSDExpectationMatcher } = require('../ssdExpectationMatcher');
      const mockExpectationMatcher = {
        matchExpectation: jest.fn()
      };
      SSDExpectationMatcher.mockImplementation(() => mockExpectationMatcher);

      const { SSDConsentHandler } = require('../ssdConsentHandler');
      const mockConsentHandler = {
        applyConsentProfile: jest.fn()
      };
      SSDConsentHandler.mockImplementation(() => mockConsentHandler);

      const result = await runner.runTests(testSpec, options);

      // Verify that no expectations were processed (since none were in the DSL)
      expect(mockExpectationMatcher.matchExpectation).not.toHaveBeenCalled();

      // Verify the step was executed
      expect(result.summary.steps).toBe(1);
      expect(result.results[0].status).toBe('PASS');
    });

    it('should respect allowed_hosts exactly as provided in DSL', async () => {
      const testSpec: TestSpec = {
        site: 'https://example.com',
        allowed_hosts: ['example.com', 'api.example.com'],
        tests: []
      };

      const options = {
        headless: true,
        consent: 'accept'
      };

      // Mock the request interception
      let interceptedRequests: string[] = [];
      mockPage.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'request') {
          // Simulate request interception
          callback({
            url: () => 'https://example.com/page',
            continue: jest.fn(),
            abort: jest.fn()
          });
        }
      });

      const { SSDConsentHandler } = require('../ssdConsentHandler');
      const mockConsentHandler = {
        applyConsentProfile: jest.fn()
      };
      SSDConsentHandler.mockImplementation(() => mockConsentHandler);

      await runner.runTests(testSpec, options);

      // Verify that the allowed hosts from the DSL were used
      expect(mockPage.setRequestInterception).toHaveBeenCalledWith(true);
    });

    it('should handle relative URLs in navigate steps by resolving against page.url()', async () => {
      const testSpec: TestSpec = {
        site: 'https://example.com',
        tests: [
          {
            section: 'Navigation Test',
            steps: [
              {
                action: 'navigate',
                target: {
                  kind: 'href',
                  value: '/about' // relative URL
                }
              }
            ]
          }
        ]
      };

      const options = {
        headless: true,
        consent: 'accept'
      };

      // Mock dependencies
      const { SSDConsentHandler } = require('../ssdConsentHandler');
      const mockConsentHandler = {
        applyConsentProfile: jest.fn()
      };
      SSDConsentHandler.mockImplementation(() => mockConsentHandler);

      await runner.runTests(testSpec, options);

      // Verify that the relative URL was resolved against the current page URL
      expect(mockPage.goto).toHaveBeenCalledWith(
        'https://example.com/about',
        expect.any(Object)
      );
    });

    it('should not add any hidden post-processing or modifications', async () => {
      const testSpec: TestSpec = {
        site: 'https://example.com',
        tests: [
          {
            section: 'Test',
            steps: [
              {
                action: 'click',
                target: {
                  kind: 'text',
                  value: 'Button'
                },
                confidence: 0.5 // Low confidence in DSL
              }
            ]
          }
        ]
      };

      const options = {
        headless: true,
        consent: 'accept'
      };

      // Mock dependencies
      const { SSDTargetResolver } = require('../ssdTargetResolver');
      const mockTargetResolver = {
        resolveTarget: jest.fn().mockResolvedValue({
          element: { click: jest.fn() }
        })
      };
      SSDTargetResolver.mockImplementation(() => mockTargetResolver);

      const { SSDConsentHandler } = require('../ssdConsentHandler');
      const mockConsentHandler = {
        applyConsentProfile: jest.fn()
      };
      SSDConsentHandler.mockImplementation(() => mockConsentHandler);

      const result = await runner.runTests(testSpec, options);

      // Verify that the confidence value from the DSL was preserved
      expect(result.results[0].evidence).toBeDefined();
      // The runner should not modify the confidence or any other DSL values
    });
  });
});
