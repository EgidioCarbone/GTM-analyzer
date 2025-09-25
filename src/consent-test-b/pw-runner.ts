// src/consent-test-b/pw-runner.ts

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { defaultConfig, ConsentTestConfig } from './config';
import { z } from 'zod';

// Schema di validazione per l'input
export const ConsentTestInputSchema = z.object({
  url: z.string().url().refine(url => url.startsWith('http://') || url.startsWith('https://'), {
    message: "URL deve iniziare con http:// o https://"
  }),
  options: z.object({
    timeoutSoftMs: z.number().optional().default(10000),
    timeoutHardMs: z.number().optional().default(25000),
    captureScreens: z.boolean().optional().default(true),
    trace: z.boolean().optional().default(false),
    region: z.enum(['EU', 'US']).optional().default('EU'),
  }).optional().default({})
});

export type ConsentTestInput = z.infer<typeof ConsentTestInputSchema>;

export interface ConsentTestResult {
  engine: string;
  url: string;
  generatedAt: string;
  summary: {
    pass: boolean;
    notes: string[];
  };
  results: {
    reject: ScenarioResult;
    accept: ScenarioResult;
  };
  env: {
    userAgent: string;
    locale: string;
    region: string;
  };
}

export interface ScenarioResult {
  latestConsent: {
    ad_user_data: string;
    ad_personalization: string;
    ad_storage: string;
    analytics_storage: string;
  };
  cookies: Array<{
    name: string;
    domain: string;
    expires: number;
  }>;
  gaAdsRequests: Array<{
    url: string;
    ts: number;
  }>;
  gtagCalls: Array<[string, string, any]>;
  dataLayer: Array<any>;
  artifacts: {
    screenshotPath?: string;
    tracePath?: string;
  };
}

export class ConsentTestRunner {
  private config: ConsentTestConfig;
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;

  constructor(config: ConsentTestConfig = defaultConfig) {
    this.config = config;
  }

  async runTest(input: ConsentTestInput): Promise<ConsentTestResult> {
    const validatedInput = ConsentTestInputSchema.parse(input);
    
    try {
      await this.initializeBrowser();
      
      const results = {
        reject: await this.runScenario('reject', validatedInput),
        accept: await this.runScenario('accept', validatedInput)
      };

      const summary = this.evaluateResults(results);
      
      return {
        engine: 'playwright',
        url: validatedInput.url,
        generatedAt: new Date().toISOString(),
        summary,
        results,
        env: {
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          locale: 'it-IT',
          region: validatedInput.options.region
        }
      };
    } finally {
      await this.cleanup();
    }
  }

