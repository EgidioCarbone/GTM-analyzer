import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Edit,
  Trash2,
  Plus,
  Save,
  Upload,
  X,
  Layers,
  CheckSquare,
  Square,
  Trash,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from 'lucide-react';
import clsx from 'clsx';
import { toast } from 'react-hot-toast';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import * as api from '../../services/live-debugger-api';
import type { NormalizedEvent } from '../../types/live-debugger';

interface SavedPush {
  id: string;
  name: string;
  payload: any;
  createdAt: number;
  lastUsed?: number;
}

interface PushLibraryProps {
  events: NormalizedEvent[];
}

const DEFAULT_TEMPLATE =
  '{\n  "event": "navigation_click",\n  "event_category": "menu_secondo_livello",\n  "event_action": "path_destinazione",\n  "event_label": "button_name",\n  "navigation_type": "desktop"\n}';
const MINIMAL_TEMPLATE = '{\n  "event": "navigation_click"\n}';

interface PushRunStatus {
  status: 'pending' | 'waiting' | 'success' | 'timeout' | 'nomatch' | 'error';
  startedAt: number;
  completedAt?: number;
  expectedEventName?: string;
  pushCommandId?: string;
  matchedUrl?: string;
  httpStatus?: number;
  reason?: string;
}

export function PushLibrary({ events }: PushLibraryProps) {
  const [savedPushes, setSavedPushes] = useState<SavedPush[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', payload: DEFAULT_TEMPLATE });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteDialog, setDeleteDialog] = useState<{ ids: string[]; title: string; description?: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [runStates, setRunStates] = useState<Record<string, PushRunStatus>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const commandMapRef = useRef<Map<string, { pushId: string }>>(new Map());
  const lastEventIndexRef = useRef(0);

  // Load pushes from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('live-debugger-saved-pushes');
    if (saved) {
      try {
        setSavedPushes(JSON.parse(saved));
      } catch (err) {
        console.error('Failed to load saved pushes:', err);
      }
    }
  }, []);

  const saveToStorage = (updater: (prev: SavedPush[]) => SavedPush[]) => {
    setSavedPushes(prev => {
      const next = updater(prev);
      localStorage.setItem('live-debugger-saved-pushes', JSON.stringify(next));
      return next;
    });
  };

  const resetForm = () => {
    setFormData({ name: '', payload: MINIMAL_TEMPLATE });
    setEditingId(null);
    setShowForm(false);
  };

  const openCreateForm = () => {
    setEditingId(null);
    setFormData({ name: '', payload: MINIMAL_TEMPLATE });
    setShowForm(true);
  };

  const getPushNames = (ids: string[]) => {
    const map = new Map(savedPushes.map((p) => [p.id, p.name]));
    return ids.map(id => map.get(id) ?? id);
  };

  const openDeleteDialog = (ids: string[]) => {
    if (ids.length === 0) return;
    const names = getPushNames(ids);
    const previewList = names.slice(0, 3).map(name => `• ${name}`).join('\n');
    const extra = names.length > 3 ? `\n… e altri ${names.length - 3}` : '';
    setDeleteDialog({
      ids,
      title: ids.length === 1 ? 'Elimina push' : 'Elimina push selezionati',
      description:
        ids.length === 1
          ? `Confermi l'eliminazione di “${names[0]}”?`
          : `Confermi l'eliminazione di ${ids.length} push?\n${previewList}${extra}`,
    });
  };

  const handleSave = () => {
    if (!formData.name.trim() || !formData.payload.trim()) {
      toast.error('Nome e payload sono obbligatori');
      return;
    }

    try {
      const payload = JSON.parse(formData.payload);
      if (editingId) {
        setRunStates(state => {
          const next = { ...state };
          delete next[editingId];
          return next;
        });
      }
      saveToStorage(prev => {
        if (editingId) {
          return prev.map(p =>
            p.id === editingId
              ? {
                  ...p,
                  name: formData.name.trim(),
                  payload,
                  lastUsed: Date.now(),
                }
              : p
          );
        }

        return [
          ...prev,
          {
            id: crypto.randomUUID(),
            name: formData.name.trim(),
            payload,
            createdAt: Date.now(),
            lastUsed: Date.now(),
          },
        ];
      });

      resetForm();
      toast.success(editingId ? 'Push aggiornato' : 'Push salvato');
    } catch (err) {
      toast.error('Payload JSON non valido');
    }
  };

  const executePush = async (push: SavedPush) => {
    const expectedEventName = extractEventName(push.payload);
    const startedAt = Date.now();
    for (const [commandId, meta] of Array.from(commandMapRef.current.entries())) {
      if (meta.pushId === push.id) {
        commandMapRef.current.delete(commandId);
      }
    }
    upsertRunState(push.id, () => ({
      status: 'pending',
      startedAt,
      expectedEventName,
    }));

    setRunningId(push.id);
    try {
      const result = await api.pushLiveDebugger({
        mode: 'datalayer',
        payload: push.payload,
        trackCollect: true,
        match: expectedEventName ? 'eventName' : 'auto',
        timeoutMs: 15000,
        origin: 'library',
      });

      commandMapRef.current.set(result.id, { pushId: push.id });

      upsertRunState(push.id, (prev) => ({
        status: 'waiting',
        startedAt: prev?.startedAt ?? startedAt,
        expectedEventName,
        pushCommandId: result.id,
      }));

      saveToStorage(prev =>
        prev.map(p => (p.id === push.id ? { ...p, lastUsed: Date.now() } : p))
      );

      toast(`Push “${push.name}” inviato. In attesa del GA4…`);
    } catch (err: any) {
      upsertRunState(push.id, () => ({
        status: 'error',
        startedAt,
        completedAt: Date.now(),
        reason: err.message,
      }));
      toast.error(`Errore nell'esecuzione: ${err.message}`);
    } finally {
      setRunningId(null);
    }
  };

  const handleEdit = (push: SavedPush) => {
    setFormData({
      name: push.name,
      payload: JSON.stringify(push.payload, null, 2),
    });
    setEditingId(push.id);
    setShowForm(true);
  };

  const formatTime = (ts: number) =>
    new Date(ts).toLocaleString('it-IT', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

  const handleImport = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const list = Array.isArray(parsed) ? parsed : [parsed];

      const normalized: SavedPush[] = list.map((item, idx) => {
        if (typeof item !== 'object' || item === null) {
          throw new Error('Ogni elemento deve essere un oggetto con name e payload.');
        }
        const anyItem = item as Record<string, any>;
        const payload =
          typeof anyItem.payload === 'object' && anyItem.payload !== null
            ? anyItem.payload
            : { ...anyItem };
        const name =
          typeof anyItem.name === 'string' && anyItem.name.trim().length > 0
            ? anyItem.name.trim()
            : `import_${idx + 1}`;
        return {
          id: crypto.randomUUID(),
          name,
          payload,
          createdAt: Date.now(),
        };
      });

      saveToStorage(prev => [...prev, ...normalized]);
      toast.success(`Importati ${normalized.length} push.`);
    } catch (err: any) {
      console.error(err);
      toast.error(
        'Impossibile importare il file JSON. Atteso un array di oggetti { "name": "...", "payload": {...} } oppure un singolo oggetto.'
      );
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const handleRunAll = async () => {
    if (savedPushes.length === 0) return;
    setIsRunningAll(true);
    const snapshot = [...savedPushes];
    for (let i = 0; i < snapshot.length; i++) {
      await executePush(snapshot[i]);
      if (i < snapshot.length - 1) {
        await delay(5000);
      }
    }
    setIsRunningAll(false);
  };

  const handleModalOpen = () => {
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setShowForm(false);
    setEditingId(null);
    setIsSelectionMode(false);
    setSelectedIds([]);
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const allSelected =
    savedPushes.length > 0 && selectedIds.length === savedPushes.length;

  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(savedPushes.map(p => p.id));
    }
  };

  const handleConfirmDelete = () => {
    if (!deleteDialog) return;
    setDeleteLoading(true);
    const idsToRemove = new Set(deleteDialog.ids);
    saveToStorage(prev => prev.filter(p => !idsToRemove.has(p.id)));
    setSelectedIds(prev => prev.filter(id => !idsToRemove.has(id)));
    setRunStates(prev => {
      if (Object.keys(prev).length === 0) return prev;
      const next = { ...prev };
      idsToRemove.forEach(id => {
        delete next[id];
      });
      return next;
    });
    if (commandMapRef.current.size > 0) {
      for (const [commandId, meta] of Array.from(commandMapRef.current.entries())) {
        if (idsToRemove.has(meta.pushId)) {
          commandMapRef.current.delete(commandId);
        }
      }
    }
    setDeleteLoading(false);
    toast.success(
      deleteDialog.ids.length === 1
        ? 'Push eliminato'
        : `${deleteDialog.ids.length} push eliminati`
    );
    setDeleteDialog(null);
  };

  const extractEventName = (payload: any): string | undefined => {
    const source = Array.isArray(payload) ? payload[0] : payload;
    if (source && typeof source === 'object' && typeof source.event === 'string') {
      return source.event.trim() || undefined;
    }
    return undefined;
  };

  const shorten = (value: string, max = 80) =>
    value.length > max ? `${value.slice(0, max)}…` : value;

  const statusBadge = (pushId: string) => {
    const state = runStates[pushId];
    if (!state) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-400">
          Mai verificato
        </span>
      );
    }

    switch (state.status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-600">
            <Loader2 className="h-3 w-3 animate-spin" />
            Invio push…
            {state.expectedEventName && (
              <span className="font-mono text-[10px] text-blue-600">{state.expectedEventName}</span>
            )}
          </span>
        );
      case 'waiting':
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-600">
            <Loader2 className="h-3 w-3 animate-spin" />
            In attesa evento GA4…
            {state.expectedEventName && (
              <span className="font-mono text-[10px] text-amber-600">{state.expectedEventName}</span>
            )}
          </span>
        );
      case 'success':
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
            <CheckCircle2 className="h-3 w-3" />
            Evento GA4 confermato
            {state.expectedEventName && (
              <span className="font-mono text-[10px] text-emerald-600">{state.expectedEventName}</span>
            )}
            {state.httpStatus !== undefined && (
              <span className="font-mono text-[10px] text-emerald-600">HTTP {state.httpStatus}</span>
            )}
          </span>
        );
      case 'timeout':
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-600">
            <AlertTriangle className="h-3 w-3" />
            Nessun GA4 entro 15s
            {state.expectedEventName && (
              <span className="font-mono text-[10px] text-amber-600">{state.expectedEventName}</span>
            )}
          </span>
        );
      case 'nomatch':
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-600">
            <AlertTriangle className="h-3 w-3" />
            GA4 ricevuto ma non combacia
            {state.expectedEventName && (
              <span className="font-mono text-[10px] text-red-500">{state.expectedEventName}</span>
            )}
          </span>
        );
      case 'error':
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-600">
            <XCircle className="h-3 w-3" />
            Errore durante il push
            {state.reason && (
              <span className="font-mono text-[10px] text-red-500">({state.reason})</span>
            )}
          </span>
        );
    }
  };

  const upsertRunState = (
    pushId: string,
    updater: (prev: PushRunStatus | undefined) => PushRunStatus
  ) => {
    setRunStates(prev => ({
      ...prev,
      [pushId]: updater(prev[pushId]),
    }));
  };

  // Observe incoming events to reconcile push results.
  const initializedRef = useRef(false);
  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      lastEventIndexRef.current = events.length;
      return;
    }

    if (events.length === 0) {
      lastEventIndexRef.current = 0;
      return;
    }

    if (lastEventIndexRef.current > events.length) {
      lastEventIndexRef.current = 0;
    }

    const startIndex = lastEventIndexRef.current;
    if (startIndex >= events.length) {
      lastEventIndexRef.current = events.length;
      return;
    }

    const newEvents = events.slice(startIndex);
    lastEventIndexRef.current = events.length;

    for (const event of newEvents) {
      if (event.kind === 'push.result') {
        const meta = commandMapRef.current.get(event.id);
        if (!meta) continue;
        commandMapRef.current.delete(event.id);

        const currentState = runStates[meta.pushId];

        setRunStates(prev => {
          const current = prev[meta.pushId];
          if (!current || (current.status !== 'pending' && current.status !== 'waiting')) {
            return prev;
          }
          const base = {
            startedAt: current.startedAt,
            completedAt: event.ts ?? Date.now(),
            matchedUrl: event.matched?.[0]?.url,
            expectedEventName: current.expectedEventName,
          };

          const nextState: PushRunStatus = event.ok
            ? {
                status: 'success',
                ...base,
                httpStatus: event.matched?.[0]?.status,
              }
            : {
                status: (event.reason ?? 'error') as PushRunStatus['status'],
                ...base,
                reason: event.reason,
              };

          return { ...prev, [meta.pushId]: nextState };
        });

        const pushName = savedPushes.find((p) => p.id === meta.pushId)?.name ?? 'push';
        if (event.ok) {
          toast.success(
            currentState?.expectedEventName
              ? `Evento GA4 “${currentState.expectedEventName}” rilevato per “${pushName}”`
              : `Evento GA4 rilevato per “${pushName}”`
          );
        } else {
          const reasonLabel =
            event.reason === 'timeout'
              ? 'nessun evento GA4 entro 15s'
              : event.reason === 'nomatch'
              ? 'evento non corrispondente'
              : 'errore sconosciuto';
          toast.error(`Verifica fallita per “${pushName}”: ${reasonLabel}`);
        }
      }
    }
  }, [events, savedPushes, runStates]);

  const previewPushes = savedPushes.slice(0, 3);
  const extraCount = Math.max(savedPushes.length - previewPushes.length, 0);

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={e => handleImport(e.target.files)}
      />

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm ring-1 ring-black/5 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Libreria push
            </p>
            <h3 className="text-lg font-semibold text-slate-900">Push DataLayer salvati</h3>
            <p className="max-w-xs text-xs text-slate-400">
              Salva preset ricorrenti, importali da JSON e rilanciali con un click durante le sessioni live.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                openCreateForm();
                setIsModalOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Nuovo push
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
            >
              <Upload className="h-4 w-4" />
              Importa JSON
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
          {savedPushes.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-sm text-slate-500">
              <Layers className="h-6 w-6 text-slate-300" />
              <p>Nessun push salvato.</p>
              <p className="text-xs text-slate-400">
                Usa “Nuovo push” oppure importa un file JSON per iniziare.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200">
                <Layers className="h-3 w-3" />
                {savedPushes.length} preset disponibili
              </div>
              <ul className="space-y-2">
                {previewPushes.map(push => {
                  const eventName = extractEventName(push.payload);
                  return (
                    <li
                      key={push.id}
                      className="flex items-center justify-between rounded-2xl border border-transparent bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-slate-200 transition hover:border-blue-200 hover:shadow-md"
                    >
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-800">{push.name}</span>
                        <span className="text-xs text-slate-400">
                          evento: {eventName ?? '—'}
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          handleModalOpen();
                          setShowForm(false);
                          setEditingId(null);
                        }}
                        className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-500 transition hover:border-blue-300 hover:text-blue-600"
                      >
                        Apri
                      </button>
                    </li>
                  );
                })}
              </ul>
              {extraCount > 0 && (
                <button
                  onClick={handleModalOpen}
                  className="text-xs font-semibold text-blue-600 underline-offset-4 hover:underline"
                >
                  Vedi altri {extraCount} preset
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={handleModalOpen}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-blue-300 hover:text-blue-700"
          >
            <Layers className="h-4 w-4" />
            Gestisci libreria
          </button>
          <button
            onClick={handleRunAll}
            disabled={savedPushes.length === 0 || isRunningAll || !!runningId}
            className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700 transition hover:border-emerald-300 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
          >
            <Play className="h-4 w-4" />
            {isRunningAll ? 'Esecuzione...' : 'Esegui tutti'}
          </button>
        </div>
      </section>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
          <div className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Libreria push DataLayer</h2>
                <p className="text-xs text-slate-500">
                  Crea, importa, seleziona ed esegui i preset salvati per le sessioni live.
                </p>
              </div>
              <button
                onClick={handleModalClose}
                className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-1 flex-col overflow-hidden">
              <div className="flex flex-col gap-3 border-b border-slate-100 px-6 py-4 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={openCreateForm}
                    className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4" />
                    Nuovo push
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
                  >
                    <Upload className="h-4 w-4" />
                    Importa JSON
                  </button>
                  <button
                    onClick={handleRunAll}
                    disabled={savedPushes.length === 0 || isRunningAll || !!runningId}
                    className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700 transition hover:border-emerald-300 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    <Play className="h-4 w-4" />
                    {isRunningAll ? 'Esecuzione...' : 'Esegui tutti'}
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => {
                      setIsSelectionMode(prev => {
                        if (prev) setSelectedIds([]);
                        return !prev;
                      });
                    }}
                    className={clsx(
                      'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                      isSelectionMode
                        ? 'border-blue-300 bg-blue-50 text-blue-700'
                        : 'border-slate-200 bg-white text-slate-500 hover:border-blue-300 hover:text-blue-700'
                    )}
                  >
                    {isSelectionMode ? (
                      <CheckSquare className="h-3 w-3" />
                    ) : (
                      <Square className="h-3 w-3" />
                    )}
                    {isSelectionMode ? 'Modalità selezione attiva' : 'Seleziona push'}
                  </button>
                  <button
                    onClick={() => openDeleteDialog(savedPushes.map(p => p.id))}
                    disabled={savedPushes.length === 0}
                    className="inline-flex items-center gap-2 rounded-full border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:border-red-300 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-300"
                  >
                    <Trash2 className="h-3 w-3" />
                    Elimina tutti
                  </button>
                </div>
              </div>

              {isSelectionMode && (
                <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/60 px-6 py-3 text-xs text-slate-600">
                  <span className="font-semibold text-slate-500">
                    {selectedIds.length > 0
                      ? `${selectedIds.length} push selezionati`
                      : 'Nessun push selezionato'}
                  </span>
                  <button
                    onClick={handleSelectAll}
                    disabled={savedPushes.length === 0}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:border-slate-300 hover:text-slate-700 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-300"
                  >
                    {allSelected ? 'Deseleziona tutti' : 'Seleziona tutti'}
                  </button>
                  <button
                    onClick={() => openDeleteDialog(selectedIds)}
                    disabled={selectedIds.length === 0}
                    className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:border-red-300 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-300"
                  >
                    <Trash className="h-3 w-3" />
                    Elimina selezionati
                  </button>
                </div>
              )}

              <div className="flex-1 overflow-y-auto">
                <div className="flex flex-col gap-5 px-6 py-5">
                  {showForm && (
                    <div className="space-y-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5">
                      <h4 className="text-sm font-semibold text-slate-600">
                        {editingId ? 'Modifica push salvato' : 'Crea un nuovo push'}
                      </h4>

                      <div className="grid gap-4 md:grid-cols-[1fr_minmax(0,1fr)]">
                        <div className="space-y-3">
                          <div>
                            <label className="mb-1 block text-sm font-semibold text-slate-600">
                              Nome evento
                            </label>
                            <input
                              type="text"
                              value={formData.name}
                              onChange={e => setFormData({ ...formData, name: e.target.value })}
                              placeholder="es. navigation_click"
                              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-inner focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                            />
                          </div>

                          <div>
                            <label className="mb-1 block text-sm font-semibold text-slate-600">
                              Payload JSON
                            </label>
                            <textarea
                              value={formData.payload}
                              onChange={e => setFormData({ ...formData, payload: e.target.value })}
                              rows={10}
                              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-700 shadow-inner focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                              placeholder='{\n  "event": "navigation_click",\n  "event_category": "menu_secondo_livello"\n}'
                            />
                          </div>
                        </div>

                        <div className="flex flex-col justify-between gap-3 rounded-2xl bg-white/70 p-4 text-xs text-slate-500">
                          <p className="font-semibold text-slate-600">Suggerimenti rapidi</p>
                          <ul className="list-disc space-y-1 pl-4">
                            <li>Il campo <code>event</code> è obbligatorio.</li>
                            <li>Usa snake_case per categorie, azioni e label.</li>
                            <li>Aggiungi metadati extra (es. <code>navigation_type</code>).</li>
                          </ul>
                          <p>
                            Ricorda che i placeholder come <code>&lt;destination_path&gt;</code> vengono inviati
                            esattamente come testo: sostituiscili prima di eseguire il push.
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={handleSave}
                          className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                        >
                          <Save className="h-4 w-4" />
                          Salva
                        </button>
                        <button
                          onClick={resetForm}
                          className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
                        >
                          Annulla
                        </button>
                      </div>
                    </div>
                  )}

                  {savedPushes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-14 text-center text-sm text-slate-500">
                      <p>Nessun push salvato</p>
                      <p className="mt-1 text-xs text-slate-400">Clicca “Nuovo push” per iniziare</p>
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                      {savedPushes.map(push => {
                        const isSelected = selectedIds.includes(push.id);
                        const runState = runStates[push.id];
                        const expectedName = runState?.expectedEventName ?? extractEventName(push.payload);
                        const lastOutcome = runState?.completedAt ? formatTime(runState.completedAt) : null;
                        return (
                          <div
                            key={push.id}
                            className={clsx(
                              'relative flex h-full flex-col rounded-2xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md',
                              isSelected ? 'border-blue-400 ring-2 ring-blue-200/60' : 'border-slate-200'
                            )}
                          >
                            {isSelectionMode && (
                              <label className="absolute right-4 top-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-500">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleSelection(push.id)}
                                  className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                />
                                Seleziona
                              </label>
                            )}

                            <div className="flex flex-1 flex-col gap-3">
                              <div className="flex flex-wrap items-center gap-2 pr-8">
                                <span className="text-sm font-semibold text-slate-800">{push.name}</span>
                                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                                  dataLayer
                                </span>
                                {expectedName && (
                                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                                    {expectedName}
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                                {statusBadge(push.id)}
                                {lastOutcome && (
                                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                                    Ultimo check: {lastOutcome}
                                  </span>
                                )}
                              </div>
                              {runState?.matchedUrl && (
                                <div className="text-[10px] text-slate-400">
                                  GA URL:&nbsp;
                                  <span className="break-all font-mono text-slate-500">
                                    {shorten(runState.matchedUrl, 90)}
                                  </span>
                                </div>
                              )}
                              <div className="text-[11px] text-slate-400">
                                Creato: {formatTime(push.createdAt)}
                                {push.lastUsed && ` • Usato: ${formatTime(push.lastUsed)}`}
                              </div>
                              <pre className="max-h-56 overflow-auto rounded-xl bg-slate-50 p-3 text-[11px] text-slate-600">
                                {JSON.stringify(push.payload, null, 2)}
                              </pre>
                            </div>
                            <div className="mt-4 flex flex-wrap gap-2">
                              <button
                                onClick={() => executePush(push)}
                                disabled={
                                  runningId !== null ||
                                  isRunningAll ||
                                  (runState &&
                                    (runState.status === 'pending' || runState.status === 'waiting'))
                                }
                                className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:border-emerald-300 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                                title="Esegui Push"
                              >
                                <Play className="h-3 w-3" />
                                {runningId === push.id ? 'In esecuzione…' : 'Esegui'}
                              </button>
                              <button
                                onClick={() => handleEdit(push)}
                                className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
                                title="Modifica"
                              >
                                <Edit className="h-3 w-3" />
                                Modifica
                              </button>
                              <button
                                onClick={() => openDeleteDialog([push.id])}
                                disabled={runningId === push.id || isRunningAll}
                                className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:border-red-300 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                                title="Elimina"
                              >
                                <Trash2 className="h-3 w-3" />
                                Elimina
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteDialog)}
        title={deleteDialog?.title ?? ''}
        description={deleteDialog?.description}
        confirmText={
          deleteDialog && deleteDialog.ids.length > 1
            ? `Elimina (${deleteDialog.ids.length})`
            : 'Elimina'
        }
        tone="danger"
        loading={deleteLoading}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          if (!deleteLoading) setDeleteDialog(null);
        }}
      />
    </>
  );
}
