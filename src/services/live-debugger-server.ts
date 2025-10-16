import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import type { StartPayload, NormalizedEvent, EnvInfo, Ga4Event } from '../types/live-debugger.js';
import type { PushCase, PushCaseCreate, PushCaseUpdate } from '../types/push-cases.js';
import { pushCasesStorage } from './push-cases-storage.js';
import { resolveMacros } from './macro-resolver.js';

const PORT = process.env.LIVE_DEBUGGER_PORT ? parseInt(process.env.LIVE_DEBUGGER_PORT) : 5180;

// Utility functions
function mergeParams(url: string, method: string, postData?: string | Buffer) {
  const u = new URL(url);
  const p = new URLSearchParams(u.search);
  if (method === 'POST' && postData) {
    const txt = typeof postData === 'string' ? postData : postData.toString('utf8');
    try {
      if (/^\s*\{/.test(txt)) {
        const obj = JSON.parse(txt);
        Object.entries(obj).forEach(([k, v]) => p.append(k, String(v)));
      } else {
        new URLSearchParams(txt).forEach((v, k) => p.append(k, v));
      }
    } catch {}
  }
  return p;
}

function safeJSON(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function timeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), ms)
    ),
  ]);
}

// GA Detection
const GA_HOST = /(google-analytics\.com|region\d+\.google-analytics\.com)$/i;
const GA_PATH = /(\/|^)(debug\/)?(g\/)?collect$/i;

function isGA(u: string): boolean {
  try {
    const url = new URL(u);
    return GA_HOST.test(url.hostname) && GA_PATH.test(url.pathname);
  } catch {
    return false;
  }
}

// DataLayer Hook Script
const dlHookScript = `(() => {
  if (window.__ldHook) return; window.__ldHook = true;
  const dl = Array.isArray(window.dataLayer) ? window.dataLayer : (window.dataLayer = []);
  const orig = dl.push.bind(dl);
  const emit = (d) => { try { window.__ldOnPush && window.__ldOnPush(d); } catch(e){} };
  try { emit({ ts: Date.now(), source:'snapshot', payload: dl.slice() }); } catch {}
  dl.push = (...a) => { try { emit({ ts: Date.now(), source:'hook', payload: a }); } catch {} return orig(...a); };
})();`;

// Session Management
let browser: Browser | null = null;
let context: BrowserContext | null = null;
let page: Page | null = null;
let running = false;

// Push tracking
const trackers = new Map<string, {
  id: string; tsStart: number; timeoutMs: number;
  mode: 'datalayer'|'gtag';
  match: 'auto'|'eventName'|'any'|'custom';
  eventName?: string; customUrlPattern?: RegExp;
  matches: { url: string; status?: number }[];
}>();

function matchesTracker(t: any, url: string, params: URLSearchParams) {
  if (t.match === 'any') return true;
  if (t.match === 'custom' && t.customUrlPattern) return t.customUrlPattern.test(url);
  
  const en = params.get('en') || params.get('_en') || '';
  
  if (t.match === 'eventName') {
    // Per eventName, controlla sia en che altri parametri che potrebbero contenere il nome evento
    if (en && t.eventName && en === t.eventName) return true;
    
    // Per eventi custom, controlla anche altri parametri comuni
    const eventParam = params.get('event') || params.get('event_name') || '';
    if (eventParam && t.eventName && eventParam === t.eventName) return true;
    
    return false;
  }
  
  // auto: se eventName è noto, prova a matcharlo in vari modi, altrimenti accetta
  if (t.eventName) {
    // Controlla en (per eventi standard GA4)
    if (en && en === t.eventName) return true;
    
    // Controlla event/event_name (per eventi custom)
    const eventParam = params.get('event') || params.get('event_name') || '';
    if (eventParam && eventParam === t.eventName) return true;
    
    // Se non trova il nome evento nei parametri, accetta comunque (fallback)
    // Questo gestisce il caso di eventi custom che potrebbero non essere esposti nei parametri GA
    return true;
  }
  
  return true;
}

