// src/pages/ChecklistPage.tsx
import { useState } from "react";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  NotebookPen,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Eye,
  AlertCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import ScreenshotModal from "../components/ScreenshotModal";

import {
  runWebsiteChecklist,
  WebsiteChecklistResult,
} from "../services/websiteChecklist";
import { AnalysisProgress } from "../components/AnalysisProgress";
import { useAnalysisProgress } from "../hooks/useAnalysisProgress";


/*────────────────────────── componente ──────────────────────────*/
export default function ChecklistPage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WebsiteChecklistResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRawData, setShowRawData] = useState(false);
  const [screenshotModal, setScreenshotModal] = useState({
    isOpen: false,
    currentIndex: 0,
  });

  const { 
    isVisible: progressVisible, 
    currentStep, 
    progress, 
    steps: hookSteps,
    startAnalysis, 
    updateStep, 
    completeAnalysis, 
    hideAnalysis 
  } = useAnalysisProgress();

  const analysisSteps = [
    { id: 'navigation', title: 'Navigazione al sito' },
    { id: 'html_extraction', title: 'Estrazione HTML' },
    { id: 'gtm_detection', title: 'Rilevamento GTM' },
    { id: 'consent_analysis', title: 'Analisi Consenso' },
    { id: 'performance_metrics', title: 'Metriche Performance' },
    { id: 'interactive_tests', title: 'Test Interattivi' },
    { id: 'ai_analysis', title: 'Analisi AI' }
  ];

  const handleRun = async () => {
    if (!url) return;

    // ✅ Validazione URL - deve contenere https://
    if (!url.toLowerCase().startsWith('https://')) {
      setError('L\'URL deve iniziare con "https://" per essere valido.');
      toast.error('L\'URL deve iniziare con "https://" per essere valido.', { id: "check" });
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    
    // Avvia il progresso dettagliato
    startAnalysis(analysisSteps);
    toast.loading("Analisi in corso…", { id: "check" });

    try {
      const data = await runWebsiteChecklist(url, (step, status, details) => {
        updateStep(step, status, details);
      });
      setResult(data);
      completeAnalysis();
      toast.success("Checklist completata!", { id: "check" });
    } catch (e) {
      const msg = (e as Error).message || "Errore imprevisto.";
      setError(msg);
      // ✅ Chiudi immediatamente la modale in caso di errore
      hideAnalysis();
      toast.error(msg, { id: "check" });
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setResult(null);
    setError(null);
    setUrl("");
    setShowRawData(false);
    setScreenshotModal({ isOpen: false, currentIndex: 0 });
    setLoading(false);
    hideAnalysis();
  };

  const openScreenshotModal = (index: number) => {
    setScreenshotModal({ isOpen: true, currentIndex: index });
  };

  const closeScreenshotModal = () => {
    setScreenshotModal({ isOpen: false, currentIndex: 0 });
  };

  const goToPreviousScreenshot = () => {
    if (result?.extra?.screenshots && screenshotModal.currentIndex > 0) {
      setScreenshotModal(prev => ({ ...prev, currentIndex: prev.currentIndex - 1 }));
    }
  };

  const goToNextScreenshot = () => {
    if (result?.extra?.screenshots && screenshotModal.currentIndex < result.extra.screenshots.length - 1) {
      setScreenshotModal(prev => ({ ...prev, currentIndex: prev.currentIndex + 1 }));
    }
  };

  const goToScreenshot = (index: number) => {
    setScreenshotModal(prev => ({ ...prev, currentIndex: index }));
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-12 sm:px-8">
      {/* background blobs */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-20 bg-gradient-to-br from-fuchsia-100 via-white to-pink-100 dark:from-gray-900 dark:via-gray-950 dark:to-black"
      />
      <div
        aria-hidden
        className="absolute -left-64 -top-64 -z-10 size-[45rem] rounded-full bg-fuchsia-300 opacity-40 blur-3xl dark:bg-fuchsia-600/30"
      />
      <div
        aria-hidden
        className="absolute -bottom-64 -right-64 -z-10 size-[45rem] rounded-full bg-pink-300 opacity-40 blur-3xl dark:bg-pink-600/20"
      />

      {/* Progress Modal - Sostituisce il loader generico */}
      <AnalysisProgress
        isVisible={loading && progressVisible}
        currentStep={currentStep}
        progress={progress}
        steps={hookSteps}
        onComplete={() => {
          setLoading(false);
          hideAnalysis();
        }}
      />

      {/* hero */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7 }}
        className="relative z-10 mx-auto w-full max-w-2xl space-y-6 text-center"
      >
        <NotebookPen className="mx-auto size-10 text-fuchsia-600" />
        <h1 className="bg-gradient-to-r from-fuchsia-600 to-pink-500 bg-clip-text text-4xl font-extrabold text-transparent drop-shadow-sm md:text-5xl">
          AI Sentinel
        </h1>
        <p className="mx-auto max-w-md text-base leading-relaxed text-gray-700 dark:text-gray-300">
          Inserisci l'URL da analizzare: il tool controllerà performance tecniche
          e best-practice SEO, restituendo una diagnosi generata dall'AI.
        </p>

        <div className="flex flex-col items-center gap-3 sm:flex-row sm:gap-2">
          <input
            className="w-full flex-1 rounded-lg border border-gray-300/60 bg-white/70 px-4 py-2 text-sm shadow-sm backdrop-blur placeholder:text-gray-400 focus:border-fuchsia-500 focus:ring-2 focus:ring-fuchsia-400/40 focus:outline-none dark:border-gray-600/60 dark:bg-gray-900/40 dark:text-gray-100"
            placeholder="https://www.example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={loading}
          />
          <button
            onClick={handleRun}
            disabled={!url || loading}
            className="relative inline-flex items-center justify-center overflow-hidden rounded-lg bg-gradient-to-r from-fuchsia-600 to-pink-500 px-5 py-2 text-sm font-medium text-white shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-xl disabled:pointer-events-none disabled:opacity-40"
          >
            Avvia
          </button>
          {result && !loading && (
            <button
              onClick={reset}
              title="Resetta anteprima"
              className="flex items-center gap-1 self-center rounded-lg border border-gray-300/40 bg-white/80 px-3 py-2 text-xs text-gray-700 shadow hover:bg-white/90 dark:border-gray-700/60 dark:bg-gray-900/40 dark:text-gray-200"
            >
              <RotateCcw className="size-4" /> Reset
            </button>
          )}
        </div>

        {error && (
          <p className="mx-auto w-full max-w-md rounded-md border border-rose-300 bg-rose-50 px-4 py-3 text-rose-700 shadow dark:border-rose-700/60 dark:bg-rose-900/40 dark:text-rose-200">
            {error}
          </p>
        )}
      </motion.div>

      {/* results */}
      <AnimatePresence mode="wait">
        {result && !loading && (
          <motion.section
            key="results"
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 32 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="relative z-10 mt-12 w-full max-w-5xl space-y-10"
          >
            <div className="space-y-1 text-center">
              <h2 className="text-2xl font-semibold">Risultati Checklist</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Analisi completata per{" "}
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-fuchsia-600 underline decoration-dotted underline-offset-2 hover:text-fuchsia-700"
                >
                  {url.replace(/^https?:\/\//, "")}
                </a>
              </p>
            </div>

            {/* Score Overview */}
            <div className="rounded-xl bg-white/60 p-6 shadow-inner backdrop-blur-md dark:bg-gray-900/40">
              <h3 className="mb-4 text-lg font-medium">📊 Punteggi Generali</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                Questi punteggi indicano la qualità complessiva del tuo sito web
              </p>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="text-center p-4 bg-gradient-to-br from-fuchsia-50 to-pink-50 dark:from-fuchsia-900/20 dark:to-pink-900/20 rounded-lg">
                  <div className="text-3xl font-bold text-fuchsia-600 mb-2">
                    {result.overallScore || 0}/100
                  </div>
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Punteggio Generale</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {result.overallScore >= 90 ? 'Eccellente' : 
                     result.overallScore >= 80 ? 'Molto Buono' : 
                     result.overallScore >= 70 ? 'Buono' : 
                     result.overallScore >= 60 ? 'Sufficiente' : 'Da Migliorare'}
                  </div>
                </div>
                <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-lg">
                  <div className="text-3xl font-bold text-blue-600 mb-2">
                    {result.performanceScore || 0}/100
                  </div>
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Performance</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Velocità e ottimizzazione
                  </div>
                </div>
                <div className="text-center p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg">
                  <div className="text-3xl font-bold text-green-600 mb-2">
                    {result.accessibilityScore || 0}/100
                  </div>
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Accessibilità</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Usabilità per tutti
                  </div>
                </div>
                <div className="text-center p-4 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 rounded-lg">
                  <div className="text-3xl font-bold text-orange-600 mb-2">
                    {result.seoScore || 0}/100
                  </div>
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">SEO</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Ottimizzazione motori di ricerca
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(result.checks).map(([key, ok]) => (
                <motion.div
                  key={key}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.25, delay: 0.05 }}
                  className={`flex items-center gap-3 rounded-xl px-5 py-4 shadow-sm ring-1 backdrop-blur-lg
                    ${
                      ok
                        ? "bg-emerald-50/60 text-emerald-800 ring-emerald-200/70 dark:bg-emerald-400/20 dark:text-emerald-200 dark:ring-emerald-400/40"
                        : "bg-rose-50/60 text-rose-800 ring-rose-200/70 dark:bg-rose-400/20 dark:text-rose-200 dark:ring-rose-400/40"
                    }`}
                >
                  {ok ? (
                    <CheckCircle2 className="size-5 shrink-0 text-emerald-600 dark:text-emerald-300" />
                  ) : (
                    <XCircle className="size-5 shrink-0 text-rose-600 dark:text-rose-300" />
                  )}
                  <span className="capitalize leading-snug">
                    {key.replace(/([A-Z])/g, " $1")}
                  </span>
                </motion.div>
              ))}
            </div>

            {/* Performance Metrics */}
            {result.extra?.performanceMetrics && (
              <div className="rounded-xl bg-white/60 p-6 shadow-inner backdrop-blur-md dark:bg-gray-900/40">
                <h3 className="mb-4 text-lg font-medium">📊 Metriche di Performance</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Core Web Vitals */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                      🚀 Core Web Vitals
                    </h4>
                    <div className="text-xs text-gray-500 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 p-3 rounded">
                      <strong>Perché "Non disponibile"?</strong>
                      <ul className="mt-2 space-y-1 text-xs">
                        <li>• <strong>LCP:</strong> Richiede identificazione dell'elemento più grande (difficile in headless)</li>
                        <li>• <strong>FID:</strong> Richiede interazione utente reale (click/tap)</li>
                        <li>• <strong>CLS:</strong> Richiede rilevamento di spostamenti visivi (limitato in headless)</li>
                      </ul>
                      <div className="mt-2 text-xs text-blue-600 dark:text-blue-400">
                        💡 <strong>Suggerimento:</strong> Per metriche complete, testa con Chrome DevTools o PageSpeed Insights
                      </div>
                    </div>
                    {/* LCP */}
                      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600 dark:text-gray-300">Largest Contentful Paint</span>
                          <span className={`text-lg font-bold ${
                          result.extra.performanceMetrics.lcp && result.extra.performanceMetrics.lcp < 2500 ? 'text-green-600' : 
                          result.extra.performanceMetrics.lcp && result.extra.performanceMetrics.lcp < 4000 ? 'text-yellow-600' : 
                          result.extra.performanceMetrics.lcp ? 'text-red-600' : 'text-gray-500'
                          }`}>
                          {result.extra.performanceMetrics.lcp > 0 ? 
                            `${(result.extra.performanceMetrics.lcp / 1000).toFixed(1)}s` : 
                            'Non disponibile'
                          }
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Tempo di caricamento del contenuto principale
                        </div>
                      </div>
                    {/* FID */}
                      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600 dark:text-gray-300">First Input Delay</span>
                          <span className={`text-lg font-bold ${
                          result.extra.performanceMetrics.fid && result.extra.performanceMetrics.fid < 100 ? 'text-green-600' : 
                          result.extra.performanceMetrics.fid && result.extra.performanceMetrics.fid < 300 ? 'text-yellow-600' : 
                          result.extra.performanceMetrics.fid ? 'text-red-600' : 'text-gray-500'
                          }`}>
                          {result.extra.performanceMetrics.fid > 0 ? 
                            `${result.extra.performanceMetrics.fid.toFixed(0)}ms` : 
                            'Non disponibile'
                          }
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Tempo di risposta al primo click
                        </div>
                      </div>
                    {/* CLS */}
                      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600 dark:text-gray-300">Cumulative Layout Shift</span>
                          <span className={`text-lg font-bold ${
                          result.extra.performanceMetrics.cls && result.extra.performanceMetrics.cls < 0.1 ? 'text-green-600' : 
                          result.extra.performanceMetrics.cls && result.extra.performanceMetrics.cls < 0.25 ? 'text-yellow-600' : 
                          result.extra.performanceMetrics.cls ? 'text-red-600' : 'text-gray-500'
                          }`}>
                          {result.extra.performanceMetrics.cls > 0 ? 
                            result.extra.performanceMetrics.cls.toFixed(3) : 
                            'Non disponibile'
                          }
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Stabilità visiva della pagina
                        </div>
                      </div>
                  </div>

                  {/* Tempi di Caricamento */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                      ⏱️ Tempi di Caricamento
                    </h4>
                    {result.extra.performanceMetrics.fcp > 0 && (
                      <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600 dark:text-gray-300">First Contentful Paint</span>
                          <span className={`text-lg font-bold ${
                            result.extra.performanceMetrics.fcp < 1800 ? 'text-green-600' : 
                            result.extra.performanceMetrics.fcp < 3000 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {(result.extra.performanceMetrics.fcp / 1000).toFixed(1)}s
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Primo contenuto visibile
                        </div>
                      </div>
                    )}
                    {result.extra.performanceMetrics.ttfb > 0 && (
                      <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600 dark:text-gray-300">Time to First Byte</span>
                          <span className={`text-lg font-bold ${
                            result.extra.performanceMetrics.ttfb < 600 ? 'text-green-600' : 
                            result.extra.performanceMetrics.ttfb < 1500 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {result.extra.performanceMetrics.ttfb.toFixed(0)}ms
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Tempo di risposta del server
                        </div>
                      </div>
                    )}
                    {result.extra.performanceMetrics.speedIndex > 0 && (
                      <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600 dark:text-gray-300">Speed Index</span>
                          <span className={`text-lg font-bold ${
                            result.extra.performanceMetrics.speedIndex < 3400 ? 'text-green-600' : 
                            result.extra.performanceMetrics.speedIndex < 5800 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {(result.extra.performanceMetrics.speedIndex / 1000).toFixed(1)}s
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Velocità di caricamento percepita
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Utilizzo Risorse */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                      💾 Utilizzo Risorse
                    </h4>
                    {/* Memoria JavaScript */}
                    <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600 dark:text-gray-300">Memoria JavaScript</span>
                        <span className="text-lg font-bold text-purple-600">
                          {result.extra.performanceMetrics.jsHeapUsedSize > 0 ? 
                            `${(result.extra.performanceMetrics.jsHeapUsedSize / 1024 / 1024).toFixed(1)}MB` : 
                            'Non disponibile'
                          }
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Memoria utilizzata dal browser
                      </div>
                    </div>
                    {/* Elementi DOM */}
                    <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600 dark:text-gray-300">Elementi DOM</span>
                        <span className="text-lg font-bold text-purple-600">
                          {result.extra.performanceMetrics.nodes > 0 ? 
                            result.extra.performanceMetrics.nodes.toLocaleString() : 
                            'Non disponibile'
                          }
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Elementi nella pagina
                      </div>
                    </div>
                    {result.extra.performanceMetrics.layoutCount > 0 && (
                      <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600 dark:text-gray-300">Ricalcoli Layout</span>
                          <span className={`text-lg font-bold ${
                            result.extra.performanceMetrics.layoutCount < 10 ? 'text-green-600' : 
                            result.extra.performanceMetrics.layoutCount < 30 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {result.extra.performanceMetrics.layoutCount}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Ricalcoli di posizionamento
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Interactive Test Results */}
            {result.extra?.interactiveTestResults && (
              <div className="rounded-xl bg-white/60 p-6 shadow-inner backdrop-blur-md dark:bg-gray-900/40">
                <h3 className="mb-4 text-lg font-medium">🧪 Test Interattivi</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                  Questi test verificano automaticamente il funzionamento del sistema di consenso cookie
                </p>
                <div className="space-y-4">
                  {result.extra.interactiveTestResults.acceptAllTest && (
                    <div className="p-4 bg-gray-50/60 dark:bg-gray-800/40 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                          ✅ Test "Accetta Tutti"
                        </h4>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          result.extra.interactiveTestResults.acceptAllTest.passed 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }`}>
                          {result.extra.interactiveTestResults.acceptAllTest.passed ? 'SUPERATO' : 'FALLITO'}
                        </span>
                      </div>
                      <div className="space-y-2 text-xs text-gray-600 dark:text-gray-300">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${
                            result.extra.interactiveTestResults.acceptAllTest.consentUpdated ? 'bg-green-500' : 'bg-red-500'
                          }`}></span>
                          <span>Consenso aggiornato: {result.extra.interactiveTestResults.acceptAllTest.consentUpdated ? 'Sì' : 'No'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${
                            result.extra.interactiveTestResults.acceptAllTest.marketingTagsFired ? 'bg-green-500' : 'bg-red-500'
                          }`}></span>
                          <span>Tag marketing attivati: {result.extra.interactiveTestResults.acceptAllTest.marketingTagsFired ? 'Sì' : 'No'}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {result.extra.interactiveTestResults.rejectAllTest && (
                    <div className="p-4 bg-gray-50/60 dark:bg-gray-800/40 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                          ❌ Test "Rifiuta Tutti"
                        </h4>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          result.extra.interactiveTestResults.rejectAllTest.passed 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }`}>
                          {result.extra.interactiveTestResults.rejectAllTest.passed ? 'SUPERATO' : 'FALLITO'}
                        </span>
                      </div>
                      <div className="space-y-2 text-xs text-gray-600 dark:text-gray-300">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${
                            result.extra.interactiveTestResults.rejectAllTest.marketingTagsBlocked ? 'bg-green-500' : 'bg-red-500'
                          }`}></span>
                          <span>Tag marketing bloccati: {result.extra.interactiveTestResults.rejectAllTest.marketingTagsBlocked ? 'Sì' : 'No'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${
                            result.extra.interactiveTestResults.rejectAllTest.consentDenied ? 'bg-green-500' : 'bg-red-500'
                          }`}></span>
                          <span>Consenso negato: {result.extra.interactiveTestResults.rejectAllTest.consentDenied ? 'Sì' : 'No'}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {result.extra.interactiveTestResults.navigationTest && (
                    <div className="p-4 bg-gray-50/60 dark:bg-gray-800/40 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                          🔄 Test Navigazione
                        </h4>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          result.extra.interactiveTestResults.navigationTest.passed 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }`}>
                          {result.extra.interactiveTestResults.navigationTest.passed ? 'SUPERATO' : 'FALLITO'}
                        </span>
                      </div>
                      <div className="space-y-2 text-xs text-gray-600 dark:text-gray-300">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${
                            result.extra.interactiveTestResults.navigationTest.gtmLoaded ? 'bg-green-500' : 'bg-red-500'
                          }`}></span>
                          <span>GTM caricato: {result.extra.interactiveTestResults.navigationTest.gtmLoaded ? 'Sì' : 'No'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${
                            result.extra.interactiveTestResults.navigationTest.consentPersisted ? 'bg-green-500' : 'bg-red-500'
                          }`}></span>
                          <span>Consenso persistente: {result.extra.interactiveTestResults.navigationTest.consentPersisted ? 'Sì' : 'No'}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Debug Section - Temporary */}
            <div className="rounded-xl bg-yellow-50 dark:bg-yellow-900/20 p-6 shadow-inner backdrop-blur-md">
              <h3 className="mb-4 text-lg font-medium text-yellow-800 dark:text-yellow-200">🔍 Debug Info</h3>
              <div className="text-sm text-yellow-700 dark:text-yellow-300">
                <p><strong>Performance Metrics:</strong> {result.extra?.performanceMetrics ? 'Presente' : 'Assente'}</p>
                <p><strong>Interactive Tests:</strong> {result.extra?.interactiveTestResults ? 'Presente' : 'Assente'}</p>
                <p><strong>Screenshots:</strong> {result.extra?.screenshots ? `${result.extra.screenshots.length} ${result.extra.screenshots.length === 1 ? 'banner cookie' : 'immagini'}` : 'Assente'}</p>
                <details className="mt-2">
                  <summary className="cursor-pointer font-medium">Mostra dati extra completi</summary>
                  <pre className="mt-2 p-2 bg-yellow-100 dark:bg-yellow-800/40 rounded text-xs overflow-auto">
                    {JSON.stringify(result.extra, null, 2)}
                  </pre>
                </details>
              </div>
            </div>

            {/* Screenshots */}
            {result.extra?.screenshots && result.extra.screenshots.length > 0 && (
              <div className="rounded-xl bg-white/60 p-6 shadow-inner backdrop-blur-md dark:bg-gray-900/40">
                <h3 className="mb-4 text-lg font-medium">
                  {result.extra.screenshots.length === 1 ? '🍪 Banner dei Cookie' : 'Screenshots'}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {result.extra.screenshots.map((screenshot, index) => (
                    <div key={index} className="text-center group">
                      <div className="relative overflow-hidden rounded-lg border border-gray-300 dark:border-gray-600 group-hover:border-blue-500 dark:group-hover:border-blue-400 transition-colors">
                        <img
                          src={`data:image/png;base64,${screenshot}`}
                          alt={result.extra.screenshots.length === 1 ? '🍪 Banner dei Cookie' : `Screenshot ${index + 1}`}
                          className="w-full h-32 object-cover transition-transform group-hover:scale-105"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const errorDiv = document.createElement('div');
                            errorDiv.className = 'w-full h-32 flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400';
                            errorDiv.innerHTML = `
                              <div class="text-center">
                                <div class="text-2xl mb-1">📷</div>
                                <div class="text-xs">Errore caricamento</div>
                              </div>
                            `;
                            target.parentNode?.insertBefore(errorDiv, target);
                          }}
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                          <button
                            onClick={() => openScreenshotModal(index)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 dark:bg-gray-800/90 p-2 rounded-full shadow-lg hover:bg-white dark:hover:bg-gray-800"
                          >
                            <Eye className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-300 mt-2">
                        {result.extra.screenshots.length === 1 ? '🍪 Banner dei Cookie' : `Screenshot ${index + 1}`}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Diagnosi IA */}
            <div className="rounded-xl bg-white/60 p-6 shadow-inner backdrop-blur-md dark:bg-gray-900/40">
              <h3 className="mb-3 text-lg font-medium">Diagnosi IA</h3>
              <pre className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800 dark:text-gray-200">
                {result.aiSummary}
              </pre>
            </div>

            {/* Toggle dati grezzi */}
            {result.extra && (
              <div className="mt-4">
                <button
                  onClick={() => setShowRawData((prev) => !prev)}
                  className="flex items-center gap-2 text-sm font-medium text-fuchsia-600 hover:text-fuchsia-700"
                >
                  {showRawData ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  {showRawData ? "Nascondi dati grezzi" : "Mostra dati grezzi"}
                </button>

                <AnimatePresence>
                  {showRawData && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 rounded-xl bg-gray-50/80 p-4 shadow-inner backdrop-blur-md dark:bg-gray-900/50">
                        <h4 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                          📊 Dati grezzi rilevati
                        </h4>
                        <ul className="space-y-2 text-xs text-gray-600 dark:text-gray-300">
                          {result.extra.gtmIds && (
                            <li>
                              <strong>GTM IDs:</strong>{" "}
                              {result.extra.gtmIds.length > 0
                                ? result.extra.gtmIds.join(", ")
                                : "Nessuno"}
                            </li>
                          )}
                          {result.extra.cookieBannerLibs && (
                            <li>
                              <strong>Cookie Banner:</strong>{" "}
                              {result.extra.cookieBannerLibs.length > 0
                                ? result.extra.cookieBannerLibs.join(", ")
                                : "Nessuno"}
                            </li>
                          )}
                          {result.extra.consentModeCalls && (
                            <li>
                              <strong>Chiamate consentMode:</strong>{" "}
                              {result.extra.consentModeCalls.length}
                            </li>
                          )}
                          {result.extra.consentCallsFoundInHtml && (
                            <li>
                              <strong>Chiamate gtag('consent') rilevate nell’HTML:</strong>
                              <pre className="mt-1 whitespace-pre-wrap bg-gray-100/60 p-2 rounded dark:bg-gray-800/40">
                                {JSON.stringify(result.extra.consentCallsFoundInHtml, null, 2)}
                              </pre>
                            </li>
                          )}
                          {result.extra.dataLayerSummary && (
                            <li>
                              <strong>DataLayer:</strong>{" "}
                              {result.extra.dataLayerSummary.count} eventi totali,{" "}
                              {result.extra.dataLayerSummary.uniqueEvents.length} tipi unici
                              <br />
                              <strong>Eventi unici:</strong>{" "}
                              {result.extra.dataLayerSummary.uniqueEvents.join(", ") || "Nessuno"}
                              <br />
                              <strong>Segnali CMP:</strong>{" "}
                              {result.extra.dataLayerSummary.cmpSignals.join(", ") || "Nessuno"}
                              <br />
                              <strong>Consent nel DL:</strong>{" "}
                              {result.extra.dataLayerSummary.consentEntriesCount}
                            </li>
                          )}
                        </ul>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </motion.section>
        )}
      </AnimatePresence>

      {/* Screenshot Modal */}
      {result?.extra?.screenshots && result.extra.screenshots.length > 0 && (
        <ScreenshotModal
          isOpen={screenshotModal.isOpen}
          onClose={closeScreenshotModal}
          screenshots={result.extra.screenshots}
          currentIndex={screenshotModal.currentIndex}
          onPrevious={goToPreviousScreenshot}
          onNext={goToNextScreenshot}
          onThumbnailClick={goToScreenshot}
        />
      )}
    </div>
  );
}
