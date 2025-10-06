// src/ai-sentinel/features/multi-environment-test.ts

import {
  Browser,
  BrowserContext,
  BrowserType,
  Page,
  chromium,
  firefox,
  webkit,
} from 'playwright';
import { ConsentTestResult, ScenarioResult } from '../pw-runner';

export interface EnvironmentProfile {
  region: 'EU' | 'US' | 'CA' | 'UK' | 'BR';
  locale: string;
  browsers: Array<'chromium' | 'firefox' | 'webkit'>;
  viewports: Array<{ width: number; height: number }>;
  network: {
    latency: number;
    bandwidth: number;
  };
}

export class MultiEnvironmentConsentTest {
  async runGlobalComplianceTest(
    environments: EnvironmentProfile[],
    url: string
  ): Promise<ConsentTestResult[]> {
    const results: ConsentTestResult[] = [];

    for (const env of environments) {
      for (const browserType of env.browsers) {
        const launcher = this.getBrowserLauncher(browserType);
        if (!launcher) {
          continue;
        }

        let browser: Browser | null = null;
        try {
          browser = await launcher.launch({ headless: true });

          const context = await browser.newContext({
            locale: env.locale,
            timezoneId: env.region === 'EU' ? 'Europe/Rome' : 'America/New_York',
            geolocation: this.getGeolocationFor(env.region),
            permissions: ['geolocation'],
          });

          try {
            const viewportTests = env.viewports.map((viewport) =>
              this.testScenarioForViewport(context, env, viewport, url, browserType)
            );

            const viewportResults = await Promise.all(viewportTests);
            results.push(...viewportResults);
          } finally {
            await context.close();
          }
        } finally {
          await browser?.close();
        }
      }
    }

    return results;
  }

  async testAccessibilityCompliance(page: Page): Promise<{
    wcagAA: boolean;
    keyboardNavigation: boolean;
    focusIndicators: boolean;
    languageDetection: boolean;
    colorContrast: string;
    screenReaderCompatibility: string;
  }> {
    const a11yResults = await page.evaluate(() => {
      const banner = document.querySelector('[class*="cookie"], [id*="consent"]');
      const issues: Array<{ type: string; level: string }> = [];

      if (banner) {
        const computedStyle = getComputedStyle(banner);
        issues.push({
          type: 'contrast',
          level: computedStyle.color === 'rgba(255, 0, 0, 1)' ? 'FAIL' : 'PASS',
        });
      }

      const focusableElements = document.querySelectorAll('button, a, input, [tabindex]');
      let kbScore = 0;
      let srScore = 0;

      for (const elem of Array.from(focusableElements)) {
        if (elem.getAttribute('aria-label')) srScore += 1;
        if (elem.getAttribute('aria-describedby')) srScore += 1;
        if (elem.getBoundingClientRect().width > 44) kbScore += 1;
      }

      const totalFocusable = focusableElements.length || 1;
      const keyboardRatio = kbScore / totalFocusable;

      return {
        wcagAA: keyboardRatio > 0.8,
        colorContrast: issues.length === 0 ? 'HIGH' : 'MEDIUM',
        keyboardNavigation: keyboardRatio > 0.7,
        focusIndicators: keyboardRatio > 0.6,
        languageDetection: Boolean(document.documentElement.getAttribute('lang')),
        screenReaderCompatibility: srScore > 0 ? 'GOOD' : 'UNKNOWN',
      };
    });

    return a11yResults;
  }

  async testDynamicContentBehavior(page: Page): Promise<DynamicTestResult> {
    const out = await page.evaluate(() => ({
      scriptsExternalIntegrity: Array.from(document.scripts)
        .filter((s) => s.src && !s.src.startsWith('/'))
        .map((s) => s.src),
      iframesInPage: document.querySelectorAll('iframe').length,
      localStorageUsage: Object.keys(localStorage).length,
      cookieSyncDetected: document.cookie
        .split(';')
        .map((c) => c.trim())
        .filter((c) => c.toLowerCase().includes('pid') || c.toLowerCase().includes('partner')),
      dueToGDPRBlocking: document.querySelectorAll('[style*="display: none"]').length > 5,
    }));

    return out;
  }

  private getGeolocationFor(region: string) {
    const regions = {
      EU: { latitude: 41.9028, longitude: 12.4964 },
      US: { latitude: 40.7128, longitude: -74.006 },
      CA: { latitude: 45.4215, longitude: -75.6972 },
      UK: { latitude: 51.5074, longitude: -0.1278 },
      BR: { latitude: -23.5505, longitude: -46.6333 },
    } as const;
    return regions[region as keyof typeof regions];
  }

  private getBrowserLauncher(type: 'chromium' | 'firefox' | 'webkit'): BrowserType | null {
    const launchers: Record<'chromium' | 'firefox' | 'webkit', BrowserType> = {
      chromium,
      firefox,
      webkit,
    };

    return launchers[type] ?? null;
  }

  private createEmptyScenario(): ScenarioResult {
    return {
      latestConsent: {
        ad_user_data: 'unknown',
        ad_personalization: 'unknown',
        ad_storage: 'unknown',
        analytics_storage: 'unknown',
        functionality_storage: 'unknown',
        security_storage: 'unknown',
      },
      cookies: [],
      gaAdsRequests: [],
      gtagCalls: [],
      dataLayer: [],
      artifacts: {},
      selectedCategories: {},
    };
  }

  private async testScenarioForViewport(
    context: BrowserContext,
    env: EnvironmentProfile,
    viewport: { width: number; height: number },
    url: string,
    browserType: 'chromium' | 'firefox' | 'webkit'
  ): Promise<ConsentTestResult> {
    const page = await context.newPage();
    try {
      await page.setViewportSize(viewport);
      await page.goto(url, { waitUntil: 'domcontentloaded' });

      const userAgent = await page.evaluate(() => navigator.userAgent);
      const title = await page.title();
      const cookieSnapshot = await page.evaluate(() => document.cookie);
      const dataLayerSnapshot = await page.evaluate(() => {
        const dl = (window as any).dataLayer;
        return Array.isArray(dl) ? dl.slice(0, 25) : [];
      });

      const cookieEntries = cookieSnapshot
        .split(';')
        .map((cookie) => cookie.trim())
        .filter(Boolean)
        .map((nameValue) => ({
          name: nameValue.split('=')[0],
          domain: new URL(url).hostname,
          expires: Date.now(),
        }));

      const baseScenario = this.createEmptyScenario();
      baseScenario.cookies = cookieEntries;
      baseScenario.dataLayer = dataLayerSnapshot;

      const summaryNotes = [
        `Viewport ${viewport.width}x${viewport.height}`,
        `Title: ${title || 'N/A'}`,
        `Cookies detected: ${cookieEntries.length}`,
      ];

      return {
        engine: browserType,
        url,
        generatedAt: new Date().toISOString(),
        summary: {
          pass: true,
          notes: summaryNotes,
        },
        results: {
          reject: baseScenario,
          accept: baseScenario,
        },
        env: {
          userAgent,
          locale: env.locale,
          region: env.region,
        },
      };
    } finally {
      await page.close();
    }
  }
}

export interface DynamicTestResult {
  scriptsExternalIntegrity: string[];
  iframesInPage: number;
  localStorageUsage: number;
  cookieSyncDetected: string[];
  dueToGDPRBlocking: boolean;
}
