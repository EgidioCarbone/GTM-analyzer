import React from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import {
  ArrowRight,
  BadgeCheck,
  Blocks,
  CheckCircle2,
  Sparkles,
  Antenna,
  Shield,
  ShieldCheck
} from 'lucide-react';
import { listModules } from '../../modules';
import type { ModuleId } from '../../modules/types';

type ModuleSelectionStepProps = {
  currentModuleId: ModuleId | null;
  onModuleSelect: (moduleId: ModuleId) => void;
  onModuleProceed: () => void;
};

export default function ModuleSelectionStep({
  currentModuleId,
  onModuleSelect,
  onModuleProceed,
}: ModuleSelectionStepProps) {
  const modules = listModules();

  const iconMap: Record<string, React.ReactNode> = {
    Antenna: <Antenna className="h-5 w-5" />,
    Shield: <Shield className="h-5 w-5" />,
    ShieldCheck: <ShieldCheck className="h-5 w-5" />,
  };

  return (
    <div className="space-y-10">
      <div className="relative overflow-hidden rounded-3xl border border-white/50 bg-white/70 p-10 shadow-xl backdrop-blur-lg">
        <div className="pointer-events-none absolute -top-32 -left-24 h-72 w-72 rounded-full bg-gradient-to-br from-indigo-400/40 via-purple-400/30 to-pink-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -right-10 h-72 w-72 rounded-full bg-gradient-to-br from-amber-300/40 via-fuchsia-300/40 to-blue-400/30 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200/70 bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-indigo-600 shadow-sm">
              <Sparkles className="h-3.5 w-3.5" />
              SSD Vertical Modules
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-gray-900">
              Scegli il modulo perfetto per i tuoi <span className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">SSD Test</span>
            </h1>
            <p className="text-lg leading-relaxed text-gray-600">
              Ogni modulo è ottimizzato con configurazioni dedicate a CMP, funnel e tracciamenti specifici del brand. Scegli la base di partenza e lascia che l’automazione faccia il resto.
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex items-center gap-3 rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-sm text-gray-700 shadow-sm">
                <BadgeCheck className="h-4 w-4 text-indigo-500" />
                Script CMP preconfigurati
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-sm text-gray-700 shadow-sm">
                <Blocks className="h-4 w-4 text-purple-500" />
                Manifest con selettori certificati
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-sm text-gray-700 shadow-sm">
                <CheckCircle2 className="h-4 w-4 text-pink-500" />
                Test GA4 automatizzati
              </div>
            </div>
          </div>
          <div className="w-full max-w-sm space-y-4 rounded-3xl border border-white/70 bg-white/80 p-6 text-sm text-gray-700 shadow-lg">
            <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-gray-500">Step corrente</h2>
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-2xl border border-indigo-100/80 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 px-4 py-3 text-gray-800 shadow-sm">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500/10 text-sm font-semibold text-indigo-600 shadow-inner">
                  1
                </span>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Modulo</p>
                  <p className="text-xs text-gray-600">Scegli la verticalizzazione con cui iniziare</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-white/70 bg-white/60 px-4 py-3 text-gray-400">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold">2</span>
                <div>
                  <p className="text-sm font-semibold">Scenario</p>
                  <p className="text-xs">Configura evento e parametri</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-white/70 bg-white/60 px-4 py-3 text-gray-400">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold">3</span>
                <div>
                  <p className="text-sm font-semibold">Risultati</p>
                  <p className="text-xs">Analisi eventi &amp; suggerimenti</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-indigo-500">
              MODULI DISPONIBILI
            </p>
            <h2 className="text-2xl font-bold text-gray-900">Seleziona il dominio verticale</h2>
          </div>
          <p className="max-w-xl text-sm text-gray-600">
            La scelta influisce sui selettori predefiniti, sulla CMP da agganciare e sui controlli dedicati che verranno eseguiti dal runner.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {modules.map(mod => {
          const isActive = mod.meta.id === currentModuleId;
          const Icon = mod.meta.icon ? iconMap[mod.meta.icon] : null;

          return (
            <Card
              key={mod.meta.id}
              className={`group relative overflow-hidden rounded-3xl border border-white/60 bg-white/70 p-7 shadow-lg transition-all duration-300 backdrop-blur-sm cursor-pointer ${
                isActive
                  ? 'ring-2 ring-indigo-400/70 shadow-2xl scale-[1.01] bg-gradient-to-br from-indigo-500/10 via-white to-purple-500/10'
                  : 'hover:-translate-y-2 hover:shadow-xl hover:ring-1 hover:ring-indigo-200/60'
              }`}
              onClick={() => onModuleSelect(mod.meta.id)}
            >
              {isActive && (
                <>
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-indigo-200/60 via-purple-200/40 to-transparent opacity-80" />
                  <div className="pointer-events-none absolute -top-24 -right-10 h-48 w-48 rounded-full bg-indigo-400/40 blur-3xl" />
                </>
              )}

              <div className="relative flex flex-col gap-5">
                <div className="flex items-start gap-4">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border border-white/70 bg-white/80 text-indigo-500 shadow-inner ${isActive ? 'text-indigo-600' : ''}`}>
                    {Icon}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-semibold text-gray-900">{mod.meta.title}</h3>
                      {isActive && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-white/80 px-3 py-1 text-xs font-semibold text-indigo-600 shadow-sm backdrop-blur">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Modulo attivo
                        </span>
                      )}
                    </div>
                    <p className="text-sm leading-relaxed text-gray-600">{mod.meta.description}</p>
                  </div>
                </div>
                {mod.meta.tags && mod.meta.tags.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {mod.meta.tags.map(tag => (
                      <span
                        key={tag}
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                          isActive
                            ? 'border-indigo-200/80 bg-white/90 text-indigo-600'
                            : 'border-gray-200 bg-gray-50 text-gray-600'
                        }`}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}

                {mod.supportedHosts.length > 0 && (
                  <div className="rounded-2xl border border-white/70 bg-white/80 p-4 text-xs text-gray-500 shadow-inner">
                    <div className="flex items-center gap-2 text-gray-700">
                      <span className="font-semibold text-gray-800">Domini supportati</span>
                    </div>
                    <ul className="mt-2 space-y-1 text-gray-600">
                      {mod.supportedHosts.map(host => (
                        <li key={host} className="flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                          {host}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-[0.25em] text-gray-400">
                    MODULO #{mod.meta.id.toUpperCase()}
                  </span>
                  <span
                    className={`text-xs font-semibold ${
                      isActive ? 'text-indigo-600' : 'text-gray-400'
                    }`}
                  >
                    {isActive ? 'Pronto per il prossimo step' : 'Clicca per selezionare'}
                  </span>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="sticky bottom-8 flex flex-col items-center justify-between gap-4 rounded-3xl border border-white/60 bg-white/70 px-6 py-5 shadow-2xl backdrop-blur">
        <div className="text-center text-sm text-gray-600">
          {currentModuleId
            ? `Hai selezionato il modulo "${modules.find(m => m.meta.id === currentModuleId)?.meta.title}".`
            : 'Seleziona un modulo per continuare con la configurazione.'}
        </div>
        <Button
          disabled={!currentModuleId}
          onClick={onModuleProceed}
          className="group relative inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 px-8 py-3 text-base font-semibold text-white shadow-lg transition-all duration-200 hover:shadow-2xl hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500 focus:ring-4 focus:ring-purple-300/40 disabled:cursor-not-allowed disabled:from-gray-200 disabled:to-gray-300 disabled:text-gray-500"
        >
          Continua
          <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
        </Button>
      </div>
    </div>
  );
}
