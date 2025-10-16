import React from 'react';
import { Play, Square, Wifi, WifiOff, Clock, Globe, Zap } from 'lucide-react';
import type { EnvInfo } from '../../types/live-debugger';

interface HeaderBarProps {
  running: boolean;
  startTime?: number;
  env?: EnvInfo;
  onStart: (url: string) => void;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
  isPaused: boolean;
}

export function HeaderBar({ 
  running, 
  startTime, 
  env, 
  onStart, 
  onStop, 
  onPause, 
  onResume, 
  isPaused 
}: HeaderBarProps) {
  const [url, setUrl] = React.useState('');
  const [showUrlForm, setShowUrlForm] = React.useState(!running);

  const formatUptime = (startTime: number) => {
    const seconds = Math.floor((Date.now() - startTime) / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onStart(url.trim());
      setShowUrlForm(false);
    }
  };

  const getEnvChipColor = (type: string) => {
    switch (type) {
      case 'GTM': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'gtag': return 'bg-green-100 text-green-800 border-green-200';
      case 'Cookiebot': return 'bg-purple-100 text-purple-800 border-purple-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-6 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-3">
            {showUrlForm ? (
              <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2">
                <div className="flex min-w-[260px] flex-1 items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 shadow-sm focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
                  <Globe className="h-4 w-4 text-slate-400" />
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com"
                    className="flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                    autoFocus
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                >
                  <Play className="h-4 w-4" />
                  Avvia sessione
                </button>
              </form>
            ) : (
              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                <span
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1 font-semibold ${
                    running ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {running ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
                  {running ? 'RUNNING' : 'STOPPED'}
                </span>
                {startTime && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600">
                    <Clock className="h-4 w-4" />
                    {formatUptime(startTime)}
                  </span>
                )}
                {env?.url && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600">
                    <Globe className="h-4 w-4" />
                    <span className="truncate max-w-[220px]" title={env.url}>
                      {new URL(env.url).hostname}
                    </span>
                  </span>
                )}
                {!running && (
                  <button
                    onClick={() => setShowUrlForm(true)}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-1.5 font-medium text-slate-600 transition hover:border-slate-400 hover:text-slate-800"
                  >
                    <Play className="h-4 w-4" />
                    Nuova sessione
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {running && (
              <button
                onClick={isPaused ? onResume : onPause}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
                  isPaused
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300'
                    : 'border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-300'
                }`}
              >
                <Zap className="h-4 w-4" />
                {isPaused ? 'Riprendi stream' : 'Metti in pausa'}
              </button>
            )}
            {running && (
              <button
                onClick={() => {
                  onStop();
                  setShowUrlForm(true);
                }}
                className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 py-1.5 text-sm font-semibold text-red-700 transition hover:border-red-300"
              >
                <Square className="h-4 w-4" />
                Stop
              </button>
            )}
          </div>
        </div>

        {env && (
          <div className="flex flex-wrap items-center gap-2">
            {env.gtm && (
              <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${getEnvChipColor('GTM')}`}>
                GTM
                <span className="font-mono text-[11px]">
                  {env.gtm.containerId ?? (env.gtm.present ? 'present' : 'absent')}
                </span>
              </span>
            )}
            {env.gtag && (
              <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${getEnvChipColor('gtag')}`}>
                gtag
                <span className="font-mono text-[11px]">
                  {Array.isArray(env.gtag.measurementIds) && env.gtag.measurementIds.length > 0
                    ? env.gtag.measurementIds.join(', ')
                    : (env.gtag.present ? 'present' : 'absent')}
                </span>
              </span>
            )}
            {env.cookiebot && (
              <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${getEnvChipColor('Cookiebot')}`}>
                Cookiebot
                <span className="font-mono text-[11px]">
                  {env.cookiebot.version ? `v${env.cookiebot.version}` : (env.cookiebot.present ? 'present' : 'absent')}
                </span>
              </span>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
