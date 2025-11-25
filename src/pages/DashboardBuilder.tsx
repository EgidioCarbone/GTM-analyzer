import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, ArrowLeft, Pencil, Check, Copy, Trash2 } from "lucide-react";
import ChartCard, { ChartType } from "../components/ChartCard";
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
  const [chatMessages, setChatMessages] = useState<
    {
      id: string;
      role: "user" | "ai";
      text: string;
      chartsLinked?: string[];
      attachments?: { id: string; name: string }[];
      createdAt?: string;
    }[]
  >([]);
  const [pendingAttachments, setPendingAttachments] = useState<{ id: string; name: string }[]>([]);
  const runKeyRef = useRef<string | null>(null);
  const [movingChartId, setMovingChartId] = useState<string | null>(null);
  const [fullscreenChartId, setFullscreenChartId] = useState<string | null>(null);
  const [capturedChartId, setCapturedChartId] = useState<string | null>(null);
  const [isEditingDashTitle, setIsEditingDashTitle] = useState(false);
  const [dashTitleDraft, setDashTitleDraft] = useState("");
  const [mode, setMode] = useState<"editing" | "view">("editing");
  const [showShareModal, setShowShareModal] = useState(false);
  const dash = useMemo(() => dashboards.find((d) => d.id === activeId) || dashboards[0], [dashboards, activeId]);

  const gridColsClass = useMemo(() => {
    const count = dash?.charts?.length || 0;
    if (count <= 1) return "grid-cols-1";
    if (count === 2) return "grid-cols-1 md:grid-cols-2";
    return "grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4";
  }, [dash?.charts?.length]);

  useEffect(() => {
    if (dash) setDashTitleDraft(dash.title);
  }, [dash?.title]);

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
      setDashTitleDraft(state.prompt || "Dashboard");
      setChatMessages([
        {
          id: crypto.randomUUID(),
          role: "user",
          text: state.prompt || "Dashboard request",
          createdAt: new Date().toISOString(),
        },
      ]);
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
      const userMsgId = crypto.randomUUID();
      setChatMessages((prev) => [
        ...prev,
        { id: userMsgId, role: "user", text: promptText.trim(), chartsLinked: [], attachments: pendingAttachments },
      ]);
      const res = await runDashboard({ prompt: promptText, filters });
      const merged = [...dash.charts, ...res.charts];
      upsertDashboard({ ...dash, charts: merged });
      setSelectedChartId(res.charts[0]?.id ?? merged[0]?.id ?? null);
      setSidebarPrompt("");
      if (pendingAttachments.length) setPendingAttachments([]);
      setChatMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "ai",
          text: res.charts.length ? `Created ${res.charts.length} chart(s)` : "Nessun grafico creato",
          chartsLinked: res.charts.map((c) => c.id),
        },
      ]);
    } catch (e: any) {
      setChatMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "ai", text: "Errore durante la generazione", chartsLinked: [] },
      ]);
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
        messages={chatMessages}
        attachments={pendingAttachments}
        onAddAttachment={(file) => {
          const att = { id: crypto.randomUUID(), name: file.name };
          setPendingAttachments((prev) => [...prev, att]);
        }}
        onSelectSource={() => setShowShareModal(true)}
      />

      <main className="flex-1 overflow-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <Breadcrumb
            title={
              isEditingDashTitle ? (
                <input
                  className="text-lg font-semibold text-gray-900 bg-transparent border-b border-gray-300 focus:outline-none"
                  value={dashTitleDraft}
                  onChange={(e) => setDashTitleDraft(e.target.value)}
                  onBlur={() => {
                    const next = dashTitleDraft.trim() || dash.title;
                    upsertDashboard({ ...dash, title: next });
                    setDashTitleDraft(next);
                    setIsEditingDashTitle(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const next = dashTitleDraft.trim() || dash.title;
                      upsertDashboard({ ...dash, title: next });
                      setDashTitleDraft(next);
                      setIsEditingDashTitle(false);
                    }
                    if (e.key === "Escape") {
                      setDashTitleDraft(dash.title);
                      setIsEditingDashTitle(false);
                    }
                  }}
                  autoFocus
                />
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold text-gray-900">{dash.title}</span>
                  <button
                    type="button"
                    className="text-gray-500 hover:text-gray-700 p-1 rounded"
                    onClick={() => setIsEditingDashTitle(true)}
                    aria-label="Edit dashboard title"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>
              )
            }
            onBack={() => navigate("/dashboard-studio")}
            sourceName={dash.sourceName}
          />
          <div className="flex items-center gap-2">
            {isEditingDashTitle && (
              <button
                type="button"
                className="px-3 py-1.5 rounded-lg bg-black text-white text-sm flex items-center gap-2"
                onClick={() => {
                  const next = dashTitleDraft.trim() || dash.title;
                  upsertDashboard({ ...dash, title: next });
                  setDashTitleDraft(next);
                  setIsEditingDashTitle(false);
                }}
              >
                <Check className="w-4 h-4" /> Salva
              </button>
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="px-4 py-2 rounded-lg border text-sm font-semibold bg-white text-black border-black hover:bg-gray-50"
                onClick={() => {
                  const slug = dash.publicSlug || (crypto as any)?.randomUUID?.() || `pub_${Date.now()}`;
                  upsertDashboard({ ...dash, publicSlug: slug, isPublic: true });
                  setShowShareModal(true);
                }}
              >
                Pubblica
              </button>
              <button
                type="button"
                className={`px-4 py-2 rounded-lg border text-sm font-semibold ${
                  mode === "editing"
                    ? "bg-black text-white border-black"
                    : "bg-white text-black border-black hover:bg-gray-50"
                }`}
                onClick={() => {
                  if (mode === "editing") {
                    upsertDashboard({ ...dash });
                    setMode("view");
                  } else {
                    setMode("editing");
                  }
                }}
                title="Le modifiche vengono salvate e puoi riaprirle da Your projects"
              >
                {mode === "editing" ? "Done editing" : "Edit"}
              </button>
            </div>
          </div>
        </div>
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
              title={c.customTitle || c.title}
              defaultTitle={c.title}
              selected={c.id === selectedChartId}
              moving={movingChartId === c.id}
              canEdit={mode === "editing"}
              onSelect={() => setSelectedChartId(c.id)}
              onTitleChange={(next) => {
                const updated = dash.charts.map((chart) =>
                  chart.id === c.id ? { ...chart, customTitle: next } : chart
                );
                upsertDashboard({ ...dash, charts: updated });
              }}
            >
              <ChartCard
                spec={c as any}
                onTypeChange={(id: string, next: ChartType) => {
                  const updated = dash.charts.map((chart) =>
                    chart.id === id ? { ...chart, type: next } : chart
                  );
                  upsertDashboard({ ...dash, charts: updated });
                }}
                onMove={mode === "editing" ? (id) => setMovingChartId((prev) => (prev === id ? null : id)) : undefined}
                onFullscreen={(id) => setFullscreenChartId(id)}
                onScreenshot={(id) => {
                  setCapturedChartId(id);
                  setTimeout(() => setCapturedChartId((prev) => (prev === id ? null : prev)), 1200);
                }}
                onRemove={
                  mode === "editing"
                    ? (id) => upsertDashboard({ ...dash, charts: dash.charts.filter((x) => x.id !== id) })
                    : undefined
                }
                isCaptured={capturedChartId === c.id}
                canEdit={mode === "editing"}
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
                  onTypeChange={(id: string, next: ChartType) => {
                    const updated = dash.charts.map((chart) =>
                      chart.id === id ? { ...chart, type: next } : chart
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

      {showShareModal && (
        <div className="fixed inset-0 z-[14000] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowShareModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-[420px] max-w-[90vw] p-5 space-y-4">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-gray-900">Share this Dashboard</h3>
              <p className="text-sm text-gray-600">
                Visitors will only be able to view this dashboard and will not be able to edit or interact with the AI.
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-gray-500">Public link</label>
              <div className="flex items-center gap-2">
                <input
                  className="flex-1 border rounded-lg px-3 py-2 text-sm bg-gray-50"
                  readOnly
                  value={
                    typeof window !== "undefined"
                      ? `${window.location.origin}/dashboards/${dash.publicSlug || dash.id}/public`
                      : ""
                  }
                />
                <button
                  type="button"
                  className="p-2 rounded-lg border bg-white hover:bg-gray-50"
                  onClick={() => {
                    const url =
                      typeof window !== "undefined"
                        ? `${window.location.origin}/dashboards/${dash.publicSlug || dash.id}/public`
                        : "";
                    if (url) navigator.clipboard?.writeText(url);
                  }}
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="text-xs text-gray-500">
              Created by demo@example.com on {new Date().toLocaleDateString()}
            </div>
            <div className="flex justify-between">
              <button
                type="button"
                className="px-3 py-2 rounded-lg text-red-600 border border-red-200 hover:bg-red-50 text-sm flex items-center gap-2"
                onClick={() => {
                  upsertDashboard({ ...dash, isPublic: false, publicSlug: undefined });
                  setShowShareModal(false);
                }}
              >
                <Trash2 className="w-4 h-4" /> Remove Link
              </button>
              <button
                type="button"
                className="px-3 py-2 rounded-lg bg-black text-white text-sm"
                onClick={() => setShowShareModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type BreadcrumbProps = { title: React.ReactNode; onBack: () => void; sourceName?: string };

function Breadcrumb({ title, onBack, sourceName }: BreadcrumbProps) {
  const titleContent =
    typeof title === "string" ? (
      <span className="font-semibold text-gray-900 truncate">{title}</span>
    ) : (
      title
    );

  return (
    <div className="flex items-center gap-2 text-sm text-gray-600">
      <button onClick={onBack} className="flex items-center gap-1 text-gray-700 hover:text-gray-900">
        <ArrowLeft className="w-4 h-4" />
        Projects
      </button>
      <span>/</span>
      <div className="min-w-0">{titleContent}</div>
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
  defaultTitle,
  selected,
  moving,
  canEdit,
  onSelect,
  onTitleChange,
  children,
}: {
  title: string;
  defaultTitle: string;
  selected: boolean;
  moving?: boolean;
  canEdit: boolean;
  onSelect: () => void;
  onTitleChange: (next: string) => void;
  children: React.ReactNode;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setDraft(title);
  }, [title]);

  useEffect(() => {
    if (isEditing && canEdit) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing, canEdit]);

  const commit = () => {
    const next = draft.trim() || defaultTitle;
    onTitleChange(next);
    setDraft(next);
    setIsEditing(false);
  };

  return (
    <div
      className={`bg-white rounded-2xl border shadow-sm p-3 ${
        selected ? "ring-2 ring-indigo-300" : ""
      } ${moving ? "border-dashed border-2 border-indigo-300" : ""}`}
    >
      <div className="flex items-center justify-between mb-2">
        {isEditing && canEdit ? (
          <input
            ref={inputRef}
            className="text-sm font-semibold text-gray-900 bg-transparent border-b border-gray-300 flex-1 outline-none"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              }
              if (e.key === "Escape") {
                setDraft(title);
                setIsEditing(false);
              }
            }}
          />
        ) : (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="font-semibold text-gray-900 truncate" title={title}>
              {title}
            </span>
            {canEdit && (
              <button
                type="button"
                className="text-gray-500 hover:text-gray-700 p-1 rounded"
                onClick={() => setIsEditing(true)}
                aria-label="Edit chart title"
              >
                <Pencil className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
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
  messages,
  attachments,
  onAddAttachment,
  onSelectSource,
}: {
  dashboardTitle: string;
  charts: any[];
  selectedChartId: string | null;
  onSelectChart: (id: string) => void;
  prompt: string;
  onChangePrompt: (v: string) => void;
  onSendPrompt: () => void;
  messages: Array<{ id: string; role: "user" | "ai"; text: string; chartsLinked?: string[]; attachments?: { id: string; name: string }[] }>;
  attachments: { id: string; name: string }[];
  onAddAttachment: (file: File) => void;
  onSelectSource: () => void;
}) {
  const historyRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    historyRef.current?.scrollTo({ top: historyRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  return (
    <aside className="w-80 border-r bg-white flex flex-col">
      <div className="px-3 py-2 font-semibold text-gray-800 border-b truncate">{dashboardTitle}</div>

      <div className="flex-1 overflow-auto border-b" ref={historyRef}>
        <div className="divide-y">
          {messages.map((m) => (
            <div key={m.id} className="px-3 py-2 text-sm">
              <div className={`font-medium ${m.role === "user" ? "text-indigo-700" : "text-gray-700"}`}>
                {m.role === "user" ? "You" : "AI"}
              </div>
              <div className="text-gray-800 whitespace-pre-wrap">{m.text}</div>
              {m.attachments?.length ? (
                <div className="mt-1 flex flex-wrap gap-1">
                  {m.attachments.map((a) => (
                    <span key={a.id} className="text-[11px] px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                      {a.name}
                    </span>
                  ))}
                </div>
              ) : null}
              {m.chartsLinked?.length ? (
                <div className="mt-1 flex flex-wrap gap-1">
                  {m.chartsLinked.map((cid) => (
                    <span key={cid} className="text-[11px] px-2 py-1 rounded-full bg-indigo-50 text-indigo-700">
                      Chart {cid}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div className="p-3 space-y-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="p-2 rounded-lg border bg-white hover:bg-gray-50"
            aria-label="Select source"
            onClick={onSelectSource}
          >
            🗄️
          </button>
          <label className="p-2 rounded-lg border bg-white hover:bg-gray-50 cursor-pointer" aria-label="Attach file">
            📎
            <input
              type="file"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onAddAttachment(file);
              }}
            />
          </label>
          <input
            className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            placeholder="Ask Graphed to see..."
            value={prompt}
            onChange={(e) => onChangePrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSendPrompt();
              }
            }}
          />
        </div>
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {attachments.map((a) => (
              <span key={a.id} className="text-[11px] px-2 py-1 rounded-full bg-green-100 text-green-700">
                {a.name}
              </span>
            ))}
          </div>
        )}
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
