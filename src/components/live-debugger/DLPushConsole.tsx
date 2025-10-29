import React, { useState, useEffect } from 'react';
import type { PushCommand, NormalizedEvent } from '../../types/live-debugger';
import * as api from '../../services/live-debugger-api';
import {
  ConsoleMode,
  DATALAYER_PRESETS,
  META_PRESETS,
  LINKEDIN_PRESETS,
  ADOBE_PRESETS,
  MODE_LABELS,
  DEFAULT_META_PRESET,
  DEFAULT_LINKEDIN_PRESET,
  DEFAULT_ADOBE_PRESET,
  formatJSON,
  getPresetOptions,
} from './pushPresets';

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


export function DLPushConsole({ onEvent }: DLPushConsoleProps) {
  const [mode, setMode] = useState<ConsoleMode>('datalayer');
  const [eventName, setEventName] = useState('page_view');
  const [payload, setPayload] = useState(formatJSON(DATALAYER_PRESETS.page_view));
  const [gtagName, setGtagName] = useState('page_view');
  const [gtagParams, setGtagParams] = useState(formatJSON({ custom_parameter: 'value' }));
  const [metaEventName, setMetaEventName] = useState(DEFAULT_META_PRESET.eventName);
  const [metaParams, setMetaParams] = useState(
    formatJSON(DEFAULT_META_PRESET.params ?? { event_id: 'meta-event-001' }),
  );
  const [metaPixelId, setMetaPixelId] = useState(DEFAULT_META_PRESET.pixelId ?? '');
  const [metaEventId, setMetaEventId] = useState(DEFAULT_META_PRESET.eventId ?? '');
  const [metaTrackType, setMetaTrackType] = useState<'track' | 'trackCustom'>(
    DEFAULT_META_PRESET.trackType ?? 'track',
  );
  const [linkedinConversionId, setLinkedinConversionId] = useState(
    DEFAULT_LINKEDIN_PRESET.conversionId,
  );
  const [linkedinTrackingId, setLinkedinTrackingId] = useState(
    DEFAULT_LINKEDIN_PRESET.trackingId ?? '',
  );
  const [linkedinPayload, setLinkedinPayload] = useState(
    formatJSON(DEFAULT_LINKEDIN_PRESET.payload ?? {
      value: 45,
      currency: 'EUR',
    }),
  );
  const [adobeCall, setAdobeCall] = useState<'t' | 'tl'>(DEFAULT_ADOBE_PRESET.call);
  const [adobeReportSuite, setAdobeReportSuite] = useState(
    DEFAULT_ADOBE_PRESET.reportSuite ?? 'debugsuite',
  );
  const [adobeLinkType, setAdobeLinkType] = useState(DEFAULT_ADOBE_PRESET.linkType ?? 'o');
  const [adobeLinkName, setAdobeLinkName] = useState(DEFAULT_ADOBE_PRESET.linkName ?? '');
  const [adobeVariables, setAdobeVariables] = useState(
    formatJSON(DEFAULT_ADOBE_PRESET.variables ?? {
      pageName: 'Live Debugger Demo',
    }),
  );
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

  const applyDefaultsForMode = (nextMode: ConsoleMode) => {
    if (nextMode === 'datalayer') {
      setEventName('page_view');
      setPayload(formatJSON(DATALAYER_PRESETS.page_view));
      return;
    }

    if (nextMode === 'gtag') {
      setGtagName('page_view');
      setGtagParams(formatJSON({ custom_parameter: 'value' }));
      return;
    }

    if (nextMode === 'meta') {
      setMetaEventName(DEFAULT_META_PRESET.eventName);
      setMetaParams(formatJSON(DEFAULT_META_PRESET.params ?? {}));
      setMetaPixelId(DEFAULT_META_PRESET.pixelId ?? '');
      setMetaEventId(DEFAULT_META_PRESET.eventId ?? '');
      setMetaTrackType(DEFAULT_META_PRESET.trackType ?? 'track');
      return;
    }

    if (nextMode === 'linkedin') {
      setLinkedinConversionId(DEFAULT_LINKEDIN_PRESET.conversionId);
      setLinkedinTrackingId(DEFAULT_LINKEDIN_PRESET.trackingId ?? '');
      setLinkedinPayload(formatJSON(DEFAULT_LINKEDIN_PRESET.payload ?? {}));
      return;
    }

    if (nextMode === 'adobe') {
      setAdobeCall(DEFAULT_ADOBE_PRESET.call);
      setAdobeReportSuite(DEFAULT_ADOBE_PRESET.reportSuite ?? 'debugsuite');
      setAdobeLinkType(DEFAULT_ADOBE_PRESET.linkType ?? 'o');
      setAdobeLinkName(DEFAULT_ADOBE_PRESET.linkName ?? '');
      setAdobeVariables(formatJSON(DEFAULT_ADOBE_PRESET.variables ?? {}));
    }
  };

  const handleModeChange = (nextMode: ConsoleMode) => {
    setMode(nextMode);
    setPreset('');
    applyDefaultsForMode(nextMode);
  };

  const modeOptions: Array<{ value: ConsoleMode; label: string }> = [
    { value: 'datalayer', label: MODE_LABELS.datalayer },
    { value: 'gtag', label: MODE_LABELS.gtag },
    { value: 'meta', label: MODE_LABELS.meta },
    { value: 'linkedin', label: MODE_LABELS.linkedin },
    { value: 'adobe', label: MODE_LABELS.adobe },
  ];

  const presetOptions = getPresetOptions(mode);

  const handlePresetChange = (presetName: string) => {
    setPreset(presetName);
    if (!presetName) return;

    if (mode === 'datalayer') {
      const presetData = DATALAYER_PRESETS[presetName];
      if (presetData) {
        setEventName(presetData.event ?? '');
        setPayload(formatJSON(presetData));
      }
      return;
    }

    if (mode === 'meta') {
      const presetData = META_PRESETS[presetName];
      if (presetData) {
        setMetaEventName(presetData.eventName);
        setMetaParams(formatJSON(presetData.params ?? {}));
        setMetaPixelId(presetData.pixelId ?? '');
        setMetaEventId(presetData.eventId ?? '');
        setMetaTrackType(presetData.trackType ?? 'track');
      }
      return;
    }

    if (mode === 'linkedin') {
      const presetData = LINKEDIN_PRESETS[presetName];
      if (presetData) {
        setLinkedinConversionId(presetData.conversionId);
        setLinkedinTrackingId(presetData.trackingId ?? '');
        setLinkedinPayload(formatJSON(presetData.payload ?? {}));
      }
      return;
    }

    if (mode === 'adobe') {
      const presetData = ADOBE_PRESETS[presetName];
      if (presetData) {
        setAdobeCall(presetData.call);
        setAdobeReportSuite(presetData.reportSuite ?? '');
        setAdobeLinkType(presetData.linkType ?? 'o');
        setAdobeLinkName(presetData.linkName ?? '');
        setAdobeVariables(formatJSON(presetData.variables ?? {}));
      }
    }
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
      } else if (mode === 'gtag') {
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
      } else if (mode === 'meta') {
        if (!metaEventName.trim()) {
          alert('Specifica un evento Meta valido');
          return;
        }

        let parsedParams: Record<string, any> = {};
        if (metaParams.trim()) {
          try {
            parsedParams = JSON.parse(metaParams);
          } catch (err) {
            alert('Parametri Meta non validi (JSON).');
            return;
          }
        }

        const trimmedPixelId = metaPixelId.trim();
        const trimmedEventId = metaEventId.trim() || (typeof parsedParams.event_id === 'string' ? parsedParams.event_id : undefined);

        cmd = {
          mode: 'meta',
          meta: {
            eventName: metaEventName.trim(),
            params: parsedParams,
            pixelId: trimmedPixelId || undefined,
            eventId: trimmedEventId,
            trackType: metaTrackType,
          },
          trackCollect,
          timeoutMs,
          match: matchMode,
          customUrlPattern: matchMode === 'custom' ? customPattern : undefined,
        };
      } else if (mode === 'linkedin') {
        if (!linkedinConversionId.trim()) {
          alert('Conversion ID obbligatorio per LinkedIn');
          return;
        }

        let parsedPayload: Record<string, any> = {};
        if (linkedinPayload.trim()) {
          try {
            parsedPayload = JSON.parse(linkedinPayload);
          } catch (err) {
            alert('Payload LinkedIn non valido (JSON).');
            return;
          }
        }

        cmd = {
          mode: 'linkedin',
          linkedin: {
            conversionId: linkedinConversionId.trim(),
            trackingId: linkedinTrackingId.trim() || undefined,
            payload: parsedPayload,
          },
          trackCollect,
          timeoutMs,
          match: matchMode,
          customUrlPattern: matchMode === 'custom' ? customPattern : undefined,
        };
      } else if (mode === 'adobe') {
        let parsedVariables: Record<string, any> = {};
        if (adobeVariables.trim()) {
          try {
            parsedVariables = JSON.parse(adobeVariables);
          } catch (err) {
            alert('Variabili Adobe non valide (JSON).');
            return;
          }
        }

        cmd = {
          mode: 'adobe',
          adobe: {
            call: adobeCall,
            linkType: adobeCall === 'tl' ? (adobeLinkType.trim() || 'o') : undefined,
            linkName: adobeCall === 'tl' ? (adobeLinkName.trim() || undefined) : undefined,
            variables: parsedVariables,
            reportSuite: adobeReportSuite.trim() || undefined,
          },
          trackCollect,
          timeoutMs,
          match: matchMode,
          customUrlPattern: matchMode === 'custom' ? customPattern : undefined,
        };
      } else {
        return;
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
          {modeOptions.map((option) => (
            <label
              key={option.value}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-slate-300"
            >
              <input
                type="radio"
                name="mode"
                value={option.value}
                checked={mode === option.value}
                onChange={() => handleModeChange(option.value)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500"
              />
              {option.label}
            </label>
          ))}
        </div>

        {presetOptions.length > 0 && (
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-600">
              Preset {MODE_LABELS[mode]}
            </label>
            <select
              value={preset}
              onChange={(e) => handlePresetChange(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-inner focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              <option value="">Seleziona preset...</option>
              {presetOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        )}

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

        {mode === 'meta' && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-600">
                  Evento Meta Pixel
                </label>
                <input
                  type="text"
                  value={metaEventName}
                  onChange={(e) => setMetaEventName(e.target.value)}
                  placeholder="Purchase"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-inner focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-600">
                  Track type
                </label>
                <select
                  value={metaTrackType}
                  onChange={(e) => setMetaTrackType(e.target.value as 'track' | 'trackCustom')}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-inner focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                >
                  <option value="track">track</option>
                  <option value="trackCustom">trackCustom</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-600">
                  Pixel ID (opzionale)
                </label>
                <input
                  type="text"
                  value={metaPixelId}
                  onChange={(e) => setMetaPixelId(e.target.value)}
                  placeholder="999999999999999"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-inner focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-600">
                  Event ID (opzionale)
                </label>
                <input
                  type="text"
                  value={metaEventId}
                  onChange={(e) => setMetaEventId(e.target.value)}
                  placeholder="meta-event-001"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-inner focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-600">
                Parametri JSON
              </label>
              <textarea
                value={metaParams}
                onChange={(e) => setMetaParams(e.target.value)}
                rows={6}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-700 shadow-inner focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                placeholder={`{
  "value": 99,
  "currency": "EUR",
  "event_id": "meta-event-001"
}`}
              />
            </div>
          </div>
        )}

        {mode === 'linkedin' && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-600">
                  Conversion ID
                </label>
                <input
                  type="text"
                  value={linkedinConversionId}
                  onChange={(e) => setLinkedinConversionId(e.target.value)}
                  placeholder="1234567"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-inner focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-600">
                  Tracking ID (opzionale)
                </label>
                <input
                  type="text"
                  value={linkedinTrackingId}
                  onChange={(e) => setLinkedinTrackingId(e.target.value)}
                  placeholder="9876543"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-inner focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-600">
                Payload JSON
              </label>
              <textarea
                value={linkedinPayload}
                onChange={(e) => setLinkedinPayload(e.target.value)}
                rows={5}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-700 shadow-inner focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                placeholder={`{
  "value": 45,
  "currency": "EUR"
}`}
              />
            </div>
          </div>
        )}

        {mode === 'adobe' && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-600">
                  Chiamata
                </label>
                <select
                  value={adobeCall}
                  onChange={(e) => setAdobeCall(e.target.value as 't' | 'tl')}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-inner focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                >
                  <option value="t">s.t()</option>
                  <option value="tl">s.tl()</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-600">
                  Report Suite
                </label>
                <input
                  type="text"
                  value={adobeReportSuite}
                  onChange={(e) => setAdobeReportSuite(e.target.value)}
                  placeholder="debugsuite"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-inner focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
              {adobeCall === 'tl' && (
                <>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-600">
                      Link type
                    </label>
                    <input
                      type="text"
                      value={adobeLinkType}
                      onChange={(e) => setAdobeLinkType(e.target.value)}
                      placeholder="o"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-inner focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-600">
                      Link name
                    </label>
                    <input
                      type="text"
                      value={adobeLinkName}
                      onChange={(e) => setAdobeLinkName(e.target.value)}
                      placeholder="CTA - preventivo"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-inner focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                </>
              )}
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-600">
                Variabili (eVar/prop/events)
              </label>
              <textarea
                value={adobeVariables}
                onChange={(e) => setAdobeVariables(e.target.value)}
                rows={6}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-700 shadow-inner focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                placeholder={`{
  "pageName": "Live Debugger Demo",
  "events": "event1"
}`}
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
