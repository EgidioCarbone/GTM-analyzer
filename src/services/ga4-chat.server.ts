// src/services/ga4-chat.server.ts
import express from "express";
import { z } from "zod";
import OpenAI from "openai";
import { dumpStore } from "./ga4-cache";

const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Defaults per fallback, se la cache/account non forniscono abbastanza segnali
const defaultAvailable = {
  metrics: ["sessions", "activeUsers", "screenPageViews", "conversions"],
  dimensions: ["country", "deviceCategory", "sourceMedium", "pagePath"],
  events: ["page_view", "form_submit"],
};

// Deriva disponibilità da cache/account (no chiamate GA live qui)
function getAvailabilityFromCache(propertyId?: string) {
  const out = { metrics: new Set<string>(), dimensions: new Set<string>(), events: new Set<string>() };
  try {
    const snapshot = dumpStore();
    for (const item of snapshot) {
      const val: any = item.value;
      // opzionale: filtra per propertyId se presente nei record
      if (propertyId && val?.propertyId && String(val.propertyId) !== String(propertyId)) continue;
      // metriche dai KPI
      if (val?.kpis && typeof val.kpis === 'object') {
        Object.keys(val.kpis).forEach((k) => out.metrics.add(k));
      }
      // dimensioni da table (quickSearch)
      if (val?.quickSearch?.table?.dimension) out.dimensions.add(String(val.quickSearch.table.dimension));
      if (Array.isArray(val?.quickSearch?.table?.metrics)) {
        (val.quickSearch.table.metrics as string[]).forEach((m) => out.metrics.add(String(m)));
      }
      // dimensioni note da sezioni
      if (Array.isArray(val?.channels)) out.dimensions.add("defaultChannelGroup");
      if (Array.isArray(val?.timeseries)) out.dimensions.add("date");
      if (Array.isArray(val?.pages)) out.dimensions.add("pagePath");
      // eventi
      if (Array.isArray(val?.events)) {
        for (const ev of val.events) {
          const name = ev?.eventName || ev?.event || ev?.name;
          if (name) out.events.add(String(name));
        }
      }
    }
  } catch {}
  const metrics = Array.from(out.metrics);
  const dimensions = Array.from(out.dimensions);
  const events = Array.from(out.events);
  return {
    metrics: metrics.length ? metrics : defaultAvailable.metrics,
    dimensions: dimensions.length ? dimensions : defaultAvailable.dimensions,
    events: events.length ? events : defaultAvailable.events,
  };
}

// Effettua una POST JSON con timeout
async function postJSON(url: string, body: any, timeoutMs = 5000): Promise<{ ok: boolean; status: number; json: any }> {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body || {}),
      signal: ctrl.signal,
    } as any);
    let data: any = null;
    try { data = await res.json(); } catch {}
    return { ok: !!res.ok, status: res.status, json: data };
  } catch (e) {
    return { ok: false, status: 0, json: null };
  } finally {
    clearTimeout(to);
  }
}

// Prova a popolare la cache tramite endpoint interni (senza IA)
async function warmUpCache(baseUrl: string) {
  try {
    const q1 = postJSON(`${baseUrl}/api/ga4/search`, { q: 'top canali per sessioni', withAI: false });
    const q2 = postJSON(`${baseUrl}/api/ga4/search`, { q: 'pagine con più pageviews ultimi 7 giorni', withAI: false });
    const out = await Promise.all([q1, q2]);
    return out.some(r => r.ok);
  } catch {
    return false;
  }
}

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
  // Usa SOLO metrica/e già sanitizzate nell'intent.
  const requestedMetrics = Array.isArray(intent.metrics) ? intent.metrics : [];

  // Generatore demo per valori numerici (per metriche consentite)
  const sampleForMetric = (metric: string) => {
    switch (metric) {
      case 'sessions': return 1234;
      case 'activeUsers': return 900;
      case 'screenPageViews': return 4200;
      case 'conversions': return 42;
      default: return Math.floor(Math.random() * 1000);
    }
  };

  // KPI riassuntivi per le metriche richieste
  const metricsSummary: Record<string, number> = {};
  for (const m of requestedMetrics) {
    metricsSummary[m] = sampleForMetric(m);
  }

  // Riconoscimento TREND: se periodo copre >1 giorno e c'è almeno una metrica
  const start = new Date(range.startDate);
  const end = new Date(range.endDate);
  const diffDays = Math.max(0, Math.round((end.getTime() - start.getTime()) / (24*3600*1000)));
  const enableTrend = diffDays >= 1 && requestedMetrics.length > 0;

  // timeseries strutturata: [{ date: 'YYYY-MM-DD', metric1: n, metric2: n }]
  let timeseries: Array<Record<string, any>> | null = null;
  if (enableTrend) {
    const points = Math.min(30, diffDays + 1); // limita a 30 punti
    timeseries = [];
    for (let i=0;i<points;i++) {
      const d = new Date(end.getTime() - (points-1-i)*24*3600*1000);
      const obj: Record<string, any> = { date: d.toISOString().slice(0,10) };
      for (const m of requestedMetrics) {
        const base = sampleForMetric(m);
        obj[m] = Math.max(1, Math.round(base * (0.6 + 0.4*Math.random()) / 30));
      }
      timeseries.push(obj);
    }
  }

  return {
    range,
    focusEvent: intent.focusEvent || null,
    metricsRequested: requestedMetrics,
    metricsSummary,
    timeseries,
  };
}

