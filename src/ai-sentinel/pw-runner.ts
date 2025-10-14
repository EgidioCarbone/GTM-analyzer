// src/ai-sentinel/pw-runner.ts

import { chromium, Browser, BrowserContext, Page, ElementHandle, Frame, Locator } from 'playwright';
import { defaultConfig, ConsentTestConfig } from './config';
import * as fs from 'fs/promises';
import { z } from 'zod';
import { consentProbe } from './init/consent-probe';
import { waitForConsentOrTimeout } from './utils/wait-consent';
import { ConsentLLMService } from './llm/consent-llm-service';

// ========================================
// 🧩 Universal Cookie Banner Helpers
// ========================================

// Find the visible cookie banner root
async function findCookieBannerRoot(page: Page) {
  const candidates = [
    '[role="dialog"]',
    'div[id*="cookie" i]',
    'div[class*="cookie" i]',
    'div[id*="consent" i]',
    'div[class*="consent" i]',
    'section:has-text("cookie" i)',
    'aside:has-text("cookie" i)',
    'footer:has-text("cookie" i)',
  ];
  for (const sel of candidates) {
    const loc = page.locator(sel).filter({ hasText: /cookie|consent|privacy|gdpr/i }).first();
    try { await loc.waitFor({ state: 'visible', timeout: 1500 }); return loc; } catch {}
  }
  const fallback = page.locator('[role="dialog"]').first();
  try { await fallback.waitFor({ state: 'visible', timeout: 1000 }); return fallback; } catch {}
  return null;
}

// Click the "commit" button inside the banner, excluding decline/accept-all
async function clickCommitOnBanner(banner: Locator, page: Page) {
  const NEG = /rifiuta|reject|decline|nega|refuse/i;
  const ALL = /accetta tutti|accept all|allow all|tout accepter|alles akzeptieren|aceptar todo/i;
  const COMMIT_RX = [
    /accetta selezionati|consenti selezionati|accept selected|allow selection/i,
    /applica|apply/i,
    /salva|save|guardar/i,
    /conferma|confirm|confirmar|bestätigen/i,
    /fine|done|got it/i,
  ];

  // 1) Fast path: known ids (Cookiebot and generics)
  const idPats = [
    '[id*="AllowallSelection" i]', // Cookiebot "Accetta selezionati"
    '[id*="OptinAllowallSelection" i]',
    '[id*="save" i]','[id*="confirm" i]','[id*="apply" i]',
  ];
  for (const pat of idPats) {
    const l = banner.locator(`button${pat},[role=button]${pat},input[type=submit]${pat},input[type=button]${pat}`).first();
    if (await l.count()) {
      const t = (await l.innerText().catch(() => '')) || '';
      if (!NEG.test(t) && !ALL.test(t)) { await l.scrollIntoViewIfNeeded(); await l.click(); return true; }
    }
  }

  // 2) Text-based (button + inputs)
  for (const rx of COMMIT_RX) {
    const btn = banner.getByRole('button', { name: rx }).first();
    if (await btn.count()) { await btn.scrollIntoViewIfNeeded(); await btn.click(); return true; }
    const anyBtn = banner.locator('button,[role=button]').filter({ hasText: rx }).first();
    if (await anyBtn.count()) { await anyBtn.scrollIntoViewIfNeeded(); await anyBtn.click(); return true; }
    const inputs = banner.locator('input[type=submit],input[type=button]').filter({
      hasText: rx
    }).first();
    if (await inputs.count()) { await inputs.scrollIntoViewIfNeeded(); await inputs.click(); return true; }
  }

  // 3) Fallback: first primary-looking button that is not decline/accept-all
  const fallback = banner.locator('button,[role=button],input[type=submit],input[type=button]')
    .filter({ hasNotText: NEG })
    .filter({ hasNotText: ALL })
    .first();
  if (await fallback.count()) { await fallback.scrollIntoViewIfNeeded(); await fallback.click(); return true; }

  return false;
}

// ========================================
// 🧩 Commit Logging Helper
// ========================================

function labelOf(el: Element | null): string {
  if (!el) return '';
  const a = (el as HTMLElement).getAttribute.bind(el);
  const id = a('id') || '';
  const aria = a('aria-label') || '';
  const title = a('title') || '';
  const txt = (el as HTMLElement).innerText?.trim() || (el as HTMLElement).textContent?.trim() || '';
  return [txt, aria, title, id].find(v => v && v.length > 0) || '(no-label)';
}

// ========================================
// 🧩 Performance-Optimized Banner Detection
// ========================================

async function waitCookieBanner(page: Page, softMs = 5000, hardMs = 15000, llmService?: ConsentLLMService) {
  // ventaglio di selettori generici per CMP (nessun vendor hardcoded)
  const selectors = [
    'div[role="dialog"]',
    '[role="dialog"]',
    '[id*="cookie" i]',
    '[class*="cookie" i]',
    '[id*="consent" i]',
    '[class*="consent" i]',
    '[id*="banner" i]',
    '[class*="banner" i]',
    '[id*="popup" i]',
    '[class*="popup" i]',
    '[id*="modal" i]',
    '[class*="modal" i]',
    '[id*="overlay" i]',
    '[class*="overlay" i]',
    '[id*="privacy" i]',
    '[class*="privacy" i]',
    '[id*="gdpr" i]',
    '[class*="gdpr" i]',
    'div[style*="position: fixed"]',
    'div[style*="z-index"]',
    'div[style*="bottom"]',
    'div[style*="top"]',
  ];

  const tryOnce = (sel: string, ms: number) =>
    page.waitForSelector(sel, { state: 'visible', timeout: ms }).catch(() => null);

  // primo colpo rapido
  const fast = await Promise.any(selectors.map(s => tryOnce(s, Math.min(softMs, 1500)))).catch(() => null);
  if (fast) return fast;

  // fallback un po' più lungo ma sempre "short"
  const slow = await Promise.any(selectors.map(s => tryOnce(s, hardMs))).catch(() => null);
  if (slow) return slow;

  // 🤖 FALLBACK LLM: Se i selettori standard falliscono, usa ChatGPT
  if (llmService) {
    console.log('🤖 Tentativo fallback LLM per rilevamento banner...');
    const llmResult = await detectBannerWithLLM(page, llmService);
    
    if (llmResult && llmResult.bannerSelector) {
      console.log('🤖 LLM ha trovato banner, provo selettore:', llmResult.bannerSelector);
      try {
        const banner = await page.waitForSelector(llmResult.bannerSelector, { 
          state: 'visible', 
          timeout: 5000 
        });
        if (banner) {
          console.log('✅ Banner trovato via LLM fallback!');
          return banner;
        }
      } catch (error) {
        console.log('❌ Selettore LLM non funziona:', error);
      }
    }
  }

  throw new Error('Cookie banner non trovato entro il tempo limite');
}

// ========================================
// 🤖 LLM Fallback per Rilevamento Banner Universale
// ========================================

async function detectBannerWithLLM(page: Page, llmService?: ConsentLLMService): Promise<{
  bannerSelector: string | null;
  rejectSelector: string | null;
  acceptSelector: string | null;
} | null> {
  if (!llmService) {
    console.log('🤖 LLM service non disponibile per fallback banner detection');
    return null;
  }

  try {
    console.log('🤖 Tentativo rilevamento banner via LLM per:', page.url());
    const html = await page.content();
    const languageHints = await page.evaluate(() => {
      const hints = new Set<string>();
      if (navigator.language) hints.add(navigator.language);
      if (navigator.languages) navigator.languages.forEach(lang => hints.add(lang));

      const htmlEl = document.documentElement;
      if (htmlEl && htmlEl.lang) hints.add(htmlEl.lang);

      document.querySelectorAll('[lang]').forEach(el => {
        const lang = el.getAttribute('lang');
        if (lang) hints.add(lang);
      });

      return Array.from(hints).slice(0, 5);
    }).catch(() => []);

    const response = await llmService.suggestSelectorsFromHtml({
      pageUrl: page.url(),
      html,
      languageHints,
    });
    
    console.log('🤖 RISPOSTA LLM (banner detection):');
    console.log('🤖 Response:', JSON.stringify(response, null, 2));
    
    if (response && response.bannerSelector) {
      console.log('✅ LLM ha trovato banner:', response.bannerSelector);
      return {
        bannerSelector: response.bannerSelector,
        rejectSelector: response.rejectSelector,
        acceptSelector: response.acceptSelector
      };
    }
    
    console.log('❌ LLM non ha trovato banner');
    return null;
  } catch (error) {
    console.error('❌ Errore LLM fallback banner detection:', error);
    return null;
  }
}

async function waitConsentSettled(page: Page, expected: { marketing?: boolean; statistics?: boolean; preferences?: boolean }, maxMs = 3500) {
  function waitDialogDetached() {
    return page.waitForSelector('div[role="dialog"],[role="dialog"]', { state: 'detached', timeout: maxMs });
  }
  function waitConsentObject() {
    return page.waitForFunction((exp: any) => {
      const w = window as any;
      const cb = w?.Cookiebot?.consent;
      if (!cb) return false;
      const okMarketing = typeof exp.marketing === 'boolean' ? cb.marketing === exp.marketing : true;
      const okStats     = typeof exp.statistics === 'boolean' ? cb.statistics === exp.statistics : true;
      const okPrefs     = typeof exp.preferences === 'boolean' ? cb.preferences === exp.preferences : true;
      return okMarketing && okStats && okPrefs;
    }, expected, { timeout: maxMs });
  }
  // Eventi se presenti (universale: se non ci sono, semplicemente va in timeout e la race continua)
  function waitAnyEvent() {
    return page.evaluate((ms) => new Promise<void>((resolve) => {
      const done = () => resolve();
      const t = setTimeout(done, ms);
      const safe = (w: any, ev: string) => w && w.addEventListener && w.addEventListener(ev, () => { clearTimeout(t); resolve(); }, { once: true });
      safe(window, 'consentready');
      safe(window, 'consentChanged');
      safe(window, 'CookiebotOnAccept');  // se esiste
      safe(window, 'CookieConsentUpdate'); // altri CMP
    }), maxMs);
  }

  await Promise.race([
    waitDialogDetached().catch(() => {}),
    waitConsentObject().catch(() => {}),
    waitAnyEvent().catch(() => {}),
  ]);
}

// ========================================
// 🧩 Network Guard for Marketing Validation (Hardened)
// ========================================

type Guard = { stop: () => Promise<void> };

