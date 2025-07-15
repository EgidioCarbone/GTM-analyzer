/* -------------------------------------------------------------------------- */
/*  renderMeasurementDoc.ts                                                   */
/* -------------------------------------------------------------------------- */
/**
 * Genera un documento .docx professionale per il Measurement Plan.
 *
 *  ✅  Logo nel header (SVG o PNG/JPG)
 *  ✅  Titoli H1/H2/H3 → HeadingLevel con descrizione corsiva
 *  ✅  Liste puntate reali
 *  ✅  Tabelle Markdown → tabelle Word full-width con header bold
 *  ✅  Mantiene compatibilità con progetti React/Vite/Webpack/Next.js
 *
 *  USO:
 *    import { renderMeasurementDoc } from "@/services/renderMeasurementDoc";
 *    await renderMeasurementDoc(markdownString); // download auto
 */

import {
  AlignmentType,
  Document,
  HeadingLevel,
  Header,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { saveAs } from "file-saver";

/* -------------------------------------------------------------------------- */
/*  CONFIGURAZIONE                                                            */
/* -------------------------------------------------------------------------- */
const LOGO_PATH = "../img/logo.svg"; // se domani diventa .png non serve cambiare nulla
const DEFAULT_FILENAME = "MeasurementPlan.docx";
const TARGET_LOGO_WIDTH = 160; // px

/* -------------------------------------------------------------------------- */
/*  UTILITY ▸ Ottieni URL runtime dell’asset indipendentemente dal bundler    */
/* -------------------------------------------------------------------------- */
function assetUrl(relativePath: string): string {
  // ESM standard: genera URL assoluto a runtime (funziona in vite, webpack, node, ecc.)
  return new URL(relativePath, import.meta.url).href;
}

/* -------------------------------------------------------------------------- */
/*  UTILITY ▸ Converte qualsiasi logo in ArrayBuffer ready-to-embed           */
/* -------------------------------------------------------------------------- */
async function fetchLogoBuffer(): Promise<ArrayBuffer> {
  const url = assetUrl(LOGO_PATH);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Impossibile caricare il logo (${res.status})`);
  const type = res.headers.get("Content-Type") || "";

  /* ---- Raster già pronto (png / jpg / gif) ------------------------------ */
  if (/image\/(?:png|jpe?g|gif)/i.test(type)) {
    return res.arrayBuffer();
  }

  /* ---- SVG → raster via <canvas> ---------------------------------------- */
  const svgText = await res.text();
  return new Promise<ArrayBuffer>((resolve) => {
    const blob = new Blob([svgText], { type: "image/svg+xml" });
    const svgUrl = URL.createObjectURL(blob);
    const img = new Image();

    img.onload = () => {
      const ratio = TARGET_LOGO_WIDTH / img.width;
      const targetH = img.height * ratio;

      const c = document.createElement("canvas");
      c.width = TARGET_LOGO_WIDTH;
      c.height = targetH;

      const ctx = c.getContext("2d")!;
      ctx.drawImage(img, 0, 0, TARGET_LOGO_WIDTH, targetH);

      c.toBlob((b) => {
        b!.arrayBuffer().then(resolve);
        URL.revokeObjectURL(svgUrl);
      }, "image/png");
    };

    img.onerror = () => {
      URL.revokeObjectURL(svgUrl);
      throw new Error("Errore di rasterizzazione SVG");
    };

    img.src = svgUrl;
  });
}

/* -------------------------------------------------------------------------- */
/*  UTILITY ▸ Inline markdown (bold/italic) → TextRun[]                       */
/* -------------------------------------------------------------------------- */
function parseInlineMd(input: string, forceBold = false): TextRun[] {
  const out: TextRun[] = [];
  const re = /(\*\*[^*]+\*\*)|(\*[^*]+\*)/g;
  let cursor = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(input))) {
    if (m.index > cursor) {
      out.push(new TextRun({ text: input.slice(cursor, m.index), bold: forceBold }));
    }
    const token = m[0];
    const isBold = token.startsWith("**");
    const isItalic = !isBold && token.startsWith("*");
    const clean = token.replace(/^\*{1,2}|\*{1,2}$/g, ""); // trim ** ** o * *

    out.push(new TextRun({ text: clean, bold: isBold || forceBold, italics: isItalic }));
    cursor = re.lastIndex;
  }

  if (cursor < input.length) out.push(new TextRun({ text: input.slice(cursor), bold: forceBold }));
  return out;
}

/* -------------------------------------------------------------------------- */
/*  UTILITY ▸ Costruisci tabella Word da righe markdown                       */
/* -------------------------------------------------------------------------- */
function mdTableToDocx(lines: string[]): Table {
  const rows = lines.map((ln) =>
    ln
      .trim()
      .replace(/^\||\|$/g, "")
      .split("|")
      .map((c) => c.trim()),
  );

  return new Table({
    width: { type: WidthType.PERCENTAGE, size: 100 },
    rows: rows.map((cols, i) =>
      new TableRow({
        children: cols.map(
          (col) =>
            new TableCell({
              children: [
                new Paragraph({
                  children: parseInlineMd(col, i === 0 /* header bold */),
                }),
              ],
              margins: { top: 100, bottom: 100, left: 100, right: 100 },
            }),
        ),
      }),
    ),
  });
}

/* -------------------------------------------------------------------------- */
/*  PARSER ▸ Markdown→(Paragraph|Table)[]                                     */
/* -------------------------------------------------------------------------- */
function parseMarkdown(md: string): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  const lines = md.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    /* ---------- HEADINGS (# ## ###) -------------------------------------- */
    if (/^#{1,6}\s/.test(line)) {
      const level = line.match(/^#+/)![0].length;
      const text = line.replace(/^#{1,6}\s*/, "");

      out.push(
        new Paragraph({
          heading:
            level === 1
              ? HeadingLevel.HEADING_1
              : level === 2
              ? HeadingLevel.HEADING_2
              : HeadingLevel.HEADING_3,
          spacing: { after: 200 },
          children: parseInlineMd(text, true),
        }),
      );

      out.push(
        new Paragraph({
          spacing: { after: 300 },
          children: [new TextRun({ text: `Descrizione: ${text}`, italics: true })],
        }),
      );
      continue;
    }

    /* ---------- LISTE ---------------------------------------------------- */
    if (/^[-*]\s+/.test(line)) {
      out.push(
        new Paragraph({
          bullet: { level: 0 },
          children: parseInlineMd(line.replace(/^[-*]\s+/, "")),
        }),
      );
      continue;
    }

    /* ---------- TABELLE -------------------------------------------------- */
    if (line.startsWith("|")) {
      const tblLines = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tblLines.push(lines[i]);
        i++;
      }
      i--; // backtrack ultima riga letta
      out.push(mdTableToDocx(tblLines));
      continue;
    }

    /* ---------- PARAGRAFO SEMPLICE -------------------------------------- */
    if (line) {
      out.push(
        new Paragraph({
          spacing: { after: 200 },
          children: parseInlineMd(line),
        }),
      );
    }
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/*  API  ▸ renderMeasurementDoc                                               */
/* -------------------------------------------------------------------------- */
/**
 * @param markdown  Contenuto in markdown prodotto dall’IA (/plan)
 * @param fileName  Nome file (opzionale, default "MeasurementPlan.docx")
 */
export async function renderMeasurementDoc(
  markdown: string,
  fileName: string = DEFAULT_FILENAME,
): Promise<void> {
  /* Logo ------------------------------------------------------------------- */
  const logoBuf = await fetchLogoBuffer();
  const logoImg = new ImageRun({
    data: logoBuf,
    transformation: { width: TARGET_LOGO_WIDTH, height: 50 }, // altezza si adatta
  });

  /* Parsing contenuto ------------------------------------------------------- */
  const body = parseMarkdown(markdown);

  /* Documento --------------------------------------------------------------- */
  const doc = new Document({
    sections: [
      {
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [logoImg],
              }),
              new Paragraph({}), // spaziatura
            ],
          }),
        },
        children: body,
      },
    ],
  });

  /* Download ---------------------------------------------------------------- */
  const blob = await Packer.toBlob(doc);
  saveAs(blob, fileName);
}