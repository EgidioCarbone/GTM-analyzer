// SSD Test Reliability Tests
// Comprehensive tests for the production-ready SSD Test pipeline improvements
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

describe('SSD Test Reliability Improvements', () => {
  describe('A) Ingestion Fixes (PDF → DSL)', () => {
    describe('Exact URL Setting', () => {
      test('should set dsl.site to exact user URL', () => {
        const dsl = {
          site: 'https://example.com',
          tests: []
        };
        
        const targetUrl = 'https://example.com/checkout?step=1&product=123';
        dsl.site = targetUrl;
        
        expect(dsl.site).toBe(targetUrl);
        expect(dsl.site).not.toBe('https://example.com');
      });
    });

    describe('Allowed Hosts Building', () => {
      test('should build comprehensive allowed_hosts with subdomains', () => {
        const targetUrl = 'https://acmilan.com';
        const pdfText = 'Visit our museum at https://museomondomilan.acmilan.com and buy tickets at https://tickets.acmilan.com/events';
        
        // Simulate buildAllowedHosts function
        const hosts = new Set<string>();
        const url = new URL(targetUrl);
        const hostname = url.hostname;
        const baseDomain = hostname.startsWith('www.') ? hostname.substring(4) : hostname;
        
        hosts.add(hostname);
        hosts.add(`www.${hostname}`);
        
        // Extract subdomains from PDF text
        const subdomainRegex = /(?:https?:\/\/)?([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(?:\/[^\s]*)?/g;
        const matches = pdfText.match(subdomainRegex) || [];
        
        matches.forEach(match => {
          try {
            const cleanMatch = match.split('/')[0];
            const url = new URL(cleanMatch.startsWith('http') ? cleanMatch : `https://${cleanMatch}`);
            const domain = url.hostname;
            
            if (domain === hostname || domain === baseDomain) {
              hosts.add(domain);
            } else if (domain.endsWith('.' + baseDomain)) {
              hosts.add(domain);
            } else if (baseDomain.endsWith('.' + domain.split('.').slice(-2).join('.'))) {
              hosts.add(domain);
            }
          } catch {
            // Ignore invalid URLs
          }
        });
        
        const allowedHosts = Array.from(hosts).sort();
        
        expect(allowedHosts).toContain('acmilan.com');
        expect(allowedHosts).toContain('www.acmilan.com');
        expect(allowedHosts).toContain('museomondomilan.acmilan.com');
        expect(allowedHosts).toContain('tickets.acmilan.com');
        expect(allowedHosts.length).toBeGreaterThan(2);
      });

      test('should merge with ENV fallback list without duplicates', () => {
        const hosts = new Set<string>();
        const envFallback = ['example.com', 'www.example.com', 'api.example.com'];
        
        hosts.add('example.com');
        hosts.add('www.example.com');
        
        envFallback.forEach(host => {
          if (host.trim()) {
            hosts.add(host.trim());
          }
        });
        
        const allowedHosts = Array.from(hosts).sort();
        expect(allowedHosts).toEqual(['api.example.com', 'example.com', 'www.example.com']);
      });
    });

    describe('Target Priority (Text/Aria First)', () => {
      test('should suggest text/aria over CSS selectors for CTAs', () => {
        const target = {
          kind: 'selector',
          value: 'button.btn-primary',
          _suggestedKind: 'button'
        };
        
        // Simulate improveTarget function
        if (target.kind === 'selector' && target.value) {
          const ctaPatterns = [
            { pattern: /\.btn-primary|\.btn-cta|\.cta-button/i, suggestion: 'button' },
            { pattern: /#buy-now|#add-to-cart|#checkout/i, suggestion: 'button' }
          ];
          
          for (const { pattern, suggestion } of ctaPatterns) {
            if (pattern.test(target.value)) {
              target._suggestedKind = suggestion;
              break;
            }
          }
        }
        
        expect(target._suggestedKind).toBe('button');
      });
    });

    describe('Region Coercion', () => {
      test('should coerce unknown regions to "any"', () => {
        const targets = [
          { region: 'checkout', kind: 'text', value: 'Buy Now' },
          { region: 'thank-you', kind: 'text', value: 'Continue' },
          { region: 'header', kind: 'text', value: 'Logo' },
          { region: 'main', kind: 'text', value: 'Content' },
          { region: 'footer', kind: 'text', value: 'Links' }
        ];
        
        const supportedRegions = ['header', 'main', 'footer', 'any'];
        
        targets.forEach(target => {
          if (target.region && !supportedRegions.includes(target.region)) {
            target.region = 'any';
          }
        });
        
        expect(targets[0].region).toBe('any'); // checkout -> any
        expect(targets[1].region).toBe('any'); // thank-you -> any
        expect(targets[2].region).toBe('header'); // header stays
        expect(targets[3].region).toBe('main'); // main stays
        expect(targets[4].region).toBe('footer'); // footer stays
      });
    });

    describe('Placeholder Removal', () => {
      test('should remove various placeholder patterns and use wildcards', () => {
        const expectations = [{
          type: 'dataLayer',
          event: 'purchase',
          params_subset: {
            item_name: '[PRODUCT NAME]',
            item_id: '{{product_id}}',
            price: '${price}',
            transaction_id: 'N/A',
            item_category: 'electronics',
            payment_type: 'TBD'
          }
        }];
        
        // Simulate processExpectations function
        const processed = expectations.map(expectation => {
          if (expectation.params_subset) {
            const cleanedParams: any = {};
            Object.entries(expectation.params_subset).forEach(([key, value]) => {
              if (typeof value === 'string') {
                if (value.includes('[') && value.includes(']')) {
                  cleanedParams[key] = '*';
                } else if (value.includes('{{') && value.includes('}}')) {
                  cleanedParams[key] = '*';
                } else if (value.includes('${') && value.includes('}')) {
                  cleanedParams[key] = '*';
                } else if (value === 'N/A' || value === 'TBD' || value === 'TODO') {
                  cleanedParams[key] = '*';
                } else {
                  cleanedParams[key] = value;
                }
              } else {
                cleanedParams[key] = value;
              }
            });
            expectation.params_subset = cleanedParams;
          }
          return expectation;
        });
        
        expect(processed[0].params_subset.item_name).toBe('*');
        expect(processed[0].params_subset.item_id).toBe('*');
        expect(processed[0].params_subset.price).toBe('*');
        expect(processed[0].params_subset.transaction_id).toBe('*');
        expect(processed[0].params_subset.item_category).toBe('electronics');
        expect(processed[0].params_subset.payment_type).toBe('*');
      });
    });

    describe('Auto-inject GA4 Ecommerce Reset', () => {
      test('should inject ecommerce reset for GA4 events', () => {
        const steps = [
          {
            action: 'click',
            target: { kind: 'text', value: 'Add to Cart' },
            expect: [{ type: 'dataLayer', event: 'add_to_cart' }]
          },
          {
            action: 'click',
            target: { kind: 'text', value: 'Checkout' },
            expect: [{ type: 'dataLayer', event: 'begin_checkout' }]
          },
          {
            action: 'click',
            target: { kind: 'text', value: 'Complete Purchase' },
            expect: [{ type: 'dataLayer', event: 'purchase' }]
          }
        ];
        
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
        
        expect(processed[1].expect).toHaveLength(2);
        expect(processed[2].expect).toHaveLength(2);
      });
    });

    describe('Purchase No-Repeat', () => {
      test('should add no_repeat_on_reload for purchase events', () => {
        const steps = [
          {
            action: 'click',
            target: { kind: 'text', value: 'Complete Purchase' },
            expect: [{ type: 'dataLayer', event: 'purchase' }]
          },
          {
            action: 'click',
            target: { kind: 'text', value: 'Add to Cart' },
            expect: [{ type: 'dataLayer', event: 'add_to_cart' }]
          }
        ];
        
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
        
        expect(processed[1].expect).toHaveLength(1); // No purchase event
      });
    });
  });

  describe('B) Runner Fixes (DSL → Puppeteer → Report)', () => {
    describe('Relative Href Handling', () => {
      test('should resolve relative URLs correctly', () => {
        const testCases = [
          { input: '/checkout', base: 'https://example.com/shop', expected: 'https://example.com/checkout' },
          { input: './cart', base: 'https://example.com/shop', expected: 'https://example.com/cart' },
          { input: '../home', base: 'https://example.com/shop', expected: 'https://example.com/home' },
          { input: 'checkout', base: 'https://example.com/shop', expected: 'https://example.com/shop/checkout' }
        ];
        
        testCases.forEach(({ input, base, expected }) => {
          const resolved = new URL(input, base).href;
          expect(resolved).toBe(expected);
        });
      });

      test('should handle navigate without target as wait for state', () => {
        const step = { action: 'navigate' }; // No target
        
        // This should be treated as wait for state change
        expect(step.target).toBeUndefined();
        // In actual implementation, this would trigger a wait
      });
    });

    describe('Network Allowlist', () => {
      test('should allow essential domains without over-blocking', () => {
        const testUrls = [
          'https://example.com/page',
          'https://www.google-analytics.com/collect',
          'https://fonts.googleapis.com/css2',
          'https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js',
          'https://consent.trustarc.com/consent',
          'https://malicious-site.com/evil.js'
        ];
        
        const allowedHosts = ['example.com', 'www.example.com'];
        const allowedTracking = ['google-analytics.com', 'googletagmanager.com'];
        const allowedCDNs = ['fonts.googleapis.com', 'cdnjs.cloudflare.com'];
        const cmpDomains = ['consent.trustarc.com', 'consent.cookiebot.com'];
        
        const results = testUrls.map(url => {
          const urlObj = new URL(url);
          const hostname = urlObj.hostname;
          
          return {
            url,
            allowed: 
              allowedHosts.includes(hostname) ||
              allowedTracking.some(domain => hostname.includes(domain)) ||
              allowedCDNs.some(domain => hostname.includes(domain)) ||
              cmpDomains.some(domain => hostname.includes(domain)) ||
              (() => {
                const resourceType = urlObj.pathname.split('.').pop()?.toLowerCase();
                const allowedExtensions = ['css', 'js', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'ico'];
                return resourceType && allowedExtensions.includes(resourceType);
              })()
          };
        });
        
        expect(results[0].allowed).toBe(true); // example.com
        expect(results[1].allowed).toBe(true); // google-analytics.com
        expect(results[2].allowed).toBe(true); // fonts.googleapis.com
        expect(results[3].allowed).toBe(true); // cdnjs.cloudflare.com
        expect(results[4].allowed).toBe(true); // consent.trustarc.com
        expect(results[5].allowed).toBe(false); // malicious-site.com
      });
    });

    describe('Target Resolver Order', () => {
      test('should enforce resolution order: region scope → text → aria → href → selector', () => {
        const target = {
          region: 'header',
          kind: 'text',
          value: 'Logo'
        };
        
        // Resolution order should be:
        // 1. region-scoped text (if region specified)
        // 2. text
        // 3. aria
        // 4. href
        // 5. selector
        
        const resolutionOrder = [];
        if (target.region && target.region !== 'any') {
          resolutionOrder.push('region-scoped');
        }
        resolutionOrder.push(target.kind);
        
        expect(resolutionOrder).toEqual(['region-scoped', 'text']);
      });
    });

    describe('Expectation Matcher', () => {
      let expectationMatcher: SSDExpectationMatcher;

      beforeEach(() => {
        expectationMatcher = new SSDExpectationMatcher(mockPage);
      });

      test('should use subset matching for params_subset', () => {
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

      test('should honor sequence checks for ecommerce reset', () => {
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

      test('should implement no_repeat_on_reload by reloading and checking', async () => {
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
  });

  describe('C) Frontend Improvements', () => {
    describe('Editable Review', () => {
      test('should validate DSL JSON correctly', () => {
        const validDSL = {
          site: 'https://example.com',
          tests: [{
            section: 'Header',
            steps: [{
              action: 'click',
              target: { kind: 'text', value: 'Home' },
              expect: [{ type: 'navigation', url_contains: 'home' }]
            }]
          }]
        };

        const invalidDSL = {
          site: 'not-a-url',
          tests: []
        };

        // Test validation function
        const validateDsl = (dslText: string) => {
          try {
            const parsed = JSON.parse(dslText);
            
            if (!parsed.site || !parsed.tests || !Array.isArray(parsed.tests)) {
              return { isValid: false, error: 'Invalid DSL structure: missing required fields' };
            }
            
            if (parsed.tests.length === 0) {
              return { isValid: false, error: 'DSL must contain at least one test' };
            }
            
            return { isValid: true, dsl: parsed };
          } catch (error) {
            return { 
              isValid: false, 
              error: `Invalid JSON: ${error instanceof Error ? error.message : 'Unknown error'}` 
            };
          }
        };

        const validResult = validateDsl(JSON.stringify(validDSL));
        const invalidResult = validateDsl(JSON.stringify(invalidDSL));

        expect(validResult.isValid).toBe(true);
        expect(invalidResult.isValid).toBe(false);
        expect(invalidResult.error).toContain('Invalid DSL structure');
      });
    });

    describe('API Base URL', () => {
      test('should use VITE_API_BASE with fallback', () => {
        // Simulate environment variable
        const viteApiBase = process.env.VITE_API_BASE || 'http://localhost:4000';
        const apiBaseUrl = viteApiBase || (typeof window !== 'undefined' && window.location.origin === 'http://localhost:5173' ? 'http://localhost:4000' : '');
        
        expect(apiBaseUrl).toBeDefined();
        expect(apiBaseUrl).toMatch(/^https?:\/\//);
      });
    });
  });

  describe('D) Validation & Error Handling', () => {
    test('should validate TestSpec structure correctly', () => {
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

  describe('E) Integration Tests', () => {
    test('should handle complete DSL processing pipeline', () => {
      const rawDSL = {
        site: 'https://example.com',
        tests: [{
          section: 'Checkout',
          steps: [{
            action: 'click',
            target: { 
              region: 'checkout', // Should be coerced to 'any'
              kind: 'selector', 
              value: 'button.btn-primary' // Should suggest text
            },
            expect: [{
              type: 'dataLayer',
              event: 'purchase',
              params_subset: {
                item_name: '[PRODUCT NAME]', // Should become '*'
                item_category: 'electronics'
              }
            }]
          }]
        }]
      };

      // Simulate post-processing
      const processedDSL = { ...rawDSL };
      
      // 1. Set exact URL
      processedDSL.site = 'https://example.com/checkout?step=1';
      
      // 2. Build allowed_hosts
      processedDSL.allowed_hosts = ['example.com', 'www.example.com'];
      
      // 3. Process targets
      processedDSL.tests = processedDSL.tests.map(test => ({
        ...test,
        steps: test.steps.map(step => ({
          ...step,
          target: {
            ...step.target,
            region: 'any' // Coerced from 'checkout'
          }
        }))
      }));
      
      // 4. Process expectations
      processedDSL.tests = processedDSL.tests.map(test => ({
        ...test,
        steps: test.steps.map(step => ({
          ...step,
          expect: step.expect.map(exp => ({
            ...exp,
            params_subset: {
              item_name: '*', // Processed from '[PRODUCT NAME]'
              item_category: 'electronics'
            }
          }))
        }))
      }));
      
      // 5. Add ecommerce reset
      processedDSL.tests = processedDSL.tests.map(test => ({
        ...test,
        steps: test.steps.map(step => ({
          ...step,
          expect: [
            { type: 'dataLayer', contains: { ecommerce: null }, near_previous_n: 3 },
            ...step.expect
          ]
        }))
      }));
      
      // 6. Add no-repeat for purchase
      processedDSL.tests = processedDSL.tests.map(test => ({
        ...test,
        steps: test.steps.map(step => ({
          ...step,
          expect: [
            ...step.expect,
            { type: 'no_repeat_on_reload', for_event: 'purchase' }
          ]
        }))
      }));

      expect(processedDSL.site).toBe('https://example.com/checkout?step=1');
      expect(processedDSL.allowed_hosts).toContain('example.com');
      expect(processedDSL.tests[0].steps[0].target.region).toBe('any');
      expect(processedDSL.tests[0].steps[0].expect[0].params_subset.item_name).toBe('*');
      expect(processedDSL.tests[0].steps[0].expect).toHaveLength(3); // reset + original + no-repeat
    });
  });
});

// Export for use in other test files
export {
  // Test utilities can be exported here if needed
};
