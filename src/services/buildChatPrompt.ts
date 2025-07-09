import { formatISO } from "date-fns";

/**
 * Costruisce il prompt da inviare a GPT per una singola macro-categoria.
 */
export function buildPrompt(
  category: "tags" | "triggers" | "variables",
  items: unknown[],
  projectName?: string
): string {
  const today = formatISO(new Date(), { representation: "date" });
  const itemsJson = JSON.stringify(items, null, 2);

  return `
Sei il massimo esperto (top 0,1 %) di Google Tag Manager e digital analytics.
Stai redigendo un documento ufficiale di assessment per il progetto “${projectName ?? "Progetto senza nome"}”.
Oggi è ${today}.

Analizza la seguente lista di **${category.toUpperCase()}** (estratta da un container GTM).  
Per ciascun elemento individua:

1. **Criticità** (es.: tag in pausa, Universal Analytics, naming incoerente, policy di consenso assente, variabile non usata, trigger orfano…).
2. **Impatto** (breve descrizione delle conseguenze).
3. **Raccomandazione** (azione correttiva concreta o best-practice).

> Restituisci il risultato **in Markdown** con questa struttura:
>
> ### ${category.charAt(0).toUpperCase() + category.slice(1)} Analysis
> | Nome | Criticità | Impatto | Raccomandazione |
> |------|-----------|---------|-----------------|
> | … | … | … | … |
>
> Se non trovi criticità su un elemento, scrivi “—” nelle prime due colonne e “Ottimale” nella raccomandazione.

_Ecco i dati (JSON tecnico, NON reincluderli integralmente):_

\`\`\`json
${itemsJson}
\`\`\`
`;
}