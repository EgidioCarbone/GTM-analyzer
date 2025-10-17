import React, { useEffect, useReducer, useRef, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bug, ArrowLeft } from 'lucide-react';
import type { NormalizedEvent, EnvInfo } from '../types/live-debugger';
import type { FilterState } from '../types/filters';
import * as api from '../services/live-debugger-api';
import { HeaderBar } from '../components/live-debugger/HeaderBar';
import { FiltersPro } from '../components/live-debugger/FiltersPro';
import { EventInspector } from '../components/live-debugger/EventInspector';
import { Toolbar } from '../components/live-debugger/Toolbar';
import { DLPushConsole } from '../components/live-debugger/DLPushConsole';
import { PushLibrary } from '../components/live-debugger/PushLibrary';
import { SessionSummary } from '../components/live-debugger/SessionSummary';
import { EventStream } from '../components/live-debugger/EventStream';
import { EnvPanel } from '../components/live-debugger/EnvPanel';
import { UseCasePanel } from '../components/live-debugger/UseCasePanel';
import { UseCaseEditor } from '../components/live-debugger/UseCaseEditor';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { AnimatedBackdrop } from '../components/AnimatedBackdrop';
import type { PushUseCase, RunResultSummary } from '../../shared/types';
import type { PushUseCaseDraft } from '../services/live-debugger-api';

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
  types: { datalayer: true, ga4: true, ua: true, console: false, env: false },
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
      if (event.kind === 'ga4.hit' || event.kind === 'ua.hit') {
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
      if (event.kind === 'ua.hit' && event.params) {
        return JSON.stringify(event.params).toLowerCase().includes(searchLower);
      }
      return false;
    });
  }

  return filtered;
}

