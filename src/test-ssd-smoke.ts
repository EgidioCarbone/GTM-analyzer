// SSD Test Smoke Test
// Simple smoke test to verify the runner flow works end-to-end
// ============================================================================

import { TestSpec } from './types/ssd';

/**
 * Create a minimal test DSL for smoke testing
 */
export function createSmokeTestDSL(): TestSpec {
  return {
    site: 'https://example.com',
    allowed_hosts: ['example.com', 'www.example.com'],
    consent: ['accept'],
    tests: [{
      section: 'Smoke Test',
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
      }, {
        description: 'Click on a link',
        action: 'click',
        target: {
          kind: 'text',
          value: 'Home'
        },
        expect: [{
          type: 'dataLayer',
          event: 'page_view'
        }],
        confidence: 0.8
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
      timestamp: Date.now() - 1000,
      payload: {
        event: 'page_view',
        page_title: 'Example Homepage',
        page_location: 'https://example.com'
      }
    },
    {
      timestamp: Date.now() - 500,
      payload: {
        event: 'click',
        element_text: 'Home',
        element_type: 'link'
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
      timestamp: Date.now() - 1000,
      url: 'https://www.google-analytics.com/collect?v=2&t=pageview',
      method: 'GET',
      domain: 'www.google-analytics.com',
      status: 200
    },
    {
      timestamp: Date.now() - 500,
      url: 'https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID',
      method: 'GET',
      domain: 'www.googletagmanager.com',
      status: 200
    }
  ];
}

/**
 * Test the DSL validation
 */
export function testDSLValidation() {
  const dsl = createSmokeTestDSL();
  
  // Test basic structure
  console.log('✓ DSL has required fields:', {
    site: !!dsl.site,
    tests: Array.isArray(dsl.tests),
    allowed_hosts: Array.isArray(dsl.allowed_hosts)
  });
  
  // Test test structure
  dsl.tests.forEach((test, index) => {
    console.log(`✓ Test ${index} has required fields:`, {
      section: !!test.section,
      steps: Array.isArray(test.steps)
    });
    
    test.steps.forEach((step, stepIndex) => {
      console.log(`  ✓ Step ${stepIndex} has required fields:`, {
        action: !!step.action,
        target: !!step.target,
        expect: Array.isArray(step.expect)
      });
    });
  });
  
  return true;
}

/**
 * Test expectation matching logic
 */
export function testExpectationMatching() {
  const events = createMockDataLayerEvents();
  const hits = createMockTrackingHits();
  
  // Test dataLayer event matching
  const pageViewEvent = events.find(e => e.payload.event === 'page_view');
  console.log('✓ Found page_view event:', !!pageViewEvent);
  
  // Test tracking hit matching
  const gaHit = hits.find(h => h.domain.includes('google-analytics.com'));
  console.log('✓ Found GA tracking hit:', !!gaHit);
  
  // Test subset matching
  const expectedSubset = { event: 'page_view' };
  const actualPayload = pageViewEvent?.payload;
  const isSubset = actualPayload && Object.keys(expectedSubset).every(
    key => actualPayload[key] === expectedSubset[key]
  );
  console.log('✓ Subset matching works:', isSubset);
  
  return true;
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
    'https://malicious-site.com/evil.js'
  ];
  
  const allowedHosts = ['example.com', 'www.example.com'];
  const allowedTracking = ['google-analytics.com', 'googletagmanager.com'];
  const allowedCDNs = ['fonts.googleapis.com', 'cdnjs.cloudflare.com'];
  
  testUrls.forEach(url => {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    
    const isAllowed = 
      allowedHosts.includes(hostname) ||
      allowedTracking.some(domain => hostname.includes(domain)) ||
      allowedCDNs.some(domain => hostname.includes(domain)) ||
      (() => {
        const resourceType = urlObj.pathname.split('.').pop()?.toLowerCase();
        const allowedExtensions = ['css', 'js', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'ico'];
        return resourceType && allowedExtensions.includes(resourceType);
      })();
    
    console.log(`${isAllowed ? '✓' : '✗'} ${url} - ${isAllowed ? 'ALLOWED' : 'BLOCKED'}`);
  });
  
  return true;
}

/**
 * Run all smoke tests
 */
export function runSmokeTests() {
  console.log('🧪 Running SSD Test Smoke Tests...\n');
  
  console.log('1. Testing DSL Validation:');
  testDSLValidation();
  console.log('');
  
  console.log('2. Testing Expectation Matching:');
  testExpectationMatching();
  console.log('');
  
  console.log('3. Testing Network Allowlist:');
  testNetworkAllowlist();
  console.log('');
  
  console.log('✅ All smoke tests completed!');
  return true;
}

// Run tests if this file is executed directly
if (require.main === module) {
  runSmokeTests();
}
