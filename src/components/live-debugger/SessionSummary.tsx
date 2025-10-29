import React, { useMemo } from 'react';
import {
  Activity,
  BarChart2,
  Layers,
  TerminalSquare,
  Globe,
  Share2,
  Building2,
  BadgeCheck,
} from 'lucide-react';
import type { NormalizedEvent } from '../../types/live-debugger';

interface SessionSummaryProps {
  events: NormalizedEvent[];
  filteredEvents: NormalizedEvent[];
  running: boolean;
  startTime?: number;
}

function formatDuration(startTime?: number): string {
  if (!startTime) return '—';
  const diff = Math.floor((Date.now() - startTime) / 1000);
  const minutes = Math.floor(diff / 60);
  const seconds = diff % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function SessionSummary({ events, filteredEvents, running, startTime }: SessionSummaryProps) {
  const stats = useMemo(() => {
    let ga4 = 0;
    let ua = 0;
    let meta = 0;
    let linkedin = 0;
    let adobe = 0;
    let datalayer = 0;
    let pageviews = 0;
    let consoleEvents = 0;

    filteredEvents.forEach((event) => {
      if (event.kind === 'ga4.hit') ga4++;
      if (event.kind === 'ua.hit') ua++;
      if (event.kind === 'meta.hit') meta++;
      if (event.kind === 'linkedin.hit') linkedin++;
      if (event.kind === 'adobe.hit') adobe++;
      if (event.kind === 'page.view') pageviews++;
      if (event.kind === 'datalayer.push') datalayer++;
      if (event.kind === 'console') consoleEvents++;
    });

    return {
      total: filteredEvents.length,
      ga4,
      ua,
      meta,
      linkedin,
      adobe,
      pageviews,
      datalayer,
      console: consoleEvents,
      overallTotal: events.length,
    };
  }, [events.length, filteredEvents]);

  const cards = [
    {
      id: 'total',
      label: 'Eventi filtrati',
      value: stats.total,
      hint: `${stats.overallTotal} totali`,
      icon: Activity,
      accent: 'bg-slate-900 text-white border-slate-900',
    },
    {
      id: 'ga',
      label: 'Google hits',
      value: stats.ga4 + stats.ua,
      hint: `${stats.ga4} GA4 • ${stats.ua} UA`,
      icon: BarChart2,
      accent: 'bg-blue-50 text-blue-700 border-blue-200',
    },
    {
      id: 'meta',
      label: 'Meta Pixel',
      value: stats.meta,
      hint: 'facebook.com/tr',
      icon: Share2,
      accent: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    },
    {
      id: 'linkedin',
      label: 'LinkedIn',
      value: stats.linkedin,
      hint: 'px.ads.linkedin.com',
      icon: Building2,
      accent: 'bg-sky-50 text-sky-700 border-sky-200',
    },
    {
      id: 'adobe',
      label: 'Adobe hits',
      value: stats.adobe,
      hint: 'omtrdc / 2o7',
      icon: BadgeCheck,
      accent: 'bg-amber-50 text-amber-700 border-amber-200',
    },
    {
      id: 'dl',
      label: 'DataLayer push',
      value: stats.datalayer,
      hint: 'hook & snapshot',
      icon: Layers,
      accent: 'bg-purple-50 text-purple-700 border-purple-200',
    },
    {
      id: 'pv',
      label: 'Page Views',
      value: stats.pageviews,
      hint: 'navigation & GA4',
      icon: Globe,
      accent: 'bg-teal-50 text-teal-700 border-teal-200',
    },
    {
      id: 'console',
      label: 'Console',
      value: stats.console,
      hint: running ? `Sessione ${formatDuration(startTime)}` : 'Sessione fermata',
      icon: TerminalSquare,
      accent: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
  ];

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500 uppercase tracking-[0.08em]">
            Overview sessione
          </p>
          <p className="text-lg font-semibold text-slate-900">
            {running ? 'Streaming in tempo reale' : 'Sessione in pausa'}
          </p>
        </div>
        <div
          className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
            running ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
          }`}
        >
          <span className="inline-block h-2 w-2 rounded-full bg-current" />
          {running ? `RUNNING • ${formatDuration(startTime)}` : 'STOPPED'}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6">
        {cards.map(({ id, label, value, hint, icon: Icon, accent }) => (
          <div
            key={id}
            className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-md`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">{label}</p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.1em] text-slate-400">{hint}</p>
              </div>
              <span className={`rounded-full border px-3 py-2 ${accent}`}>
                <Icon className="h-5 w-5" />
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
