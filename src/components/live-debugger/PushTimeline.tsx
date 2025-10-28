import React, { useMemo, useEffect, useState } from 'react';
import clsx from 'clsx';
import {
  ActivitySquare,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import type { NormalizedEvent } from '../../types/live-debugger';

type DataLayerPushEvent = Extract<NormalizedEvent, { kind: 'datalayer.push' }>;
type Ga4HitEvent = Extract<NormalizedEvent, { kind: 'ga4.hit' }>;
type PushResultEvent = Extract<NormalizedEvent, { kind: 'push.result' }>;

export interface PushTimelineEntry {
  id: string;
  pushId: string;
  origin?: 'console' | 'library' | 'usecase' | 'api';
  pushEvent: DataLayerPushEvent;
  pushIndex: number;
  pushName?: string;
  pushPayload?: Record<string, any>;
  gaEvents: Array<{
    event: Ga4HitEvent;
    index: number;
    delayMs?: number;
  }>;
  result?: PushResultEvent;
  resultIndex?: number;
}

interface PushTimelineProps {
  entries: PushTimelineEntry[];
}

function getPrimaryPayload(payload: unknown): Record<string, any> | undefined {
  if (!payload) return undefined;
  if (Array.isArray(payload)) {
    const first = payload[0];
    return typeof first === 'object' && first !== null ? (first as Record<string, any>) : undefined;
  }
  if (typeof payload === 'object') return payload as Record<string, any>;
  return undefined;
}

function normalizeValue(value: unknown): string {
  if (value === null || typeof value === 'undefined') return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function getGaParamValue(
  params: Record<string, unknown>,
  key: string,
): unknown {
  if (Object.prototype.hasOwnProperty.call(params, key)) {
    return params[key];
  }
  const prefixes = ['ep.', 'epn.', 'epc.', 'epv.'];
  for (const prefix of prefixes) {
    const candidate = `${prefix}${key}`;
    if (Object.prototype.hasOwnProperty.call(params, candidate)) {
      return params[candidate];
    }
  }
  return undefined;
}

function buildMismatchHints(
  entry: PushTimelineEntry,
  status: 'matched' | 'pending' | 'timeout' | 'error'
) {
  const hints: string[] = [];

  if (status === 'timeout') {
    hints.push('Nessun evento GA4 rilevato entro 15s.');
    return hints;
  }

  const primary = entry.gaEvents[0];
  if (!primary) {
    if (status === 'error' && entry.result?.reason === 'nomatch') {
      hints.push('Nessuna hit GA4 soddisfa il pattern atteso (verifica measurement ID e parametri).');
    }
    return hints;
  }

  const gaEvent = primary.event;

  if (typeof gaEvent.status === 'number' && gaEvent.status >= 400) {
    hints.push(`Risposta HTTP ${gaEvent.status}.`);
  }

  if (!gaEvent.mi) {
    hints.push('Measurement ID mancante nella hit.');
  }

  const pushPayload = entry.pushPayload ?? getPrimaryPayload(entry.pushEvent.payload);
  const gaParams = gaEvent.event?.params ?? {};

  if (pushPayload) {
    const keysToCheck = Object.keys(pushPayload).filter((key) => {
      return (
        key !== 'event' &&
        !key.startsWith('gtm.') &&
        !key.startsWith('_') &&
        typeof pushPayload[key] !== 'object'
      );
    });

    keysToCheck.forEach((key) => {
      const pushValue = normalizeValue(pushPayload[key]);
      const gaRaw = getGaParamValue(gaParams as Record<string, unknown>, key);
      if (typeof gaRaw === 'undefined') {
        hints.push(`Parametro GA4 "${key}" mancante (push: ${pushValue}).`);
      } else {
        const gaValue = normalizeValue(gaRaw);
        if (pushValue && pushValue !== gaValue) {
          hints.push(`Parametro "${key}" differisce (push: ${pushValue} • GA4: ${gaValue}).`);
        }
      }
    });
  }

  if (entry.gaEvents.length > 1) {
    hints.push(`Rilevate ${entry.gaEvents.length} hit GA4 per questo push.`);
  }

  const attempts = entry.result?.attempts;
  const maxAttempts = entry.result?.maxAttempts;
  if (attempts && maxAttempts && maxAttempts > 1) {
    if (status === 'matched') {
      hints.push(`Hit GA4 ricevuta al tentativo ${attempts}/${maxAttempts}.`);
    } else if (status === 'timeout' || status === 'error') {
      hints.push(`Tentativi effettuati: ${attempts}/${maxAttempts}.`);
    }
  }

  return hints;
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleTimeString('it-IT', { hour12: false });
}

function formatDelay(ms: number | undefined) {
  if (typeof ms !== 'number') return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function PushTimeline({ entries }: PushTimelineProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const decorated = useMemo(() => {
    return entries.map((entry) => {
      const primary = entry.gaEvents[0];

      let status: 'matched' | 'pending' | 'timeout' | 'error';
      if (entry.result) {
        if (entry.result.ok) {
          status = 'matched';
        } else if (entry.result.reason === 'timeout') {
          status = 'timeout';
        } else {
          status = 'error';
        }
      } else if (primary) {
        status = 'matched';
      } else if (now - entry.pushEvent.ts > 15000) {
        status = 'timeout';
      } else {
        status = 'pending';
      }

      const sincePush = now - entry.pushEvent.ts;
      const hints = buildMismatchHints(entry, status);
      return { entry, status, sincePush, hints, primary };
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
              Timeline DataLayer ↔ GA4
            </h3>
            <p className="text-xs text-slate-500">
              Correlazione tra push dataLayer e hit GA4, con tempi di raccolta e mismatch evidenziati.
            </p>
          </div>
        </div>
        <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-10 text-center">
          Nessun push registrato nella sessione corrente.
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
            Timeline DataLayer ↔ GA4
          </h3>
          <p className="text-xs text-slate-500">
            Correlazione tra push dataLayer e hit GA4, con tempi di raccolta e mismatch evidenziati.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {decorated.map(({ entry, status, sincePush, hints, primary }) => {
          const pushPayload = entry.pushPayload ?? getPrimaryPayload(entry.pushEvent.payload);
          const pushDetails = pushPayload
            ? Object.entries(pushPayload)
                .filter(
                  ([key, value]) =>
                    key !== 'event' && !key.startsWith('gtm.') && typeof value !== 'function'
                )
                .slice(0, 5)
            : [];
          const gaParams = primary?.event?.event?.params
            ? Object.entries(primary.event.event.params).slice(0, 5)
            : [];

          const statusStyles = {
            matched: {
              badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
              icon: <CheckCircle2 className="h-3 w-3" />,
              label: 'GA4 confermato',
            },
            pending: {
              badge: 'border-amber-200 bg-amber-50 text-amber-700',
              icon: <Loader2 className="h-3 w-3 animate-spin" />,
              label: 'In attesa',
            },
            timeout: {
              badge: 'border-red-200 bg-red-50 text-red-600',
              icon: <AlertTriangle className="h-3 w-3" />,
              label: 'Timeout GA4',
            },
            error: {
              badge: 'border-red-300 bg-red-50 text-red-700',
              icon: <AlertTriangle className="h-3 w-3" />,
              label: 'GA4 non conforme',
            },
          } as const;

          const statusInfo = statusStyles[status];
          const delayLabel =
            primary && status === 'matched'
              ? `GA4 in ${formatDelay(primary.delayMs)}`
              : status === 'matched'
              ? 'GA4 confermato'
              : `Trascorsi ${formatDelay(sincePush)}`;

          let gaHost: string | undefined;
          if (primary?.event) {
            try {
              gaHost = new URL(primary.event.url).hostname;
            } catch {
              gaHost = undefined;
            }
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
                        {entry.pushName ?? 'Evento non definito'}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                        DataLayer • {entry.pushEvent.source}
                      </span>
                      {entry.origin && (
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-600">
                          {entry.origin === 'console'
                            ? 'Push console'
                            : entry.origin === 'library'
                            ? 'Push salvato'
                            : entry.origin === 'usecase'
                            ? 'Use case'
                            : entry.origin}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      {formatDate(entry.pushEvent.ts)} • indice #{entry.pushIndex + 1}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 text-xs">
                  <span
                    className={clsx(
                      'inline-flex items-center gap-2 rounded-full border px-3 py-1 font-semibold',
                      statusInfo.badge
                    )}
                  >
                    {statusInfo.icon}
                    {statusInfo.label}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                    <Clock className="h-3 w-3" />
                    {delayLabel}
                  </span>
                  {entry.result?.attempts && entry.result?.maxAttempts && entry.result.maxAttempts > 1 && (
                    <span className="text-[10px] font-medium text-slate-400">
                      Tentativi {entry.result.attempts}/{entry.result.maxAttempts}
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1.6fr)] xl:items-start">
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-600">Payload push</p>
                  {pushDetails.length > 0 ? (
                    <ul className="space-y-1 text-xs text-slate-500">
                      {pushDetails.map(([key, value]) => (
                        <li key={key}>
                          <span className="font-semibold text-slate-600">{key}:</span>{' '}
                          <span className="font-mono text-[11px] text-slate-500">
                            {normalizeValue(value)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-400">Nessun dettaglio aggiuntivo nel push.</p>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-600">Hit GA4</p>
                  {primary ? (
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <ArrowRight className="h-3 w-3 text-slate-400" />
                        {primary.event.mi ? (
                          <span className="rounded-full bg-purple-100 px-2 py-0.5 font-mono text-[11px] text-purple-700">
                            {primary.event.mi}
                          </span>
                        ) : (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 font-semibold text-red-600">
                            MI n/d
                          </span>
                        )}
                        {typeof primary.event.status === 'number' && (
                          <span
                            className={clsx(
                              'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                              primary.event.status >= 400
                                ? 'bg-red-100 text-red-600'
                                : 'bg-emerald-100 text-emerald-700'
                            )}
                          >
                            HTTP {primary.event.status}
                          </span>
                        )}
                        {gaHost && (
                          <span className="text-[11px] text-slate-400">{gaHost}</span>
                        )}
                      </div>
                      {gaParams.length > 0 ? (
                        <ul className="space-y-1 text-xs text-slate-500">
                          {gaParams.map(([key, value]) => (
                            <li key={key}>
                              <span className="font-semibold text-slate-600">{key}:</span>{' '}
                              <span className="font-mono text-[11px] text-slate-500">
                                {normalizeValue(value)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-slate-400">Nessun parametro aggiuntivo nella hit.</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">
                      Hit GA4 non ancora registrata per questo push.
                    </p>
                  )}
                </div>
              </div>

              {entry.gaEvents.length > 1 && (
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[11px] text-slate-600 overflow-x-auto">
                  <p className="font-semibold text-slate-500">
                    Hit aggiuntive ({entry.gaEvents.length - 1})
                  </p>
                  <ul className="mt-1 space-y-1">
                    {entry.gaEvents.slice(1).map(({ event }, idx) => (
                      <li key={`${event.url}-${idx}`} className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-200 px-2 py-0.5 font-mono text-[10px] text-slate-600">
                          {event.mi ?? 'MI n/d'}
                        </span>
                        <span className="text-slate-500">{event.event?.name ?? 'event n/d'}</span>
                        {typeof event.status === 'number' && (
                          <span
                            className={clsx(
                              'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                              event.status >= 400 ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700'
                            )}
                          >
                            HTTP {event.status}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {entry.result?.matched && entry.result.matched.length > 0 && (
                <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-[11px] text-blue-700 overflow-x-auto">
                  <p className="font-semibold uppercase tracking-[0.15em]">Url abbinate</p>
                  <ul className="mt-1 space-y-1 break-words">
                    {entry.result.matched.map((match) => (
                      <li key={match.url} className="break-all">
                        {match.url}
                        {typeof match.status === 'number' && (
                          <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 font-semibold text-blue-600">
                            HTTP {match.status}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {entry.result && !entry.result.ok && entry.result.reason && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-[11px] text-red-700">
                  Motivo: {entry.result.reason === 'timeout' ? 'timeout' : entry.result.reason}
                </div>
              )}

              {hints.length > 0 && (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  <div className="flex items-center gap-2 font-semibold uppercase tracking-[0.18em]">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Da verificare
                  </div>
                  <ul className="mt-1 space-y-1 text-[11px] leading-relaxed text-amber-700">
                    {hints.map((hint) => (
                      <li key={hint}>{hint}</li>
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
