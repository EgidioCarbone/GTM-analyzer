// src/pages/PlanPage.tsx
import {
  Document,
  Paragraph,
  TextRun,
  Packer,
} from "docx";
import { saveAs } from "file-saver";
import { format } from "date-fns";
import { useState } from "react";
import { useContainer } from "../context/ContainerContext";
import { generateMeasurementDoc } from "../services/generateMeasurementDoc";
import { GenerateDocInput } from "../types/gtm";

export default function PlanPage() {
  const { container } = useContainer();
  const [clientName, setClientName] = useState("");
  const [language, setLanguage] = useState<"it" | "en">("it");
  const [loadingWord, setLoadingWord] = useState(false);
  const [previewText, setPreviewText] = useState<string>("");

  const containerId = container?.containerId || "0000000";
  const publicId = `GTM-${containerId.slice(-7)}`;
  const now = format(new Date(), "d MMMM yyyy 'alle' HH:mm");

  const translate = (it: string, en: string) => (language === "it" ? it : en);

  const exportToWord = async () => {
    if (!container) return;
    console.log("🔍 Container caricato in PlanPage:", container);

    setLoadingWord(true);
    setPreviewText("🧠 Generazione in corso...");

    try {
      const input: GenerateDocInput = {
        containerId: container.containerId ?? "",
        tag: container.tag ?? [],
        trigger: container.trigger ?? [],
        variable: container.variable ?? [],
        clientName,
        publicId,
        now,
        language,
    };

      console.log("📤 Chiamata generateMeasurementDoc con:", input);

      const docText = await generateMeasurementDoc(input);

      setPreviewText(docText); // mostra anche in anteprima

      const paragraphs = docText.split("\n").map((line) =>
        new Paragraph({
          children: [new TextRun({ text: line, size: 24 })],
          spacing: { after: 200 },
        })
      );

      const doc = new Document({ sections: [{ children: paragraphs }] });
      const blob = await Packer.toBlob(doc);
      saveAs(blob, `Piano_Misurazione_${publicId}.docx`);
    } catch (err) {
      console.error("❌ Errore:", err);
      setPreviewText(
        translate(
          "❌ Errore nella generazione del documento. Riprova più tardi.",
          "❌ Error generating the document. Please try again later."
        )
      );
    } finally {
      setLoadingWord(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-2">
        📊 {translate("Piano di Misurazione", "Measurement Plan")}
      </h1>
      <p className="text-gray-600 mb-4">
        {translate("Documento completo del contenitore", "Full container document")}{" "}
        <strong>{publicId}</strong>
      </p>

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          placeholder={translate("Nome Cliente", "Client Name")}
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
          className="border rounded px-2 py-1 flex-1"
        />
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value as "it" | "en")}
          className="border rounded px-2 py-1"
        >
          <option value="it">🇮🇹 Italiano</option>
          <option value="en">🇺🇸 English</option>
        </select>
        <button
          onClick={exportToWord}
          disabled={loadingWord}
          className={`bg-blue-600 text-white px-4 py-1 rounded ${
            loadingWord ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          {loadingWord ? translate("Generazione...", "Generating...") : "Word"}
        </button>
      </div>

      <div className="bg-white border rounded p-4 mb-4">
        <h2 className="font-semibold mb-2">
          {translate("Informazioni Contenitore", "Container Info")}
        </h2>
        <p><strong>ID:</strong> {containerId}</p>
        <p><strong>Public ID:</strong> {publicId}</p>
        <p><strong>{translate("Generato il", "Generated on")}:</strong> {now}</p>
        <p><strong>{translate("Cliente", "Client")}:</strong> {clientName || "-"}</p>
      </div>

      <div className="bg-white border rounded p-4 mb-6">
        <h2 className="font-semibold mb-2">
          {translate("Anteprima del documento", "Document Preview")}
        </h2>
        <p className="text-gray-600 mb-2">
          {translate(
            "Il documento sarà generato automaticamente con descrizione dettagliata dei Tag, Trigger e Variabili tramite IA.",
            "Document will be generated with detailed description of Tags, Triggers and Variables using AI."
          )}
        </p>
        {previewText && (
          <pre className="whitespace-pre-wrap bg-gray-100 p-3 rounded text-sm overflow-auto max-h-[400px]">
            {previewText}
          </pre>
        )}
      </div>
    </div>
  );
}
