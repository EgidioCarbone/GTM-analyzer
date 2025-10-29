import React, { useEffect, useReducer, useRef, useMemo } from 'react';
import type { NormalizedEvent, EnvInfo, PushMode } from '../types/live-debugger';
import type { FilterState } from '../types/filters';
import * as api from '../services/live-debugger-api';
import { HeaderBar } from '../components/live-debugger/HeaderBar';
import { FiltersPro } from '../components/live-debugger/FiltersPro';
import { EventInspector } from '../components/live-debugger/EventInspector';
import { Toolbar } from '../components/live-debugger/Toolbar';
import { DLPushConsole } from '../components/live-debugger/DLPushConsole';
import { PushLibrary } from '../components/live-debugger/PushLibrary';
import { PushTimeline, type PushTimelineEntry } from '../components/live-debugger/PushTimeline';
import { SessionSummary } from '../components/live-debugger/SessionSummary';
import { EventStream } from '../components/live-debugger/EventStream';
import { EnvPanel } from '../components/live-debugger/EnvPanel';
import { NetworkTable } from '../components/live-debugger/NetworkTable';
import { AnimatedBackdrop } from '../components/AnimatedBackdrop';
import { EventAnalyzer } from '../../shared/analyzer';
import type { AnalyzerState } from '../../shared/analyzer';

interface State {
  running: boolean;
  startTime?: number;
  env?: EnvInfo;
  events: NormalizedEvent[];
  filters: FilterState;
  selectedEvent: NormalizedEvent | null;
  showInspector: boolean;
  isDarkMode: boolean;
}

type Action =
  | { type: 'START'; startTime: number }
  | { type: 'STOP' }
  | { type: 'CLEAR_EVENTS' }
  | { type: 'ADD_EVENT'; event: NormalizedEvent }
  | { type: 'SET_ENV'; env: EnvInfo }
  | { type: 'UPDATE_FILTERS'; filters: Partial<FilterState> }
  | { type: 'SELECT_EVENT'; event: NormalizedEvent | null }
  | { type: 'TOGGLE_INSPECTOR' }
  | { type: 'TOGGLE_THEME' };

const MAX_EVENTS = 5000;

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
  showInspector: false,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'START':
      return { 
        ...state, 
        running: true, 
        startTime: action.startTime, 
        events: [], 
        env: undefined,
        selectedEvent: null,
        showInspector: false
      };
    case 'STOP':
      return { ...state, running: false, startTime: undefined };
    case 'CLEAR_EVENTS':
      return { ...state, events: [], selectedEvent: null, showInspector: false };
    case 'ADD_EVENT': {
      const events = [...state.events, action.event];
      if (events.length > MAX_EVENTS) {
        events.shift();
      }
      return { ...state, events };
    }
    case 'SET_ENV':
      return { ...state, env: action.env };
    case 'UPDATE_FILTERS':
      return { ...state, filters: { ...state.filters, ...action.filters } };
    case 'SELECT_EVENT':
      return { ...state, selectedEvent: action.event, showInspector: !!action.event };
    case 'TOGGLE_INSPECTOR':
      return { ...state, showInspector: !state.showInspector, selectedEvent: state.showInspector ? null : state.selectedEvent };
    case 'TOGGLE_THEME':
      return { ...state, isDarkMode: !state.isDarkMode };
    default:
      return state;
  }
}

