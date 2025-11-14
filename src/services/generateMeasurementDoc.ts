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
        model: "gpt-5-mini",
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
    model: "gpt-5-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
  });
  return res.choices[0].message.content ?? "";
}

/**
 * Polishes / rewrites the user-provided CONTEXT via the AI model.
 * Returns a concise, professional Italian paragraph suitable as document introduction.
 * If the model fails or the input is empty, returns a sensible fallback string.
 */
export async function polishContext(
  contextText?: string,
  projectName?: string,
): Promise<string> {
  const fallback = "Alcuni dettagli non sono specificati nel container o nel contesto fornito.";

  // Se non c'è contesto, restituisci fallback più esteso
  if (!contextText || !contextText.trim()) return fallback;

  const userPrompt = [
    `Sei un copywriter tecnico in italiano. Riformula e struttura il seguente CONTEXT in un testo discorsivo (non usare bullet) da inserire nella sezione "Introduzione" di un Measurement Plan.`,
    `Requisiti di formato:`,
    `- Produci un testo continuo di 5–8 righe (1–2 paragrafi massimo).`,
    `- Includi, se presenti nel CONTEXT: cliente/brand, ambito del tracciamento, obiettivi di misurazione, KPI citati, perimetro del documento (cosa copre).`,
    `- Non inserire placeholder tipo "inserire qui". Non inventare dati nuovi. Non usare elenchi né header. Non superare le 12 righe.`,
    `- Restituisci solo il testo riformulato, senza intestazioni, markdown o commenti.`,
    '',
    `CONTEXT da riformulare:`,
    '"""',
    contextText.trim(),
    '"""',
  ].join('\n');

  try {
    const polished = await callChatOnce(userPrompt);
    if (!polished || !polished.trim()) return fallback;
    // Limitare a primi 12 righe: manteniamo il testo così com'è ma tagliamo se troppo lungo
    const lines = polished.trim().split(/\r?\n/).filter(l => l.trim() !== '');
    const clipped = lines.slice(0, 12).join('\n');
    return clipped;
  } catch (err) {
    console.error("polishContext failed:", err);
    return contextText.trim();
  }
}

/* -------------------------------------------------------------------------- */
/*  API ▸ Analizza una singola macro-categoria (Tags / Triggers / Variables)   */
/* -------------------------------------------------------------------------- */
export async function analyzeGtmSection(
  category: Section,
  items: unknown[],
  projectName?: string,
  contextText?: string,
): Promise<string> {
  const safeItems = Array.isArray(items) ? (items as AnyRec[]) : [];
  const compacted = compactItemsForCategory(category, safeItems);
  const batches = chunkItems(compacted);
  const out: string[] = [];

  for (const batch of batches) {
  const userPrompt = buildPrompt(category, batch, projectName, contextText);

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
  contextText,
}: {
  tags: unknown[];
  triggers: unknown[];
  variables: unknown[];
  projectName?: string;
  contextText?: string;
}): Promise<string> {
  // Costruisce la tabella dei tag a partire dal JSON del container (usa AI per normalizzare tipi e descrizioni)
  const tagsTable = await buildTagsTable(tags, triggers);

  // Riformula il CONTEXT tramite AI in modo da ottenere un'introduzione professionale
  const polished = await polishContext(contextText, projectName);

  const summary = `# Measurement Plan — ${projectName ?? "Senza nome"}

## Introduzione

${polished}

## Tag

Obiettivo: fornire una panoramica strutturata dei tag presenti nel container, con informazioni su dove e quando scattano e cosa misurano.

`;

  return [summary, tagsTable].join("\n\n");
}

// Helper: escape pipe characters in table cells
function esc(cell: any) {
  if (cell === null || cell === undefined) return "Non specificato";
  return String(cell).replace(/\|/g, "\\|").replace(/\n/g, " ");
}

