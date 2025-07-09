import OpenAI from "openai";
import { buildPrompt } from "./buildChatPrompt";

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true, // ✅ consenti uso in ambiente browser
});

type Section = "tags" | "triggers" | "variables";

/* -------------------------------------------------------------------------- */
/*  Util ▸ divide l’array in chunk sicuri per evitare il context-length error  */
/* -------------------------------------------------------------------------- */
function chunkItems<T>(items: T[], maxChars = 15000): T[][] {
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

/* -------------------------------------------------------------------------- */
/*  API ▸ Analizza una singola macro-categoria (Tags / Triggers / Variables)   */
/* -------------------------------------------------------------------------- */
export async function analyzeGtmSection(
  category: Section,
  items: unknown[],
  projectName?: string
): Promise<string> {
  const batches = chunkItems(items);
  const out: string[] = [];

  for (const batch of batches) {
    const userPrompt = buildPrompt(category, batch, projectName);

    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",           // utilizzo modello coerente con il tuo piano
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "Sei un consulente senior di digital analytics specializzato in Google Tag Manager. Rispondi solo in italiano e in Markdown.",
        },
        { role: "user", content: userPrompt },
      ],
    });

    out.push(res.choices[0].message.content ?? "");
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