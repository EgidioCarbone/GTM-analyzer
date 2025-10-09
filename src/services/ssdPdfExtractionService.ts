// SSD PDF Extraction Service
// Extracts text content from PDF files for SSD test generation
// ============================================================================

import fs from 'fs/promises';
import pdf from 'pdf-parse';

export interface PDFExtractionResult {
  text: string;
  pageCount: number;
  metadata: {
    title?: string;
    author?: string;
    subject?: string;
    creator?: string;
  };
  warnings: string[];
}

export class PDFExtractionError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'PDFExtractionError';
  }
}

/**
 * Extract text content from a PDF file
 * @param filePath - Path to the PDF file
 * @returns Extracted text and metadata
 */
export async function extractPDFText(filePath: string): Promise<PDFExtractionResult> {
  try {
    // Read PDF file
    const pdfBuffer = await fs.readFile(filePath);
    
    // Parse PDF content
    const pdfData = await pdf(pdfBuffer, {
      // Configuration options for better text extraction
      max: 0, // No page limit
      version: 'v1.10.100', // Use specific PDF.js version for consistency
    });

    const warnings: string[] = [];
    
    // Validate extracted text
    if (!pdfData.text || pdfData.text.trim().length === 0) {
      throw new PDFExtractionError(
        'No text content found in PDF. Please ensure the PDF contains text-based content (not just images).',
        'NO_TEXT_CONTENT'
      );
    }

    // Check if text seems too short (might be image-based PDF)
    if (pdfData.text.trim().length < 100) {
      warnings.push('PDF contains very little text. Consider using a text-based PDF for better results.');
    }

    // Clean up text content
    const cleanedText = cleanExtractedText(pdfData.text);

    return {
      text: cleanedText,
      pageCount: pdfData.numpages,
      metadata: {
        title: pdfData.info?.Title,
        author: pdfData.info?.Author,
        subject: pdfData.info?.Subject,
        creator: pdfData.info?.Creator,
      },
      warnings,
    };

  } catch (error) {
    if (error instanceof PDFExtractionError) {
      throw error;
    }

    // Handle specific PDF parsing errors
    if (error instanceof Error) {
      if (error.message.includes('Invalid PDF')) {
        throw new PDFExtractionError(
          'Invalid PDF file format. Please ensure the file is a valid PDF.',
          'INVALID_PDF'
        );
      }
      
      if (error.message.includes('Password required')) {
        throw new PDFExtractionError(
          'PDF is password protected. Please provide an unprotected PDF.',
          'PASSWORD_PROTECTED'
        );
      }
    }

    throw new PDFExtractionError(
      `Failed to extract text from PDF: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'EXTRACTION_FAILED'
    );
  }
}

/**
 * Clean and normalize extracted text content
 */
function cleanExtractedText(text: string): string {
  return text
    // Remove excessive whitespace
    .replace(/\s+/g, ' ')
    // Remove page numbers and headers/footers (common patterns)
    .replace(/\b\d+\s*$/gm, '') // Page numbers at end of lines
    .replace(/^.*\|\s*\d+\s*$/gm, '') // Headers with page numbers
    .replace(/^.*\s+\d+\s*$/gm, '') // Footers with page numbers
    // Remove common PDF artifacts
    .replace(/[^\w\s\-.,;:!?()[\]{}'"@#$%&*+=<>/\\|~`]/g, ' ')
    // Normalize line breaks
    .replace(/\n\s*\n/g, '\n\n')
    // Trim whitespace
    .trim();
}

/**
 * Validate PDF file before extraction
 */
export async function validatePDFFile(filePath: string, maxSizeBytes: number = 10 * 1024 * 1024): Promise<void> {
  try {
    const stats = await fs.stat(filePath);
    
    if (stats.size === 0) {
      throw new PDFExtractionError('PDF file is empty', 'EMPTY_FILE');
    }
    
    if (stats.size > maxSizeBytes) {
      throw new PDFExtractionError(
        `PDF file is too large. Maximum size allowed: ${Math.round(maxSizeBytes / 1024 / 1024)}MB`,
        'FILE_TOO_LARGE'
      );
    }
    
  } catch (error) {
    if (error instanceof PDFExtractionError) {
      throw error;
    }
    
    throw new PDFExtractionError(
      `Failed to validate PDF file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'VALIDATION_FAILED'
    );
  }
}
