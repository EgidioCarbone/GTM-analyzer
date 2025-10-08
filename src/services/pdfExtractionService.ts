// PDF Text Extraction Service
// ============================================================================

import pdf from 'pdf-parse';
import { Readable } from 'stream';

export interface PDFExtractionResult {
  text: string;
  pages: number;
  metadata: {
    title?: string;
    author?: string;
    creator?: string;
    producer?: string;
    creationDate?: Date;
    modificationDate?: Date;
  };
  warnings: string[];
}

export class PDFExtractionService {
  private maxFileSize: number;
  private maxPages: number;

  constructor(maxFileSize: number = 10 * 1024 * 1024, maxPages: number = 100) {
    this.maxFileSize = maxFileSize;
    this.maxPages = maxPages;
  }

  async extractText(file: File): Promise<PDFExtractionResult> {
    // Validate file size
    if (file.size > this.maxFileSize) {
      throw new Error(`File too large. Maximum size: ${this.maxFileSize / (1024 * 1024)}MB`);
    }

    // Validate file type
    if (file.type !== 'application/pdf') {
      throw new Error('File must be a PDF');
    }

    try {
      // Convert File to Buffer
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Extract text using pdf-parse
      const data = await pdf(buffer, {
        // Options for better text extraction
        normalizeWhitespace: true,
        disableCombineTextItems: false,
      });

      // Validate page count
      if (data.numpages > this.maxPages) {
        throw new Error(`Too many pages. Maximum: ${this.maxPages}`);
      }

      // Clean and structure the extracted text
      const cleanedText = this.cleanExtractedText(data.text);
      
      return {
        text: cleanedText,
        pages: data.numpages,
        metadata: {
          title: data.info?.Title,
          author: data.info?.Author,
          creator: data.info?.Creator,
          producer: data.info?.Producer,
          creationDate: data.info?.CreationDate ? new Date(data.info.CreationDate) : undefined,
          modificationDate: data.info?.ModDate ? new Date(data.info.ModDate) : undefined,
        },
        warnings: this.generateWarnings(data, cleanedText),
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`PDF extraction failed: ${error.message}`);
      }
      throw new Error('PDF extraction failed: Unknown error');
    }
  }

  private cleanExtractedText(text: string): string {
    // Remove excessive whitespace and normalize line breaks
    let cleaned = text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();

    // Remove common PDF artifacts
    cleaned = cleaned
      .replace(/\f/g, '\n') // Form feed characters
      .replace(/\u00A0/g, ' ') // Non-breaking spaces
      .replace(/\u2013|\u2014/g, '-') // En/em dashes
      .replace(/\u2018|\u2019/g, "'") // Smart quotes
      .replace(/\u201C|\u201D/g, '"') // Smart double quotes
      .replace(/\u2026/g, '...'); // Ellipsis

    return cleaned;
  }

  private generateWarnings(data: any, cleanedText: string): string[] {
    const warnings: string[] = [];

    // Check for very short content
    if (cleanedText.length < 100) {
      warnings.push('Extracted text is very short - PDF may be image-based or corrupted');
    }

    // Check for excessive whitespace
    const whitespaceRatio = (cleanedText.match(/\s/g) || []).length / cleanedText.length;
    if (whitespaceRatio > 0.5) {
      warnings.push('High whitespace ratio - text extraction may be poor quality');
    }

    // Check for missing metadata
    if (!data.info?.Title && !data.info?.Author) {
      warnings.push('Missing PDF metadata - may affect context understanding');
    }

    // Check for very long lines (potential formatting issues)
    const lines = cleanedText.split('\n');
    const longLines = lines.filter(line => line.length > 200);
    if (longLines.length > lines.length * 0.1) {
      warnings.push('Many long lines detected - text formatting may be poor');
    }

    return warnings;
  }

  // Extract structured content from PDF text (titles, bullets, etc.)
  extractStructuredContent(text: string): {
    titles: string[];
    bullets: string[];
    speakerNotes: string[];
    rawText: string;
  } {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    const titles: string[] = [];
    const bullets: string[] = [];
    const speakerNotes: string[] = [];
    
    for (const line of lines) {
      // Detect titles (short lines, often in caps or title case)
      if (line.length < 100 && (
        line === line.toUpperCase() || 
        /^[A-Z][a-z]/.test(line) ||
        /^Slide \d+/i.test(line) ||
        /^Page \d+/i.test(line)
      )) {
        titles.push(line);
      }
      // Detect bullets
      else if (/^[•\-\*\+]\s/.test(line) || /^\d+\.\s/.test(line)) {
        bullets.push(line);
      }
      // Detect speaker notes (often in parentheses or brackets)
      else if (/^\(.*\)$/.test(line) || /^\[.*\]$/.test(line)) {
        speakerNotes.push(line);
      }
    }

    return {
      titles,
      bullets,
      speakerNotes,
      rawText: text,
    };
  }
}

// Singleton instance
export const pdfExtractionService = new PDFExtractionService();
