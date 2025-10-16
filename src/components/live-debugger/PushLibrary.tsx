import React, { useState, useEffect, useRef } from 'react';
import { Play, Edit, Trash2, Plus, Save, Upload } from 'lucide-react';
import * as api from '../../services/live-debugger-api';

interface SavedPush {
  id: string;
  name: string;
  payload: any;
  createdAt: number;
  lastUsed?: number;
}

interface PushLibraryProps {
  onEvent: (event: any) => void;
}

export function PushLibrary({ onEvent }: PushLibraryProps) {
  const [savedPushes, setSavedPushes] = useState<SavedPush[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    payload:
      '{\n  "event": "navigation_click",\n  "event_category": "menu_secondo_livello",\n  "event_action": "path_destinazione",\n  "event_label": "button_name",\n  "navigation_type": "desktop"\n}',
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [isRunningAll, setIsRunningAll] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleSave = () => {
    if (!formData.name.trim() || !formData.payload.trim()) {
      alert('Nome e payload sono obbligatori');
      return;
    }

    try {
      const payload = JSON.parse(formData.payload);
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

      setShowForm(false);
      setFormData({ name: '', payload: '{\n  "event": "navigation_click"\n}' });
      setEditingId(null);
    } catch (err) {
      alert('Payload JSON non valido');
    }
  };

  const executePush = async (push: SavedPush) => {
    setRunningId(push.id);
    try {
      const result = await api.pushLiveDebugger({
        mode: 'datalayer',
        payload: push.payload,
        trackCollect: true,
        match: 'auto',
        timeoutMs: 5000,
      });

      saveToStorage(prev =>
        prev.map(p => (p.id === push.id ? { ...p, lastUsed: Date.now() } : p))
      );

      console.log('Push executed with ID:', result.id);
    } catch (err: any) {
      alert(`Errore nell'esecuzione: ${err.message}`);
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

  const handleDelete = (push: SavedPush) => {
    if (!confirm(`Eliminare "${push.name}"?`)) return;
    saveToStorage(prev => prev.filter(p => p.id !== push.id));
  };

  const formatTime = (ts: number) => new Date(ts).toLocaleString('it-IT');

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
      alert(`Importati ${normalized.length} push.`);
    } catch (err: any) {
      console.error(err);
      alert(
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

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm ring-1 ring-black/5 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Libreria push
          </p>
          <h3 className="text-lg font-semibold text-slate-900">Push DataLayer salvati</h3>
          <p className="text-xs text-slate-400">
            Salva preset ricorrenti, importali da JSON e rilanciali con un click.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setShowForm(true);
              setEditingId(null);
              setFormData({ name: '', payload: '{\n  "event": "navigation_click"\n}' });
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
          <button
            onClick={handleRunAll}
            disabled={savedPushes.length === 0 || isRunningAll || !!runningId}
            className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700 transition hover:border-emerald-300 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
          >
            <Play className="h-4 w-4" />
            {isRunningAll ? 'Esecuzione...' : 'Esegui tutti'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={e => handleImport(e.target.files)}
          />
        </div>
      </div>

      {showForm && (
        <div className="space-y-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
          <h4 className="text-sm font-semibold text-slate-600">
            {editingId ? 'Modifica push salvato' : 'Crea un nuovo push'}
          </h4>

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-600">Nome evento</label>
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
                rows={8}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-700 shadow-inner focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                placeholder='{\n  "event": "navigation_click",\n  "event_category": "menu_secondo_livello"\n}'
              />
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
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                  setFormData({ name: '', payload: '{\n  "event": "navigation_click"\n}' });
                }}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-h-80 space-y-3 overflow-y-auto">
        {savedPushes.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-10 text-center text-sm text-slate-500">
            <p>Nessun push salvato</p>
            <p className="mt-1 text-xs text-slate-400">Clicca “Nuovo push” per iniziare</p>
          </div>
        ) : (
          savedPushes.map(push => (
            <div
              key={push.id}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-800">{push.name}</span>
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                      dataLayer
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Creato: {formatTime(push.createdAt)}
                    {push.lastUsed && ` • Usato: ${formatTime(push.lastUsed)}`}
                  </div>
                  <pre className="max-h-32 overflow-auto rounded-xl bg-slate-50 p-3 text-[11px] text-slate-600">
                    {JSON.stringify(push.payload, null, 2)}
                  </pre>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => executePush(push)}
                    disabled={runningId !== null || isRunningAll}
                    className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 transition hover:border-emerald-300 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                    title="Esegui Push"
                  >
                    <Play className="h-3 w-3" />
                    {runningId === push.id ? 'In esecuzione…' : 'Esegui'}
                  </button>
                  <button
                    onClick={() => handleEdit(push)}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
                    title="Modifica"
                  >
                    <Edit className="h-3 w-3" />
                    Modifica
                  </button>
                  <button
                    onClick={() => handleDelete(push)}
                    disabled={runningId === push.id || isRunningAll}
                    className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-600 transition hover:border-red-300 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                    title="Elimina"
                  >
                    <Trash2 className="h-3 w-3" />
                    Elimina
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
