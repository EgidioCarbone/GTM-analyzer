import React from 'react';
import {
  Upload,
  FileText,
  RefreshCw,
  Loader2,
  XCircle,
  Sparkles,
  Globe2,
  ShieldCheck,
  Info,
  CheckCircle2
} from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { UploadStepProps } from '../../types/ssd';

export default function UploadStep({
  state,
  ssdConfig,
  configLoading,
  configError,
  moduleUrls = [],
  onFileUpload,
  onUrlChange,
  onIngest
}: UploadStepProps) {
  const hasPresets = moduleUrls.length > 0;
  const selectValue = hasPresets && moduleUrls.includes(state.url) ? state.url : '__custom__';
  const isCustom = !hasPresets || selectValue === '__custom__';
  return (
    <div className="space-y-10">
      <div className="relative overflow-hidden rounded-3xl border border-white/50 bg-white/70 p-10 shadow-xl backdrop-blur-lg">
        <div className="pointer-events-none absolute -top-28 -left-24 h-72 w-72 rounded-full bg-gradient-to-br from-blue-400/40 via-purple-400/30 to-pink-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-36 -right-6 h-72 w-72 rounded-full bg-gradient-to-br from-indigo-300/40 via-fuchsia-300/40 to-blue-400/30 blur-3xl" />
        <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200/70 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-blue-600 shadow-sm">
              <Sparkles className="h-3.5 w-3.5" />
              Step 2 · Upload &amp; Process
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-gray-900">
              Carica il PDF, imposta l’URL e lascia che il motore costruisca il test.
            </h1>
            <p className="text-lg leading-relaxed text-gray-600">
              In questa fase analizziamo il documento SDD, normalizziamo la struttura del funnel e agganciamo l’HTML della pagina di destinazione. L’obiettivo è consegnare al runner una specifica perfettamente coerente.
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex items-center gap-3 rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-sm text-gray-700 shadow-sm">
                <Globe2 className="h-4 w-4 text-blue-500" />
                Aggancia l’URL di test
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-sm text-gray-700 shadow-sm">
                <Upload className="h-4 w-4 text-purple-500" />
                Analizziamo il PDF SDD
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-sm text-gray-700 shadow-sm">
                <ShieldCheck className="h-4 w-4 text-pink-500" />
                Validazione pre-run automatica
              </div>
            </div>
          </div>
          <div className="w-full max-w-sm space-y-4 rounded-3xl border border-white/70 bg-white/80 p-6 text-sm text-gray-700 shadow-lg backdrop-blur">
            <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-gray-500">
              Checklist rapida
            </h2>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <CheckCircle2 className="mt-1 h-4 w-4 text-indigo-500" />
                <span>Assicurati che il PDF sia aggiornato con gli eventi richiesti dal brand.</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="mt-1 h-4 w-4 text-indigo-500" />
                <span>Utilizza URL di staging solo se replicano esattamente il comportamento di produzione.</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="mt-1 h-4 w-4 text-indigo-500" />
                <span>Verifica che la CMP sia raggiungibile senza autenticazione o firewall.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
        <Card className="relative overflow-hidden rounded-3xl border border-white/70 bg-white/80 p-8 shadow-xl backdrop-blur">
          <div className="flex flex-col gap-8">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-indigo-500">
                Configurazione sorgenti
              </p>
              <h3 className="text-2xl font-semibold text-gray-900">URL di destinazione</h3>
              <p className="text-sm leading-relaxed text-gray-600">
                Scegli uno degli URL suggeriti dal modulo oppure inseriscine uno personalizzato. Useremo questa pagina per caricare l’HTML e agganciare il cookie banner.
              </p>
              {hasPresets ? (
                <div className="space-y-3">
                  <select
                    value={selectValue}
                    onChange={(event) => {
                      const value = event.target.value;
                      if (value === '__custom__') {
                        onUrlChange('');
                      } else {
                        onUrlChange(value);
                      }
                    }}
                    className="w-full rounded-2xl border border-white/70 bg-white px-4 py-3 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-200/60"
                  >
                    {moduleUrls.map(url => (
                      <option key={url} value={url}>{url}</option>
                    ))}
                    <option value="__custom__">Altro…</option>
                  </select>
                  <Input
                    type="url"
                    placeholder="Inserisci un URL personalizzato"
                    value={state.url}
                    onChange={(e) => onUrlChange(e.target.value)}
                    className={`w-full rounded-2xl border border-white/70 bg-white px-4 py-3 text-sm shadow-sm transition-all ${
                      !isCustom ? 'bg-gray-100 text-gray-500' : 'focus:border-indigo-500 focus:ring-4 focus:ring-indigo-200/60'
                    }`}
                    readOnly={!isCustom}
                  />
                  {!isCustom && (
                    <p className="text-xs text-gray-500">
                      Seleziona "Altro…" per inserire un URL personalizzato.
                    </p>
                  )}
                </div>
              ) : (
                <Input
                  type="url"
                  placeholder="https://example.com"
                  value={state.url}
                  onChange={(e) => onUrlChange(e.target.value)}
                  className="w-full rounded-2xl border border-white/70 bg-white px-4 py-3 text-sm shadow-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-200/60"
                />
              )}
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-indigo-500">
                Documento SDD
              </p>
              <h3 className="text-2xl font-semibold text-gray-900">Carica il PDF</h3>
              <p className="text-sm leading-relaxed text-gray-600">
                Trascina il file o clicca per selezionarlo. Il motore estrae il testo, standardizza il JSON e calcola automaticamente gli assert sugli eventi.
              </p>
              <label
                htmlFor="pdf-upload"
                className={`flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed p-10 text-center transition-all duration-300 ${
                  state.pdfFile
                    ? 'border-emerald-400/80 bg-emerald-50/80 shadow-inner'
                    : 'border-indigo-200/70 bg-white/60 hover:border-indigo-400 hover:bg-indigo-50/80 hover:shadow-lg'
                }`}
              >
                <FileText
                  className={`mb-4 h-16 w-16 ${
                    state.pdfFile ? 'text-emerald-500' : 'text-indigo-400'
                  }`}
                />
                <div className="space-y-2">
                  <p className={`text-base font-semibold ${
                    state.pdfFile ? 'text-emerald-700' : 'text-gray-700'
                  }`}>
                    {state.pdfFile ? state.pdfFile.name : 'Trascina il PDF qui o clicca per selezionare'}
                  </p>
                  <p className="text-xs text-gray-500">
                    Supportiamo file multipagina, glosse e allegati embedded. Verranno automaticamente normalizzati.
                  </p>
                  {state.pdfFile && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-white/80 px-3 py-1 text-xs font-semibold text-emerald-600 shadow-sm">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      File pronto alla trasformazione
                    </span>
                  )}
                </div>
              </label>
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => e.target.files?.[0] && onFileUpload(e.target.files[0])}
                className="hidden"
                id="pdf-upload"
              />
            </div>

            {state.error && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 shadow-sm">
                <div className="flex items-start gap-3">
                  <XCircle className="mt-0.5 h-5 w-5 text-rose-500" />
                  <div>
                    <p className="font-semibold">Qualcosa è andato storto</p>
                    <p>{state.error}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="rounded-3xl border border-white/70 bg-white/80 p-6 text-sm text-gray-700 shadow-xl backdrop-blur">
            <div className="flex items-center gap-3 text-indigo-500">
              <Info className="h-4 w-4" />
              Informazioni ambiente
            </div>
            <div className="mt-4 space-y-3">
              {configLoading && (
                <div className="flex items-center gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/70 px-4 py-3 text-sm text-indigo-700">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Caricamento configurazione del server SDD…
                </div>
              )}
              {configError && (
                <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  <XCircle className="mt-0.5 h-4 w-4" />
                  <div>
                    <p className="font-semibold">Impossibile caricare la configurazione</p>
                    <p>{configError}</p>
                  </div>
                </div>
              )}
              {ssdConfig && !configError && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-700">
                    <span>Dimensione massima</span>
                    <strong>{ssdConfig.maxFileSizeMB} MB</strong>
                  </div>
                  <div className="rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-sm text-blue-700">
                    <p className="font-semibold">Formati supportati</p>
                    <p>{ssdConfig.supportedFormats.join(', ')}</p>
                  </div>
                </div>
              )}
            </div>
          </Card>

          <Card className="rounded-3xl border border-white/70 bg-white/80 p-6 text-sm text-gray-700 shadow-xl backdrop-blur">
            <div className="flex items-center gap-3 text-purple-500">
              <Sparkles className="h-4 w-4" />
              Cosa succede dopo?
            </div>
            <ul className="mt-4 space-y-3">
              <li className="flex items-start gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-purple-400" />
                <span>Analizziamo il PDF e produciamo la DSL normalizzata per il runner.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-purple-400" />
                <span>Scarichiamo l’HTML dell’URL per identificare CMP e selettori reali.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-purple-400" />
                <span>Eseguiamo la validazione statica per segnalare mismatch o ambiguità prima del run.</span>
              </li>
            </ul>
          </Card>
        </div>
      </div>

      <div className="sticky bottom-8 flex flex-col items-center justify-between gap-4 rounded-3xl border border-white/60 bg-white/75 px-6 py-5 shadow-2xl backdrop-blur">
        <div className="text-center text-sm text-gray-600">
          {!state.pdfFile || !state.url
            ? 'Completa URL e PDF per attivare l’elaborazione.'
            : 'Pronto a trasformare il PDF in test eseguibili.'}
        </div>
        <Button
          onClick={onIngest}
          disabled={!state.url || !state.pdfFile || state.isLoading || !ssdConfig || configLoading}
          className="group relative inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 px-8 py-3 text-base font-semibold text-white shadow-lg transition-all duration-200 hover:shadow-2xl focus:ring-4 focus:ring-purple-300/40 disabled:cursor-not-allowed disabled:from-gray-200 disabled:to-gray-300 disabled:text-gray-500"
        >
          {state.isLoading ? (
            <RefreshCw className="h-5 w-5 animate-spin" />
          ) : (
            <FileText className="h-5 w-5" />
          )}
          {state.isLoading ? 'Analisi in corso…' : 'Processa PDF e genera test'}
        </Button>
      </div>
    </div>
  );
}