async function startSession(cfg: StartPayload, emit: (e: NormalizedEvent) => void): Promise<void> {
  if (running) {
    console.log('[LIVE-DEBUGGER] Already running, stopping previous session');
    await stopSession();
  }

  running = true;
  console.log('[LIVE-DEBUGGER] Starting session for', cfg.url);

  try {
    // Launch browser
    browser = await chromium.launch({
      headless: cfg.headless ?? true,
    });

    context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
    });

    page = await context.newPage();

    // Setup console listener
    page.on('console', (msg) => {
      const level = msg.type() as 'log' | 'warn' | 'error';
      if (['log', 'warn', 'error'].includes(level)) {
        emit({ kind: 'console', ts: Date.now(), level, text: msg.text() });
      }
    });

    // Inject dataLayer hook BEFORE navigation
    await page.addInitScript(dlHookScript);

    // Expose function for dataLayer push events
    await page.exposeFunction('__ldOnPush', (d: any) => {
      emit({
        kind: 'datalayer.push',
        ts: d.ts || Date.now(),
        source: d.source,
        payload: d.payload,
      });
    });

    // Navigate to URL
    const waitUntil = cfg.waitUntil ?? 'load';
    const timeoutMs = cfg.timeoutMs ?? 30000;
    
    emit({ kind: 'note', ts: Date.now(), message: `navigating:${cfg.url}` });
    await page.goto(cfg.url, { waitUntil, timeout: timeoutMs });
    emit({ kind: 'note', ts: Date.now(), message: 'page_loaded' });

    // Run consent (auto-accept cookies)
    await runConsent(page, emit);

    // Detect environment (GTM, gtag, Cookiebot)
    const env = await detectEnvironment(page);
    emit({ kind: 'env', ts: Date.now(), env });

    // Attach GA sniffer with onCollect callback
    attachGASniffer(page, emit, {
      redactPII: cfg.redactPII ?? true,
      onCollect: ({ url, status, params }) => {
        const now = Date.now();
        console.log('[LIVE-DEBUGGER] GA collect detected:', { url, status, params: Object.fromEntries(params) });
        
        for (const t of trackers.values()) {
          if (now - t.tsStart > t.timeoutMs) {
            console.log('[LIVE-DEBUGGER] Tracker timeout:', t.id);
            continue;
          }
          
          const matches = matchesTracker(t, url, params);
          console.log('[LIVE-DEBUGGER] Tracker match check:', { 
            trackerId: t.id, 
            eventName: t.eventName, 
            match: t.match, 
            matches,
            en: params.get('en'),
            event: params.get('event')
          });
          
          if (matches) {
            t.matches.push({ url, status });
            trackers.delete(t.id);
            emit({ kind:'push.result', ts: now, id: t.id, ok: true, matched: t.matches });
            console.log('[LIVE-DEBUGGER] Push result sent:', t.id);
          }
        }
      }
    });

    emit({ kind: 'note', ts: Date.now(), message: 'READY' });
    console.log('[LIVE-DEBUGGER] Session ready');
  } catch (err: any) {
    console.error('[LIVE-DEBUGGER] Error during start:', err.message);
    emit({ kind: 'note', ts: Date.now(), message: `error:${err.message}` });
    await stopSession();
    running = false;
    throw err;
  }
}

async function stopSession(): Promise<void> {
  console.log('[LIVE-DEBUGGER] Stopping session');
  running = false;

  if (page) {
    try {
      await page.close();
    } catch {}
    page = null;
  }

  if (context) {
    try {
      await context.close();
    } catch {}
    context = null;
  }

  if (browser) {
    try {
      await browser.close();
    } catch {}
    browser = null;
  }

  console.log('[LIVE-DEBUGGER] Session stopped');
}

