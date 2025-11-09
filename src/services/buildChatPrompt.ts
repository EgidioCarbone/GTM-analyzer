import { formatISO } from "date-fns";

/**
 * Costruisce il prompt per una singola macro‑categoria del Measurement Plan.
 * Allinea l'output alle regole PlanAI (descrittivo, niente audit/punteggi).
 */
export function buildPrompt(
  category: "tags" | "triggers" | "variables",
  items: unknown[],
  projectName?: string,
  contextText?: string,
): string {
  const today = formatISO(new Date(), { representation: "date" });
  const itemsJson = JSON.stringify(items, null, 2);

  const introLines = [
    'Sei un analytics engineer senior specializzato in GTM/GA4.',
    `Stai generando una sezione del Measurement Plan per il progetto "${projectName ?? "Progetto senza nome"}" alla data ${today}.`,
    '',
    "CONTEXT fornito dall'utente (usa SOLO queste informazioni se rilevanti):",
    '"""',
    `${contextText ?? "(non fornito)"}`,
    '"""',
    '',
    'REGOLE VINCOLANTI:',
    '- Basati esclusivamente su JSON del container e CONTEXT.',
    '- Non proporre modifiche alla configurazione e non fare audit.',
    '- Linguaggio semplice, professionale, in italiano.',
  ];

  const sectionGuide =
    category === "tags"
      ? [
          'Produci una TABELLA Markdown (senza testo introduttivo o conclusivo) con queste colonne, nell\'ordine esatto e con questi header esatti:',
          '| Nome Tag | Tipo | Dove scatta | Quando scatta | Cosa misura |',
          '|---|---|---|---|---|',
          '',
          'Regole specifiche per la compilazione della tabella:',
          '- "Nome Tag": il nome leggibile del tag.',
          '- "Tipo": es. GA4 Configuration, GA4 Event, HTML personalizzato, ecc.',
          '- "Dove scatta": riassunto delle condizioni/URL principali dei trigger associati.',
          '- "Quando scatta": l\'evento tecnico o l\'interazione (es.: visualizzazione pagina, click su elemento, invio form).',
          '- "Cosa misura": spiegazione in linguaggio naturale basata sui parametri disponibili.',
          '- Se fai riferimento a un trigger, usa SEMPRE il nome del trigger e NON l\'ID.',
          '- Se un\'informazione non è ricavabile, scrivi "Non determinabile con le informazioni disponibili.".',
        ]
      : [];

  return (
    [...introLines, '', `SEZIONE: ${category.toUpperCase()}`, ...sectionGuide, '', '', 'JSON di riferimento (non reincluderlo integralmente, usalo per dedurre le informazioni):', '```json', itemsJson, '```']
      .join('\n')
  );
}
