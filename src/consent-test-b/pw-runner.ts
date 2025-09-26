// src/consent-test-b/pw-runner.ts

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { defaultConfig, ConsentTestConfig } from './config';
import * as fs from 'fs/promises';
import { z } from 'zod';
import { consentProbe } from './init/consent-probe';
import { waitForConsentOrTimeout } from './utils/wait-consent';

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

  constructor(config: ConsentTestConfig = defaultConfig) {
    this.config = config;
  }

  async runTest(input: ConsentTestInput): Promise<ConsentTestResult> {
    const validatedInput = ConsentTestInputSchema.parse(input);
    
    let rejectResult: ScenarioResult;
    let acceptResult: ScenarioResult;

    try {
      // Scenario REJECT
      console.log('=== INIZIO SCENARIO REJECT ===');
      rejectResult = await this.runScenarioWithIsolatedBrowser('reject', validatedInput);
      
      // Scenario ACCEPT con browser completamente nuovo
      console.log('=== INIZIO SCENARIO ACCEPT ===');
      acceptResult = await this.runScenarioWithIsolatedBrowser('accept', validatedInput);

      const results = {
        reject: rejectResult,
        accept: acceptResult
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
    } catch (error) {
      console.error('Errore durante i test:', error);
      throw error;
    }
  }

  private async runScenarioWithIsolatedBrowser(scenario: 'reject' | 'accept', input: ConsentTestInput): Promise<ScenarioResult> {
    let browser: Browser | null = null;
    let context: BrowserContext | null = null;
    let page: Page | null = null;

    try {
      console.log(`🚀 Creando browser isolato per scenario ${scenario}...`);
      browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox', 
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-first-run',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-features=TranslateUI',
          '--disable-features=VizDisplayCompositor'
        ]
      });

      // Crea un nuovo context completamente isolato per ogni scenario
      context = await browser.newContext({
        storageState: undefined, // Forza modalità incognito
        locale: 'it-IT',
        timezoneId: this.config.region === 'EU' ? 'Europe/Rome' : 'America/New_York',
        userAgent: scenario === 'reject' 
          ? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        geolocation: { latitude: 41.9028, longitude: 12.4964 }, // Roma per test EU
        permissions: ['geolocation'],
        acceptDownloads: false,
        bypassCSP: true,
        ignoreHTTPSErrors: true
      });

      // FIX A: Hook PRIMA della navigazione (serializzazione sicura)
      await context.addInitScript({ content: `(${consentProbe.toString()})();` });

      // FIX C: Context-level request monitoring migliorato
      const gaAdsRequests: Array<{ url: string, ts: number }> = [];
      
      await context.route('**/*', route => {
        const url = route.request().url();
        if (
          url.includes('google-analytics.com/g/collect') ||
          url.includes('region1.google-analytics.com/g/collect') ||
          url.includes('stats.g.doubleclick.net') ||
          url.includes('googleads.g.doubleclick.net') ||
          url.includes('td.doubleclick.net') ||
          url.includes('www.googletagmanager.com/gtag/js')
        ) {
          gaAdsRequests.push({ url, ts: Date.now() });
          console.log(`🔗 GA/Ads request detected: ${url}`);
        }
        route.continue();
      });

      page = await context.newPage();
      
      // Sanity check dell'injection dopo creazione page
      await page.addInitScript(() => {}); // no-op, forza il preload del init script
      
      // URL con parametri per forzare pop-up banner
      const urlWithParam = `${input.url}${input.url.includes('?') ? '&' : '?'}cb=1&test_consent=${scenario}&_t=${Date.now()}`;
      console.log(`🌐 Navigating to: ${urlWithParam}`);
      
      await page.goto(urlWithParam, { 
        waitUntil: 'domcontentloaded', 
        timeout: input.options.timeoutHardMs 
      });

      // API injection check rimosso - la verifica avviene ora nel waitForConsentOrTimeout

      // Attendi il caricamento completo della pagina e eventuali banner
      console.log(`⏱️ Attendo ${this.config.timeouts.softMs}ms per caricamento banner...`);
      await page.waitForTimeout(this.config.timeouts.softMs);

      // Pipeline per gestire il banner e cliccare l'azione corrispondente
      const bannerHandled = await this.handleBannerDetectionAndAction(page, scenario, input);
      
      // FIX B: Attesa stabilizzazione CONSENT (soft)
      const settle = await waitForConsentOrTimeout(page, input.options.timeoutSoftMs);
      console.log(`[${scenario}] consent settle in ${settle.ms}ms`, settle.snapshot?.last || 'n/d');

      // Patch 4: Se probe fallito, usa Cookiebot mappato
      let latestConsent;
      
      if (settle.snapshot?.last) {
        // Il probe funziona - usa snapshot
        latestConsent = settle.snapshot.last;
      } else {
        // Fallback Cookiebot mapping
        const cbSnap = await page.evaluate(() => {
          const w: any = window;
          const cb = w.Cookiebot;
          if (!cb || !cb.consent) return null;
          return {
            marketing: !!cb.consent.marketing,
            statistics: !!cb.consent.statistics
          };
        });
        
        if (cbSnap) {
          console.log(`[${scenario}] Cookiebot raw ->`, cbSnap);
          // Mappa Cookiebot → Consent Mode v2
          latestConsent = {
            ad_user_data: cbSnap.marketing ? 'granted' : 'denied',
            ad_personalization: cbSnap.marketing ? 'granted' : 'denied',
            ad_storage: cbSnap.marketing ? 'granted' : 'denied',
            analytics_storage: cbSnap.statistics ? 'granted' : 'denied'
          };
        } else {
          // Ultimo fallback n/d
          latestConsent = {
            ad_user_data: 'n/d',
            ad_personalization: 'n/d', 
            ad_storage: 'n/d',
            analytics_storage: 'n/d'
          };
        }
      }
      const cookies = await this.getSensitiveCookies(context);
      const gtagCalls = await this.getGtagCallsData(page);
      const dataLayerEvents = await this.getDataLayerEvents(page);

      // Cattura screenshot (opzionale)
      const screenshotPath = await this.captureScreenshot(page, scenario, input);

      return {
        latestConsent,
        cookies,
        gaAdsRequests,
        gtagCalls,
        dataLayer: dataLayerEvents,
        artifacts: { screenshotPath }
      };

    } finally {
      // IMPORTANTE: sempre chiudere browser per liberare risorse
      try { if (page) await page.close(); } catch {};
      try { if (context) await context.close(); } catch {};
      try { if (browser) await browser.close(); } catch {};
    }
  }

  private async handleBannerDetectionAndAction(page: Page, scenario: 'reject' | 'accept', input: ConsentTestInput): Promise<boolean> {
    try {
      console.log(`🔍 Cerco banner per scenario ${scenario}...`);
      
      // Lista selettori banner CMP supportati
      const bannerSelectors = [
        '#onetrust-consent-sdk',
        '#CybotCookiebotDialog', 
        '.iubenda-cs-banner',
        '.didomi-popup',
        '.uc-banner',
        '[id*="cookie"]',
        '[class*="cookie"]'
      ];

      // Attendi cenna fino a 15 secondi per l'apparizione del banner
      for (let attempt = 0; attempt < 15; attempt++) {
        console.log(`🔄 Tentativo rilevamento banner ${attempt + 1}/15...`);
        
        for (const selector of bannerSelectors) {
          try {
            const banner = await page.$(selector);
            if (banner && await banner.isVisible()) {
              console.log(`✅ Banner trovato: ${selector}`);
              
              const actionResult = await this.performConsentAction(page, scenario, selector);
              if (actionResult) {
                console.log(`✅ Azione ${scenario} completata con successo`);
                return true;
              } else {
                console.log(`⚠️ Banner trovato ma azione ${scenario} fallita`);
              }
            }
          } catch (err) {
            console.log(`❌ Errore nel verificare banner ${selector}:`, err.message);
          }
        }
        
        // Fallback: cerca per testo in tutti gli elementi clickable
        const actionResult = await this.performFallbackConsentAction(page, scenario);
        if (actionResult) {
          console.log(`✅ Fallback ${scenario} completato`);
          return true;
        }
        
        await page.waitForTimeout(1000); // Attendi 1 secondo
      }

      console.log(`⚠️ Banner non trovato nel timeout, continuo con raccolta dati`);
      return false;
    } catch (error) {
      console.error('❌ Errore gestione banner:', error);
      return false;
    }
  }

  private async performConsentAction(page: Page, scenario: 'reject' | 'accept', bannerSelector: string): Promise<boolean> {
    try {
      // Esegui tutto nel contesto della pagina
      return await page.evaluate(({ scenario, bannerSelector }) => {
        const keywords = scenario === 'reject' 
          ? ['rifiuta', 'decline', 'reject', 'necessari', 'deny', 'rifiuto', 'nega', 'solo essenziali']
          : ['accetta', 'accept', 'consenti', 'consent', 'tutti', 'conferma', 'allow', 'agree'];

        const scope = document.querySelector(bannerSelector);
        if (!scope) return false;
        
        // Cerca tutti i pulsanti/interazioni nel banner
        const elements = Array.from(scope.querySelectorAll('button, a, [role="button"], input, .btn, [onclick]'));
        
        for (const btn of elements) {
          const text = (btn.textContent || '').toLowerCase().trim();
          const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase().trim();
          const combinedText = `${text} ${ariaLabel}`;
          
          for (const keyword of keywords) {
            if (combinedText.includes(keyword.toLowerCase())) {
              console.log(`🎯 Clicking element: "${text}" (keyword: ${keyword})`);
              (btn as HTMLElement).click();
              return true;
            }
          }
        }
        
        return false;
      }, { scenario, bannerSelector });

    } catch (error) {
      console.log(`❌ Errore click ${scenario}:`, error.message);
      return false;
    }
  }

  private async performFallbackConsentAction(page: Page, scenario: 'reject' | 'accept'): Promise<boolean> {
    try {
      const selectors = scenario === 'accept' ? 
        this.getAllAcceptSelectors() : 
        this.getAllRejectSelectors();

      for (const selector of selectors) {
        try {
          const element = await page.$(selector);
          if (element && await element.isVisible()) {
            console.log(`🎯 Clicking ${scenario} with selector: ${selector}`);
            await element.click();
            return true;
          }
        } catch (error) {
          console.log(`❌ Failed click ${scenario} selector ${selector}:`, error.message);
        }
      }
      
      // Ultimo fallback: match text su tutti i button della pagina
      const result = await page.evaluate((scenario) => {
        const keywords = scenario === 'reject' 
          ? ['rifiuta', 'decline', 'reject', 'necessari', 'deny']
          : ['accetta', 'accept', 'consenti', 'consent', 'conferma'];

        const allButtons = Array.from(document.querySelectorAll('button, a, [role="button"], input, [onclick]'));
        
        for (const btn of allButtons) {
          const text = (btn.textContent || '').toLowerCase().trim();
          if (keywords.some(k => text.includes(k.toLowerCase().trim()))) {
            console.log(`🎯 Clicking fallback ${scenario}: "${text}"`);
            (btn as HTMLElement).click();
            return true;
          }
        }
        return false;
      }, scenario);

      return result;
    } catch (error) {
      console.log(`❌ Fallback ${scenario} failed:`, error.message);
      return false;
    }
  }

  private async getLatestConsentState(page: Page): Promise<ScenarioResult['latestConsent']> {
    return await page.evaluate(() => {
      const w = window as any;
      
      // Cerca eventi consent nel dataLayer
      const dl = w.__dl_events || [];
      let latestConsent: any = {};

      // Pattern di ricerca nelle chiamate gtag
      const gtagCalls = w.__gtag_calls || [];
      for (const call of gtagCalls.reverse()) {
        if (call[0] === 'consent' && call[1] === 'update' && call[2]) {
          latestConsent = { ...call[2] };
          break;
        }
      }

      // Pattern di ricerca nel dataLayer
      for (const event of dl.slice().reverse()) {
        if (Array.isArray(event)) {
          if (event[0] === 'consent') {
            latestConsent = { ...(event[1] || {}) };
            break;
          }
          if (event[0] === 'gtag' && event[1] === 'consent') {
            latestConsent = { ...(event[2] || {}) };
            break;
          }
        } else if (typeof event === 'object' && event.event) {
          if (event.event.includes('consent')) {
            latestConsent = { ...(event.consent_mode || {}) };
            break;
          }
        }
      }

      return {
        ad_user_data: latestConsent.ad_user_data || 'n/d',
        ad_personalization: latestConsent.ad_personalization || 'n/d',
        ad_storage: latestConsent.ad_storage || 'n/d',
        analytics_storage: latestConsent.analytics_storage || 'n/d'
      };
    });
  }

  private async getSensitiveCookies(context: BrowserContext): Promise<ScenarioResult['cookies']> {
    const cookies = await context.cookies();
    return cookies
      .filter(cookie => this.config.cookies.sensitive.includes(cookie.name))
      .map(cookie => ({
        name: cookie.name,
        domain: cookie.domain,
        expires: cookie.expires || 0
      }));
  }

  private async getGtagCallsData(page: Page): Promise<ScenarioResult['gtagCalls']> {
    return await page.evaluate(() => (window as any).__gtag_calls || []);
  }

  private async getDataLayerEvents(page: Page): Promise<ScenarioResult['dataLayer']> {
    return await page.evaluate(() => (window as any).__dl_events || []);
  }

  private isGaAdsRequest(url: string): boolean {
    return this.config.endpoints.gaAds.some(pattern => {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return regex.test(url);
    });
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

  private async captureScreenshot(page: Page, scenario: 'reject' | 'accept', input: ConsentTestInput): Promise<string | undefined> {
    try {
      if (!input.options.captureScreens) return undefined;
      
      const runId = Date.now().toString();
      const artifactPath = `./artifacts/${runId}/`;
      await fs.mkdir(artifactPath, { recursive: true }); 
      
      const filename = `${artifactPath}consent-test-${scenario}.png`;
      await page.screenshot({ path: filename, fullPage: true });
      
      return filename;
    } catch { 
      return undefined; 
    }
  }

  private evaluateResults(results: { reject: ScenarioResult; accept: ScenarioResult }): ConsentTestResult['summary'] {
    const notes: string[] = [];
    let pass = true;

    // Controlli di sicurezza preliminari
    if (!results.reject || !results.accept) {
      notes.push('ERRORE: Risultati incompleti - uno o entrambi gli scenari sono falliti');
      return { pass: false, notes };
    }

    // Valuta scenario REJECT - NON dovrebbero esserci cookies/richieste
    const rejectCookies = results.reject.cookies?.length || 0;
    const rejectRequests = results.reject.gaAdsRequests?.length || 0;
    
    if (rejectCookies > 0) {
      notes.push(`REJECT: 🍪 Rilevati ${rejectCookies} cookie sensibili (dovrebbero essere 0)`);
      pass = false;
    }
    
    if (rejectRequests > 0) {
      notes.push(`REJECT: 🎯 Trovate ${rejectRequests} richieste GA/Ads (dovrebbero essere 0)`);
      pass = false;
    }

    // Valuta scenario ACCEPT - dovrebbero essere presenti le strategie marketing
    const acceptConsent = results.accept.latestConsent || {};
    const hasGrantedConsent = Object.values(acceptConsent).some(value => value === 'granted');
    const acceptRequests = results.accept.gaAdsRequests?.length || 0;
    const acceptCookies = results.accept.cookies?.length || 0;

    if (!hasGrantedConsent) {
      notes.push('ACCEPT: ⚠️ Nessun consenso "granted" rilevato dal Consent Mode');
    }

    // Test dovrebbe anche controllare che in ACCEPT ci siano tracking calls
    if (acceptRequests === 0 && acceptCookies === 0) {
      notes.push('ACCEPT: ⚠️ Nessuna attività tracking (potrebbe essere normale se sonto non usa GA/Ads)');
    }

    if (notes.length === 0) {
      notes.push('✅ Test completato con successo - nessun problema rilevato');
    }

    return { pass, notes };
  }
}

// Funzione di utilità per eseguire il test
export async function runConsentTest(input: ConsentTestInput): Promise<ConsentTestResult> {
  const runner = new ConsentTestRunner();
  return await runner.runTest(input);
}