export async function push(cmdNoId: Omit<PushCommand,'id'>, emit: (e: NormalizedEvent)=>void) {
  if (!page) {
    throw new Error('No active session');
  }

  const id = crypto.randomUUID();
  const timeoutMs = cmdNoId.timeoutMs ?? 5000;
  const eventName = cmdNoId.mode === 'gtag' ? cmdNoId.name : (cmdNoId.payload?.event || undefined);
  const tracker = {
    id, tsStart: Date.now(), timeoutMs,
    mode: cmdNoId.mode, match: cmdNoId.match ?? 'auto',
    eventName, customUrlPattern: cmdNoId.match === 'custom' && cmdNoId.customUrlPattern ? new RegExp(cmdNoId.customUrlPattern) : undefined,
    matches: [] as { url: string; status?: number }[],
  };
  if (cmdNoId.trackCollect ?? true) trackers.set(id, tracker);

  try {
    if (cmdNoId.mode === 'datalayer') {
      await page.evaluate((payload) => {
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push(payload);
      }, cmdNoId.payload);
    } else {
      await page.evaluate(({name, params}) => {
        window.gtag && window.gtag('event', name, params || {});
      }, { name: cmdNoId.name, params: cmdNoId.params });
    }
  } catch (e) {
    trackers.delete(id);
    emit({ kind:'push.result', ts: Date.now(), id, ok: false, reason:'error' });
    return id;
  }

  // Se non si vuole tracciare collect, chiudi subito con ok=true (solo esecuzione push)
  if (!(cmdNoId.trackCollect ?? true)) {
    emit({ kind:'push.result', ts: Date.now(), id, ok: true, matched: [] });
    return id;
  }

  // Programma timeout
  setTimeout(() => {
    const t = trackers.get(id);
    if (!t) return; // già risolto da onCollect
    trackers.delete(id);
    emit({ kind:'push.result', ts: Date.now(), id, ok: false, reason:'timeout' });
  }, timeoutMs);

  return id;
}

// Consent Management
async function runConsent(page: Page, emit: (e: NormalizedEvent) => void): Promise<void> {
  const CONSENT_TIMEOUT = 8000;
  
  try {
    await timeout(runConsentInternal(page, emit), CONSENT_TIMEOUT);
  } catch (err: any) {
    emit({ kind: 'note', ts: Date.now(), message: `consent:timeout (${err.message})` });
  }
}

async function runConsentInternal(page: Page, emit: (e: NormalizedEvent) => void): Promise<void> {
  // Check if Cookiebot is present
  const hasCookiebot = await page.evaluate(() => {
    return !!(window as any).Cookiebot || 
      !!document.querySelector('script[src*="consent.cookiebot.com"]');
  });

  if (hasCookiebot) {
    emit({ kind: 'note', ts: Date.now(), message: 'consent:cookiebot_detected' });
    
    // Try to click accept button (main frame + iframes)
    const selectors = [
      'button:has-text("Accetta tutto")',
      'button:has-text("Accept all")',
      'button:has-text("Agree")',
      'button:has-text("Allow")',
      'button:has-text("Accept")',
      'a:has-text("Accetta tutto")',
      'a:has-text("Accept all")',
      '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
      '[id*="accept"]',
      '[class*="accept"]',
    ];

    let clicked = false;

    // Try main frame
    for (const sel of selectors) {
      try {
        await page.locator(sel).first().click({ timeout: 1000 });
        emit({ kind: 'note', ts: Date.now(), message: 'consent:clicked_main' });
        clicked = true;
        break;
      } catch {}
    }

    // Try iframes
    if (!clicked) {
      const frames = page.frames();
      for (const frame of frames) {
        if (frame === page.mainFrame()) continue;
        for (const sel of selectors) {
          try {
            await frame.locator(sel).first().click({ timeout: 1000 });
            emit({ kind: 'note', ts: Date.now(), message: 'consent:clicked_iframe' });
            clicked = true;
            break;
          } catch {}
        }
        if (clicked) break;
      }
    }

    if (clicked) {
      await page.waitForTimeout(500);
      return;
    }
  }

  // Fallback: gtag consent update
  const hasGtag = await page.evaluate(() => typeof (window as any).gtag === 'function');
  if (hasGtag) {
    await page.evaluate(() => {
      (window as any).gtag?.('consent', 'update', {
        analytics_storage: 'granted',
        ad_storage: 'granted',
      });
    });
    emit({ kind: 'note', ts: Date.now(), message: 'consent:gtag_fallback' });
  } else {
    emit({ kind: 'note', ts: Date.now(), message: 'consent:no_cmp_detected' });
  }
}

