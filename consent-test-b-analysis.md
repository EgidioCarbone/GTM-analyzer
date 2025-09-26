# Consent Test B - Analisi Completa

## File: src/consent-test-b/pw-runner.ts
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


## File: src/consent-test-b/config.ts

// src/consent-test-b/config.ts

export interface ConsentTestConfig {
  timeouts: {
    softMs: number;
    hardMs: number;
    graceMs: number;
  };
  cookies: {
    sensitive: string[];
  };
  endpoints: {
    gaAds: string[];
  };
  cmp: {
    selectors: {
      [key: string]: {
        accept: string[];
        reject: string[];
      };
    };
    fallback: {
      accept: string[];
      reject: string[];
    };
  };
  features: {
    captureScreens: boolean;
    trace: boolean;
  };
  region: "EU" | "US";
}

export const defaultConfig: ConsentTestConfig = {
  timeouts: {
    softMs: 10000,
    hardMs: 25000,
    graceMs: 2000,
  },
  cookies: {
    sensitive: [
      "_ga",
      "_gid", 
      "_gcl_au",
      "IDE",
      "_fbp",
      "_fbc",
      "_gclid",
      "_gcl_gb",
      "_gcl_aw",
      "_gcl_dc",
      "_gcl_gf",
      "_gcl_ha"
    ],
  },
  endpoints: {
    gaAds: [
      "www.google-analytics.com/*collect",
      "stats.g.doubleclick.net/*",
      "googleads.g.doubleclick.net/pagead/1p-conversion",
      "td.doubleclick.net/*",
      "www.googletagmanager.com/gtag/js",
      "www.googleadservices.com/*",
      "googleads.g.doubleclick.net/*",
      "doubleclick.net/*"
    ],
  },
  cmp: {
    selectors: {
      onetrust: {
        accept: ["#onetrust-accept-btn-handler", ".accept-btn", "[data-optanongroupid='C0001']"],
        reject: ["#onetrust-reject-all-handler", ".reject-btn", "[data-optanongroupid='C0002']"]
      },
      cookiebot: {
        accept: ["#CybotCookiebotDialogBodyButtonAccept", ".CookiebotDialogBodyButtonAccept"],
        reject: ["#CybotCookiebotDialogBodyButtonDecline", ".CookiebotDialogBodyButtonDecline"]
      },
      iubenda: {
        accept: [".iubenda-cs-accept-btn", "#iubenda-cs-accept-btn"],
        reject: [".iubenda-cs-reject-btn", "#iubenda-cs-reject-btn"]
      },
      didomi: {
        accept: [".didomi-continue-without-agree", "#didomi-continue-without-agree"],
        reject: [".didomi-disagree-high", "#didomi-disagree-high"]
      },
      usercentrics: {
        accept: [".uc-btn-accept-all", "#uc-btn-accept-all"],
        reject: [".uc-btn-deny-all", "#uc-btn-deny-all"]
      }
    },
    fallback: {
      accept: [
        "accetta",
        "accept",
        "accetto",
        "conferma",
        "confirm",
        "ok",
        "consenti",
        "consent",
        "tutti",
        "all",
        "tutto",
        "everything"
      ],
      reject: [
        "rifiuta",
        "reject",
        "decline",
        "rifiuto",
        "nega",
        "deny",
        "solo necessari",
        "necessary only",
        "solo essenziali",
        "essential only"
      ]
    }
  },
  features: {
    captureScreens: true,
    trace: false,
  },
  region: "EU",
};


## File: src/consent-test-b/ConsentTestBPage.tsx

