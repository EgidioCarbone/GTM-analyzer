import React, { useMemo } from 'react';
import { Network, ArrowUpRight, GitCompare, Copy } from 'lucide-react';
import type { NormalizedEvent } from '../../types/live-debugger';

interface GAHitsPanelProps {
  events: NormalizedEvent[];
  onSelect: (event: NormalizedEvent) => void;
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString('it-IT', {
    hour12: false,
    minute: '2-digit',
    second: '2-digit',
  });
}

function getEventName(event: Extract<NormalizedEvent, { kind: 'ga4.hit' | 'ua.hit' }>) {
  if (event.kind === 'ga4.hit') {
    return event.event?.name || 'GA4 Hit';
  }
  return event.params.event_name || 'UA Hit';
}

function getMeasurementId(event: Extract<NormalizedEvent, { kind: 'ga4.hit' | 'ua.hit' }>) {
  if (event.kind === 'ga4.hit') {
    return event.mi ?? '';
  }
  return event.params.tid ?? '';
}

function getParamEntries(event: Extract<NormalizedEvent, { kind: 'ga4.hit' | 'ua.hit' }>) {
  if (event.kind === 'ga4.hit') {
    const params = event.event?.params ?? {};
    return Object.entries(params);
  }
  return Object.entries(event.params ?? {});
}

export function GAHitsPanel({ events, onSelect }: GAHitsPanelProps) {
  const hits = useMemo(() => {
    return events
      .filter((event): event is Extract<NormalizedEvent, { kind: 'ga4.hit' | 'ua.hit' }> =>
        event.kind === 'ga4.hit' || event.kind === 'ua.hit'
      )
      .sort((a, b) => b.ts - a.ts);
  }, [events]);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm ring-1 ring-black/5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            GA Network
          </p>
          <h3 className="text-lg font-semibold text-slate-900">
            {hits.length} hit {hits.length === 1 ? 'rilevata' : 'rilevate'}
          </h3>
          <p className="text-xs text-slate-400">
            Ordinate in tempo reale (più recenti in alto)
          </p>
        </div>
      </div>

      <div className="mt-4 max-h-[480px] space-y-3 overflow-y-auto">
        {hits.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-12 text-center text-sm text-slate-500">
            <Network className="h-7 w-7 text-slate-300" />
            <p className="mt-3 font-medium text-slate-600">Nessun hit GA intercettato</p>
            <p className="mt-1 max-w-sm text-xs text-slate-400">
              Appena vengono rilevate richieste GA4/UA le troverai qui con i relativi parametri.
            </p>
          </div>
        ) : (
          hits.map((event, index) => {
            const name = getEventName(event);
            const mi = getMeasurementId(event);
            const status = event.status ?? '—';
            const params = getParamEntries(event);
            const topParams = params.slice(0, 6);

            return (
              <article
                key={`${event.kind}-${event.ts}-${index}`}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-700">
                      <Network className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-base font-semibold text-slate-900">{name}</h4>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                          #{index + 1}
                        </span>
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                          HTTP {status}
                        </span>
                        {mi && (
                          <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[11px] font-mono text-purple-700">
                            {mi}
                          </span>
                        )}
                        {event.kind === 'ga4.hit' && event.cid && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-mono text-slate-600">
                            CID {event.cid.slice(0, 8)}…
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">
                        {formatTime(event.ts)} ·{' '}
                        <span
                          className="font-mono text-slate-500 break-all"
                          style={{
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                          title={event.url}
                        >
                          {event.url}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 text-xs text-slate-500">
                    <button
                      onClick={() => onSelect(event)}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-slate-600 transition hover:border-blue-300 hover:text-blue-700"
                    >
                      <GitCompare className="h-4 w-4" />
                      Ispeziona
                    </button>
                    <div className="flex gap-2">
                      <a
                        href={event.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
                      >
                        <ArrowUpRight className="h-4 w-4" />
                        Richiesta
                      </a>
                      <button
                        onClick={() => navigator.clipboard.writeText(JSON.stringify(event, null, 2))}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
                      >
                        <Copy className="h-4 w-4" />
                        Copy
                      </button>
                    </div>
                  </div>
                </div>

                {topParams.length > 0 && (
                  <div className="mt-3 overflow-x-hidden rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <table className="w-full table-fixed text-xs">
                      <tbody className="divide-y divide-slate-200">
                        {topParams.map(([key, value]) => (
                          <tr key={key} className="text-left align-top">
                            <th className="w-32 whitespace-nowrap px-2 py-1 font-medium text-slate-600">
                              {key}
                            </th>
                            <td className="px-2 py-1 font-mono text-slate-700 break-all">
                              {typeof value === 'object'
                                ? JSON.stringify(value)
                                : String(value)}
                            </td>
                          </tr>
                        ))}
                        {params.length > topParams.length && (
                          <tr>
                            <td colSpan={2} className="px-2 pt-2 text-[11px] uppercase tracking-[0.14em] text-slate-400">
                              … altri {params.length - topParams.length} parametri nella richiesta
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
