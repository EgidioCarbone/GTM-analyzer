import 'dotenv/config';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { chromium, Browser, BrowserContext, Page, Request as PlaywrightRequest } from 'playwright';
import OpenAI from 'openai';
import type { StartPayload, NormalizedEvent, EnvInfo, Ga4Event, PushCommand } from '../types/live-debugger.js';
import type { PushCase, PushCaseCreate, PushCaseUpdate } from '../types/push-cases.js';
import type { PushUseCase, ExpectedCall, RunResultSummary } from '../../shared/types.js';
import type { EventInsight } from '../../shared/analyzer.js';
import { pushCasesStorage } from './push-cases-storage.js';
import { pushUseCasesStorage } from './push-usecases-storage.js';
import { resolveMacros } from './macro-resolver.js';
import { z } from 'zod';

const PORT = process.env.LIVE_DEBUGGER_PORT ? parseInt(process.env.LIVE_DEBUGGER_PORT) : 5180;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL =
  process.env.OPENAI_LIVE_DEBUGGER_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini';
const openaiClient = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

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
  if (typeof text !== 'string') {
    return null;
  }

  const trimmed = text.trim();
  if (!trimmed || !/^[\[{]/.test(trimmed)) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
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

const ExpectedCallInputSchema = z.object({
  urlPattern: z.string().min(1),
  mustContainParams: z.record(z.string()).optional(),
});

const UseCaseCreateSchema = z.object({
  name: z.string().min(1),
  origin: z.string().min(1),
  mode: z.enum(['datalayer', 'gtag']),
  payload: z.any().optional(),
  gtagName: z.string().optional(),
  gtagParams: z.record(z.any()).optional(),
  expected: ExpectedCallInputSchema.optional(),
  timeoutMs: z.number().positive().optional(),
});

const UseCaseUpdateSchema = UseCaseCreateSchema.partial();

const AiAssistantRequestSchema = z.object({
  event: z
    .object({
      kind: z.string(),
      ts: z.number(),
    })
    .passthrough(),
  insights: z.array(
    z.object({
      id: z.string(),
      severity: z.enum(['info', 'warning', 'error']),
      title: z.string(),
      description: z.string().optional(),
      recommendations: z.array(z.string()).optional(),
      payloadPreview: z.any().optional(),
      relatedEventName: z.string().optional(),
    }),
  ),
  intent: z.enum(['explain', 'fix', 'qa']),
  question: z.string().optional(),
});

function indentBlock(text: string, spaces = 2): string {
  const pad = ' '.repeat(spaces);
  return text
    .split('\n')
    .map((line) => `${pad}${line}`)
    .join('\n');
}

function compactStringify(value: unknown, maxLength = 1200): string {
  try {
    const seen = new WeakSet();
    const json = JSON.stringify(
      value,
      (_key, val) => {
        if (typeof val === 'object' && val !== null) {
          if (seen.has(val)) return '[Circular]';
          seen.add(val);
        }
        if (typeof val === 'function') return undefined;
        return val;
      },
      2,
    );
    if (!json) return '';
    if (json.length <= maxLength) return json;
    return `${json.slice(0, maxLength)}…`;
  } catch {
    return typeof value === 'string' ? value : JSON.stringify(value ?? null);
  }
}

function describeEventForAi(event: NormalizedEvent): string {
  const base = [`Tipo evento: ${event.kind}`, `Timestamp: ${new Date(event.ts).toISOString()}`];

  switch (event.kind) {
    case 'datalayer.push': {
      base.push(`Origine push: ${event.source}`);
      base.push(`Payload:\n${indentBlock(compactStringify(event.payload, 1200), 2)}`);
      break;
    }
    case 'ga4.hit': {
      base.push(`URL richiesta: ${event.url}`);
      if (typeof event.status !== 'undefined') base.push(`HTTP status: ${event.status}`);
      if (event.mi) base.push(`Measurement ID: ${event.mi}`);
      if (event.cid) base.push(`Client ID: ${event.cid}`);
      if (event.event?.name) base.push(`Nome evento GA4: ${event.event.name}`);
      if (event.event?.params) {
        base.push(`Parametri:\n${indentBlock(compactStringify(event.event.params, 1200), 2)}`);
      }
      if (event.event?.items) {
        base.push(`Items:\n${indentBlock(compactStringify(event.event.items, 800), 2)}`);
      }
      break;
    }
    case 'ua.hit': {
      base.push(`URL richiesta: ${event.url}`);
      if (typeof event.status !== 'undefined') base.push(`HTTP status: ${event.status}`);
      base.push(`Parametri UA:\n${indentBlock(compactStringify(event.params, 1200), 2)}`);
      break;
    }
    case 'console': {
      base.push(`Livello console: ${event.level}`);
      base.push(`Messaggio: ${event.text}`);
      break;
    }
    case 'note':
      base.push(`Nota: ${event.message}`);
      break;
    case 'env':
      base.push(`Dettagli ambiente:\n${indentBlock(compactStringify(event.env, 800), 2)}`);
      break;
    case 'push.result': {
      base.push(`ID Run: ${event.id}`);
      base.push(`Outcome: ${event.ok ? 'successo' : `fallito (${event.reason || 'motivo sconosciuto'})`}`);
      if (event.matched?.length) {
        base.push(
          `Richieste abbinate:\n${indentBlock(
            event.matched.map((m) => `${m.url}${typeof m.status !== 'undefined' ? ` (status ${m.status})` : ''}`).join('\n'),
            2,
          )}`,
        );
      }
      break;
    }
    default:
      break;
  }

  return base.join('\n');
}

function formatInsightsForAi(insights: EventInsight[]): string {
  if (!insights.length) {
    return 'Nessun insight associato a questo evento.';
  }

  return insights
    .map((insight, index) => {
      const lines = [
        `${index + 1}. [${insight.severity.toUpperCase()}] ${insight.title}`,
        insight.description ? indentBlock(`Descrizione: ${insight.description}`, 4) : null,
        insight.relatedEventName ? indentBlock(`Evento correlato: ${insight.relatedEventName}`, 4) : null,
        insight.recommendations?.length
          ? indentBlock(
              `Raccomandazioni:\n${insight.recommendations
                .map((rec, idx) => `${idx + 1}) ${rec}`)
                .map((entry) => indentBlock(entry, 6))
                .join('\n')}`,
              4,
            )
          : null,
        insight.payloadPreview
          ? indentBlock(`Esempio payload:\n${indentBlock(compactStringify(insight.payloadPreview, 600), 6)}`, 4)
          : null,
      ].filter(Boolean);
      return lines.join('\n');
    })
    .join('\n\n');
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
  const win = window;
  const dl = Array.isArray(win.dataLayer) ? win.dataLayer : (win.dataLayer = []);
  const orig = dl.push.bind(dl);

  const takeMeta = () => {
    const meta = win.__ldPendingPushMeta || null;
    if (meta && typeof meta === 'object') {
      delete win.__ldPendingPushMeta;
      return meta;
    }
    return null;
  };

  const emit = (payload, source) => {
    const meta = source === 'hook' ? takeMeta() : null;
    try {
      win.__ldOnPush && win.__ldOnPush({
        ts: Date.now(),
        source,
        payload,
        meta,
      });
    } catch (e) {}
  };

  try { emit(dl.slice(), 'snapshot'); } catch (e) {}

  dl.push = (...args) => {
    const meta = takeMeta();
    try {
      win.__ldOnPush && win.__ldOnPush({
        ts: Date.now(),
        source: 'hook',
        payload: args,
        meta,
      });
    } catch (e) {}
    return orig(...args);
  };
})();`;

interface PushTracker {
  id: string;
  tsStart: number;
  timeoutMs: number;
  mode: 'datalayer' | 'gtag';
  match: 'auto' | 'eventName' | 'any' | 'custom';
  eventName?: string;
  customUrlPattern?: RegExp;
  matches: { url: string; status?: number }[];
  attempts: number;
  maxAttempts: number;
  command: Omit<PushCommand, 'id'> & { origin?: string };
  timeoutHandle?: NodeJS.Timeout;
}

// Session Management
let browser: Browser | null = null;
let context: BrowserContext | null = null;
let page: Page | null = null;
let running = false;

// Push tracking
const trackers = new Map<string, PushTracker>();
const MAX_PUSH_ATTEMPTS = 5;

async function evaluatePushCommand(
  pushId: string,
  command: Omit<PushCommand, 'id'> & { origin?: string },
): Promise<void> {
  if (!page) {
    throw new Error('No active session');
  }

  const origin = command.origin ?? 'console';

  if (command.mode === 'datalayer') {
    await page.evaluate(
      ({ payload, pushId, origin }) => {
        const win = window as any;
        win.__ldPendingPushMeta = { pushId, origin, mode: 'datalayer' };
        win.dataLayer = win.dataLayer || [];
        win.dataLayer.push(payload);
        setTimeout(() => {
          if (win.__ldPendingPushMeta?.pushId === pushId) {
            delete win.__ldPendingPushMeta;
          }
        }, 0);
      },
      { payload: command.payload, pushId, origin },
    );
  } else {
    await page.evaluate(
      ({ name, params, pushId, origin }) => {
        const win = window as any;
        win.__ldPendingPushMeta = { pushId, origin, mode: 'gtag' };
        win.gtag && win.gtag('event', name, params || {});
        setTimeout(() => {
          if (win.__ldPendingPushMeta?.pushId === pushId) {
            delete win.__ldPendingPushMeta;
          }
        }, 0);
      },
      { name: command.name, params: command.params, pushId, origin },
    );
  }
}

async function triggerTrackerAttempt(
  tracker: PushTracker,
  emit: (e: NormalizedEvent) => void,
): Promise<void> {
  tracker.attempts += 1;
  tracker.tsStart = Date.now();
  tracker.matches = [];
  trackers.set(tracker.id, tracker);

  console.log(
    '[LIVE-DEBUGGER] Push attempt',
    tracker.attempts,
    '/',
    tracker.maxAttempts,
    'for',
    tracker.id,
  );

  try {
    await evaluatePushCommand(tracker.id, tracker.command);
  } catch (err) {
    if (tracker.timeoutHandle) {
      clearTimeout(tracker.timeoutHandle);
      tracker.timeoutHandle = undefined;
    }
    trackers.delete(tracker.id);
    emit({
      kind: 'push.result',
      ts: Date.now(),
      id: tracker.id,
      ok: false,
      reason: 'error',
      attempts: tracker.attempts,
      maxAttempts: tracker.maxAttempts,
    });
    return;
  }

  if (tracker.timeoutHandle) {
    clearTimeout(tracker.timeoutHandle);
  }

  const attemptNumber = tracker.attempts;
  tracker.timeoutHandle = setTimeout(() => {
    handlePushTimeout(tracker.id, attemptNumber, emit);
  }, tracker.timeoutMs);
}

function handlePushTimeout(
  trackerId: string,
  attemptNumber: number,
  emit: (e: NormalizedEvent) => void,
): void {
  const tracker = trackers.get(trackerId);
  if (!tracker) return;
  if (tracker.attempts !== attemptNumber) return;

  tracker.timeoutHandle = undefined;

  if (tracker.attempts < tracker.maxAttempts) {
    console.log(
      '[LIVE-DEBUGGER] GA hit missing, retrying push',
      tracker.id,
      'attempt',
      tracker.attempts + 1,
      '/',
      tracker.maxAttempts,
    );
    emit({
      kind: 'note',
      ts: Date.now(),
      message: `push_retry:${tracker.command.origin ?? 'console'}:${trackerId}:${
        tracker.attempts + 1
      }/${tracker.maxAttempts}`,
    });
    void triggerTrackerAttempt(tracker, emit);
    return;
  }

  trackers.delete(trackerId);
  emit({
    kind: 'push.result',
    ts: Date.now(),
    id: tracker.id,
    ok: false,
    reason: 'timeout',
    attempts: tracker.attempts,
    maxAttempts: tracker.maxAttempts,
  });
}

type CurrentRun = {
  useCaseId: string;
  expected: ExpectedCall;
  timer: NodeJS.Timeout;
  seenPatternMatch: boolean;
  timeoutMs: number;
};

let currentRun: CurrentRun | null = null;

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

function matchesExpectedCall(expected: ExpectedCall, url: string, params: URLSearchParams, eventName?: string): boolean {
  let regex: RegExp;
  try {
    regex = new RegExp(expected.urlPattern);
  } catch {
    return false;
  }

  if (!regex.test(url)) {
    return false;
  }

  if (expected.mustContainParams) {
    for (const [key, value] of Object.entries(expected.mustContainParams)) {
      const trimmedValue = value.trim();
      if (!trimmedValue) continue;

      if (key === 'en' || key === '_en') {
        const actual = params.get('en') ?? params.get('_en') ?? eventName ?? '';
        if (actual !== trimmedValue) {
          return false;
        }
        continue;
      }

      if (key === 'tid' || key === 'measurement_id') {
        const actual = params.get('tid') ?? params.get('measurement_id') ?? '';
        if (actual !== trimmedValue) {
          return false;
        }
        continue;
      }

      if ((params.get(key) ?? '') !== trimmedValue) {
        return false;
      }
    }
  }

  return true;
}

function handleUseCaseCollect(data: { url: string; status?: number; params: URLSearchParams; eventName?: string }) {
  if (!currentRun) return;

  const run = currentRun;
  let regex: RegExp;
  try {
    regex = new RegExp(run.expected.urlPattern);
  } catch {
    return;
  }

  if (!regex.test(data.url)) {
    return;
  }

  const paramsMatch = matchesExpectedCall(run.expected, data.url, data.params, data.eventName);
  if (!paramsMatch) {
    run.seenPatternMatch = true;
    return;
  }

  void finishCurrentRun({
    ts: Date.now(),
    ok: true,
    matchedUrl: data.url,
    status: data.status,
  });
}

async function finishCurrentRun(result: RunResultSummary) {
  if (!currentRun) return;
  const run = currentRun;
  currentRun = null;
  clearTimeout(run.timer);

  const event: NormalizedEvent = {
    kind: 'push.result',
    ts: result.ts,
    id: run.useCaseId,
    ok: result.ok,
    matched: result.ok && result.matchedUrl
      ? [{ url: result.matchedUrl, status: result.status }]
      : undefined,
    reason: result.ok ? undefined : result.reason,
  };

  broadcast(event);
  try {
    await pushUseCasesStorage.updateLastResult(run.useCaseId, result);
  } catch (err) {
    console.error('[LIVE-DEBUGGER] Failed updating use case result', err);
  }
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
      const meta =
        d && typeof d.meta === 'object' && d.meta
          ? {
              pushId: typeof d.meta.pushId === 'string' ? d.meta.pushId : undefined,
              origin: typeof d.meta.origin === 'string' ? d.meta.origin : undefined,
              mode:
                d.meta.mode === 'datalayer' || d.meta.mode === 'gtag'
                  ? d.meta.mode
                  : undefined,
            }
          : undefined;

      emit({
        kind: 'datalayer.push',
        ts: typeof d.ts === 'number' ? d.ts : Date.now(),
        source: d.source,
        payload: d.payload,
        meta,
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
            if (t.timeoutHandle) {
              clearTimeout(t.timeoutHandle);
              t.timeoutHandle = undefined;
            }
            t.matches.push({ url, status });
            trackers.delete(t.id);
            emit({
              kind: 'push.result',
              ts: now,
              id: t.id,
              ok: true,
              matched: t.matches,
              attempts: t.attempts,
              maxAttempts: t.maxAttempts,
            });
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

  trackers.forEach((t) => {
    if (t.timeoutHandle) {
      clearTimeout(t.timeoutHandle);
    }
  });
  trackers.clear();

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

export async function push(
  cmdNoId: Omit<PushCommand, 'id'>,
  emit: (e: NormalizedEvent) => void,
) {
  if (!page) {
    throw new Error('No active session');
  }

  const id = crypto.randomUUID();
  const timeoutMs = cmdNoId.timeoutMs ?? 5000;
  const origin = cmdNoId.origin ?? 'console';
  const shouldTrack = cmdNoId.trackCollect ?? true;
  const command: Omit<PushCommand, 'id'> & { origin?: string } = { ...cmdNoId, origin };

  if (!shouldTrack) {
    try {
      await evaluatePushCommand(id, command);
      emit({
        kind: 'push.result',
        ts: Date.now(),
        id,
        ok: true,
        matched: [],
        attempts: 1,
        maxAttempts: 1,
      });
    } catch {
      emit({
        kind: 'push.result',
        ts: Date.now(),
        id,
        ok: false,
        reason: 'error',
        attempts: 1,
        maxAttempts: 1,
      });
    }
    return id;
  }

  const eventName =
    cmdNoId.mode === 'gtag' ? cmdNoId.name : (cmdNoId.payload?.event || undefined);

  let customPattern: RegExp | undefined;
  if (cmdNoId.match === 'custom' && cmdNoId.customUrlPattern) {
    try {
      customPattern = new RegExp(cmdNoId.customUrlPattern);
    } catch {
      customPattern = undefined;
    }
  }

  const tracker: PushTracker = {
    id,
    tsStart: Date.now(),
    timeoutMs,
    mode: cmdNoId.mode,
    match: cmdNoId.match ?? 'auto',
    eventName,
    customUrlPattern: customPattern,
    matches: [],
    attempts: 0,
    maxAttempts: origin === 'console' || origin === 'library' ? MAX_PUSH_ATTEMPTS : 1,
    command,
  };

  await triggerTrackerAttempt(tracker, emit);

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

    for (const sel of selectors) {
      try {
        await page.locator(sel).first().click({ timeout: 1000 });
        emit({ kind: 'note', ts: Date.now(), message: 'consent:clicked_main' });
        clicked = true;
        break;
      } catch {}
    }

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

  // Check if OneTrust is present
  const hasOneTrust = await page.evaluate(() => {
    const win = window as any;
    return (
      typeof win.OneTrust === 'object' ||
      typeof win.Optanon === 'object' ||
      !!document.querySelector(
        '#onetrust-accept-btn-handler, #onetrust-accept-all-handler, .onetrust-accept-btn-handler, .ot-pc-accept-all, button[data-cookiebanner="accept_button"]'
      )
    );
  });

  if (hasOneTrust) {
    emit({ kind: 'note', ts: Date.now(), message: 'consent:onetrust_detected' });

    const selectors = [
      '#onetrust-accept-btn-handler',
      '#onetrust-accept-all-handler',
      '.onetrust-accept-btn-handler',
      '.ot-pc-accept-all',
      '#onetrust-consent-sdk button[aria-label*="Accept"]',
      '#onetrust-consent-sdk button[aria-label*="Accetta"]',
      'button[data-cookiebanner="accept_button"]',
      'button:has-text("Accept all")',
      'button:has-text("Accetta tutto")',
    ];

    let clicked = false;

    for (const sel of selectors) {
      try {
        await page.locator(sel).first().click({ timeout: 1200 });
        emit({ kind: 'note', ts: Date.now(), message: 'consent:onetrust_clicked_main' });
        clicked = true;
        break;
      } catch {}
    }

    if (!clicked) {
      const frames = page.frames().filter((frame) => {
        const url = frame.url();
        return /cookielaw\.org|onetrust|cookieconsent/i.test(url);
      });
      for (const frame of frames) {
        for (const sel of selectors) {
          try {
            await frame.locator(sel).first().click({ timeout: 1200 });
            emit({ kind: 'note', ts: Date.now(), message: 'consent:onetrust_clicked_iframe' });
            clicked = true;
            break;
          } catch {}
        }
        if (clicked) break;
      }
    }

    if (!clicked) {
      const apiAccepted = await page.evaluate(() => {
        const win = window as any;
        try {
          if (win.OneTrust && typeof win.OneTrust.AcceptAll === 'function') {
            win.OneTrust.AcceptAll(true);
            return true;
          }
          if (win.Optanon && typeof win.Optanon.AcceptAll === 'function') {
            win.Optanon.AcceptAll(true);
            return true;
          }
        } catch {
          // ignore errors
        }
        return false;
      });
      if (apiAccepted) {
        emit({ kind: 'note', ts: Date.now(), message: 'consent:onetrust_api_accept' });
        await page.waitForTimeout(500);
        return;
      }
    } else {
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

  // OneTrust detection
  const onetrust = await page.evaluate(() => {
    const win = window as any;
    const scripts = Array.from(document.querySelectorAll('script[src]'));
    const otScript = scripts.find((s) => {
      const src = s.getAttribute('src') || '';
      return /cookielaw\.org|onetrust|otSDKStub\.js/i.test(src);
    });

    const hasOneTrust =
      typeof win.OneTrust === 'object' ||
      typeof win.Optanon === 'object' ||
      !!document.querySelector('#onetrust-accept-btn-handler, #onetrust-accept-all-handler, .onetrust-accept-btn-handler');

    const version =
      (win.OneTrust && (win.OneTrust.OtVersion || win.OneTrust.otVersion)) ||
      (win.Optanon && win.Optanon.version) ||
      undefined;

    let consentStatus: string | undefined;
    try {
      if (win.OneTrust && typeof win.OneTrust.GetConsentStatus === 'function') {
        const status = win.OneTrust.GetConsentStatus();
        if (typeof status === 'string' && status.trim()) {
          consentStatus = status.trim();
        }
      } else if (win.OneTrust && typeof win.OneTrust.IsAlertBoxClosed === 'function') {
        consentStatus = win.OneTrust.IsAlertBoxClosed() ? 'accepted' : 'pending';
      } else if (win.OptanonActiveGroups) {
        consentStatus = String(win.OptanonActiveGroups);
      }
    } catch {
      // ignore errors retrieving consent status
    }

    return {
      present: hasOneTrust || !!otScript,
      version: version ? String(version) : undefined,
      consentStatus,
    };
  });

  return { url, gtm, gtag, cookiebot, onetrust };
}

// GA Sniffer
export type OnCollect = (data: {
  url: string;
  status?: number;
  params: URLSearchParams;
  eventName?: string;
  measurementId?: string;
}) => void;

function attachGASniffer(
  page: Page,
  emit: (e: NormalizedEvent) => void,
  opts: { redactPII: boolean; onCollect?: OnCollect },
) {
  const requestMap = new Map<
    PlaywrightRequest,
    {
      url: string;
      ts: number;
      params: URLSearchParams;
      eventName?: string;
      mi?: string;
      cid?: string;
      isGA4: boolean;
      uaParams?: Record<string, string>;
    }
  >();

  page.on('request', (req) => {
    const url = req.url();
    if (!isGA(url)) return;

    const ts = Date.now();
    const method = req.method();
    const postData = req.postData();
    const params = mergeParams(url, method, postData);
    const isGA4 = params.has('en') || params.has('_en');

    let eventName: string | undefined;
    let mi: string | undefined;
    let cid: string | undefined;
    let uaParams: Record<string, string> | undefined;

    if (isGA4) {
      const event = parseGA4Event(params);
      eventName = event.name;
      mi = params.get('measurement_id') || params.get('tid') || undefined;
      cid = params.get('cid') || params.get('_cid') || undefined;
    } else {
      uaParams = {};
      params.forEach((v, k) => {
        uaParams![k] = v;
      });
    }

    requestMap.set(req, { url, ts, params, eventName, mi, cid, isGA4, uaParams });
  });

  page.on('response', async (resp) => {
    const req = resp.request();
    const url = resp.url();
    const record = requestMap.get(req);

    if (!record) {
      if (!isGA(url)) return;
      // fallback: create minimal record from response params
      const ts = Date.now();
      const params = mergeParams(url, 'GET');
      const isGA4 = params.has('en') || params.has('_en');
      requestMap.set(req, {
        url,
        ts,
        params,
        isGA4,
        eventName: undefined,
      });
    }

    const data = requestMap.get(req);
    if (!data) return;

    const status = resp.status();
    const ts = data.ts;
    const params = data.params;
    const { eventName, mi, cid, isGA4 } = data;

    if (isGA4) {
      const event = parseGA4Event(params);
      const measurementId = mi ?? params.get('measurement_id') ?? params.get('tid') ?? undefined;
      const clientId = cid ?? params.get('cid') ?? params.get('_cid') ?? undefined;
      emit({
        kind: 'ga4.hit',
        ts,
        url: data.url,
        status,
        event,
        mi: measurementId,
        cid: clientId,
      });

      if (opts.onCollect) {
        opts.onCollect({
          url: data.url,
          status,
          params,
          eventName: event.name ?? eventName,
          measurementId,
        });
      }
      handleUseCaseCollect({
        url: data.url,
        status,
        params,
        eventName: event.name ?? eventName,
      });
    } else {
      const paramsObj: Record<string, string> = data.uaParams ?? {};
      if (Object.keys(paramsObj).length === 0) {
        params.forEach((v, k) => {
          paramsObj[k] = v;
        });
      }

      emit({
        kind: 'ua.hit',
        ts,
        url: data.url,
        status,
        params: paramsObj,
      });

      if (opts.onCollect) {
        opts.onCollect({ url: data.url, status, params, eventName });
      }
      handleUseCaseCollect({ url: data.url, status, params, eventName });
    }

    requestMap.delete(req);
  });

  page.on('requestfailed', (req) => {
    if (!isGA(req.url())) return;
    const record = requestMap.get(req);
    if (!record) return;

    const ts = record.ts;
    const params = record.params;

    if (record.isGA4) {
      const event = parseGA4Event(params);
      emit({
        kind: 'ga4.hit',
        ts,
        url: record.url,
        status: undefined,
        event,
        mi: record.mi,
        cid: record.cid,
      });
      handleUseCaseCollect({ url: record.url, params, eventName: event.name ?? record.eventName });
    } else {
      const paramsObj = record.uaParams ?? {};
      emit({
        kind: 'ua.hit',
        ts,
        url: record.url,
        params: paramsObj,
      });
      handleUseCaseCollect({ url: record.url, params, eventName: record.eventName });
    }

    if (opts.onCollect) {
      opts.onCollect({ url: record.url, params, eventName: record.eventName, status: undefined, measurementId: record.mi });
    }

    requestMap.delete(req);
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

async function runUseCase(uc: PushUseCase): Promise<void> {
  if (!page) {
    throw new Error('No active session');
  }

  if (currentRun) {
    throw new Error('Another use case is currently running');
  }

  const timeoutMs = uc.timeoutMs ?? 5000;
  const timer = setTimeout(() => {
    if (!currentRun) return;
    const reason: 'timeout' | 'nomatch' = currentRun.seenPatternMatch ? 'nomatch' : 'timeout';
    void finishCurrentRun({
      ts: Date.now(),
      ok: false,
      reason,
    });
  }, timeoutMs);

  currentRun = {
    useCaseId: uc.id,
    expected: uc.expected,
    timer,
    seenPatternMatch: false,
    timeoutMs,
  };

  try {
    if (uc.mode === 'datalayer') {
      await page.evaluate(
        ({ payload, pushId }) => {
          const win = window as any;
          win.__ldPendingPushMeta = { pushId, origin: 'usecase', mode: 'datalayer' };
          win.dataLayer = win.dataLayer || [];
          win.dataLayer.push(payload);
          setTimeout(() => {
            if (win.__ldPendingPushMeta?.pushId === pushId) {
              delete win.__ldPendingPushMeta;
            }
          }, 0);
        },
        { payload: uc.payload, pushId: uc.id },
      );
    } else {
      await page.evaluate(
        ({ name, params, pushId }) => {
          const win = window as any;
          win.__ldPendingPushMeta = { pushId, origin: 'usecase', mode: 'gtag' };
          win.gtag && win.gtag('event', name, params || {});
          setTimeout(() => {
            if (win.__ldPendingPushMeta?.pushId === pushId) {
              delete win.__ldPendingPushMeta;
            }
          }, 0);
        },
        { name: uc.gtagName, params: uc.gtagParams ?? {}, pushId: uc.id },
      );
    }
  } catch (err) {
    void finishCurrentRun({
      ts: Date.now(),
      ok: false,
      reason: 'error',
    });
  }
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

// Push Use Cases API
app.get('/api/usecases', async (req, res) => {
  try {
    const origin = typeof req.query.origin === 'string' ? req.query.origin : undefined;
    const useCases = await pushUseCasesStorage.list(origin);
    res.json(useCases);
  } catch (err: any) {
    console.error('[LIVE-DEBUGGER] API /usecases GET error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/usecases', async (req, res) => {
  try {
    const parsed = UseCaseCreateSchema.parse(req.body);
    if (parsed.mode === 'datalayer' && typeof parsed.payload === 'undefined') {
      return res.status(400).json({ error: 'payload is required for datalayer mode' });
    }
    if (parsed.mode === 'gtag' && !parsed.gtagName) {
      return res.status(400).json({ error: 'gtagName is required for gtag mode' });
    }
    const created = await pushUseCasesStorage.create(parsed);
    res.status(201).json(created);
  } catch (err: any) {
    console.error('[LIVE-DEBUGGER] API /usecases POST error:', err);
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.message });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

app.put('/api/usecases/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const existing = await pushUseCasesStorage.get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Use case not found' });
    }

    const updates = UseCaseUpdateSchema.parse(req.body);
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    const nextMode = updates.mode ?? existing.mode;
    const nextPayload = updates.payload ?? existing.payload;
    const nextGtagName = updates.gtagName ?? existing.gtagName;

    if (nextMode === 'datalayer' && typeof nextPayload === 'undefined') {
      return res.status(400).json({ error: 'payload is required for datalayer mode' });
    }
    if (nextMode === 'gtag' && !nextGtagName) {
      return res.status(400).json({ error: 'gtagName is required for gtag mode' });
    }

    const updated = await pushUseCasesStorage.update(id, updates);
    res.json(updated);
  } catch (err: any) {
    console.error('[LIVE-DEBUGGER] API /usecases PUT error:', err);
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.message });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

app.delete('/api/usecases/:id', async (req, res) => {
  try {
    const deleted = await pushUseCasesStorage.delete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Use case not found' });
    }
    res.json({ success: true });
  } catch (err: any) {
    console.error('[LIVE-DEBUGGER] API /usecases DELETE error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/usecases/:id/run', async (req, res) => {
  try {
    if (!running || !page) {
      return res.status(400).json({ error: 'Live debugger session is not running' });
    }
    if (currentRun) {
      return res.status(409).json({ error: 'Another use case run is already in progress' });
    }
    const useCase = await pushUseCasesStorage.get(req.params.id);
    if (!useCase) {
      return res.status(404).json({ error: 'Use case not found' });
    }
    await runUseCase(useCase);
    const runId = crypto.randomUUID();
    res.json({ runId });
  } catch (err: any) {
    console.error('[LIVE-DEBUGGER] API /usecases RUN error:', err);
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

app.post('/api/ai/insight', async (req, res) => {
  if (!openaiClient) {
    return res.status(400).json({ error: 'Servizio AI non configurato (manca OPENAI_API_KEY).' });
  }

  const parseResult = AiAssistantRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'Payload non valido',
      details: parseResult.error.issues,
    });
  }

  const { event, insights, intent, question } = parseResult.data;

  if (intent === 'qa' && (!question || !question.trim())) {
    return res.status(400).json({ error: 'La domanda non può essere vuota.' });
  }

  const eventSummary = describeEventForAi(event as NormalizedEvent);
  const insightSummary = formatInsightsForAi(insights as EventInsight[]);

  let requestInstruction = '';
  switch (intent) {
    case 'explain':
      requestInstruction =
        'Spiega in modo sintetico ma chiaro, in italiano, quale problema evidenziano questi insight e quali rischi o impatti possono causare sul tracciamento o sulla lettura dei dati.';
      break;
    case 'fix':
      requestInstruction =
        'Suggerisci una lista di azioni concrete per risolvere gli insight emersi. Fornisci passi operativi, includendo esempi di configurazione GTM/GA4 quando opportuno.';
      break;
    case 'qa':
      requestInstruction = `Rispondi alla seguente domanda dell\'utente in modo pratico e basato sui dati forniti: "${question?.trim()}"`;
      break;
    default:
      requestInstruction = 'Fornisci assistenza contestuale basata sugli insight.';
  }

  const messages = [
    {
      role: 'system' as const,
      content:
        'Sei un assistente esperto di analytics e tagging. Rispondi sempre in italiano, con tono professionale ma conciso. Fornisci output in Markdown semplice (paragrafi, elenchi puntati) quando utile.',
    },
    {
      role: 'user' as const,
      content: [
        '### Contesto evento',
        eventSummary,
        '',
        '### Insight collegati',
        insightSummary,
        '',
        '### Richiesta',
        requestInstruction,
      ].join('\n'),
    },
  ];

  const temperature = intent === 'fix' ? 0.6 : intent === 'qa' ? 0.55 : 0.35;

  try {
    const completion = await openaiClient.chat.completions.create({
      model: OPENAI_MODEL,
      temperature,
      max_tokens: 650,
      messages,
    });

    const answer = completion.choices[0]?.message?.content?.trim();

    if (!answer) {
      return res.status(502).json({ error: 'Risposta vuota dal modello AI.' });
    }

    res.json({
      intent,
      answer,
      usage: completion.usage ?? null,
    });
  } catch (err: any) {
    console.error('AI insight error:', err);
    const message =
      err?.response?.data?.error?.message ||
      err?.message ||
      'Errore durante la generazione della risposta AI.';
    res.status(500).json({ error: message });
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
