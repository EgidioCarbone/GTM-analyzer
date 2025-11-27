import OpenAI from "openai";
import { buildPrompt } from "./buildChatPrompt";

type AnyRec = Record<string, any>;

const SYSTEM_PROMPT =
  "Sei un consulente senior di digital analytics specializzato in Google Tag Manager. Rispondi solo in italiano e in Markdown.";
const API_URL: string | undefined = (import.meta as any)?.env?.VITE_GTM_ANALYZER_API_URL;

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
});

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

export async function polishContext(contextText?: string, projectName?: string): Promise<string> {
  const fallback = "Alcuni dettagli non sono specificati nel container o nel contesto fornito.";
  if (!contextText || !contextText.trim()) return fallback;

  const userPrompt = buildPrompt("tags", [], projectName, contextText);
  try {
    const polished = await callChatOnce(userPrompt);
    if (!polished || !polished.trim()) return fallback;
    return polished.trim();
  } catch (err) {
    console.error("polishContext failed:", err);
    return fallback;
  }
}

async function buildIntroSection(
  contextText: string | undefined,
  projectName: string | undefined,
  stats: { totalTags: number; totalTriggers: number; totalVariables: number; pausedCount: number }
): Promise<string> {
  const trimmed = contextText?.trim() ?? "";
  const fallback = `Non sono stati forniti dettagli contestuali. L'audit GTM per "${projectName ?? "Senza nome"}" valuta configurazioni, qualita e coerenza di ${stats.totalTags} tag, ${stats.totalTriggers} trigger e ${stats.totalVariables} variabili, evidenziando ${stats.pausedCount} elementi in pausa o non utilizzati e le priorita di intervento.`;

  const prompt = [
    "Scrivi 1-3 paragrafi di introduzione per un Audit GTM.",
    "L'introduzione deve essere SOLO testo discorsivo (nessuna tabella, nessun elenco puntato).",
    "Usa esclusivamente le informazioni fornite dall'utente nel contesto, migliorandole e ampliandole senza inventare dati mancanti.",
    "Evidenzia obiettivi, scenario, criticita di business, tipologia di sito, aree tracciate o da tracciare, e lo scopo dell'audit GTM per questo caso specifico.",
    "Tono: professionale e chiaro, comprensibile anche a non sviluppatori.",
    "Non usare placeholder o testo generico; se mancano informazioni, dichiaralo esplicitamente.",
    `Progetto: ${projectName ?? "Senza nome"}`,
    "Contesto utente (usa solo questi dati):",
    "'''",
    trimmed || "Contesto non specificato.",
    "'''",
    "Statistiche disponibili:",
    `- Tag: ${stats.totalTags}`,
    `- Trigger: ${stats.totalTriggers}`,
    `- Variabili: ${stats.totalVariables}`,
    `- Elementi in pausa/non utilizzati: ${stats.pausedCount}`,
  ].join("\n");

  try {
    const intro = await callChatOnce(prompt);
    if (intro && intro.trim()) return intro.trim();
  } catch (err) {
    console.error("buildIntroSection failed:", err);
  }
  return fallback;
}

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
  const tagsTable = await buildTagsTable(tags, triggers);

  const totalTags = Array.isArray(tags) ? tags.length : 0;
  const totalTriggers = Array.isArray(triggers) ? triggers.length : 0;
  const totalVariables = Array.isArray(variables) ? variables.length : 0;
  const pausedCount =
    (Array.isArray(tags) ? (tags as AnyRec[]).filter(t => (t as AnyRec)?.paused).length : 0) +
    (Array.isArray(triggers) ? (triggers as AnyRec[]).filter(t => (t as AnyRec)?.paused).length : 0) +
    (Array.isArray(variables) ? (variables as AnyRec[]).filter(v => (v as AnyRec)?.paused).length : 0);

  const intro = await buildIntroSection(contextText, projectName, {
    totalTags,
    totalTriggers,
    totalVariables,
    pausedCount,
  });

  const summary = `# Audit GTM - ${projectName ?? "Senza nome"}

## Introduzione / Contesto

${intro}

## Tabella Audit con Esito

Di seguito la tabella di audit con valutazione sintetica per ciascun tag.`;

  const pausedLine =
    pausedCount > 0
      ? `Elementi in pausa/non utilizzati da verificare: ${pausedCount}.`
      : "Non risultano elementi in pausa; mantenere un monitoraggio periodico.";
  const coverageLine =
    totalTags + totalTriggers > 0
      ? `Coerenza tra tag e trigger da validare su ${totalTags} tag e ${totalTriggers} trigger.`
      : "Dati di tag/trigger non disponibili; validare la coerenza appena possibile.";

  const recommendations = `## Raccomandazioni

### Principali criticita
- ${pausedLine}
- ${coverageLine}

### Suggerimenti tecnici
- Standardizza naming e descrizioni su tag/trigger/variabili (${totalTags}/${totalTriggers}/${totalVariables} elementi).
- Documenta scopo e condizioni di firing nel campo descrizione in GTM.

### Priorita (Alta / Media / Bassa)
- **Alta**: risolvi duplicati e firing errato che impattano KPI o compliance.
- **Media**: normalizza naming, condizioni di trigger e allinea consent.
- **Bassa**: pulizia elementi legacy o in pausa e ottimizzazioni minori.

### Raccomandazioni operative
- Rimuovi o disattiva tag non utilizzati; valuta i tag in pausa.
- Esegui review dedicata a consent mode e custom HTML.
- Applica una checklist di governance (naming, descrizione, owner) per i nuovi rilasci.`;

  return [summary, tagsTable, recommendations].join("\n\n");
}

