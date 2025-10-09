import React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  AreaChart,
  Area,
  Cell,
} from "recharts";
import { Users, MousePointerClick, TrendingUp, ShoppingCart, Crown, Sparkles } from "lucide-react";

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
  const kpis = data?.kpis ?? {};
  const channels = React.useMemo(() => data?.channels ?? [], [data]);
  const pages = React.useMemo(() => data?.pages ?? [], [data]);
  const timeseries = React.useMemo(() => data?.timeseries ?? [], [data]);
  const conversionRate = React.useMemo(() => {
    const sessions = Number(kpis.sessions ?? 0);
    const conversions = Number(kpis.conversions ?? 0);
    if (!sessions) return 0;
    return Number(((conversions / sessions) * 100).toFixed(1));
  }, [kpis]);

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
    <div className="min-h-screen bg-gradient-to-br from-[#f1ecff] via-[#ffeef8] to-white px-6 py-10">
      <div className="mx-auto max-w-6xl space-y-8 relative">
      {/* Overlay loader */}
      {loading && (
        <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center rounded-3xl shadow-lg">
          <div className="animate-spin rounded-full h-14 w-14 border-y-2 border-purple-500 mb-4" />
          <div className="text-gray-900 font-medium">
            {phase === "ga4" && "Recupero informazioni GA4…"}
            {phase === "ai" && "Generazione insight con IA…"}
            {phase === "idle" && "Preparazione dashboard…"}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="rounded-3xl bg-white/80 shadow-xl border border-white/40 ring-1 ring-purple-100/40 p-6 backdrop-blur">
        <div className="flex flex-col md:flex-row md:items-end gap-5">
          <div className="flex flex-1 gap-4 flex-wrap">
            <div className="flex-1 min-w-[160px]">
              <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 mb-2">
                Inizio
              </label>
              <input
                type="date"
                className="w-full rounded-2xl border border-purple-100 bg-purple-50/40 px-4 py-3 text-gray-900 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-200"
                value={startDate}
                max={endDate}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 mb-2">
                Fine
              </label>
              <input
                type="date"
                className="w-full rounded-2xl border border-purple-100 bg-purple-50/40 px-4 py-3 text-gray-900 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-200"
                value={endDate}
                min={startDate}
                max={today}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-3 md:ml-auto">
            <div className="flex gap-2">
              {[7, 28, 90].map((day) => (
                <button
                  key={day}
                  className="rounded-full border border-purple-200 bg-white px-4 py-2 text-sm font-medium text-purple-600 transition hover:-translate-y-0.5 hover:shadow-xl"
                  onClick={() => setQuick(day)}
                >
                  {day}g
                </button>
              ))}
            </div>
            <button
              onClick={() => load()}
              disabled={loading || !valid}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-purple-600 via-purple-500 to-fuchsia-500 px-5 py-3 text-sm font-semibold text-white shadow-lg ring-1 ring-purple-300/40 transition hover:from-purple-500 hover:to-fuchsia-400 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <Sparkles className="h-4 w-4" />
              {loading ? "Elaboro…" : "Rigenera insight"}
            </button>
          </div>
        </div>
        <div className="mt-6">
          <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 mb-2">
            Prompt IA
          </label>
          <textarea
            className="w-full rounded-3xl border border-purple-100 bg-purple-50/60 p-4 text-gray-900 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-200"
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
        </div>
      </div>

      {err && (
        <div className="rounded-2xl border border-red-100 bg-red-50/80 p-4 text-sm text-red-700 shadow-sm">
          {err}
        </div>
      )}

      {data && (
        <div className="space-y-8 pb-12">
          {/* KPI */}
          <div className="grid gap-5 md:grid-cols-3 xl:grid-cols-5">
            {[
              {
                key: "activeUsers",
                label: "Utenti attivi",
                icon: Users,
                gradient: "from-sky-500/20 via-sky-400/10 to-blue-500/20",
                accent: "text-sky-600",
              },
              {
                key: "sessions",
                label: "Sessioni",
                icon: MousePointerClick,
                gradient: "from-indigo-500/20 via-indigo-400/10 to-purple-500/20",
                accent: "text-indigo-600",
              },
              {
                key: "screenPageViews",
                label: "Pageviews",
                icon: TrendingUp,
                gradient: "from-purple-500/20 via-purple-400/10 to-fuchsia-500/20",
                accent: "text-purple-600",
              },
              {
                key: "conversions",
                label: "Conversioni",
                icon: ShoppingCart,
                gradient: "from-pink-500/20 via-pink-400/10 to-rose-500/20",
                accent: "text-pink-600",
              },
              {
                key: "totalRevenue",
                label: "Revenue",
                icon: Crown,
                gradient: "from-amber-400/25 via-orange-300/10 to-yellow-400/25",
                accent: "text-amber-600",
              },
            ].map(({ key, label, icon: Icon, gradient, accent }) => (
              <div key={key} className="group relative overflow-hidden rounded-3xl border border-white/60 bg-white/80 p-6 shadow-lg ring-1 ring-purple-100/40 backdrop-blur transition hover:-translate-y-1 hover:shadow-2xl">
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-70 transition group-hover:opacity-90`}
                />
                <div className="relative flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-600/90">
                      {label}
                    </p>
                    <p className={`mt-3 text-3xl font-bold ${accent}`}>
                      {Number(kpis?.[key] ?? 0).toLocaleString("it-IT")}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white/70 p-3 shadow-sm backdrop-blur">
                    <Icon className="h-5 w-5 text-gray-600" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Timeseries & Highlights */}
          <div className="grid gap-6 lg:grid-cols-5">
            <div className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-lg ring-1 ring-purple-100/40 backdrop-blur lg:col-span-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-purple-500" />
                  Andamento utenza
                </h3>
                <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-medium text-purple-700">
                  {data.range.startDate} → {data.range.endDate}
                </span>
              </div>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={timeseries}>
                    <defs>
                      <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#818cf8" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorSessions" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f472b6" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#f472b6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorPageViews" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#34d399" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#ede9fe" strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{ borderRadius: 16, borderColor: "#ede9fe", boxShadow: "0 12px 30px rgba(139, 92, 246, 0.15)" }}
                    />
                    <Legend iconType="circle" />
                    <Area type="monotone" dataKey="activeUsers" stroke="#6366f1" strokeWidth={2.5} fill="url(#colorUsers)" />
                    <Area type="monotone" dataKey="sessions" stroke="#ec4899" strokeWidth={2.5} fill="url(#colorSessions)" />
                    <Area type="monotone" dataKey="pageViews" stroke="#10b981" strokeWidth={2.5} fill="url(#colorPageViews)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-lg ring-1 ring-purple-100/40 backdrop-blur lg:col-span-2">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-rose-500" />
                Insight lampo
              </h3>
              <div className="space-y-4 text-sm text-gray-700">
                <div className="rounded-2xl border border-rose-100 bg-rose-50/70 px-4 py-3">
                  <p className="text-xs uppercase font-semibold text-rose-500 tracking-wide mb-1">
                    Tasso conversione
                  </p>
                  <p className="text-lg font-semibold text-rose-600">
                    {conversionRate}%
                  </p>
                  <p className="text-xs text-rose-600/70">
                    Conversioni per sessione nel periodo selezionato.
                  </p>
                </div>
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3">
                  <p className="text-xs uppercase font-semibold text-emerald-500 tracking-wide mb-1">
                    Pagine più coinvolgenti
                  </p>
                  <p className="font-semibold text-emerald-600">
                    {pages.slice(0, 2).map((p) => p.path || "—").join(" • ")}
                  </p>
                  <p className="text-xs text-emerald-600/70">
                    Tra le prime {Math.min(2, pages.length)} per visualizzazioni.
                  </p>
                </div>
                <div className="rounded-2xl border border-sky-100 bg-sky-50/70 px-4 py-3">
                  <p className="text-xs uppercase font-semibold text-sky-500 tracking-wide mb-1">
                    Canale dominante
                  </p>
                  <p className="font-semibold text-sky-600">
                    {channels[0]?.channel ?? "—"} ({Number(channels[0]?.sessions ?? 0).toLocaleString("it-IT")} sessioni)
                  </p>
                  <p className="text-xs text-sky-600/70">
                    Confronta il contributo con le campagne attive.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Channels & Pages */}
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-lg ring-1 ring-purple-100/40 backdrop-blur">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Top canali per sessioni</h3>
                <span className="text-xs font-semibold uppercase text-gray-400">Top 10</span>
              </div>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={channels.slice(0, 10)} layout="vertical" barCategoryGap="20%">
                    <CartesianGrid stroke="#ede9fe" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis dataKey="channel" type="category" tick={{ fontSize: 12 }} width={120} />
                    <Tooltip
                      cursor={{ fill: "#f5f3ff" }}
                      contentStyle={{ borderRadius: 14, borderColor: "#ede9fe", boxShadow: "0 12px 24px rgba(129, 140, 248, 0.15)" }}
                    />
                    <Bar dataKey="sessions" radius={[12, 12, 12, 12]}>
                      {channels.slice(0, 10).map((_, idx) => (
                        <Cell
                          key={`cell-${idx}`}
                          fill={idx === 0 ? "#6366f1" : idx === 1 ? "#ec4899" : idx === 2 ? "#14b8a6" : "#a855f7"}
                          opacity={0.85 - idx * 0.05}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-lg ring-1 ring-purple-100/40 backdrop-blur">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Top pagine per pageviews</h3>
                <span className="text-xs font-semibold uppercase text-gray-400">Top 10</span>
              </div>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pages.slice(0, 10)} layout="vertical" barCategoryGap="18%">
                    <CartesianGrid stroke="#ede9fe" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis dataKey="path" type="category" tick={{ fontSize: 12 }} width={150} />
                    <Tooltip
                      cursor={{ fill: "#fef3c7" }}
                      contentStyle={{ borderRadius: 14, borderColor: "#fde68a", boxShadow: "0 12px 24px rgba(251, 191, 36, 0.18)" }}
                    />
                    <Bar dataKey="pageViews" radius={[12, 12, 12, 12]}>
                      {pages.slice(0, 10).map((_, idx) => (
                        <Cell
                          key={`page-cell-${idx}`}
                          fill={idx === 0 ? "#f59e0b" : idx === 1 ? "#f97316" : idx === 2 ? "#fb7185" : "#fbbf24"}
                          opacity={0.9 - idx * 0.05}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* IA */}
          <div className="rounded-3xl border border-white/60 bg-white/90 p-8 shadow-xl ring-1 ring-purple-100/40 backdrop-blur max-w-none">
            <div className="flex items-start gap-4 mb-4">
              <div className="rounded-2xl bg-gradient-to-br from-purple-500 via-fuchsia-500 to-rose-500 p-3 text-white shadow-lg">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900">Insight generati dall’IA</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Periodo analizzato: {data.range.startDate} → {data.range.endDate}
                </p>
              </div>
            </div>
            <div className="rounded-3xl border border-purple-100 bg-gradient-to-br from-purple-50/90 via-white to-blue-50/70 p-6 text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
              {data.ai.narrative}
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
