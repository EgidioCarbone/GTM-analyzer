import React, { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { ActivitySquare, AlertTriangle, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import type { NormalizedEvent, PushMode } from '../../types/live-debugger';
import { MODE_LABELS, commandExpectedEvent, commandPayloadSnapshot } from './pushPresets';

type TimelineHitEvent =
  | Extract<NormalizedEvent, { kind: 'ga4.hit' }>
  | Extract<NormalizedEvent, { kind: 'ua.hit' }>
  | Extract<NormalizedEvent, { kind: 'meta.hit' }>
  | Extract<NormalizedEvent, { kind: 'linkedin.hit' }>
  | Extract<NormalizedEvent, { kind: 'adobe.hit' }>;

interface HitEntry {
  kind: TimelineHitEvent['kind'];
  event: TimelineHitEvent;
  index: number;
  delayMs?: number;
}

export interface PushTimelineEntry {
  id: string;
  pushId: string;
  origin?: 'console' | 'library' | 'usecase' | 'api';
  mode?: PushMode;
  command?: Extract<NormalizedEvent, { kind: 'push.command' }>;
  commandIndex?: number;
  datalayer?: Extract<NormalizedEvent, { kind: 'datalayer.push' }>;
  datalayerIndex?: number;
  hits: HitEntry[];
  result?: Extract<NormalizedEvent, { kind: 'push.result' }>;
  resultIndex?: number;
}

interface PushTimelineProps {
  entries: PushTimelineEntry[];
}

type TimelineStatus = 'success' | 'pending' | 'timeout' | 'error' | 'partial';

const STATUS_META: Record<
  TimelineStatus,
  { badge: string; icon: React.ReactNode; label: string }
> = {
  success: {
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    icon: <CheckCircle2 className="h-3 w-3" />, 
    label: 'Completato',
  },
  pending: {
    badge: 'border-amber-200 bg-amber-50 text-amber-700',
    icon: <Loader2 className="h-3 w-3 animate-spin" />, 
    label: 'In attesa',
  },
  timeout: {
    badge: 'border-red-200 bg-red-50 text-red-600',
    icon: <AlertTriangle className="h-3 w-3" />, 
    label: 'Timeout',
  },
  error: {
    badge: 'border-red-200 bg-red-50 text-red-600',
    icon: <AlertTriangle className="h-3 w-3" />, 
    label: 'Errore',
  },
  partial: {
    badge: 'border-blue-200 bg-blue-50 text-blue-700',
    icon: <Clock className="h-3 w-3" />, 
    label: 'Hit rilevate',
  },
};

const HIT_LABEL: Record<TimelineHitEvent['kind'], string> = {
  'ga4.hit': 'GA4',
  'ua.hit': 'UA',
  'meta.hit': 'Meta Pixel',
  'linkedin.hit': 'LinkedIn Insight',
  'adobe.hit': 'Adobe Analytics',
};

const HIT_TONE: Record<TimelineHitEvent['kind'], string> = {
  'ga4.hit': 'bg-blue-100 text-blue-700',
  'ua.hit': 'bg-emerald-100 text-emerald-700',
  'meta.hit': 'bg-indigo-100 text-indigo-700',
  'linkedin.hit': 'bg-sky-100 text-sky-700',
  'adobe.hit': 'bg-amber-100 text-amber-700',
};

const truncate = (value: string, max = 120) =>
  value.length > max ? `${value.slice(0, max)}…` : value;

const formatTimestamp = (ts: number) =>
  new Date(ts).toLocaleTimeString('it-IT', { hour12: false });

const formatDelay = (delay?: number) => {
  if (typeof delay !== 'number') return '—';
  if (delay < 1000) return `${delay}ms`;
  return `${(delay / 1000).toFixed(1)}s`;
};

const getStatus = (entry: PushTimelineEntry, now: number): TimelineStatus => {
  if (entry.result) {
    if (entry.result.ok) return 'success';
    if (entry.result.reason === 'timeout') return 'timeout';
    return 'error';
  }

  if (entry.hits.length > 0) {
    return 'partial';
  }

  const referenceTs = entry.command?.ts ?? entry.datalayer?.ts;
  if (referenceTs && now - referenceTs > (entry.command?.timeoutMs ?? 15000)) {
    return 'timeout';
  }

  return 'pending';
};

const groupHitsByVendor = (hits: HitEntry[]) => {
  return hits.reduce<Record<string, HitEntry[]>>((acc, hit) => {
    if (!acc[hit.kind]) {
      acc[hit.kind] = [];
    }
    acc[hit.kind].push(hit);
    return acc;
  }, {});
};

const renderJsonBlock = (title: string, data: unknown) => {
  if (!data || (typeof data === 'object' && Object.keys(data as Record<string, unknown>).length === 0)) {
    return null;
  }

  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-slate-600">{title}</p>
      <pre className="max-h-48 overflow-auto rounded-xl bg-slate-50 p-3 text-[11px] text-slate-600">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
};

const renderHitDetails = (hit: HitEntry) => {
  const { event } = hit;

  switch (hit.kind) {
    case 'ga4.hit': {
      const gaEvent = event.event;
      const measurementId = event.mi;
      const status = event.status;
      return (
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
          {gaEvent?.name && <span className="font-semibold text-slate-600">{gaEvent.name}</span>}
          {measurementId && (
            <span className="rounded-full bg-purple-100 px-2 py-0.5 font-mono text-purple-700">
              {measurementId}
            </span>
          )}
          {typeof status === 'number' && (
            <span
              className={clsx(
                'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                status >= 400 ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700'
              )}
            >
              HTTP {status}
            </span>
          )}
          <span className="text-slate-400">delay {formatDelay(hit.delayMs)}</span>
        </div>
      );
    }
    case 'ua.hit': {
      const params = event.params;
      return (
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
          {params.event && <span className="font-semibold text-slate-600">{params.event}</span>}
          <span className="text-slate-400">delay {formatDelay(hit.delayMs)}</span>
        </div>
      );
    }
    case 'meta.hit': {
      return (
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
          {event.eventName && <span className="font-semibold text-slate-600">{event.eventName}</span>}
          {event.pixelId && (
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-indigo-700">
              Pixel {event.pixelId}
            </span>
          )}
          {event.status !== undefined && (
            <span
              className={clsx(
                'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                event.status >= 400 ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700'
              )}
            >
              HTTP {event.status}
            </span>
          )}
          <span className="text-slate-400">delay {formatDelay(hit.delayMs)}</span>
        </div>
      );
    }
    case 'linkedin.hit': {
      return (
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
          {event.eventName && <span className="font-semibold text-slate-600">{event.eventName}</span>}
          {event.trackingId && (
            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-sky-700">
              Tracking {event.trackingId}
            </span>
          )}
          {event.status !== undefined && (
            <span
              className={clsx(
                'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                event.status >= 400 ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700'
              )}
            >
              HTTP {event.status}
            </span>
          )}
          <span className="text-slate-400">delay {formatDelay(hit.delayMs)}</span>
        </div>
      );
    }
    case 'adobe.hit': {
      return (
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
          {event.reportSuite && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">
              {event.reportSuite}
            </span>
          )}
          {event.eventType && <span className="font-semibold text-slate-600">{event.eventType}</span>}
          {event.status !== undefined && (
            <span
              className={clsx(
                'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                event.status >= 400 ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700'
              )}
            >
              HTTP {event.status}
            </span>
          )}
          <span className="text-slate-400">delay {formatDelay(hit.delayMs)}</span>
        </div>
      );
    }
    default:
      return null;
  }
};

export function PushTimeline({ entries }: PushTimelineProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const decorated = useMemo(() => {
    return entries.map((entry) => {
      const status = getStatus(entry, now);
      const expectedName = entry.command ? commandExpectedEvent(entry.command) : undefined;
      const expectedPayload = entry.command ? commandPayloadSnapshot(entry.command) : undefined;
      const sourceTs = entry.command?.ts ?? entry.datalayer?.ts ?? entry.hits[0]?.event.ts ?? 0;
      const timeElapsed = sourceTs ? now - sourceTs : 0;
      return { entry, status, expectedName, expectedPayload, timeElapsed };
    });
  }, [entries, now]);

  if (entries.length === 0) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm ring-1 ring-black/5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Analisi push
            </p>
            <h3 className="mt-1 text-lg font-semibold text-slate-900">
              Timeline comandi
            </h3>
            <p className="text-xs text-slate-500">
              Correlazione tra comandi (console, libreria, API) e le hit raccolte sui vari vendor.
            </p>
          </div>
        </div>
        <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-10 text-center">
          Nessun comando tracciato nella sessione corrente.
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm ring-1 ring-black/5 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Analisi push
          </p>
          <h3 className="text-lg font-semibold text-slate-900">
            Timeline comandi multi-vendor
          </h3>
          <p className="text-xs text-slate-500">
            Visualizza l’esecuzione dei comandi e le hit tracciate su GA4, Meta, LinkedIn e Adobe.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {decorated.map(({ entry, status, expectedName, expectedPayload, timeElapsed }) => {
          const statusMeta = STATUS_META[status];
          const groupedHits = groupHitsByVendor(entry.hits);
          const sourceTs = entry.command?.ts ?? entry.datalayer?.ts;
          const originLabel = entry.origin
            ? entry.origin === 'console'
              ? 'Console'
              : entry.origin === 'library'
              ? 'Libreria'
              : entry.origin
            : undefined;
          const commandLabel = entry.command
            ? MODE_LABELS[entry.command.mode]
            : entry.mode
            ? MODE_LABELS[entry.mode]
            : 'Comando';

          const timeoutMs = entry.command?.timeoutMs ?? 15000;
          const timeInfo = sourceTs ? `${formatDelay(timeElapsed)} dal comando` : undefined;

          const hints: string[] = [];
          if (status === 'timeout') {
            hints.push(`Nessuna hit entro ${formatDelay(timeoutMs)}.`);
          } else if (status === 'partial') {
            hints.push('Hit ricevute ma in attesa del risultato finale.');
          } else if (status === 'error' && entry.result?.reason === 'nomatch') {
            hints.push('Hit ricevuta, ma non corrisponde ai criteri richiesti.');
          }

          return (
            <article
              key={entry.id}
              className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-500">
                    <ActivitySquare className="h-5 w-5" />
                  </span>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">
                        {expectedName ?? commandLabel}
                      </span>
                      {entry.mode && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                          {MODE_LABELS[entry.mode]}
                        </span>
                      )}
                      {originLabel && (
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-600">
                          {originLabel}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400">
                      {sourceTs ? `${formatTimestamp(sourceTs)}` : 'timestamp n/d'}
                      {typeof entry.commandIndex === 'number' && ` • comando #${entry.commandIndex + 1}`}
                    </p>
                    {entry.command?.match && (
                      <p className="text-[11px] text-slate-400">
                        Match: {entry.command.match}
                        {entry.command.match === 'custom' && entry.command.customUrlPattern
                          ? ` (${entry.command.customUrlPattern})`
                          : ''}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 text-xs">
                  <span
                    className={clsx(
                      'inline-flex items-center gap-2 rounded-full border px-3 py-1 font-semibold',
                      statusMeta.badge
                    )}
                  >
                    {statusMeta.icon}
                    {statusMeta.label}
                  </span>
                  {timeInfo && (
                    <span className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                      <Clock className="h-3 w-3" />
                      {timeInfo}
                    </span>
                  )}
                  {entry.result?.attempts && entry.result?.maxAttempts && entry.result.maxAttempts > 1 && (
                    <span className="text-[10px] font-medium text-slate-400">
                      Tentativi {entry.result.attempts}/{entry.result.maxAttempts}
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                <div className="space-y-3">
                  {entry.datalayer && renderJsonBlock('Payload dataLayer', entry.datalayer.payload)}
                  {expectedPayload && renderJsonBlock('Parametri attesi', expectedPayload)}
                </div>

                <div className="space-y-4">
                  {Object.keys(groupedHits).length > 0 ? (
                    Object.entries(groupedHits).map(([kind, vendorHits]) => (
                      <div key={kind} className="space-y-2">
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                          <span className={clsx('rounded-full px-2 py-0.5', HIT_TONE[kind as TimelineHitEvent['kind']])}>
                            {HIT_LABEL[kind as TimelineHitEvent['kind']]}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {vendorHits.length} hit
                          </span>
                        </div>
                        <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                          {vendorHits.map((hit) => (
                            <div key={`${hit.kind}-${hit.index}`} className="space-y-1">
                              {renderHitDetails(hit)}
                              {'params' in hit.event && renderJsonBlock('Parametri', (hit.event as any).params)}
                              {'event' in hit.event &&
                                (hit.event as Extract<NormalizedEvent, { kind: 'ga4.hit' }>).event?.params &&
                                renderJsonBlock('Parametri',
                                  (hit.event as Extract<NormalizedEvent, { kind: 'ga4.hit' }>).event?.params)}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-xs text-slate-400">
                      Nessuna hit registrata per questo comando.
                    </p>
                  )}
                </div>
              </div>

              {hints.length > 0 && (
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-600">
                  <p className="font-semibold text-slate-600">Osservazioni</p>
                  <ul className="mt-1 list-disc space-y-1 pl-4">
                    {hints.map((hint, idx) => (
                      <li key={idx}>{hint}</li>
                    ))}
                  </ul>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
