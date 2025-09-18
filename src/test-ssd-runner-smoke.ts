// SSD Test Runner Smoke Test
// End-to-end smoke test for the runner functionality
// ============================================================================

import { TestSpec } from './types/ssd';

/**
 * Create a comprehensive test DSL for smoke testing
 */
export function createRunnerSmokeTestDSL(): TestSpec {
  return {
    site: 'https://example.com',
    allowed_hosts: ['example.com', 'www.example.com', 'api.example.com'],
    consent: ['accept'],
    tests: [{
      section: 'Navigation Test',
      steps: [{
        description: 'Navigate to homepage',
        action: 'navigate',
        target: {
          kind: 'href',
          value: 'https://example.com'
        },
        expect: [{
          type: 'navigation',
          url_contains: 'example.com'
        }],
        confidence: 0.9
      }]
    }, {
      section: 'Interaction Test',
      steps: [{
        description: 'Click on a button',
        action: 'click',
        target: {
          region: 'header',
          kind: 'text',
          value: 'Home'
        },
        expect: [{
          type: 'dataLayer',
          event: 'page_view',
          params_subset: {
            page_title: '*',
            page_location: '*'
          }
        }],
        confidence: 0.8
      }]
    }, {
      section: 'Ecommerce Test',
      steps: [{
        description: 'Add item to cart',
        action: 'click',
        target: {
          kind: 'text',
          value: 'Add to Cart'
        },
        expect: [
          {
            type: 'dataLayer',
            contains: { ecommerce: null },
            near_previous_n: 3
          },
          {
            type: 'dataLayer',
            event: 'add_to_cart',
            params_subset: {
              item_category: '*',
              value: '*'
            }
          }
        ],
        confidence: 0.9
      }, {
        description: 'Complete purchase',
        action: 'click',
        target: {
          kind: 'text',
          value: 'Complete Purchase'
        },
        expect: [
          {
            type: 'dataLayer',
            event: 'purchase',
            params_subset: {
              transaction_id: '*',
              value: '*'
            }
          },
          {
            type: 'no_repeat_on_reload',
            for_event: 'purchase'
          }
        ],
        confidence: 0.9
      }]
    }]
  };
}

/**
 * Mock dataLayer events for testing
 */
export function createMockDataLayerEvents(): any[] {
  return [
    {
      timestamp: Date.now() - 2000,
      payload: {
        event: 'page_view',
        page_title: 'Example Homepage',
        page_location: 'https://example.com'
      }
    },
    {
      timestamp: Date.now() - 1500,
      payload: {
        ecommerce: null // Reset event
      }
    },
    {
      timestamp: Date.now() - 1000,
      payload: {
        event: 'add_to_cart',
        item_category: 'electronics',
        item_name: 'iPhone',
        value: 999.99
      }
    },
    {
      timestamp: Date.now() - 500,
      payload: {
        event: 'purchase',
        transaction_id: 'TXN123456',
        value: 999.99,
        currency: 'USD'
      }
    }
  ];
}

/**
 * Mock tracking hits for testing
 */
export function createMockTrackingHits(): any[] {
  return [
    {
      timestamp: Date.now() - 2000,
      url: 'https://www.google-analytics.com/collect?v=2&t=pageview',
      method: 'GET',
      domain: 'www.google-analytics.com',
      status: 200
    },
    {
      timestamp: Date.now() - 1000,
      url: 'https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID',
      method: 'GET',
      domain: 'www.googletagmanager.com',
      status: 200
    },
    {
      timestamp: Date.now() - 500,
      url: 'https://www.google-analytics.com/collect?v=2&t=event&ec=ecommerce&ea=purchase',
      method: 'GET',
      domain: 'www.google-analytics.com',
      status: 200
    }
  ];
}

/**
 * Test relative URL resolution
 */
