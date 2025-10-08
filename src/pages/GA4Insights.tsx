import React from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar } from "recharts";

type Resp = {
  range: { startDate: string; endDate: string };
  kpis: Record<string, number>;
  timeseries: { date: string; activeUsers: number; sessions: number; pageViews: number }[];
  channels: { channel: string; sessions: number; users: number; conversions: number }[];
  pages: { path: string; pageViews: number; users: number; conversions: number }[];
  ai: { narrative: string };
};

export default function GA4Insights() {
  const today = new Date().toISOString().slice(0, 10);
  const startDef = new Date(Date.now() - 27 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  const [startDate, setStart] = React.useState(startDef);
  const [endDate, setEnd] = React.useState(today);
  const [prompt, setPrompt] = React.useState(
    "Concentrati su utenti attivi, sessioni, pageviews, canali e pagine con impatto sulle conversioni."
  );
  const [data, setData] = React.useState<Resp | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [phase, setPhase] = React.useState<"idle" | "ga4" | "ai">("idle");
  const [err, setErr] = React.useState<string | null>(null);

  const valid = new Date(startDate) <= new Date(endDate);

  async function load(params?: { auto?: boolean }) {
    if (!valid) {
      setErr("La data di inizio deve essere ≤ della data di fine.");
      return;
    }
    setLoading(true);
    setErr(null);
    setPhase("ga4");
    try {
      // Unica chiamata: GA4 + IA lato server
      // (la fase "ai" è solo informativa lato FE)
      const p = new Promise<Resp>(async (resolve, reject) => {
        try {
          const r = await fetch("/api/ga4/insights", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ startDate, endDate, prompt }),
          });
          setPhase("ai");
          if (!r.ok) {
            const t = await r.text();
            throw new Error(t || "Errore risposta server");
          }
          resolve(await r.json());
        } catch (e) {
          reject(e);
        }
      });

      const resp = await p;
      setData(resp);
    } catch (e: any) {
      setErr(e?.message || "Errore durante il recupero degli insight.");
    } finally {
      setPhase("idle");
      setLoading(false);
    }
  }

  // Auto-load all'apertura pagina
  React.useEffect(() => {
    load({ auto: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setQuick(days: number) {
    const end = new Date();
    const start = new Date(Date.now() - (days - 1) * 24 * 3600 * 1000);
    setStart(start.toISOString().slice(0, 10));
    setEnd(end.toISOString().slice(0, 10));
  }

  return (
    <div className="p-6 space-y-6 relative">
      {/* Overlay loader */}
      {loading && (
        <div className="absolute inset-0 bg-white/70 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mb-4" />
          <div className="text-gray-800 font-medium">
            {phase === "ga4" && "Recupero informazioni GA4…"}
            {phase === "ai" && "Generazione insight con IA…"}
            {phase === "idle" && "Elaborazione…"}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex gap-3 items-end flex-wrap">
        <div>
          <label className="block text-sm mb-1">Inizio</label>
          <input
            type="date"
            className="border rounded-xl px-3 py-2"
            value={startDate}
            max={endDate}
            onChange={(e) => setStart(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Fine</label>
          <input
            type="date"
            className="border rounded-xl px-3 py-2"
            value={endDate}
            min={startDate}
            max={today}
            onChange={(e) => setEnd(e.target.value)}
          />
        </div>
        <button
          onClick={() => load()}
          disabled={loading || !valid}
          className="px-4 py-2 rounded-2xl bg-black text-white"
        >
          {loading ? "Elaboro…" : "Rigenera insight"}
        </button>

        <div className="flex gap-2 ml-auto">
          <button className="px-3 py-2 border rounded-2xl" onClick={() => setQuick(7)}>
            7g
          </button>
          <button className="px-3 py-2 border rounded-2xl" onClick={() => setQuick(28)}>
            28g
          </button>
          <button className="px-3 py-2 border rounded-2xl" onClick={() => setQuick(90)}>
            90g
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm mb-1">Prompt IA</label>
        <textarea
          className="w-full border rounded-2xl p-3"
          rows={3}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
      </div>

      {err && (
        <div className="border border-red-200 bg-red-50 text-red-700 p-3 rounded-xl">{err}</div>
      )}

      {data && (
        <>
          {/* KPI */}
          <div className="grid md:grid-cols-5 sm:grid-cols-2 gap-4">
            {["activeUsers", "sessions", "screenPageViews", "conversions", "totalRevenue"].map(
              (k) => (
                <div key={k} className="border rounded-2xl p-4 shadow-sm">
                  <div className="text-sm text-gray-500">{k}</div>
                  <div className="text-2xl font-semibold">
                    {Number(data.kpis?.[k] ?? 0).toLocaleString()}
                  </div>
                </div>
              )
            )}
          </div>

          {/* Timeseries */}
          <div className="border rounded-2xl p-4 shadow-sm">
            <div className="mb-2 font-semibold">Andamento</div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.timeseries}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="activeUsers" />
                  <Line type="monotone" dataKey="sessions" />
                  <Line type="monotone" dataKey="pageViews" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Channels */}
          <div className="border rounded-2xl p-4 shadow-sm">
            <div className="mb-2 font-semibold">Top canali (sessioni)</div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.channels}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="channel" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="sessions" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Pages */}
          <div className="border rounded-2xl p-4 shadow-sm">
            <div className="mb-2 font-semibold">Top pagine (pageviews)</div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.pages}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="path" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="pageViews" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* IA */}
          <div className="border rounded-2xl p-4 shadow-sm prose max-w-none">
            <h3>Insight dell’IA</h3>
            <p className="text-sm text-gray-500">
              Periodo: {data.range.startDate} → {data.range.endDate}
            </p>
            <div className="whitespace-pre-wrap">{data.ai.narrative}</div>
          </div>
        </>
      )}
    </div>
  );
}
