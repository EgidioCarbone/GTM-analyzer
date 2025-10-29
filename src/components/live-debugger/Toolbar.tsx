import React, { useState } from 'react';
import {
  Trash2,
  Pause,
  Play,
  Download,
  Sun,
  RotateCcw,
  FileText,
  Table,
  ActivitySquare,
  BarChart3,
  Layers,
  Globe,
} from 'lucide-react';
import type { NormalizedEvent } from '../../types/live-debugger';
import type { FilterState } from '../../types/filters';

interface ToolbarProps {
  events: NormalizedEvent[];
  filters: FilterState;
  onClear: () => void;
  onPause: () => void;
  onResume: () => void;
  onExport: (format: 'ndjson' | 'csv') => void;
  onThemeToggle: () => void;
  onReset: () => void;
}

export function Toolbar({ 
  events, 
  filters, 
  onClear, 
  onPause, 
  onResume, 
  onExport, 
  onThemeToggle, 
  onReset 
}: ToolbarProps) {
  const [showExportMenu, setShowExportMenu] = useState(false);

  const exportToNDJSON = () => {
    const data = events.map(event => JSON.stringify(event)).join('\n');
    const blob = new Blob([data], { type: 'application/x-ndjson' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `live-debugger-events-${new Date().toISOString().slice(0, 19)}.ndjson`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  const exportToCSV = () => {
    const networkEvents = events.filter(
      (event) =>
        event.kind === 'ga4.hit' ||
        event.kind === 'ua.hit' ||
        event.kind === 'meta.hit' ||
        event.kind === 'linkedin.hit' ||
        event.kind === 'adobe.hit',
    );

    const headers = ['timestamp', 'type', 'name', 'identifier', 'status', 'url'];
    const rows = networkEvents.map((event) => {
      const timestamp = new Date(event.ts).toISOString();
      let type = '';
      let name = '';
      let identifier = '';

      switch (event.kind) {
        case 'ga4.hit':
          type = 'GA4';
          name = event.event?.name || '';
          identifier = event.mi || '';
          break;
        case 'ua.hit':
          type = 'UA';
          name = event.params.event_name || '';
          identifier = event.params.tid || '';
          break;
        case 'meta.hit':
          type = 'Meta Pixel';
          name = event.eventName || '';
          identifier = event.pixelId || '';
          break;
        case 'linkedin.hit':
          type = 'LinkedIn';
          name = event.eventName || '';
          identifier = event.trackingId || '';
          break;
        case 'adobe.hit':
          type = 'Adobe Analytics';
          name = event.eventType || '';
          identifier = event.reportSuite || '';
          break;
        default:
          type = event.kind;
      }

      const status = event.status || '';
      const url = event.url;

      return [timestamp, type, name, identifier, status, url];
    });

    const csvContent = [headers, ...rows]
      .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `live-debugger-network-hits-${new Date().toISOString().slice(0, 19)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  const eventCount = events.length;
  const googleHits = events.filter(e => e.kind === 'ga4.hit' || e.kind === 'ua.hit').length;
  const metaHits = events.filter(e => e.kind === 'meta.hit').length;
  const linkedinHits = events.filter(e => e.kind === 'linkedin.hit').length;
  const adobeHits = events.filter(e => e.kind === 'adobe.hit').length;
  const dlEventCount = events.filter(e => e.kind === 'datalayer.push').length;
  const pageViewCount = events.filter(e => e.kind === 'page.view').length;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-black/5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-4 text-sm font-medium text-slate-600">
          <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-slate-700">
            <ActivitySquare className="h-4 w-4 text-slate-500" />
            {eventCount} eventi
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-blue-700">
            <BarChart3 className="h-4 w-4" />
            {googleHits} Google hits
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1.5 text-indigo-700">
            <BarChart3 className="h-4 w-4" />
            {metaHits} Meta
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1.5 text-sky-700">
            <BarChart3 className="h-4 w-4" />
            {linkedinHits} LinkedIn
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-amber-700">
            <BarChart3 className="h-4 w-4" />
            {adobeHits} Adobe
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-purple-50 px-3 py-1.5 text-purple-700">
            <Layers className="h-4 w-4" />
            {dlEventCount} DL pushes
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1.5 text-teal-700">
            <Globe className="h-4 w-4" />
            {pageViewCount} Page view
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onClear}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-semibold text-slate-600 transition hover:border-red-200 hover:text-red-600"
            title="Clear All Events"
          >
            <Trash2 className="h-4 w-4" />
            Svuota
          </button>

          <button
            onClick={filters.isPaused ? onResume : onPause}
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
              filters.isPaused
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300'
                : 'border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-300'
            }`}
            title={filters.isPaused ? 'Resume Stream' : 'Pause Stream'}
          >
            {filters.isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            {filters.isPaused ? 'Riprendi' : 'Pausa'}
          </button>

          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-semibold text-slate-600 transition hover:border-blue-200 hover:text-blue-600"
              title="Export Data"
            >
              <Download className="h-4 w-4" />
              Export
            </button>

            {showExportMenu && (
              <div className="absolute right-0 top-full mt-2 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                <button
                  onClick={exportToNDJSON}
                  className="flex w-full items-center gap-2 px-4 py-3 text-sm text-slate-600 transition hover:bg-slate-50"
                >
                  <FileText className="h-4 w-4" />
                  Export NDJSON (tutti gli eventi)
                </button>
                <button
                  onClick={exportToCSV}
                  className="flex w-full items-center gap-2 px-4 py-3 text-sm text-slate-600 transition hover:bg-slate-50"
                >
                  <Table className="h-4 w-4" />
                  Export CSV (network hits)
                </button>
              </div>
            )}
          </div>

          <button
            onClick={onReset}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-semibold text-slate-600 transition hover:border-orange-200 hover:text-orange-600"
            title="Reset Filters"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </button>

          <button
            onClick={onThemeToggle}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
            title="Toggle Theme"
          >
            <Sun className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-400">
        <span>⌘/Ctrl + K · Focus search</span>
        <span>P · Pause/Resume</span>
        <span>E · Export</span>
        <span>Esc · Chiudi inspector</span>
      </div>
    </section>
  );
}
