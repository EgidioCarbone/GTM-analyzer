import {
  Document,
  Paragraph,
  TextRun,
  Packer,
  Table,
  TableCell,
  TableRow,
  HeadingLevel,
  AlignmentType,
  WidthType,
} from "docx";
import { saveAs } from "file-saver";
import { GenerateDocInput } from "../types/gtm";

interface AIContent {
  intro: string;
  tagDescriptions: Record<string, string>;
  parameterDescriptions?: Record<string, Record<string, string>>;
}

interface Props {
  data: GenerateDocInput;
  aiContent: AIContent;
  publicId: string;
  clientName: string;
  generatedAt: string;
  language: "it" | "en";
}

const t = (it: string, en: string, lang: "it" | "en") =>
  lang === "it" ? it : en;

export async function renderMeasurementDoc({
  data,
  aiContent,
  publicId,
  clientName,
  generatedAt,
  language,
}: Props) {
  const paragraphs: (Paragraph | Table)[] = [];

  // Titolo
  paragraphs.push(
    new Paragraph({
      text: t("📊 Piano di Misurazione", "📊 Measurement Plan", language),
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 300 },
    })
  );

  // Info cliente
  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({ text: t("Cliente", "Client", language) + ": ", bold: true }),
        new TextRun(clientName || "-"),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: t("Contenitore", "Container", language) + ": ", bold: true }),
        new TextRun(publicId),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: t("Generato il", "Generated on", language) + ": ", bold: true }),
        new TextRun(generatedAt),
      ],
    }),
    new Paragraph({
      spacing: { after: 300 },
      children: [new TextRun(aiContent.intro)],
    })
  );

  // Sezione TAG
  paragraphs.push(
    new Paragraph({
      text: "🏷️ TAG",
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 200 },
    })
  );

  for (const tag of data.tag) {
    // Titolo tag
    paragraphs.push(
      new Paragraph({
        text: tag.name,
        heading: HeadingLevel.HEADING_3,
        spacing: { after: 150 },
      })
    );

    // Descrizione AI
    paragraphs.push(
      new Paragraph({
        spacing: { after: 100 },
        children: [
          new TextRun({ text: t("Descrizione", "Description", language) + ": ", bold: true }),
          new TextRun(aiContent.tagDescriptions?.[tag.name] || "-"),
        ],
      })
    );

    // Tabella parametri
    const paramRows: TableRow[] = [];

    // Header
    paramRows.push(
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [new TextRun({ text: t("Parametro", "Parameter", language), bold: true })],
              }),
            ],
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [new TextRun({ text: t("Descrizione", "Description", language), bold: true })],
              }),
            ],
          }),
        ],
      })
    );

    // Parametri del tag
    (tag.parameter || []).forEach((param) => {
      paramRows.push(
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph(param.key)],
            }),
            new TableCell({
              children: [
                new Paragraph(
                  aiContent.parameterDescriptions?.[tag.name]?.[param.key] || "-"
                ),
              ],
            }),
          ],
        })
      );
    });

    if (paramRows.length > 1) {
      paragraphs.push(
        new Table({
          rows: paramRows,
          width: {
            size: 100,
            type: WidthType.PERCENTAGE,
          },
        })
      );
    }
  }

  // Build doc
  const doc = new Document({
    sections: [{ children: paragraphs }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Piano_Misurazione_${publicId}.docx`);
}
