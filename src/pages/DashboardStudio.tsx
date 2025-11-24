import React from "react";
import ChartCard, { ChartSpec, ChartType } from "../components/ChartCard";
import { Share2 } from "lucide-react";
import { useGa4Property } from "../context/Ga4PropertyContext";
import { useStudioRunner, StudioFilters } from "../hooks/useStudioRunner";
import { toast } from "react-hot-toast";

// helpers periodo
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

// intent parsing (it)
const METRIC_ALIASES: Record<string, { key: string; title: string }> = {
  pageview: { key: "screenPageViews", title: "Pageviews" },
  "page view": { key: "screenPageViews", title: "Pageviews" },
  pageviews: { key: "screenPageViews", title: "Pageviews" },
  sessioni: { key: "sessions", title: "Sessions" },
  utenti: { key: "totalUsers", title: "Users" },
  eventi: { key: "eventCount", title: "Events" },
};

function parseItalianIntent(prompt: string): {
  metricKey: string;
  metricTitle: string;
  days?: number;
  charts: ChartSpec[];
} {
  const p = (prompt || "").toLowerCase();

  // metric
  let metricKey = "screenPageViews";
  let metricTitle = "Pageviews";
  for (const [alias, m] of Object.entries(METRIC_ALIASES)) {
    if (p.includes(alias)) {
      metricKey = m.key;
      metricTitle = m.title;
      break;
    }
  }

  // time: "ultimi 7 gg" | "ultimi X giorni"
  const m = p.match(/ultim[oi] (\d{1,3}) ?(gg|giorni)/);
  const days = m ? Number(m[1]) : undefined;

  const charts: ChartSpec[] = [
    {
      id: `big_${metricKey}`,
      title: `Totale ${metricTitle}`,
      type: "big_number",
      x: "date",
      y: metricKey,
    },
    {
      id: `trend_${metricKey}`,
      title: `${metricTitle} Over Time`,
      type: "line",
      x: "date",
      y: metricKey,
    },
  ];
  return { metricKey, metricTitle, days, charts };
}

// types
type PeriodKey = "7g" | "28g" | "90g" | "range";
const PERIODS: Record<Exclude<PeriodKey, "range">, number> = {
  "7g": 7,
  "28g": 28,
  "90g": 90,
};
type LocalChart = Required<ChartSpec>;
type ShareState = {
  open: boolean;
  creating: boolean;
  url?: string | null;
  error?: string | null;
};

