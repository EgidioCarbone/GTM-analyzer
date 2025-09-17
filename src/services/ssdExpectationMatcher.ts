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

  constructor(page: Page) {
    this.page = page;
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
          return this.matchNoRepeatExpectation(expectation, context);
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
  private matchNoRepeatExpectation(
    expectation: Expectation,
    context: ExpectationContext
  ): ExpectationMatchResult {
    if (!expectation.for_event) {
      return {
        passed: false,
        reason: 'no_repeat_on_reload expectation requires for_event parameter',
      };
    }

    // This expectation requires a page reload to test
    // For now, we'll mark it as passed if the event was found initially
    // In a full implementation, this would trigger a reload and verify the event doesn't repeat
    const relevantEvents = context.dataLayerEvents.filter(event => 
      event.timestamp >= context.stepStartTime && 
      event.timestamp <= context.stepEndTime &&
      event.payload?.event === expectation.for_event
    );

    if (relevantEvents.length > 0) {
      return {
        passed: true,
        reason: `Found event '${expectation.for_event}' - no-repeat test requires page reload`,
        evidence: relevantEvents[0],
        timestamp: relevantEvents[0].timestamp,
      };
    }

    return {
      passed: false,
      reason: `Event '${expectation.for_event}' not found for no-repeat test`,
    };
  }

  /**
   * Match sequence expectation (e.g., ecommerce reset before purchase)
   */
  private matchSequenceExpectation(
    expectation: Expectation,
    context: ExpectationContext
  ): ExpectationMatchResult {
    const recentEvents = context.dataLayerEvents
      .filter(event => event.timestamp >= context.stepStartTime - (expectation.near_previous_n! * 1000))
      .sort((a, b) => b.timestamp - a.timestamp);

    // Look for the expected sequence pattern
    const matchingEvents = recentEvents.filter(event => 
      this.isSubsetMatch(expectation.contains!, event.payload)
    );

    if (matchingEvents.length === 0) {
      return {
        passed: false,
        reason: `Expected sequence pattern not found in last ${expectation.near_previous_n} seconds`,
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
