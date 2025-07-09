// src/services/generateMeasurementDoc.ts

import { GenerateDocInput } from "../types/gtm";

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;


export async function generateMeasurementDoc({
  container,
  clientName,
  publicId,
  now,
  language,
}: GenerateDocInput): Promise<string> {
  if (!container) throw new Error("Container mancante");

  const tags = container.tag ?? [];
  const triggers = container.trigger ?? [];
  const variables = container.variable ?? [];

  // Intro dinamico
  const intro =
    language === "it"
      ? `Sei un esperto di Web Analytics. Crea un documento di Piano di Misurazione per il contenitore ${publicId} creato il ${now}.`
      : `You are a Web Analytics expert. Create a Measurement Plan document for container ${publicId}, generated on ${now}.`;

  const systemPrompt =
    language === "it"
      ? `Sei un assistente esperto di Google Tag Manager e Web Analytics. Scrivi documenti formali in stile tecnico per piani di misurazione.`
      : `You are an expert assistant in Google Tag Manager and Web Analytics. Write technical-style documents for measurement plans.`;

  const userPrompt = `
${intro}

## Dettagli
Cliente: ${clientName}
ID Contenitore: ${publicId}
Data generazione: ${now}

## Tags
${tags.map((t) => `- ${t.name} (${t.type})`).join("\n")}

## Triggers
${triggers.map((t) => `- ${t.name} (${t.type})`).join("\n")}

## Variabili
${variables.map((v) => `- ${v.name} (${v.type})`).join("\n")}
`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4",
        temperature: 0.6,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Errore OpenAI: ${res.status} - ${errorText}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() ?? "";
  } catch (err: any) {
    console.error("Errore generazione documento:", err);
    return language === "it"
      ? "⚠️ Errore durante la generazione del documento. Prova più tardi."
      : "⚠️ Error generating document. Please try again later.";
  }
}
