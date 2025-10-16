import { z } from 'zod';

export interface PushCase {
  id: string;                    // uuid
  name: string;                  // es. "acquista"
  origin: string;                // window.location.origin a cui è legato
  mode: 'datalayer'|'gtag';
  payload?: any;                 // se mode='datalayer' (può contenere macro)
  gtagName?: string;             // se mode='gtag'
  gtagParams?: Record<string, any>;
  trackCollect?: boolean;        // default true
  match?: 'auto'|'eventName'|'any'|'custom';
  customUrlPattern?: string;     // regex se match='custom'
  timeoutMs?: number;            // default 5000
  tags?: string[];
  createdAt: number;
  lastUsedAt?: number;
  version: 1;
}

export const PushCaseSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  origin: z.string().url(),
  mode: z.enum(['datalayer', 'gtag']),
  payload: z.any().optional(),
  gtagName: z.string().optional(),
  gtagParams: z.record(z.any()).optional(),
  trackCollect: z.boolean().default(true),
  match: z.enum(['auto', 'eventName', 'any', 'custom']).default('auto'),
  customUrlPattern: z.string().optional(),
  timeoutMs: z.number().min(1000).max(30000).default(5000),
  tags: z.array(z.string()).default([]),
  createdAt: z.number(),
  lastUsedAt: z.number().optional(),
  version: z.literal(1),
});

export interface PushCaseCreate {
  name: string;
  origin: string;
  mode: 'datalayer'|'gtag';
  payload?: any;
  gtagName?: string;
  gtagParams?: Record<string, any>;
  trackCollect?: boolean;
  match?: 'auto'|'eventName'|'any'|'custom';
  customUrlPattern?: string;
  timeoutMs?: number;
  tags?: string[];
}

export interface PushCaseUpdate extends Partial<PushCaseCreate> {
  id: string;
}

export interface PushCaseRunResult {
  id: string;
  ok: boolean;
  reason?: 'timeout'|'error';
  matched?: { url: string; status?: number }[];
  timestamp: number;
}

export interface MacroContext {
  url?: string;
  env?: Record<string, string>;
  counters?: Record<string, number>;
}
