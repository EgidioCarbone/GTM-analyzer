// SSD Expectation Matcher Tests
// ============================================================================

import { SSDExpectationMatcher, ExpectationContext } from '../ssdExpectationMatcher';
import { DataLayerEvent, TrackingHit } from '../../types/ssd';

// Mock Puppeteer Page
const mockPage = {
  url: () => 'https://example.com/test',
} as any;

describe('SSDExpectationMatcher', () => {
  let matcher: SSDExpectationMatcher;
  let context: ExpectationContext;

  beforeEach(() => {
    matcher = new SSDExpectationMatcher(mockPage);
    context = {
      dataLayerEvents: [],
      trackingHits: [],
      currentUrl: 'https://example.com/test',
      stepStartTime: Date.now() - 5000,
      stepEndTime: Date.now(),
    };
  });

  describe('dataLayer expectations', () => {
    it('should match dataLayer event by name', async () => {
      const expectation = {
        type: 'dataLayer' as const,
        event: 'test_event',
      };

      context.dataLayerEvents = [
        {
          timestamp: Date.now() - 1000,
          payload: { event: 'test_event', value: 123 },
        },
      ];

      const result = await matcher.matchExpectation(expectation, context);
      expect(result.passed).toBe(true);
      expect(result.reason).toContain('Found matching dataLayer event');
    });

    it('should match dataLayer event with params subset', async () => {
      const expectation = {
        type: 'dataLayer' as const,
        event: 'purchase',
        params_subset: { value: 99.99, currency: 'USD' },
      };

      context.dataLayerEvents = [
        {
          timestamp: Date.now() - 1000,
          payload: { 
            event: 'purchase', 
            value: 99.99, 
            currency: 'USD',
            transaction_id: '12345',
            items: [{ name: 'Product' }],
          },
        },
      ];

      const result = await matcher.matchExpectation(expectation, context);
      expect(result.passed).toBe(true);
      expect(result.evidence).toBeDefined();
    });

    it('should fail when event not found', async () => {
      const expectation = {
        type: 'dataLayer' as const,
        event: 'missing_event',
      };

      context.dataLayerEvents = [
        {
          timestamp: Date.now() - 1000,
          payload: { event: 'different_event' },
        },
      ];

      const result = await matcher.matchExpectation(expectation, context);
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('not found');
    });

    it('should fail when params subset does not match', async () => {
      const expectation = {
        type: 'dataLayer' as const,
        event: 'purchase',
        params_subset: { value: 99.99 },
      };

      context.dataLayerEvents = [
        {
          timestamp: Date.now() - 1000,
          payload: { 
            event: 'purchase', 
            value: 49.99, // Different value
          },
        },
      ];

      const result = await matcher.matchExpectation(expectation, context);
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('params don\'t match');
    });
  });

  describe('GA4 expectations', () => {
    it('should match GA4 hits', async () => {
      const expectation = {
        type: 'ga4' as const,
      };

      context.trackingHits = [
        {
          timestamp: Date.now() - 1000,
          url: 'https://www.google-analytics.com/collect?v=2&t=event',
          method: 'GET',
          domain: 'google-analytics.com',
          status: 200,
        },
      ];

      const result = await matcher.matchExpectation(expectation, context);
      expect(result.passed).toBe(true);
      expect(result.reason).toContain('Found GA4 tracking hits');
    });

    it('should match GA4 hits with URL contains', async () => {
      const expectation = {
        type: 'ga4' as const,
        url_contains: 'collect?v=2',
      };

      context.trackingHits = [
        {
          timestamp: Date.now() - 1000,
          url: 'https://www.google-analytics.com/collect?v=2&t=event',
          method: 'GET',
          domain: 'google-analytics.com',
        },
      ];

      const result = await matcher.matchExpectation(expectation, context);
      expect(result.passed).toBe(true);
      expect(result.reason).toContain('collect?v=2');
    });

    it('should fail when no GA4 hits found', async () => {
      const expectation = {
        type: 'ga4' as const,
      };

      context.trackingHits = [
        {
          timestamp: Date.now() - 1000,
          url: 'https://facebook.com/tr',
          method: 'GET',
          domain: 'facebook.com',
        },
      ];

      const result = await matcher.matchExpectation(expectation, context);
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('No GA4 tracking hits found');
    });
  });

  describe('navigation expectations', () => {
    it('should match URL contains', async () => {
      const expectation = {
        type: 'navigation' as const,
        url_contains: 'test',
      };

      const result = await matcher.matchExpectation(expectation, context);
      expect(result.passed).toBe(true);
      expect(result.reason).toContain('contains \'test\'');
    });

    it('should match URL regex', async () => {
      const expectation = {
        type: 'navigation' as const,
        url_matches: '.*example\\.com.*',
      };

      const result = await matcher.matchExpectation(expectation, context);
      expect(result.passed).toBe(true);
      expect(result.reason).toContain('matches pattern');
    });

    it('should fail when URL does not match', async () => {
      const expectation = {
        type: 'navigation' as const,
        url_contains: 'missing',
      };

      const result = await matcher.matchExpectation(expectation, context);
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('does not contain');
    });
  });

  describe('network expectations', () => {
    it('should match network requests', async () => {
      const expectation = {
        type: 'network' as const,
      };

      context.trackingHits = [
        {
          timestamp: Date.now() - 1000,
          url: 'https://facebook.com/tr',
          method: 'GET',
          domain: 'facebook.com',
        },
      ];

      const result = await matcher.matchExpectation(expectation, context);
      expect(result.passed).toBe(true);
      expect(result.reason).toContain('Found network requests');
    });

    it('should match network requests with URL contains', async () => {
      const expectation = {
        type: 'network' as const,
        url_contains: 'facebook.com',
      };

      context.trackingHits = [
        {
          timestamp: Date.now() - 1000,
          url: 'https://facebook.com/tr',
          method: 'GET',
          domain: 'facebook.com',
        },
      ];

      const result = await matcher.matchExpectation(expectation, context);
      expect(result.passed).toBe(true);
      expect(result.reason).toContain('facebook.com');
    });
  });

  describe('sequence expectations', () => {
    it('should match sequence expectations', async () => {
      const expectation = {
        type: 'dataLayer' as const,
        near_previous_n: 5,
        contains: { ecommerce: null },
      };

      context.dataLayerEvents = [
        {
          timestamp: Date.now() - 3000,
          payload: { ecommerce: null },
        },
        {
          timestamp: Date.now() - 2000,
          payload: { event: 'purchase', ecommerce: { purchase: {} } },
        },
      ];

      const result = await matcher.matchExpectation(expectation, context);
      expect(result.passed).toBe(true);
      expect(result.reason).toContain('sequence pattern');
    });
  });

  describe('error handling', () => {
    it('should handle unknown expectation types', async () => {
      const expectation = {
        type: 'unknown' as any,
      };

      const result = await matcher.matchExpectation(expectation, context);
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('Unknown expectation type');
    });

    it('should handle invalid regex patterns', async () => {
      const expectation = {
        type: 'navigation' as const,
        url_matches: '[invalid regex',
      };

      const result = await matcher.matchExpectation(expectation, context);
      expect(result.passed).toBe(false);
      expect(result.reason).toContain('Invalid regex pattern');
    });
  });
});