// src/consent-test-b/ConsentTestBPage.tsx
import { useState } from "react";
import {
  Loader2,
  Shield,
  CheckCircle2,
  XCircle,
  Eye,
  Download,
  ExternalLink,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";

interface ConsentTestResult {
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

interface ScenarioResult {
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

export default function ConsentTestBPage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ConsentTestResult | null>(null);
  const [activeTab, setActiveTab] = useState<'reject' | 'accept'>('reject');
  
  // Opzioni avanzate
  const [options, setOptions] = useState({
    timeoutSoftMs: 10000,
    timeoutHardMs: 25000,
    captureScreens: true,
    trace: false,
    region: 'EU' as 'EU' | 'US'
  });

  const handleRun = async () => {
    if (!url) return;

    // Validazione URL
    if (!url.toLowerCase().startsWith('http://') && !url.toLowerCase().startsWith('https://')) {
      setError('L\'URL deve iniziare con "http://" o "https://" per essere valido.');
      toast.error('L\'URL deve iniziare con "http://" o "https://" per essere valido.', { id: "consent-test" });
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    toast.loading("Esecuzione test consenso in corso…", { id: "consent-test" });

    try {
      const response = await fetch('http://localhost:4000/api/consent/audit-pw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          options
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Errore durante il test');
      }

      const data = await response.json();
      setResult(data);
      toast.success("Test consenso completato!", { id: "consent-test" });
    } catch (e) {
      const msg = (e as Error).message || "Errore imprevisto.";
      setError(msg);
      toast.error(msg, { id: "consent-test" });
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setResult(null);
    setError(null);
    setUrl("");
  };

  const formatTimestamp = (ts: number) => {
    return new Date(ts).toLocaleTimeString('it-IT');
  };

  const formatExpiry = (expires: number) => {
    if (expires === 0) return 'Sessione';
    return new Date(expires * 1000).toLocaleDateString('it-IT');
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-12 sm:px-8">
      {/* background blobs */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-20 bg-gradient-to-br from-blue-100 via-white to-cyan-100 dark:from-gray-900 dark:via-gray-950 dark:to-black"
      />
      <div
        aria-hidden
        className="absolute -left-64 -top-64 -z-10 size-[45rem] rounded-full bg-blue-300 opacity-40 blur-3xl dark:bg-blue-600/30"
      />
      <div
        aria-hidden
        className="absolute -bottom-64 -right-64 -z-10 size-[45rem] rounded-full bg-cyan-300 opacity-40 blur-3xl dark:bg-cyan-600/20"
      />

      {/* hero */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7 }}
        className="relative z-10 mx-auto w-full max-w-2xl space-y-6 text-center"
      >
        <Shield className="mx-auto size-10 text-blue-600" />
        <h1 className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-4xl font-extrabold text-transparent drop-shadow-sm md:text-5xl">
          Consent Test B
        </h1>
        <p className="mx-auto max-w-md text-base leading-relaxed text-gray-700 dark:text-gray-300">
          Test automatico del consenso con Playwright: simula "Rifiuta tutto" e "Accetta tutto",
          rileva Google Consent Mode v2, TCF v2, cookie sensibili e richieste rete GA/Ads.
        </p>

        <div className="flex flex-col items-center gap-3 sm:flex-row sm:gap-2">
          <input
            className="w-full flex-1 rounded-lg border border-gray-300/60 bg-white/70 px-4 py-2 text-sm shadow-sm backdrop-blur placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-400/40 focus:outline-none dark:border-gray-600/60 dark:bg-gray-900/40 dark:text-gray-100"
            placeholder="https://www.example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={loading}
          />
          <button
            onClick={handleRun}
            disabled={!url || loading}
            className="relative inline-flex items-center justify-center overflow-hidden rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 px-5 py-2 text-sm font-medium text-white shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-xl disabled:pointer-events-none disabled:opacity-40"
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              "Esegui test (Playwright)"
            )}
          </button>
        </div>

        {/* Opzioni avanzate */}
        <div className="mt-4 space-y-3 text-left">
          <details className="group">
            <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400">
              Opzioni avanzate
            </summary>
            <div className="mt-3 space-y-3 rounded-lg bg-white/50 p-4 dark:bg-gray-900/50">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Timeout Soft (ms)
                  </label>
                  <input
                    type="number"
                    value={options.timeoutSoftMs}
                    onChange={(e) => setOptions(prev => ({ ...prev, timeoutSoftMs: parseInt(e.target.value) || 10000 }))}
                    className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Timeout Hard (ms)
                  </label>
                  <input
                    type="number"
                    value={options.timeoutHardMs}
                    onChange={(e) => setOptions(prev => ({ ...prev, timeoutHardMs: parseInt(e.target.value) || 25000 }))}
                    className="w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800"
                    disabled={loading}
                  />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={options.captureScreens}
                    onChange={(e) => setOptions(prev => ({ ...prev, captureScreens: e.target.checked }))}
                    disabled={loading}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Cattura Screenshot</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={options.trace}
                    onChange={(e) => setOptions(prev => ({ ...prev, trace: e.target.checked }))}
                    disabled={loading}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Trace</span>
                </label>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Regione
                  </label>
                  <select
                    value={options.region}
                    onChange={(e) => setOptions(prev => ({ ...prev, region: e.target.value as 'EU' | 'US' }))}
                    disabled={loading}
                    className="rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800"
                  >
                    <option value="EU">EU</option>
                    <option value="US">US</option>
                  </select>
                </div>
              </div>
            </div>
          </details>
        </div>

        {error && (
          <p className="mx-auto w-full max-w-md rounded-md border border-rose-300 bg-rose-50 px-4 py-3 text-rose-700 shadow dark:border-rose-700/60 dark:bg-rose-900/40 dark:text-rose-200">
            {error}
          </p>
        )}
      </motion.div>

      {/* results */}
      <AnimatePresence mode="wait">
        {result && !loading && (
          <motion.section
            key="results"
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 32 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="relative z-10 mt-12 w-full max-w-6xl space-y-6"
          >
            {/* Summary */}
            <div className="rounded-xl bg-white/60 p-6 shadow-inner backdrop-blur-md dark:bg-gray-900/40">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Risultati Test Consenso</h2>
                <div className="flex items-center gap-2">
                  {result.summary.pass ? (
                    <CheckCircle2 className="size-5 text-green-600" />
                  ) : (
                    <XCircle className="size-5 text-red-600" />
                  )}
                  <span className={`text-sm font-medium ${result.summary.pass ? 'text-green-600' : 'text-red-600'}`}>
                    {result.summary.pass ? 'PASS' : 'FAIL'}
                  </span>
                </div>
              </div>
              
              <div className="space-y-2">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Testato: <a href={result.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                    {result.url.replace(/^https?:\/\//, "")}
                  </a>
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Generato: {new Date(result.generatedAt).toLocaleString('it-IT')}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Engine: {result.env.userAgent.split(' ')[0]} | Regione: {result.env.region}
                </p>
              </div>

              {result.summary.notes.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Note:</h3>
                  <ul className="space-y-1">
                    {result.summary.notes.map((note, index) => (
                      <li key={index} className="text-sm text-gray-600 dark:text-gray-400">
                        • {note}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Tabs */}
            <div className="rounded-xl bg-white/60 p-6 shadow-inner backdrop-blur-md dark:bg-gray-900/40">
              <div className="flex space-x-1 mb-6">
                <button
                  onClick={() => setActiveTab('reject')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === 'reject'
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                      : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
                  }`}
                >
                  Reject
                </button>
                <button
                  onClick={() => setActiveTab('accept')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === 'accept'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                      : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
                  }`}
                >
                  Accept
                </button>
              </div>

              {activeTab && (
                <div className="space-y-6">
                  {/* Consent Mode v2 */}
                  <div>
                    <h3 className="text-lg font-medium mb-3">Consent Mode v2</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 dark:border-gray-700">
                            <th className="text-left py-2 px-3">Parametro</th>
                            <th className="text-left py-2 px-3">Valore</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(result.results[activeTab].latestConsent).map(([key, value]) => (
                            <tr key={key} className="border-b border-gray-100 dark:border-gray-800">
                              <td className="py-2 px-3 font-medium">{key}</td>
                              <td className="py-2 px-3">
                                <span className={`px-2 py-1 rounded text-xs ${
                                  value === 'granted' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' :
                                  value === 'denied' ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400' :
                                  'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
                                }`}>
                                  {value}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Cookie sensibili */}
                  <div>
                    <h3 className="text-lg font-medium mb-3">
                      Cookie Sensibili ({result.results[activeTab].cookies.length})
                    </h3>
                    {result.results[activeTab].cookies.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-200 dark:border-gray-700">
                              <th className="text-left py-2 px-3">Nome</th>
                              <th className="text-left py-2 px-3">Dominio</th>
                              <th className="text-left py-2 px-3">Scadenza</th>
                            </tr>
                          </thead>
                          <tbody>
                            {result.results[activeTab].cookies.map((cookie, index) => (
                              <tr key={index} className="border-b border-gray-100 dark:border-gray-800">
                                <td className="py-2 px-3 font-mono text-xs">{cookie.name}</td>
                                <td className="py-2 px-3">{cookie.domain}</td>
                                <td className="py-2 px-3">{formatExpiry(cookie.expires)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-600 dark:text-gray-400">Nessun cookie sensibile rilevato</p>
                    )}
                  </div>

                  {/* Richieste GA/Ads */}
                  <div>
                    <h3 className="text-lg font-medium mb-3">
                      Richieste GA/Ads ({result.results[activeTab].gaAdsRequests.length})
                    </h3>
                    {result.results[activeTab].gaAdsRequests.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-200 dark:border-gray-700">
                              <th className="text-left py-2 px-3">URL</th>
                              <th className="text-left py-2 px-3">Timestamp</th>
                            </tr>
                          </thead>
                          <tbody>
                            {result.results[activeTab].gaAdsRequests.map((request, index) => (
                              <tr key={index} className="border-b border-gray-100 dark:border-gray-800">
                                <td className="py-2 px-3 font-mono text-xs break-all">{request.url}</td>
                                <td className="py-2 px-3">{formatTimestamp(request.ts)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-600 dark:text-gray-400">Nessuna richiesta GA/Ads rilevata</p>
                    )}
                  </div>

                  {/* Artefatti */}
                  <div>
                    <h3 className="text-lg font-medium mb-3">Artefatti</h3>
                    <div className="flex gap-4">
                      {result.results[activeTab].artifacts.screenshotPath && (
                        <a
                          href={`/artifacts/pw/${result.results[activeTab].artifacts.screenshotPath}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30"
                        >
                          <Eye className="size-4" />
                          Screenshot
                        </a>
                      )}
                      {result.results[activeTab].artifacts.tracePath && (
                        <a
                          href={`/artifacts/pw/${result.results[activeTab].artifacts.tracePath}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/30"
                        >
                          <Download className="size-4" />
                          Trace
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Reset button */}
            <div className="text-center">
              <button
                onClick={reset}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700"
              >
                <XCircle className="size-4" />
                Nuovo Test
              </button>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
