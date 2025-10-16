import React from 'react';
import type { EnvInfo } from '../../types/live-debugger';

interface EnvPanelProps {
  env?: EnvInfo;
}

export function EnvPanel({ env }: EnvPanelProps) {
  if (!env) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm ring-1 ring-black/5">
        <p className="font-medium text-slate-600">Environment</p>
        <p className="mt-1 text-slate-400">In attesa di rilevamento…</p>
      </section>
    );
  }

  const hostname = (() => {
    try {
      return new URL(env.url).hostname;
    } catch {
      return env.url;
    }
  })();

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm ring-1 ring-black/5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Environment</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-900">Stack rilevato</h3>
        </div>
        <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
          {hostname}
        </div>
      </div>

      <div className="mt-5 space-y-4 text-sm">
        <div className="flex items-start justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
          <div>
            <p className="font-semibold text-slate-700">Google Tag Manager</p>
            <p className="text-xs text-slate-500">Contenitore principale rilevato</p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${env.gtm.present ? 'bg-emerald-500' : 'bg-red-400'}`}
            />
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-mono text-blue-700">
              {env.gtm.containerId ?? 'n/d'}
            </span>
          </div>
        </div>

        <div className="flex items-start justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
          <div>
            <p className="font-semibold text-slate-700">gtag.js</p>
            <p className="text-xs text-slate-500">Measurement IDs collegati</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1">
            <span
              className={`mr-1 h-2 w-2 rounded-full ${env.gtag.present ? 'bg-emerald-500' : 'bg-red-400'}`}
            />
            {env.gtag.measurementIds && env.gtag.measurementIds.length > 0 ? (
              env.gtag.measurementIds.map((id) => (
                <span
                  key={id}
                  className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-mono text-purple-700"
                >
                  {id}
                </span>
              ))
            ) : (
              <span className="text-xs text-slate-400">nessun ID rilevato</span>
            )}
          </div>
        </div>

        <div className="flex items-start justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
          <div>
            <p className="font-semibold text-slate-700">Cookiebot</p>
            <p className="text-xs text-slate-500">Versione e stato consenso</p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${env.cookiebot.present ? 'bg-emerald-500' : 'bg-red-400'}`}
            />
            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700">
              {env.cookiebot.version ? `v${env.cookiebot.version}` : 'n/d'}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
