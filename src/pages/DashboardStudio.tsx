// src/pages/DashboardStudio.tsx
import React from "react";
import ChartCard, { ChartSpec } from "../components/ChartCard";
import { ChartType, parseChartTypeFromPrompt } from "../utils/chartType";

// Helpers periodi ----------------------------------------------------
function fmt(d: Date) {
  return d.toISOString().slice(0, 10);
}
function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}
function defaultRange(days: number) {
  const end = new Date();
  const start = daysAgo(days - 1);
  return { startDate: fmt(start), endDate: fmt(end) };
}

type PeriodKey = "7g" | "28g" | "90g" | "range";

const PERIODS: Record<Exclude<PeriodKey, "range">, number> = {
  "7g": 7,
  "28g": 28,
  "90g": 90,
};

// Tipo charts per stato locale (uguale al backend + data)
type LocalChart = ChartSpec & { data: any[] };

// Component ----------------------------------------------------------
export default function DashboardStudio() {
  // propertyId persistita (se presente) – puoi settarla altrove in app
  const [propertyId] = React.useState<string | null>(
    localStorage.getItem("ga4:propertyId") || null
  );

  const [prompt, setPrompt] = React.useState<string>("");
  const [period, setPeriod] = React.useState<PeriodKey>("28g");
  const [custom, setCustom] = React.useState<{ startDate: string; endDate: string }>(
    defaultRange(28)
  );

  // charts correnti
  const [charts, setCharts] = React.useState<LocalChart[]>([]);

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // range calcolato
  const range = React.useMemo(() => {
    if (period === "range") return custom;
    const days = PERIODS[period as Exclude<PeriodKey, "range">] ?? 28;
    return defaultRange(days);
  }, [period, custom]);

  React.useEffect(() => {
    document.title = "Dashboard Studio";
  }, []);

  // Normalizza charts: applica default type (dal prompt → altrimenti table)
  function normalizeChartsFromIntent(skeletons: ChartSpec[], promptText: string): LocalChart[] {
    const asked = parseChartTypeFromPrompt(promptText) ?? "table";
    return (skeletons ?? []).map((c, i) => ({
      id: c.id ?? `chart_${i}`,
      title: c.title ?? `Grafico ${i + 1}`,
      type: (c.type as ChartType) || asked,
      x: c.x ?? "date",
      y: c.y ?? "screenPageViews",
      y2: c.y2,
      data: [],
    }));
  }

  // run → chiede i dati al backend per ogni chart spec
  async function runChartsData(nextCharts: LocalChart[]) {
    try {
      const body = {
        propertyId: propertyId || undefined,
        startDate: range.startDate,
        endDate: range.endDate,
        charts: nextCharts.map(({ id, title, type, x, y, y2 }) => ({
          id, title, type, x, y, y2,
        })),
      };

      const res = await fetch("/api/studio/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "run failed");
      }

      const payload = await res.json();
      // ci aspettiamo { charts: [{ id, data: [...] }, ...] }
      const byId: Record<string, any[]> = {};
      for (const c of payload?.charts ?? []) {
        byId[c.id] = Array.isArray(c.data) ? c.data : [];
      }

      setCharts((prev) =>
        prev.map((c) => ({
          ...c,
          data: byId[c.id] ?? [],
        }))
      );
    } catch (err: any) {
      console.error("[studio/run] error:", err?.message || err);
      setError(err?.message || "Errore esecuzione /run");
    }
  }

  // ESEGUI: intent ⇒ normalize ⇒ run
  async function handleExecute() {
    try {
      setError(null);
      setLoading(true);

      // 1) INTENT: genera gli scheletri delle chart
      const res = await fetch("/api/studio/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "intent failed");
      }
      const data = await res.json();
      const skeletons = normalizeChartsFromIntent(data?.charts || [], prompt);

      if (!skeletons.length) {
        setCharts([]);
        setError("Nessuna chart: il prompt non ha generato specifiche.");
        setLoading(false);
        return;
      }

      setCharts(skeletons);

      // 2) RUN: popola i dati
      await runChartsData(skeletons);
    } catch (err: any) {
      setError(err?.message || "Errore inatteso");
    } finally {
      setLoading(false);
    }
  }

  function handleTypeChange(id: string, next: ChartType) {
    setCharts((prev) => prev.map((c) => (c.id === id ? { ...c, type: next } : c)));
  }

  // UI ----------------------------------------------------------------
  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <h1 className="text-2xl font-semibold">Dashboard Studio</h1>
        <div className="text-sm text-gray-500">
          Property:{" "}
          {propertyId ? (
            <span className="text-gray-700 font-medium">{propertyId}</span>
          ) : (
            <span className="italic">non impostata</span>
          )}
          <div className="text-xs">{period === "range" ? "Intervallo custom" : `Ultimi ${PERIODS[period as "7g" | "28g" | "90g"]} giorni`}</div>
        </div>
      </div>

      {/* Periodo */}
      <div className="flex items-center gap-2 mb-3">
        {(["7g", "28g", "90g"] as PeriodKey[]).map((k) => (
          <button
            key={k}
            onClick={() => setPeriod(k)}
            className={`px-3 py-1 rounded border text-sm ${
              period === k ? "bg-black text-white" : "bg-white text-gray-800"
            }`}
          >
            {k}
          </button>
        ))}
        <button
          onClick={() => setPeriod("range")}
          className={`px-3 py-1 rounded border text-sm ${
            period === "range" ? "bg-black text-white" : "bg-white text-gray-800"
          }`}
        >
          Range
        </button>
      </div>

      {/* Range custom */}
      {period === "range" && (
        <div className="flex items-center gap-2 mb-3">
          <input
            type="date"
            className="border rounded px-2 py-1"
            value={custom.startDate}
            onChange={(e) => setCustom((c) => ({ ...c, startDate: e.target.value }))}
          />
          <span className="text-gray-500">→</span>
          <input
            type="date"
            className="border rounded px-2 py-1"
            value={custom.endDate}
            onChange={(e) => setCustom((c) => ({ ...c, endDate: e.target.value }))}
          />
        </div>
      )}

      {/* Prompt */}
      <textarea
        className="w-full border rounded-md p-3 mb-3 min-h-[110px]"
        placeholder={`Es. "page view, eventi e channel group, ultimi 28 giorni" oppure "page view con grafico a torta"`}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />

      {/* CTA */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={handleExecute}
          disabled={loading}
          className="px-4 py-2 rounded bg-black text-white disabled:opacity-60"
        >
          {loading ? "Elaboro..." : "Esegui"}
        </button>
        {!propertyId && (
          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded">
            Imposta una GA4 property per ricevere dati reali (localStorage key <code>ga4:propertyId</code>).
          </div>
        )}
      </div>

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3 mb-4">
          {error}
        </div>
      )}

      {/* Risultati */}
      {charts.length === 0 ? (
        <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-3">
          Nessuna chart. Scrivi cosa vuoi vedere e clicca <strong>Esegui</strong>.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {charts.map((c) => (
            <ChartCard key={c.id} spec={c} onTypeChange={handleTypeChange} />
          ))}
        </div>
      )}
    </div>
  );
}