// 5) Prompt IA per narrativa finale
function buildNarrativePrompt(
  question:string,
  facts:any,
  unavailable?: { metrics: string[]; dimensions: string[]; events: string[] },
  intent?: z.infer<typeof IntentSchema>
) {
  // Make the focus explicit in the prompt so the model pays attention to metrics/focusEvent
  const focusNote = facts?.focusEvent ? `FOCUS EVENT: ${facts.focusEvent}\n` : '';
  const requested = Array.isArray(facts?.metricsRequested) && facts.metricsRequested.length > 0 ? `REQUESTED METRICS: ${facts.metricsRequested.join(', ')}\n` : '';
  const missingParts:string[] = [];
  if (unavailable?.metrics?.length) missingParts.push(`Metriche non disponibili: ${unavailable.metrics.join(', ')}`);
  if (unavailable?.events?.length) missingParts.push(`Eventi non disponibili: ${unavailable.events.join(', ')}`);
  if (unavailable?.dimensions?.length) missingParts.push(`Dimensioni non disponibili: ${unavailable.dimensions.join(', ')}`);
  const missing = missingParts.length ? `\nNota: ${missingParts.join(' | ')}. Non inventare numeri per elementi non disponibili.` : '';

  return `
Sei un analista digitale senior. Spiega i risultati per la domanda: "${question}".

${focusNote}${requested}
Dati (JSON):
${JSON.stringify(facts).slice(0, 120000)}

INTENT VALIDATO:
${JSON.stringify(intent || {}, null, 0)}

Fornisci un output markdown chiaro:
- Sintesi breve con le 3 cifre chiave (usa il periodo fornito).
- Analisi: trend, cause probabili, segmenti/canali/pagine rilevanti.
- 3–5 “Azioni raccomandate” con ipotesi di impatto e come misurarle.
- Se la domanda riguarda un evento (es. purchase), focalizzati su quello.
- Evita di inventare numeri non presenti nei dati; se un dato non c'è, dillo.
${missing}
Regole importanti:
- Usa SOLO i numeri presenti nel blocco Dati (JSON) qui sopra.
- Se alcune richieste non sono disponibili (${missingParts.length ? missingParts.join(' | ') : 'nessuna'}), dichiaralo e NON inventare valori.
`;
}

// 6) Prompt IA per il parser (output strutturato)
function buildParserPrompt(userQuery:string, available:{metrics:string[];dimensions:string[];events:string[]}) {
  return `
Sei un parser di intenti per interrogazioni su dati GA4 (cache). Restituisci SOLO un JSON valido con la struttura sotto.
- NON inventare campi o valori.
- Usa SOLO elementi presenti nelle liste disponibili.
- Periodo: usa explicitRange/relativeDays/relativeWeeks/relativeMonths/auto secondo la richiesta (es. "ultimi 7 giorni" => relativeDays=7). Se non specifica => mode="auto".
- Sinonimi comuni: utenti=activeUsers, sessioni=sessions, visualizzazioni=screenPageViews, conversioni=conversions, dispositivo=deviceCategory, paese=country, sorgente/medium=sourceMedium, pagina=pagePath.

Domanda utente: "${userQuery}"
Disponibili:
{
  "availableMetrics": ${JSON.stringify(available.metrics)},
  "availableDimensions": ${JSON.stringify(available.dimensions)},
  "availableEvents": ${JSON.stringify(available.events)}
}

Output richiesto (SOLO JSON):
{
  "question": string,
  "period": {
    "mode": "explicitRange"|"relativeDays"|"relativeWeeks"|"relativeMonths"|"auto",
    "startDate"?: "YYYY-MM-DD",
    "endDate"?: "YYYY-MM-DD",
    "value"?: number
  },
  "metrics": string[],
  "dimensions": string[],
  "focusEvent"?: string,
  "filters": [{"field": string, "op": string, "value": any}],
  "grain": "day"|"week"|"month"
}
`;
}