function esc(cell: any) {
  if (cell === null || cell === undefined) return "Non specificato";
  return String(cell).replace(/\|/g, "\\|").replace(/\n/g, " ");
}

export async function buildTagsTable(tags: unknown[], triggers?: unknown[]): Promise<string> {
  const t = Array.isArray(tags) ? (tags as AnyRec[]) : [];
  const tr = Array.isArray(triggers) ? (triggers as AnyRec[]) : [];

  const rowsData = t.map(tag => {
    const triggerIds = tag?.firingTriggerId
      ? Array.isArray(tag.firingTriggerId)
        ? tag.firingTriggerId
        : [tag.firingTriggerId]
      : tag?.triggerId
      ? Array.isArray(tag.triggerId)
        ? tag.triggerId
        : [tag.triggerId]
      : [];
    const triggerNames = triggerIds.map((id: any) => {
      const f = tr.find(x => x?.triggerId === id || x?.id === id || x?.triggerId === String(id));
      return f?.name ?? String(id ?? "Non specificato");
    });

    return {
      id: tag?.tagId ?? tag?.id ?? null,
      name: tag?.name ?? tag?.tagName ?? "Non specificato",
      rawType: tag?.type ?? tag?.tagType ?? "",
      params: Array.isArray(tag?.parameter) || typeof tag?.parameter === "object" ? tag?.parameter : {},
      triggerNames,
      paused: tag?.paused ?? false,
    };
  });

  const prompt = [
    "Sei un assistente che prepara un Audit GTM per lettori non tecnici.",
    "Riceverai JSON con campi: name, rawType, params, triggerNames (array), paused.",
    'Restituisci SOLO una tabella Markdown con header esatti: | Nome Tag | Tipo | Dove Scatta | Quando Scatta | Cosa Misura | Esito Audit |',
    'Esito Audit deve essere una di queste stringhe: "OK", "Da migliorare", "Critico", "Non utilizzato", "In Pausa".',
    'Campo "Tipo": scegli solo tra: "GA4 Configuration", "GA4 Event", "GA4 Tag", "HTML personalizzato", "Tag di terze parti", "Altro".',
    'Campo "Dove Scatta": nome trigger; se piu trigger, separali con "; ".',
    'Campo "Quando Scatta": breve descrizione (max 18-20 parole) non tecnica sulle condizioni/contesto; se non determinabile usa "Non determinabile con le informazioni disponibili."',
    'Campo "Cosa Misura": frase sintetica su cosa traccia il tag; se non determinabile usa "Non determinabile con le informazioni disponibili."',
    "Non aggiungere testo extra fuori dalla tabella.",
    "",
    "Input JSON:",
    "```json",
    JSON.stringify(rowsData, null, 2),
    "```",
  ].join("\n");

  try {
    const aiRes = await callChatOnce(prompt);
    if (aiRes && aiRes.trim()) {
      if (aiRes.includes("| Nome Tag") && aiRes.includes("| Esito Audit")) return aiRes.trim();
    }
  } catch (err) {
    console.error("buildTagsTable AI failed:", err);
  }

  const header = `| Nome Tag | Tipo | Dove Scatta | Quando Scatta | Cosa Misura | Esito Audit |
|---------|------|-------------|---------------|-------------|-------------|`;
  const rows = t.map(tag => {
    const name = esc(tag?.name ?? tag?.tagName ?? "Non specificato");
    const raw = String(tag?.type ?? tag?.tagType ?? "");
    const typeLabel =
      raw.toLowerCase().includes("gaa") || raw.toLowerCase().includes("ga4")
        ? "GA4 Tag"
        : raw.toLowerCase().includes("html")
        ? "HTML personalizzato"
        : "Altro";
    const ids = tag?.firingTriggerId
      ? Array.isArray(tag.firingTriggerId)
        ? tag.firingTriggerId
        : [tag.firingTriggerId]
      : tag?.triggerId
      ? Array.isArray(tag.triggerId)
        ? tag.triggerId
        : [tag.triggerId]
      : [];
    const triggerNames = ids
      .map((id: any) => {
        const f = tr.find(x => x?.triggerId === id || x?.id === id || x?.triggerId === String(id));
        return f?.name ?? String(id ?? "Non specificato");
      })
      .join("; ");
    const where = esc(triggerNames || "Non specificato");
    const paused = (tag as AnyRec)?.paused;
    const esito = paused ? "In Pausa" : triggerNames ? "OK" : "Non utilizzato";
    const quando = esc("Non determinabile con le informazioni disponibili.");
    const cosa = esc("Non determinabile con le informazioni disponibili.");
    return `| ${name} | ${esc(typeLabel)} | ${where} | ${quando} | ${cosa} | ${esito} |`;
  });
  return [header, ...rows].join("\n");
}