// Environment Detection
async function detectEnvironment(page: Page): Promise<EnvInfo> {
  const url = page.url();

  // GTM detection
  const gtm = await page.evaluate(() => {
    const scripts = Array.from(document.querySelectorAll('script[src]'));
    const gtmScript = scripts.find((s) => s.getAttribute('src')?.includes('gtm.js?id=GTM-'));
    
    let containerId: string | undefined;
    if (gtmScript) {
      const src = gtmScript.getAttribute('src');
      const match = src?.match(/id=(GTM-[A-Z0-9]+)/);
      if (match) containerId = match[1];
    }

    const hasGtmInDL = Array.isArray((window as any).dataLayer) && 
      (window as any).dataLayer.some((e: any) => e['gtm.start'] || e['gtm.uniqueEventId']);

    return {
      present: !!gtmScript || hasGtmInDL,
      containerId,
    };
  });

  // gtag detection
  const gtag = await page.evaluate(() => {
    const hasGtag = typeof (window as any).gtag === 'function';
    const scripts = Array.from(document.querySelectorAll('script[src]'));
    const measurementIds: string[] = [];

    scripts.forEach((s) => {
      const src = s.getAttribute('src');
      if (src?.includes('gtag/js?id=')) {
        const match = src.match(/id=([A-Z0-9-]+)/);
        if (match) measurementIds.push(match[1]);
      }
    });

    if (Array.isArray((window as any).dataLayer)) {
      (window as any).dataLayer.forEach((e: any) => {
        if (Array.isArray(e) && e[0] === 'config' && e[1]) {
          if (!measurementIds.includes(e[1])) {
            measurementIds.push(e[1]);
          }
        }
      });
    }

    return {
      present: hasGtag,
      measurementIds: measurementIds.length > 0 ? measurementIds : undefined,
    };
  });

  // Cookiebot detection
  const cookiebot = await page.evaluate(() => {
    const hasCookiebot = !!(window as any).Cookiebot;
    const scripts = Array.from(document.querySelectorAll('script[src]'));
    const cbScript = scripts.find((s) => s.getAttribute('src')?.includes('consent.cookiebot.com'));
    
    let version: string | undefined;
    if (hasCookiebot && (window as any).Cookiebot.version) {
      version = (window as any).Cookiebot.version;
    }

    return {
      present: hasCookiebot || !!cbScript,
      version,
    };
  });

  return { url, gtm, gtag, cookiebot };
}

// GA Sniffer
export type OnCollect = (data: {
  url: string; status?: number; params: URLSearchParams;
}) => void;

function attachGASniffer(page: Page, emit: (e: NormalizedEvent) => void, opts: { redactPII: boolean; onCollect?: OnCollect }) {
  const requestMap = new Map<string, { url: string; ts: number; params: URLSearchParams }>();

  page.on('request', (req) => {
    const url = req.url();
    if (!isGA(url)) return;

    const ts = Date.now();
    const method = req.method();
    const postData = req.postData();
    const params = mergeParams(url, method, postData);

    requestMap.set(req.url(), { url, ts, params });

    // Parse and emit immediately
    const isGA4 = params.has('en') || params.has('_en');
    if (isGA4) {
      const event = parseGA4Event(params);
      const mi = params.get('measurement_id') || params.get('tid') || undefined;
      const cid = params.get('cid') || params.get('_cid') || undefined;
      emit({ kind: 'ga4.hit', ts, url, event, mi, cid });
    } else {
      const paramsObj: Record<string, string> = {};
      params.forEach((v, k) => {
        paramsObj[k] = v;
      });
      emit({ kind: 'ua.hit', ts, url, params: paramsObj });
    }

    // Call onCollect callback if provided
    if (opts.onCollect) {
      opts.onCollect({ url, params });
    }
  });

  page.on('response', async (resp) => {
    const url = resp.url();
    if (!isGA(url)) return;

    const record = requestMap.get(url);
    if (!record) return;

    const status = resp.status();
    const ts = record.ts;
    const params = record.params;

    const isGA4 = params.has('en') || params.has('_en');
    if (isGA4) {
      const event = parseGA4Event(params);
      const mi = params.get('measurement_id') || params.get('tid') || undefined;
      const cid = params.get('cid') || params.get('_cid') || undefined;
      emit({ kind: 'ga4.hit', ts, url, status, event, mi, cid });
    } else {
      const paramsObj: Record<string, string> = {};
      params.forEach((v, k) => {
        paramsObj[k] = v;
      });
      emit({ kind: 'ua.hit', ts, url, status, params: paramsObj });
    }

    // Call onCollect callback with status if provided
    if (opts.onCollect) {
      opts.onCollect({ url, status, params });
    }

    requestMap.delete(url);
  });
}