function startNetworkGuardForWindow(page: Page, opts: { disallowMarketing: boolean, windowMs?: number }): Guard {
  const BLOCK_IF_MARKETING_FALSE = [
    // Ads/marketing ecosistemi comuni
    'doubleclick.net','googleadservices.com','googlesyndication.com',
    'adservice.google.com','adservice.google.it',
    'facebook.com/tr','connect.facebook.net',
    'tiktok.com/','analytics.tiktok.com','snapads.com','ads-twitter.com',
    'criteo.com','rubiconproject.com','pubmatic.com','adnxs.com',
    'taboola.com','outbrain.com','teads.tv','hotjar.com/api/v2/client',
  ];

  // Analytics/statistics allowlist (NON bloccare anche se marketing=false)
  const ANALYTICS_ALLOW = [
    // GA4
    'google-analytics.com/g/collect',
    'region1.google-analytics.com/g/collect',
    'stats.g.doubleclick.net/g/collect', // GA4 server; è statistics
    // GTM loader (non marketing di per sé)
    'googletagmanager.com/gtm.js',
    'googletagmanager.com/gtag/js?id=G-',
    // altri analytics comuni
    'clarity.ms/collect','mixpanel.com/track','segment.com/v1/t',
  ].map(s => s.toLowerCase());

  let violated = false;
  let listener: ((req: any) => void) | null = (req: any) => {
    if (!opts.disallowMarketing) return; // se marketing consentito, non controllare
    const url = req.url().toLowerCase();

    // consenti analytics esplicitamente
    if (ANALYTICS_ALLOW.some(a => url.includes(a))) return;

    if (BLOCK_IF_MARKETING_FALSE.some(d => url.includes(d))) {
      violated = true;
    }
  };

  if (listener) page.on('request', listener);

  // finestra limitata (default 10s); oltre, la guard si spegne da sola
  const timer = setTimeout(() => {
    if (listener) page.off('request', listener);
    listener = null;
  }, opts.windowMs ?? 10000);

  return {
    async stop() {
      clearTimeout(timer);
      if (listener) page.off('request', listener);
      listener = null;
      if (opts.disallowMarketing && violated) {
        throw new Error('Network guard: trovate chiamate marketing entro la finestra post-consent con marketing=false');
      }
    }
  };
}

// ========================================
// 🧩 Cookiebot Helper Functions
// ========================================

type CookiebotCategory = 'statistics' | 'marketing' | 'preferences';

const CB_IDS: Record<CookiebotCategory, { input: string; label: string }> = {
  statistics:  { 
    input: '#CybotCookiebotDialogBodyLevelButtonStatistics',  
    label: 'label[for="CybotCookiebotDialogBodyLevelButtonStatistics"]' 
  },
  marketing:   { 
    input: '#CybotCookiebotDialogBodyLevelButtonMarketing',   
    label: 'label[for="CybotCookiebotDialogBodyLevelButtonMarketing"]' 
  },
  preferences: { 
    input: '#CybotCookiebotDialogBodyLevelButtonPreferences', 
    label: 'label[for="CybotCookiebotDialogBodyLevelButtonPreferences"]' 
  },
};

async function openCookiebotDetails(bannerScope: Page | Frame) {
  const triggers = [
    '#CybotCookiebotDialogBodyButtonDetails',
    'button:has-text("Mostra dettagli")',
    'button:has-text("Dettagli")',
    'button:has-text("Show details")',
  ];
  for (const sel of triggers) {
    const btn = bannerScope.locator(sel).first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click({ force: true });
      console.log(`✅ Clicked details button: ${sel}`);
      break;
    }
  }
}

async function waitCookiebotToggles(scope: Page | Frame) {
  const anyId = Object.values(CB_IDS).map(m => m.input).join(',');
  // Rimuovo il wait hard per #CybotCookiebotDialogBodyLevelButtons
  await scope.locator(anyId).first().waitFor({ state: 'attached', timeout: 1500 }).catch(() => {});
  await scope.waitForTimeout(200);
}

// Function removed - replaced with universal clickCommitOnBanner

async function isClickable(locator: Locator) {
  const h = await locator.elementHandle();
  if (!h) return false;
  return await h.evaluate((n: any) => {
    const r = n.getBoundingClientRect();
    const s = getComputedStyle(n);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
  }).catch(() => false);
}

// Type-guard: verifica che sia davvero un Frame Playwright
function isRealFrame(x: any): x is Frame {
  return !!x && typeof x.url === 'function' && typeof x.locator === 'function';
}

// ========================================
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

export type ScenarioMode = 'accept' | 'reject' | { custom: { analytics?: boolean; marketing?: boolean; preferences?: boolean } };

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
    [key: string]: ScenarioResult;  // Support per scenari custom dinamici
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
    functionality_storage: string;
    security_storage: string;
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
  llmTestResult?: boolean; // Risultato del test LLM (true = passato, false = fallito)
  llmServiceAvailable?: boolean; // Indica se il servizio LLM era disponibile durante il test
  artifacts: {
    screenshotPath?: string;
    cookieBannerScreenshotPath?: string;
    tracePath?: string;
  };
  selectedCategories?: {
    analytics?: boolean;
    marketing?: boolean;
    preferences?: boolean;
  };
  personalizaFlow?: {
    usedCmp?: 'cookiebot' | 'onetrust' | 'iubenda' | 'didomi' | 'usercentrics' | 'generic' | 'unknown';
    usedIframe?: boolean;
    matchedBy?: 'config' | 'fallback';
    confirmButton?: string;
    missingToggle?: string[];
  };
}

export class ConsentTestRunner {
  private config: ConsentTestConfig;
  private llmService?: ConsentLLMService;
  private llmTestResult?: boolean; // Risultato dell'ultimo test LLM eseguito
  private lastLLMBannerSelectors?: {
    bannerSelector: string | null;
    acceptSelector: string | null;
    rejectSelector: string | null;
  };

  constructor(config: ConsentTestConfig = defaultConfig, llmService?: ConsentLLMService) {
    this.config = config;
    this.llmService = llmService;
    this.llmTestResult = undefined;
    this.lastLLMBannerSelectors = undefined;
  }

