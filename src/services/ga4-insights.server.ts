// src/services/ga4-insights.server.ts
// @ts-nocheck

import express from "express";
import { BetaAnalyticsDataClient } from "@google-analytics/data";
import OpenAI from "openai";

const router = express.Router();
const ga4 = new BetaAnalyticsDataClient();
const openai = process.env.OPENAI_API_KEY 
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

// Funzione utilità per fallback date
function dateRangeOrDefault(start?: string, end?: string) {
  const now = new Date();
  const endDef = end ?? now.toISOString().slice(0, 10);
  const startDef = start ?? new Date(now.getTime() - 27 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  return { startDate: startDef, endDate: endDef };
}

// Costruisce il prompt da inviare all'IA
function buildInsightPrompt(data: any, userPrompt?: string) {
  return `
Sei un analytics lead. Analizza i dati GA4.
JSON:
${JSON.stringify(data).slice(0, 120000)}

Fornisci:
1) Sintesi in 5 bullet con numeri.
2) 3 possibili cause (per canale/pagina/eventi).
3) 5 azioni prioritarie (cosa fare, come misurare l'impatto).
4) Anomalie/alert (se presenti).
5) Tabella markdown "OKR suggeriti" (Obiettivo, KRs, target).

${userPrompt ? `Nota utente: ${userPrompt}` : ""}
Usa italiano chiaro, tecnico ma leggibile. Non inventare metriche.
  `;
}

// Funzione che chiama le reportistiche GA4
async function runReport(propertyId: string, startDate: string, endDate: string) {
  const toNum = (v?: string) => (v ? Number(v) : 0);

  const [kpi] = await ga4.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate }],
    metrics: [
      { name: "totalUsers" },
      { name: "activeUsers" },
      { name: "newUsers" },
      { name: "sessions" },
      { name: "screenPageViews" },
      { name: "eventCount" },
      { name: "conversions" },
      { name: "totalRevenue" },
      { name: "engagementRate" },
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

  const [events] = await ga4.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "eventName" }],
    metrics: [{ name: "eventCount" }, { name: "conversions" }, { name: "totalRevenue" }],
    orderBys: [{ metric: { metricName: "conversions" }, desc: true }],
    limit: 15,
  });

  const [journeys] = await ga4.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [
      { name: "sessionDefaultChannelGroup" },
      { name: "landingPage" },
      { name: "eventName" },
    ],
    metrics: [{ name: "conversions" }],
    orderBys: [{ metric: { metricName: "conversions" }, desc: true }],
    metricAggregations: ["TOTAL"],
    limit: 30,
  });

  const kpis = Object.fromEntries(
    kpi.rows?.[0]?.metricValues?.map((m, i) => [kpi.metricHeaders?.[i]?.name, toNum(m.value)]) ?? []
  );

  const timeseriesData = (timeseries.rows ?? []).map((r) => ({
    date: r.dimensionValues?.[0]?.value,
    activeUsers: toNum(r.metricValues?.[0]?.value),
    sessions: toNum(r.metricValues?.[1]?.value),
    pageViews: toNum(r.metricValues?.[2]?.value),
  }));

  const byChannel = (channels.rows ?? []).map((r) => ({
    channel: r.dimensionValues?.[0]?.value,
    sessions: toNum(r.metricValues?.[0]?.value),
    users: toNum(r.metricValues?.[1]?.value),
    conversions: toNum(r.metricValues?.[2]?.value),
  }));

  const topPages = (pages.rows ?? []).map((r) => ({
    path: r.dimensionValues?.[0]?.value,
    pageViews: toNum(r.metricValues?.[0]?.value),
    users: toNum(r.metricValues?.[1]?.value),
    conversions: toNum(r.metricValues?.[2]?.value),
  }));

  const topEvents = (events.rows ?? []).map((r) => ({
    eventName: r.dimensionValues?.[0]?.value,
    eventCount: toNum(r.metricValues?.[0]?.value),
    conversions: toNum(r.metricValues?.[1]?.value),
    revenue: toNum(r.metricValues?.[2]?.value),
  }));

  const journeyData = (journeys.rows ?? []).map((r) => ({
    channel: r.dimensionValues?.[0]?.value,
    landingPage: r.dimensionValues?.[1]?.value,
    eventName: r.dimensionValues?.[2]?.value,
    conversions: toNum(r.metricValues?.[0]?.value),
  }));

  return {
    kpis,
    timeseries: timeseriesData,
    channels: byChannel,
    pages: topPages,
    events: topEvents,
    journeys: journeyData,
  };
}

// ROUTA: /api/ga4/insights
router.post("/api/ga4/insights", async (req, res) => {
  try {
    const propertyId = process.env.GA4_PROPERTY_ID;
    if (!propertyId) return res.status(400).json({ error: "GA4_PROPERTY_ID mancante" });

    if (!openai) {
      return res.status(503).json({ error: "OpenAI API key non configurata" });
    }

    const { startDate, endDate, prompt } = req.body ?? {};
    const { startDate: s, endDate: e } = dateRangeOrDefault(startDate, endDate);

    const data = await runReport(propertyId, s, e);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: "Sei un esperto di digital analytics e growth." },
        { role: "user", content: buildInsightPrompt(data, prompt) },
      ],
    });

    const narrative = completion.choices[0]?.message?.content ?? "Nessun insight generato.";
    res.json({ range: { startDate: s, endDate: e }, ...data, ai: { narrative } });

  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err?.message ?? "Errore server" });
  }
});

export default router;
