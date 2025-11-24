import React, { useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import ChartCard from "../components/ChartCard";
import { useDashboardStore } from "../context/DashboardStoreContext";
import { useStudioRunner } from "../hooks/useStudioRunner";
import { useGa4Property } from "../context/Ga4PropertyContext";

export default function DashboardPublic() {
  const { id } = useParams();
  const { dashboards, setActiveDashboard, filters, setFilters, upsertDashboard } = useDashboardStore();
  const { propertyId } = useGa4Property();
  const { runDashboard } = useStudioRunner(propertyId);
  const dash = useMemo(
    () => dashboards.find((d) => d.id === id || d.publicSlug === id),
    [dashboards, id]
  );

  useEffect(() => {
    if (dash) setActiveDashboard(dash.id);
  }, [dash, setActiveDashboard]);

  useEffect(() => {
    if (!dash) return;
    runDashboard({ prompt: dash.title, filters })
      .then((res) => upsertDashboard({ ...dash, charts: res.charts, filters }))
      .catch(() => {});
  }, [dash, filters.startDate, filters.endDate, filters.granularity]);

  if (!dash) return <div className="p-6">Dashboard non trovata</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-6 space-y-4">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-gray-900">{dash.title}</h1>
        <div className="flex gap-2 text-sm text-gray-600">
          <button
            className="px-3 py-2 border rounded-lg bg-white"
            onClick={() => setFilters({ ...filters, startDate: dash.filters.startDate, endDate: dash.filters.endDate })}
          >
            {dash.filters.startDate} → {dash.filters.endDate}
          </button>
          <button
            className="px-3 py-2 border rounded-lg bg-white"
            onClick={() => setFilters({ ...filters, granularity: dash.filters.granularity })}
          >
            {dash.filters.granularity}
          </button>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {dash.charts.map((c) => (
          <div key={c.id} className="bg-white rounded-2xl border shadow-sm p-3">
            <div className="font-semibold text-gray-900 mb-2">{c.title}</div>
            <ChartCard spec={c as any} />
          </div>
        ))}
      </div>
    </div>
  );
}
