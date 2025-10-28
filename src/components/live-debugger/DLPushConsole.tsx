import React, { useState, useEffect } from 'react';
import type { PushCommand, NormalizedEvent } from '../../types/live-debugger';
import * as api from '../../services/live-debugger-api';

interface DLPushConsoleProps {
  onEvent: (event: NormalizedEvent) => void;
}

interface PushResult {
  id: string;
  ok: boolean;
  reason?: 'timeout' | 'error' | 'nomatch';
  matched?: { url: string; status?: number }[];
  timestamp: number;
}

const PRESETS = {
  page_view: { event: 'page_view' },
  view_item: { 
    event: 'view_item', 
    ecommerce: { 
      items: [{ item_id: 'SKU_123', item_name: 'Prodotto' }] 
    } 
  },
  add_to_cart: { 
    event: 'add_to_cart', 
    ecommerce: { 
      currency: 'EUR', 
      value: 19.9, 
      items: [{ item_id: 'SKU_123', quantity: 1 }] 
    } 
  },
  purchase: { 
    event: 'purchase', 
    ecommerce: { 
      transaction_id: 'T123', 
      value: 99, 
      currency: 'EUR', 
      items: [{ item_id: 'SKU_123' }] 
    } 
  }
};

export function DLPushConsole({ onEvent }: DLPushConsoleProps) {
  const [mode, setMode] = useState<'datalayer' | 'gtag'>('datalayer');
  const [eventName, setEventName] = useState('');
  const [payload, setPayload] = useState('{\n  "event": "page_view"\n}');
  const [gtagName, setGtagName] = useState('');
  const [gtagParams, setGtagParams] = useState('{\n  "custom_parameter": "value"\n}');
  const [trackCollect, setTrackCollect] = useState(true);
  const [matchMode, setMatchMode] = useState<'auto' | 'eventName' | 'any' | 'custom'>('auto');
  const [customPattern, setCustomPattern] = useState('');
  const [timeoutMs, setTimeoutMs] = useState(5000);
  const [preset, setPreset] = useState('');
  const [results, setResults] = useState<PushResult[]>([]);
  const [loading, setLoading] = useState(false);

  // Listen for push results
  useEffect(() => {
    const handleEvent = (event: NormalizedEvent) => {
      if (event.kind === 'push.result') {
        setResults(prev => [{
          id: event.id,
          ok: event.ok,
          reason: event.reason,
          matched: event.matched,
          timestamp: event.ts
        }, ...prev.slice(0, 9)].sort((a, b) => b.timestamp - a.timestamp)); // Keep last 10 results, sorted by timestamp desc
      }
      onEvent(event);
    };

    // This will be handled by the parent component's WebSocket connection
    // We just need to pass the handler up
  }, [onEvent]);

  const handlePresetChange = (presetName: string) => {
    if (presetName && PRESETS[presetName as keyof typeof PRESETS]) {
      const presetData = PRESETS[presetName as keyof typeof PRESETS];
      setEventName(presetData.event);
      setPayload(JSON.stringify(presetData, null, 2));
    }
    setPreset(presetName);
  };

  const handlePush = async () => {
    if (!mode) return;

    setLoading(true);
    try {
      let cmd: Omit<PushCommand, 'id'>;

      if (mode === 'datalayer') {
        let parsedPayload;
        try {
          parsedPayload = JSON.parse(payload);
        } catch (e) {
          alert('Invalid JSON in payload');
          return;
        }

        cmd = {
          mode: 'datalayer',
          payload: parsedPayload,
          trackCollect,
          timeoutMs,
          match: matchMode,
          customUrlPattern: matchMode === 'custom' ? customPattern : undefined
        };
      } else {
        let parsedParams;
        try {
          parsedParams = JSON.parse(gtagParams);
        } catch (e) {
          alert('Invalid JSON in gtag params');
          return;
        }

        cmd = {
          mode: 'gtag',
          name: gtagName,
          params: parsedParams,
          trackCollect,
          timeoutMs,
          match: matchMode,
          customUrlPattern: matchMode === 'custom' ? customPattern : undefined
        };
      }

      cmd.origin = 'console';

      const result = await api.pushLiveDebugger(cmd);
      console.log('Push initiated with ID:', result.id);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString('it-IT', { 
      hour12: false, 
      fractionalSecondDigits: 3 
    });
  };

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm ring-1 ring-black/5 space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Sperimentazione
          </p>
          <h3 className="text-lg font-semibold text-slate-900">DataLayer Push Console</h3>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600">
          Live
        </span>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:border-slate-300">
            <input
              type="radio"
              name="mode"
              value="datalayer"
              checked={mode === 'datalayer'}
              onChange={(e) => setMode(e.target.value as 'datalayer' | 'gtag')}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500"
            />
            DataLayer push
          </label>
          <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:border-slate-300">
            <input
              type="radio"
              name="mode"
              value="gtag"
              checked={mode === 'gtag'}
              onChange={(e) => setMode(e.target.value as 'datalayer' | 'gtag')}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500"
            />
            gtag('event')
          </label>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-600">
            Presets GA4
          </label>
          <select
            value={preset}
            onChange={(e) => handlePresetChange(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-inner focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            <option value="">Seleziona preset...</option>
            <option value="page_view">page_view</option>
            <option value="view_item">view_item</option>
            <option value="add_to_cart">add_to_cart</option>
            <option value="purchase">purchase</option>
          </select>
        </div>

        {mode === 'datalayer' && (
          <div className="space-y-3">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-600">
                Event Name
              </label>
              <input
                type="text"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                placeholder="page_view"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-inner focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-600">
                Payload JSON
              </label>
              <textarea
                value={payload}
                onChange={(e) => setPayload(e.target.value)}
                rows={6}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-700 shadow-inner focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                placeholder='{\n  "event": "page_view"\n}'
              />
            </div>
          </div>
        )}

        {mode === 'gtag' && (
          <div className="space-y-3">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-600">
                Event Name
              </label>
              <input
                type="text"
                value={gtagName}
                onChange={(e) => setGtagName(e.target.value)}
                placeholder="page_view"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-inner focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-600">
                Parameters JSON
              </label>
              <textarea
                value={gtagParams}
                onChange={(e) => setGtagParams(e.target.value)}
                rows={4}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-700 shadow-inner focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                placeholder='{\n  "custom_parameter": "value"\n}'
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 shadow-sm">
              <input
                type="checkbox"
                checked={trackCollect}
                onChange={(e) => setTrackCollect(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              Traccia collect
            </label>
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-600">
              Match Mode
            </label>
            <select
              value={matchMode}
              onChange={(e) => setMatchMode(e.target.value as any)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-inner focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              <option value="auto">Auto</option>
              <option value="eventName">Event Name</option>
              <option value="any">Any</option>
              <option value="custom">Custom URL</option>
            </select>
          </div>

          {matchMode === 'custom' && (
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-semibold text-slate-600">
                URL Pattern (Regex)
              </label>
              <input
                type="text"
                value={customPattern}
                onChange={(e) => setCustomPattern(e.target.value)}
                placeholder="google-analytics\.com.*collect"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-700 shadow-inner focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-600">
              Timeout (ms)
            </label>
            <input
              type="number"
              value={timeoutMs}
              onChange={(e) => setTimeoutMs(parseInt(e.target.value) || 5000)}
              min="1000"
              max="30000"
              step="1000"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-inner focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>

        <button
          onClick={handlePush}
          disabled={loading}
          className="w-full rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {loading ? 'Pushing...' : 'Push & Verifica'}
        </button>

        {results.length > 0 && (
          <div className="mt-2">
            <h4 className="mb-2 text-sm font-semibold text-slate-600">Risultati</h4>
            <div className="max-h-40 space-y-2 overflow-y-auto">
              {results.map((result, idx) => (
                <div
                  key={`${result.id}-${idx}`}
                  className={`rounded-2xl border px-3 py-2 text-xs ${
                    result.ok
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-red-200 bg-red-50 text-red-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono">{result.id.slice(0, 8)}</span>
                    <span className="font-mono">{formatTime(result.timestamp)}</span>
                  </div>
                  <div className="mt-1">
                    {result.ok ? (
                      <span>
                        ✅ OK {result.matched?.length ? `(${result.matched.length} collect)` : '(no collect)'}
                      </span>
                    ) : (
                      <span>❌ {result.reason?.toUpperCase() || 'ERROR'}</span>
                    )}
                  </div>
                  {result.matched && result.matched.length > 0 && (
                    <div className="mt-1 space-y-1 text-xs">
                      {result.matched.map((match, i) => (
                        <div key={i} className="truncate" title={match.url}>
                          {match.url} {match.status && `(${match.status})`}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
