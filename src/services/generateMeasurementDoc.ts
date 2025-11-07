import OpenAI from "openai";
import { buildPrompt } from "./buildChatPrompt";

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true, // ✅ consenti uso in ambiente browser
});

type Section = "tags" | "triggers" | "variables";

const SYSTEM_PROMPT =
  "Sei un consulente senior di digital analytics specializzato in Google Tag Manager. Rispondi solo in italiano e in Markdown.";
const API_URL: string | undefined = (import.meta as any)?.env?.VITE_GTM_ANALYZER_API_URL;

/* -------------------------------------------------------------------------- */
/*  Util ▸ divide l’array in chunk sicuri per evitare il context-length error  */
/* -------------------------------------------------------------------------- */
function chunkItems<T>(items: T[], maxChars = 8000): T[][] {
  const chunks: T[][] = [];
  let buffer: T[] = [];
  let size = 0;

  for (const item of items) {
    const itemSize = JSON.stringify(item).length;
    if (size + itemSize > maxChars && buffer.length) {
      chunks.push(buffer);
      buffer = [];
      size = 0;
    }
    buffer.push(item);
    size += itemSize;
  }
  if (buffer.length) chunks.push(buffer);
  return chunks;
}

// Compatta gli item per categoria, rimuovendo campi pesanti
type AnyRec = Record<string, any>;
function compactItemsForCategory(category: Section, items: AnyRec[]): AnyRec[] {
  const pickParams = (params: AnyRec[] | undefined, allowed: string[]) => {
    if (!Array.isArray(params)) return undefined;
    return params
      .filter(p => p && allowed.includes(p.key))
      .map(p => ({ key: p.key, value: p.value }));
  };

  const basePick = (it: AnyRec) => ({
    name: it?.name,
    type: it?.type,
    paused: it?.paused,
    description: it?.description,
  });

  if (category === "tags") {
    return items.map(it => ({
      ...basePick(it),
      tagId: it?.tagId,
      firingTriggerId: it?.firingTriggerId,
      parameter: pickParams(it?.parameter, [
        "eventName",
        "conversionId",
        "conversionLabel",
        "trackingId",
        "consentType",
      ]),
    }));
  }

  if (category === "triggers") {
    return items.map(it => ({
      ...basePick(it),
      triggerId: it?.triggerId,
      parameter: pickParams(it?.parameter, [
        "filter",
        "event",
        "waitForTags",
        "checkValidation",
      ]),
    }));
  }

  // variables
  return items.map(it => ({
    ...basePick(it),
    variableId: it?.variableId,
    parameter: pickParams(it?.parameter, [
      "dataLayerVariable",
      "dataLayerVersion",
      "defaultValue",
      "pattern",
      "selector",
      "javascript",
      "defaultTable",
      "inputVariable",
      "urlPart",
      "cookieName",
    ]),
  }));
}

/* -------------------------------------------------------------------------- */
/*  Chiamata singola al modello: usa server-proxy se configurato              */
/* -------------------------------------------------------------------------- */
async function callChatOnce(userPrompt: string): Promise<string> {
  if (API_URL) {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Proxy error ${res.status}`);
    const data = await res.json();
    return data?.content ?? data?.choices?.[0]?.message?.content ?? "";
  }

  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
  });
  return res.choices[0].message.content ?? "";
}

/* -------------------------------------------------------------------------- */
/*  API ▸ Analizza una singola macro-categoria (Tags / Triggers / Variables)   */
/* -------------------------------------------------------------------------- */
export async function analyzeGtmSection(
  category: Section,
  items: unknown[],
  projectName?: string
): Promise<string> {
  const safeItems = Array.isArray(items) ? (items as AnyRec[]) : [];
  const compacted = compactItemsForCategory(category, safeItems);
  const batches = chunkItems(compacted);
  const out: string[] = [];

  for (const batch of batches) {
    const userPrompt = buildPrompt(category, batch, projectName);

    // Retry semplice con backoff
    let attempt = 0;
    let content = "";
    let lastErr: any;
    while (attempt < 2 && !content) {
      try {
        content = await callChatOnce(userPrompt);
      } catch (e) {
        lastErr = e;
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
        attempt++;
      }
    }

    if (!content) {
      const title = category.charAt(0).toUpperCase() + category.slice(1);
      content = `### ${title} Analysis\n| Nome | Criticità | Impatto | Raccomandazione |\n|------|-----------|---------|-----------------|\n| N/D | Errore di analisi | Batch non processato | Riprovare più tardi |`;
      // Override fallback con stringa UTF-8 corretta
      content = `### ${title} Analysis\n| Nome | Criticità | Impatto | Raccomandazione |\n|------|-----------|---------|-----------------|\n| N/D | Errore di analisi | Batch non processato | Riprovare più tardi |`;
      console.error("analyzeGtmSection fallback:", lastErr);
    }

    out.push(content);
  }

  return out.join("\n\n");
}

/* -------------------------------------------------------------------------- */
/*  Retro-compatibilità ▸ genera l’intero documento completo se serve         */
/* -------------------------------------------------------------------------- */
export async function generateMeasurementDoc({
  tags,
  triggers,
  variables,
  projectName,
}: {
  tags: unknown[];
  triggers: unknown[];
  variables: unknown[];
  projectName?: string;
}): Promise<string> {
  const [tagsMd, triggersMd, variablesMd] = await Promise.all([
    analyzeGtmSection("tags", tags, projectName),
    analyzeGtmSection("triggers", triggers, projectName),
    analyzeGtmSection("variables", variables, projectName),
  ]);

  const summary = `
# Executive Summary

Di seguito trovi l’analisi dettagliata del container GTM relativo al progetto “${
    projectName ?? "Senza nome"
  }”.
L’esame evidenzia criticità operative, di governance e di compliance, con relative azioni di miglioramento.
`;

  return [summary, tagsMd, triggersMd, variablesMd].join("\n\n");
}
