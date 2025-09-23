// SSD Expectation Matcher
// Expectation matching engine for dataLayer, GA4, network, navigation, and no-repeat validation
// ============================================================================

import { Page } from 'puppeteer';
import { Expectation, DataLayerEvent, TrackingHit } from '../types/ssd';

export interface ExpectationMatchResult {
  passed: boolean;
  reason: string;
  evidence?: any;
  timestamp?: number;
}

export interface ExpectationContext {
  dataLayerEvents: DataLayerEvent[];
  trackingHits: TrackingHit[];
  currentUrl: string;
  previousUrl?: string;
  stepStartTime: number;
  stepEndTime: number;
}

export class ExpectationMatchError extends Error {
  constructor(message: string, public expectation: Expectation) {
    super(message);
    this.name = 'ExpectationMatchError';
  }
}

export class SSDExpectationMatcher {
  private page: Page;
  private fuzzy: boolean;

  constructor(page: Page, options: { fuzzy?: boolean } = {}) {
    this.page = page;
    this.fuzzy = options.fuzzy || false;
  }

  /**
   * Match an expectation against the current context
   */
  async matchExpectation(
    expectation: Expectation,
    context: ExpectationContext
  ): Promise<ExpectationMatchResult> {
    try {
      switch (expectation.type) {
        case 'dataLayer':
          return this.matchDataLayerExpectation(expectation, context);
        case 'ga4':
          return this.matchGA4Expectation(expectation, context);
        case 'gtm':
          return this.matchGTMExpectation(expectation, context);
        case 'network':
          return this.matchNetworkExpectation(expectation, context);
        case 'navigation':
          return this.matchNavigationExpectation(expectation, context);
        case 'no_repeat_on_reload':
          return await this.matchNoRepeatExpectation(expectation, context);
        default:
          return {
            passed: false,
            reason: `Unknown expectation type: ${expectation.type}`,
          };
      }
    } catch (error) {
      return {
        passed: false,
        reason: `Expectation matching failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Match dataLayer expectation
   */
  private matchDataLayerExpectation(
    expectation: Expectation,
    context: ExpectationContext
  ): ExpectationMatchResult {
    const relevantEvents = context.dataLayerEvents.filter(event => 
      event.timestamp >= context.stepStartTime && 
      event.timestamp <= context.stepEndTime
    );

    // Check for specific event
    if (expectation.event) {
      const matchingEvents = relevantEvents.filter(event => 
        event.payload?.event === expectation.event
      );

      if (matchingEvents.length === 0) {
        return {
          passed: false,
          reason: `Expected dataLayer event '${expectation.event}' not found`,
        };
      }

      // Check params_subset if specified
      if (expectation.params_subset) {
        const validEvents = matchingEvents.filter(event => 
          this.isSubsetMatch(expectation.params_subset!, event.payload)
        );

        if (validEvents.length === 0) {
          return {
            passed: false,
            reason: `Expected dataLayer event '${expectation.event}' found but params don't match expected subset`,
          };
        }
      }

