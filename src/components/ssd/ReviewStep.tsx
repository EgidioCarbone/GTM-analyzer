import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  ClipboardList,
  Edit3,
  FileCode2,
  Layers,
  ListTree,
  RefreshCw,
  RotateCcw,
  Save,
  Sparkles,
  Target,
  Undo2,
  XCircle
} from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { ReviewStepProps } from '../../types/ssd';
import { detectAmbiguities } from '../../services/ssdValidation';
import { useDisambiguation } from '../../hooks/useDisambiguation';

export default function ReviewStep({
  state,
  editableDsl,
  isEditingDsl,
  dslValidationError,
  ambiguityMinConfidence,
  onDslEdit,
  onSaveDsl,
  onResetDsl,
  onReset
}: ReviewStepProps) {
  if (!state.dsl) return null;

  const {
    disambiguatedDsl,
    stats,
    addChoice,
    undoLastChoice,
    resetAllChoices,
    hasChoices,
    canUndo
  } = useDisambiguation(state.dsl);

  const dslToAnalyze = disambiguatedDsl || state.dsl;
  const ambiguities = detectAmbiguities(dslToAnalyze, ambiguityMinConfidence);

  const [selectedAmbiguity, setSelectedAmbiguity] = useState<string | null>(null);

  const handleDisambiguationChoice = (stepPath: string, choice: any, reason: string) => {
    const pathParts = stepPath.split('.');
    let current: any = state.dsl;

    for (const part of pathParts) {
      if (part.includes('[') && part.includes(']')) {
        const [key, indexStr] = part.split('[');
        const index = parseInt(indexStr.replace(']', ''), 10);
        current = current[key][index];
      } else {
        current = current[part];
      }
    }

    addChoice(stepPath, current, choice, reason);
    setSelectedAmbiguity(null);
  };

  const totalTests = state.dsl?.tests?.length || 0;
  const totalSteps = state.dsl?.tests?.reduce((sum, test) => sum + test.steps.length, 0) || 0;

  return (
    <div className="space-y-10">
      <div className="relative overflow-hidden rounded-3xl border border-white/50 bg-white/70 p-10 shadow-xl backdrop-blur-lg">
        <div className="pointer-events-none absolute -top-28 -left-24 h-72 w-72 rounded-full bg-gradient-to-br from-purple-400/40 via-indigo-400/30 to-pink-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-36 -right-6 h-72 w-72 rounded-full bg-gradient-to-br from-pink-300/40 via-indigo-300/30 to-blue-400/30 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:justify-between">
          <div className="max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-purple-200/70 bg-purple-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-purple-600 shadow-sm">
              <Sparkles className="h-3.5 w-3.5" />
              Step 3 · Review &amp; Refine
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-gray-900">
              Rifinisci la specifica prima dell’esecuzione.
            </h1>
            <p className="text-lg leading-relaxed text-gray-600">
              Valida la DSL generata, risolvi eventuali ambiguità e assicurati che ogni step sia pronto
              per il runner.
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex items-center gap-3 rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-sm text-gray-700 shadow-sm">
                <Layers className="h-4 w-4 text-purple-500" />
                {totalTests} test rilevati
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-sm text-gray-700 shadow-sm">
                <ListTree className="h-4 w-4 text-indigo-500" />
                {totalSteps} step totali
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-sm text-gray-700 shadow-sm">
                <ClipboardList className="h-4 w-4 text-pink-500" />
                {ambiguities.length} ambiguità
              </div>
            </div>
          </div>

          <div className="w-full max-w-sm space-y-4 rounded-3xl border border-white/70 bg-white/80 p-6 text-sm text-gray-700 shadow-lg backdrop-blur">
            <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-gray-500">
              Stato disambiguazione
            </h2>
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/70 px-4 py-3 text-sm text-indigo-700">
                <CheckCircle className="h-4 w-4" />
                {hasChoices
                  ? `Hai applicato ${stats.totalChoices} correzione${stats.totalChoices === 1 ? '' : 'i'}`
                  : 'Nessuna modifica manuale effettuata'}
              </div>
              <div className="rounded-2xl border border-purple-100 bg-purple-50/70 px-4 py-3 text-sm text-purple-700">
                Ultima modifica: {stats.lastModified || '—'}
              </div>
              <p className="text-xs text-gray-500">
                Le scelte vengono salvate per questa sessione. Resettando partirai da zero con la DSL
                originale.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
        <Card className="relative overflow-hidden rounded-3xl border border-white/70 bg-white/80 p-8 shadow-xl backdrop-blur">
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-purple-500">
                  Anteprima DSL
                </p>
                <h3 className="text-2xl font-semibold text-gray-900">Specifica eseguita dal runner</h3>
              </div>
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-3 py-1 text-xs font-semibold text-emerald-600 shadow-sm">
                  <div className="h-2 w-2 rounded-full bg-emerald-500" />
                  Generata dal PDF
                </span>
                {!isEditingDsl ? (
                  <Button
                    onClick={() => {
                      /* setIsEditingDsl(true) */
                    }}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2 rounded-full border border-purple-200 text-purple-600 hover:bg-purple-50"
                  >
                    <Edit3 className="h-4 w-4" />
                    Modalità avanzata
                  </Button>
                ) : (
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={onSaveDsl}
                      disabled={!!dslValidationError}
                      size="sm"
                      className="flex items-center gap-2 rounded-full bg-purple-500 text-white hover:bg-purple-600"
                    >
                      <Save className="h-4 w-4" />
                      Salva
                    </Button>
                    <Button
                      onClick={onResetDsl}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2 rounded-full border border-gray-300 text-gray-600 hover:bg-gray-50"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Ripristina
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {dslValidationError && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 shadow-sm">
                <div className="flex items-start gap-3">
                  <XCircle className="mt-0.5 h-5 w-5 text-rose-500" />
                  <div>
                    <p className="font-semibold">JSON non valido</p>
                    <p>{dslValidationError}</p>
                  </div>
                </div>
              </div>
            )}

            {hasChoices && (
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-800 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5" />
                    <div>
                      <p className="font-semibold">Disambiguazione applicata</p>
                      <p className="text-xs text-blue-700">Totale scelte: {stats.totalChoices}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={undoLastChoice}
                      disabled={!canUndo}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2 rounded-full border border-blue-200 text-blue-600 hover:bg-blue-50"
                    >
                      <Undo2 className="h-4 w-4" />
                      Annulla ultima
                    </Button>
                    <Button
                      onClick={resetAllChoices}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2 rounded-full border border-rose-200 text-rose-600 hover:bg-rose-50"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Resetta tutto
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {ambiguities.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 shadow-sm">
                  <AlertTriangle className="h-4 w-4" />
                  {ambiguities.length} ambiguità rilevate. Risolvidle prima di procedere.
                </div>
                <div className="space-y-4">
                  {ambiguities.map((ambiguity, index) => (
                    <div
                      key={index}
                      className="rounded-2xl border border-amber-100 bg-white/80 p-4 text-sm text-amber-700 shadow-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xs font-semibold text-amber-800">
                            {ambiguity.stepPath}
                          </span>
                          <span>{ambiguity.reason}</span>
                        </div>
                        {ambiguity.candidates && ambiguity.candidates.length > 0 && (
                          <Button
                            onClick={() =>
                              setSelectedAmbiguity(
                                selectedAmbiguity === ambiguity.stepPath ? null : ambiguity.stepPath
                              )
                            }
                            variant="outline"
                            size="sm"
                            className="flex items-center gap-2 rounded-full border border-amber-200 text-amber-700 hover:bg-amber-50"
                          >
                            <Target className="h-4 w-4" />
                            Disambiguazione
                          </Button>
                        )}
                      </div>

                      {selectedAmbiguity === ambiguity.stepPath && ambiguity.candidates && (
                        <div className="mt-3 space-y-2 rounded-2xl border border-amber-100 bg-amber-50/60 p-3">
                          <h5 className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">
                            Seleziona il target corretto
                          </h5>
                          {ambiguity.candidates.map((candidate, candidateIndex) => (
                            <Button
                              key={candidateIndex}
                              onClick={() =>
                                handleDisambiguationChoice(
                                  ambiguity.stepPath,
                                  candidate,
                                  `Chose candidate ${candidateIndex + 1}`
                                )
                              }
                              variant="outline"
                              size="sm"
                              className="w-full justify-start rounded-2xl border border-white/70 bg-white text-left font-mono text-xs text-gray-700 hover:border-amber-200 hover:bg-amber-50"
                            >
                              <pre>{JSON.stringify(candidate, null, 2)}</pre>
                            </Button>
                          ))}
                          <p className="text-xs text-amber-600">
                            Confidence threshold: {ambiguityMinConfidence}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isEditingDsl ? (
              <div className="space-y-4">
                <textarea
                  value={editableDsl}
                  onChange={(e) => onDslEdit(e.target.value)}
                  className="h-96 w-full resize-none rounded-2xl border border-gray-300 bg-black/90 p-4 font-mono text-sm text-emerald-200 focus:border-purple-500 focus:ring-4 focus:ring-purple-300/40"
                  placeholder="Modifica qui la tua DSL..."
                />
                <p className="text-xs text-gray-500">
                  Eventuali errori di sintassi verranno evidenziati nella sezione di validazione.
                </p>
              </div>
            ) : (
              <div className="max-h-[26rem] overflow-auto rounded-2xl border border-gray-900/80 bg-gray-900/95 p-6 shadow-inner">
                <pre className="text-sm leading-relaxed text-emerald-200">
                  {JSON.stringify(disambiguatedDsl || state.dsl, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="rounded-3xl border border-white/70 bg-white/80 p-6 text-sm text-gray-700 shadow-xl backdrop-blur">
            <div className="flex items-center gap-3 text-purple-500">
              <FileCode2 className="h-4 w-4" />
              Metadati generazione
            </div>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between rounded-2xl border border-white/70 bg-white/70 px-4 py-3 shadow-sm">
                <span className="text-gray-500">Modello</span>
                <span className="font-semibold text-gray-800">
                  {state.dsl?.meta?.model || 'sconosciuto'}
                </span>
              </div>
              <div className="rounded-2xl border border-white/70 bg-white/70 px-4 py-3 shadow-sm">
                <p className="text-gray-500">Token utilizzati</p>
                <p className="font-semibold text-gray-800">
                  Input {state.dsl?.meta?.tokens?.input || 0} · Output{' '}
                  {state.dsl?.meta?.tokens?.output || 0}
                </p>
              </div>
              <p className="text-xs text-gray-500">
                I token influenzano la fedeltà della conversione dal PDF. Valori molto alti possono
                indicare documenti complessi o rumorosi.
              </p>
            </div>
          </Card>

          <Card className="rounded-3xl border border-white/70 bg-white/80 p-6 text-sm text-gray-700 shadow-xl backdrop-blur">
            <div className="flex items-center gap-3 text-indigo-500">
              <ClipboardList className="h-4 w-4" />
              Promemoria rapido
            </div>
            <ul className="mt-4 space-y-3">
              <li className="flex items-start gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-indigo-400" />
                <span>Verifica che i selettori coprano elementi univoci sul sito reale.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-indigo-400" />
                <span>Risolvi ambiguità su CTA o menu dinamici prima di lanciare il runner.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-indigo-400" />
                <span>Annota eventuali eccezioni da condividere con il team di analytics.</span>
              </li>
            </ul>
          </Card>
        </div>
      </div>

      <div className="sticky bottom-8 flex flex-col gap-4 rounded-3xl border border-white/60 bg-white/75 px-6 py-5 shadow-2xl backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600">
          <span>
            {ambiguities.length > 0
              ? `Ci sono ${ambiguities.length} ambiguità ancora aperte.`
              : 'La specifica è pronta per essere eseguita.'}
          </span>
          <span className="text-xs uppercase tracking-[0.3em] text-gray-400">Step finale prima del run</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            onClick={onReset}
            variant="outline"
            className="inline-flex items-center gap-2 rounded-full border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-600 hover:border-gray-400 hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4" />
            Ricomincia
          </Button>
          <Button
            onClick={() => {
              window.location.reload();
            }}
            className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-500 via-indigo-500 to-pink-500 px-8 py-3 text-base font-semibold text-white shadow-lg transition-all duration-200 hover:shadow-2xl focus:ring-4 focus:ring-purple-300/40"
          >
            Vai ai risultati
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