  private async initializeBrowser(): Promise<void> {
    this.browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    });

    this.context = await this.browser.newContext({
      locale: 'it-IT',
      timezoneId: this.config.region === 'EU' ? 'Europe/Rome' : 'America/New_York',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 }
    });

    // Inietta hook per tracciare gtag e dataLayer
    await this.context.addInitScript(() => {
      // Hook per gtag
      const originalGtag = window.gtag;
      window.gtag = function(...args: any[]) {
        if (!window.consentTestData) window.consentTestData = { gtagCalls: [], dataLayer: [] };
        window.consentTestData.gtagCalls.push([...args]);
        if (originalGtag) originalGtag.apply(this, args);
      };

      // Hook per dataLayer
      const originalDataLayerPush = window.dataLayer?.push;
      if (window.dataLayer && originalDataLayerPush) {
        window.dataLayer.push = function(...args: any[]) {
          if (!window.consentTestData) window.consentTestData = { gtagCalls: [], dataLayer: [] };
          window.consentTestData.dataLayer.push(...args);
          return originalDataLayerPush.apply(this, args);
        };
      }
    });
  }

  private async runScenario(type: 'reject' | 'accept', input: ConsentTestInput): Promise<ScenarioResult> {
    if (!this.context) throw new Error('Browser context not initialized');

    const page = await this.context.newPage();
    const runId = Date.now().toString();
    const artifactsDir = `./artifacts/pw/${runId}/${type}`;

    try {
      // Setup network monitoring
      const gaAdsRequests: Array<{ url: string; ts: number }> = [];
      
      page.on('request', (request) => {
        const url = request.url();
        if (this.isGaAdsRequest(url)) {
          gaAdsRequests.push({
            url,
            ts: Date.now()
          });
        }
      });

      // Naviga alla pagina
      await page.goto(input.url, { 
        waitUntil: 'domcontentloaded',
        timeout: this.config.timeouts.hardMs 
      });

      // Attendi il banner
      const bannerFound = await this.waitForBanner(page);
      if (!bannerFound) {
        console.log('Banner non rilevato, continuo con la raccolta dati');
      }

      // Esegui l'azione (reject/accept)
      if (bannerFound) {
        try {
          await this.performConsentAction(page, type);
          await this.waitForConsentUpdate(page);
        } catch (error) {
          console.log(`Banner trovato ma non riuscito a cliccare ${type}:`, error.message);
          // Continua comunque con la raccolta dati
        }
      } else {
        console.log(`Nessun banner di consenso rilevato per scenario ${type}`);
      }

      // Raccogli i dati
      const latestConsent = await this.getLatestConsent(page);
      const cookies = await this.getSensitiveCookies(page);
      const gtagCalls = await this.getGtagCalls(page);
      const dataLayer = await this.getDataLayer(page);

      // Cattura screenshot se abilitato
      let screenshotPath: string | undefined;
      if (input.options.captureScreens) {
        screenshotPath = `${artifactsDir}/screenshot.png`;
        await page.screenshot({ path: screenshotPath, fullPage: true });
      }

      // Cattura trace se abilitato
      let tracePath: string | undefined;
      if (input.options.trace) {
        tracePath = `${artifactsDir}/trace.zip`;
        await page.context().tracing.stop({ path: tracePath });
      }

      return {
        latestConsent,
        cookies,
        gaAdsRequests,
        gtagCalls,
        dataLayer,
        artifacts: {
          screenshotPath,
          tracePath
        }
      };

    } finally {
      await page.close();
    }
  }

  private async waitForBanner(page: Page): Promise<boolean> {
    const timeout = this.config.timeouts.softMs;
    const startTime = Date.now();

    return new Promise((resolve) => {
      const checkBanner = async () => {
        // Controlla se ci sono banner CMP noti
        const bannerSelectors = [
          '#onetrust-consent-sdk',
          '#CybotCookiebotDialog',
          '.iubenda-cs-banner',
          '.didomi-popup',
          '.uc-banner'
        ];

        for (const selector of bannerSelectors) {
          const element = await page.$(selector);
          if (element) {
            resolve(true);
            return;
          }
        }

        // Fallback: cerca bottoni di consenso
        const consentButtons = await page.$$('button, a, [role="button"]');
        for (const button of consentButtons) {
          const text = await button.textContent();
          if (text && this.isConsentButton(text)) {
            resolve(true);
            return;
          }
        }

        if (Date.now() - startTime > timeout) {
          resolve(false);
          return;
        }

        setTimeout(checkBanner, 100);
      };

      checkBanner();
    });
  }

  private async performConsentAction(page: Page, type: 'reject' | 'accept'): Promise<void> {
    const selectors = type === 'accept' ? 
      this.getAllAcceptSelectors() : 
      this.getAllRejectSelectors();

    for (const selector of selectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          await element.click();
          console.log(`Clicked ${type} button with selector: ${selector}`);
          return;
        }
      } catch (error) {
        console.log(`Failed to click ${type} button with selector: ${selector}`, error);
      }
    }

    // Fallback: cerca per testo
    const buttons = await page.$$('button, a, [role="button"]');
    for (const button of buttons) {
      const text = await button.textContent();
      if (text && this.isConsentButton(text, type)) {
        await button.click();
        console.log(`Clicked ${type} button by text: ${text}`);
        return;
      }
    }

    console.log(`Could not find ${type} button - continuo senza cliccare`);
    // Non lanciare errore, continua senza cliccare
  }

  private async waitForConsentUpdate(page: Page): Promise<void> {
    const graceTime = this.config.timeouts.graceMs;
    
    // Attendi aggiornamenti di consenso
    await page.waitForFunction(() => {
      return window.consentTestData && 
             (window.consentTestData.gtagCalls.length > 0 || 
              window.consentTestData.dataLayer.length > 0);
    }, { timeout: graceTime }).catch(() => {
      // Non è un errore se non ci sono aggiornamenti
    });

    // Attesa finale per stabilizzazione
    await page.waitForTimeout(1000);
  }

  private async getLatestConsent(page: Page): Promise<ScenarioResult['latestConsent']> {
    return await page.evaluate(() => {
      // Cerca l'ultimo aggiornamento di consenso
      const gtagCalls = window.consentTestData?.gtagCalls || [];
      const consentCalls = gtagCalls.filter(call => call[0] === 'consent' && call[1] === 'update');
      
      if (consentCalls.length > 0) {
        const latest = consentCalls[consentCalls.length - 1][2];
        return {
          ad_user_data: latest.ad_user_data || 'n/d',
          ad_personalization: latest.ad_personalization || 'n/d',
          ad_storage: latest.ad_storage || 'n/d',
          analytics_storage: latest.analytics_storage || 'n/d'
        };
      }

      return {
        ad_user_data: 'n/d',
        ad_personalization: 'n/d',
        ad_storage: 'n/d',
        analytics_storage: 'n/d'
      };
    });
  }

  private async getSensitiveCookies(page: Page): Promise<ScenarioResult['cookies']> {
    const cookies = await page.context().cookies();
    return cookies
      .filter(cookie => this.config.cookies.sensitive.includes(cookie.name))
      .map(cookie => ({
        name: cookie.name,
        domain: cookie.domain,
        expires: cookie.expires || 0
      }));
  }

  private async getGtagCalls(page: Page): Promise<ScenarioResult['gtagCalls']> {
    return await page.evaluate(() => {
      return window.consentTestData?.gtagCalls || [];
    });
  }

  private async getDataLayer(page: Page): Promise<ScenarioResult['dataLayer']> {
    return await page.evaluate(() => {
      return window.consentTestData?.dataLayer || [];
    });
  }

  private isGaAdsRequest(url: string): boolean {
    return this.config.endpoints.gaAds.some(pattern => {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return regex.test(url);
    });
  }

  private isConsentButton(text: string, type?: 'accept' | 'reject'): boolean {
    const normalizedText = text.toLowerCase().trim();
    const patterns = type ? 
      this.config.cmp.fallback[type] : 
      [...this.config.cmp.fallback.accept, ...this.config.cmp.fallback.reject];
    
    return patterns.some(pattern => normalizedText.includes(pattern));
  }

  private getAllAcceptSelectors(): string[] {
    const selectors: string[] = [];
    Object.values(this.config.cmp.selectors).forEach(cmp => {
      selectors.push(...cmp.accept);
    });
    return selectors;
  }

  private getAllRejectSelectors(): string[] {
    const selectors: string[] = [];
    Object.values(this.config.cmp.selectors).forEach(cmp => {
      selectors.push(...cmp.reject);
    });
    return selectors;
  }

  private evaluateResults(results: { reject: ScenarioResult; accept: ScenarioResult }): ConsentTestResult['summary'] {
    const notes: string[] = [];
    let pass = true;

    // Valuta scenario REJECT
    const rejectCookies = results.reject.cookies.length;
    const rejectRequests = results.reject.gaAdsRequests.length;
    
    if (rejectCookies > 0) {
      notes.push(`REJECT: Trovati ${rejectCookies} cookie sensibili (dovrebbero essere 0)`);
      pass = false;
    }
    
    if (rejectRequests > 0) {
      notes.push(`REJECT: Trovate ${rejectRequests} richieste GA/Ads (dovrebbero essere 0)`);
      pass = false;
    }

    // Valuta scenario ACCEPT
    const acceptConsent = results.accept.latestConsent;
    const hasGrantedConsent = Object.values(acceptConsent).some(value => value === 'granted');
    const acceptRequests = results.accept.gaAdsRequests.length;

    if (!hasGrantedConsent) {
      notes.push('ACCEPT: Nessun consenso granted rilevato');
    }

    if (acceptRequests === 0) {
      notes.push('ACCEPT: Nessuna richiesta GA/Ads rilevata (potrebbe essere normale se il sito non usa GA/Ads)');
    }

    if (notes.length === 0) {
      notes.push('Test completato con successo');
    }

    return { pass, notes };
  }

  private async cleanup(): Promise<void> {
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

// Funzione di utilità per eseguire il test
export async function runConsentTest(input: ConsentTestInput): Promise<ConsentTestResult> {
  const runner = new ConsentTestRunner();
  return await runner.runTest(input);
}
