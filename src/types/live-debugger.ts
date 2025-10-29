// Tipi per Live Debugger
export interface DataLayerPushMeta {
  pushId?: string;
  origin?: 'console' | 'library' | 'usecase' | 'api';
  mode?: PushMode;
}

export type PushMode = 'datalayer' | 'gtag' | 'meta' | 'linkedin' | 'adobe';

export type NormalizedEvent =
  | { kind: 'env'; ts: number; env: EnvInfo }
  | { kind: 'note'; ts: number; message: string }
  | { kind: 'console'; ts: number; level: 'log'|'warn'|'error'; text: string }
  | { kind: 'datalayer.push'; ts: number; source: 'snapshot'|'hook'; payload: unknown; meta?: DataLayerPushMeta }
  | { kind: 'ga4.hit'; ts: number; url: string; status?: number; event?: Ga4Event; mi?: string; cid?: string; origin?: 'console' | 'library' | 'usecase' | 'api'; pushId?: string }
  | { kind: 'ua.hit'; ts: number; url: string; status?: number; params: Record<string,string>; origin?: 'console' | 'library' | 'usecase' | 'api'; pushId?: string }
  | { kind: 'meta.hit'; ts: number; url: string; status?: number; eventName?: string; pixelId?: string; conversionId?: string; params: Record<string, string>; dl?: string; origin?: 'console' | 'library' | 'usecase' | 'api'; pushId?: string }
  | { kind: 'linkedin.hit'; ts: number; url: string; status?: number; eventName?: string; trackingId?: string; conversionId?: string; params: Record<string, string>; origin?: 'console' | 'library' | 'usecase' | 'api'; pushId?: string }
  | { kind: 'adobe.hit'; ts: number; url: string; status?: number; reportSuite?: string; eventType?: string; params: Record<string, string>; origin?: 'console' | 'library' | 'usecase' | 'api'; pushId?: string }
  | { kind: 'page.view'; ts: number; url: string; title?: string; source: 'navigation' | 'history' | 'manual' | 'ga4'; origin?: 'console' | 'library' | 'usecase' | 'api'; pushId?: string }
  | {
      kind: 'push.command';
      ts: number;
      id: string;
      origin: 'console' | 'library' | 'usecase' | 'api';
      mode: PushMode;
      payload?: any;
      name?: string;
      params?: Record<string, any>;
      meta?: PushCommand['meta'];
      linkedin?: PushCommand['linkedin'];
      adobe?: PushCommand['adobe'];
      trackCollect?: boolean;
      timeoutMs?: number;
      match?: PushCommand['match'];
      customUrlPattern?: string;
    }
  | {
      kind: 'push.result';
      ts: number;
      id: string;
      ok: boolean;
      reason?: 'timeout' | 'error' | 'nomatch';
      matched?: { url: string; status?: number }[];
      attempts?: number;
      maxAttempts?: number;
    };

export interface Ga4Event {
  name?: string;                       // en | _en
  params: Record<string, unknown>;
  items?: Array<Record<string, unknown>>;
}

export interface EnvInfo {
  url: string;
  gtm: { present: boolean; containerId?: string };
  gtag: { present: boolean; measurementIds?: string[] };
  cookiebot: { present: boolean; version?: string };
  onetrust: { present: boolean; version?: string; consentStatus?: string };
}

export interface StartPayload {
  url: string;
  headless?: boolean;         // default: true
  waitUntil?: 'load'|'domcontentloaded'|'networkidle';
  timeoutMs?: number;         // default: 30000
  redactPII?: boolean;        // default: true
}

export interface PushCommand {
  id: string;                     // uuid lato server
  mode: PushMode;
  payload?: any;                  // usato se mode='datalayer'
  name?: string;                  // usato se mode='gtag'
  params?: Record<string, any>;   // usato se mode='gtag'
  meta?: {
    eventName: string;
    params?: Record<string, any>;
    trackType?: 'track' | 'trackCustom';
    pixelId?: string;
    eventId?: string;
  };
  linkedin?: {
    conversionId: string;
    payload?: Record<string, any>;
    trackingId?: string;
  };
  adobe?: {
    call: 't' | 'tl';
    linkType?: string;
    linkName?: string;
    variables?: Record<string, any>;
    reportSuite?: string;
    endpoint?: string;
  };
  trackCollect?: boolean;         // default true
  timeoutMs?: number;             // default 5000
  match?: 'auto'|'eventName'|'any'|'custom';
  customUrlPattern?: string;      // regex su URL, se match='custom'
  origin?: 'console' | 'library' | 'usecase' | 'api';
}
