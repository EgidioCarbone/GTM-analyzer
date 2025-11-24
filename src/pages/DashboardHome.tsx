import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { ArrowRight, Inbox, Wand2 } from "lucide-react";
import ChartCard, { ChartSpec } from "../components/ChartCard";
import { useGa4Property } from "../context/Ga4PropertyContext";
import { StudioFilters, useStudioRunner } from "../hooks/useStudioRunner";

import { AddSourceModal } from "../components/AddSourceModal";
type Mode = "dashboard" | "source" | "upload";
type SavedDashboard = {
  id: string;
  title: string;
  description: string;
  lastRun: string;
  charts: ChartSpec[];
};

const defaultFilters: StudioFilters = {
  startDate: (() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 27);
    return start.toISOString().slice(0, 10);
  })(),
  endDate: new Date().toISOString().slice(0, 10),
  granularity: "daily",
  compareToPrev: false,
};

export default function DashboardHome() {
  const { propertyId, setPropertyId } = useGa4Property();
  const { runDashboard, loading, error } = useStudioRunner(propertyId);
  const navigate = useNavigate();

  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<Mode>("dashboard");
  const [showPropertyPanel, setShowPropertyPanel] = useState(false);
  const [localProperty, setLocalProperty] = useState(propertyId || "");
  const [latestCharts, setLatestCharts] = useState<ChartSpec[] | null>(null);
  const [dashboards, setDashboards] = useState<SavedDashboard[]>([]);
  const [showAddSourceModal, setShowAddSourceModal] = useState(false);

  const suggestions = [
    "Page views and sessions by channel group last 30 days",
    "Top countries and devices for conversions",
    "Page views trend and events trend last 28 days",
  ];

  const computedFilters: StudioFilters = useMemo(() => {
    const p = prompt.toLowerCase();
    if (p.includes("last 30")) {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - 29);
      return {
        ...defaultFilters,
        startDate: start.toISOString().slice(0, 10),
        endDate: end.toISOString().slice(0, 10),
      };
    }
    return defaultFilters;
  }, [prompt]);

  const heroSubtitle = useMemo(
    () => "What would you like to see today?",
    []
  );

  async function handleSend() {
    try {
      if (!propertyId) {
        toast.error("Imposta una GA4 property ID per continuare");
        setShowPropertyPanel(true);
        return;
      }
      if (!prompt.trim()) {
        toast.error("Scrivi cosa vuoi vedere");
        return;
      }
      const res = await runDashboard({ prompt, filters: computedFilters });
      const id = (crypto as any)?.randomUUID ? (crypto as any).randomUUID() : `dash_${Date.now()}`;
      toast.success("Dashboard generata");
      navigate("/dashboard-builder", {
        state: {
          prompt,
          charts: res.charts,
          filters: computedFilters,
          dashboardId: id,
        },
      });
    } catch (e: any) {
      toast.error(e?.message || "Errore durante la generazione");
    }
  }

  function handleSelectSource(id: string) {
    if (id === "ga4") {
      setShowPropertyPanel(true);
      setShowAddSourceModal(false);
      return;
    }
    toast.success(`Source selezionata: ${id}`);
    setShowAddSourceModal(false);
  }

  function handleSaveProperty() {
    if (!localProperty.trim()) {
      toast.error("Inserisci un property id");
      return;
    }
    setPropertyId(localProperty.trim());
    setShowPropertyPanel(false);
    toast.success("Property salvata");
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-white dark:from-gray-900 dark:via-gray-950 dark:to-black">
      <div className="absolute -top-40 -left-40 w-[520px] h-[520px] bg-purple-300 opacity-30 blur-3xl rounded-full" />
      <div className="absolute -bottom-40 -right-40 w-[520px] h-[520px] bg-pink-300 opacity-30 blur-3xl rounded-full" />

      <div className="relative max-w-6xl mx-auto px-4 py-12 space-y-10">
        <div className="text-center space-y-3">
          <p className="text-sm text-gray-500">Dashboard Studio</p>
          <h1 className="text-4xl md:text-5xl font-semibold text-gray-900">{heroSubtitle}</h1>
          <p className="text-base text-gray-600">Type a question or request and we will build the dashboard for you.</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4 md:p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:gap-3">
            <div className="flex flex-wrap gap-2 mb-3 md:mb-0">
              <ModeChip label="Dashboard" selected={mode === "dashboard"} onClick={() => setMode("dashboard")} />
              <ModeChip
                label="Select a source"
                selected={mode === "source"}
                onClick={() => {
                  setMode("source");
                  setShowAddSourceModal(true);
                }}
              />
              <ModeChip label="Upload a file" selected={mode === "upload"} onClick={() => setMode("upload")} />
            </div>
            <div className="flex-1 flex flex-col md:flex-row md:items-center gap-3 w-full">
              <input
                className="flex-1 text-lg py-3 px-4 rounded-xl border border-gray-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                placeholder="Show me some charts about this data"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
              <button
                onClick={handleSend}
                disabled={loading}
                className="whitespace-nowrap px-4 py-3 rounded-lg bg-black text-white text-base font-medium hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading ? "Running..." : "Send message"}
                {!loading && <ArrowRight className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => setPrompt(s)}
                className="text-xs px-3 py-1.5 rounded-full border border-gray-200 bg-white hover:bg-gray-50 flex items-center gap-2"
              >
                <Wand2 className="w-4 h-4 text-violet-500" />
                {s}
              </button>
            ))}
          </div>

          {error && <div className="text-sm text-red-600">Errore: {error}</div>}
        </div>

        {latestCharts && (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Generated dashboard</h2>
                <p className="text-sm text-gray-600">Based on your last prompt</p>
              </div>
              <button
                className="text-sm text-violet-600 hover:text-violet-700"
                onClick={() => navigate("/dashboard-studio/run")}
              >
                Open in builder
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {latestCharts.map((chart) => (
                <ChartCard key={chart.id} spec={chart as Required<ChartSpec>} />
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-900">Your dashboards</h3>
          {dashboards.length === 0 ? (
            <div className="flex items-center gap-3 text-gray-500 text-sm bg-white border border-dashed border-gray-200 rounded-xl p-4">
              <Inbox className="w-4 h-4" />
              Nessuna dashboard salvata. Genera la prima usando il prompt qui sopra.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dashboards.map((d) => (
                <button
                  key={d.id}
                  onClick={() => navigate(`/dashboard-studio/run?id=${d.id}`)}
                  className="text-left bg-white border border-gray-200 rounded-2xl shadow-sm p-4 hover:border-violet-200 hover:shadow transition"
                >
                  <div className="text-base font-semibold text-gray-900">{d.title}</div>
                  <div className="text-sm text-gray-600 mt-1">{d.description}</div>
                  <div className="text-xs text-gray-500 mt-2">
                    Ultimo run: {new Date(d.lastRun).toLocaleString()}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <AddSourceModal
        isOpen={showAddSourceModal}
        onClose={() => setShowAddSourceModal(false)}
        onSelectSource={handleSelectSource}
      />

      {showPropertyPanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowPropertyPanel(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-[420px] max-w-[92vw] p-6 space-y-4">
            <div className="text-lg font-semibold text-gray-900">Set GA4 property ID</div>
            <p className="text-sm text-gray-600">Inserisci l'ID della property GA4 da usare per generare i dati.</p>
            <input
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-300"
              placeholder="Es. 452166144"
              value={localProperty}
              onChange={(e) => setLocalProperty(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <button
                className="px-3 py-2 rounded-lg border border-gray-200 text-sm"
                onClick={() => setShowPropertyPanel(false)}
              >
                Annulla
              </button>
              <button
                className="px-3 py-2 rounded-lg bg-black text-white text-sm hover:opacity-90"
                onClick={handleSaveProperty}
              >
                Salva
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ModeChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full border text-xs font-medium transition ${
        selected ? "bg-black text-white border-black" : "bg-white text-gray-700 border-gray-200 hover:border-gray-300"
      }`}
    >
      {label}
    </button>
  );
}




