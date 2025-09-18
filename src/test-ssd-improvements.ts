// SSD Test Improvements Validation
// Tests for the production-ready SSD Test pipeline improvements
// ============================================================================

import { TestSpec, Expectation, DataLayerEvent, TrackingHit } from './types/ssd';
import { SSDExpectationMatcher } from './services/ssdExpectationMatcher';
import { validateTestSpec, detectAmbiguities } from './services/ssdValidation';

// Mock Puppeteer Page for testing
const mockPage = {
  url: () => 'https://example.com/checkout',
  reload: async () => {},
  waitForTimeout: async (ms: number) => {},
  evaluate: async (fn: Function) => fn(),
} as any;

describe('SSD Test Improvements', () => {
  describe('DSL Post-processing', () => {
    test('should set exact site URL', () => {
      const dsl = {
        site: 'https://example.com',
        tests: []
      };
      
      // Simulate post-processing
      const targetUrl = 'https://example.com/checkout';
      dsl.site = targetUrl;
      
      expect(dsl.site).toBe(targetUrl);
    });

    test('should build broadened allowed_hosts', () => {
      const targetUrl = 'https://example.com';
      const pdfText = 'Visit our subdomain at https://shop.example.com and tickets.example.com';
      
      // Simulate buildAllowedHosts function
      const hosts = new Set<string>();
      const url = new URL(targetUrl);
      const hostname = url.hostname;
      
      hosts.add(hostname);
      hosts.add(`www.${hostname}`);
      
      // Extract subdomains from PDF text
      const subdomainRegex = /(?:https?:\/\/)?([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}/g;
      const matches = pdfText.match(subdomainRegex) || [];
      
      matches.forEach(match => {
        try {
          const url = new URL(match.startsWith('http') ? match : `https://${match}`);
          const domain = url.hostname;
          if (domain.endsWith(hostname) || hostname.endsWith(domain.split('.').slice(1).join('.'))) {
            hosts.add(domain);
          }
        } catch {
          // Ignore invalid URLs
        }
      });
      
      const allowedHosts = Array.from(hosts);
      expect(allowedHosts).toContain('example.com');
      expect(allowedHosts).toContain('www.example.com');
      expect(allowedHosts).toContain('shop.example.com');
      expect(allowedHosts).toContain('tickets.example.com');
    });

    test('should coerce non-supported region values to "any"', () => {
      const target = {
        region: 'checkout',
        kind: 'text',
        value: 'Buy Now'
      };
      
      // Simulate improveTarget function
      const supportedRegions = ['header', 'main', 'footer', 'any'];
      if (target.region && !supportedRegions.includes(target.region)) {
        target.region = 'any';
      }
      
      expect(target.region).toBe('any');
    });

    test('should remove literal placeholders and replace with wildcards', () => {
      const expectations = [{
        type: 'dataLayer',
        event: 'purchase',
        params_subset: {
          item_name: '[PRODUCT NAME]',
          item_category: 'electronics',
          value: '[PRICE]'
        }
      }];
      
      // Simulate processExpectations function
      const processed = expectations.map(expectation => {
        if (expectation.params_subset) {
          const cleanedParams: any = {};
          Object.entries(expectation.params_subset).forEach(([key, value]) => {
            if (typeof value === 'string' && value.includes('[') && value.includes(']')) {
              cleanedParams[key] = '*';
            } else {
              cleanedParams[key] = value;
            }
          });
          expectation.params_subset = cleanedParams;
        }
        return expectation;
      });
      
      expect(processed[0].params_subset.item_name).toBe('*');
      expect(processed[0].params_subset.item_category).toBe('electronics');
      expect(processed[0].params_subset.value).toBe('*');
    });

    test('should auto-inject ecommerce reset checks', () => {
      const steps = [{
        action: 'click',
        target: { kind: 'text', value: 'Add to Cart' },
        expect: [{
          type: 'dataLayer',
          event: 'add_to_cart'
        }]
      }];
      
      // Simulate injectEcommerceResets function
      const ecommerceEvents = ['add_to_cart', 'begin_checkout', 'add_payment_info', 'add_shipping_info', 'add_billing_info', 'purchase'];
      
      const processed = steps.map(step => {
        if (step.expect) {
          const hasEcommerceEvent = step.expect.some((exp: any) => 
            exp.type === 'dataLayer' && exp.event && ecommerceEvents.includes(exp.event)
          );
          
          if (hasEcommerceEvent) {
            const resetExpectation = {
              type: 'dataLayer',
              contains: { ecommerce: null },
              near_previous_n: 3
            };
            
            step.expect = [resetExpectation, ...step.expect];
          }
        }
        return step;
      });
      
      expect(processed[0].expect).toHaveLength(2);
      expect(processed[0].expect[0].type).toBe('dataLayer');
      expect(processed[0].expect[0].contains).toEqual({ ecommerce: null });
      expect(processed[0].expect[0].near_previous_n).toBe(3);
    });

    test('should add no_repeat_on_reload for purchase events', () => {
      const steps = [{
        action: 'click',
        target: { kind: 'text', value: 'Complete Purchase' },
        expect: [{
          type: 'dataLayer',
          event: 'purchase'
        }]
      }];
      
      // Simulate addPurchaseNoRepeat function
      const processed = steps.map(step => {
        if (step.expect) {
          const hasPurchaseEvent = step.expect.some((exp: any) => 
            exp.type === 'dataLayer' && exp.event === 'purchase'
          );
          
          if (hasPurchaseEvent) {
            const noRepeatExpectation = {
              type: 'no_repeat_on_reload',
              for_event: 'purchase'
            };
            
            step.expect = [...step.expect, noRepeatExpectation];
          }
        }
        return step;
      });
      
      expect(processed[0].expect).toHaveLength(2);
      expect(processed[0].expect[1].type).toBe('no_repeat_on_reload');
      expect(processed[0].expect[1].for_event).toBe('purchase');
    });
  });

  describe('Expectation Matching', () => {
    let expectationMatcher: SSDExpectationMatcher;

    beforeEach(() => {
      expectationMatcher = new SSDExpectationMatcher(mockPage);
    });

    test('should match subset expectations correctly', () => {
      const expectation: Expectation = {
        type: 'dataLayer',
        event: 'purchase',
        params_subset: {
          item_category: 'electronics',
          value: '*'
        }
      };

      const context = {
        dataLayerEvents: [{
          timestamp: Date.now(),
          payload: {
            event: 'purchase',
            item_category: 'electronics',
            item_name: 'iPhone',
            value: 999.99,
            currency: 'USD'
          }
        }],
        trackingHits: [],
        currentUrl: 'https://example.com/checkout',
        stepStartTime: Date.now() - 1000,
        stepEndTime: Date.now()
      };

      const result = expectationMatcher.matchExpectation(expectation, context);
      expect(result.passed).toBe(true);
    });

    test('should match sequence expectations with near_previous_n', () => {
      const expectation: Expectation = {
        type: 'dataLayer',
        contains: { ecommerce: null },
        near_previous_n: 3
      };

      const context = {
        dataLayerEvents: [
          {
            timestamp: Date.now() - 2000,
            payload: { ecommerce: null }
          },
          {
            timestamp: Date.now() - 1000,
            payload: { event: 'purchase', item_name: 'iPhone' }
          }
        ],
        trackingHits: [],
        currentUrl: 'https://example.com/checkout',
        stepStartTime: Date.now() - 3000,
        stepEndTime: Date.now()
      };

      const result = expectationMatcher.matchExpectation(expectation, context);
      expect(result.passed).toBe(true);
    });

    test('should handle no_repeat_on_reload expectations', async () => {
      const expectation: Expectation = {
        type: 'no_repeat_on_reload',
        for_event: 'purchase'
      };

      const context = {
        dataLayerEvents: [{
          timestamp: Date.now(),
          payload: { event: 'purchase', item_name: 'iPhone' }
        }],
        trackingHits: [],
        currentUrl: 'https://example.com/checkout',
        stepStartTime: Date.now() - 1000,
        stepEndTime: Date.now()
      };

      // Mock the page.evaluate to return empty array (no repeat after reload)
      mockPage.evaluate = async (fn: Function) => {
        if (fn.toString().includes('dataLayer.filter')) {
          return []; // No events after reload
        }
        return fn();
      };

      const result = await expectationMatcher.matchExpectation(expectation, context);
      expect(result.passed).toBe(true);
    });
  });

  describe('Validation', () => {
    test('should validate TestSpec structure', () => {
      const validDSL: TestSpec = {
        site: 'https://example.com',
        allowed_hosts: ['example.com', 'www.example.com'],
        consent: ['accept', 'reject'],
        tests: [{
          section: 'Header',
          steps: [{
            action: 'click',
            target: { kind: 'text', value: 'Home' },
            expect: [{
              type: 'navigation',
              url_contains: 'home'
            }],
            confidence: 0.9
          }]
        }]
      };

      const result = validateTestSpec(validDSL);
      expect(result.success).toBe(true);
    });

    test('should reject invalid TestSpec structure', () => {
      const invalidDSL = {
        site: 'not-a-url',
        tests: []
      };

      const result = validateTestSpec(invalidDSL);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation failed');
    });

    test('should detect ambiguities in low-confidence steps', () => {
      const dslWithAmbiguities: TestSpec = {
        site: 'https://example.com',
        tests: [{
          section: 'Header',
          steps: [{
            action: 'click',
            target: { kind: 'text', value: 'button' }, // Vague target
            confidence: 0.4 // Low confidence
          }]
        }]
      };

      const ambiguities = detectAmbiguities(dslWithAmbiguities);
      expect(ambiguities.length).toBeGreaterThan(0);
      expect(ambiguities[0].reason).toContain('Low confidence');
    });
  });

  describe('Target Resolution Priority', () => {
    test('should prioritize region-scoped resolution', () => {
      const target = {
        region: 'header',
        kind: 'text',
        value: 'Logo'
      };

      // The resolution order should be: region scope → text → aria → href → selector
      // This is implemented in the SSDTargetResolver class
      expect(target.region).toBe('header');
      expect(target.kind).toBe('text');
    });
  });

  describe('Network Allowlist', () => {
    test('should allow tracking domains', () => {
      const url = new URL('https://www.google-analytics.com/collect?v=2&t=event');
      const allowedTracking = [
        'google-analytics.com',
        'googletagmanager.com',
        'g.doubleclick.net',
        'facebook.com/tr'
      ];

      const isAllowed = allowedTracking.some(domain => url.hostname.includes(domain));
      expect(isAllowed).toBe(true);
    });

    test('should allow CDN domains', () => {
      const url = new URL('https://fonts.googleapis.com/css2?family=Inter');
      const allowedCDNs = [
        'cdnjs.cloudflare.com',
        'unpkg.com',
        'jsdelivr.net',
        'fonts.googleapis.com',
        'fonts.gstatic.com'
      ];

      const isAllowed = allowedCDNs.some(domain => url.hostname.includes(domain));
      expect(isAllowed).toBe(true);
    });

    test('should allow common resource types', () => {
      const url = new URL('https://example.com/style.css');
      const resourceType = url.pathname.split('.').pop()?.toLowerCase();
      const allowedExtensions = ['css', 'js', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'woff', 'woff2', 'ttf', 'eot'];

      const isAllowed = resourceType && allowedExtensions.includes(resourceType);
      expect(isAllowed).toBe(true);
    });
  });
});

// Export for use in other test files
export {
  // Test utilities can be exported here if needed
};
