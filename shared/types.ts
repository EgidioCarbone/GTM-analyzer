export interface ExpectedCall {
  urlPattern: string;
  mustContainParams?: Record<string, string>;
}

export interface RunResultSummary {
  ts: number;
  ok: boolean;
  matchedUrl?: string;
  status?: number;
  reason?: 'timeout' | 'error' | 'nomatch';
}

export interface PushUseCase {
  id: string;
  name: string;
  origin: string;
  mode: 'datalayer' | 'gtag';
  payload?: any;
  gtagName?: string;
  gtagParams?: Record<string, any>;
  expected: ExpectedCall;
  timeoutMs?: number;
  createdAt: number;
  updatedAt: number;
  lastResult?: RunResultSummary;
}