// Sanitizza l'intento in base alle liste disponibili
function sanitizeIntent(intent: z.infer<typeof IntentSchema>, available:{metrics:string[];dimensions:string[];events:string[]}) {
  const metrics = new Set(available.metrics);
  const dimensions = new Set(available.dimensions);
  const events = new Set(available.events);
  const out = { ...intent } as any;
  out.metrics = (intent.metrics || []).filter((m:string) => metrics.has(m));
  out.dimensions = (intent.dimensions || []).filter((d:string) => dimensions.has(d));
  if (intent.focusEvent && !events.has(intent.focusEvent)) delete out.focusEvent;
  out.filters = (intent.filters || []).filter((f:any) => f && dimensions.has(String(f.field)));
  if (!['day','week','month'].includes(out.grain)) out.grain = 'day';
  return out as z.infer<typeof IntentSchema>;
}

// Crea una semplice specifica di grafico basata sul riepilogo metriche
function buildChartSpec(intent: z.infer<typeof IntentSchema>, facts: any) {
  if (Array.isArray(facts?.timeseries) && facts.timeseries.length > 1) {
    // Supporta sia formato {label,value,metric} (legacy) sia {date, metric1, metric2}
    const first = facts.timeseries[0];
    if (first && typeof first === 'object' && 'date' in first) {
      const metric = (intent.metrics || []).find((m) => m in first) || Object.keys(first).find(k => k !== 'date') || null;
      if (metric) {
        return {
          type: 'line',
          labels: facts.timeseries.map((p:any) => p.date),
          values: facts.timeseries.map((p:any) => Number(p[metric]) || 0),
          metric,
        };
      }
    } else if ('label' in (first || {})) {
      const metric = (first as any).metric || (intent.metrics?.[0] || null);
      return {
        type: 'line',
        labels: facts.timeseries.map((p:any) => p.label),
        values: facts.timeseries.map((p:any) => Number(p.value) || 0),
        metric,
      };
    }
  }
  const entries = Object.entries(facts?.metricsSummary || {}).filter(([,v]) => typeof v === 'number');
  if (entries.length > 1) {
    return {
      type: 'bar',
      labels: entries.map(([k]) => String(k)),
      values: entries.map(([,v]) => Number(v)),
      metric: null,
    };
  }
  return null;
}

// 7) Endpoint principale
router.post("/api/ga4/chat", async (req, res) => {
  try {
    const userQuery: string = req.body?.query ?? "";
    if (!userQuery) return res.status(400).json({ error: "query mancante" });
    const propertyId = process.env.GA4_PROPERTY_ID;
    let available = getAvailabilityFromCache(propertyId);
    // Warm-up: se le liste sono troppo scarne, chiama /api/ga4/search per popolare cache
    const richness = (available.metrics?.length || 0) + (available.dimensions?.length || 0) + (available.events?.length || 0);
    if (richness < 3) {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      await warmUpCache(baseUrl).catch(() => {});
      available = getAvailabilityFromCache(propertyId);
    }

    // (A) PARSER
    const parser = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        { role: "system", content: "Sei un parser che restituisce solo JSON valido."},
        { role: "user", content: buildParserPrompt(userQuery, available) }
      ]
    });

    const raw = parser.choices[0]?.message?.content ?? "{}";
    let parserError: string | null = null;
    let intent: z.infer<typeof IntentSchema>;
    try {
      intent = IntentSchema.parse(JSON.parse(raw));
    } catch (e:any) {
      parserError = e?.message || 'parse_error';
      intent = IntentSchema.parse({ question: userQuery, period: { mode: 'auto' }, metrics: [], dimensions: [], filters: [], grain: 'day' });
    }
    // Filtra secondo disponibilità
    const intentOriginal = intent;
    intent = sanitizeIntent(intent, available);
    const unavailable = {
      metrics: (intentOriginal.metrics || []).filter((m) => !available.metrics.includes(m)),
      dimensions: (intentOriginal.dimensions || []).filter((d) => !available.dimensions.includes(d)),
      events: intentOriginal.focusEvent && !available.events.includes(intentOriginal.focusEvent) ? [intentOriginal.focusEvent] : [],
    };

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
        { role: "user", content: buildNarrativePrompt(intent.question, facts, unavailable, intent) }
      ]
    });

    const narrative = narrativeResp.choices[0]?.message?.content ?? "Nessun insight generato.";
    const chart = buildChartSpec(intent, facts);

    // (E) Risposta (compatibile con la tua pagina Insights)
    res.json({ range, ai: { narrative, chart: chart ?? null } , debug: { steps: [
      "Tool initialized",
      "Intent parsed",
      "Range resolved",
      "Cache queried",
      "Narrative generated"
    ], parserRaw: raw, intent, unavailable, available, parserError }});
  } catch (err:any) {
    console.error(err);
    res.status(500).json({ error: err?.message ?? "Errore server" });
  }
});

export default router;
