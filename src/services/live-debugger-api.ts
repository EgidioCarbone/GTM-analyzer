import type { StartPayload, NormalizedEvent } from '../types/live-debugger';
import type { PushCase, PushCaseCreate, PushCaseUpdate } from '../types/push-cases';
import type { PushUseCase, ExpectedCall, RunResultSummary } from '../../shared/types';
import type { EventInsight } from '../../shared/analyzer';
import { getApiBaseUrl, getWsBaseUrl } from '../utils/api-base';

const baseUrl = getApiBaseUrl();
const API_BASE = baseUrl ? `${baseUrl}/api/live` : '/api/live';
const wsBase = getWsBaseUrl();
const WS_BASE =
  wsBase ||
  (baseUrl ? baseUrl.replace(/^http/i, 'ws') : '') ||
  (typeof window !== 'undefined' ? `ws://${window.location.host}` : '');

export type PushUseCaseDraft = {
  name: string;
  origin: string;
  mode: 'datalayer' | 'gtag';
  payload?: any;
  gtagName?: string;
  gtagParams?: Record<string, any>;
  expected?: ExpectedCall;
  timeoutMs?: number;
};

export type PushUseCaseUpdateInput = Partial<PushUseCaseDraft>;

export type AiAssistantIntent = 'explain' | 'fix' | 'qa';

export interface AiAssistantResponse {
  intent: AiAssistantIntent;
  answer: string;
  usage?: {
    promptTokens?: number | null;
    completionTokens?: number | null;
    totalTokens?: number | null;
  } | null;
}

export async function startLiveDebugger(payload: StartPayload): Promise<void> {
  const res = await fetch(`${API_BASE}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const raw = await res.text();
    try {
      const parsed = raw ? JSON.parse(raw) : null;
      throw new Error(parsed?.error || 'Failed to start session');
    } catch (parseErr) {
      if (parseErr instanceof SyntaxError) {
        const message =
          raw?.trim()
            ? raw
            : `Live debugger server responded with HTTP ${res.status} (${res.statusText || 'unknown'})`;
        throw new Error(message);
      }
      throw parseErr;
    }
  }
}

export async function stopLiveDebugger(): Promise<void> {
  const res = await fetch(`${API_BASE}/stop`, {
    method: 'POST',
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to stop session');
  }
}

export async function getLiveDebuggerStatus(): Promise<{ running: boolean }> {
  const res = await fetch(`${API_BASE}/status`);
  if (!res.ok) {
    throw new Error('Failed to get status');
  }
  return res.json();
}

// Push Use Cases API
export async function getPushUseCases(origin?: string): Promise<PushUseCase[]> {
  const params = new URLSearchParams();
  if (origin) params.append('origin', origin);

  const res = await fetch(`${API_BASE}/usecases?${params}`);
  if (!res.ok) {
    throw new Error('Failed to get push use cases');
  }
  return res.json();
}

export async function createPushUseCase(input: PushUseCaseDraft): Promise<PushUseCase> {
  const res = await fetch(`${API_BASE}/usecases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create use case');
  }

  return res.json();
}

