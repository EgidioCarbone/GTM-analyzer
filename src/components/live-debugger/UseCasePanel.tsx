import React from 'react';
import { Play, Edit, Copy as CopyIcon, Trash2, Clock3, Plus } from 'lucide-react';
import type { PushUseCase, RunResultSummary } from '../../../shared/types';

interface UseCasePanelProps {
  useCases: PushUseCase[];
  loading?: boolean;
  runningId: string | null;
  deletingId?: string | null;
  onCreate: () => void;
  onRun: (useCase: PushUseCase) => void;
  onEdit: (useCase: PushUseCase) => void;
  onDuplicate: (useCase: PushUseCase) => void;
  onDelete: (useCase: PushUseCase) => void;
}

function formatRelative(ts?: number) {
  if (!ts) return '—';
  const date = new Date(ts);
  return date.toLocaleString('it-IT');
}

function ResultBadge({ result }: { result?: RunResultSummary }) {
  if (!result) {
    return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">—</span>;
  }

  if (result.ok) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
        PASS
        {result.status !== undefined && <span className="font-mono text-[11px]">HTTP {result.status}</span>}
      </span>
    );
  }

  const label = result.reason?.toUpperCase() ?? 'FAIL';
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600">
      FAIL
      <span className="text-[11px] uppercase tracking-[0.14em]">{label}</span>
    </span>
  );
}

export function UseCasePanel({
  useCases,
  loading,
  runningId,
  deletingId = null,
  onCreate,
  onRun,
  onEdit,
  onDuplicate,
  onDelete,
}: UseCasePanelProps) {
  const disabled = Boolean(runningId);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm ring-1 ring-black/5 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Use Case DL</p>
          <h3 className="text-lg font-semibold text-slate-900">Salva &amp; verifica push</h3>
          <p className="text-xs text-slate-400">
            Esegui un use case e controlla che arrivi la chiamata attesa.
          </p>
        </div>
          <button
            onClick={onCreate}
            className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Nuovo use case
          </button>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-10 text-center text-sm text-slate-500">
          Caricamento use case...
        </div>
      ) : useCases.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-10 text-center text-sm text-slate-500">
          <p>Nessun use case salvato</p>
          <p className="mt-1 text-xs text-slate-400">Crea il primo use case per automatizzare il push.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {useCases.map((uc) => (
            <article
              key={uc.id}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-semibold text-slate-900">{uc.name}</h4>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                      {uc.mode === 'datalayer' ? 'DataLayer' : 'gtag'}
                    </span>
                    {uc.timeoutMs && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                        <Clock3 className="h-3 w-3" />
                        {uc.timeoutMs}ms
                      </span>
                    )}
                    <ResultBadge result={uc.lastResult} />
                  </div>
                  <div className="text-xs text-slate-500">
                    <span className="font-semibold text-slate-600">URL pattern:</span>{' '}
                    <span className="font-mono text-[11px] break-all">{uc.expected.urlPattern}</span>
                  </div>
                  {uc.expected.mustContainParams && Object.keys(uc.expected.mustContainParams).length > 0 && (
                    <div className="text-xs text-slate-500">
                      <span className="font-semibold text-slate-600">Parametri attesi:</span>{' '}
                      {Object.entries(uc.expected.mustContainParams)
                        .map(([k, v]) => `${k}=${v}`)
                        .join(', ')}
                    </div>
                  )}
                  {uc.lastResult && (
                    <div className="text-[11px] text-slate-400">
                      Ultimo esito: {formatRelative(uc.lastResult.ts)}
                      {uc.lastResult.matchedUrl && (
                        <>
                          {' '}
                          •{' '}
                          <span className="break-all font-mono text-slate-500">
                            {uc.lastResult.matchedUrl.length > 120
                              ? `${uc.lastResult.matchedUrl.slice(0, 120)}…`
                              : uc.lastResult.matchedUrl}
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <button
                    onClick={() => onRun(uc)}
                    disabled={disabled}
                    className="inline-flex min-w-[110px] items-center justify-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 transition hover:border-emerald-300 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    <Play className="h-3 w-3" />
                    {runningId === uc.id ? 'Running…' : 'Run'}
                  </button>
                  <button
                    onClick={() => onEdit(uc)}
                    className="inline-flex min-w-[110px] items-center justify-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
                  >
                    <Edit className="h-3 w-3" />
                    Modifica
                  </button>
                  <button
                    onClick={() => onDuplicate(uc)}
                    className="inline-flex min-w-[110px] items-center justify-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
                  >
                    <CopyIcon className="h-3 w-3" />
                    Duplica
                  </button>
                  <button
                    onClick={() => onDelete(uc)}
                    disabled={runningId === uc.id || deletingId === uc.id}
                    className="inline-flex min-w-[110px] items-center justify-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-600 transition hover:border-red-300 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    <Trash2 className="h-3 w-3" />
                    Elimina
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
