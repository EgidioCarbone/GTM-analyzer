import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, ArrowLeft } from "lucide-react";
import ChartCard from "../components/ChartCard";
import { useDashboardStore } from "../context/DashboardStoreContext";
import { useStudioRunner } from "../hooks/useStudioRunner";
import { useGa4Property } from "../context/Ga4PropertyContext";
import { toast } from "react-hot-toast";

function presetRange(key: "last_28_days" | "last_3_months") {
  const end = new Date();
  const start = new Date();
  if (key === "last_28_days") start.setDate(end.getDate() - 27);
  if (key === "last_3_months") start.setMonth(end.getMonth() - 3);
  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
}

export default function DashboardBuilder() {
  const location = useLocation();
  const navigate = useNavigate();
  const { propertyId } = useGa4Property();
  const { dashboards, activeId, setActiveDashboard, upsertDashboard, filters, setFilters } = useDashboardStore();
  const { runDashboard, loading } = useStudioRunner(propertyId);
  const [selectedChartId, setSelectedChartId] = useState<string | null>(null);
  const [sidebarPrompt, setSidebarPrompt] = useState("");
  const runKeyRef = useRef<string | null>(null);
  const [movingChartId, setMovingChartId] = useState<string | null>(null);
  const [fullscreenChartId, setFullscreenChartId] = useState<string | null>(null);
  const [capturedChartId, setCapturedChartId] = useState<string | null>(null);
  const dash = useMemo(() => dashboards.find((d) => d.id === activeId) || dashboards[0], [dashboards, activeId]);

  const gridColsClass = useMemo(() => {
    const count = dash?.charts?.length || 0;
    if (count <= 1) return "grid-cols-1";
    if (count === 2) return "grid-cols-1 md:grid-cols-2";
    return "grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4";
  }, [dash?.charts?.length]);

  const processedNavRef = useRef<string | null>(null);
  useEffect(() => {
    const state = location.state as any;
    if (state?.dashboardId && state?.charts) {
      if (processedNavRef.current === state.dashboardId) return;
      processedNavRef.current = state.dashboardId;
      upsertDashboard({
        id: state.dashboardId,
        title: state.prompt || "Dashboard",
        charts: state.charts,
        filters: state.filters,
        sourceName: "Demo Site",
      });
      setActiveDashboard(state.dashboardId);
      setSelectedChartId(state.charts?.[0]?.id ?? null);
    }
  }, [location.state, upsertDashboard, setActiveDashboard]);

  useEffect(() => {
    if (!dash || !propertyId) return;
    const key = `${propertyId}|${dash.id}|${filters.startDate}|${filters.endDate}|${filters.granularity}`;
    if (runKeyRef.current === key) return;
    runKeyRef.current = key;
    console.log("[builder] fetching charts", { propertyId, dashId: dash.id, filters, count: dash.charts.length });
    runDashboard({ prompt: dash.title, filters, charts: dash.charts })
      .then((res) => upsertDashboard({ ...dash, charts: res.charts, filters }))
      .catch((err) => {
        console.error("[builder] runDashboard error", err);
      });
    // NOTE: dipendenze ridotte per evitare loop di richieste; usiamo id e filtri
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dash?.id, filters.startDate, filters.endDate, filters.granularity, propertyId]);

  async function handleSendPrompt(promptText: string) {
    if (!promptText.trim()) {
      toast.error("Scrivi una richiesta");
      return;
    }
    if (!propertyId) {
      toast.error("Imposta una GA4 property ID");
      return;
    }
    if (!dash) return;
    try {
      const res = await runDashboard({ prompt: promptText, filters });
      const merged = [...dash.charts, ...res.charts];
      upsertDashboard({ ...dash, charts: merged });
      setSelectedChartId(res.charts[0]?.id ?? merged[0]?.id ?? null);
      setSidebarPrompt("");
      toast.success("Grafico aggiunto");
    } catch (e: any) {
      toast.error(e?.message || "Errore durante la generazione");
    }
  }

  function handlePublish() {
    if (!dash) return;
    const slug = dash.publicSlug || dash.id;
    upsertDashboard({ ...dash, isPublic: true, publicSlug: slug });
    navigate(`/dashboards/${slug}/public`);
  }

  if (!dash) return <div className="p-6">Nessuna dashboard</div>;

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar
        dashboardTitle={dash.title}
        charts={dash.charts}
        selectedChartId={selectedChartId}
        onSelectChart={setSelectedChartId}
        prompt={sidebarPrompt}
        onChangePrompt={setSidebarPrompt}
        onSendPrompt={() => handleSendPrompt(sidebarPrompt)}
      />

      <main className="flex-1 overflow-auto p-6 space-y-4">
        <Breadcrumb title={dash.title} onBack={() => navigate("/dashboard-studio")} sourceName={dash.sourceName} />
        <FilterBar
          filters={filters}
          onChangeRange={(r) => setFilters({ ...filters, ...r })}
          onChangeGranularity={(g) => setFilters({ ...filters, granularity: g })}
          onPublish={handlePublish}
        />

        <div className={`grid gap-4 ${gridColsClass}`}>
          {dash.charts.map((c) => (
            <ChartPanel
              key={c.id}
              title={c.title}
              selected={c.id === selectedChartId}
              onSelect={() => setSelectedChartId(c.id)}
            >
              <ChartCard
                spec={c as any}
                onTypeChange={(id, next) => {
                  const updated = dash.charts.map((chart) =>
                    chart.id === id ? { ...chart, type: next } : chart
                  );
                  upsertDashboard({ ...dash, charts: updated });
                }}
                onTitleChange={(id, title) => {
                  const updated = dash.charts.map((chart) =>
                    chart.id === id ? { ...chart, title } : chart
                  );
                  upsertDashboard({ ...dash, charts: updated });
                }}
                onMove={(id) => setMovingChartId((prev) => (prev === id ? null : id))}
                onFullscreen={(id) => setFullscreenChartId(id)}
                onScreenshot={(id) => {
                  setCapturedChartId(id);
                  setTimeout(() => setCapturedChartId((prev) => (prev === id ? null : prev)), 1200);
                }}
                onRemove={(id) =>
                  upsertDashboard({ ...dash, charts: dash.charts.filter((x) => x.id !== id) })
                }
                isCaptured={capturedChartId === c.id}
              />
            </ChartPanel>
          ))}
        </div>
        {fullscreenChartId && (
          <div className="fixed inset-0 z-[13000] bg-black/60 flex items-center justify-center p-6">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-auto relative">
              <button
                className="absolute top-3 right-3 p-2 rounded-full bg-black text-white"
                onClick={() => setFullscreenChartId(null)}
              >
                Close
              </button>
              <div className="p-4">
                <ChartCard
                  spec={dash.charts.find((c) => c.id === fullscreenChartId) as any}
                  onTypeChange={(id, next) => {
                    const updated = dash.charts.map((chart) =>
                      chart.id === id ? { ...chart, type: next } : chart
                    );
                    upsertDashboard({ ...dash, charts: updated });
                  }}
                  onTitleChange={(id, title) => {
                    const updated = dash.charts.map((chart) =>
                      chart.id === id ? { ...chart, title } : chart
                    );
                    upsertDashboard({ ...dash, charts: updated });
                  }}
                  onMove={() => {}}
                  onFullscreen={() => {}}
                  onScreenshot={() => {}}
                  onRemove={() => setFullscreenChartId(null)}
                  isCaptured={false}
                />
              </div>
            </div>
          </div>
        )}
        {loading && <div className="text-sm text-gray-500">Refreshing data…</div>}
      </main>
    </div>
  );
}

