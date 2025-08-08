// src/pages/ChecklistPage.tsx
import { useState, useEffect } from "react";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  NotebookPen,
  RotateCcw,
  Search,
  Gauge,
  Accessibility,
  Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Lottie from "lottie-react";
import toast from "react-hot-toast";

import {
  runWebsiteChecklist,
  WebsiteChecklistResult,
} from "../services/websiteChecklist";
import animationData from "../assets/background-ai-loader.json";

/*────────────────────────── type-writer hook ──────────────────────────*/
function useCyclingTypewriter(
  texts: string[],
  speed = 70,
  hold = 3000
): { text: string; step: number } {
  const [step, setStep] = useState(0); // frase corrente
  const [sub, setSub] = useState(0); // indice carattere
  const [text, setText] = useState("");

  useEffect(() => {
    let t: NodeJS.Timeout;

    // fase di typing
    if (sub < texts[step].length) {
      setText(texts[step].slice(0, sub + 1));
      t = setTimeout(() => setSub(sub + 1), speed);
      return () => clearTimeout(t);
    }

    // pausa
    t = setTimeout(() => {
      setSub(0);
      setStep((s) => (s + 1) % texts.length);
    }, hold);
    return () => clearTimeout(t);
  }, [sub, step, texts, speed, hold]);

  return { text, step };
}

/*────────────────────────── componente ──────────────────────────*/
export default function ChecklistPage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WebsiteChecklistResult | null>(null);
  const [error, setError] = useState<string | null>(null);

const steps = [
  { label: "Analisi delle ottimizzazioni SEO on-page…", icon: Search },
  { label: "Valutazione delle performance di caricamento…", icon: Gauge },
  { label: "Verifica dei criteri di accessibilità WCAG…", icon: Accessibility },
  { label: "Elaborazione del report diagnostico tramite AI…", icon: Sparkles },
];

  const { text: typing, step } = useCyclingTypewriter(
    steps.map((s) => s.label),
    70,
    3000
  );

  const CurrentIcon =
    steps[step] && typeof steps[step].icon === "function"
      ? steps[step].icon
      : Loader2;

  // esegue l'analisi
  const handleRun = async () => {
    if (!url) return;

    setLoading(true);
    setError(null);
    setResult(null);
    toast.loading("Analisi in corso…", { id: "check" });

    try {
      const data = await runWebsiteChecklist(url);
      setResult(data);
      toast.success("Checklist completata!", { id: "check" });
    } catch (e) {
      const msg = (e as Error).message || "Errore imprevisto.";
      setError(msg);
      toast.error(msg, { id: "check" });
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setResult(null);
    setError(null);
    setUrl("");
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

      {/* overlay loader */}
      {loading && (
        <div className="fixed inset-0 z-50 bg-gradient-to-br from-fuchsia-50 via-pink-50 to-white dark:from-gray-900 dark:via-gray-950 dark:to-black flex items-center justify-center overflow-hidden">
          <div className="absolute -top-48 -left-48 w-[600px] h-[600px] bg-fuchsia-400 opacity-30 blur-3xl rounded-full" />
          <div className="absolute -bottom-48 -right-48 w-[600px] h-[600px] bg-pink-400 opacity-30 blur-3xl rounded-full" />

          <div className="relative flex flex-col items-center">
            <div className="w-[500px] max-w-[90%]">
              <Lottie animationData={animationData} loop autoplay />
              <div className="mt-4 flex items-center justify-center gap-2">
                <CurrentIcon className="h-5 w-5 text-fuchsia-600 shrink-0" />
                <p className="min-h-[1.5rem] text-lg font-semibold text-gray-800 dark:text-white">
                  {typing || "Stiamo analizzando il tuo sito…"}
                </p>
                <Loader2 className="h-5 w-5 animate-spin text-fuchsia-600" />
              </div>
            </div>
          </div>
        </div>
      )}

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

            <div className="rounded-xl bg-white/60 p-6 shadow-inner backdrop-blur-md dark:bg-gray-900/40">
              <h3 className="mb-3 text-lg font-medium">Diagnosi IA</h3>
              <pre className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800 dark:text-gray-200">
                {result.aiSummary}
              </pre>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}