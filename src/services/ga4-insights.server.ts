// @ts-nocheck
import express from "express";
import { BetaAnalyticsDataClient } from "@google-analytics/data";
import OpenAI from "openai";
import { makeReportKey, cacheGet, cacheSet } from "./ga4-cache";
import { makeReportKey, cacheGet, cacheSet, getInflight, setInflight, clearInflight } from "./ga4-cache";

const router = express.Router();
const ga4 = new BetaAnalyticsDataClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ---- util
function dateRangeOrDefault(start?: string, end?: string) {
  const now = new Date();
  const endDef = end ?? now.toISOString().slice(0,10);
  const startDef = start ?? new Date(now.getTime() - 27*24*3600*1000).toISOString().slice(0,10);
  return { startDate: startDef, endDate: endDef };
}

async function runReport(propertyId: string, startDate: string, endDate: string) {
  const [kpi] = await ga4.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate }],
    metrics: [
      { name: "totalUsers" }, { name: "activeUsers" }, { name: "newUsers" },
      { name: "sessions" }, { name: "screenPageViews" }, { name: "eventCount" },
      { name: "conversions" }, { name: "totalRevenue" }, { name: "engagementRate" },
      { name: "averageSessionDuration" },
    ],
  });

  const [timeseries] = await ga4.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "date" }],
    metrics: [{ name: "activeUsers" }, { name: "sessions" }, { name: "screenPageViews" }],
    orderBys: [{ dimension: { dimensionName: "date" } }],
  });

  const [channels] = await ga4.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "defaultChannelGroup" }],
    metrics: [{ name: "sessions" }, { name: "activeUsers" }, { name: "conversions" }],
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    limit: 10,
  });

  const [pages] = await ga4.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "pagePath" }],
    metrics: [{ name: "screenPageViews" }, { name: "activeUsers" }, { name: "conversions" }],
    orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
    limit: 10,
  });

  const toNum = (v?: string) => (v ? Number(v) : 0);

  const kpis = Object.fromEntries(
    kpi.rows?.[0]?.metricValues?.map((m, i) => [kpi.metricHeaders?.[i]?.name || `m${i}`, toNum(m.value)]) ?? []
  );

  const timeseriesData = (timeseries.rows ?? []).map(r => ({
    date: r.dimensionValues?.[0]?.value,
    activeUsers: toNum(r.metricValues?.[0]?.value),
    sessions: toNum(r.metricValues?.[1]?.value),
    pageViews: toNum(r.metricValues?.[2]?.value),
  }));

  const byChannel = (channels.rows ?? []).map(r => ({
    channel: r.dimensionValues?.[0]?.value,
    sessions: toNum(r.metricValues?.[0]?.value),
    users: toNum(r.metricValues?.[1]?.value),
    conversions: toNum(r.metricValues?.[2]?.value),
  }));

  const topPages = (pages.rows ?? []).map(r => ({
    path: r.dimensionValues?.[0]?.value,
    pageViews: toNum(r.metricValues?.[0]?.value),
    users: toNum(r.metricValues?.[1]?.value),
    conversions: toNum(r.metricValues?.[2]?.value),
  }));

  return { kpis, timeseries: timeseriesData, channels: byChannel, pages: topPages };
}

function buildInsightPrompt(data: any, userPrompt?: string) {
  return `
Sei un analytics lead. Analizza i dati GA4.
JSON:
${JSON.stringify(data).slice(0, 120000)}

Fornisci:
1) 5 bullet con numeri chiave.
2) 3 possibili cause.
3) 5 azioni prioritarie.
4) Anomalie/alert.
5) Tabella Markdown "OKR suggeriti".

${userPrompt ? `Nota utente: ${userPrompt}` : ""}
Usa italiano chiaro e non inventare metriche inesistenti.
`.trim();
}

