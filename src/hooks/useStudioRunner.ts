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

// Canonical GA4 metrics we allow. Extend this to pull real schema metadata per property if available.
const AVAILABLE_METRICS = [
  "screenPageViews",
  "sessions",
  "eventCount",
  "conversions",
  "totalRevenue",
  "activeUsers",
  "totalUsers",
  "purchases",
];

const METRIC_ALIASES: Array<{ key: string; patterns: RegExp[] }> = [
  { key: "screenPageViews", patterns: [/page\s*views?/i, /\bviews?\b/i, /\bpageview(s)?\b/i] },
  { key: "sessions", patterns: [/sessions?/i] },
  { key: "eventCount", patterns: [/\bevent(s)?\b/i, /\bevent\s*count\b/i] },
  { key: "conversions", patterns: [/conversion(s)?\b/i] },
  { key: "totalRevenue", patterns: [/revenue\b/i, /total\s*revenue\b/i, /\bentrate\b/i, /\bfatturat[oa]\b/i] },
  { key: "activeUsers", patterns: [/active\s*users?/i, /\butenti\s*attiv[io]\b/i] },
  { key: "totalUsers", patterns: [/total\s*users?/i, /\busers?\b/i, /\butenti\b/i] },
  { key: "purchases", patterns: [/purchase(s)?\b/i, /\bordini?\b/i, /\btransazioni?\b/i] },
];

const normalizeMetricName = (raw: string | undefined) => {
  if (!raw) return "";
  const base = raw.replace(/[^a-z0-9]/gi, "").toLowerCase();
  const singular = base.endsWith("s") ? base.slice(0, -1) : base;
  if (["pageview", "pageviews", "screenpageview", "screenpageviews"].includes(singular)) return "screenpageviews";
  if (["eventcount", "event"].includes(singular)) return "eventcount";
  if (["activeuser", "activeusers"].includes(singular)) return "activeusers";
  if (["totaluser", "totalusers", "user"].includes(singular)) return "totalusers";
  if (["session"].includes(singular)) return "sessions";
  if (["purchase", "order", "transaction"].includes(singular)) return "purchases";
  if (["revenue", "totalrevenue", "entrata", "fatturato"].includes(singular)) return "totalrevenue";
  if (["conversion"].includes(singular)) return "conversions";
  return singular;
};

const resolveMetricFromText = (text: string | undefined) => {
  if (!text) return "";
  for (const { key, patterns } of METRIC_ALIASES) {
    if (patterns.some((re) => re.test(text))) {
      return normalizeMetricName(key);
    }
  }
  return "";
};

const metricKeyFromChart = (c: ChartSpec) => {
  const yKey = normalizeMetricName(c.y as any);
  const y2Key = normalizeMetricName(c.y2 as any);
  if (yKey) return yKey;
  if (y2Key) return y2Key;
  const titleToken = resolveMetricFromText(c.title);
  if (titleToken) return titleToken;
  const titleNorm = normalizeMetricName(c.title?.split(/[—\-:]/)[0]);
  return titleNorm;
};

const dedupeChartsByMetric = (list: ChartSpec[]) => {
  const seen = new Set<string>();
  const deduped: ChartSpec[] = [];
  list.forEach((c) => {
    const key = metricKeyFromChart(c) || c.id;
    if (!key) {
      deduped.push(c);
      return;
    }
    if (seen.has(key)) return;
    seen.add(key);
    deduped.push(c);
  });
  return deduped;
};

const extractRequestedMetrics = (prompt: string) => {
  const resolved = resolveMetricFromText(prompt);
  const matches = new Set<string>();
  if (resolved) matches.add(resolved);

  // Capture explicit GA4-like tokens (e.g., begin_checkout) to avoid silent fallbacks
  const tokenRe = /\b[a-zA-Z][a-zA-Z0-9_]*\b/g;
  const stop = new Set(["and", "e", "trend", "last", "days", "view", "views", "show", "me", "the", "la", "il", "gli", "con", "in"]);
  let m: RegExpExecArray | null;
  while ((m = tokenRe.exec(prompt)) !== null) {
    const t = m[0].toLowerCase();
    if (stop.has(t)) continue;
    if (t.length < 4 && !t.includes("_")) continue;
    matches.add(normalizeMetricName(t));
  }

  // If both activeUsers and totalUsers matched but prompt doesn't say "total"/"new", keep only activeUsers
  const promptHasTotal = /\btotal\b/i.test(prompt);
  if (matches.has("activeusers") && matches.has("totalusers") && !promptHasTotal) {
    matches.delete("totalusers");
  }

  return Array.from(matches).filter(Boolean);
};

