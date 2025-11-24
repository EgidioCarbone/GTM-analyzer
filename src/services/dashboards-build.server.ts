// src/services/dashboards-build.server.ts
import express from "express";
import { randomUUID } from "crypto";
import { Dashboard, Widget } from "../types/dashboard";

const router = express.Router();

type BuildBody = {
  keywords: string[]; // es: ["page view","eventi","channel group"]
  period: { mode: "relativeDays" | "explicitRange"; relativeDays?: number; startDate?: string; endDate?: string };
  template: "KPI" | "Acquisition" | "Engagement" | "Ecommerce";
  name?: string;
};

// ---------- helpers ----------
const id = () => randomUUID();
const todayISO = () => new Date().toISOString();

function normalizeKeywords(ks: string[]): Set<string> {
  const s = new Set<string>();
  ks.map(k => k.toLowerCase().trim())
    .forEach(k => {
      if (/(page ?views?|pv|visualizzazioni)/i.test(k)) s.add("pageviews");
      if (/(eventi|events?)/i.test(k)) s.add("events");
      if (/(channel|default ?channel ?group)/i.test(k)) s.add("channelGroup");
    });
  return s;
}

// Generator di widget per keyword
function widgetsForKeywords(kw: Set<string>): Widget[] {
  const out: Widget[] = [];

  if (kw.has("pageviews")) {
    out.push(
      {
        id: id(),
        type: "kpi",
        title: "Page Views (totale)",
        query: { metrics: ["screenPageViews"], dateMode: "inherit" }
      },
      {
        id: id(),
        type: "timeseries",
        title: "Page Views — Andamento",
        query: { metrics: ["screenPageViews"], dimensions: ["date"], grain: "day", dateMode: "inherit" }
      },
      {
        id: id(),
        type: "table",
        title: "Top pagine",
        query: {
          metrics: ["screenPageViews", "activeUsers"],
          dimensions: ["pagePath"],
          orderBy: [{ field: "screenPageViews", desc: true }],
          dateMode: "inherit"
        },
        viz: { topN: 20 }
      }
    );
  }

  if (kw.has("events")) {
    out.push(
      {
        id: id(),
        type: "kpi",
        title: "Eventi (count)",
        query: { metrics: ["eventCount"], dateMode: "inherit" }
      },
      {
        id: id(),
        type: "table",
        title: "Top eventi",
        query: {
          metrics: ["eventCount"],
          dimensions: ["eventName"],
          orderBy: [{ field: "eventCount", desc: true }],
          dateMode: "inherit"
        },
        viz: { topN: 20 }
      }
    );
  }

  if (kw.has("channelGroup")) {
    out.push(
      {
        id: id(),
        type: "bar",
        title: "Sessioni per Channel Group",
        query: {
          metrics: ["sessions", "conversions"],
          dimensions: ["defaultChannelGroup"],
          orderBy: [{ field: "sessions", desc: true }],
          dateMode: "inherit"
        },
        viz: { showLegend: true, topN: 12 }
      }
    );
  }

  return out;
}

// Applica “touch” del template
function applyTemplate(tpl: BuildBody["template"], widgets: Widget[]): Widget[] {
  switch (tpl) {
    case "KPI":
      return [
        ...widgets.filter(w => w.type === "kpi"),
        ...widgets.filter(w => w.type !== "kpi")
      ];
    case "Acquisition":
      return [
        ...widgets.filter(w => /Channel Group|channel|source|medium/i.test(w.title)),
        ...widgets.filter(w => !/Channel Group|channel|source|medium/i.test(w.title))
      ];
    case "Engagement":
      return [
        ...widgets.filter(w => /Andamento|Eventi|Page Views/i.test(w.title)),
        ...widgets.filter(w => !/Andamento|Eventi|Page Views/i.test(w.title))
      ];
    case "Ecommerce":
      const hasConv = widgets.some(w => w.query.metrics?.includes("conversions"));
      return hasConv ? widgets : [
        { id: id(), type: "kpi", title: "Conversioni", query: { metrics: ["conversions"], dateMode: "inherit" } },
        ...widgets
      ];
    default:
      return widgets;
  }
}

// ---------- endpoint ----------
router.post("/api/dashboards/build", async (req, res) => {
  try {
    const body = req.body as BuildBody;
    const kw = normalizeKeywords(body.keywords || []);

    if (kw.size === 0) {
      return res.status(400).json({ error: "Nessuna keyword riconosciuta. Usa: page view, eventi, channel group." });
    }

    const widgets = applyTemplate(body.template, widgetsForKeywords(kw));

    const now = todayISO();
    const dash: Dashboard = {
      id: randomUUID(),
      name: body.name || "Dashboard GA4",
      description: "",
      createdAt: now,
      updatedAt: now,
      filters: {
        dateMode: body.period.mode,
        relativeDays: body.period.relativeDays,
        startDate: body.period.startDate,
        endDate: body.period.endDate,
        segments: []
      },
      widgets
    };

    res.json(dash);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
