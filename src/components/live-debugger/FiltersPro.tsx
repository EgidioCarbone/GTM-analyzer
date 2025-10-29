import React, { useState, useEffect, useMemo } from 'react';
import { 
  Filter, 
  Clock, 
  Type, 
  Search, 
  RotateCcw,
  ChevronDown
} from 'lucide-react';
import type { FilterState } from '../../types/filters';
import type { NormalizedEvent } from '../../types/live-debugger';
import clsx from 'clsx';

interface FiltersProProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  events: NormalizedEvent[];
  domain?: string;
}

export function FiltersPro({ filters, onFiltersChange, events, domain }: FiltersProProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchDebounced, setSearchDebounced] = useState(filters.searchText);

  const typeOptions: Array<{ key: keyof FilterState['types']; label: string }> = [
    { key: 'datalayer', label: 'DataLayer' },
    { key: 'pageview', label: 'Page View' },
    { key: 'ga4', label: 'GA4' },
    { key: 'ua', label: 'UA' },
    { key: 'meta', label: 'Meta Pixel' },
    { key: 'linkedin', label: 'LinkedIn' },
    { key: 'adobe', label: 'Adobe' },
    { key: 'console', label: 'Console' },
    { key: 'env', label: 'Env' },
  ];

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      onFiltersChange({ ...filters, searchText: searchDebounced });
    }, 250);
    return () => clearTimeout(timer);
  }, [searchDebounced]);

  // Extract unique values from events
  const uniqueValues = useMemo(() => {
    const eventNames = new Set<string>();
    const measurementIds = new Set<string>();
    const statusCodes = new Set<number>();

    events.forEach(event => {
      if (event.kind === 'ga4.hit') {
        if (event.event?.name) eventNames.add(event.event.name);
        if (event.mi) measurementIds.add(event.mi);
        if (event.status) statusCodes.add(event.status);
      } else if (event.kind === 'ua.hit') {
        if (event.params.event_name) eventNames.add(event.params.event_name);
        if (event.params.tid) measurementIds.add(event.params.tid);
        if (event.status) statusCodes.add(event.status);
      } else if (event.kind === 'meta.hit') {
        if (event.eventName) eventNames.add(event.eventName);
        if (event.status) statusCodes.add(event.status);
      } else if (event.kind === 'linkedin.hit') {
        if (event.eventName) eventNames.add(event.eventName);
        if (event.status) statusCodes.add(event.status);
      } else if (event.kind === 'adobe.hit') {
        if (event.eventType) eventNames.add(event.eventType);
        if (event.status) statusCodes.add(event.status);
      } else if (event.kind === 'page.view') {
        eventNames.add('page.view');
      } else if (event.kind === 'datalayer.push' && event.payload?.event) {
        eventNames.add(event.payload.event);
      }
    });

    return {
      eventNames: Array.from(eventNames).sort(),
      measurementIds: Array.from(measurementIds).sort(),
      statusCodes: Array.from(statusCodes).sort((a, b) => a - b)
    };
  }, [events]);

  // Persist filters to localStorage
  useEffect(() => {
    if (domain) {
      localStorage.setItem(`live-debugger-filters-${domain}`, JSON.stringify(filters));
    }
  }, [filters, domain]);

  // Load filters from localStorage
  useEffect(() => {
    if (domain) {
      const saved = localStorage.getItem(`live-debugger-filters-${domain}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          const mergedTypes = { ...filters.types, ...(parsed.types ?? {}) };
          onFiltersChange({ ...filters, ...parsed, types: mergedTypes });
          if (typeof parsed.searchText === 'string') {
            setSearchDebounced(parsed.searchText);
          }
        } catch (err) {
          console.error('Failed to load saved filters:', err);
        }
      }
    }
  }, [domain]);

  const handleTypeToggle = (type: keyof FilterState['types']) => {
    const newTypes = { ...filters.types, [type]: !filters.types[type] };
    onFiltersChange({ ...filters, types: newTypes });
  };

  const handleEventNameToggle = (eventName: string) => {
    const newEventNames = filters.eventNames.includes(eventName)
      ? filters.eventNames.filter(name => name !== eventName)
      : [...filters.eventNames, eventName];
    onFiltersChange({ ...filters, eventNames: newEventNames });
  };

  const handleMeasurementIdToggle = (mi: string) => {
    const newMIs = filters.measurementIds.includes(mi)
      ? filters.measurementIds.filter(id => id !== mi)
      : [...filters.measurementIds, mi];
    onFiltersChange({ ...filters, measurementIds: newMIs });
  };

  const handleStatusCodeToggle = (status: number) => {
    const newStatusCodes = filters.statusCodes.includes(status as any)
      ? filters.statusCodes.filter(s => s !== status)
      : [...filters.statusCodes, status as any];
    onFiltersChange({ ...filters, statusCodes: newStatusCodes });
  };

  const resetFilters = () => {
    const defaultFilters: FilterState = {
      timeRange: '5m',
      types: {
        datalayer: true,
        pageview: true,
        ga4: true,
        ua: true,
        meta: true,
        linkedin: true,
        adobe: true,
        console: false,
        env: false,
      },
      gaOnly: false,
      eventNames: [],
      measurementIds: [],
      cid: '',
      statusCodes: [],
      hostFilter: 'all',
      customHostRegex: '',
      searchText: '',
      isPaused: false,
      showInspector: false
    };
    onFiltersChange(defaultFilters);
    setSearchDebounced('');
  };

  const activeFiltersCount = [
    filters.eventNames.length,
    filters.measurementIds.length,
    filters.statusCodes.length,
    filters.cid,
    filters.searchText,
    filters.customHostRegex
  ].filter(Boolean).length;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-black/5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-4">
          {/* Time Range */}
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 shadow-sm">
            <Clock className="h-4 w-4 text-slate-400" />
            <select
              value={filters.timeRange}
              onChange={(e) => onFiltersChange({ ...filters, timeRange: e.target.value as any })}
              className="bg-transparent text-sm font-medium text-slate-700 outline-none"
            >
              <option value="30s">Ultimi 30s</option>
              <option value="1m">Ultimi 1m</option>
              <option value="5m">Ultimi 5m</option>
              <option value="15m">Ultimi 15m</option>
              <option value="all">Tutto</option>
            </select>
          </div>

          {/* Type Toggles */}
          <div className="flex items-center gap-2">
            <Type className="h-4 w-4 text-slate-400" />
            <div className="flex flex-wrap gap-1">
              {typeOptions.map(({ key, label }) => {
                const enabled = filters.types[key];
                return (
                <button
                  key={key}
                  onClick={() => handleTypeToggle(key)}
                  className={clsx(
                    'rounded-full border px-3 py-1 text-xs font-semibold transition',
                    enabled
                      ? 'border-blue-200 bg-blue-50 text-blue-700'
                      : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700'
                  )}
                >
                  {label}
                </button>
              );
              })}
            </div>
          </div>

          {/* GA Only Quick Toggle */}
          <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 shadow-sm">
            <input
              type="checkbox"
              checked={filters.gaOnly}
              onChange={(e) => onFiltersChange({ ...filters, gaOnly: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            Solo Google
          </label>

          {/* Search */}
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 shadow-sm">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchDebounced}
              onChange={(e) => setSearchDebounced(e.target.value)}
              placeholder="Cerca nel payload..."
              className="w-48 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeFiltersCount > 0 && (
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600">
              {activeFiltersCount} filtri attivi
            </span>
          )}

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
          >
            <Filter className="h-4 w-4" />
            Filtri avanzati
            <ChevronDown className={clsx('h-4 w-4 transition-transform', isExpanded && 'rotate-180')} />
          </button>

          <button
            onClick={resetFilters}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </button>
        </div>
      </div>

      {/* Advanced Filters Panel */}
      {isExpanded && (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* Event Names */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-600">
                Event Names ({filters.eventNames.length})
              </label>
              <div className="max-h-32 space-y-1 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-inner">
                {uniqueValues.eventNames.map(eventName => (
                  <label key={eventName} className="flex items-center gap-2 rounded px-2 py-1 text-sm text-slate-600 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={filters.eventNames.includes(eventName)}
                      onChange={() => handleEventNameToggle(eventName)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="truncate">{eventName}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Measurement IDs */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-600">
                Measurement IDs ({filters.measurementIds.length})
              </label>
              <div className="max-h-32 space-y-1 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-inner">
                {uniqueValues.measurementIds.map(mi => (
                  <label key={mi} className="flex items-center gap-2 rounded px-2 py-1 text-sm text-slate-600 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={filters.measurementIds.includes(mi)}
                      onChange={() => handleMeasurementIdToggle(mi)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="font-mono text-xs">{mi}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Status Codes */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-600">
                Status Codes ({filters.statusCodes.length})
              </label>
              <div className="max-h-32 space-y-1 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-inner">
                {uniqueValues.statusCodes.map(status => (
                  <label key={status} className="flex items-center gap-2 rounded px-2 py-1 text-sm text-slate-600 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={filters.statusCodes.includes(status as any)}
                      onChange={() => handleStatusCodeToggle(status)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="font-mono text-xs">{status}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* CID Filter */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-600">
                Client ID (CID)
              </label>
              <input
                type="text"
                value={filters.cid}
                onChange={(e) => onFiltersChange({ ...filters, cid: e.target.value })}
                placeholder="Filtra per CID..."
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-inner placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {/* Host Filter */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-600">
                Host/Endpoint
              </label>
              <div className="space-y-2">
                <select
                  value={filters.hostFilter}
                  onChange={(e) => onFiltersChange({ ...filters, hostFilter: e.target.value as any })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-inner focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                >
                  <option value="all">Tutti gli host</option>
                  <option value="google-analytics.com">google-analytics.com</option>
                  <option value="region">Regioni GA</option>
                  <option value="custom">Regex personalizzato</option>
                </select>
                
                {filters.hostFilter === 'custom' && (
                  <input
                    type="text"
                    value={filters.customHostRegex}
                    onChange={(e) => onFiltersChange({ ...filters, customHostRegex: e.target.value })}
                    placeholder="es: google-analytics\.com.*collect"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-700 shadow-inner focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
