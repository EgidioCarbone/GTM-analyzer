// src/services/generateMeasurementDoc.ts
import { GenerateDocInput } from "../types/gtm";
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

export async function generateMeasurementDoc({
  containerId,
  tag,
  trigger,
  variable,
  clientName,
  publicId,
  now,
  language,
}: GenerateDocInput): Promise<string> {
  
  const intro =
    language === "it"
      ? `Crea un documento di Piano di Misurazione per il cliente ${clientName}. Il contenitore GTM ha ID ${publicId} ed è stato generato il ${now}.`
      : `Create a Measurement Plan document for client ${clientName}. The GTM container ID is ${publicId} and was generated on ${now}.`;

  const systemPrompt =
    language === "it"
      ? `Sei un esperto di Google Tag Manager. Scrivi un documento tecnico che includa introduzione, contesto, elenco dei tag, attivatori e variabili con descrizione e parametri.`
      : `You are a Google Tag Manager expert. Write a technical document with introduction, context, list of tags, triggers and variables with description and parameters.`;

  const userPrompt =
    `${intro}\n\nTAG:\n${JSON.stringify(tag, null, 2)}\n\n` +
    `TRIGGER:\n${JSON.stringify(trigger, null, 2)}\n\n` +
    `VARIABILI:\n${JSON.stringify(variable, null, 2)}`;

  console.log("📦 Prompt inviato a OpenAI:", userPrompt);

  const body = {
    model: "gpt-4",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.5,
  };

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("❌ Errore OpenAI:", error);
    throw new Error(`Errore generazione documento: ${response.status}`);
  }

  const json = await response.json();
  const content = json.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("Risposta vuota da OpenAI");
  }

  console.log("✅ Risposta da OpenAI:", content);

  return content;
}
