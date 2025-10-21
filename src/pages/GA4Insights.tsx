// src/pages/GA4Chat.tsx
import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function GA4Chat() {
  const [query, setQuery] = React.useState("Traffico dalla Cina 1-14 settembre: bounce rate, session duration e pages/session");
  const [loading, setLoading] = React.useState(false);
  const [steps, setSteps] = React.useState<string[]>([]);
  const [narrative, setNarrative] = React.useState("");
  const [range, setRange] = React.useState<{startDate:string;endDate:string} | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function ask() {
    setLoading(true);
    setSteps([]);
    setError(null);
    setNarrative("");
    setRange(null);

    try {
      const res = await fetch("/api/ga4/chat", {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ query })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Errore");

      setSteps(json?.debug?.steps || []);
      setRange(json.range);
      setNarrative(json?.ai?.narrative || "");
    } catch(e:any) {
      setError(e?.message || "Errore richiesta");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">GA4 Chat Insight</h1>
      <div className="rounded-xl border bg-white p-4 space-y-3">
        <textarea
          className="w-full border rounded-lg p-3"
          rows={3}
          value={query}
          onChange={(e)=>setQuery(e.target.value)}
          placeholder='Es: "Purchase ultimi 7 giorni, dammi KPI e insight"'
        />
        <button
          onClick={ask}
          disabled={loading}
          className="px-4 py-2 bg-black text-white rounded-lg"
        >
          {loading ? "Analisi in corso..." : "Chiedi"}
        </button>
      </div>

      {/* Stepper */}
      <div className="rounded-xl border bg-white p-4">
        <h3 className="font-medium mb-2">Processo</h3>
        <ol className="space-y-2 text-sm">
          {steps.length === 0 && <li className="text-gray-500">In attesa di una richiesta…</li>}
          {steps.map((s,i)=>(
            <li key={i} className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-green-500"></span>
              {s}
            </li>
          ))}
        </ol>
      </div>

      {/* Output */}
      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-700">{error}</div>}

      {narrative && (
        <div className="rounded-xl border bg-white p-6">
          {range && (
            <p className="text-sm text-gray-500 mb-3">
              Periodo: {range.startDate} → {range.endDate}
            </p>
          )}
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {narrative}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
