import React, { useMemo, useState } from 'react';
import {
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Copy,
  Eye,
  Activity,
} from 'lucide-react';
import type { NormalizedEvent } from '../../types/live-debugger';
import type { FilterState } from '../../types/filters';

type NetworkEvent = Extract<
  NormalizedEvent,
  { kind: 'ga4.hit' | 'ua.hit' | 'meta.hit' | 'linkedin.hit' | 'adobe.hit' }
>;

interface NetworkTableProps {
  events: NormalizedEvent[];
  filters: FilterState;
  onEventSelect: (event: NormalizedEvent) => void;
}

const formatTime = (ts: number) =>
  new Date(ts).toLocaleTimeString('it-IT', {
    hour12: false,
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  });

const statusTone = (status?: number) => {
  if (!status) return 'text-gray-500';
  if (status >= 200 && status < 300) return 'text-emerald-600';
  if (status >= 300 && status < 400) return 'text-blue-600';
  if (status >= 400 && status < 500) return 'text-amber-600';
  return 'text-red-600';
};

const badgeForEvent = (event: NetworkEvent) => {
  switch (event.kind) {
    case 'ga4.hit':
      return { label: 'GA4', tone: 'bg-blue-100 text-blue-800' };
    case 'ua.hit':
      return { label: 'UA', tone: 'bg-green-100 text-green-800' };
    case 'meta.hit':
      return { label: 'Meta', tone: 'bg-indigo-100 text-indigo-800' };
    case 'linkedin.hit':
      return { label: 'LinkedIn', tone: 'bg-sky-100 text-sky-800' };
    case 'adobe.hit':
      return { label: 'Adobe', tone: 'bg-amber-100 text-amber-800' };
    default:
      return { label: event.kind, tone: 'bg-slate-100 text-slate-700' };
  }
};

const describeEvent = (event: NetworkEvent) => {
  switch (event.kind) {
    case 'ga4.hit':
      return event.event?.name || 'GA4 Hit';
    case 'ua.hit':
      return event.params.event_name || 'UA Hit';
    case 'meta.hit':
      return event.eventName || 'Meta Pixel';
    case 'linkedin.hit':
      return event.eventName || 'LinkedIn Insight';
    case 'adobe.hit':
      return event.eventType || 'Adobe Analytics';
    default:
      return event.kind;
  }
};

const getParamEntries = (event: NetworkEvent): Array<[string, string]> => {
  if (event.kind === 'ga4.hit') {
    const params = event.event?.params ?? {};
    const entries: Array<[string, string]> = Object.entries(params).map(([k, v]) => [
      k,
      typeof v === 'object' ? JSON.stringify(v) : String(v),
    ]);
    if (event.event?.items) {
      entries.push(['items', JSON.stringify(event.event.items)]);
    }
    return entries;
  }

  const sourceParams =
    event.kind === 'ua.hit' ||
    event.kind === 'meta.hit' ||
    event.kind === 'linkedin.hit' ||
    event.kind === 'adobe.hit'
      ? event.params
      : {};

  return Object.entries(sourceParams).map(([k, v]) => [k, String(v)]);
};

const copy = (text: string) => navigator.clipboard.writeText(text);

