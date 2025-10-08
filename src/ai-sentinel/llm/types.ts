export type LLMScenarioType = 'accept' | 'reject' | 'custom';

export interface LLMScenarioDetails {
  type: LLMScenarioType;
  customPreferences?: {
    analytics?: boolean;
    marketing?: boolean;
    preferences?: boolean;
  };
}

export interface ConsentLLMContext {
  pageUrl: string;
  scenario: LLMScenarioDetails;
  bannerHtml: string;
  bannerTextSnippet: string;
  languageHints: string[];
}

export type LLMActionType = 'click' | 'waitForHidden' | 'waitForVisible';

export interface LLMActionTarget {
  selector?: string;
  role?: 'button' | 'link' | 'checkbox' | 'switch' | 'generic';
  text?: string;
  contains?: string;
  description?: string;
}

export interface LLMActionStep {
  action: LLMActionType;
  target: LLMActionTarget;
  confidence: number;
  rationale?: string;
  timeoutMs?: number;
}

export interface LLMResolution {
  steps: LLMActionStep[];
  model: string;
  usageTokens?: number;
  cacheKey?: string;
  cacheHit?: boolean;
  raw?: unknown;
}

export interface ConsentLLMRequest {
  context: ConsentLLMContext;
  maxRetries?: number;
  previousAttempts?: Array<{ error: string }>;
}

export interface ConsentLLMServiceOptions {
  apiKey: string;
  model?: string;
  cacheTtlMs?: number;
  temperature?: number;
}

export interface CachedLLMEntry {
  cacheKey: string;
  createdAt: number;
  model: string;
  scenario: LLMScenarioDetails;
  steps: LLMActionStep[];
  metadata?: {
    bannerSignature: string;
    hostname: string;
  };
}

export interface LLMCacheSnapshot {
  version: number;
  entries: CachedLLMEntry[];
}

export interface LLMPlanCache {
  load(cacheKey: string): Promise<CachedLLMEntry | undefined>;
  save(entry: CachedLLMEntry): Promise<void>;
  purgeExpired(ttlMs: number): Promise<void>;
}
