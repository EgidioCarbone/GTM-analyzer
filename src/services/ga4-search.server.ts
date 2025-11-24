// @ts-nocheck
import express from "express";
import { BetaAnalyticsDataClient } from "@google-analytics/data";
import { makeReportKey, cacheGet, cacheSet } from "./ga4-cache";
import OpenAI from "openai";

const router = express.Router();
const ga4 = new BetaAnalyticsDataClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/** ───────────── utils date ───────────── */
function coerceDate(yMd?: string) {
  if (!yMd) return null;
  const d = new Date(yMd);
  return isNaN(d.getTime()) ? null : yMd;
}
function dateRangeOrDefault(start?: string, end?: string) {
  const now = new Date();
  const endDef = coerceDate(end) ?? now.toISOString().slice(0, 10);
  const startDef =
    coerceDate(start) ??
    new Date(now.getTime() - 27 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  return { startDate: startDef, endDate: endDef };
}

/** ───────────── parser query IT → dimension/metrics/range ─────────────
 *  Esempi:
 *   - "mobile vs desktop ultimi 30 giorni"
 *   - "top canali per sessioni"
 *   - "pagine con più pageviews ultimi 7 giorni"
 */
function parseQuery(q: string) {
  const text = (q || "").toLowerCase();

  // date
  let days = 28;
  if (/ultimi?\s+7/.test(text)) days = 7;
  else if (/ultimi?\s+30/.test(text)) days = 30;
  else if (/ultimi?\s+90/.test(text)) days = 90;

  const now = new Date();
  const endDate = now.toISOString().slice(0, 10);
  const startDate = new Date(now.getTime() - (days - 1) * 86400000)
    .toISOString()
    .slice(0, 10);

  // dimension
  let dimension: string | null = null;
  if (/device|mobile|desktop|tablet/.test(text)) dimension = "deviceCategory";
  else if (/canali?|sorgente|source|medium/.test(text)) dimension = "defaultChannelGroup";
  else if (/pagine|url|path/.test(text)) dimension = "pagePath";
  else if (/paes[ei]|country/.test(text)) dimension = "country";
  else if (/citt[àa]|city/.test(text)) dimension = "city";

  // metrics
  const metrics: string[] = [];
  if (/revenue|ricavi|fatturat/.test(text)) metrics.push("totalRevenue");
  if (/conversioni|conversions?/.test(text)) metrics.push("conversions");
  if (/eventi|events?/.test(text)) metrics.push("eventCount");
  if (/pageviews?|visualizzazioni/.test(text)) metrics.push("screenPageViews");
  if (/sessioni|sessions?/.test(text) || metrics.length === 0) metrics.push("sessions");
  if (/utenti attivi|active users|activeusers/.test(text)) metrics.push("activeUsers");

  const limit =
    /top\s+(\d{1,2})/.test(text) ? Math.min(50, parseInt(RegExp.$1, 10)) : 10;

  return { startDate, endDate, dimension, metrics, limit };
}

/** ───────────── runQuery dinamico ───────────── */
async function runQuery(propertyId: string, startDate: string, endDate: string, dimension: string | null, metrics: string[], limit: number) {
  // KPI sempre: activeUsers, sessions, screenPageViews, conversions, totalRevenue
  const [kpi] = await ga4.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate }],
    metrics: [
      { name: "activeUsers" },
      { name: "sessions" },
      { name: "screenPageViews" },
      { name: "conversions" },
      { name: "totalRevenue" },
    ],
  });

  const toNum = (v?: string) => (v ? Number(v) : 0);

  const kpis = Object.fromEntries(
    kpi.rows?.[0]?.metricValues?.map((m, i) => [kpi.metricHeaders?.[i]?.name || `m${i}`, toNum(m.value)]) ?? []
  );

  let table = null;

  if (dimension) {
    const [breakdown] = await ga4.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: dimension }],
      metrics: metrics.map((m) => ({ name: m })),
      orderBys: metrics.length
        ? [{ metric: { metricName: metrics[0] }, desc: true }]
        : [{ dimension: { dimensionName: dimension } }],
      limit,
    });

    table = {
      dimension,
      metrics,
      rows:
        (breakdown.rows ?? []).map((r) => {
          const dimVal = r.dimensionValues?.[0]?.value;
          const metricObj: Record<string, number> = {};
          (r.metricValues ?? []).forEach((mv, idx) => {
            const name = breakdown.metricHeaders?.[idx]?.name || `m${idx}`;
            metricObj[name] = toNum(mv.value);
          });
          return { [dimension]: dimVal, ...metricObj };
        }) ?? [],
    };
  }

  return { kpis, table, range: { startDate, endDate } };
}