function applyFilters(events: NormalizedEvent[], filters: FilterState): NormalizedEvent[] {
  let filtered = events;

  // Time range filter
  if (filters.timeRange !== 'all') {
    const now = Date.now();
    let startTime = now;
    
    switch (filters.timeRange) {
      case '30s': startTime = now - 30 * 1000; break;
      case '1m': startTime = now - 60 * 1000; break;
      case '5m': startTime = now - 5 * 60 * 1000; break;
      case '15m': startTime = now - 15 * 60 * 1000; break;
    }
    
    filtered = filtered.filter(event => event.ts >= startTime);
  }

  // Type filters
  if (!filters.types.datalayer) {
    filtered = filtered.filter(event => event.kind !== 'datalayer.push');
  }
  if (!filters.types.ga4) {
    filtered = filtered.filter(event => event.kind !== 'ga4.hit');
  }
  if (!filters.types.ua) {
    filtered = filtered.filter(event => event.kind !== 'ua.hit');
  }
  if (!filters.types.meta) {
    filtered = filtered.filter(event => event.kind !== 'meta.hit');
  }
  if (!filters.types.linkedin) {
    filtered = filtered.filter(event => event.kind !== 'linkedin.hit');
  }
  if (!filters.types.adobe) {
    filtered = filtered.filter(event => event.kind !== 'adobe.hit');
  }
  if (!filters.types.pageview) {
    filtered = filtered.filter(event => event.kind !== 'page.view');
  }
  if (!filters.types.console) {
    filtered = filtered.filter(event => event.kind !== 'console');
  }
  if (!filters.types.env) {
    filtered = filtered.filter(event => event.kind !== 'env');
  }

  // GA only filter
  if (filters.gaOnly) {
    filtered = filtered.filter(event => event.kind === 'ga4.hit' || event.kind === 'ua.hit');
  }

  // Event name filter
  if (filters.eventNames.length > 0) {
    filtered = filtered.filter(event => {
      if (event.kind === 'ga4.hit' && event.event?.name) {
        return filters.eventNames.includes(event.event.name);
      }
      if (event.kind === 'ua.hit' && event.params.event_name) {
        return filters.eventNames.includes(event.params.event_name);
      }
      if (event.kind === 'datalayer.push' && event.payload?.event) {
        return filters.eventNames.includes(event.payload.event);
      }
      if (event.kind === 'meta.hit' && event.eventName) {
        return filters.eventNames.includes(event.eventName);
      }
      if (event.kind === 'linkedin.hit' && event.eventName) {
        return filters.eventNames.includes(event.eventName);
      }
      if (event.kind === 'adobe.hit' && event.eventType) {
        return filters.eventNames.includes(event.eventType);
      }
      if (event.kind === 'page.view') {
        return filters.eventNames.includes('page.view');
      }
      return false;
    });
  }

  // Measurement ID filter
  if (filters.measurementIds.length > 0) {
    filtered = filtered.filter(event => {
      if (event.kind === 'ga4.hit' && event.mi) {
        return filters.measurementIds.includes(event.mi);
      }
      if (event.kind === 'ua.hit' && event.params.tid) {
        return filters.measurementIds.includes(event.params.tid);
      }
      return false;
    });
  }

  // CID filter
  if (filters.cid) {
    filtered = filtered.filter(event => {
      if (event.kind === 'ga4.hit' && event.cid) {
        return event.cid.includes(filters.cid);
      }
      if (event.kind === 'ua.hit' && event.params.cid) {
        return event.params.cid.includes(filters.cid);
      }
      return false;
    });
  }

  // Status code filter
  if (filters.statusCodes.length > 0) {
    filtered = filtered.filter(event => {
      if (
        event.kind === 'ga4.hit' ||
        event.kind === 'ua.hit' ||
        event.kind === 'meta.hit' ||
        event.kind === 'linkedin.hit' ||
        event.kind === 'adobe.hit'
      ) {
        return event.status && filters.statusCodes.includes(event.status as any);
      }
      return false;
    });
  }

  // Host filter
  if (filters.hostFilter !== 'all') {
    filtered = filtered.filter(event => {
      if (event.kind === 'ga4.hit' || event.kind === 'ua.hit') {
        const url = new URL(event.url);
        const hostname = url.hostname;
        
        switch (filters.hostFilter) {
          case 'google-analytics.com':
            return hostname.includes('google-analytics.com');
          case 'region':
            return hostname.includes('region') || hostname.includes('analytics');
          case 'custom':
            if (filters.customHostRegex) {
              try {
                const regex = new RegExp(filters.customHostRegex);
                return regex.test(event.url);
              } catch {
                return false;
              }
            }
            return true;
        }
      }
      return true;
    });
  }

  // Search text filter
  if (filters.searchText) {
    const searchLower = filters.searchText.toLowerCase();
    filtered = filtered.filter(event => {
      if (event.kind === 'datalayer.push' && event.payload) {
        return JSON.stringify(event.payload).toLowerCase().includes(searchLower);
      }
      if (event.kind === 'ga4.hit' && event.event) {
        return JSON.stringify(event.event).toLowerCase().includes(searchLower);
      }
      if ((event.kind === 'ua.hit' || event.kind === 'meta.hit' || event.kind === 'linkedin.hit' || event.kind === 'adobe.hit') && event.params) {
        return JSON.stringify(event.params).toLowerCase().includes(searchLower);
      }
      if (event.kind === 'page.view') {
        const payload = { url: event.url, title: event.title, source: event.source };
        return JSON.stringify(payload).toLowerCase().includes(searchLower);
      }
      if (event.kind === 'note') {
        return event.message.toLowerCase().includes(searchLower);
      }
      if (event.kind === 'console') {
        return event.text.toLowerCase().includes(searchLower);
      }
      return false;
    });
  }

  return filtered;
}

