import type { StartPayload, NormalizedEvent } from '../types/live-debugger';
import type { PushCase, PushCaseCreate, PushCaseUpdate } from '../types/push-cases';

const API_BASE = import.meta.env.DEV ? '/live-debugger' : '';
const WS_BASE = import.meta.env.DEV ? 'ws://localhost:5180' : `ws://${window.location.host}`;

export async function startLiveDebugger(payload: StartPayload): Promise<void> {
  const res = await fetch(`${API_BASE}/api/start`, {
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
  const res = await fetch(`${API_BASE}/api/stop`, {
    method: 'POST',
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to stop session');
  }
}

export async function getLiveDebuggerStatus(): Promise<{ running: boolean }> {
  const res = await fetch(`${API_BASE}/api/status`);
  if (!res.ok) {
    throw new Error('Failed to get status');
  }
  return res.json();
}

// Push Cases API
export async function getPushCases(origin?: string, search?: string): Promise<PushCase[]> {
  const params = new URLSearchParams();
  if (origin) params.append('origin', origin);
  if (search) params.append('search', search);
  
  const res = await fetch(`${API_BASE}/api/cases?${params}`);
  if (!res.ok) {
    throw new Error('Failed to get push cases');
  }
  return res.json();
}

export async function createPushCase(caseData: PushCaseCreate): Promise<PushCase> {
  const res = await fetch(`${API_BASE}/api/cases`, {
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
  const res = await fetch(`${API_BASE}/api/cases/${id}`, {
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
  const res = await fetch(`${API_BASE}/api/cases/${id}`, {
    method: 'DELETE',
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to delete push case');
  }
}

export async function runPushCase(id: string): Promise<{ id: string }> {
  const res = await fetch(`${API_BASE}/api/cases/${id}/run`, {
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
  
  const res = await fetch(`${API_BASE}/api/cases/export?${params}`);
  if (!res.ok) {
    throw new Error('Failed to export push cases');
  }
  return res.json();
}

export async function importPushCases(cases: PushCase[], overwrite = false): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const res = await fetch(`${API_BASE}/api/cases/import`, {
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
  const ws = new WebSocket(`${WS_BASE}/events`);

  ws.onmessage = (msg) => {
    try {
      const event = JSON.parse(msg.data) as NormalizedEvent;
      onEvent(event);
    } catch (err) {
      console.error('Failed to parse event:', err);
    }
  };

  ws.onerror = (err) => {
    console.error('WebSocket error:', err);
    onError?.(err);
  };

  return ws;
}

export async function pushLiveDebugger(cmd: Omit<import('../types/live-debugger').PushCommand, 'id'>): Promise<{ id: string }> {
  const res = await fetch(`${API_BASE}/api/push`, {
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
