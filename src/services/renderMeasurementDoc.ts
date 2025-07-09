import { Document, Packer, Paragraph } from "docx";
import { saveAs } from "file-saver";
import { marked } from "marked";

/**
 * Converte Markdown → .docx e avvia il download.
 * @param markdown  Testo in Markdown
 * @param fileName  Nome file (default “MeasurementPlan.docx”)
 */
export async function renderMeasurementDoc(
  markdown: string,
  fileName = "MeasurementPlan.docx"
) {
  // Convertiamo il markdown in testo “puro” riga-per-riga
  const html = marked.parse(markdown);
  const textLines = html
    .replace(/<[^>]+>/g, "")
    .split("\n")
    .map((l) => l.trim());

  const doc = new Document({
    sections: [
      {
        children: textLines.map((line) => new Paragraph(line)),
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, fileName);
}