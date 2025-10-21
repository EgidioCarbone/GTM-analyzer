// src/services/ga4-chat.server.ts
import express from "express";
import { z } from "zod";
import OpenAI from "openai";

const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 1) Schema dello Structured Output del parser
const IntentSchema = z.object({
  question: z.string(),
  period: z.object({
    mode: z.enum(["explicitRange", "relativeDays", "relativeWeeks", "relativeMonths", "auto"]).default("auto"),
    startDate: z.string().optional(), // YYYY-MM-DD se explicitRange
    endDate: z.string().optional(),
    value: z.number().optional(),     // es. 7 se relativeDays
  }),
  metrics: z.array(z.string()).default([]),        // es. ["sessions","activeUsers","purchase"]
  dimensions: z.array(z.string()).default([]),     // es. ["country","deviceCategory"]
  focusEvent: z.string().optional(),               // es. "purchase"
  filters: z.array(z.object({ field: z.string(), op: z.string(), value: z.any() })).default([]),
  grain: z.enum(["day","week","month"]).default("day")
});

// 2) Helpers
const fmt = (d: Date) => d.toISOString().slice(0,10);
function resolveRange(p: z.infer<typeof IntentSchema>["period"]): {startDate:string; endDate:string} {
  const today = new Date();
  if (p.mode === "explicitRange" && p.startDate && p.endDate) return { startDate: p.startDate, endDate: p.endDate };
  if (p.mode === "relativeDays" && p.value) {
    const end = today; const start = new Date(end.getTime() - (p.value - 1)*24*3600*1000);
    return { startDate: fmt(start), endDate: fmt(end) };
  }
  if (p.mode === "relativeWeeks" && p.value) {
    const end = today; const start = new Date(end.getTime() - (p.value*7 - 1)*24*3600*1000);
    return { startDate: fmt(start), endDate: fmt(end) };
  }
  if (p.mode === "relativeMonths" && p.value) {
    const end = today; const start = new Date(end); start.setMonth(start.getMonth()-p.value);
    return { startDate: fmt(start), endDate: fmt(end) };
  }
  // default: ultimi 28 giorni
  const end = today; const start = new Date(end.getTime() - 27*24*3600*1000);
  return { startDate: fmt(start), endDate: fmt(end) };
}

// 3) Catalogo delle metriche che sai estrarre dalla tua cache GA4
const MetricCatalog = {
  sessions: "sessions",
  activeUsers: "activeUsers",
  screenPageViews: "screenPageViews",
  conversions: "conversions",
  purchase: "purchase" // se lo estrai mappando eventName == 'purchase'
} as const;
type MetricKey = keyof typeof MetricCatalog;

// 4) Finto data-runner su cache (sostituisci con le tue funzioni reali!)
async function runFromCache(range:{startDate:string;endDate:string}, intent: z.infer<typeof IntentSchema>) {
  // Qui richiami le tue funzioni che leggono report già salvati (no GA4 live!)
  // Esempio: getKpis(range, intent), getTrend(range, intent), ecc.
  // Per il contratto “solo narrative”, basta comporre un piccolo “facts” object:
  // Build a facts object that reflects the requested metrics and any focus event
  const requestedMetrics = Array.isArray(intent.metrics) && intent.metrics.length > 0 ? intent.metrics : [];

  // Helper to produce sample numbers per metric (demo/mock)
  const sampleForMetric = (metric: string) => {
    switch (metric) {
      case 'sessions': return 1234;
      case 'activeUsers': return 900;
      case 'screenPageViews': return 4200;
      case 'conversions': return 42;
      case 'purchase': return 19;
      default: return Math.floor(Math.random() * 1000);
    }
  };

  const metricsSummary: Record<string, number | undefined> = {};
  if (requestedMetrics.length > 0) {
    for (const m of requestedMetrics) {
      metricsSummary[m] = sampleForMetric(m);
    }
  } else {
    // default set for backward compatibility
    metricsSummary.sessions = 1234;
    metricsSummary.activeUsers = 900;
    metricsSummary.conversions = 42;
    if (intent.focusEvent === 'purchase') metricsSummary.purchase = 19;
  }

  // If a focusEvent is provided but not present in metrics, ensure it's included
  if (intent.focusEvent && !metricsSummary[intent.focusEvent]) {
    metricsSummary[intent.focusEvent] = sampleForMetric(intent.focusEvent);
  }

  const facts = {
    range,
    focusEvent: intent.focusEvent || null,
    metricsRequested: requestedMetrics,
    metricsSummary,
    comparisons: {
      vsPrev: { sessionsPct: +0.12, conversionsPct: -0.05 }
    },
    topSignals: [
      { label: "Organic Search", deltaPct: +18 },
      { label: "/checkout", deltaPct: -12 }
    ]
  };
  return facts;
}

