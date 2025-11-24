import fs from 'fs/promises';
import path from 'path';
import { Document, Packer, Paragraph, HeadingLevel, TextRun } from 'docx';

function parseInlineMd(input) {
  const out = [];
  const re = /(\*\*[^*]+\*\*)|(\*[^*]+\*)/g;
  let cursor = 0;
  let m;
  while ((m = re.exec(input))) {
    if (m.index > cursor) {
      out.push(new TextRun({ text: input.slice(cursor, m.index) }));
    }
    const token = m[0];
    const isBold = token.startsWith('**');
    const isItalic = !isBold && token.startsWith('*');
    const clean = token.replace(/^\*{1,2}|\*{1,2}$/g, '');
    out.push(new TextRun({ text: clean, bold: isBold, italics: isItalic }));
    cursor = re.lastIndex;
  }
  if (cursor < input.length) out.push(new TextRun({ text: input.slice(cursor) }));
  return out;
}

function mdToDocxParagraphs(md) {
  const lines = md.split(/\r?\n/);
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      out.push(new Paragraph({ children: [new TextRun({ text: '' })] }));
      continue;
    }

    if (/^#{1,6}\s/.test(line)) {
      const level = line.match(/^#+/)[0].length;
      const text = line.replace(/^#{1,6}\s*/, '');
      out.push(new Paragraph({ heading: level === 1 ? HeadingLevel.HEADING_1 : level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3, children: parseInlineMd(text) }));
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      out.push(new Paragraph({ bullet: { level: 0 }, children: parseInlineMd(line.replace(/^[-*]\s+/, '')) }));
      continue;
    }

    if (line.startsWith('|')) {
      // Skip table conversion for simplicity: render rows as paragraphs
      const tblLines = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tblLines.push(lines[i]);
        i++;
      }
      i--;
      for (const tl of tblLines) {
        out.push(new Paragraph({ children: [new TextRun({ text: tl })] }));
      }
      continue;
    }

    out.push(new Paragraph({ children: parseInlineMd(line) }));
  }
  return out;
}

async function main() {
  try {
    const mdPath = path.join(process.cwd(), 'PianoMisurazione_GTM-PS9LXZN.md');
    const md = await fs.readFile(mdPath, { encoding: 'utf8' });
    const paragraphs = mdToDocxParagraphs(md);

    const doc = new Document({ sections: [{ children: paragraphs }] });
    const buffer = await Packer.toBuffer(doc);
    const outPath = path.join(process.cwd(), 'PianoMisurazione_GTM-PS9LXZN.docx');
    await fs.writeFile(outPath, buffer);
    console.log('DOCX generato:', outPath);
  } catch (err) {
    console.error('Errore generazione docx:', err);
    process.exit(1);
  }
}

main();