function parseGA4Event(params: URLSearchParams): Ga4Event {
  const name = params.get('en') || params.get('_en') || undefined;
  const eventParams: Record<string, unknown> = {};

  params.forEach((v, k) => {
    if (!['en', '_en', 'measurement_id', 'tid', 'cid', '_cid'].includes(k)) {
      if (v.startsWith('{') || v.startsWith('[')) {
        const parsed = safeJSON(v);
        eventParams[k] = parsed !== null ? parsed : v;
      } else {
        eventParams[k] = v;
      }
    }
  });

  const items = parseItems(params);

  return { name, params: eventParams, items: items.length > 0 ? items : undefined };
}

function parseItems(params: URLSearchParams): Array<Record<string, unknown>> {
  const items: Array<Record<string, unknown>> = [];
  const itemMap = new Map<number, Record<string, unknown>>();

  params.forEach((v, k) => {
    const match = k.match(/^pr(\d+)(.+)$/);
    if (match) {
      const idx = parseInt(match[1], 10);
      const field = match[2];
      if (!itemMap.has(idx)) {
        itemMap.set(idx, {});
      }
      itemMap.get(idx)![field] = v;
    }
  });

  itemMap.forEach((item) => {
    items.push(item);
  });

  return items;
}

// Express + WebSocket Server
const app = express();
const server = createServer(app);

const wss = new WebSocketServer({ server, path: '/events' });

const clients = new Set<WebSocket>();

wss.on('connection', (ws) => {
  console.log('[LIVE-DEBUGGER] Client connected');
  clients.add(ws);

  ws.on('close', () => {
    console.log('[LIVE-DEBUGGER] Client disconnected');
    clients.delete(ws);
  });

  ws.on('error', (err) => {
    console.error('[LIVE-DEBUGGER] WebSocket error:', err);
    clients.delete(ws);
  });
});

