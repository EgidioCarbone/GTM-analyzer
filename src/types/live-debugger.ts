// Tipi per Live Debugger
export type NormalizedEvent =
  | { kind: 'env'; ts: number; env: EnvInfo }
  | { kind: 'note'; ts: number; message: string }
  | { kind: 'console'; ts: number; level: 'log'|'warn'|'error'; text: string }
  | { kind: 'datalayer.push'; ts: number; source: 'snapshot'|'hook'; payload: unknown }
  | { kind: 'ga4.hit'; ts: number; url: string; status?: number; event?: Ga4Event; mi?: string; cid?: string }
  | { kind: 'ua.hit'; ts: number; url: string; status?: number; params: Record<string,string> }
  | { kind: 'push.result'; ts: number; id: string; ok: boolean; reason?: 'timeout'|'error'|'nomatch'; matched?: { url: string; status?: number }[] };

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
  mode: 'datalayer'|'gtag';
  payload?: any;                  // usato se mode='datalayer'
  name?: string;                  // usato se mode='gtag'
  params?: Record<string, any>;   // usato se mode='gtag'
  trackCollect?: boolean;         // default true
  timeoutMs?: number;             // default 5000
  match?: 'auto'|'eventName'|'any'|'custom';
  customUrlPattern?: string;      // regex su URL, se match='custom'
}
