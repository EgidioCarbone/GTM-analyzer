import React from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/Skeleton';
import {
  ArrowRight,
  BadgeCheck,
  Blocks,
  CheckCircle2,
  Sparkles,
  Antenna,
  Shield,
  ShieldCheck,
  Layers,
  Rocket,
  PlusCircle,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import type { ModuleId, SSDModule } from '../../modules/types';

type ModuleSelectionStepProps = {
  modules: SSDModule[];
  loading: boolean;
  error: string | null;
  currentModuleId: ModuleId | null;
  onModuleSelect: (module: SSDModule) => void;
  onModuleProceed: () => void;
  onCreateModule: () => void;
};

const ICON_COMPONENTS: Record<string, React.ComponentType<{ className?: string }>> = {
  Antenna,
  Shield,
  ShieldCheck,
  Sparkles,
  Layers,
  Rocket,
};

function ModulePlaceholder() {
  return (
    <Card className="cursor-wait border border-white/70 bg-white/70 p-6 shadow-lg">
      <div className="flex flex-col gap-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      </div>
    </Card>
  );
}

export default function ModuleSelectionStep({
  modules,
  loading,
  error,
  currentModuleId,
  onModuleSelect,
  onModuleProceed,
  onCreateModule,
}: ModuleSelectionStepProps) {
  const renderIcon = (name?: string) => {
    const IconComponent = (name && ICON_COMPONENTS[name]) || ShieldCheck;
    return <IconComponent className="h-5 w-5" />;
  };

  return (
    <div className="space-y-10">
      <div className="relative overflow-hidden rounded-3xl border border-white/50 bg-white/70 p-10 shadow-xl backdrop-blur-lg">
        <div className="pointer-events-none absolute -top-32 -left-24 h-72 w-72 rounded-full bg-gradient-to-br from-indigo-400/40 via-purple-400/30 to-pink-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -right-10 h-72 w-72 rounded-full bg-gradient-to-br from-amber-300/40 via-fuchsia-300/40 to-blue-400/30 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200/70 bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-indigo-600 shadow-sm">
              <Sparkles className="h-3.5 w-3.5" />
              SDD Vertical Modules
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-gray-900">
              Scegli il modulo perfetto per i tuoi{' '}
              <span className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                SDD Test
              </span>
            </h1>
            <p className="text-lg leading-relaxed text-gray-600">
              Ogni modulo definisce la pagina di riferimento, i suggerimenti sugli eventi più comuni e centralizza la
              configurazione della CMP. È il punto di partenza per creare scenari che generano una DSL pronta all’uso e
              validano il payload del dataLayer.
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex items-center gap-3 rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-sm text-gray-700 shadow-sm">
                <BadgeCheck className="h-4 w-4 text-indigo-500" />
                CMP configurabile per modulo
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-sm text-gray-700 shadow-sm">
                <Blocks className="h-4 w-4 text-purple-500" />
                DSL generata dagli scenari
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-sm text-gray-700 shadow-sm">
                <CheckCircle2 className="h-4 w-4 text-pink-500" />
                Confronto dataLayer vs payload atteso
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
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold">
                  2
                </span>
                <div>
                  <p className="text-sm font-semibold">Scenario</p>
                  <p className="text-xs">Configura evento e parametri</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-white/70 bg-white/60 px-4 py-3 text-gray-400">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold">
                  3
                </span>
                <div>
                  <p className="text-sm font-semibold">Risultati</p>
                  <p className="text-xs">Genera DSL ed esegui il test</p>
                </div>
              </div>
            </div>
            <Button
              className="mt-4 w-full justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 px-5 py-3 text-base font-semibold text-white shadow-xl shadow-purple-200/80 transition hover:opacity-95 focus-visible:ring-2 focus-visible:ring-purple-200"
              onClick={onCreateModule}
              type="button"
              disabled={loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
              Nuovo modulo
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-700 shadow-inner">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <div>
            <p className="font-semibold">Impossibile caricare i moduli</p>
            <p className="text-amber-800">{error}</p>
          </div>
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        {loading
          ? Array.from({ length: 3 }).map((_, index) => <ModulePlaceholder key={`placeholder_${index}`} />)
          : modules.length === 0 && !error
          ? (
            <Card className="border border-dashed border-slate-300 bg-white/80 p-6 shadow-inner md:col-span-2">
              <div className="flex flex-col gap-4 text-center">
                <h3 className="text-xl font-semibold text-slate-800">Nessun modulo configurato</h3>
                <p className="text-sm text-slate-600">
                  Crea il primo modulo per iniziare a definire scenari riutilizzabili. Ti basteranno nome, descrizione, dominio e URL principale.
                </p>
                <div>
                  <Button
                    onClick={onCreateModule}
                    className="inline-flex items-center gap-2 bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
                  >
                    <PlusCircle className="h-4 w-4" />
                    Configura un modulo
                  </Button>
                </div>
              </div>
            </Card>
            )
          : modules.map(mod => {
            const isActive = mod.meta.id === currentModuleId;
            return (
              <Card
                key={mod.meta.id}
                className={`relative overflow-hidden border bg-white/80 p-6 shadow-lg transition-all ${
                  isActive
                    ? 'border-indigo-300 ring-2 ring-indigo-200'
                    : 'border-white/70 hover:border-indigo-200'
                }`}
                onClick={() => onModuleSelect(mod)}
              >
                {isActive && (
                  <>
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-indigo-200/60 via-purple-200/40 to-transparent opacity-80" />
                    <div className="pointer-events-none absolute -top-24 -right-10 h-48 w-48 rounded-full bg-indigo-400/40 blur-3xl" />
                  </>
                )}

                <div className="relative flex flex-col gap-5">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/70 bg-white/80 text-indigo-500 shadow-inner">
                      {renderIcon(mod.meta.icon)}
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

                  {mod.meta.tags && mod.meta.tags.length > 0 && (
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
                  )}

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
                    <span className={`text-xs font-semibold ${isActive ? 'text-indigo-600' : 'text-gray-400'}`}>
                      {isActive ? 'Pronto per il prossimo step' : 'Clicca per selezionare'}
                    </span>
                  </div>
                </div>
              </Card>
            );
          })}
      </div>

      <div className="flex justify-end">
        <Button
          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-white shadow-lg hover:bg-indigo-700 disabled:opacity-40"
          onClick={onModuleProceed}
          disabled={!currentModuleId || loading}
        >
          Prosegui con lo scenario
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
