// src/pages/ChecklistPage.tsx
import { useState } from "react";
import {
  Loader2,
  NotebookPen,
} from "lucide-react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";

/*────────────────────────── componente ──────────────────────────*/
export default function ChecklistPage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useAI, setUseAI] = useState(true); // Flag per abilitare/disabilitare l'IA

  const handleRun = async () => {
    // TODO: Implementare nuova logica Consent Test B
    toast.info("Funzionalità in sviluppo - Consent Test B", { id: "check" });
  };

  const reset = () => {
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
          e best-practice SEO. Puoi scegliere se includere l'analisi AI avanzata.
        </p>

        {/* Toggle per l'IA */}
        <div className="mb-4 flex items-center justify-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={useAI}
              onChange={(e) => setUseAI(e.target.checked)}
              disabled={loading}
              className="h-4 w-4 rounded border-gray-300 text-fuchsia-600 focus:ring-fuchsia-500 disabled:opacity-50"
            />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Usa Intelligenza Artificiale
            </span>
          </label>
          {useAI && (
            <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded">
              ⚠️ Consumo token
            </span>
          )}
        </div>

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
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              "Avvia"
            )}
          </button>
        </div>

        {error && (
          <p className="mx-auto w-full max-w-md rounded-md border border-rose-300 bg-rose-50 px-4 py-3 text-rose-700 shadow dark:border-rose-700/60 dark:bg-rose-900/40 dark:text-rose-200">
            {error}
          </p>
        )}
      </motion.div>

      {/* Results section rimossa per nuova logica Consent Test B */}
      <div className="mt-8 text-center">
        <p className="text-gray-600 dark:text-gray-400">
          Funzionalità in sviluppo - Consent Test B
        </p>
      </div>
    </div>
  );
}