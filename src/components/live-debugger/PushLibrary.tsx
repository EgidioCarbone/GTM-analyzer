import React, { useState, useEffect } from 'react';
import { Play, Edit, Trash2, Plus, Save } from 'lucide-react';
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
    payload: '{\n  "event": "navigation_click",\n  "event_category": "menu_secondo_livello",\n  "event_action": "path_destinazione",\n  "event_label": "button_name",\n  "navigation_type": "desktop"\n}'
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  // Load from localStorage
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

  // Save to localStorage
  const saveToStorage = (pushes: SavedPush[]) => {
    localStorage.setItem('live-debugger-saved-pushes', JSON.stringify(pushes));
    setSavedPushes(pushes);
  };

  const handleSave = () => {
    if (!formData.name.trim() || !formData.payload.trim()) {
      alert('Nome e payload sono obbligatori');
      return;
    }

    try {
      const payload = JSON.parse(formData.payload);
      const newPush: SavedPush = {
        id: editingId || crypto.randomUUID(),
        name: formData.name.trim(),
        payload,
        createdAt: editingId ? savedPushes.find(p => p.id === editingId)?.createdAt || Date.now() : Date.now(),
        lastUsed: Date.now()
      };

      let updatedPushes;
      if (editingId) {
        updatedPushes = savedPushes.map(p => p.id === editingId ? newPush : p);
      } else {
        updatedPushes = [...savedPushes, newPush];
      }

      saveToStorage(updatedPushes);
      setShowForm(false);
      setFormData({ name: '', payload: '{\n  "event": "navigation_click"\n}' });
      setEditingId(null);
    } catch (err) {
      alert('Payload JSON non valido');
    }
  };

  const handleRun = async (push: SavedPush) => {
    try {
      const result = await api.pushLiveDebugger({
        mode: 'datalayer',
        payload: push.payload,
        trackCollect: true,
        match: 'auto',
        timeoutMs: 5000
      });

      // Update last used
      const updatedPushes = savedPushes.map(p => 
        p.id === push.id ? { ...p, lastUsed: Date.now() } : p
      );
      saveToStorage(updatedPushes);

      console.log('Push executed with ID:', result.id);
    } catch (err: any) {
      alert(`Errore nell'esecuzione: ${err.message}`);
    }
  };

  const handleEdit = (push: SavedPush) => {
    setFormData({
      name: push.name,
      payload: JSON.stringify(push.payload, null, 2)
    });
    setEditingId(push.id);
    setShowForm(true);
  };

  const handleDelete = (push: SavedPush) => {
    if (!confirm(`Eliminare "${push.name}"?`)) return;
    
    const updatedPushes = savedPushes.filter(p => p.id !== push.id);
    saveToStorage(updatedPushes);
  };

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleString('it-IT');
  };

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm ring-1 ring-black/5 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Libreria push
          </p>
          <h3 className="text-lg font-semibold text-slate-900">Push DataLayer salvati</h3>
          <p className="text-xs text-slate-400">Salva preset ricorrenti e rilanciali con un click.</p>
        </div>
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
      </div>

      {showForm && (
        <div className="space-y-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
          <h4 className="text-sm font-semibold text-slate-600">
            {editingId ? 'Modifica push salvato' : 'Crea un nuovo push'}
          </h4>

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-600">
                Nome evento
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
                onChange={(e) => setFormData({ ...formData, payload: e.target.value })}
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
          savedPushes.map((push) => (
            <div
              key={push.id}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
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
                    onClick={() => handleRun(push)}
                    className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 transition hover:border-emerald-300"
                    title="Esegui Push"
                  >
                    <Play className="h-3 w-3" />
                    Esegui
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
                    className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-600 transition hover:border-red-300"
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