function Breadcrumb({ title, onBack, sourceName }: { title: string; onBack: () => void; sourceName?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-600">
      <button onClick={onBack} className="flex items-center gap-1 text-gray-700 hover:text-gray-900">
        <ArrowLeft className="w-4 h-4" />
        Projects
      </button>
      <span>/</span>
      <span className="font-semibold text-gray-900">{title}</span>
      {sourceName && (
        <>
          <span>/</span>
          <span className="inline-flex items-center px-2 py-1 rounded-full bg-blue-50 text-blue-700 text-xs">
            {sourceName}
          </span>
        </>
      )}
    </div>
  );
}

function FilterBar({
  filters,
  onChangeRange,
  onChangeGranularity,
  onPublish,
}: {
  filters: any;
  onChangeRange: (r: any) => void;
  onChangeGranularity: (g: any) => void;
  onPublish: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [selecting, setSelecting] = useState<"start" | "end">("start");
  const ranges = [
    { label: "Last 28 days", value: "last_28_days" },
    { label: "Last 3 months", value: "last_3_months" },
  ];
  const granularities = [
    { label: "Daily", value: "daily" },
    { label: "Weekly", value: "weekly" },
    { label: "Monthly", value: "monthly" },
  ];

  const rangeValue = useMemo(() => {
    const start = new Date(filters.startDate + "T00:00:00");
    const end = new Date(filters.endDate + "T00:00:00");
    const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1;
    if (Math.abs(diff - 28) <= 2) return "last_28_days";
    return "last_3_months";
  }, [filters.startDate, filters.endDate]);

  return (
    <div className="flex items-center gap-3">
      <div className="relative">
        <button
          className="px-3 py-2 border rounded-lg bg-white flex items-center gap-2"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="text-lg">🗓</span>
          <span className="text-sm font-medium">{ranges.find((r) => r.value === rangeValue)?.label ?? "Custom"}</span>
          <ChevronDown className="w-4 h-4" />
        </button>
        {open && (
          <RangePicker
            startDate={filters.startDate}
            endDate={filters.endDate}
            onClose={() => setOpen(false)}
            onApply={(range) => {
              onChangeRange(range);
              setOpen(false);
            }}
            selecting={selecting}
            setSelecting={setSelecting}
            onPreset={(value) => {
              onChangeRange(presetRange(value as any));
              setOpen(false);
            }}
          />
        )}
      </div>
      <div className="px-3 py-2 border rounded-lg bg-white flex items-center gap-2">
        <select
          className="bg-white text-sm focus:outline-none"
          value={filters.granularity}
          onChange={(e) => onChangeGranularity(e.target.value)}
        >
          {granularities.map((g) => (
            <option key={g.value} value={g.value}>
              {g.label}
            </option>
          ))}
        </select>
        <ChevronDown className="w-4 h-4" />
      </div>
      <div className="ml-auto flex gap-2">
        <button className="px-4 py-2 bg-black text-white rounded-lg">Done editing</button>
        <button className="px-4 py-2 border border-black text-black rounded-lg" onClick={onPublish}>
          Pubblica
        </button>
      </div>
    </div>
  );
}

type RangePickerProps = {
  startDate: string;
  endDate: string;
  onClose: () => void;
  onApply: (r: { startDate: string; endDate: string }) => void;
  onPreset: (value: string) => void;
  selecting: "start" | "end";
  setSelecting: (s: "start" | "end") => void;
};

function RangePicker({ startDate, endDate, onClose, onApply, onPreset, selecting, setSelecting }: RangePickerProps) {
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");
  const months = getTwoMonths(end);

  const presets = [
    { label: "Today", value: "today" },
    { label: "Last 7 days", value: "last_7_days" },
    { label: "Last 4 weeks", value: "last_28_days" },
    { label: "Last 3 months", value: "last_3_months" },
    { label: "Month to date", value: "mtd" },
    { label: "Quarter to date", value: "qtd" },
    { label: "Year to date", value: "ytd" },
    { label: "All time", value: "all_time" },
  ];

  function handleSelectDay(day: string) {
    if (selecting === "start") {
      setSelecting("end");
      onApply({ startDate: day, endDate });
    } else {
      setSelecting("start");
      const startValue = new Date(day) < new Date(startDate) ? day : startDate;
      const endValue = new Date(day) < new Date(startDate) ? startDate : day;
      onApply({ startDate: startValue, endDate: endValue });
    }
  }

  return (
    <div className="absolute mt-2 left-0 z-[12000] bg-white rounded-2xl shadow-2xl border w-[720px] p-4 flex gap-4">
      <div className="w-48 border-r pr-3 space-y-1">
        {presets.map((p) => (
          <button
            key={p.value}
            className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-gray-100"
            onClick={() => {
              onPreset(p.value);
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex-1 space-y-3">
        <div className="flex gap-3 text-sm">
          <div className="flex-1">
            <div className="text-xs text-gray-500">Start</div>
            <input
              className="w-full border rounded-md px-2 py-1 text-sm"
              value={startDate}
              readOnly
            />
          </div>
          <div className="flex-1">
            <div className="text-xs text-gray-500">End</div>
            <input
              className="w-full border rounded-md px-2 py-1 text-sm"
              value={endDate}
              readOnly
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {months.map((m) => (
            <MonthView
              key={`${m.year}-${m.month}`}
              month={m.month}
              year={m.year}
              startDate={startDate}
              endDate={endDate}
              onSelectDay={handleSelectDay}
            />
          ))}
        </div>

        <div className="flex justify-end gap-2 text-sm">
          <button className="px-3 py-2 rounded-md border" onClick={onClose}>
            Clear
          </button>
          <button
            className="px-3 py-2 rounded-md bg-orange-500 text-white"
            onClick={() => onApply({ startDate, endDate })}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

function MonthView({
  month,
  year,
  startDate,
  endDate,
  onSelectDay,
}: {
  month: number;
  year: number;
  startDate: string;
  endDate: string;
  onSelectDay: (iso: string) => void;
}) {
  const days = buildMonthDays(year, month);
  const monthName = new Date(year, month, 1).toLocaleString("en-US", { month: "long" });
  const start = new Date(startDate);
  const end = new Date(endDate);

  return (
    <div>
      <div className="flex items-center justify-between mb-2 text-sm font-semibold text-gray-800">
        <span>
          {monthName} {year}
        </span>
      </div>
      <div className="grid grid-cols-7 text-xs text-gray-500 mb-1">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
          <div key={d} className="text-center">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 text-sm">
        {days.map((d, idx) => {
          if (!d) return <div key={idx} />;
          const iso = d.toISOString().slice(0, 10);
          const inRange = d >= start && d <= end;
          const isStart = iso === startDate;
          const isEnd = iso === endDate;
          return (
            <button
              key={iso}
              onClick={() => onSelectDay(iso)}
              className={`h-9 w-full rounded-md text-center ${
                isStart || isEnd
                  ? "bg-black text-white"
                  : inRange
                  ? "bg-gray-200 text-gray-800"
                  : "hover:bg-gray-100"
              }`}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function buildMonthDays(year: number, month: number) {
  const first = new Date(year, month, 1);
  const days: Array<Date | null> = [];
  const offset = first.getDay();
  for (let i = 0; i < offset; i++) days.push(null);
  const total = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= total; d++) {
    days.push(new Date(year, month, d));
  }
  return days;
}

function getTwoMonths(endDate: Date) {
  const months = [];
  const end = new Date(endDate);
  const prev = new Date(end);
  prev.setMonth(prev.getMonth() - 1);
  months.push({ month: prev.getMonth(), year: prev.getFullYear() });
  months.push({ month: end.getMonth(), year: end.getFullYear() });
  return months;
}

function ChartPanel({
  title,
  selected,
  moving,
  onSelect,
  children,
}: {
  title: string;
  selected: boolean;
  moving?: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`bg-white rounded-2xl border shadow-sm p-3 ${
        selected ? "ring-2 ring-indigo-300" : ""
      } ${moving ? "border-dashed border-2 border-indigo-300" : ""}`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold text-gray-900 truncate">{title}</div>
      </div>
      <div onClick={onSelect}>{children}</div>
    </div>
  );
}

function Sidebar({
  dashboardTitle,
  charts,
  selectedChartId,
  onSelectChart,
  prompt,
  onChangePrompt,
  onSendPrompt,
}: {
  dashboardTitle: string;
  charts: any[];
  selectedChartId: string | null;
  onSelectChart: (id: string) => void;
  prompt: string;
  onChangePrompt: (v: string) => void;
  onSendPrompt: () => void;
}) {
  return (
    <aside className="w-80 border-r bg-white flex flex-col">
      <div className="px-3 py-2 font-semibold text-gray-800 border-b truncate">{dashboardTitle}</div>
      <div className="flex-1 overflow-auto">
        {charts.map((c) => (
          <button
            key={c.id}
            onClick={() => onSelectChart(c.id)}
            className={`w-full text-left px-3 py-2 border-b hover:bg-slate-50 ${
              selectedChartId === c.id ? "bg-slate-100" : ""
            }`}
          >
            {c.title}
          </button>
        ))}
      </div>
      <div className="p-3 border-t space-y-2">
        <textarea
          className="w-full border rounded-lg p-2 text-sm"
          placeholder="Ask Graphed to see..."
          value={prompt}
          onChange={(e) => onChangePrompt(e.target.value)}
        />
        <button
          onClick={onSendPrompt}
          className="w-full bg-indigo-600 text-white rounded-lg py-2 text-sm font-semibold"
        >
          Send message
        </button>
      </div>
    </aside>
  );
}
