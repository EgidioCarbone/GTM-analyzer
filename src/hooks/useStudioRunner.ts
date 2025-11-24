import { useCallback, useState } from "react";
import type { ChartSpec } from "../components/ChartCard";

export type StudioFilters = {
  startDate: string;
  endDate: string;
  granularity: "daily" | "weekly" | "monthly";
  compareToPrev: boolean;
};

export type StudioRunResult = {
  charts: ChartSpec[];
};

export function useStudioRunner(propertyId: string | null) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runDashboard = useCallback(
    async (params: { prompt: string; filters: StudioFilters; charts?: ChartSpec[] }): Promise<StudioRunResult> => {
      if (!propertyId) {
        throw new Error("Property ID mancante");
      }
      const { prompt, filters, charts: chartsFromCaller } = params;
      setLoading(true);
      setError(null);

      try {
        let chartsSkeleton: ChartSpec[] = [];
        if (chartsFromCaller && chartsFromCaller.length) {
          chartsSkeleton = chartsFromCaller.map((c, i) => ({
            id: c.id || `chart_${i}`,
            title: c.title || `Grafico ${i + 1}`,
            type: c.type || "table",
            x: c.x || "date",
            y: c.y || "screenPageViews",
            y2: c.y2,
            data: [],
          }));
        } else {
          // Step 1: intent -> charts skeleton
          const intentRes = await fetch("/api/studio/intent", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt,
              propertyId,
              filters,
              availableMetrics: [
                "screenPageViews",
                "sessions",
                "eventCount",
                "conversions",
                "totalRevenue",
                "activeUsers",
                "totalUsers",
              ],
              availableDimensions: ["date", "defaultChannelGroup", "pagePath", "deviceCategory", "country"],
            }),
          });
          if (!intentRes.ok) {
            const txt = await intentRes.text();
            console.error("[intent] status", intentRes.status, txt);
            throw new Error(txt);
          }
          const intentJson = await intentRes.json();
          console.log("[intent] charts", intentJson?.charts?.length || 0);
          const intentCharts: ChartSpec[] = Array.isArray(intentJson?.charts) ? intentJson.charts : [];
          chartsSkeleton = intentCharts.map((c, i) => ({
            id: c.id || `chart_${i}`,
            title: c.title || `Grafico ${i + 1}`,
            type: c.type || "table",
            x: c.x || "date",
            y: c.y || "screenPageViews",
            y2: c.y2,
            data: [],
          }));
        }

        // Step 2: run -> data
        const runRes = await fetch("/api/studio/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            propertyId,
            startDate: filters.startDate,
            endDate: filters.endDate,
            filters,
            charts: chartsSkeleton.map(({ id, title, type, x, y, y2 }) => ({
              id,
              title,
              type,
              x,
              y,
              y2,
            })),
          }),
        });
        if (!runRes.ok) {
          const txt = await runRes.text();
          console.error("[run] status", runRes.status, txt, { filters, propertyId });
          throw new Error(txt);
        }
        const runJson = await runRes.json();
        console.log("[run] charts returned", runJson?.charts?.length || 0);
        const byId: Record<string, any[]> = {};
        for (const c of runJson?.charts ?? []) {
          byId[c.id] = Array.isArray(c.data) ? c.data : [];
        }

        const charts = chartsSkeleton.map((c) => ({
          ...c,
          data: byId[c.id] || [],
        }));

        return { charts };
      } catch (e: any) {
        setError(e?.message || "Errore esecuzione");
        console.error("[useStudioRunner] runDashboard error", e);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [propertyId]
  );

  return { runDashboard, loading, error };
}