export async function updatePushUseCase(id: string, updates: PushUseCaseUpdateInput): Promise<PushUseCase> {
  const res = await fetch(`${API_BASE}/usecases/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update use case');
  }

  return res.json();
}

export async function deletePushUseCase(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/usecases/${id}`, {
    method: 'DELETE',
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to delete use case');
  }
}

export async function runPushUseCase(id: string): Promise<{ runId: string }> {
  const res = await fetch(`${API_BASE}/usecases/${id}/run`, {
    method: 'POST',
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to run use case');
  }

  return res.json();
}

export async function requestAiAssistant(
  event: NormalizedEvent,
  insights: EventInsight[],
  intent: AiAssistantIntent,
  question?: string,
): Promise<AiAssistantResponse> {
  const payload: Record<string, unknown> = {
    event,
    insights,
    intent,
  };
  if (question && question.trim()) {
    payload.question = question.trim();
  }

  const res = await fetch(`${API_BASE}/ai/insight`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let message = 'Assistente AI non disponibile';
    try {
      const err = await res.json();
      message = err.error || message;
    } catch {
      // ignore parse error
    }
    throw new Error(message);
  }

  return res.json();
}

// Push Cases API
export async function getPushCases(origin?: string, search?: string): Promise<PushCase[]> {
  const params = new URLSearchParams();
  if (origin) params.append('origin', origin);
  if (search) params.append('search', search);
  
  const res = await fetch(`${API_BASE}/cases?${params}`);
  if (!res.ok) {
    throw new Error('Failed to get push cases');
  }
  return res.json();
}

export async function createPushCase(caseData: PushCaseCreate): Promise<PushCase> {
  const res = await fetch(`${API_BASE}/cases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(caseData),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to create push case');
  }

  return res.json();
}

export async function updatePushCase(id: string, updates: PushCaseUpdate): Promise<PushCase> {
  const res = await fetch(`${API_BASE}/cases/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to update push case');
  }

  return res.json();
}

export async function deletePushCase(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/cases/${id}`, {
    method: 'DELETE',
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to delete push case');
  }
}

export async function runPushCase(id: string): Promise<{ id: string }> {
  const res = await fetch(`${API_BASE}/cases/${id}/run`, {
    method: 'POST',
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to run push case');
  }

  return res.json();
}

export async function exportPushCases(origin?: string): Promise<PushCase[]> {
  const params = new URLSearchParams();
  if (origin) params.append('origin', origin);
  
  const res = await fetch(`${API_BASE}/cases/export?${params}`);
  if (!res.ok) {
    throw new Error('Failed to export push cases');
  }
  return res.json();
}

export async function importPushCases(cases: PushCase[], overwrite = false): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const res = await fetch(`${API_BASE}/cases/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cases, overwrite }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to import push cases');
  }

  return res.json();
}

export function connectLiveDebuggerEvents(
  onEvent: (event: NormalizedEvent) => void,
  onError?: (err: Event) => void
): WebSocket {
  const candidates: string[] = [];
  if (WS_BASE) {
    candidates.push(`${WS_BASE}/events`);
  }
  if (import.meta.env.DEV) {
    candidates.push('ws://localhost:5180/events');
  }

  let ws: WebSocket | null = null;
  let attemptIndex = 0;

  const connectNext = () => {
    if (attemptIndex >= candidates.length) {
      console.error('[live-debugger] WS failed: no more candidates');
      return;
    }
    const wsUrl = candidates[attemptIndex++];
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('[live-debugger] WS connected:', wsUrl);
    };

    ws.onmessage = (msg) => {
      const handleText = (text: string) => {
        try {
          const event = JSON.parse(text) as NormalizedEvent;
          onEvent(event);
        } catch (err) {
          console.error('Failed to parse event:', err);
        }
      };

      const data = msg.data as unknown;
      if (typeof data === 'string') {
        handleText(data);
        return;
      }
      if (data instanceof Blob) {
        data.text().then(handleText).catch((err) => {
          console.error('Failed to read WS blob:', err);
        });
        return;
      }
      if (data instanceof ArrayBuffer) {
        const text = new TextDecoder().decode(new Uint8Array(data));
        handleText(text);
        return;
      }
      try {
        handleText(String(data));
      } catch (err) {
        console.error('Failed to parse event:', err);
      }
    };

    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
      onError?.(err);
    };

    ws.onclose = (evt) => {
      console.warn('[live-debugger] WS closed:', evt.code, evt.reason);
      if (evt.code !== 1000) {
        connectNext();
      }
    };
  };

  connectNext();
  return ws as WebSocket;
}

export async function pushLiveDebugger(cmd: Omit<import('../types/live-debugger').PushCommand, 'id'>): Promise<{ id: string }> {
  const res = await fetch(`${API_BASE}/push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Push failed');
  }

  return res.json();
}
