import OpenAI from "openai";
import { buildPrompt } from "./buildChatPrompt";
import type { SupportedLanguage } from "../i18n/messages";

type AnyRec = Record<string, any>;

const SYSTEM_PROMPT: Record<SupportedLanguage, string> = {
  it: "Sei un consulente senior di digital analytics specializzato in Google Tag Manager. Rispondi solo in italiano e in Markdown.",
  en: "You are a senior digital analytics consultant specialized in Google Tag Manager. Reply only in English and in Markdown.",
};
const API_URL: string | undefined = (import.meta as any)?.env?.VITE_GTM_ANALYZER_API_URL;

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
});

async function callChatOnce(userPrompt: string, language: SupportedLanguage = "it"): Promise<string> {
  const sys = SYSTEM_PROMPT[language] ?? SYSTEM_PROMPT.it;
  if (API_URL) {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-5-mini",
        messages: [
          { role: "system", content: sys },
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
      { role: "system", content: sys },
      { role: "user", content: userPrompt },
    ],
  });
  return res.choices[0].message.content ?? "";
}

export async function polishContext(
  contextText?: string,
  projectName?: string,
  language: SupportedLanguage = "it"
): Promise<string> {
  const fallback =
    language === "en"
      ? "Some details are not specified in the container or provided context."
      : "Alcuni dettagli non sono specificati nel container o nel contesto fornito.";
  if (!contextText || !contextText.trim()) return fallback;

  const userPrompt = buildPrompt("tags", [], projectName, contextText);
  try {
    const polished = await callChatOnce(userPrompt, language);
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
  stats: { totalTags: number; totalTriggers: number; totalVariables: number; pausedCount: number },
  language: SupportedLanguage
): Promise<string> {
  const trimmed = contextText?.trim() ?? "";
  const fallback =
    language === "en"
      ? `No contextual details were provided. The GTM audit for "${projectName ?? "Untitled"}" checks configuration quality across ${stats.totalTags} tags, ${stats.totalTriggers} triggers and ${stats.totalVariables} variables, highlighting ${stats.pausedCount} paused or unused items and the intervention priorities.`
      : `Non sono stati forniti dettagli contestuali. L'audit GTM per "${projectName ?? "Senza nome"}" valuta configurazioni, qualita e coerenza di ${stats.totalTags} tag, ${stats.totalTriggers} trigger e ${stats.totalVariables} variabili, evidenziando ${stats.pausedCount} elementi in pausa o non utilizzati e le priorita di intervento.`;

  const prompt = [
    language === "en"
      ? "Write 1-3 paragraphs of introduction for a GTM Audit."
      : "Scrivi 1-3 paragrafi di introduzione per un Audit GTM.",
    language === "en"
      ? "The introduction must be plain text only (no tables, no bullet lists)."
      : "L'introduzione deve essere SOLO testo discorsivo (nessuna tabella, nessun elenco puntato).",
    language === "en"
      ? "Use only the information provided by the user; improve and expand it without inventing missing data."
      : "Usa esclusivamente le informazioni fornite dall'utente nel contesto, migliorandole e ampliandole senza inventare dati mancanti.",
    language === "en"
      ? "Highlight objectives, scenario, business issues, site type, tracked/to-be-tracked areas, and the purpose of this GTM audit."
      : "Evidenzia obiettivi, scenario, criticita di business, tipologia di sito, aree tracciate o da tracciare, e lo scopo dell'audit GTM per questo caso specifico.",
    language === "en"
      ? "Tone: professional and clear, understandable by non-developers."
      : "Tono: professionale e chiaro, comprensibile anche a non sviluppatori.",
    language === "en"
      ? "Do not use placeholders or generic text; if information is missing, state it explicitly."
      : "Non usare placeholder o testo generico; se mancano informazioni, dichiaralo esplicitamente.",
    `${language === "en" ? "Project" : "Progetto"}: ${projectName ?? (language === "en" ? "Untitled" : "Senza nome")}`,
    language === "en" ? "User context (use only these data):" : "Contesto utente (usa solo questi dati):",
    "'''",
    trimmed || (language === "en" ? "Context not provided." : "Contesto non specificato."),
    "'''",
    language === "en" ? "Available statistics:" : "Statistiche disponibili:",
    `${language === "en" ? "- Tags" : "- Tag"}: ${stats.totalTags}`,
    `- ${language === "en" ? "Triggers" : "Trigger"}: ${stats.totalTriggers}`,
    `- ${language === "en" ? "Variables" : "Variabili"}: ${stats.totalVariables}`,
    language === "en"
      ? `- Paused/unused items: ${stats.pausedCount}`
      : `- Elementi in pausa/non utilizzati: ${stats.pausedCount}`,
  ].join("\n");

  try {
    const intro = await callChatOnce(prompt, language);
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
  language = "it",
}: {
  tags: unknown[];
  triggers: unknown[];
  variables: unknown[];
  projectName?: string;
  contextText?: string;
  language?: SupportedLanguage;
}): Promise<string> {
  const tagsTable = await buildTagsTable(tags, triggers, language);

  const totalTags = Array.isArray(tags) ? tags.length : 0;
  const totalTriggers = Array.isArray(triggers) ? triggers.length : 0;
  const totalVariables = Array.isArray(variables) ? variables.length : 0;
  const pausedCount =
    (Array.isArray(tags) ? (tags as AnyRec[]).filter(t => (t as AnyRec)?.paused).length : 0) +
    (Array.isArray(triggers) ? (triggers as AnyRec[]).filter(t => (t as AnyRec)?.paused).length : 0) +
    (Array.isArray(variables) ? (variables as AnyRec[]).filter(v => (v as AnyRec)?.paused).length : 0);

  const intro = await buildIntroSection(
    contextText,
    projectName,
    {
      totalTags,
      totalTriggers,
      totalVariables,
      pausedCount,
    },
    language
  );

  const summary =
    language === "en"
      ? `# GTM Audit - ${projectName ?? "Untitled"}

## Introduction / Context

${intro}

## Audit Table with Outcome

Below is the audit table with a synthetic outcome for each tag.`
      : `# Audit GTM - ${projectName ?? "Senza nome"}

## Introduzione / Contesto

${intro}

## Tabella Audit con Esito

Di seguito la tabella di audit con valutazione sintetica per ciascun tag.`;

  const pausedLine =
    pausedCount > 0
      ? language === "en"
        ? `Paused/unused items to review: ${pausedCount}.`
        : `Elementi in pausa/non utilizzati da verificare: ${pausedCount}.`
      : language === "en"
      ? "No paused items detected; keep periodic monitoring."
      : "Non risultano elementi in pausa; mantenere un monitoraggio periodico.";
  const coverageLine =
    totalTags + totalTriggers > 0
      ? language === "en"
        ? `Check consistency across ${totalTags} tags and ${totalTriggers} triggers.`
        : `Coerenza tra tag e trigger da validare su ${totalTags} tag e ${totalTriggers} trigger.`
      : language === "en"
      ? "Tag/trigger data not available; validate consistency as soon as possible."
      : "Dati di tag/trigger non disponibili; validare la coerenza appena possibile.";

  const recommendations =
    language === "en"
      ? `## Recommendations

### Key Issues
- ${pausedLine}
- ${coverageLine}

### Technical Suggestions
- Standardize naming and descriptions across tags/triggers/variables (${totalTags}/${totalTriggers}/${totalVariables} items).
- Document purpose and firing conditions in the GTM description field.

### Priority (High / Medium / Low)
- **High**: fix duplicates and wrong firing impacting KPIs or compliance.
- **Medium**: normalize naming, trigger conditions, and align consent.
- **Low**: clean legacy/paused items and minor optimizations.

### Operational Recommendations
- Remove or disable unused tags; review paused items.
- Run a dedicated review on consent mode and custom HTML.
- Apply a governance checklist (naming, description, owner) for new releases.`
      : `## Raccomandazioni

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

function esc(cell: any, language: SupportedLanguage = "it") {
  if (cell === null || cell === undefined) return language === "en" ? "Not specified" : "Non specificato";
  return String(cell).replace(/\|/g, "\\|").replace(/\n/g, " ");
}

export async function buildTagsTable(
  tags: unknown[],
  triggers?: unknown[],
  language: SupportedLanguage = "it"
): Promise<string> {
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
    language === "en"
      ? "You prepare a GTM Audit for non-technical readers."
      : "Sei un assistente che prepara un Audit GTM per lettori non tecnici.",
    language === "en"
      ? "You will receive JSON with fields: name, rawType, params, triggerNames (array), paused."
      : "Riceverai JSON con campi: name, rawType, params, triggerNames (array), paused.",
    language === "en"
      ? 'Return ONLY one Markdown table with headers exactly: | Nome Tag | Tipo | Dove Scatta | Quando Scatta | Cosa Misura | Esito Audit |'
      : 'Restituisci SOLO una tabella Markdown con header esatti: | Nome Tag | Tipo | Dove Scatta | Quando Scatta | Cosa Misura | Esito Audit |',
    language === "en"
      ? 'Esito Audit must be one of: "OK", "Da migliorare", "Critico", "Non utilizzato", "In Pausa".'
      : 'Esito Audit deve essere una di queste stringhe: "OK", "Da migliorare", "Critico", "Non utilizzato", "In Pausa".',
    language === "en"
      ? 'Field "Tipo": choose only among: "GA4 Configuration", "GA4 Event", "GA4 Tag", "HTML personalizzato", "Tag di terze parti", "Altro".'
      : 'Campo "Tipo": scegli solo tra: "GA4 Configuration", "GA4 Event", "GA4 Tag", "HTML personalizzato", "Tag di terze parti", "Altro".',
    language === "en"
      ? 'Field "Dove Scatta": trigger name; if multiple triggers, separate with "; ".'
      : 'Campo "Dove Scatta": nome trigger; se piu trigger, separali con "; ".',
    language === "en"
      ? 'Field "Quando Scatta": short description (max ~18-20 words) in non-technical language about conditions/context; if not determinable use "Non determinabile con le informazioni disponibili."'
      : 'Campo "Quando Scatta": breve descrizione (max 18-20 parole) non tecnica sulle condizioni/contesto; se non determinabile usa "Non determinabile con le informazioni disponibili."',
    language === "en"
      ? 'Field "Cosa Misura": short sentence on what the tag tracks; if not determinable use "Non determinabile con le informazioni disponibili."'
      : 'Campo "Cosa Misura": frase sintetica su cosa traccia il tag; se non determinabile usa "Non determinabile con le informazioni disponibili."',
    language === "en" ? "Do not add any text outside the table." : "Non aggiungere testo extra fuori dalla tabella.",
    "",
    language === "en" ? "Input JSON:" : "Input JSON:",
    "```json",
    JSON.stringify(rowsData, null, 2),
    "```",
  ].join("\n");

  try {
    const aiRes = await callChatOnce(prompt, language);
    if (aiRes && aiRes.trim()) {
      if (aiRes.includes("| Nome Tag") && aiRes.includes("| Esito Audit")) return aiRes.trim();
    }
  } catch (err) {
    console.error("buildTagsTable AI failed:", err);
  }

  const header = `| Nome Tag | Tipo | Dove Scatta | Quando Scatta | Cosa Misura | Esito Audit |
|---------|------|-------------|---------------|-------------|-------------|`;
  const rows = t.map(tag => {
    const name = esc(tag?.name ?? tag?.tagName ?? (language === "en" ? "Not specified" : "Non specificato"), language);
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
    const where = esc(triggerNames || (language === "en" ? "Not specified" : "Non specificato"), language);
    const paused = (tag as AnyRec)?.paused;
    const esito = paused ? "In Pausa" : triggerNames ? "OK" : "Non utilizzato";
    const quando = esc(
      "Non determinabile con le informazioni disponibili.",
      language
    );
    const cosa = esc(
      "Non determinabile con le informazioni disponibili.",
      language
    );
    return `| ${name} | ${esc(typeLabel, language)} | ${where} | ${quando} | ${cosa} | ${esito} |`;
  });
  return [header, ...rows].join("\n");
}