export function NetworkTable({ events, onEventSelect }: NetworkTableProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const networkEvents = useMemo(
    () =>
      (events.filter(
        (event) =>
          event.kind === 'ga4.hit' ||
          event.kind === 'ua.hit' ||
          event.kind === 'meta.hit' ||
          event.kind === 'linkedin.hit' ||
          event.kind === 'adobe.hit',
      ) as NetworkEvent[]).sort((a, b) => b.ts - a.ts),
    [events],
  );

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm ring-1 ring-black/5">
      <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Network Hits
          </p>
          <h3 className="text-lg font-semibold text-slate-900">
            Richieste tracciate ({networkEvents.length})
          </h3>
        </div>
        <Activity className="h-5 w-5 text-slate-300" />
      </header>

      <div className="max-h-[420px] overflow-y-auto px-2 py-3 space-y-3">
        {networkEvents.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-12 text-center text-sm text-slate-500">
            Nessuna richiesta tracciata. Avvia una sessione o interagisci con la pagina per vedere gli hit di rete (GA4, UA, Meta, LinkedIn, Adobe).
          </div>
        ) : (
          networkEvents.map((event, idx) => {
            const badge = badgeForEvent(event);
            const key = `${event.kind}-${event.ts}-${idx}`;
            const isOpen = expanded.has(key);
            const params = getParamEntries(event);

            return (
              <article
                key={key}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-1 items-start gap-3">
                    <button
                      type="button"
                      onClick={() => toggle(key)}
                      className="rounded-full border border-slate-200 p-1 text-slate-500 transition hover:bg-slate-100"
                    >
                      {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${badge.tone}`}>
                          {badge.label}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                          #{idx + 1}
                        </span>
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {describeEvent(event)}
                        </p>
                      </div>
                      <p className="mt-1 text-xs text-slate-500 break-all">{event.url}</p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 text-xs text-slate-400">
                    <span className="font-mono text-sm text-slate-600">{formatTime(event.ts)}</span>
                    {typeof event.status === 'number' && (
                      <span className={`inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 font-semibold ${statusTone(event.status)}`}>
                        HTTP {event.status}
                      </span>
                    )}
                    {event.kind === 'ga4.hit' && event.mi && (
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                        {event.mi}
                      </span>
                    )}
                    {event.kind === 'ga4.hit' && event.cid && (
                      <span className="rounded-full bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600">
                        CID {event.cid.slice(0, 8)}…
                      </span>
                    )}
                    {event.kind === 'meta.hit' && event.pixelId && (
                      <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                        Pixel {event.pixelId}
                      </span>
                    )}
                    {event.kind === 'linkedin.hit' && event.trackingId && (
                      <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">
                        Account {event.trackingId}
                      </span>
                    )}
                    {event.kind === 'adobe.hit' && event.reportSuite && (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                        {event.reportSuite}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <button
                    type="button"
                    onClick={() => onEventSelect(event)}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                  >
                    <Eye className="h-4 w-4" />
                    Ispeziona
                  </button>
                  <a
                    href={event.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 transition hover:border-slate-300 hover:bg-slate-100"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Apri URL
                  </a>
                  <button
                    type="button"
                    onClick={() => copy(event.url)}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 transition hover:border-slate-300 hover:bg-slate-100"
                  >
                    <Copy className="h-4 w-4" />
                    Copia URL
                  </button>
                  <button
                    type="button"
                    onClick={() => copy(JSON.stringify(event, null, 2))}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 transition hover:border-slate-300 hover:bg-slate-100"
                  >
                    <Copy className="h-4 w-4" />
                    Copia JSON
                  </button>
                </div>

                {isOpen && (
                  <div className="mt-3 space-y-2 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-slate-700">Parametri</h4>
                      <button
                        type="button"
                        onClick={() => copy(JSON.stringify(Object.fromEntries(params), null, 2))}
                        className="inline-flex items-center gap-1 text-xs text-slate-500 transition hover:text-blue-700"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copia tutti
                      </button>
                    </div>
                    {params.length === 0 ? (
                      <p className="text-xs text-slate-500">Nessun parametro disponibile.</p>
                    ) : (
                      <table className="w-full text-xs">
                        <tbody>
                          {params.map(([key, value]) => (
                            <tr key={key} className="border-b border-slate-200 last:border-b-0">
                              <td className="py-1 pr-2 font-medium text-slate-600">{key}</td>
                              <td className="py-1 font-mono text-slate-700 break-all">{value}</td>
                              <td className="py-1 pl-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => copy(value)}
                                  className="rounded bg-white px-2 py-0.5 text-[10px] text-slate-500 hover:text-blue-600"
                                >
                                  Copy
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
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