export default function LiveDebuggerPage() {
  const navigate = useNavigate();
  const wsRef = useRef<WebSocket | null>(null);
  
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

  const domain = state.env?.url ? new URL(state.env.url).origin : undefined;
  const originRef = useRef<string>(window.location.origin);
  const [useCases, setUseCases] = useState<PushUseCase[]>([]);
  const [useCasesLoading, setUseCasesLoading] = useState<boolean>(false);
  const [runningUseCaseId, setRunningUseCaseId] = useState<string | null>(null);
  const [editorState, setEditorState] = useState<{ mode: 'create' | 'edit'; useCase?: PushUseCase } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PushUseCase | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const refreshUseCases = useCallback(async () => {
    setUseCasesLoading(true);
    try {
      const data = await api.getPushUseCases(originRef.current);
      setUseCases(data);
    } catch (err) {
      console.error('Failed to load use cases:', err);
    } finally {
      setUseCasesLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshUseCases();
  }, [refreshUseCases]);

  // WebSocket connection
  useEffect(() => {
    if (state.running) {
      wsRef.current = api.connectLiveDebuggerEvents(
        (event) => {
          dispatch({ type: 'ADD_EVENT', event });

          if (event.kind === 'env') {
            dispatch({ type: 'SET_ENV', env: event.env });
          }

          if (event.kind === 'push.result') {
            const summary: RunResultSummary = {
              ts: event.ts,
              ok: event.ok,
              matchedUrl: event.matched?.[0]?.url,
              status: event.matched?.[0]?.status,
              reason: event.ok ? undefined : event.reason,
            };

            setUseCases((prev) =>
              prev.map((uc) =>
                uc.id === event.id
                  ? { ...uc, lastResult: summary, updatedAt: Date.now() }
                  : uc
              )
            );

            setRunningUseCaseId((prev) => (prev === event.id ? null : prev));
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

  const handleOpenCreateUseCase = () => {
    setEditorState({ mode: 'create' });
  };

  const handleEditUseCase = (useCase: PushUseCase) => {
    setEditorState({ mode: 'edit', useCase });
  };

  const handleSaveUseCase = async (draft: PushUseCaseDraft) => {
    if (editorState?.mode === 'edit' && editorState.useCase) {
      try {
        const updated = await api.updatePushUseCase(editorState.useCase.id, draft);
        setUseCases(prev => prev.map(uc => (uc.id === updated.id ? updated : uc)));
      } catch (err: any) {
        console.error('Failed to update use case:', err);
        throw err;
      }
    } else {
      try {
        const created = await api.createPushUseCase(draft);
        setUseCases(prev => [...prev, created]);
      } catch (err: any) {
        console.error('Failed to create use case:', err);
        throw err;
      }
    }
  };

  const handleDuplicateUseCase = async (useCase: PushUseCase) => {
    const names = new Set(useCases.map((uc) => uc.name));
    const baseName = `${useCase.name} copy`;
    let candidate = baseName;
    let counter = 2;
    while (names.has(candidate)) {
      candidate = `${baseName} ${counter++}`;
    }

    const draft: PushUseCaseDraft = {
      name: candidate,
      origin: originRef.current,
      mode: useCase.mode,
      payload: useCase.mode === 'datalayer' ? JSON.parse(JSON.stringify(useCase.payload ?? {})) : undefined,
      gtagName: useCase.mode === 'gtag' ? useCase.gtagName : undefined,
      gtagParams: useCase.mode === 'gtag' ? { ...(useCase.gtagParams ?? {}) } : undefined,
      expected: {
        urlPattern: useCase.expected.urlPattern,
        mustContainParams: useCase.expected.mustContainParams
          ? { ...useCase.expected.mustContainParams }
          : undefined,
      },
      timeoutMs: useCase.timeoutMs,
    };

    try {
      const created = await api.createPushUseCase(draft);
      setUseCases(prev => [...prev, created]);
    } catch (err: any) {
      console.error('Failed to duplicate use case:', err);
      alert(err.message || 'Errore durante la duplicazione');
    }
  };

  const handleDeleteUseCase = (useCase: PushUseCase) => {
    setDeleteTarget(useCase);
  };

  const handleConfirmDeleteUseCase = async () => {
    if (!deleteTarget) return;
    try {
      setDeleteLoading(true);
      await api.deletePushUseCase(deleteTarget.id);
      setUseCases(prev => prev.filter(uc => uc.id !== deleteTarget.id));
      setRunningUseCaseId(prev => (prev === deleteTarget.id ? null : prev));
      setDeleteTarget(null);
    } catch (err: any) {
      console.error('Failed to delete use case:', err);
      alert(err.message || 'Errore durante l\'eliminazione');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleCancelDelete = () => {
    if (deleteLoading) return;
    setDeleteTarget(null);
  };

  const handleRunUseCase = async (useCase: PushUseCase) => {
    try {
      setRunningUseCaseId(useCase.id);
      await api.runPushUseCase(useCase.id);
    } catch (err: any) {
      setRunningUseCaseId(null);
      console.error('Failed to run use case:', err);
      alert(err.message || 'Errore durante l\'esecuzione');
    }
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
              <div className="space-y-6">
                <EventStream
                  events={filteredEvents}
                  onSelect={handleEventSelect}
                  onRepush={handleRepush}
                />
                <UseCasePanel
                  useCases={useCases}
                  loading={useCasesLoading}
                  runningId={runningUseCaseId}
                  deletingId={deleteLoading ? deleteTarget?.id ?? null : null}
                  onCreate={handleOpenCreateUseCase}
                  onRun={handleRunUseCase}
                  onEdit={handleEditUseCase}
                  onDuplicate={handleDuplicateUseCase}
                  onDelete={handleDeleteUseCase}
                />
              </div>

              <aside className="flex flex-col gap-6">
                <EnvPanel env={state.env} />
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                  <DLPushConsole onEvent={(event) => dispatch({ type: 'ADD_EVENT', event })} />
                  <PushLibrary onEvent={(event) => dispatch({ type: 'ADD_EVENT', event })} />
                </div>
              </aside>
            </div>
          </div>
        </main>

        <EventInspector
          event={state.selectedEvent}
          isOpen={state.showInspector}
          onClose={() => dispatch({ type: 'SELECT_EVENT', event: null })}
        />

        <UseCaseEditor
          open={Boolean(editorState)}
          mode={editorState?.mode ?? 'create'}
          initial={editorState?.useCase}
          onClose={() => setEditorState(null)}
          onSubmit={handleSaveUseCase}
        />

        <ConfirmDialog
          open={Boolean(deleteTarget)}
          title="Elimina use case"
          description={deleteTarget ? `Confermi l'eliminazione di "${deleteTarget.name}"?` : undefined}
          confirmText="Elimina"
          tone="danger"
          loading={deleteLoading}
          onConfirm={handleConfirmDeleteUseCase}
          onCancel={handleCancelDelete}
        />
      </div>
    </div>
  );
}