  async runTest(input: ConsentTestInput, customScenarios?: Array<ScenarioMode>): Promise<ConsentTestResult> {
    const validatedInput = ConsentTestInputSchema.parse(input);
    
    console.log(`🎯 pw-runner: Received customScenarios:`, customScenarios);
    if (customScenarios && customScenarios.length > 0) {
      console.log(`🎯 pw-runner: Custom scenarios count:`, customScenarios.length);
    }
    
    let rejectResult: ScenarioResult;
    let acceptResult: ScenarioResult;
    const customResults: { [key: string]: ScenarioResult } = {};

    try {
        // 🧪 TESTING MODE: Test both Reject and Accept scenarios
        const shouldSkipAccept = false; // Enable Accept scenario for testing
        console.log('🧪 TESTING MODE: Both "Rifiuta Tutto" and "Accetta Tutto" scenarios will be executed');
      
      // Scenario REJECT
      console.log('=== INIZIO SCENARIO REJECT ===');
      rejectResult = await this.runScenarioWithIsolatedBrowser('reject', validatedInput);

      // Scenario ACCEPT con browser completamente nuovo
      if (!shouldSkipAccept) {
        console.log('=== INIZIO SCENARIO ACCEPT ===');
        acceptResult = await this.runScenarioWithIsolatedBrowser('accept', validatedInput);
      } else {
        console.log('🧪 TESTING MODE: Skipping ACCEPT scenario');
      }

      // Scenari custom se presenti
      if (!shouldSkipAccept && customScenarios && customScenarios.length > 0) {
        console.log(`🎯 Scenari personalizzati ricevuti: ${customScenarios.length}`);
        for (const scenario of customScenarios) {
          console.log(`🔍 Validating scenario: ${typeof scenario} - ${JSON.stringify(scenario)}`);
          if (typeof scenario === 'object' && scenario !== null && 'custom' in scenario) {
            const scenarioKey = `custom-${JSON.stringify(scenario.custom).replace(/[{":]/g, '').replace(/}/g, '')}`;
            console.log(`=== INIZIO SCENARIO CUSTOM: ${scenarioKey} ===`);
            const customResult = await this.runScenarioWithIsolatedBrowser(scenario, validatedInput);
            customResults[scenarioKey] = customResult;
          } else {
            console.log(`❌ Scenario custom failed validation conditions`);
          }
        }
      } else if (shouldSkipAccept) {
        console.log('🧪 TESTING MODE: Skipping CUSTOM scenarios');
      } else {
        console.log(`⚠️ NO CUSTOM SCENARIOS ENABLED (customScenarios=${!!customScenarios}, length=${customScenarios?.length || 0})`);
      }

      const results = {
        reject: rejectResult,
        accept: acceptResult || { skipped: true, latestConsent: {}, cookies: [], networkRequests: [], dataLayerSnapshot: {}, warnings: ['🧪 TESTING MODE: ACCEPT scenario skipped'] },
        ...customResults
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

  private async runScenarioWithIsolatedBrowser(scenario: ScenarioMode, input: ConsentTestInput): Promise<ScenarioResult> {
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
      
      // Reset LLM test result prima di ogni scenario
      this.llmTestResult = undefined;
      this.lastLLMBannerSelectors = undefined;

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
          console.log(`🔗 GA/Ads request detected:`);
        }
        route.continue();
      });

      page = await context.newPage();
      
      // Sanity check dell'injection dopo creazione page
      await page.addInitScript(() => {}); // no-op, forza il preload del init script
      
      // URL con parametri per forzare pop-up banner
      let scenarioKey = '';
      if (typeof scenario === 'string') {
        scenarioKey = scenario; // 'accept' or 'reject'
      } else {
        // Custom scenario: formato breve per debug
        const settings = scenario.custom;
        scenarioKey = `custom-a${+!!settings.analytics}m${+!!settings.marketing}p${+!!settings.preferences}`;
      }
      
      const urlWithParam = `${input.url}${input.url.includes('?') ? '&' : '?'}cb=1&test_consent=${encodeURIComponent(scenarioKey)}&_t=${Date.now()}`;
      console.log(`🌐 Navigating to: ${urlWithParam}`);
      
      try {
        await page.goto(urlWithParam, { 
          waitUntil: 'domcontentloaded', 
          timeout: input.options.timeoutHardMs 
        });
      } catch (error) {
        console.log(`⚠️ Navigazione con parametri custom fallita, riprovo con URL base...`);
        // Fallback: retry with base URL if custom params cause issues
        await page.goto(input.url, { 
          waitUntil: 'domcontentloaded', 
          timeout: input.options.timeoutHardMs 
        });
      }

      // API injection check rimosso - la verifica avviene ora nel waitForConsentOrTimeout

      // 🔍 PASSO 1: Chiedo sempre all'LLM i selettori del banner
      console.log('🤖 PASSO 1: Chiedendo selettori banner all\'LLM...');
      console.log('🤖 PASSO 1: URL da analizzare:', page.url());
      const llmSelectors = await detectBannerWithLLM(page, this.llmService);
      this.lastLLMBannerSelectors = llmSelectors || undefined;
      
      // 🔍 PASSO 2: Stampo i selettori al BE
      if (llmSelectors) {
        console.log('🤖 PASSO 2: Selettori trovati dall\'LLM:');
        console.log('🤖 Banner selector:', llmSelectors.bannerSelector);
        console.log('🤖 Reject selector:', llmSelectors.rejectSelector);
        console.log('🤖 Accept selector:', llmSelectors.acceptSelector);
      } else {
        console.log('🤖 PASSO 2: LLM non ha trovato selettori');
      }

      // Rilevamento banner parallelo ottimizzato
      console.log(`🔍 Rilevamento banner parallelo...`);
      const banner = await waitCookieBanner(page, 5000, 15000, this.llmService);
      console.log(`✅ Banner rilevato rapidamente`);

      // 📸 NUOVO: Cattura screenshot del cookie banner PRIMA di fare i test
      console.log(`📸 Catturando screenshot del cookie banner originale...`);
      const cookieBannerScreenshotPath = await this.captureCookieBannerScreenshot(page, input);
      if (cookieBannerScreenshotPath) {
        console.log(`✅ Screenshot cookie banner salvato: ${cookieBannerScreenshotPath}`);
      } else {
        console.log(`⚠️ Screenshot cookie banner non catturato`);
      }

      // Pipeline per gestire il banner e cliccare l'azione corrispondente
      const bannerHandled = await this.handleBannerDetectionAndAction(page, scenario, input);
      
      // FIX B: Attesa stabilizzazione CONSENT (soft)
      const settle = await waitForConsentOrTimeout(page, input.options.timeoutSoftMs);
      console.log(`[${scenario}] consent settle in ${settle.ms}ms`, settle.snapshot?.last || 'n/d');

      // NUOVO: Usa sempre la funzione getLatestConsentState per estrarre i dati dal dataLayer
      console.log(`[${scenario}] Estraendo consent state dal dataLayer...`);
      const latestConsent = await this.getLatestConsentState(page);
      const cookies = await this.getSensitiveCookies(context);
      const gtagCalls = await this.getGtagCallsData(page);
      const dataLayerEvents = await this.getDataLayerEvents(page);
      
      // Log dataLayer events per debugging - controllo diretto
      console.log(`📊 DataLayer events found: ${dataLayerEvents.length}`);
      
      // Controllo diretto del dataLayer
      const directDataLayer = await page.evaluate(() => {
        const dl = (window as any).dataLayer || [];
        return {
          length: dl.length,
          events: dl.slice(-10), // ultimi 10 eventi
          consentEvents: dl.filter((event: any) => {
            if (Array.isArray(event)) {
              return event[0] === 'consent' || 
                     (event[0] === 'event' && event[1] === 'gtm.consentUpdate') ||
                     (event[0] === 'gtag' && event[1] === 'consent');
            }
            return false;
          })
        };
      });
      
      console.log(`📊 Direct dataLayer length: ${directDataLayer.length}`);
      if (directDataLayer.consentEvents.length > 0) {
        console.log(`🔍 Direct consent events found: ${directDataLayer.consentEvents.length}`);
        directDataLayer.consentEvents.forEach((event: any, i: number) => {
          console.log(`🔍 Direct consent event ${i + 1}:`, JSON.stringify(event));
        });
      }
      
      if (dataLayerEvents.length > 0) {
        const consentEvents = dataLayerEvents.filter(event => 
          event.args && event.args[0] && 
          (event.args[0][0] === 'consent' || event.args[0][0] === 'event' && event.args[0][1] === 'gtm.consentUpdate')
        );
        if (consentEvents.length > 0) {
          console.log(`🔍 Probe consent events found: ${consentEvents.length}`);
          consentEvents.forEach((event, i) => {
            console.log(`🔍 Probe consent event ${i + 1}:`, JSON.stringify(event.args));
          });
        }
      }
      
      // Log final consent state
      console.log(`✅ Final consent state:`, latestConsent);

      // Cattura screenshot (opzionale)
      const screenshotPath = await this.captureScreenshot(page, typeof scenario === 'string' ? scenario : 'accept', input);

      // Build selected categories metadata per scenarios custom 
      let selectedCategories = undefined;
      let personalizaFlow = undefined;
      
      if (scenario !== 'accept' && scenario !== 'reject' && scenario.custom) {
        const customPrefs = scenario.custom;
        selectedCategories = {
          analytics: customPrefs.analytics,
          marketing: customPrefs.marketing,
          preferences: customPrefs.preferences
        };

        // Dobbiamo aggiungere logic per extracting il metadata effettive personal info
        const personalizeButtonFound = await this.detectPersonalizeCmpInfo(page);        
        personalizaFlow = {
          usedCmp: personalizeButtonFound.cmpName,
          usedIframe: false, // Guess per ora, potrebbe essere ricavati via further analysis
          matchedBy: personalizeButtonFound.matchedBy,
          confirmButton: personalizeButtonFound.confirmButtonText
        };
      }

      return {
        latestConsent,
        cookies,
        gaAdsRequests,
        gtagCalls,
        dataLayer: dataLayerEvents,
        llmTestResult: this.llmTestResult, // Include il risultato del test LLM
        llmServiceAvailable: !!this.llmService, // Indica se il servizio LLM era disponibile
        artifacts: { 
          screenshotPath,
          cookieBannerScreenshotPath: cookieBannerScreenshotPath
        },
        selectedCategories,
        personalizaFlow 
      };

    } finally {
      // IMPORTANTE: sempre chiudere browser per liberare risorse
      try { if (page) await page.close(); } catch {};
      try { if (context) await context.close(); } catch {};
      try { if (browser) await browser.close(); } catch {};
    }
  }

  private async handleBannerDetectionAndAction(page: Page, scenario: ScenarioMode, input: ConsentTestInput): Promise<boolean> {
    try {
      console.log(`🔍 Cerco banner per scenario ${scenario}...`);
      
      // Lista selettori banner CMP supportati
      const bannerSelectorCandidates = [
        this.lastLLMBannerSelectors?.bannerSelector || undefined,
        '#onetrust-consent-sdk',
        '#CybotCookiebotDialog', 
        '.iubenda-cs-banner',
        '.didomi-popup',
        '.uc-banner',
        '[id*="cookie"]',
        '[class*="cookie"]'
      ].filter((value): value is string => typeof value === 'string' && value.length > 0);

      const bannerSelectors = Array.from(new Set(bannerSelectorCandidates));

      // Attendi cenna fino a 15 secondi per l'apparizione del banner
      for (let attempt = 0; attempt < 15; attempt++) {
        console.log(`🔄 Tentativo rilevamento banner ${attempt + 1}/15...`);
        
        for (const selector of bannerSelectors) {
          try {
            const banner = await page.$(selector);
            if (banner && await banner.isVisible()) {
              console.log(`✅ Banner trovato: ${selector}`);
              
              let actionResult = false;
              if (scenario === 'accept' || scenario === 'reject') {
                actionResult = await this.performConsentAction(page, scenario, selector);
              } else {
                // Scenario custom: gestione flow personalizza
                actionResult = await this.handleCustomScenario(page, scenario, selector);
              }
              
              if (actionResult) {
                console.log(`✅ Azione ${JSON.stringify(scenario)} completata con successo`);
        return true;
              } else {
                console.log(`⚠️ Banner trovato ma azione ${JSON.stringify(scenario)} fallita`);
              }
            }
          } catch (err) {
            console.log(`❌ Errore nel verificare banner ${selector}:`, (err as Error).message);
          }
        }
        
        // Fallback: cerca per testo in tutti gli elementi clickable
        let actionResult = false;
    if (scenario === 'accept' || scenario === 'reject') {
          actionResult = await this.performFallbackConsentAction(page, scenario);
        } else {
          actionResult = await this.handleCustomScenarioFallback(page, scenario);
        }
        
        if (actionResult) {
          console.log(`✅ Fallback ${JSON.stringify(scenario)} completato`);
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
      // 1. Snapshot PRIMA del click - usa dataLayer nativo (più affidabile)
      const beforeClick = await page.evaluate(() => {
        const dataLayer = (window as any).dataLayer || [];
        return {
          timestamp: Date.now(),
          dataLayerLength: dataLayer.length
        };
      });

      console.log(`📊 BEFORE click ${scenario}: ${beforeClick.dataLayerLength} eventi dataLayer`);

      // 2. Esegui il click
      const candidateSelectors = this.lastLLMBannerSelectors
        ? (
            scenario === 'accept'
              ? [this.lastLLMBannerSelectors.acceptSelector, this.lastLLMBannerSelectors.bannerSelector]
              : [this.lastLLMBannerSelectors.rejectSelector, this.lastLLMBannerSelectors.bannerSelector]
          ).filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        : [];

      const clickResult = await page.evaluate(({ scenario, bannerSelector, candidateSelectors }) => {
        const resolvedCandidates = Array.isArray(candidateSelectors)
          ? candidateSelectors.filter((value: unknown): value is string => typeof value === 'string' && value.trim().length > 0)
          : [];

        // Keywords ordinate per SPECIFICITÀ (più specifiche prima!)
        const keywords = scenario === 'reject' 
          ? [
              'rifiuta tutti',
              'rifiuta tutto', 
              'decline all',
              'reject all',
              'solo necessari',
              'only necessary',
              'rifiuta',
              'decline', 
              'reject',
              'deny',
              'rifiuto',
              'nega'
            ]
          : [
              'accetta tutti',
              'accetta tutto',
              'accept all',
              'allow all',
              'accetta',
              'accept',
              'consenti',
              'consent',
              'conferma',
              'allow',
              'agree'
            ];

        const scope = document.querySelector(bannerSelector);

        // 1. Tentativo diretto con i selettori suggeriti dall'LLM
        for (const selector of resolvedCandidates) {
          let elements: Element[] = [];

          try {
            elements = Array.from(document.querySelectorAll(selector));
          } catch (error) {
            console.warn('[LLM selector] Invalid selector:', selector, error);
          }

          if (scope) {
            try {
              elements = elements.concat(Array.from(scope.querySelectorAll(selector)));
            } catch (error) {
              console.warn('[LLM selector] Invalid scoped selector:', selector, error);
            }
          }

          for (const element of elements) {
            const el = element as HTMLElement;
            if (!el) continue;
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            const isVisible = rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
            if (!isVisible) continue;

            el.click();
            const text = (el.textContent || el.getAttribute('aria-label') || '').trim();
            return { success: true, reason: 'candidate_selector', buttonText: text, keyword: selector };
          }
        }

        if (!scope) return { success: false, reason: 'Banner selector not found', buttonText: null };
        
        // Cerca tutti i pulsanti/interazioni nel banner
        const elements = Array.from(scope.querySelectorAll('button, a, [role="button"], input, .btn, [onclick]'));
        
        for (const btn of elements) {
          const text = (btn.textContent || '').toLowerCase().trim();
          const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase().trim();
          const combinedText = `${text} ${ariaLabel}`;
          
          // Salta elementi con numeri grandi (probabilmente badge/counter come "necessari 323")
          if (/\d{2,}/.test(text)) continue;
              
              for (const keyword of keywords) {
                if (combinedText.includes(keyword.toLowerCase())) {
                  (btn as HTMLElement).click();
                  return { success: true, reason: 'clicked', buttonText: text, keyword: keyword };
                }
              }
        }
        
        return { success: false, reason: 'No matching button found', buttonText: null };
      }, { scenario, bannerSelector, candidateSelectors });

      console.log(`🎯 Click result:`, JSON.stringify(clickResult));

      if (!clickResult || !clickResult.success) {
        console.log(`❌ Click ${scenario} fallito: ${clickResult?.reason || 'unknown'}`);
        return false;
      }
      
      console.log(`✅ Cliccato su bottone: "${clickResult.buttonText}" (keyword: ${clickResult.keyword})`);

      // 3. ✨ ASPETTA che il dataLayer riceva eventi di consent (EVENT-DRIVEN)
      if (scenario === 'reject' || scenario === 'accept') {
        console.log(`🤖 Aspettando consent update dopo click ${scenario}...`);
        console.log(`🤖 Aspetto nuovi eventi oltre i ${beforeClick.dataLayerLength} già presenti...`);
        
        const consentDetected = await page.waitForFunction(
          (beforeLength) => {
            const dataLayer = (window as any).dataLayer || [];
            
            console.log(`[waitForFunction] dataLayer.length = ${dataLayer.length}, beforeLength = ${beforeLength}`);
            
            // 1. Check se ci sono nuovi eventi
            if (dataLayer.length <= beforeLength) {
              console.log(`[waitForFunction] Nessun nuovo evento ancora`);
              return false;
            }
            
            // 2. Check se c'è un consent update negli ultimi eventi
            const recentEvents = dataLayer.slice(beforeLength);
            console.log(`[waitForFunction] Nuovi eventi trovati: ${recentEvents.length}`);
            console.log(`[waitForFunction] Nuovi eventi:`, JSON.stringify(recentEvents));
            
            const hasConsent = recentEvents.some((event: any) => {
              // Pattern 1: Array ['consent', 'update', {...}]
              if (Array.isArray(event) && event[0] === 'consent') {
                console.log(`[waitForFunction] ✅ Trovato Pattern 1 (Array)`);
                return true;
              }
              // Pattern 2: Object {0: 'consent', 1: 'update', ...}
              if (event && event[0] === 'consent') {
                console.log(`[waitForFunction] ✅ Trovato Pattern 2 (Object con chiave 0)`);
                return true;
              }
              // Pattern 3: Event name cookie_consent_update
              if (event?.event === 'cookie_consent_update') {
                console.log(`[waitForFunction] ✅ Trovato Pattern 3 (event name)`);
                return true;
              }
              return false;
            });
            
            console.log(`[waitForFunction] hasConsent = ${hasConsent}`);
            return hasConsent;
          },
          beforeClick.dataLayerLength,
          { 
            timeout: 15000,  // Max 15s
            polling: 200     // Check ogni 200ms
          }
        ).then(() => true).catch(() => false);

        if (!consentDetected) {
          console.log(`⚠️ Nessun consent update rilevato entro 15s`);
          console.log(`⚠️ DataLayer finale per debug:`);
          const finalDataLayer = await page.evaluate(() => (window as any).dataLayer || []);
          console.log(JSON.stringify(finalDataLayer, null, 2));
        } else {
          console.log(`✅ Consent update rilevato!`);
        }

        // 4. Stabilizzazione BREVE (solo 3s per eventi aggiuntivi)
        console.log(`🤖 PASSO 3: Stabilizzazione 3 secondi...`);
        await page.waitForTimeout(3000);

        // 5. ADESSO leggi il dataLayer
        console.log('🤖 PASSO 3: Acquisisco dataLayer...');
        const dataLayer = await page.evaluate(() => {
          return (window as any).dataLayer || [];
        });
        
        console.log('🤖 PASSO 3: DataLayer acquisito, lunghezza:', dataLayer.length);
        
        // 6. Verifica con LLM
        if (this.llmService) {
          console.log('🤖 PASSO 3: Chiedendo all\'LLM se il test è passato...');
          console.log('🤖 PASSO 3: DataLayer da analizzare:', JSON.stringify(dataLayer, null, 2));
          
          if (scenario === 'reject') {
            const testResult = await this.verifyRejectTestWithLLM(dataLayer);
            this.llmTestResult = testResult;
            console.log('🤖 PASSO 3: Risultato test LLM (reject):', testResult);
          } else if (scenario === 'accept') {
            const testResult = await this.verifyAcceptTestWithLLM(dataLayer);
            this.llmTestResult = testResult;
            console.log('🤖 PASSO 3: Risultato test LLM (accept):', testResult);
          }
        }
      }

      return clickResult;

    } catch (error) {
      console.log(`❌ Errore click ${scenario}:`, (error as Error).message);
      return false;
    }
  }

  private async performFallbackConsentAction(page: Page, scenario: 'reject' | 'accept'): Promise<boolean> {
    try {
      // 1. Snapshot PRIMA del click - usa dataLayer nativo (più affidabile)
      const beforeClick = await page.evaluate(() => {
        const dataLayer = (window as any).dataLayer || [];
        return {
          timestamp: Date.now(),
          dataLayerLength: dataLayer.length
        };
      });

      console.log(`📊 BEFORE fallback click ${scenario}: ${beforeClick.dataLayerLength} eventi dataLayer`);

      const selectors = scenario === 'accept' ? 
        this.getAllAcceptSelectors() : 
        this.getAllRejectSelectors();

      let clickSuccess = false;

      // 2. Prova selettori specifici
      for (const selector of selectors) {
        try {
          const element = await page.$(selector);
          if (element && await element.isVisible()) {
            console.log(`🎯 Clicking ${scenario} with selector: ${selector}`);
            await element.click();
            clickSuccess = true;
            break;
          }
        } catch (error) {
          console.log(`❌ Failed click ${scenario} selector ${selector}:`, (error as Error).message);
        }
      }
      
      // 3. Ultimo fallback: match text su tutti i button della pagina
      if (!clickSuccess) {
        clickSuccess = await page.evaluate((scenario) => {
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
      }

      if (!clickSuccess) {
        console.log(`❌ Fallback click ${scenario} fallito`);
        return false;
      }

      // 4. ✨ ASPETTA che il dataLayer riceva eventi di consent (EVENT-DRIVEN)
      if (scenario === 'reject' || scenario === 'accept') {
        console.log(`🤖 Aspettando consent update dopo fallback click ${scenario}...`);
        
        const consentDetected = await page.waitForFunction(
          (beforeLength) => {
            const dataLayer = (window as any).dataLayer || [];
            
            // 1. Check se ci sono nuovi eventi
            if (dataLayer.length <= beforeLength) return false;
            
            // 2. Check se c'è un consent update negli ultimi eventi
            const recentEvents = dataLayer.slice(beforeLength);
            const hasConsent = recentEvents.some((event: any) => {
              // Pattern 1: Array ['consent', 'update', {...}]
              if (Array.isArray(event) && event[0] === 'consent') return true;
              // Pattern 2: Object {0: 'consent', 1: 'update', ...}
              if (event && event[0] === 'consent') return true;
              // Pattern 3: Event name cookie_consent_update
              if (event?.event === 'cookie_consent_update') return true;
              return false;
            });
            
            return hasConsent;
          },
          beforeClick.dataLayerLength,
          { 
            timeout: 15000,  // Max 15s
            polling: 200     // Check ogni 200ms
          }
        ).then(() => true).catch(() => false);

        if (!consentDetected) {
          console.log(`⚠️ Nessun consent update rilevato entro 15s (fallback)`);
        } else {
          console.log(`✅ Consent update rilevato! (fallback)`);
        }

        // 5. Stabilizzazione BREVE
        console.log(`🤖 PASSO 3: Stabilizzazione 3 secondi...`);
        await page.waitForTimeout(3000);

        // 6. Leggi il dataLayer
        console.log('🤖 PASSO 3: Acquisisco dataLayer...');
        const dataLayer = await page.evaluate(() => {
          return (window as any).dataLayer || [];
        });
        
        console.log('🤖 PASSO 3: DataLayer acquisito, lunghezza:', dataLayer.length);
        
        // 7. Verifica con LLM
        if (this.llmService) {
          console.log('🤖 PASSO 3: Chiedendo all\'LLM se il test è passato...');
          console.log('🤖 PASSO 3: DataLayer da analizzare:', JSON.stringify(dataLayer, null, 2));
          
          if (scenario === 'reject') {
            const testResult = await this.verifyRejectTestWithLLM(dataLayer);
            this.llmTestResult = testResult;
            console.log('🤖 PASSO 3: Risultato test LLM (reject):', testResult);
          } else if (scenario === 'accept') {
            const testResult = await this.verifyAcceptTestWithLLM(dataLayer);
            this.llmTestResult = testResult;
            console.log('🤖 PASSO 3: Risultato test LLM (accept):', testResult);
          }
        }
      }

      return clickSuccess;
    } catch (error) {
      console.log(`❌ Fallback ${scenario} failed:`, (error as Error).message);
      return false;
    }
  }

  private async verifyRejectTestWithLLM(dataLayer: any[]): Promise<boolean> {
    if (!this.llmService) {
      console.log('🤖 LLM service non disponibile per verifica test');
      return false;
    }

    try {
      console.log('🤖 Verifico test reject con LLM...');
      const prompt = `Ho appena cliccato su "reject all" su un cookie banner e questo è il dataLayer risultante:

${JSON.stringify(dataLayer, null, 2)}

DOMANDA: I consensi sono stati rifiutati correttamente? 

IMPORTANTE: 
- Se vedi consensi "granted" per analytics_storage e security_storage, è NORMALE e il test deve essere considerato PASSATO
- Rispondi solo "SI" o "NO"`;

      console.log('🤖 RICHIESTA LLM (verifica test reject):');
      console.log('🤖 Prompt:', prompt);
      
      // Per la verifica test, uso direttamente l'API OpenAI invece del metodo resolveBannerSelectors
      const openaiResponse = await this.llmService['openai'].chat.completions.create({
        model: this.llmService['model'],
        temperature: 0.1,
        messages: [
          { role: 'user', content: prompt },
        ],
        max_tokens: 10,
      });
      
      const content = openaiResponse.choices[0]?.message?.content;
      console.log('🤖 RISPOSTA LLM (verifica test reject):');
      console.log('🤖 Response:', content);
      
      if (content) {
        const result = content.toLowerCase().trim();
        return result === 'si' || result === 'yes';
        }
        
        return false;
    } catch (error) {
      console.error('❌ Errore verifica test LLM:', error);
      return false;
    }
  }

  private async verifyAcceptTestWithLLM(dataLayer: any[]): Promise<boolean> {
    if (!this.llmService) {
      console.log('🤖 LLM service non disponibile per verifica test');
        return false;
    }
    
    try {
      console.log('🤖 Verifico test accept con LLM...');
      const prompt = `Ho appena cliccato su "accept all" su un cookie banner e questo è il dataLayer risultante:

${JSON.stringify(dataLayer, null, 2)}

DOMANDA: I consensi sono stati accettati correttamente? 

IMPORTANTE: 
- Per un test "accept all" PASSATO, dovresti vedere la maggior parte dei consensi su "granted"
- Se vedi ad_storage, analytics_storage, functionality_storage, personalization_storage su "granted", il test è PASSATO
- Rispondi solo "SI" o "NO"`;

      console.log('🤖 RICHIESTA LLM (verifica test accept):');
      console.log('🤖 Prompt:', prompt);
      
      // Per la verifica test, uso direttamente l'API OpenAI invece del metodo resolveBannerSelectors
      const openaiResponse = await this.llmService['openai'].chat.completions.create({
        model: this.llmService['model'],
        temperature: 0.1,
        messages: [
          { role: 'user', content: prompt },
        ],
        max_tokens: 10,
      });
      
      const content = openaiResponse.choices[0]?.message?.content;
      console.log('🤖 RISPOSTA LLM (verifica test accept):');
      console.log('🤖 Response:', content);
      
      if (content) {
        const result = content.toLowerCase().trim();
        return result === 'si' || result === 'yes';
      }

      return false;
    } catch (error) {
      console.error('❌ Errore verifica test LLM:', error);
      return false;
    }
  }

  private async getLatestConsentState(page: Page): Promise<ScenarioResult['latestConsent']> {
    return await page.evaluate(() => {
      const w = window as any;
      
      // Cerca nel dataLayer principale (dove sono effettivamente i dati)
      const dataLayer = w.dataLayer || [];
      let latestConsent: any = {};

      console.log('🔍 getLatestConsentState - DataLayer length:', dataLayer.length);
      console.log('🔍 getLatestConsentState - DataLayer content:', JSON.stringify(dataLayer, null, 2));

      // Cerca l'ultimo evento di consent update nel dataLayer
      for (let i = dataLayer.length - 1; i >= 0; i--) {
        const event = dataLayer[i];
        console.log(`🔍 Checking event ${i}:`, event);
        
        // ✅ FIX: Cerca oggetti con indici numerici (formato GTM)
        if (typeof event === 'object' && event !== null && !Array.isArray(event)) {
          // Pattern GTM: { "0": "consent", "1": "update", "2": {...} }
          if (event["0"] === 'consent' && event["1"] === 'update' && typeof event["2"] === 'object') {
            latestConsent = { ...event["2"] };
            console.log('🔍 Found consent update in GTM numeric indices format:', latestConsent);
            break;
          }
        }
        
        // Cerca array con ['consent', 'update', {...}]
        if (Array.isArray(event) && event.length >= 3) {
          console.log(`🔍 Array event found: [${event[0]}, ${event[1]}, ...]`);
          if (event[0] === 'consent' && event[1] === 'update' && typeof event[2] === 'object') {
            latestConsent = { ...event[2] };
            console.log('🔍 Found consent update in array:', latestConsent);
            break;
          }
        }
        
        // Cerca oggetti con event gtm_consent_update
        if (typeof event === 'object' && event.event === 'gtm_consent_update') {
          console.log('🔍 gtm_consent_update event found');
          if (event.value && typeof event.value === 'object') {
            latestConsent = { ...event.value };
            console.log('🔍 Found gtm_consent_update event:', latestConsent);
            break;
          }
        }
        
        // Cerca oggetti con campi consent diretti nel campo value
        if (typeof event === 'object' && event.value && event.value.ad_storage !== undefined) {
          console.log('🔍 Direct consent in value field found');
          latestConsent = { ...event.value };
          console.log('🔍 Found direct consent in value:', latestConsent);
          break;
        }
        
        // NUOVO: Cerca anche oggetti con campi consent diretti (senza campo value)
        if (typeof event === 'object' && event.ad_storage !== undefined) {
          console.log('🔍 Direct consent fields found');
          latestConsent = {
            ad_user_data: event.ad_user_data,
            ad_personalization: event.ad_personalization,
            ad_storage: event.ad_storage,
            analytics_storage: event.analytics_storage,
            functionality_storage: event.functionality_storage,
            security_storage: event.security_storage
          };
          console.log('🔍 Found direct consent fields:', latestConsent);
          break;
        }
      }

      const result = {
        ad_user_data: latestConsent.ad_user_data || 'n/d',
        ad_personalization: latestConsent.ad_personalization || 'n/d',
        ad_storage: latestConsent.ad_storage || 'n/d',
        analytics_storage: latestConsent.analytics_storage || 'n/d',
        functionality_storage: latestConsent.functionality_storage || 'n/d',
        security_storage: latestConsent.security_storage || 'n/d'
      };

      console.log('🔍 getLatestConsentState - Final result:', result);
      return result;
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
    const dataLayer = await page.evaluate(() => (window as any).dataLayer || []);
    console.log(`🔍 DEBUG getDataLayerEvents: Found ${dataLayer.length} dataLayer events`);
    if (dataLayer.length > 0) {
      console.log(`🔍 DEBUG getDataLayerEvents: First few events:`, JSON.stringify(dataLayer.slice(0, 3), null, 2));
    }
    return dataLayer;
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
      
      // Prima prova a trovare un cookie banner specifico nello schermo
      const bannerElement = await this.findCookieBannerElement(page);
      
      if (bannerElement) {
        // Screenshot solo dell'area del cookie banner con padding
        const boundingBox = await bannerElement.boundingBox();
        if (boundingBox) {
          // Aggiungi padding per catturare meglio il banner
          const padding = 20;
          const screenshotArea = {
            x: Math.max(0, boundingBox.x - padding),
            y: Math.max(0, boundingBox.y - padding),
            width: boundingBox.width + (padding * 2),
            height: boundingBox.height + (padding * 2)
          };
          
          await page.screenshot({ 
            path: filename, 
            clip: screenshotArea 
          });
          console.log('✅ Cookie banner screenshot catturato con padding');
        } else {
          // Fallback: screenshot dell'elemento senza bounding box
          await bannerElement.screenshot({ path: filename });
          console.log('✅ Cookie banner screenshot catturato (senza padding)');
        }
      } else {
        // Fallback: screenshot dell'intera pagina
        await page.screenshot({ path: filename, fullPage: true });
        console.log('⚠️ Banner non trovato, screenshot full page catturato');
      }
      
      return filename;
    } catch (error) {
      console.error('❌ Errore durante screenshot:', error);
      return undefined; 
    }
  }

  /**
   * 📸 NUOVO: Cattura screenshot del cookie banner ORIGINALE (prima dei test)
   * Questo screenshot viene mostrato nella sezione "Screenshot Cookie Banner" del frontend
   */
  private async captureCookieBannerScreenshot(page: Page, input: ConsentTestInput): Promise<string | undefined> {
    try {
      if (!input.options.captureScreens) return undefined;
      
      const runId = Date.now().toString();
      const artifactPath = `./artifacts/${runId}/`;
      await fs.mkdir(artifactPath, { recursive: true }); 
      
      const filename = `${artifactPath}cookie-banner-original.png`;
      
      // Cerca il cookie banner (deve essere visibile a questo punto)
      const bannerElement = await this.findCookieBannerElement(page);
      
      if (bannerElement) {
        // Screenshot solo dell'area del cookie banner con padding
        const boundingBox = await bannerElement.boundingBox();
        if (boundingBox) {
          // Aggiungi padding per catturare meglio il banner
          const padding = 30; // Più padding per il banner originale
          const screenshotArea = {
            x: Math.max(0, boundingBox.x - padding),
            y: Math.max(0, boundingBox.y - padding),
            width: boundingBox.width + (padding * 2),
            height: boundingBox.height + (padding * 2)
          };
          
          await page.screenshot({ 
            path: filename, 
            clip: screenshotArea 
          });
          console.log('📸 Cookie banner originale catturato con padding');
        } else {
          // Fallback: screenshot dell'elemento senza bounding box
          await bannerElement.screenshot({ path: filename });
          console.log('📸 Cookie banner originale catturato (senza padding)');
        }
      } else {
        // Fallback: screenshot dell'intera pagina
        await page.screenshot({ path: filename, fullPage: true });
        console.log('⚠️ Banner originale non trovato, screenshot full page catturato');
      }
      
      return filename;
    } catch (error) {
      console.error('❌ Errore durante cattura banner originale:', error);
      return undefined; 
    }
  }

  private async findCookieBannerElement(page: Page): Promise<ElementHandle<Element> | null> {
    try {
      // Lista selettori specifici per CMP comuni (priorità alta)
      const specificSelectors = [
        '#onetrust-consent-sdk',
        '#CybotCookiebotDialog',
        '.iubenda-cs-banner',
        '.didomi-popup',
        '.uc-banner',
        '[id*="onetrust"]',
        '[id*="cookiebot"]',
        '[id*="iubenda"]'
      ];

      // Prova prima i selettori specifici
      for (const selector of specificSelectors) {
        const element = await page.$(selector);
        if (element) {
          const isVisible = await element.isVisible();
          const boundingBox = await element.boundingBox();
          
          if (isVisible && boundingBox && boundingBox.height > 0 && boundingBox.width > 0) {
            console.log(`✅ Banner CMP trovato con selettore specifico: ${selector}`);
            return element;
          }
        }
      }

      // Lista selettori generici per cookie banner (priorità media)
      const genericSelectors = [
        'div[role="dialog"]',
        '[class*="cookie"]',
        '[id*="cookie"]',
        '[class*="banner"]',
        '[id*="banner"]',
        '[class*="consent"]',
        '[id*="consent"]',
        '[class*="gdpr"]',
        '[id*="gdpr"]',
        '.cookie-notice',
        '.cookie-banner',
        '.consent-banner',
        '#cookie-notice',
        '#cookie-banner',
        '#consent-banner',
        '[data-cookie-policy]',
        '[data-gdpr-notice]'
      ];

      for (const selector of genericSelectors) {
        const element = await page.$(selector);
        if (element) {
          const isVisible = await element.isVisible();
          const boundingBox = await element.boundingBox();
          
          if (isVisible && boundingBox && boundingBox.height > 0 && boundingBox.width > 0) {
            // Controlliamo se contiene testo legato a cookie/consenso
            const text = await element.textContent();
            const cookieKeywords = [
              'cookie', 'consent', 'accetta', 'rifiuta', 'preferences', 'settings', 
              'agree', 'disagree', 'accept', 'reject', 'decline', 'allow', 'deny',
              'privacy', 'gdpr', 'cookies', 'consenso', 'privacy policy'
            ];
            
            if (text && cookieKeywords.some(keyword => 
              text.toLowerCase().includes(keyword.toLowerCase())
            )) {
              console.log(`✅ Banner generico trovato con selettore: ${selector}`);
              return element;
            }
          }
        }
      }
      
      // Fallback: cerca elementi con testo cookie (priorità bassa)
      const candidates = await page.$$('div, section, aside, dialog');
      for (const element of candidates.slice(0, 30)) { // Limita ricerca ai primi 30 elementi
        try {
          const text = await element.textContent();
          const className = await element.evaluate(el => el.className || '');
          const id = await element.evaluate(el => el.id || '');
          
          if (text && text.length > 10 && text.length < 500) { // Testo di lunghezza ragionevole
            const cookieKeywords = [
              'cookie', 'consent', 'accetta', 'rifiuta', 'privacy', 'gdpr',
              'accept', 'reject', 'decline', 'allow', 'deny', 'agree', 'disagree'
            ];
            
            const hasCookieText = cookieKeywords.some(keyword => 
              text.toLowerCase().includes(keyword.toLowerCase())
            );
            
            const hasCookieClass = className.toLowerCase().includes('cookie') || 
                                 className.toLowerCase().includes('consent') ||
                                 className.toLowerCase().includes('banner');
            
            const hasCookieId = id.toLowerCase().includes('cookie') || 
                              id.toLowerCase().includes('consent') ||
                              id.toLowerCase().includes('banner');
            
            if (hasCookieText || hasCookieClass || hasCookieId) {
              const isVisible = await element.isVisible();
              const boundingBox = await element.boundingBox();
              
              if (isVisible && boundingBox && boundingBox.height > 50 && boundingBox.width > 100) {
                console.log(`✅ Banner trovato tramite analisi testo/classe: ${text.substring(0, 50)}...`);
                return element;
              }
            }
          }
        } catch {
          // Ignora errori sui singoli elementi
          continue;
        }
      }
      
      console.log('⚠️ Nessun cookie banner trovato con i selettori disponibili');
      return null;
    } catch (error) {
      console.error('❌ Errore durante ricerca banner:', error);
      return null;
    }
  }

  private evaluateResults(results: { reject: ScenarioResult; accept: ScenarioResult; [key: string]: ScenarioResult }): ConsentTestResult['summary'] {
    const notes: string[] = [];
    let pass = true;

    // Controlli di sicurezza preliminari
    if (!results.reject || !results.accept) {
      notes.push('ERRORE: Risultati incompleti - uno o entrambi gli scenari sono falliti');
      return { pass: false, notes };
    }

    // ========================================
    // NUOVO: Usa i risultati LLM come priorità
    // ========================================
    
    // 1. Valuta scenario REJECT con LLM
    if (results.reject.llmTestResult !== undefined && results.reject.llmTestResult !== null) {
      // Usa il risultato LLM per REJECT
      if (!results.reject.llmTestResult) {
        notes.push('REJECT: ❌ Il test LLM ha rilevato che i consensi non sono stati rifiutati correttamente');
        pass = false;
      } else {
        notes.push('REJECT: ✅ Il test LLM ha confermato che i consensi sono stati rifiutati correttamente');
      }
    } else {
      // Fallback alla logica vecchia se LLM non disponibile
      const rejectCookies = results.reject.cookies?.length || 0;
      const rejectRequests = results.reject.gaAdsRequests?.length || 0;
      const rejectConsent = results.reject.latestConsent || {};
      
      if (rejectCookies > 0) {
        notes.push(`REJECT: 🍪 Rilevati ${rejectCookies} cookie sensibili (dovrebbero essere 0)`);
        pass = false;
      }
      
      if (rejectRequests > 0) {
        notes.push(`REJECT: 🎯 Trovate ${rejectRequests} richieste GA/Ads (dovrebbero essere 0)`);
        pass = false;
      }

      const rejectHasGranted = Object.values(rejectConsent).some(value => value === 'granted');
      if (rejectHasGranted) {
        notes.push(`REJECT: ⚠️ Rilevati consensi "granted" nel Consent Mode (dovrebbero essere tutti "denied")`);
        pass = false;
      }
    }

    // 2. Valuta scenario ACCEPT con LLM
    if (results.accept.llmTestResult !== undefined && results.accept.llmTestResult !== null) {
      // Usa il risultato LLM per ACCEPT
      if (!results.accept.llmTestResult) {
        notes.push('ACCEPT: ❌ Il test LLM ha rilevato che i consensi non sono stati accettati correttamente');
        pass = false;
      } else {
        notes.push('ACCEPT: ✅ Il test LLM ha confermato che i consensi sono stati accettati correttamente');
      }
    } else {
      // Fallback alla logica vecchia se LLM non disponibile
      const acceptConsent = results.accept.latestConsent || {};
      const hasGrantedConsent = Object.values(acceptConsent).some(value => value === 'granted');
      const acceptRequests = results.accept.gaAdsRequests?.length || 0;
      const acceptCookies = results.accept.cookies?.length || 0;

      if (!hasGrantedConsent) {
        notes.push('ACCEPT: ⚠️ Nessun consenso "granted" rilevato dal Consent Mode');
        pass = false;
      }

      if (acceptRequests === 0 && acceptCookies === 0) {
        notes.push('ACCEPT: ⚠️ Nessuna attività tracking (potrebbe essere normale se il sito non usa GA/Ads)');
      }
    }

    // ========================================
    // 3. Valuta scenari CUSTOM (se presenti)
    // ========================================
    const customScenarios = Object.keys(results).filter(key => key.startsWith('custom-'));
    
    if (customScenarios.length > 0) {
      console.log(`🎯 Evaluating ${customScenarios.length} custom scenarios...`);
      
      for (const scenarioKey of customScenarios) {
        const scenarioResult = results[scenarioKey];
        const selectedCategories = scenarioResult.selectedCategories;
        
        if (!selectedCategories) {
          notes.push(`CUSTOM [${scenarioKey}]: ⚠️ Nessuna categoria selezionata rilevata`);
          continue;
        }

        const consent = scenarioResult.latestConsent || {};
        const scenarioNotes: string[] = [];
        let scenarioPass = true;

        // Valida ANALYTICS
        if (selectedCategories.analytics === true) {
          if (consent.analytics_storage !== 'granted') {
            scenarioNotes.push(`analytics_storage dovrebbe essere "granted" ma è "${consent.analytics_storage}"`);
            scenarioPass = false;
          }
        } else if (selectedCategories.analytics === false) {
          if (consent.analytics_storage === 'granted') {
            scenarioNotes.push(`analytics_storage dovrebbe essere "denied" ma è "granted"`);
            scenarioPass = false;
          }
        }

        // Valida MARKETING
        if (selectedCategories.marketing === true) {
          // Marketing richiede tutti i parametri ad_* granted
          const marketingParams = ['ad_storage', 'ad_personalization', 'ad_user_data'];
          for (const param of marketingParams) {
            if (consent[param as keyof typeof consent] !== 'granted') {
              scenarioNotes.push(`${param} dovrebbe essere "granted" ma è "${consent[param as keyof typeof consent]}"`);
              scenarioPass = false;
            }
          }
        } else if (selectedCategories.marketing === false) {
          // Marketing disabilitato richiede tutti i parametri ad_* denied
          const marketingParams = ['ad_storage', 'ad_personalization', 'ad_user_data'];
          for (const param of marketingParams) {
            if (consent[param as keyof typeof consent] === 'granted') {
              scenarioNotes.push(`${param} dovrebbe essere "denied" ma è "granted"`);
              scenarioPass = false;
            }
          }
        }

        // Valida PREFERENCES (opzionale, solitamente sempre granted)
        // Le preferences sono cookie tecnici necessari, quindi non causano fail
        
        // Aggiungi note per questo scenario custom
        if (scenarioPass) {
          notes.push(`CUSTOM [${this.formatCustomScenarioName(selectedCategories)}]: ✅ Validazione superata`);
        } else {
          pass = false;
          notes.push(`CUSTOM [${this.formatCustomScenarioName(selectedCategories)}]: ❌ ${scenarioNotes.join(', ')}`);
        }

        // Verifica anche cookies e richieste per coerenza
        const customCookies = scenarioResult.cookies?.length || 0;
        const customRequests = scenarioResult.gaAdsRequests?.length || 0;

        // Se marketing è disabled, non dovrebbero esserci richieste ads
        if (selectedCategories.marketing === false && customRequests > 0) {
          notes.push(`CUSTOM [${this.formatCustomScenarioName(selectedCategories)}]: ⚠️ Marketing disabilitato ma rilevate ${customRequests} richieste GA/Ads`);
        }
      }
    }

    // ========================================
    // 4. Messaggio finale
    // ========================================
    if (notes.length === 0) {
      notes.push('✅ Test completato con successo - nessun problema rilevato');
    }

    return { pass, notes };
  }

  /**
   * Formatta il nome dello scenario custom per i messaggi
   */
  private formatCustomScenarioName(categories: { analytics?: boolean; marketing?: boolean; preferences?: boolean }): string {
    const parts: string[] = [];
    if (categories.analytics !== undefined) parts.push(`Analytics:${categories.analytics ? 'ON' : 'OFF'}`);
    if (categories.marketing !== undefined) parts.push(`Marketing:${categories.marketing ? 'ON' : 'OFF'}`);
    if (categories.preferences !== undefined) parts.push(`Preferences:${categories.preferences ? 'ON' : 'OFF'}`);
    return parts.join(', ');
  }

  // Implementazione scenario custom
  private async handleCustomScenario(page: Page, scenario: ScenarioMode, bannerSelector: string): Promise<boolean> {
    if (scenario === 'accept' || scenario === 'reject') {
      return this.performConsentAction(page, scenario, bannerSelector);
    }

    const prefs = scenario.custom;
    const startTime = Date.now();
    console.log(`🛠️ Handling custom scenario with preferences:`, prefs);

    // Start network guard for marketing validation (finestra limitata)
    const expected = { analytics: !!prefs.analytics, statistics: !!prefs.analytics, marketing: !!prefs.marketing, preferences: !!prefs.preferences };
    const guard = startNetworkGuardForWindow(page, { disallowMarketing: expected.marketing === false, windowMs: 9000 });

    try {
      // 1) Click "Personalizza" se visibile
      const personalizeBtn = page.getByRole('button', { name: /personalizza|impostazioni|gestisci|mostra dettagli/i }).first();
      if (await personalizeBtn.isVisible().catch(() => false)) {
        await personalizeBtn.click({ force: true });
        console.log('✅ Clicked personalize');
      }

      // Piccola attesa per transizione
      await page.waitForTimeout(200);

      // 2) Timeout ridotti solo nel dialog
      const prevActionTimeout = 30000; // Default Playwright timeout
      page.setDefaultTimeout(3500);

      // 3) Apri sezione "Dettagli" se necessario
      await openCookiebotDetails(page);

      // 4) Trova lo scope (main o iframe)
      const detailsScope = await this.getCookiebotDetailsScope(page);

      // 5) Attendi toggle visibili
      await waitCookiebotToggles(detailsScope);

      // 6) Mappa analytics → statistics e toggla
      await this.toggleCookiebotCheckbox(detailsScope, 'CybotCookiebotDialogBodyLevelButtonStatistics', !!prefs.analytics, 'analytics');
      await this.toggleCookiebotCheckbox(detailsScope, 'CybotCookiebotDialogBodyLevelButtonMarketing', !!prefs.marketing, 'marketing');
      await this.toggleCookiebotCheckbox(detailsScope, 'CybotCookiebotDialogBodyLevelButtonPreferences', !!prefs.preferences, 'preferences');

      // 7) Recompute banner root after changes and click commit button
      const banner = await findCookieBannerRoot(page);
      if (!banner) throw new Error('Cookie banner root non trovato (post-Personalizza)');

      const committed = await clickCommitOnBanner(banner, page);
      if (!committed) throw new Error('Nessun pulsante di commit idoneo nel banner');

      // Log commit button clicked (robusto con aria-label/title/id fallback)
      const commitNode = await page.evaluateHandle(() => document.activeElement || null);
      const commitLabel = await commitNode.evaluate((n: any) => {
        const el = n as HTMLElement;
        return el ? (el.getAttribute('aria-label') || el.getAttribute('title') || el.innerText || el.id || '').trim() : '';
      });
      console.log(`✅ Commit cliccato: "${commitLabel || '(no-label)'}"`);

      // 8) Race di segnali post-commit (no sleep fissi)
      const expected = {
        statistics: !!prefs.analytics,
        marketing: !!prefs.marketing,
        preferences: !!prefs.preferences,
      };
      await waitConsentSettled(page, expected, 3500);

      // Ripristina timeout
      page.setDefaultTimeout(prevActionTimeout);

      // 9) Stop network guard (validazione già fatta in waitConsentSettled)
      await guard.stop();

      const duration = Date.now() - startTime;
      console.log(`⏱️ Custom scenario completed in ${duration}ms`);
      return true;

    } catch (e) {
      await guard.stop().catch(() => {}); // Cleanup guard on error
      console.error('Exception in handleCustomScenario():', e);
      return false;
    }
  }

  private async clickPersonalizeButton(page: Page): Promise<{clicked: boolean; error?: string; cmpDetected?: string}> {
    // Search CMPs configuration
    const possibleCmps = Object.keys(this.config.cmp.selectors);
    
    for (const cmpName of possibleCmps) {
      const cmpConfig = this.config.cmp.selectors[cmpName];
      if (cmpConfig.personalize && cmpConfig.personalize.length > 0) {
        for (const selector of cmpConfig.personalize) {
          try {
            const elem = await page.$(selector);
            if (elem && await elem.isVisible()) {
              await elem.click();
              console.log(`✅ Clicked personalize with CMP selector ${cmpName}: ${selector}`);
              return { clicked: true, cmpDetected: cmpName };
            }
          } catch (err) { 
            // Continue iterating if element not found
          }
        }
      }
    }
    
    // Fallback: text-based matching
    if (this.config.cmp.fallback.personalize) {
      for (const keyword of this.config.cmp.fallback.personalize) {
        const result = await page.evaluate((k) => {
          const buttons = Array.from(document.querySelectorAll('button, .btn, [role="button"], a'));
          for (const btn of buttons) {
            const text = (btn.textContent || '').toLowerCase().trim();
            if (text.includes(k.toLowerCase())) {
              (btn as HTMLElement).click();
              return true;
            }
          }
          return false;
        }, keyword);
        
        if (result) {
          console.log(`✅ Fallback clicked personaliza button: "${keyword}"`);
          return { clicked: true, cmpDetected: 'generic' };
        }
      }
    }
    
    return { clicked: false, error: 'No personalize button found via configuration/fallback' };
  }

  async applyCustomPreferences(page: Page, prefs: {analytics?: boolean; marketing?: boolean; preferences?: boolean}, cmpName?: string): Promise<string[]> {
    const missingToggles: string[] = [];
    
    // For each category, scan field and toggle it
    const categories = [
      { key: 'analytics', value: prefs.analytics },
      { key: 'marketing', value: prefs.marketing },
      { key: 'preferences', value: prefs.preferences }
    ];
    
    for (const cat of categories) {
      if (cat.value === undefined) continue;
      
      const toggleSuccess = await this.toggleSwitchField(page, cat.key as 'marketing' | 'preferences' | 'analytics', cat.value, cmpName);
      if (!toggleSuccess) missingToggles.push(cat.key);
      console.log(`⚙️ Toggle ${cat.key}=${cat.value} completed`);
    }
    
    return missingToggles;
  }

  /**
   * ✅ Apre la sezione Dettagli Cookiebot e ritorna sempre page come scope
   * (i toggle vivono nel main DOM dopo l'apertura di "Dettagli")
   */
  private async getCookiebotDetailsScope(page: Page): Promise<Page | Frame> {
    // Prova ad aprire i dettagli (varie lingue/markup) - timeout ridotto
    const cands = [
      '#CybotCookiebotDialogBodyButtonDetails',
      'button:has-text("Dettagli")',
      'button:has-text("Mostra dettagli")',
      'button:has-text("Show details")',
      'a[role="button"]:has-text("Dettagli")',
      '[role="button"]:has-text("Dettagli")',
    ];

    for (const sel of cands) {
      const cand = page.locator(sel).first();
      if (await cand.count()) {
        await cand.scrollIntoViewIfNeeded().catch(() => {});
        await cand.click({ timeout: 1500 }).catch(() => {});
        break;
      }
    }

    // Piccola attesa per transizione
    await page.waitForTimeout(200);
    
    // A questo punto i toggle devono essere nel main DOM
    return page;
  }

  /**
   * ✅ FIX: Trova il frame Cookiebot verificando la presenza di elementi noti,
   * non matchando per URL (che può essere ambiguo)
   */
  private async getCmpScope(page: Page): Promise<Page | any> {
    try {
      const allFrames = page.frames();
      console.log(`🔍 Total frames on page: ${allFrames.length}`);
      
      // Debug: Log tutti gli URL dei frame
      for (const frame of allFrames) {
        console.log(`  📄 Frame URL: ${frame.url()}`);
      }
      
      // 1) Verifica se il banner Cookiebot è nel main document
      const inPage = page.locator('#CybotCookiebotDialog, #CybotCookiebotDialogBody');
      const isInMainPage = await inPage.first().isVisible().catch(() => false);
      
      if (isInMainPage) {
        console.log(`✅ Cookiebot found in main page - using page scope`);
        return page;
      }
      
      // 2) Cerca in tutti i frame figli (ESCLUDI il main frame)
      for (const frame of allFrames) {
        // Scarta il main frame (che non ha parent)
        if (!frame.parentFrame()) {
          console.log(`  ⏭️  Skipping main frame: ${frame.url()}`);
          continue;
        }
        
        // Cerca elementi Cookiebot in questo frame
        const cookiebotRoot = frame.locator('#CybotCookiebotDialog, #CybotCookiebotDialogBody');
        const hasCookiebot = await cookiebotRoot.first().isVisible().catch(() => false);
        
        if (hasCookiebot) {
          console.log(`✅ Cookiebot found in child frame: ${frame.url()}`);
          return frame;
        }
      }
      
      // 3) Fallback: Risali dall'elemento <iframe> più probabile
      console.log(`🔍 Trying iframe element lookup fallback...`);
      const iframeHost = page.locator(
        'iframe[src*="cookiebot" i], iframe[title*="cookie" i], iframe[id*="cookie" i]'
      ).first();
      
      if (await iframeHost.count() > 0) {
        const contentFrame = await iframeHost.contentFrame();
        if (contentFrame) {
          console.log(`✅ Found frame via iframe element: ${(contentFrame as any).url()}`);
          return contentFrame;
        }
      }
      
      console.log(`⚠️ Cookiebot not found in any frame - using page scope as fallback`);
      return page;
      
    } catch (e) {
      console.log(`❌ Error in getCmpScope, falling back to page: ${(e as Error).message}`);
      return page;
    }
  }

  // Set toggle using Locator API only - no problematic evaluate() serialization  
  private async setToggleByLabel(scope: any, label: RegExp, on: boolean, category: string): Promise<boolean> {
    console.log(`🎯 Setting ${category} to ${on ? 'ON' : 'OFF'} with pattern: ${label.source}`);
    
    const row = scope.locator('section, div, li, fieldset').filter({ hasText: label }).first();
    
    if (await row.count() === 0) {
      console.log(`⚠️ No container found for ${category} with pattern: ${label.source}`);
      
      // FALLBACK: Try generic toggle searching
      const fallbackSuccess = await this.setToggleByGenericFallback(scope, category, on);
      if (fallbackSuccess) {
        console.log(`✅ Generic fallback toggle for ${category} completed`);
        return true;
      }
      return false;
    }

    // 1) ARIA role="switch"
    const switchEl = row.getByRole('switch').first();
    if (await switchEl.count() > 0) {
      try {
        const val = await switchEl.getAttribute('aria-checked');
        const isOn = val === 'true';
        if (isOn !== on) {
          await switchEl.click({ force: true });
          console.log(`✅ Toggled ${category} switch to ${on}`);
          return true;
        }
        return true; // Already in desired state
      } catch (e) {
        console.log(`Switch click failed for ${category}:`, (e as Error).message);
      }
    }

    // 2) Checkbox
    const cb = row.locator('input[type=checkbox]').first();
    if (await cb.count() > 0) {
      try {
        const checked = await cb.isChecked();
        if (checked !== on) {
          // ✅ FIX COOKIEBOT: Prova prima a cliccare il checkbox normalmente
          try {
            await cb.click({ force: true, timeout: 2000 });
          console.log(`✅ Toggled ${category} checkbox to ${on}`);
            return true;
          } catch (clickError) {
            // Se il checkbox non è cliccabile, prova a cliccare la label associata
            console.log(`🔄 Checkbox not clickable, trying associated label...`);
            
            const cbId = await cb.getAttribute('id');
            if (cbId) {
              const label = scope.locator(`label[for="${cbId}"]`).first();
              if (await label.count() > 0) {
                await label.click({ force: true });
                console.log(`✅ Toggled ${category} via label[for="${cbId}"]`);
          return true;
              }
            }
            
            // Fallback: cerca label parent
            const parentLabel = cb.locator('xpath=ancestor::label').first();
            if (await parentLabel.count() > 0) {
              await parentLabel.click({ force: true });
              console.log(`✅ Toggled ${category} via parent label`);
              return true;
            }
            
            throw clickError; // Re-throw se nessun fallback funziona
          }
        }
        return true; // Already in desired state
      } catch (e) {
        console.log(`Checkbox click failed for ${category}:`, (e as Error).message);
      }
    }

    // 3) Button with switch/modal role  
    const btn = row.locator('[role="switch"], button[role="switch"]').first();
    if (await btn.count() > 0) {
      try {
        const pressed = await btn.getAttribute('aria-pressed');
        const isOn = pressed === 'true';
        if (isOn !== on) {
          await btn.click({ force: true });
          console.log(`✅ Toggled ${category} button to ${on}`);
          return true;
        }
        return true; // Already in desired state
      } catch (e) {
        console.log(`Button switch click failed for ${category}:`, (e as Error).message);
      }
    }

    console.log(`❌ No toggle found for ${category}`);
    return false;
  }

  // FALLBACK: Generic toggle search when patterns fail
  private async setToggleByGenericFallback(scope: any, category: string, on: boolean): Promise<boolean> {
    try {
      console.log(`🔄 Trying generic fallback for ${category}`);
      
      // Enhanced debug: Capture actual toggle content first
      await this.debugAllToggleElements(scope, category);
      
      // Strategy 1: Direct element scanning in iframe
      try {
        const allPossibleToggles = scope.locator('input, [role="switch"], [data-role="switch"], label + input, .toggle, [data-toggle], .switch, input[type="checkbox"], input[type="radio"]');
        const toggleCount = await allPossibleToggles.count();
        console.log(`🔍 Found ${toggleCount} possible toggle elements in iframe`);
        
        for (let i = 0; i < toggleCount; i++) {
          const toggle = allPossibleToggles.nth(i);
          try {
            // Get text content from surrounding context
            const contextText = await toggle.evaluate((el: any) => {
              return {
                self: el.textContent || '',
                parent: el.parentElement?.textContent || '',
                label: el.closest('label')?.textContent || '',
                previousSibling: el.previousElementSibling?.textContent || '',
                fullContext: el.closest('section, fieldset, div')?.textContent || ''
              };
            });
            
            const allText = `${contextText.self} ${contextText.parent} ${contextText.label} ${contextText.fullContext}`.toLowerCase();
            
            // Enhanced matching
            const isThisCategory = this.enhancedCategoryMatch(allText, category);
            if (isThisCategory) {
              console.log(`🎯 Found potential match for ${category}: "${allText.slice(0, 100)}..."`);
              await toggle.click({ force: true });
              console.log(`✅ Toggled ${category} via enhanced fallback (element ${i})`);
              return true;
            }
          } catch (e) { 
            // Ignore inaccessible elements
          }
        }
      } catch (e) {
        console.log(`❌ Enhanced fallback error for ${category}:`, (e as Error).message);
      }
      
      // Strategy 2: Position-based approach (backup)
      const toggleIndex = { analytics: 0, marketing: 1, preferences: 2 }[category];
      try {
        const simpleSwitches = scope.locator('input[type="checkbox"], [role="switch"]');
        const count = await simpleSwitches.count();
        
        if (count > 0 && typeof toggleIndex === 'number' && toggleIndex < count) {
          const targetToggle = simpleSwitches.nth(toggleIndex);
          if (await targetToggle.count() > 0) {
            await targetToggle.click({ force: true });
            console.log(`✅ Toggled ${category} via position-based fallback (index ${toggleIndex})`);
            return true;
          }
        }
      } catch (e) { 
        console.log(`❌ Position fallback failed:`, (e as Error).message);
      }
      
      return false;
    } catch (e) {
      console.log(`❌ Generic fallback failed for ${category}:`, (e as Error).message);
      return false;
    }
  }

  private async debugAllToggleElements(scope: any, category: string): Promise<void> {
    try {
      const allElements = scope.locator('*');
      const elementCount = await allElements.count();
      console.log(`🐛 DEBUG Category: ${category}, Found ${elementCount} total elements`);
      
      // Get some sample text content for category tuning
      const sampleTexts = await scope.locator('div, label, span, button, input').first().evaluateAll((elements: any) => {
        return Array.from(elements).slice(0, 3).map((el: any) => el.textContent?.trim()).filter(Boolean);
      }).catch(() => []);
      
      if (sampleTexts.length > 0) {
        console.log(`🐛 DEBUG Sample texts:`, sampleTexts);
      }
    } catch (e) {
      console.log(`🐛 DEBUG Error:`, (e as Error).message);
    }
  }

  private enhancedCategoryMatch(text: string, category: string): boolean {
    const enhancedMatches = {
      analytics: [
        'analytics', 'analisi', 'performance', 'statistiche', 'statistica', 'statistics',
        'analytique', 'analitiche', 'anal', 'analytics', 'performances', 'stats',
        'trac', 'tracciamento', 'tracking', 'visit', 'visits', 'visitat', 'dati di',
        'google analytics', 'ga', 'analytics cookies', 'performance', 'meeasurement',
        'cookie analytics', 'analytics', 'cookie.*analytics', 'analytics.*cookie',
        'statistica', 'statistiche', 'misurazione', 'misure', 'coldata'
      ],
      marketing: [
        'marketing', 'ads', 'pubblicità', 'commerciale', 'promo', 'target', 
        'advertising', 'pub', 'sponsored', 'targeted', 'personalized', 'adsense',
        'doubleclick', 'marketing', 'marketing cookies', 'advertising cookies', 
        'clickid', 'rétarget', 'conversion', 'campaign'
      ],
      preferences: [
        'preferenz', 'functional', 'funzional', 'technical', 'session', 'necessary',
        'essential', 'core', 'basic', 'fonctionnel', 'indispensable', 'essence'
      ]
    };
    
    const patterns = enhancedMatches[category as keyof typeof enhancedMatches] || [];
    return patterns.some((keyword: string) => text.includes(keyword.toLowerCase()));
  }

  private categoryMatch(text: string, category: string): boolean {
    const keywords = {
      analytics: ['analytics', 'analisi', 'statistiche', 'performance', 'statistica', 'statistics', 'trac', 'visit'],
      marketing: ['marketing', 'ads', 'pubblicità', 'commerciale', 'promo', 'target', 'advertising'],
      preferences: ['preferenz', 'functional', 'funzional', 'technical', 'session', 'necessari', 'essential']
    };
    
    const catKeywords = keywords[category as keyof typeof keywords] || [];
    return catKeywords.some((keyword: string) => text.includes(keyword));
  }

  private async toggleSwitchField(page: Page, category: 'analytics' | 'marketing' | 'preferences', isOn: boolean, cmpName?: string): Promise<boolean> {
    console.log(`🔧 Toggle ${category} to ${isOn ? 'ON' : 'OFF'}`);
    
    // ✅ COOKIEBOT FIX: Usa iframe dettagli invece del main page
    if (cmpName === 'cookiebot') {
      const cookiebotIds = {
        analytics: 'CybotCookiebotDialogBodyLevelButtonStatistics',
        marketing: 'CybotCookiebotDialogBodyLevelButtonMarketing',
        preferences: 'CybotCookiebotDialogBodyLevelButtonPreferences'
      };
      
      const checkboxId = cookiebotIds[category];
      console.log(`🎯 Cookiebot detected - using direct ID: ${checkboxId}`);
      
      try {
        // Trova l'iframe dei dettagli Cookiebot (dove vivono i toggle)
        const detailsScope = await this.getCookiebotDetailsScope(page);
        
        const success = await this.toggleCookiebotCheckbox(detailsScope, checkboxId, isOn, category);
        if (success) {
          console.log(`✅ Successfully toggled ${category} via Cookiebot ID`);
          return true;
        }
      } catch (e) {
        console.log(`❌ Cookiebot details scope failed: ${(e as Error).message}`);
      }
      
      console.log(`⚠️ Cookiebot direct ID failed, falling back to pattern matching...`);
    }
    
    // Per altri CMP: usa getCmpScope tradizionale
    const scope = await this.getCmpScope(page);
    
    // Fallback per altri CMP o se Cookiebot ID fallisce
    let selectors: RegExp[] = [];
    
    if (cmpName && this.config.cmp.selectors[cmpName]?.toggles?.[category]) {
      selectors = this.config.cmp.selectors[cmpName].toggles![category] as RegExp[];
    }
    
    if (!selectors || selectors.length === 0) {
      selectors = this.config.cmp.fallback.toggles?.[category] ?? [];
    }
    
    // Try each pattern
    for (const pattern of selectors) {
      const success = await this.setToggleByLabel(scope as any, pattern, isOn, category);
      if (success) return true;
    }
    
    return false;
  }

  /**
   * ✅ Toggle Cookiebot usando label (più affidabile) e verifica stato via .isChecked()
   */
  private async toggleCookiebotCheckbox(scope: Page | Frame, checkboxId: string, isOn: boolean, category: string): Promise<boolean> {
    try {
      const input = scope.locator(`#${checkboxId}`).first();
      const label = scope.locator(`label[for="${checkboxId}"]`).first();

      // Assicurati che almeno uno dei due sia attaccato al DOM
      const exists = (await input.count()) || (await label.count());
      if (!exists) {
        console.log(`❌ Toggle "${category}" non trovato (id: ${checkboxId})`);
        return false;
      }

      // Scrolla qualcosa di cliccabile in vista
      if (await label.count()) {
        await label.scrollIntoViewIfNeeded().catch(() => {});
      } else {
        await input.scrollIntoViewIfNeeded().catch(() => {});
      }

      // Se l'input esiste, usa lo stato reale
      if (await input.count()) {
        const current = await input.isChecked().catch(() => null);
        if (current !== null && current === isOn) {
          console.log(`✅ ${category} già nello stato desiderato`);
          return true;
        }
      }

      // Clicca preferendo il label (di solito è quello visibile)
      const clickable = (await label.count()) ? label : input;
      await clickable.click({ timeout: 4000 }).catch(async () => {
        // Fallback: piccolo tap JS diretto se davvero non è cliccabile
        await scope.evaluate((id) => {
          const inp = document.getElementById(id) as HTMLInputElement | null;
          if (inp) inp.click();
        }, checkboxId);
      });

      // Verifica finale dello stato se possibile
      if (await input.count()) {
        await scope.waitForTimeout(100); // micro debounce
        const final = await input.isChecked().catch(() => null);
        if (final !== null && final !== isOn) {
          // Ritenta una volta
          await clickable.click({ timeout: 4000 }).catch(() => {});
        }
      }

      console.log(`✅ ${category} -> ${isOn ? 'ON' : 'OFF'}`);
      return true;
      
    } catch (error: any) {
      console.log(`❌ toggleCookiebotCheckbox failed for ${category}:`, error?.message);
      return false;
    }
  }

  private async clickConfirmSelected(page: Page, cmpName?: string): Promise<{clicked: boolean; error?: string}> {
    // Try to get CMP-specif confirm selectors
    if (cmpName) {
      const cmpConfig = this.config.cmp.selectors[cmpName];
      if (cmpConfig && cmpConfig.confirmSelected && cmpConfig.confirmSelected.length > 0) {
        for (const selector of cmpConfig.confirmSelected) {
          try{
            const elem = await page.$(selector);
            if (elem && await elem.isVisible()) {
              await elem.click();
              return {clicked: true};
            }
          }
          catch(e) { 
            // Continue searching
          }
        }
      }
    }

    // Fallback text-based searching
    if (this.config.cmp.fallback.confirmSelected && this.config.cmp.fallback.confirmSelected.length > 0) {
      const matchFound = await page.evaluate((searchWords) => {
        const buttons = Array.from(document.querySelectorAll('button, .btn, [role="button"]'));
        for (const btn of buttons) {
          const text = (btn.textContent || '').toLowerCase().trim();
          const matchingWord = searchWords.find(word => text.includes(word.toLowerCase()));
          if (matchingWord) {
            (btn as HTMLElement).click();
            return true;
          }
        }
        return false;
      }, this.config.cmp.fallback.confirmSelected);
      
      if (matchFound) {
        return { clicked: true };
      }
    }
    
    return {clicked: false, error: 'No confirm/save preferences button located'};
  }

  private async handleCustomScenarioFallback(page: Page, scenario: ScenarioMode): Promise<boolean> {
    if (scenario !== 'accept' && scenario !== 'reject') {
      return this.handleCustomScenario(page, scenario, 'any');
    }
    // Original scenario fallback
    return false;
  }

  // DEBUG: Capture iframe content for better pattern matching
  private async debugIframeContent(page: Page): Promise<void> {
    try {
      const frameContent = await page.evaluate(() => {
        const iframeSelectors = [
          'iframe[id*="cookie"], iframe[src*="cookie"]',
          'iframe[id*="consent"], iframe[src*="consent"]', 
          'iframe[id*="privacy"], iframe[src*="privacy"]'
        ].join(',');
        
        const iframes = Array.from(document.querySelectorAll(iframeSelectors));
        if (iframes.length === 0) return null;
        
        const iframe = iframes[0] as HTMLIFrameElement;
        try {
          const frameDoc = iframe.contentDocument || iframe.contentWindow?.document;
          if (!frameDoc) return 'Iframe document not accessible';
          
          // ✅ DEBUG: Cattura struttura checkbox reale
          const checkboxes = frameDoc.querySelectorAll('input[type="checkbox"]');
          const checkboxStructure = Array.from(checkboxes).slice(0, 5).map(cb => {
            const parent = cb.parentElement;
            const computed = frameDoc.defaultView?.getComputedStyle(cb);
            return {
              id: cb.id,
              visible: computed?.display !== 'none' && computed?.visibility !== 'hidden',
              parentTag: parent?.tagName,
              parentClass: parent?.className,
              hasLabel: !!frameDoc.querySelector(`label[for="${cb.id}"]`)
            };
          });
          
          console.log('🐛 CHECKBOX DEBUG:', JSON.stringify(checkboxStructure, null, 2));
          
          // Get all text content from potential toggle sections
          const toggleElements = frameDoc.querySelectorAll('[role="switch"], input[type="checkbox"], button, label, div[class*="cookie"], div[class*="category"]');
          const texts = Array.from(toggleElements).map(el => {
            return {
              tag: el.tagName,
              text: el.textContent?.trim(),
              className: el.className,
              role: el.getAttribute('role'),
              type: el.getAttribute('type')
            };
          }).filter(item => item.text && item.text.length > 0 && item.text.length < 50);
          
          return {
            selector: iframe.src || iframe.id,
            texts: texts
          };
        } catch (err) {
          return 'Cross-origin iframe not accessible';
        }
      });
      
      if (frameContent && typeof frameContent === 'object' && 'texts' in frameContent) {
        console.log(`🐛 DEBUG: Found potential toggle texts in iframe:`, frameContent.texts.slice(0, 5));
      }
    } catch (err) {
      console.log(`🐛 DEBUG: Failed to inspect iframe content:`, (err as Error).message);
    }
  }

  private async detectPersonalizeCmpInfo(page: Page): Promise<{
    cmpName?: 'cookiebot' | 'onetrust' | 'iubenda' | 'didomi' | 'usercentrics' | 'generic' | 'unknown';
    matchedBy?: 'config' | 'fallback';
    confirmButtonText?: string;
  }> {
    // Try to detect CMP to best guess
    const oneTrustPresent = await page.$('#onetrust-consent-sdk');
    const cookiebotPresent = await page.$('#CybotCookiebotDialog');
    const iubendaPresent = await page.$('.iubenda-cs-banner');
    
    if (oneTrustPresent) {
      return { cmpName: 'onetrust', matchedBy: 'config' };
    }
    if (cookiebotPresent) {
      return { cmpName: 'cookiebot', matchedBy: 'config' };
    }
    if (iubendaPresent) {
      return { cmpName: 'iubenda', matchedBy: 'config' };
    }
    
    return { cmpName: 'unknown', matchedBy: 'fallback' };
  }
}

// Tipo per le dipendenze del runner
export interface ConsentRunnerDependencies {
  llmService: ConsentLLMService;
}

// Funzione di utilità per eseguire il test
export async function runConsentTest(input: ConsentTestInput, customScenarios?: Array<ScenarioMode>, dependencies?: ConsentRunnerDependencies): Promise<ConsentTestResult> {
  const runner = new ConsentTestRunner(defaultConfig, dependencies?.llmService);
  return await runner.runTest(input, customScenarios);
}
