import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import type { PushUseCase, ExpectedCall } from '../../../shared/types';
import type { PushUseCaseDraft } from '../../services/live-debugger-api';

interface UseCaseEditorProps {
  open: boolean;
  mode: 'create' | 'edit';
  initial?: PushUseCase;
  onClose: () => void;
  onSubmit: (payload: PushUseCaseDraft) => Promise<void> | void;
}

type ParamRow = { key: string; value: string; id: string };

const emptyPayload = '{\n  "event": "<event_name>"\n}';
const emptyGtagParams = '{\n  "custom_parameter": "value"\n}';

export function UseCaseEditor({ open, mode, initial, onClose, onSubmit }: UseCaseEditorProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [pushMode, setPushMode] = useState<'datalayer' | 'gtag'>(initial?.mode ?? 'datalayer');
  const [payload, setPayload] = useState(
    initial?.mode === 'datalayer'
      ? JSON.stringify(initial.payload ?? {}, null, 2)
      : emptyPayload
  );
  const [gtagName, setGtagName] = useState(initial?.gtagName ?? '');
  const [gtagParams, setGtagParams] = useState(
    initial?.gtagParams ? JSON.stringify(initial.gtagParams, null, 2) : emptyGtagParams
  );
  const [urlPattern, setUrlPattern] = useState(initial?.expected?.urlPattern ?? '');
  const [params, setParams] = useState<ParamRow[]>(() => {
    const entries = initial?.expected?.mustContainParams
      ? Object.entries(initial.expected.mustContainParams)
      : [];
    if (entries.length === 0) return [];
    return entries.map(([key, value]) => ({ key, value, id: crypto.randomUUID() }));
  });
  const [timeoutMs, setTimeoutMs] = useState(initial?.timeoutMs ?? 5000);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? '');
    setPushMode(initial?.mode ?? 'datalayer');
    setPayload(
      initial?.mode === 'datalayer'
        ? JSON.stringify(initial.payload ?? {}, null, 2)
        : emptyPayload
    );
    setGtagName(initial?.gtagName ?? '');
    setGtagParams(
      initial?.gtagParams ? JSON.stringify(initial.gtagParams, null, 2) : emptyGtagParams
    );
    setUrlPattern(initial?.expected?.urlPattern ?? '');
    setParams(() => {
      const entries = initial?.expected?.mustContainParams
        ? Object.entries(initial.expected.mustContainParams)
        : [];
      return entries.map(([key, value]) => ({ key, value, id: crypto.randomUUID() }));
    });
    setTimeoutMs(initial?.timeoutMs ?? 5000);
    setError(null);
    setSaving(false);
  }, [open, initial]);

  const handleAddParam = () => {
    setParams(prev => [...prev, { key: '', value: '', id: crypto.randomUUID() }]);
  };

  const handleParamChange = (id: string, key: 'key' | 'value', value: string) => {
    setParams(prev => prev.map(row => (row.id === id ? { ...row, [key]: value } : row)));
  };

  const handleRemoveParam = (id: string) => {
    setParams(prev => prev.filter(row => row.id !== id));
  };

  const draftExpected = (): ExpectedCall | undefined => {
    const filtered = params.filter(row => row.key.trim() && row.value.trim());
    const trimmedPattern = urlPattern.trim();

    if (!trimmedPattern && filtered.length === 0) {
      return undefined;
    }

    const effectivePattern = trimmedPattern || 'https://.*google-analytics\\.com/(debug/)?g/collect';

    return {
      urlPattern: effectivePattern,
      mustContainParams: filtered.length
        ? filtered.reduce<Record<string, string>>((acc, row) => {
            acc[row.key.trim()] = row.value.trim();
            return acc;
          }, {})
        : undefined,
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Il nome è obbligatorio.');
      return;
    }
    let parsedPayload: any = undefined;
    let parsedParams: Record<string, any> | undefined = undefined;

    try {
      if (pushMode === 'datalayer') {
        parsedPayload = payload.trim() ? JSON.parse(payload) : undefined;
        if (typeof parsedPayload === 'undefined') {
          throw new Error('Payload mancante per DataLayer.');
        }
      } else {
        parsedParams = gtagParams.trim() ? JSON.parse(gtagParams) : undefined;
      }
    } catch (err: any) {
      setError(`JSON non valido: ${err.message}`);
      return;
    }

    if (pushMode === 'gtag' && !gtagName.trim()) {
      setError('Il nome evento gtag è obbligatorio.');
      return;
    }

    const expected = draftExpected();

    const draft: PushUseCaseDraft = {
      name: name.trim(),
      origin: window.location.origin,
      mode: pushMode,
      payload: pushMode === 'datalayer' ? parsedPayload : undefined,
      gtagName: pushMode === 'gtag' ? gtagName.trim() : undefined,
      gtagParams: pushMode === 'gtag' ? parsedParams : undefined,
      timeoutMs,
    };

    if (expected) {
      draft.expected = expected;
    }

    try {
      setSaving(true);
      await onSubmit(draft);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Errore durante il salvataggio');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur">
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {mode === 'create' ? 'Nuovo use case' : 'Modifica use case'}
            </h2>
            <p className="text-xs text-slate-500">Configura il push e la chiamata attesa.</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto">
          <div className="space-y-5 px-6 py-4">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm text-slate-600">
                Nome
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  placeholder="navigation_click"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-slate-600">
                Timeout (ms)
                <input
                  type="number"
                  min={100}
                  value={timeoutMs}
                  onChange={(e) => setTimeoutMs(Number(e.target.value))}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-3 text-sm text-slate-600">
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="mode"
                  value="datalayer"
                  checked={pushMode === 'datalayer'}
                  onChange={() => setPushMode('datalayer')}
                  className="h-4 w-4 text-blue-600"
                />
                DataLayer push
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="mode"
                  value="gtag"
                  checked={pushMode === 'gtag'}
                  onChange={() => setPushMode('gtag')}
                  className="h-4 w-4 text-blue-600"
                />
                gtag('event')
              </label>
            </div>

            {pushMode === 'datalayer' ? (
              <label className="flex flex-col gap-1 text-sm text-slate-600">
                Payload JSON
                <textarea
                  value={payload}
                  onChange={(e) => setPayload(e.target.value)}
                  rows={8}
                  className="rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </label>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm text-slate-600">
                  Nome evento
                  <input
                    type="text"
                    value={gtagName}
                    onChange={(e) => setGtagName(e.target.value)}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    placeholder="event_name"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm text-slate-600 md:col-span-2">
                  Parametri JSON
                  <textarea
                    value={gtagParams}
                    onChange={(e) => setGtagParams(e.target.value)}
                    rows={6}
                    className="rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </label>
              </div>
            )}

            <div className="space-y-3">
              <label className="flex flex-col gap-1 text-sm text-slate-600">
                URL pattern atteso (regex)
                <span className="text-[11px] text-slate-400">
                  Lascia vuoto per usare il pattern GA predefinito.
                </span>
                <input
                  type="text"
                  value={urlPattern}
                  onChange={(e) => setUrlPattern(e.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  placeholder="https://example\\.com/collect"
                />
              </label>
              <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Parametri obbligatori (query/body)
                  </span>
                  <button
                    type="button"
                    onClick={handleAddParam}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 transition hover:border-slate-400 hover:text-slate-800"
                  >
                    <Plus className="h-3 w-3" />
                    Aggiungi
                  </button>
                </div>
                {params.length === 0 ? (
                  <p className="text-xs text-slate-500">Nessun parametro obbligatorio.</p>
                ) : (
                  <div className="space-y-2">
                    {params.map((row) => (
                      <div key={row.id} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={row.key}
                          onChange={(e) => handleParamChange(row.id, 'key', e.target.value)}
                          placeholder="param"
                          className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                        />
                        <input
                          type="text"
                          value={row.value}
                          onChange={(e) => handleParamChange(row.id, 'value', e.target.value)}
                          placeholder="value"
                          className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveParam(row.id)}
                          className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-400 hover:text-slate-800"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              {saving ? 'Salvataggio...' : 'Salva'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