function broadcast(event: NormalizedEvent) {
  const message = JSON.stringify(event);
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// API Routes
app.post('/api/start', async (req, res) => {
  try {
    const payload: StartPayload = req.body;
    console.log('[LIVE-DEBUGGER] /api/start called with payload:', payload);

    if (!payload.url) {
      return res.status(400).json({ error: 'url is required' });
    }

    try {
      new URL(payload.url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL' });
    }

    if (running) {
      await stopSession();
    }

    startSession(payload, broadcast).catch((err) => {
      console.error('[LIVE-DEBUGGER] Session error:', err);
      broadcast({ kind: 'note', ts: Date.now(), message: `session_error:${err.message}` });
    });

    res.json({ success: true, message: 'Session starting' });
  } catch (err: any) {
    console.error('[LIVE-DEBUGGER] API /start error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/stop', async (req, res) => {
  try {
    await stopSession();
    res.json({ success: true, message: 'Session stopped' });
  } catch (err: any) {
    console.error('[LIVE-DEBUGGER] API /stop error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/status', (req, res) => {
  res.json({ running });
});

app.post('/api/push', async (req, res) => {
  try {
    const cmdNoId = req.body;
    
    if (!cmdNoId.mode || !['datalayer', 'gtag'].includes(cmdNoId.mode)) {
      return res.status(400).json({ error: 'mode must be "datalayer" or "gtag"' });
    }

    if (cmdNoId.mode === 'datalayer' && !cmdNoId.payload) {
      return res.status(400).json({ error: 'payload is required for datalayer mode' });
    }

    if (cmdNoId.mode === 'gtag' && !cmdNoId.name) {
      return res.status(400).json({ error: 'name is required for gtag mode' });
    }

    if (!running) {
      return res.status(400).json({ error: 'No active session' });
    }

    const id = await push(cmdNoId, broadcast);
    res.json({ id });
  } catch (err: any) {
    console.error('[LIVE-DEBUGGER] API /push error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Push Cases API
app.get('/api/cases', async (req, res) => {
  try {
    const origin = req.query.origin as string;
    const search = req.query.search as string;
    
    let cases;
    if (search) {
      cases = await pushCasesStorage.searchCases(search, origin);
    } else if (origin) {
      cases = await pushCasesStorage.getCasesByOrigin(origin);
    } else {
      cases = await pushCasesStorage.getAllCases();
    }
    
    res.json(cases);
  } catch (err: any) {
    console.error('[LIVE-DEBUGGER] API /cases GET error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/cases', async (req, res) => {
  try {
    const caseData: PushCaseCreate = req.body;
    const newCase = await pushCasesStorage.createCase(caseData);
    res.json(newCase);
  } catch (err: any) {
    console.error('[LIVE-DEBUGGER] API /cases POST error:', err);
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/cases/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const updates: PushCaseUpdate = { ...req.body, id };
    const updatedCase = await pushCasesStorage.updateCase(id, updates);
    res.json(updatedCase);
  } catch (err: any) {
    console.error('[LIVE-DEBUGGER] API /cases PUT error:', err);
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/cases/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const deleted = await pushCasesStorage.deleteCase(id);
    if (deleted) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Case not found' });
    }
  } catch (err: any) {
    console.error('[LIVE-DEBUGGER] API /cases DELETE error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/cases/:id/run', async (req, res) => {
  try {
    const id = req.params.id;
    const case_ = await pushCasesStorage.getCaseById(id);
    
    if (!case_) {
      return res.status(404).json({ error: 'Case not found' });
    }

    if (!running) {
      return res.status(400).json({ error: 'No active session' });
    }

    // Resolve macros
    const ctx = {
      url: page?.url(),
      env: process.env,
    };

    const resolvedCase = {
      ...case_,
      payload: case_.payload ? resolveMacros(case_.payload, ctx) : undefined,
      gtagParams: case_.gtagParams ? resolveMacros(case_.gtagParams, ctx) : undefined,
    };

    // Convert to push command
    const cmd = toPushCommand(resolvedCase);
    
    // Execute push
    const pushId = await push(cmd, broadcast);
    
    // Update last used
    await pushCasesStorage.touchLastUsed(id);
    
    res.json({ id: pushId });
  } catch (err: any) {
    console.error('[LIVE-DEBUGGER] API /cases/:id/run error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/cases/export', async (req, res) => {
  try {
    const origin = req.query.origin as string;
    const cases = await pushCasesStorage.exportCases(origin);
    res.json(cases);
  } catch (err: any) {
    console.error('[LIVE-DEBUGGER] API /cases/export error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/cases/import', async (req, res) => {
  try {
    const { cases, overwrite = false } = req.body;
    const result = await pushCasesStorage.importCases(cases, overwrite);
    res.json(result);
  } catch (err: any) {
    console.error('[LIVE-DEBUGGER] API /cases/import error:', err);
    res.status(500).json({ error: err.message });
  }
});

function toPushCommand(c: PushCase) {
  return c.mode === 'datalayer'
    ? { 
        mode: 'datalayer', 
        payload: c.payload, 
        trackCollect: c.trackCollect, 
        match: c.match, 
        customUrlPattern: c.customUrlPattern, 
        timeoutMs: c.timeoutMs 
      }
    : { 
        mode: 'gtag', 
        name: c.gtagName!, 
        params: c.gtagParams, 
        trackCollect: c.trackCollect, 
        match: c.match, 
        customUrlPattern: c.customUrlPattern, 
        timeoutMs: c.timeoutMs 
      };
}

server.listen(PORT, () => {
  console.log(`[LIVE-DEBUGGER] Server running on http://localhost:${PORT}`);
  console.log(`[LIVE-DEBUGGER] WebSocket available at ws://localhost:${PORT}/events`);
});

process.on('SIGTERM', async () => {
  console.log('[LIVE-DEBUGGER] SIGTERM received, shutting down gracefully');
  await stopSession();
  server.close(() => {
    console.log('[LIVE-DEBUGGER] Server closed');
    process.exit(0);
  });
});