// Costruisce una tabella Markdown con le colonne richieste
export async function buildTagsTable(tags: unknown[], triggers?: unknown[]): Promise<string> {
  const t = Array.isArray(tags) ? (tags as AnyRec[]) : [];
  const tr = Array.isArray(triggers) ? (triggers as AnyRec[]) : [];

  // Prepara payload semplificato per l'AI: name, rawType, parameters (breve), triggerNames
  const rowsData = t.map(tag => {
    const triggerIds = tag?.firingTriggerId ? (Array.isArray(tag.firingTriggerId) ? tag.firingTriggerId : [tag.firingTriggerId]) : (tag?.triggerId ? (Array.isArray(tag.triggerId) ? tag.triggerId : [tag.triggerId]) : []);
    const triggerNames = triggerIds.map((id: any) => {
      const f = tr.find(x => x?.triggerId === id || x?.id === id || x?.triggerId === String(id));
      return f?.name ?? String(id ?? 'Non specificato');
    });

    // compact params
    let params: AnyRec | string = {};
    if (Array.isArray(tag?.parameter)) {
      params = {} as AnyRec;
      for (const p of tag.parameter) if (p?.key) params[p.key] = p.value ?? p.type ?? p.name;
    } else if (tag?.parameter && typeof tag.parameter === 'object') {
      params = { ...tag.parameter };
    } else {
      params = {};
    }

    return {
      id: tag?.tagId ?? tag?.id ?? null,
      name: tag?.name ?? tag?.tagName ?? 'Non specificato',
      rawType: tag?.type ?? tag?.tagType ?? '',
      params,
      triggerNames,
    };
  });

  const prompt = [
    'Sei un assistente che aiuta a normalizzare e descrivere tag per un documento destinato a lettori non tecnici.',
    'Riceverai un JSON con elementi: name, rawType, params, triggerNames (array).',
    'Per ciascun elemento, restituisci UNA riga di tabella Markdown con esatti header: | Nome Tag | Tipo | Dove scatta |',
    'Regole per il campo "Tipo": scegli **esattamente** una di queste etichette quando applicabile: "GA4 Configuration", "GA4 Event", "GA4 Tag", "HTML personalizzato", "Tag di terze parti", "Altro". Non usare codici interni (es. gaawe).',
    'Regole per il campo "Dove scatta": scrivi il nome del trigger (non ID). Dopo il nome del trigger aggiungi, tra parentesi, una breve descrizione (1 frase, massimo 18-20 parole) in linguaggio non tecnico che spiega quando/come scatta il tag. Se ci sono più trigger, separali con "; ".',
    'Non inventare dati; se qualcosa non è ricavabile scrivi "Non determinabile con le informazioni disponibili." come descrizione.',
    'Rispondi SOLO con la tabella Markdown e nessun testo aggiuntivo.',
    '',
    'Input JSON:',
    '```json',
    JSON.stringify(rowsData, null, 2),
    '```',
  ].join('\n');

  try {
    const aiRes = await callChatOnce(prompt);
    if (aiRes && aiRes.trim()) {
      // Basic validation: should contain header
      if (aiRes.includes('| Nome Tag') && aiRes.includes('| Tipo')) return aiRes.trim();
    }
  } catch (err) {
    console.error('buildTagsTable AI failed:', err);
  }

  // Fallback deterministico: produce tabella con trigger names (no descrizione AI)
  const header = `| Nome Tag | Tipo | Dove scatta |
|---------|------|-------------|`;
  const rows = t.map(tag => {
    const name = esc(tag?.name ?? tag?.tagName ?? 'Non specificato');
    const raw = String(tag?.type ?? tag?.tagType ?? '');
    // simple map
    const typeLabel = (raw.toLowerCase().includes('gaa') || raw.toLowerCase().includes('ga4')) ? 'GA4 Tag' : (raw.toLowerCase().includes('html') ? 'HTML personalizzato' : 'Altro');
    const ids = tag?.firingTriggerId ? (Array.isArray(tag.firingTriggerId) ? tag.firingTriggerId : [tag.firingTriggerId]) : (tag?.triggerId ? (Array.isArray(tag.triggerId) ? tag.triggerId : [tag.triggerId]) : []);
    const triggerNames = ids.map((id: any) => {
      const f = tr.find(x => x?.triggerId === id || x?.id === id || x?.triggerId === String(id));
      return f?.name ?? String(id ?? 'Non specificato');
    }).join('; ');
    const where = esc(triggerNames || 'Non specificato');
    return `| ${name} | ${esc(typeLabel)} | ${where} |`;
  });
  return [header, ...rows].join('\n');
}