type RunParams = {
  prompt: string;
  filters: StudioFilters;
  charts?: ChartSpec[];
  sourceId?: string | null;
  propertyIdOverride?: string | null;
};

export function useStudioRunner(propertyId: string | null) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runDashboard = useCallback(
    async (params: RunParams): Promise<StudioRunResult> => {
      const effectivePropertyId = params.propertyIdOverride || propertyId;
      if (!effectivePropertyId) {
        throw new Error("Property ID mancante");
      }
      const { prompt, filters, charts: chartsFromCaller, sourceId } = params;
      setLoading(true);
      setError(null);

      try {
        const requestedMetrics = extractRequestedMetrics(prompt.toLowerCase());
        let chartsSkeleton: ChartSpec[] = [];

        if (chartsFromCaller && chartsFromCaller.length) {
          chartsSkeleton = dedupeChartsByMetric(
            chartsFromCaller.map((c, i) => ({
              id: c.id || `chart_${i}`,
              title: c.title || `Grafico ${i + 1}`,
              type: c.type || "table",
              x: c.x || "date",
              y: c.y || "screenPageViews",
              y2: c.y2,
              data: [],
            }))
          );
        } else {
          // Step 1: intent -> charts skeleton
          const intentRes = await fetch("/api/studio/intent", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt,
              propertyId: effectivePropertyId,
              sourceId: sourceId || null,
              filters,
              availableMetrics: AVAILABLE_METRICS,
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
          chartsSkeleton = dedupeChartsByMetric(
            intentCharts.map((c, i) => ({
              id: c.id || `chart_${i}`,
              title: c.title || `Grafico ${i + 1}`,
              type: c.type || "table",
              x: c.x || "date",
              y: c.y || "screenPageViews",
              y2: c.y2,
              data: [],
            }))
          );
        }

        // If user explicitly asked for metrics, filter to those only
        if (requestedMetrics.length) {
          const reqSet = new Set(requestedMetrics);
          chartsSkeleton = chartsSkeleton.filter((c) => {
            const key = normalizeMetricName(metricKeyFromChart(c));
            if (!key) return reqSet.size === 0;
            return reqSet.has(key);
          });
        }

        const allowedSet = new Set(AVAILABLE_METRICS.map((m) => normalizeMetricName(m)));
        const unsupported: ChartSpec[] = [];
        const allowedCharts = chartsSkeleton.filter((c) => {
          const key = normalizeMetricName(metricKeyFromChart(c));
          if (key && !allowedSet.has(key)) {
            unsupported.push({
              ...c,
              title: `${c.title || key} non disponibile per questa property`,
              data: [],
            });
            return false;
          }
          return true;
        });

        if (!allowedCharts.length) {
          if (requestedMetrics.length) {
            return {
              charts: requestedMetrics.map((m, i) => ({
                id: `unsupported_${i}`,
                title: `${m} non disponibile per questa property`,
                type: "table",
                x: "date",
                y: m,
                data: [],
              })) as any,
            };
          }
          return { charts: unsupported.length ? unsupported : [] };
        }

        // Step 2: run -> data
        const runRes = await fetch("/api/studio/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            propertyId: effectivePropertyId,
            sourceId: sourceId || null,
            startDate: filters.startDate,
            endDate: filters.endDate,
            filters,
            charts: allowedCharts.map(({ id, title, type, x, y, y2 }) => ({
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

        const charts = allowedCharts.map((c) => ({
          ...c,
          data: byId[c.id] || [],
        }));

        return { charts: [...charts, ...unsupported] };
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