// 5) Prompt IA per narrativa finale
function buildNarrativePrompt(question:string, facts:any) {
  // Make the focus explicit in the prompt so the model pays attention to metrics/focusEvent
  const focusNote = facts?.focusEvent ? `FOCUS EVENT: ${facts.focusEvent}\n` : '';
  const requested = Array.isArray(facts?.metricsRequested) && facts.metricsRequested.length > 0 ? `REQUESTED METRICS: ${facts.metricsRequested.join(', ')}\n` : '';

  return `
Sei un analista digitale senior. Spiega i risultati per la domanda: "${question}".

${focusNote}${requested}
Dati (JSON):
${JSON.stringify(facts).slice(0, 120000)}

Fornisci un output markdown chiaro:
- Sintesi breve con le 3 cifre chiave (usa il periodo fornito).
- Analisi: trend, cause probabili, segmenti/canali/pagine rilevanti.
- 3–5 “Azioni raccomandate” con ipotesi di impatto e come misurarle.
- Se la domanda riguarda un evento (es. purchase), focalizzati su quello.
- Evita di inventare numeri non presenti nei dati; se un dato non c'è, dillo.
`;
}

// 6) Prompt IA per il parser (output strutturato)
function buildParserPrompt(userQuery:string) {
  return `
Estrarre in JSON la struttura dell'intento dell'utente per interrogare dati GA4 (cache).
Non inventare date se non presenti; se l'utente dice "ultimi 7 giorni" indica relativeDays = 7.

Domanda utente: "${userQuery}"

Campi JSON richiesti:
{
  "question": string,
  "period": {
    "mode": "explicitRange"|"relativeDays"|"relativeWeeks"|"relativeMonths"|"auto",
    "startDate"?: "YYYY-MM-DD",
    "endDate"?: "YYYY-MM-DD",
    "value"?: number
  },
  "metrics": string[],          // es: ["sessions","activeUsers","purchase"]
  "dimensions": string[],       // es: ["country","deviceCategory"]
  "focusEvent"?: string,        // es: "purchase"
  "filters": [{"field": string, "op": string, "value": any}] ,
  "grain": "day"|"week"|"month"
}
Rispondi SOLO con il JSON.
`;
}

// 7) Endpoint principale
router.post("/api/ga4/chat", async (req, res) => {
  try {
    const userQuery: string = req.body?.query ?? "";
    if (!userQuery) return res.status(400).json({ error: "query mancante" });

    // (A) PARSER
    const parser = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        { role: "system", content: "Sei un parser che restituisce solo JSON valido."},
        { role: "user", content: buildParserPrompt(userQuery) }
      ]
    });

    const raw = parser.choices[0]?.message?.content ?? "{}";
    let intent = IntentSchema.parse(JSON.parse(raw));

    // (B) Risolvi periodo (se auto/relative)
    const range = resolveRange(intent.period);

    // (C) Preleva dati dalla cache
    const facts = await runFromCache(range, intent);

    // (D) Narrativa
    const narrativeResp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: "Sei un analytics lead, pragmatico e conciso." },
        { role: "user", content: buildNarrativePrompt(intent.question, facts) }
      ]
    });

    const narrative = narrativeResp.choices[0]?.message?.content ?? "Nessun insight generato.";

    // (E) Risposta (compatibile con la tua pagina Insights)
    res.json({ range, ai: { narrative } , debug: { steps: [
      "Tool initialized",
      "Intent parsed",
      "Range resolved",
      "Cache queried",
      "Narrative generated"
    ]}});
  } catch (err:any) {
    console.error(err);
    res.status(500).json({ error: err?.message ?? "Errore server" });
  }
});

export default router;
