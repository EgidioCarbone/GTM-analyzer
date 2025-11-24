// src/services/studio-run.server.ts
import express, { Request, Response } from "express";
import { BetaAnalyticsDataClient } from "@google-analytics/data";

// ===== Tipi in comune col FE =====
type ChartType =
  | "table"
  | "bar"
  | "line"
  | "pie"
  | "area"
  | "scatter"
  | "scorecard"
  | "gauge"
  | "funnel";

type IncomingChart = {
  id: string;
  title?: string;
  type?: ChartType;
  x?: string; // dimension: date | defaultChannelGroup | pagePath | deviceCategory | country
  y?: string; // metric: screenPageViews | sessions | eventCount | conversions | totalRevenue | activeUsers | totalUsers
  y2?: string;
};

type RunBody = {
  propertyId?: string;
  startDate: string;
  endDate: string;
  charts: IncomingChart[];
};

// ===== Client GA4 =====
const ga4 = new BetaAnalyticsDataClient();

// ===== Helpers =====
const DIM_MAP: Record<string, string> = {
  date: "date",
  defaultChannelGroup: "defaultChannelGroup",
  pagePath: "pagePath",
  deviceCategory: "deviceCategory",
  country: "country",
};

const METRIC_MAP: Record<string, string> = {
  screenPageViews: "screenPageViews",
  sessions: "sessions",
  eventCount: "eventCount",
  conversions: "conversions",
  totalRevenue: "totalRevenue",
  activeUsers: "activeUsers",
  totalUsers: "totalUsers",
};

const toNum = (v?: string) => (v == null ? 0 : Number(v));

function daysBetweenInclusive(a: string, b: string) {
  const d1 = new Date(a + "T00:00:00");
  const d2 = new Date(b + "T00:00:00");
  const diff = Math.round((d2.getTime() - d1.getTime()) / (24 * 3600 * 1000));
  return Math.max(diff + 1, 1);
}

function addDays(iso: string, add: number) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + add);
  return d.toISOString().slice(0, 10);
}

// ==== MOCK DATA (se manca propertyId) ====
function mockDataForChart(c: IncomingChart, startDate: string, endDate: string) {
  const x = c.x || "date";
  const y = c.y || "screenPageViews";

  // Serie giornaliera
  if (x === "date") {
    const days = daysBetweenInclusive(startDate, endDate);
    const base = Math.floor(40 + Math.random() * 50);
    const arr: any[] = [];
    for (let i = 0; i < days; i++) {
      const date = addDays(startDate, i).replace(/-/g, "");
      const jitter = Math.round(base + Math.sin(i / 3) * 20 + Math.random() * 10);
      arr.push({ date, [y]: jitter });
    }
    return arr;
  }

  // Top categorie
  const CATS: Record<string, string[]> = {
    defaultChannelGroup: [
      "Organic Search",
      "Direct",
      "Paid Search",
      "Referral",
      "Social",
      "Email",
      "Display",
    ],
    pagePath: ["/", "/product", "/checkout", "/blog/article-1", "/contact"],
    deviceCategory: ["desktop", "mobile", "tablet"],
    country: ["Italy", "United States", "France", "Germany", "Spain"],
  };

  const values = CATS[x] || ["A", "B", "C", "D", "E"];
  return values.map((label, i) => ({
    [x]: label,
    [y]: Math.floor(50 + (values.length - i) * 30 + Math.random() * 20),
  }));
}

// ====== RUNNER GA4 PER SINGOLO GRAFICO ======
async function runSingleChartGA4(
  propertyId: string,
  startDate: string,
  endDate: string,
  chart: IncomingChart
) {
  const x = chart.x || "date";
  const y = chart.y || "screenPageViews";

  const dim = DIM_MAP[x] || "date";
  const metric = METRIC_MAP[y] || "screenPageViews";

  const request: any = {
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: dim }],
    metrics: [{ name: metric }],
  };

  if (dim === "date") {
    request.orderBys = [{ dimension: { dimensionName: "date" } }];
  } else {
    request.orderBys = [{ metric: { metricName: metric }, desc: true }];
    request.limit = 10;
  }

  try {
    const [resp] = await ga4.runReport(request);
    const rows = resp.rows || [];

    const out: any[] = rows.map((r: any) => {
      const dVal = r.dimensionValues?.[0]?.value ?? "";
      const mVal = toNum(r.metricValues?.[0]?.value);
      return { [dim]: dVal, [metric]: mVal };
    });

    return { id: chart.id, data: out };
  } catch (err: any) {
    return {
      id: chart.id,
      data: [],
      error: err?.message || "GA4 runReport error",
    };
  }
}

// ====== ROUTER ======
const router = express.Router();

/**
 * POST /api/studio/run
 * Body: RunBody
 * Out: { charts: [{ id, data, error? }, ...] }
 */
router.post("/api/studio/run", async (req: Request, res: Response) => {
  try {
    const body = req.body as RunBody;

    const { propertyId, startDate, endDate } = body || {};
    const chartsIn = Array.isArray(body?.charts) ? body.charts : [];

    if (!startDate || !endDate) {
      return res.status(400).json({ error: "startDate e endDate sono obbligatori" });
    }
    if (!chartsIn.length) {
      return res.json({ charts: [] });
    }

    if (!propertyId) {
      const chartsOut = chartsIn.map((c) => ({
        id: c.id,
        data: mockDataForChart(c, startDate, endDate),
      }));
      return res.json({ charts: chartsOut });
    }

    const results = await Promise.all(
      chartsIn.map((c) => runSingleChartGA4(propertyId, startDate, endDate, c))
    );

    res.json({ charts: results });
  } catch (err: any) {
    console.error("[studio/run] fatal:", err?.message || err);
    res.status(500).json({ error: "studio-run failed" });
  }
});

export default router;