/** Prompt IA opzionale */
function buildInsightPrompt(q: string, data: any) {
  return `
Sei un analytics lead. Analizza i dati in base alla query utente.

Query: "${q}"
Periodo: ${data?.range?.startDate} → ${data?.range?.endDate}

Dati disponibili (troncati):
${JSON.stringify(data).slice(0, 100000)}

Fornisci:
- 4-6 bullet con numeri chiave
- 3 possibili cause
- 3 azioni prioritarie (con metrica di verifica)
- 1 tabella Markdown "OKR suggeriti" (Obiettivo, KR, Target)

Rispondi in italiano, conciso e azionabile.
`.trim();
}

/** ───────────── Endpoint: GA4 Quick Search ─────────────
 * Body:
 *  {
 *    q: string,
 *    startDate?: 'YYYY-MM-DD',
 *    endDate?: 'YYYY-MM-DD',
 *    limit?: number,
 *    withAI?: boolean,
 *    prompt?: string  // opzionale override del prompt
 *  }
 */
router.post("/api/ga4/search", async (req, res) => {
  try {
    const propertyId = process.env.GA4_PROPERTY_ID;
    if (!propertyId) return res.status(400).json({ error: "GA4_PROPERTY_ID mancante" });

    const q = String(req.body?.q ?? "");
    const userStart = coerceDate(req.body?.startDate);
    const userEnd = coerceDate(req.body?.endDate);
    const userLimit = Number(req.body?.limit ?? 0) || undefined;

    // 1) interpreta query
    const parsed = parseQuery(q);
    const { startDate, endDate } = dateRangeOrDefault(userStart ?? parsed.startDate, userEnd ?? parsed.endDate);
    const dimension = parsed.dimension;
    const metrics = parsed.metrics;
    const limit = userLimit ?? parsed.limit;

    // 2) cache key include schema (dimension+metrics)
    const key = makeReportKey({
      propertyId,
      startDate,
      endDate,
    }) + `|dim:${dimension || "-" }|m:${metrics.join(",")}|l:${limit}`;

    // 3) cache
    const cached = cacheGet(key);
    if (cached) {
      const payload: any = { reportKey: key, range: { startDate, endDate }, ...cached.quickSearch };
      // opzionale IA
      if (req.body?.withAI) {
        const prompt = req.body?.prompt || buildInsightPrompt(q, payload);
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          temperature: 0.2,
          messages: [
            { role: "system", content: "Sei un esperto di digital analytics e growth." },
            { role: "user", content: prompt },
          ],
        });
        payload.ai = { narrative: completion.choices[0]?.message?.content ?? "" };
      }
      return res.json(payload);
    }

    // 4) query GA4
    const { kpis, table, range } = await runQuery(propertyId, startDate, endDate, dimension, metrics, limit);

    // 5) prepara risposta rapida (e salva in cache)
    const quickSearch = { kpis, table };
    cacheSet(key, { ...cached, quickSearch, range, propertyId }, 15 * 60 * 1000);

    const out: any = { reportKey: key, range, ...quickSearch };

    // 6) opzionale IA inline
    if (req.body?.withAI) {
      const prompt = req.body?.prompt || buildInsightPrompt(q, out);
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.2,
        messages: [
          { role: "system", content: "Sei un esperto di digital analytics e growth." },
          { role: "user", content: prompt },
        ],
      });
      out.ai = { narrative: completion.choices[0]?.message?.content ?? "" };
    }

    res.json(out);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err?.message ?? "Errore GA4 Quick Search" });
  }
});

export default router;