function buildFocusedPrompt(data: any, userPrompt?: string) {
  return `
Sei un analytics lead. Hai a disposizione esclusivamente il seguente JSON (NON fare assunzioni esterne):
${JSON.stringify(data).slice(0, 120000)}

Obiettivo: rispondi SOLO alle richieste dell'utente riportate in fondo.
Regole:
- Non aggiungere sezioni non richieste.
- Usa solamente le metriche presenti nel JSON.
- Se una metrica non è disponibile, scrivi "dato non disponibile".
- Per ogni causa proposta indica l'evidenza nei dati (es. canale X + delta Y%).
- Per ogni azione indica la metrica da monitorare e come misurarla.

Output richiesto (italiano):
1) Bullet sintetici con i numeri chiave rilevanti per la domanda (max 5).
2) Fino a 3 cause plausibili con evidenza.
3) Fino a 3 azioni concrete con metriche di verifica.
4) Eventuali anomalie con riferimenti ai dati (date/canali/pagine).

Nota utente: ${userPrompt ?? ''}

Rispondi in modo diretto e mirato, senza testo introduttivo non richiesto.
`.trim();
}

// ─────────────────────────────────────────────────────────────
// 1) Genera/recupera REPORT GA4 (cache) → ritorna { reportKey, data }
// ─────────────────────────────────────────────────────────────
router.post("/api/ga4/report", async (req, res) => {
  try {
    const propertyId = process.env.GA4_PROPERTY_ID;
    if (!propertyId) return res.status(400).json({ error: "GA4_PROPERTY_ID mancante" });

    const { startDate, endDate } = dateRangeOrDefault(req.body?.startDate, req.body?.endDate);
    const reportKey = makeReportKey({ propertyId, startDate, endDate });

    // hit cache?
    const cached = cacheGet(reportKey);
    if (cached) {
      return res.json({ reportKey, cached: true, ...cached });
    }

    // coalesce richieste identiche in volo
    const wait = getInflight(reportKey);
    if (wait) {
      const value = await wait;
      return res.json({ reportKey, cached: true, ...value });
    }

    // genera nuovo report
    const p = (async () => {
      const report = await runReport(propertyId, startDate, endDate);
      const payload = { ...report, range: { startDate, endDate }, propertyId };
      cacheSet(reportKey, payload, 15 * 60 * 1000); // TTL 15 min
      clearInflight(reportKey);
      return payload;
    })();

    setInflight(reportKey, p);
    const value = await p;
    return res.json({ reportKey, cached: false, ...value });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err?.message ?? "Errore report GA4" });
  }
});

// ─────────────────────────────────────────────────────────────
// 2) Genera INSIGHT AI a partire da reportKey (no chiamata GA4)
// ─────────────────────────────────────────────────────────────
router.post("/api/ga4/insights", async (req, res) => {
  try {
    const propertyId = process.env.GA4_PROPERTY_ID;
    if (!propertyId) return res.status(400).json({ error: "GA4_PROPERTY_ID mancante" });

    const { reportKey, startDate, endDate, prompt, useCache } = req.body ?? {};
    const s = startDate || new Date(Date.now() - 27 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const e = endDate || new Date().toISOString().slice(0, 10);

    let rk = reportKey;
    let reportData: any = null;

    if (rk) {
      reportData = cacheGet(rk);
      if (!reportData) return res.status(404).json({ error: "Report non in cache o scaduto. Rigenera i dati GA4 tramite /api/ga4/report." });
    } else {
      rk = makeReportKey({ propertyId, startDate: s, endDate: e });
      reportData = cacheGet(rk);
      if (!reportData) {
        // Default behavior: generate the report on-demand unless the client explicitly
        // requested cache-only (useCache === true). This avoids forcing the client to
        // call /api/ga4/report first and provides a single-call experience.
        if (useCache === true) {
          return res.status(404).json({ error: 'Report non presente in cache. Chiamare /api/ga4/report per generarlo oppure riprovare senza useCache per generare ora.' });
        }

        // Generate report on-demand, cache it, and continue to build insights.
        const generated = await runReport(propertyId, s, e);
        reportData = { ...generated, range: { startDate: s, endDate: e }, propertyId };
        cacheSet(rk, reportData, 15 * 60 * 1000);
      }
    }

    const aiPrompt = buildFocusedPrompt(reportData, String(prompt ?? ''));

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        { role: 'system', content: 'Sei un esperto di digital analytics e growth.' },
        { role: 'user', content: aiPrompt },
      ],
    });

    const narrative = completion.choices[0]?.message?.content ?? 'Nessun insight generato.';
    res.json({ reportKey: rk, range: { startDate: s, endDate: e }, ...reportData, ai: { narrative } });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err?.message ?? 'Errore IA' });
  }
});

export default router;