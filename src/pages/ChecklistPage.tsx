// src/pages/ChecklistPage.tsx
import React, { useState } from "react";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { runWebsiteChecklist, WebsiteChecklistResult } from "../services/websiteChecklist";

export default function ChecklistPage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WebsiteChecklistResult | null>(null);
  const [error, setError] = useState<string | null>(null);

const handleRun = async () => {
  console.log("🔍 URL analizzato:", url); // 👈 DEBUG
  setLoading(true);
  setError(null);
  try {
    const data = await runWebsiteChecklist(url);
    console.log("✅ Risultato ricevuto:", data); // 👈 DEBUG
    setResult(data);
  } catch (e) {
    setError((e as Error).message);
    console.error("❌ Errore checklist:", e); // 👈 DEBUG
  } finally {
    setLoading(false);
  }
};

  return (
    <section className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Website Checklist</h1>

      <div className="flex gap-3">
        <input
          className="flex-1 border rounded px-3 py-2 bg-white/5"
          placeholder="https://www.example.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button
          onClick={handleRun}
          disabled={!url || loading}
          className="px-4 py-2 bg-indigo-600 text-white rounded disabled:opacity-40"
        >
          Avvia
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-gray-400">
          <Loader2 className="animate-spin" /> Analisi in corso…
        </div>
      )}

      {error && <p className="text-red-400">{error}</p>}

      {result && (
        <div className="grid sm:grid-cols-2 gap-4">
          {Object.entries(result.checks).map(([key, ok]) => (
            <div key={key} className="p-4 rounded bg-white/5 flex items-center gap-3">
              {ok ? (
                <CheckCircle2 className="text-green-400" />
              ) : (
                <XCircle className="text-red-400" />
              )}
              <span className="capitalize">{key}</span>
            </div>
          ))}

          <div className="sm:col-span-2 mt-4">
            <h2 className="font-semibold mb-2">Diagnosi IA</h2>
            <pre className="whitespace-pre-wrap bg-white/5 p-4 rounded text-sm">
              {result.aiSummary}
            </pre>
          </div>
        </div>
      )}
    </section>
  );
}