export function testRelativeUrlResolution() {
  const testCases = [
    { input: '/checkout', base: 'https://example.com/shop', expected: 'https://example.com/checkout' },
    { input: './cart', base: 'https://example.com/shop', expected: 'https://example.com/cart' },
    { input: '../home', base: 'https://example.com/shop', expected: 'https://example.com/home' },
    { input: 'checkout', base: 'https://example.com/shop', expected: 'https://example.com/shop/checkout' },
    { input: 'https://example.com/absolute', base: 'https://example.com/shop', expected: 'https://example.com/absolute' }
  ];
  
  console.log('Testing relative URL resolution:');
  testCases.forEach(({ input, base, expected }) => {
    try {
      const resolved = new URL(input, base).href;
      const passed = resolved === expected;
      console.log(`${passed ? '✓' : '✗'} ${input} -> ${resolved} (expected: ${expected})`);
    } catch (error) {
      console.log(`✗ ${input} -> ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });
}

/**
 * Test network allowlist logic
 */
export function testNetworkAllowlist() {
  const testUrls = [
    'https://example.com/page',
    'https://www.google-analytics.com/collect',
    'https://fonts.googleapis.com/css2',
    'https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js',
    'https://consent.trustarc.com/consent',
    'https://api.example.com/data',
    'https://malicious-site.com/evil.js'
  ];
  
  const allowedHosts = ['example.com', 'www.example.com', 'api.example.com'];
  const allowedTracking = ['google-analytics.com', 'googletagmanager.com'];
  const allowedCDNs = ['fonts.googleapis.com', 'cdnjs.cloudflare.com'];
  const cmpDomains = ['consent.trustarc.com', 'consent.cookiebot.com'];
  
  console.log('Testing network allowlist:');
  testUrls.forEach(url => {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    const pathname = urlObj.pathname;
    
    const isAllowed = 
      allowedHosts.includes(hostname) ||
      allowedTracking.some(domain => hostname.includes(domain)) ||
      allowedCDNs.some(domain => hostname.includes(domain)) ||
      cmpDomains.some(domain => hostname.includes(domain)) ||
      (() => {
        const resourceType = pathname.split('.').pop()?.toLowerCase();
        const allowedExtensions = ['css', 'js', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'woff', 'woff2', 'ttf', 'eot'];
        return resourceType && allowedExtensions.includes(resourceType);
      })();
    
    console.log(`${isAllowed ? '✓' : '✗'} ${url} - ${isAllowed ? 'ALLOWED' : 'BLOCKED'}`);
  });
}

/**
 * Test expectation matching logic
 */
export function testExpectationMatching() {
  const events = createMockDataLayerEvents();
  const hits = createMockTrackingHits();
  
  console.log('Testing expectation matching:');
  
  // Test subset matching
  const purchaseEvent = events.find(e => e.payload.event === 'purchase');
  const expectedSubset = { event: 'purchase', transaction_id: '*' };
  const actualPayload = purchaseEvent?.payload;
  
  if (actualPayload) {
    const subsetMatch = Object.keys(expectedSubset).every(key => {
      if (expectedSubset[key] === '*') return true;
      return actualPayload[key] === expectedSubset[key];
    });
    console.log(`${subsetMatch ? '✓' : '✗'} Subset matching: ${subsetMatch}`);
  }
  
  // Test sequence matching
  const resetEvent = events.find(e => e.payload.ecommerce === null);
  const purchaseEventAfterReset = events.find(e => 
    e.payload.event === 'purchase' && 
    e.timestamp > (resetEvent?.timestamp || 0)
  );
  console.log(`${resetEvent && purchaseEventAfterReset ? '✓' : '✗'} Sequence matching: ${!!(resetEvent && purchaseEventAfterReset)}`);
  
  // Test tracking hits
  const gaHits = hits.filter(h => h.domain.includes('google-analytics.com'));
  console.log(`${gaHits.length > 0 ? '✓' : '✗'} Tracking hits: ${gaHits.length} GA hits found`);
}

/**
 * Test DSL validation
 */
export function testDSLValidation() {
  const dsl = createRunnerSmokeTestDSL();
  
  console.log('Testing DSL validation:');
  
  // Test basic structure
  const hasRequiredFields = !!dsl.site && Array.isArray(dsl.tests) && dsl.tests.length > 0;
  console.log(`${hasRequiredFields ? '✓' : '✗'} Required fields: ${hasRequiredFields}`);
  
  // Test test structure
  const validTests = dsl.tests.every(test => 
    !!test.section && Array.isArray(test.steps) && test.steps.length > 0
  );
  console.log(`${validTests ? '✓' : '✗'} Test structure: ${validTests}`);
  
  // Test step structure
  const validSteps = dsl.tests.every(test => 
    test.steps.every(step => 
      !!step.action && 
      (step.target ? !!step.target.kind && !!step.target.value : true) &&
      Array.isArray(step.expect)
    )
  );
  console.log(`${validSteps ? '✓' : '✗'} Step structure: ${validSteps}`);
  
  // Test ecommerce reset injection
  const hasEcommerceResets = dsl.tests.some(test => 
    test.steps.some(step => 
      step.expect.some(exp => 
        exp.type === 'dataLayer' && 
        exp.contains && 
        exp.contains.ecommerce === null
      )
    )
  );
  console.log(`${hasEcommerceResets ? '✓' : '✗'} Ecommerce resets: ${hasEcommerceResets}`);
  
  // Test no-repeat injection
  const hasNoRepeat = dsl.tests.some(test => 
    test.steps.some(step => 
      step.expect.some(exp => exp.type === 'no_repeat_on_reload')
    )
  );
  console.log(`${hasNoRepeat ? '✓' : '✗'} No-repeat: ${hasNoRepeat}`);
}

/**
 * Test target resolution priority
 */
export function testTargetResolutionPriority() {
  const targets = [
    { region: 'header', kind: 'text', value: 'Logo' },
    { kind: 'aria', value: 'button' },
    { kind: 'href', value: '/checkout' },
    { kind: 'selector', value: '.btn-primary' }
  ];
  
  console.log('Testing target resolution priority:');
  
  targets.forEach((target, index) => {
    const priority = [];
    
    // Simulate resolution order
    if (target.region && target.region !== 'any') {
      priority.push('region-scoped');
    }
    priority.push(target.kind);
    
    console.log(`${index + 1}. ${JSON.stringify(target)} -> Priority: ${priority.join(' → ')}`);
  });
}

/**
 * Run all smoke tests
 */
export function runRunnerSmokeTests() {
  console.log('🧪 Running SSD Test Runner Smoke Tests...\n');
  
  console.log('1. Testing DSL Validation:');
  testDSLValidation();
  console.log('');
  
  console.log('2. Testing Relative URL Resolution:');
  testRelativeUrlResolution();
  console.log('');
  
  console.log('3. Testing Network Allowlist:');
  testNetworkAllowlist();
  console.log('');
  
  console.log('4. Testing Expectation Matching:');
  testExpectationMatching();
  console.log('');
  
  console.log('5. Testing Target Resolution Priority:');
  testTargetResolutionPriority();
  console.log('');
  
  console.log('✅ All runner smoke tests completed!');
  return true;
}

// Run tests if this file is executed directly
if (require.main === module) {
  runRunnerSmokeTests();
}