export default function DashboardStudio(): JSX.Element {
  const { propertyId } = useGa4Property();
  const { runDashboard, loading, error } = useStudioRunner(propertyId);

  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [prompt, setPrompt] = React.useState("");
  const [copyOk, setCopyOk] = React.useState(false);
  const [period, setPeriod] = React.useState<PeriodKey>("28g");
  const [custom, setCustom] = React.useState(defaultRange(28));
  const [charts, setCharts] = React.useState<LocalChart[]>([]);
  const [share, setShare] = React.useState<ShareState>({
    open: false,
    creating: false,
    url: null,
    error: null,
  });

  const range = React.useMemo(
    () => (period === "range" ? custom : defaultRange(PERIODS[period])),
    [period, custom]
  );

  const filters: StudioFilters = React.useMemo(
    () => ({
      startDate: range.startDate,
      endDate: range.endDate,
      granularity: "daily",
      compareToPrev: false,
    }),
    [range.startDate, range.endDate]
  );

  const SUGGESTIONS = [
    "page view degli ultimi 7 gg",
    "kpi: users, sessions, conversion rate",
    "canali di traffico e relative performance",
  ];

  // EXECUTE
  async function handleExecute() {
    try {
      const parsed = parseItalianIntent(prompt);
      if (parsed.days) {
        const d = Math.max(1, Math.min(365, parsed.days));
        const r = defaultRange(d);
        setPeriod("range");
        setCustom(r);
      }

      const res = await runDashboard({ prompt, filters });
      setCharts(
        res.charts.map((c, i) => ({
          ...c,
          id: c.id || `chart_${i}`,
          title: c.title || `Grafico ${i + 1}`,
          type: (c.type as ChartType) || "table",
          x: c.x || "date",
          y: c.y || "screenPageViews",
          y2: (c.y2 ?? "") as string,
        }))
      );
    } catch (e: any) {
      toast.error(e?.message || "Errore esecuzione");
    }
  }

  function handleTypeChange(id: string, next: ChartType) {
    setCharts((prev) =>
      prev.map((c) => (c.id === id ? { ...c, type: next } : c))
    );
  }

  async function handlePublish() {
    setShare((s) => ({ ...s, creating: true, error: null }));
    try {
      const res = await fetch("/api/studio/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          propertyId,
          startDate: range.startDate,
          endDate: range.endDate,
          charts: charts.map(({ id, title, type, x, y, y2 }) => ({
            id,
            title,
            type,
            x,
            y,
            y2,
          })),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { url } = await res.json();
      setShare({ open: true, creating: false, url: url || null, error: null });
      setCopyOk(false);
    } catch (e: any) {
      setShare({
        open: true,
        creating: false,
        url: null,
        error: e?.message || "Errore",
      });
    }
  }

  return (
    <section className="max-w-7xl mx-auto px-4 py-8">
      {error && <div className="mb-3 text-sm text-red-600">Errore: {error}</div>}
      {/* Section header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0 bg-gradient-to-br from-amber-200 to-amber-400 rounded-lg p-3 shadow">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M12 2l1.8 4.6L18 8l-4 2.6L14 16l-2-3.4L10 16l.2-5.4L6 8l4.2-1.4L12 2z" fill="#fff" opacity="0.95" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Dashboard Studio</h1>
            <p className="text-sm text-gray-600 mt-1">Genera dashboard leggibili e condivisibili a partire da un prompt in linguaggio naturale.</p>
          </div>
        </div>
        <div className="hidden sm:flex items-center text-sm text-gray-600">{propertyId ? `Property: ${propertyId}` : "Nessuna property selezionata"}</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT - sticky controls */}
        <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-6">
          <div className="bg-white border rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-slate-700">Controlli</div>
                <div className="text-xs text-gray-500">Configura titolo, descrizione e prompt per generare la dashboard</div>
              </div>
              <div className="text-xs text-gray-400">Smart • AI</div>
            </div>
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Titolo</label>
                <input aria-label="Titolo dashboard" className="w-full border rounded px-3 py-2 shadow-sm" placeholder="Titolo dashboard" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Descrizione (opz.)</label>
                <input aria-label="Descrizione" className="w-full border rounded px-3 py-2 shadow-sm" placeholder="Breve descrizione" value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Prompt</label>
                <textarea aria-label="Prompt" className="w-full border rounded p-3 min-h-[120px] shadow-sm text-sm" placeholder='Es. "page view ultimi 7 gg" oppure "kpi, canali, eventi"' value={prompt} onChange={(e) => setPrompt(e.target.value)} />
                <div className="mt-2 flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => setPrompt(s)} className="text-xs px-2 py-1 rounded-full border bg-white hover:bg-slate-50 shadow-sm">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t flex items-center gap-3 justify-between">
              <div className="flex items-center gap-2">
                <div className="text-sm text-gray-600">Periodo</div>
              </div>
              <div className="flex items-center gap-2">
                {(["7g", "28g", "90g"] as PeriodKey[]).map((k) => (
                  <button key={k} onClick={() => setPeriod(k)} aria-pressed={period === k} className={`px-3 py-1 rounded border text-sm transition ${period === k ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700"}`}>
                    {k}
                  </button>
                ))}
                <button onClick={() => setPeriod("range")} aria-pressed={period === "range"} className={`px-3 py-1 rounded border text-sm transition ${period === "range" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700"}`}>
                  Range
                </button>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <button onClick={handleExecute} disabled={loading} className="flex-1 px-4 py-2 rounded bg-slate-900 text-white shadow hover:opacity-95 disabled:opacity-50">
                {loading ? "Elaboro…" : "Genera con AI"}
              </button>
              {!!charts.length && (
                <button onClick={() => setShare({ open: true, creating: false, url: null, error: null })} className="px-3 py-2 rounded border flex items-center gap-2">
                  <Share2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* help / tips box */}
          <div className="hidden md:block mt-4 bg-gradient-to-br from-slate-50 to-white border rounded-xl p-3 text-sm text-gray-600">
            Suggerimento: prova prompt come <span className="font-medium">"page view ultimi 7 gg"</span> o <span className="font-medium">"kpi: users, sessions"</span>
          </div>
        </div>

        {/* RIGHT - preview */}
        <div className="lg:col-span-7">
          <div className="bg-white border rounded-xl p-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold">Anteprima della dashboard</div>
                {(title || description) && (
                  <div className="mt-2">
                    {title && <div className="text-lg font-semibold leading-tight">{title}</div>}
                    {description && <div className="text-sm text-gray-600">{description}</div>}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button title="Condividi" onClick={() => setShare({ open: true, creating: false, url: null, error: null })} disabled={!charts.length} className="px-3 py-1.5 rounded bg-slate-900 text-white disabled:opacity-60 flex items-center gap-2">
                  <Share2 className="w-4 h-4" /> Pubblica
                </button>
              </div>
            </div>

            <div className="mt-4">
              {charts.length ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {charts.map((c) => (
                    <div key={c.id} className={`${c.type === "big_number" ? "md:col-span-2" : ""}`}>
                      <ChartCard key={c.id} spec={c as LocalChart} onTypeChange={handleTypeChange} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-4 py-16">
                  <svg width="120" height="80" viewBox="0 0 120 80" fill="none" aria-hidden>
                    <rect x="8" y="24" width="56" height="40" rx="6" fill="#f8fafc" stroke="#e6e7eb" />
                    <rect x="64" y="8" width="48" height="56" rx="6" fill="#fff7ed" stroke="#fde3c6" />
                    <circle cx="90" cy="36" r="6" fill="#f97316" />
                  </svg>
                  <div className="text-lg font-medium">Nessuna visualizzazione</div>
                  <div className="text-sm text-gray-600">Inserisci un prompt per generare automaticamente una dashboard con grafici e KPI.</div>
                  <div className="mt-4 flex gap-2">
                    <button onClick={handleExecute} disabled={loading} className="px-4 py-2 rounded bg-slate-900 text-white">Genera con AI</button>
                    <button onClick={() => setPrompt(SUGGESTIONS[0])} className="px-3 py-2 rounded border">Prova un esempio</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SHARE MODAL */}
      {share.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShare({ open: false, creating: false, url: null, error: null })} />
          <div className="relative bg-white rounded-xl shadow-xl w-[560px] max-w-[92vw] p-6">
            <button aria-label="Chiudi" onClick={() => setShare({ open: false, creating: false, url: null, error: null })} className="absolute right-3 top-3 text-gray-500 hover:text-gray-700">×</button>
            <div className="text-xl font-semibold mb-2">Condividi la dashboard</div>
            <p className="text-sm text-gray-600 mb-4">
              Condividi una versione di sola lettura della dashboard. I visitatori non potranno modificare la dashboard né interagire con l'agente AI.
            </p>
            {share.url ? (
              <div>
                <div className="rounded border bg-gray-50 p-3 text-sm break-all">{share.url}</div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={async () => {
                      try {
                        await navigator.clipboard?.writeText(share.url!);
                        setCopyOk(true);
                        setTimeout(() => setCopyOk(false), 2000);
                      } catch {}
                    }}
                    className="px-3 py-2 rounded border"
                  >
                    {copyOk ? "Copiato!" : "Copia link"}
                  </button>
                  <a href={share.url!} target="_blank" rel="noreferrer" className="px-3 py-2 rounded bg-slate-900 text-white">
                    Apri
                  </a>
                </div>
              </div>
            ) : (
              <button onClick={handlePublish} disabled={share.creating || !charts.length} className="w-full py-3 rounded bg-[#f97316] text-white disabled:opacity-60">
                {share.creating ? "Creo il link…" : "Crea link di condivisione"}
              </button>
            )}
            {share.error && <div className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">{share.error}</div>}
          </div>
        </div>
      )}
    </section>
  );
}