export default function LiveDebuggerPage() {
  const wsRef = useRef<WebSocket | null>(null);
  const analyzerRef = useRef(new EventAnalyzer());

  const [state, dispatch] = useReducer(reducer, {
    running: false,
    events: [],
    filters: defaultFilters,
    selectedEvent: null,
    showInspector: false,
    isDarkMode: false
  });

  const filteredEvents = useMemo(() => {
    return applyFilters(state.events, state.filters);
  }, [state.events, state.filters]);

  const analyzerState = useMemo<AnalyzerState>(() => {
    const analyzer = analyzerRef.current;
    analyzer.reset();
    state.events.forEach((event, idx) => analyzer.process(event, idx));
    return analyzer.getState();
  }, [state.events]);

  const domain = state.env?.url ? new URL(state.env.url).origin : undefined;

  const pushTimelineEntries = useMemo<PushTimelineEntry[]>(() => {
    type TimelineHitEvent =
      | Extract<NormalizedEvent, { kind: 'ga4.hit' }>
      | Extract<NormalizedEvent, { kind: 'ua.hit' }>
      | Extract<NormalizedEvent, { kind: 'meta.hit' }>
      | Extract<NormalizedEvent, { kind: 'linkedin.hit' }>
      | Extract<NormalizedEvent, { kind: 'adobe.hit' }>;

    type AccEntry = {
      pushId: string;
      command?: Extract<NormalizedEvent, { kind: 'push.command' }>;
      commandIndex?: number;
      datalayer?: Extract<NormalizedEvent, { kind: 'datalayer.push' }>;
      datalayerIndex?: number;
      hits: Array<{
        kind: TimelineHitEvent['kind'];
        event: TimelineHitEvent;
        index: number;
      }>;
      result?: Extract<NormalizedEvent, { kind: 'push.result' }>;
      resultIndex?: number;
      origin?: 'console' | 'library' | 'usecase' | 'api';
      mode?: PushMode;
    };

    const accMap = new Map<string, AccEntry>();

    const ensureEntry = (pushId: string): AccEntry => {
      let acc = accMap.get(pushId);
      if (!acc) {
        acc = { pushId, hits: [] };
        accMap.set(pushId, acc);
      }
      return acc;
    };

    state.events.forEach((event, idx) => {
      switch (event.kind) {
        case 'push.command': {
          const acc = ensureEntry(event.id);
          acc.command = event;
          acc.commandIndex = idx;
          acc.origin = event.origin ?? acc.origin;
          acc.mode = event.mode ?? acc.mode;
          break;
        }
        case 'datalayer.push': {
          if (!event.meta?.pushId) {
            return;
          }
          const acc = ensureEntry(event.meta.pushId);
          acc.datalayer = event;
          acc.datalayerIndex = idx;
          acc.origin = event.meta.origin ?? acc.origin;
          acc.mode = event.meta.mode ?? acc.mode;
          break;
        }
        case 'ga4.hit':
        case 'ua.hit':
        case 'meta.hit':
        case 'linkedin.hit':
        case 'adobe.hit': {
          if (!event.pushId) {
            return;
          }
          const acc = ensureEntry(event.pushId);
          acc.hits.push({ kind: event.kind, event, index: idx });
          acc.origin = event.origin ?? acc.origin;
          if (!acc.mode) {
            if (acc.command) {
              acc.mode = acc.command.mode;
            } else if (event.kind === 'meta.hit') {
              acc.mode = 'meta';
            } else if (event.kind === 'linkedin.hit') {
              acc.mode = 'linkedin';
            } else if (event.kind === 'adobe.hit') {
              acc.mode = 'adobe';
            }
          }
          break;
        }
        case 'push.result': {
          const acc = ensureEntry(event.id);
          acc.result = event;
          acc.resultIndex = idx;
          break;
        }
        default:
          break;
      }
    });

    const entries: Array<PushTimelineEntry & { timestamp: number }> = Array.from(accMap.values()).map((acc) => {
      const sourceTs = acc.datalayer?.ts ?? acc.command?.ts;
      const hits = acc.hits
        .map((hit) => ({
          ...hit,
          delayMs: sourceTs ? hit.event.ts - sourceTs : undefined,
        }))
        .sort((a, b) => a.index - b.index);

      const tsCandidates = [
        acc.command?.ts ?? null,
        acc.datalayer?.ts ?? null,
        hits[0]?.event.ts ?? null,
        acc.result?.ts ?? null,
      ].filter((value): value is number => value !== null);

      const timestamp = tsCandidates.length > 0 ? Math.max(...tsCandidates) : 0;

      return {
        id: `push-${acc.pushId}`,
        pushId: acc.pushId,
        origin: acc.origin,
        mode: acc.command?.mode ?? acc.mode,
        command: acc.command,
        commandIndex: acc.commandIndex,
        datalayer: acc.datalayer,
        datalayerIndex: acc.datalayerIndex,
        hits,
        result: acc.result,
        resultIndex: acc.resultIndex,
        timestamp,
      };
    });

    entries.sort((a, b) => b.timestamp - a.timestamp);

    return entries.slice(0, 200).map(({ timestamp, ...rest }) => rest);
  }, [state.events]);

  // WebSocket connection
  useEffect(() => {
    if (state.running) {
      wsRef.current = api.connectLiveDebuggerEvents(
        (event) => {
          dispatch({ type: 'ADD_EVENT', event });

          if (event.kind === 'env') {
            dispatch({ type: 'SET_ENV', env: event.env });
          }

        },
        (err) => {
          console.error('WebSocket error:', err);
        }
      );
    } else {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [state.running]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        dispatch({ type: 'SELECT_EVENT', event: null });
      } else if (e.key === 'p' || e.key === 'P') {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          dispatch({ type: 'UPDATE_FILTERS', filters: { isPaused: !state.filters.isPaused } });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.filters.isPaused]);

  const handleStart = async (url: string) => {
    try {
      await api.startLiveDebugger({ url, headless: true, redactPII: true });
      dispatch({ type: 'START', startTime: Date.now() });
    } catch (err: any) {
      console.error('Failed to start session:', err);
      alert(`Errore: ${err.message}`);
    }
  };

  const handleStop = async () => {
    try {
      await api.stopLiveDebugger();
      dispatch({ type: 'STOP' });
    } catch (err: any) {
      console.error('Failed to stop session:', err);
    }
  };

  const handlePause = () => {
    dispatch({ type: 'UPDATE_FILTERS', filters: { isPaused: true } });
  };

  const handleResume = () => {
    dispatch({ type: 'UPDATE_FILTERS', filters: { isPaused: false } });
  };

  const handleClear = () => {
    dispatch({ type: 'CLEAR_EVENTS' });
  };

  const handleReset = () => {
    dispatch({ type: 'UPDATE_FILTERS', filters: defaultFilters });
  };

  const handleExport = (format: 'ndjson' | 'csv') => {
    // Export logic is handled in Toolbar component
  };

  const handleThemeToggle = () => {
    dispatch({ type: 'TOGGLE_THEME' });
  };

  const handleEventSelect = (event: NormalizedEvent) => {
    dispatch({ type: 'SELECT_EVENT', event });
  };

  const handleRepush = (payload: any) => {
    // This will be handled by the DLPushConsole
    console.log('Repush payload:', payload);
  };

  const handleFilterByEvent = (eventName: string) => {
    const currentEventNames = state.filters.eventNames;
    if (!currentEventNames.includes(eventName)) {
      dispatch({ 
        type: 'UPDATE_FILTERS', 
        filters: { eventNames: [...currentEventNames, eventName] } 
      });
    }
  };

  const handleFilterByStatus = (status: number) => {
    const currentStatusCodes = state.filters.statusCodes;
    if (!currentStatusCodes.includes(status as any)) {
      dispatch({ 
        type: 'UPDATE_FILTERS', 
        filters: { statusCodes: [...currentStatusCodes, status as any] } 
      });
    }
  };

  const handleTimeRangeSelect = (start: number, end: number) => {
    dispatch({ 
      type: 'UPDATE_FILTERS', 
      filters: { 
        customTimeRange: { start, end },
        timeRange: 'custom' as any
      } 
    });
  };

  return (
    <div
      className={`relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-100 via-white to-blue-50 ${
        state.isDarkMode ? 'dark' : ''
      }`}
    >
      <AnimatedBackdrop variant="default" />
      <div className="relative z-10 flex min-h-screen flex-col">
        <HeaderBar
          running={state.running}
          startTime={state.startTime}
          env={state.env}
          onStart={handleStart}
          onStop={handleStop}
          onPause={handlePause}
          onResume={handleResume}
          isPaused={state.filters.isPaused}
        />

        <main className="flex-1 overflow-hidden">
          <div className="mx-auto flex h-full w-full max-w-7xl flex-col gap-6 px-6 py-6">
            <SessionSummary
              events={state.events}
              filteredEvents={filteredEvents}
              running={state.running}
              startTime={state.startTime}
            />

            <FiltersPro
              filters={state.filters}
              onFiltersChange={(filters) => dispatch({ type: 'UPDATE_FILTERS', filters })}
              events={state.events}
              domain={domain}
            />

            <Toolbar
              events={state.events}
              filters={state.filters}
              onClear={handleClear}
              onPause={handlePause}
              onResume={handleResume}
              onExport={handleExport}
              onThemeToggle={handleThemeToggle}
              onReset={handleReset}
            />

            <div className="grid gap-6 lg:grid-cols-[1.75fr_1.25fr] xl:grid-cols-[1.5fr_1.2fr]">
              <div className="space-y-6 order-1 lg:order-1">
                <EventStream
                  events={filteredEvents}
                  onSelect={handleEventSelect}
                  onRepush={handleRepush}
                  analyzer={analyzerState}
                />
                <PushLibrary events={state.events} />
              </div>

              <aside className="flex flex-col gap-6 order-3 lg:order-2">
                <EnvPanel env={state.env} />
                <DLPushConsole onEvent={(event) => dispatch({ type: 'ADD_EVENT', event })} />
              </aside>

              <div className="order-2 lg:order-3 lg:col-span-2">
                <PushTimeline entries={pushTimelineEntries} />
              </div>

              <div className="order-4 lg:order-4 lg:col-span-2">
                <NetworkTable
                  events={filteredEvents}
                  filters={state.filters}
                  onEventSelect={handleEventSelect}
                />
              </div>
            </div>
          </div>
        </main>

        <EventInspector
          event={state.selectedEvent}
          isOpen={state.showInspector}
          onClose={() => dispatch({ type: 'SELECT_EVENT', event: null })}
        />
      </div>
    </div>
  );
}