      return {
        passed: true,
        reason: `Found matching dataLayer event '${expectation.event}'`,
        evidence: matchingEvents[0],
        timestamp: matchingEvents[0].timestamp,
      };
    }

    // Check for params_subset without specific event
    if (expectation.params_subset) {
      const matchingEvents = relevantEvents.filter(event => 
        this.isSubsetMatch(expectation.params_subset!, event.payload)
      );

      if (matchingEvents.length === 0) {
        return {
          passed: false,
          reason: `Expected dataLayer params subset not found`,
        };
      }

      return {
        passed: true,
        reason: `Found matching dataLayer params subset`,
        evidence: matchingEvents[0],
        timestamp: matchingEvents[0].timestamp,
      };
    }

    // Check for sequence/reset checks
    if (expectation.near_previous_n && expectation.contains) {
      return this.matchSequenceExpectation(expectation, context);
    }

    return {
      passed: false,
      reason: 'Invalid dataLayer expectation - must specify event, params_subset, or sequence check',
    };
  }

  /**
   * Match GA4 expectation
   */
  private matchGA4Expectation(
    expectation: Expectation,
    context: ExpectationContext
  ): ExpectationMatchResult {
    const relevantHits = context.trackingHits.filter(hit => 
      hit.timestamp >= context.stepStartTime && 
      hit.timestamp <= context.stepEndTime &&
      hit.domain.includes('google-analytics.com')
    );

    if (relevantHits.length === 0) {
      return {
        passed: false,
        reason: 'No GA4 tracking hits found',
      };
    }

    // Check URL contains pattern
    if (expectation.url_contains) {
      const matchingHits = relevantHits.filter(hit => 
        hit.url.includes(expectation.url_contains!)
      );

      if (matchingHits.length === 0) {
        return {
          passed: false,
          reason: `No GA4 hits found with URL containing '${expectation.url_contains}'`,
        };
      }

      return {
        passed: true,
        reason: `Found GA4 hit with URL containing '${expectation.url_contains}'`,
        evidence: matchingHits[0],
        timestamp: matchingHits[0].timestamp,
      };
    }

    // Default: any GA4 hit is success
    return {
      passed: true,
      reason: 'Found GA4 tracking hits',
      evidence: relevantHits[0],
      timestamp: relevantHits[0].timestamp,
    };
  }

  /**
   * Match GTM expectation
   */
  private matchGTMExpectation(
    expectation: Expectation,
    context: ExpectationContext
  ): ExpectationMatchResult {
    const relevantHits = context.trackingHits.filter(hit => 
      hit.timestamp >= context.stepStartTime && 
      hit.timestamp <= context.stepEndTime &&
      hit.domain.includes('googletagmanager.com')
    );

    if (relevantHits.length === 0) {
      return {
        passed: false,
        reason: 'No GTM tracking hits found',
      };
    }

    // Check URL contains pattern
    if (expectation.url_contains) {
      const matchingHits = relevantHits.filter(hit => 
        hit.url.includes(expectation.url_contains!)
      );

      if (matchingHits.length === 0) {
        return {
          passed: false,
          reason: `No GTM hits found with URL containing '${expectation.url_contains}'`,
        };
      }

      return {
        passed: true,
        reason: `Found GTM hit with URL containing '${expectation.url_contains}'`,
        evidence: matchingHits[0],
        timestamp: matchingHits[0].timestamp,
      };
    }

    // Default: any GTM hit is success
    return {
      passed: true,
      reason: 'Found GTM tracking hits',
      evidence: relevantHits[0],
      timestamp: relevantHits[0].timestamp,
    };
  }

  /**
   * Match network expectation
   */
  private matchNetworkExpectation(
    expectation: Expectation,
    context: ExpectationContext
  ): ExpectationMatchResult {
    const relevantHits = context.trackingHits.filter(hit => 
      hit.timestamp >= context.stepStartTime && 
      hit.timestamp <= context.stepEndTime
    );

    if (relevantHits.length === 0) {
      return {
        passed: false,
        reason: 'No network requests found',
      };
    }

    // Check URL contains pattern
    if (expectation.url_contains) {
      const matchingHits = relevantHits.filter(hit => 
        hit.url.includes(expectation.url_contains!)
      );

      if (matchingHits.length === 0) {
        return {
          passed: false,
          reason: `No network requests found with URL containing '${expectation.url_contains}'`,
        };
      }

      return {
        passed: true,
        reason: `Found network request with URL containing '${expectation.url_contains}'`,
        evidence: matchingHits[0],
        timestamp: matchingHits[0].timestamp,
      };
    }

    // Default: any network hit is success
    return {
      passed: true,
      reason: 'Found network requests',
      evidence: relevantHits[0],
      timestamp: relevantHits[0].timestamp,
    };
  }

  /**
   * Match navigation expectation
   */
  private matchNavigationExpectation(
    expectation: Expectation,
    context: ExpectationContext
  ): ExpectationMatchResult {
    const currentUrl = context.currentUrl;

    // Check URL contains pattern
    if (expectation.url_contains) {
      if (currentUrl.includes(expectation.url_contains)) {
        return {
          passed: true,
          reason: `Current URL contains '${expectation.url_contains}'`,
          evidence: { url: currentUrl },
        };
      } else {
        return {
          passed: false,
          reason: `Current URL does not contain '${expectation.url_contains}'`,
        };
      }
    }

    // Check URL matches regex
    if (expectation.url_matches) {
      try {
        const regex = new RegExp(expectation.url_matches);
        if (regex.test(currentUrl)) {
          return {
            passed: true,
            reason: `Current URL matches pattern '${expectation.url_matches}'`,
            evidence: { url: currentUrl },
          };
        } else {
          return {
            passed: false,
            reason: `Current URL does not match pattern '${expectation.url_matches}'`,
          };
        }
      } catch (error) {
        return {
          passed: false,
          reason: `Invalid regex pattern '${expectation.url_matches}': ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    }

    // Check if URL changed from previous step
    if (context.previousUrl && context.previousUrl !== currentUrl) {
      return {
        passed: true,
        reason: 'URL changed from previous step',
        evidence: { 
          previousUrl: context.previousUrl, 
          currentUrl: currentUrl 
        },
      };
    }

    return {
      passed: false,
      reason: 'Invalid navigation expectation - must specify url_contains, url_matches, or check for URL change',
    };
  }

  /**
   * Match no-repeat expectation (requires page reload)
   */
  private async matchNoRepeatExpectation(
    expectation: Expectation,
    context: ExpectationContext
  ): Promise<ExpectationMatchResult> {
    if (!expectation.for_event) {
      return {
        passed: false,
        reason: 'no_repeat_on_reload expectation requires for_event parameter',
      };
    }

    // First, verify the event was found initially
    const relevantEvents = context.dataLayerEvents.filter(event => 
      event.timestamp >= context.stepStartTime && 
      event.timestamp <= context.stepEndTime &&
      event.payload?.event === expectation.for_event
    );

    if (relevantEvents.length === 0) {
      return {
        passed: false,
        reason: `Event '${expectation.for_event}' not found for no-repeat test`,
      };
    }

    // Perform page reload and check if event repeats
    try {
      const currentUrl = this.page.url();
      await this.page.reload({ waitUntil: 'networkidle2' });
      
      // Wait a bit for any potential events to fire
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check if the event fired again after reload
      const postReloadEvents = await this.page.evaluate(() => {
        return window.dataLayer ? window.dataLayer.filter((event: any) => 
          event.event === expectation.for_event
        ) : [];
      });

      if (postReloadEvents.length > 0) {
        return {
          passed: false,
          reason: `Event '${expectation.for_event}' repeated after page reload`,
          evidence: postReloadEvents[0],
        };
      }

      return {
        passed: true,
        reason: `Event '${expectation.for_event}' did not repeat after page reload`,
        evidence: relevantEvents[0],
        timestamp: relevantEvents[0].timestamp,
      };

    } catch (error) {
      return {
        passed: false,
        reason: `Failed to test no-repeat: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Match sequence expectation (e.g., ecommerce reset before purchase)
   */
  private matchSequenceExpectation(
    expectation: Expectation,
    context: ExpectationContext
  ): ExpectationMatchResult {
    if (!expectation.near_previous_n || !expectation.contains) {
      return {
        passed: false,
        reason: 'Sequence expectation requires both near_previous_n and contains parameters',
      };
    }

    // Get recent events within the specified time window
    const timeWindow = expectation.near_previous_n * 1000; // Convert to milliseconds
    const recentEvents = context.dataLayerEvents
      .filter(event => event.timestamp >= context.stepStartTime - timeWindow)
      .sort((a, b) => b.timestamp - a.timestamp);

    // Look for the expected sequence pattern
    const matchingEvents = recentEvents.filter(event => 
      this.isSubsetMatch(expectation.contains!, event.payload)
    );

    if (matchingEvents.length === 0) {
      return {
        passed: false,
        reason: `Expected sequence pattern not found in last ${expectation.near_previous_n} dataLayer pushes`,
      };
    }

    return {
      passed: true,
      reason: `Found expected sequence pattern in recent events`,
      evidence: matchingEvents[0],
      timestamp: matchingEvents[0].timestamp,
    };
  }

  /**
   * Check if expected object is a subset of actual object
   */
  private isSubsetMatch(expected: any, actual: any): boolean {
    if (this.fuzzy) {
      return this.isFuzzySubsetMatch(expected, actual);
    }

    // Original strict matching
    if (typeof expected !== 'object' || expected === null) {
      return expected === actual;
    }

    if (typeof actual !== 'object' || actual === null) {
      return false;
    }

    for (const key in expected) {
      if (!(key in actual)) {
        return false;
      }

      if (!this.isSubsetMatch(expected[key], actual[key])) {
        return false;
      }
    }

    return true;
  }

  /**
   * Fuzzy subset matching with case-insensitive strings, key order independence, and numeric tolerance
   */
  private isFuzzySubsetMatch(expected: any, actual: any): boolean {
    // Handle primitive types
    if (typeof expected !== 'object' || expected === null) {
      return this.isFuzzyValueMatch(expected, actual);
    }

    if (typeof actual !== 'object' || actual === null) {
      return false;
    }

    // For objects, check all expected keys exist in actual
    for (const key in expected) {
      if (!(key in actual)) {
        return false;
      }

      if (!this.isFuzzySubsetMatch(expected[key], actual[key])) {
        return false;
      }
    }

    return true;
  }

  /**
   * Fuzzy value matching with case-insensitive strings and numeric tolerance
   */
  private isFuzzyValueMatch(expected: any, actual: any): boolean {
    // Exact match for non-string, non-number types
    if (typeof expected !== 'string' && typeof expected !== 'number') {
      return expected === actual;
    }

    if (typeof actual !== typeof expected) {
      return false;
    }

    // Case-insensitive string comparison
    if (typeof expected === 'string') {
      return expected.toLowerCase() === actual.toLowerCase();
    }

    // Numeric comparison with tolerance
    if (typeof expected === 'number' && typeof actual === 'number') {
      return this.isNumericMatch(expected, actual);
    }

    return expected === actual;
  }

  /**
   * Numeric comparison with ±1% tolerance or epsilon for small values
   */
  private isNumericMatch(expected: number, actual: number): boolean {
    // Handle special cases
    if (expected === actual) return true;
    if (!isFinite(expected) || !isFinite(actual)) return false;
    if (expected === 0 && actual === 0) return true;

    // Use epsilon for very small values
    const epsilon = 1e-2;
    if (Math.abs(expected) <= epsilon || Math.abs(actual) <= epsilon) {
      return Math.abs(expected - actual) < epsilon;
    }

    // Use ±1% tolerance for larger values
    const tolerance = Math.abs(expected) * 0.01;
    return Math.abs(expected - actual) <= tolerance;
  }

  /**
   * Parse GA4 query parameters from URL
   */
  private parseGA4Params(url: string): Record<string, string> {
    try {
      const urlObj = new URL(url);
      const params: Record<string, string> = {};
      
      for (const [key, value] of urlObj.searchParams.entries()) {
        params[key] = value;
      }
      
      return params;
    } catch (error) {
      return {};
    }
  }

  /**
   * Extract event parameters from GA4 hit
   */
  private extractGA4EventParams(hit: TrackingHit): Record<string, string> {
    return this.parseGA4Params(hit.url);
  }

  /**
   * Validate GA4 event parameters
   */
  private validateGA4EventParams(
    hit: TrackingHit,
    expectedParams: Record<string, string>
  ): boolean {
    const actualParams = this.extractGA4EventParams(hit);
    
    for (const [key, value] of Object.entries(expectedParams)) {
      if (actualParams[key] !== value) {
        return false;
      }
    }
    
    return true;
  }
}
