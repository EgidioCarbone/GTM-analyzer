import express, { Request, Response } from "express";

// Tipi condivisi con la UI
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

type IntentBody = {
  prompt: string;
  propertyId?: string;
  filters?: any;
  availableMetrics?: string[];
  availableDimensions?: string[];
};

type IntentResult = {
  charts: Array<{
    id: string;
    title?: string;
    type: ChartType;
    x: "date" | "defaultChannelGroup" | "pagePath" | "deviceCategory" | "country";
    y:
      | "screenPageViews"
      | "sessions"
      | "eventCount"
      | "conversions"
      | "totalRevenue"
      | "activeUsers"
      | "totalUsers";
  }>;
  rangeHintDays?: number;
};

// Normalizzazione semplice
function norm(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Mappa sinonimi → metrica GA4
const METRIC_SYNONYMS: Record<string, Array<string>> = {
  screenPageViews: [
    "page view",
    "pageview",
    "page views",
    "visualizzazioni pagina",
    "pageview totali",
    "pv",
  ],
  sessions: ["sessioni", "sessions"],
  eventCount: ["events", "eventi", "eventi totali", "total events", "event count"],
  conversions: ["conversioni", "conversions"],
  totalRevenue: ["entrate", "ricavi", "revenue", "fatturato"],
  activeUsers: ["utenti attivi", "active users"],
  totalUsers: ["utenti", "utenti totali", "users", "total users"],
};

// Dimensioni “x” scelte dal linguaggio
const DIMENSION_CANDIDATES: Array<{
  key: "date" | "defaultChannelGroup" | "pagePath" | "deviceCategory" | "country";
  triggers: string[];
}> = [
  { key: "defaultChannelGroup", triggers: ["per canale", "channel group", "canali"] },
  { key: "pagePath", triggers: ["per pagina", "per page", "url", "page path"] },
  { key: "deviceCategory", triggers: ["device", "dispositivo", "per device"] },
  { key: "country", triggers: ["paese", "nazione", "country"] },
  { key: "date", triggers: ["per data", "giorno", "daily", "date"] }, // fallback
];

// Grafico dal linguaggio
function detectChartType(t: string): ChartType {
  if (/(trend)/.test(t)) return "line";
  if (/(torta|pie)/.test(t)) return "pie";
  if (/(linea|line)/.test(t)) return "line";
  if (/(barra|bar)/.test(t)) return "bar";
  if (/(area)/.test(t)) return "area";
  if (/(scatter)/.test(t)) return "scatter";
  if (/(scorecard|kpi|numero)/.test(t)) return "scorecard";
  if (/(gauge)/.test(t)) return "gauge";
  if (/(funnel)/.test(t)) return "funnel";
  return "table";
}

// “Ultimi N giorni”
function detectRangeHintDays(t: string): number | undefined {
  const m = t.match(/ultimi\s+(\d{1,3})\s*giorn/i);
  if (!m) return;
  const n = parseInt(m[1], 10);
  if ([7, 28, 30, 90].includes(n)) return n;
  return;
}

// Estrae tutte le metriche presenti nel testo
function extractMetrics(
  t: string,
  allowed?: string[]
): Array<{ y: IntentResult["charts"][number]["y"]; label: string }> {
  const found: Array<{ y: IntentResult["charts"][number]["y"]; label: string }> = [];

  const whitelist = allowed && allowed.length ? new Set(allowed) : null;
  for (const [metric, syns] of Object.entries(METRIC_SYNONYMS)) {
    if (whitelist && !whitelist.has(metric)) continue;
    for (const s of syns) {
      const rex = new RegExp(`\\b${s.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\b`, "i");
      if (rex.test(t)) {
        found.push({
          y: metric as IntentResult["charts"][number]["y"],
          label: s,
        });
        break;
      }
    }
  }

  if (!found.length) {
    const fallback = whitelist && !whitelist.has("screenPageViews") && whitelist.values().next().value
      ? (whitelist.values().next().value as IntentResult["charts"][number]["y"])
      : ("screenPageViews" as IntentResult["charts"][number]["y"]);
    found.push({ y: fallback, label: "page view" });
  }

  return found;
}

// Sceglie la dimensione X
function chooseDimension(t: string, allowed?: string[]): IntentResult["charts"][number]["x"] {
  const txt = " " + t + " ";
  const whitelist = allowed && allowed.length ? new Set(allowed) : null;
  for (const cand of DIMENSION_CANDIDATES) {
    if (whitelist && !whitelist.has(cand.key)) continue;
    for (const trig of cand.triggers) {
      if (txt.includes(` ${trig} `)) return cand.key;
    }
  }
  // fallback: date if allowed, otherwise first available
  if (!whitelist || whitelist.has("date")) return "date";
  const first = whitelist.values().next().value as IntentResult["charts"][number]["x"];
  return first;
}

const router = express.Router();

/**
 * POST /api/studio/intent
 * Body: { prompt }
 * Out: { charts: [...], rangeHintDays? }
 */
router.post("/api/studio/intent", async (req: Request, res: Response) => {
  try {
    const body = req.body as IntentBody;
    const prompt = norm(body?.prompt || "");

    if (!prompt) {
      return res.status(400).json({ error: "Prompt mancante" });
    }

    const type = detectChartType(prompt);
    const x = chooseDimension(prompt, body?.availableDimensions);
    const metrics = extractMetrics(prompt, body?.availableMetrics);
    const rangeHintDays = detectRangeHintDays(prompt);

    const charts = metrics.map((m, idx) => ({
      id: `c_${Date.now()}_${idx + 1}`,
      title: `${m.label} — ${x}`,
      type,
      x,
      y: m.y,
    })) as IntentResult["charts"];

    const out: IntentResult = { charts };
    if (rangeHintDays) out.rangeHintDays = rangeHintDays;

    return res.json(out);
  } catch (err: any) {
    console.error("[studio/intent] error:", err?.message || err);
    return res.status(500).json({ error: "Intent failed" });
  }
});

export default router;
