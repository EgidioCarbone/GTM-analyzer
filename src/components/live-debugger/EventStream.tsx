import React, { useMemo, useState } from 'react';
import {
  ActivitySquare,
  Network,
  Layers,
  Terminal,
  Globe2,
  ArrowUpRight,
  RefreshCcw,
  Eye,
  Copy,
  Info,
  AlertTriangle,
  OctagonAlert,
} from 'lucide-react';
import clsx from 'clsx';
import type { NormalizedEvent } from '../../types/live-debugger';
import type { AnalyzerState, EventInsight } from '../../../shared/analyzer';

interface EventStreamProps {
  events: NormalizedEvent[];
  onSelect: (event: NormalizedEvent) => void;
  onRepush: (payload: any) => void;
  analyzer: AnalyzerState;
}

type TabId = 'all' | 'network' | 'datalayer' | 'console' | 'notes';

const TABS: Array<{ id: TabId; label: string; badgeClass: string }> = [
  { id: 'all', label: 'Tutti', badgeClass: 'bg-slate-900 text-white border-slate-900' },
  { id: 'network', label: 'GA / UA', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200' },
  { id: 'datalayer', label: 'DataLayer', badgeClass: 'bg-purple-50 text-purple-700 border-purple-200' },
  { id: 'console', label: 'Console', badgeClass: 'bg-amber-50 text-amber-700 border-amber-200' },
  { id: 'notes', label: 'Note & Env', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
];

const typeMeta = {
  'ga4.hit': {
    label: 'GA4',
    tone: 'bg-blue-100 text-blue-700 border-blue-200',
    icon: Network,
  },
  'ua.hit': {
    label: 'UA',
    tone: 'bg-green-100 text-green-700 border-green-200',
    icon: Network,
  },
  'datalayer.push': {
    label: 'DataLayer',
    tone: 'bg-purple-100 text-purple-700 border-purple-200',
    icon: Layers,
  },
  console: {
    label: 'Console',
    tone: 'bg-amber-100 text-amber-700 border-amber-200',
    icon: Terminal,
  },
  env: {
    label: 'Env',
    tone: 'bg-slate-100 text-slate-700 border-slate-200',
    icon: Globe2,
  },
  note: {
    label: 'Note',
    tone: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    icon: ActivitySquare,
  },
} as const;

const insightCardTone: Record<EventInsight['severity'], string> = {
  info: 'border-blue-200 bg-blue-50 text-blue-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-700',
  error: 'border-red-200 bg-red-50 text-red-700',
};

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString('it-IT', {
    hour12: false,
    minute: '2-digit',
    second: '2-digit',
  });
}

function eventTitle(event: NormalizedEvent): string {
  switch (event.kind) {
    case 'ga4.hit':
      return event.event?.name || 'GA4 Hit';
    case 'ua.hit':
      return event.params.event_name || 'UA Hit';
    case 'datalayer.push':
      return event.payload?.event || 'DataLayer Push';
    case 'console':
      return `${event.level.toUpperCase()}: ${event.text}`;
    case 'note':
      return event.message;
    case 'env':
      return 'Environment update';
    default:
      return event.kind;
  }
}

function eventSubtitle(event: NormalizedEvent): string {
  switch (event.kind) {
    case 'ga4.hit':
      return event.url;
    case 'ua.hit':
      return event.url;
    case 'datalayer.push': {
      const name =
        typeof event.payload === 'object' && event.payload && 'event' in event.payload
          ? String((event.payload as Record<string, unknown>).event)
          : null;
      const sourceLabel = event.source === 'hook' ? 'Hook' : 'Snapshot';
      return name ? `${name} • ${sourceLabel}` : sourceLabel;
    }
    case 'console':
      return event.text;
    case 'env':
      return event.env.url;
    case 'note':
      return event.message;
    default:
      return '';
  }
}

function copy(text: string) {
  navigator.clipboard.writeText(text);
}

export function EventStream({ events, onSelect, onRepush, analyzer }: EventStreamProps) {
  const [activeTab, setActiveTab] = useState<TabId>('all');
  const [expandedInsightEvent, setExpandedInsightEvent] = useState<number | null>(null);

  const { insights } = analyzer;

  const sortedEvents = useMemo(
    () =>
      [...events].sort((a, b) => {
        if (a.ts === b.ts) return 0;
        return b.ts - a.ts;
      }),
    [events],
  );

  const tabbedEvents = useMemo(() => {
    return sortedEvents.reduce<Record<TabId, NormalizedEvent[]>>(
      (acc, event) => {
        acc.all.push(event);
        if (event.kind === 'ga4.hit' || event.kind === 'ua.hit') {
          acc.network.push(event);
        } else if (event.kind === 'datalayer.push') {
          acc.datalayer.push(event);
        } else if (event.kind === 'console') {
          acc.console.push(event);
        } else {
          acc.notes.push(event);
        }
        return acc;
      },
      { all: [], network: [], datalayer: [], console: [], notes: [] },
    );
  }, [sortedEvents]);

  const visibleEvents = tabbedEvents[activeTab];

  const insightByEventIndex = useMemo(() => {
    const map = new Map<number, EventInsight[]>();
    insights.forEach((insight) => {
      if (typeof insight.eventIndex === 'number') {
        const bucket = map.get(insight.eventIndex) ?? [];
        bucket.push(insight);
        map.set(insight.eventIndex, bucket);
      }
    });
    return map;
  }, [insights]);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-md ring-1 ring-black/5 backdrop-blur">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Event Stream</p>
          <h2 className="text-2xl font-semibold text-slate-900">Attività in tempo reale</h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium transition',
                activeTab === tab.id
                  ? `${tab.badgeClass} shadow-sm`
                  : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700',
              )}
            >
              <span>{tab.label}</span>
              <span className="rounded-full bg-black/10 px-2 text-xs font-semibold text-black/60">
                {tabbedEvents[tab.id].length}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 max-h-[580px] overflow-y-auto pr-2">
        {visibleEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-16 text-center">
            <RefreshCcw className="h-8 w-8 text-slate-300" />
            <p className="mt-4 text-base font-medium text-slate-600">Nessun evento da mostrare</p>
            <p className="mt-1 max-w-sm text-sm text-slate-500">
              Verifica i filtri attivi oppure riprova ad avviare la sessione per intercettare nuovi eventi.
            </p>
          </div>
        ) : (
          <ul className="space-y-4">
            {visibleEvents.map((event, index) => {
              const absoluteIndex = events.indexOf(event);
              const eventInsights = insightByEventIndex.get(absoluteIndex) ?? [];
              const severity = eventInsights.reduce<EventInsight['severity'] | null>((acc, curr) => {
                if (curr.severity === 'error') return 'error';
                if (curr.severity === 'warning' && acc !== 'error') return 'warning';
                if (curr.severity === 'info' && !acc) return 'info';
                return acc;
              }, null);
              const meta =
                typeMeta[event.kind as keyof typeof typeMeta] ??
                ('note' in typeMeta ? typeMeta.note : typeMeta['datalayer.push']);
              const Icon = meta.icon;
              const title = eventTitle(event);
              const subtitle = eventSubtitle(event);
              const status =
                event.kind === 'ga4.hit' || event.kind === 'ua.hit' ? event.status ?? '—' : undefined;
              const eventIndex = events.indexOf(event);
              const insightIcon = severity === 'error' ? OctagonAlert : severity === 'warning' ? AlertTriangle : Info;
              const insightTone =
                severity === 'error'
                  ? 'text-red-500'
                  : severity === 'warning'
                  ? 'text-amber-500'
                  : severity === 'info'
                  ? 'text-blue-500'
                  : null;
              const isInsightExpanded = expandedInsightEvent === absoluteIndex;
              const insightButtonTone =
                severity === 'error'
                  ? 'border-red-200 bg-red-50 text-red-600 hover:border-red-300 hover:bg-red-100'
                  : severity === 'warning'
                  ? 'border-amber-200 bg-amber-50 text-amber-600 hover:border-amber-300 hover:bg-amber-100'
                  : 'border-blue-200 bg-blue-50 text-blue-600 hover:border-blue-300 hover:bg-blue-100';

              return (
                <li
                  key={`${event.kind}-${event.ts}-${index}`}
                  className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white/60 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-1 items-start gap-3">
                      <span className={`flex h-10 w-10 items-center justify-center rounded-xl border ${meta.tone}`}>
                        <Icon className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <p className="text-base font-semibold text-slate-900">{title}</p>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                            #{eventIndex + 1}
                          </span>
                          {(event.kind === 'ga4.hit' || event.kind === 'ua.hit') && (
                            <>
                              {event.mi && (
                                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                                  {event.mi}
                                </span>
                              )}
                              {event.cid && (
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                                  CID {event.cid.slice(0, 8)}…
                                </span>
                              )}
                            </>
                          )}
                          {severity && (
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedInsightEvent((prev) =>
                                  prev === absoluteIndex ? null : absoluteIndex,
                                )
                              }
                              className={clsx(
                                'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-1',
                                insightButtonTone,
                                isInsightExpanded ? 'ring-2 ring-offset-0 ring-current' : 'focus:ring-blue-200',
                              )}
                              title={eventInsights.map((i) => i.title).join('\n')}
                            >
                              <insightIcon className={clsx('h-3 w-3', insightTone ?? 'text-slate-600')} />
                              {isInsightExpanded ? 'Nascondi insight' : `Insight (${eventInsights.length})`}
                            </button>
                          )}
                        </div>
                        {subtitle && (
                          <p
                            className="mt-1 text-sm text-slate-500 break-all"
                            style={{
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }}
                            title={subtitle}
                          >
                            {subtitle}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 text-right text-xs text-slate-400">
                      <span className="font-mono text-sm text-slate-500">{formatTime(event.ts)}</span>
                      {status !== undefined && (
                        <span
                          className={clsx(
                            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
                            status >= 200 && status < 300
                              ? 'bg-emerald-100 text-emerald-700'
                              : status >= 400
                              ? 'bg-red-100 text-red-700'
                              : 'bg-slate-100 text-slate-500',
                          )}
                        >
                          HTTP {status}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                    <button
                      onClick={() => onSelect(event)}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-slate-600 transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700"
                    >
                      <Eye className="h-4 w-4" />
                      Ispeziona
                    </button>

                    {(event.kind === 'ga4.hit' || event.kind === 'ua.hit') && (
                      <a
                        href={event.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-slate-600 transition hover:border-slate-400 hover:bg-slate-100"
                      >
                        <ArrowUpRight className="h-4 w-4" />
                        Apri richiesta
                      </a>
                    )}

                    {event.kind === 'datalayer.push' && (
                      <button
                        onClick={() => onRepush(event.payload)}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-slate-600 transition hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700"
                      >
                        <RefreshCcw className="h-4 w-4" />
                        Ripeti push
                      </button>
                    )}

                    <button
                      onClick={() => copy(JSON.stringify(event, null, 2))}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-slate-500 transition hover:border-slate-400 hover:bg-slate-100"
                    >
                      <Copy className="h-4 w-4" />
                      Copia JSON
                    </button>
                  </div>

                  {isInsightExpanded && eventInsights.length > 0 && (
                    <div className="mt-4 space-y-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                      {eventInsights.map((insight) => (
                        <div
                          key={`${insight.id}_${insight.timestamp}`}
                          className={clsx(
                            'rounded-xl border px-3 py-2 text-xs shadow-sm',
                            insightCardTone[insight.severity],
                          )}
                        >
                          <p className="text-sm font-semibold text-slate-900">{insight.title}</p>
                          {insight.description && (
                            <p className="mt-1 leading-snug text-slate-700">{insight.description}</p>
                          )}
                          {insight.recommendations && insight.recommendations.length > 0 && (
                            <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] text-slate-700">
                              {insight.recommendations.map((rec, idx) => (
                                <li key={idx}>{rec}</li>
                              ))}
                            </ul>
                          )}
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-semibold text-slate-600">
                            <span className="rounded-full bg-white/60 px-2 py-0.5">
                              {formatTime(insight.timestamp)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
