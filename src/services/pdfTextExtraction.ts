import pdf from 'pdf-parse';
import fs from 'fs/promises';

export interface PDFExtractionResult {
  text: string;
  pageCount: number;
  warnings: string[];
}

export class PDFExtractionError extends Error {
  constructor(
    message: string,
    public code: 'NO_TEXT_CONTENT' | 'INVALID_FILE' | 'EXTRACTION_FAILED' | 'PASSWORD_PROTECTED'
  ) {
    super(message);
    this.name = 'PDFExtractionError';
  }
}

/**
 * Extract plain text from a PDF buffer
 * @param buffer PDF file buffer
 * @returns Extracted text and any warnings
 */
export async function extractPDFTextFromBuffer(buffer: Buffer): Promise<PDFExtractionResult> {
  try {
    // Extract text using pdf-parse
    const data = await pdf(buffer, {
      // Options for better text extraction
      max: 0, // No page limit
      version: 'v1.10.100', // Use specific version for consistency
    });

    const text = (data.text || '').trim();
    const pageCount = data.numpages || data.numrender || 0;
    const warnings: string[] = [];

    // Check if text was extracted
    if (!text || text.length === 0) {
      throw new PDFExtractionError(
        'PDF has no extractable text. Please export the PPT as a text-based PDF (selectable text), not a scanned image.',
        'NO_TEXT_CONTENT'
      );
    }

    // Check for very short text (might be image-only)
    if (text.length < 50) {
      warnings.push('Very short text extracted - PDF might be image-based');
    }

    // Check for common image-only PDF indicators
    const imageOnlyIndicators = [
      'This page cannot be displayed',
      'No text content',
      'Image only',
      'Scanned document'
    ];

    const hasImageOnlyIndicators = imageOnlyIndicators.some(indicator => 
      text.toLowerCase().includes(indicator.toLowerCase())
    );

    if (hasImageOnlyIndicators) {
      warnings.push('PDF appears to contain image-only content');
    }

    // Check for reasonable text length (not too short, not too long)
    if (text.length < 100) {
      warnings.push('Extracted text is very short - please ensure PDF contains selectable text');
    }

    if (text.length > 100000) {
      warnings.push('Extracted text is very long - processing may take longer');
    }

    return {
      text,
      pageCount,
      warnings
    };

  } catch (error) {
    if (error instanceof PDFExtractionError) {
      throw error;
    }

    // Handle password-protected PDFs
    if (error instanceof Error && (
      error.message.includes('Password') || 
      error.message.includes('Encrypted') ||
      error.message.includes('password-protected')
    )) {
      throw new PDFExtractionError(
        'PDF is password-protected and cannot be parsed.',
        'PASSWORD_PROTECTED'
      );
    }

    // Handle PDF parsing errors
    if (error instanceof Error && error.message.includes('Invalid PDF')) {
      throw new PDFExtractionError(
        'Invalid PDF file format',
        'INVALID_FILE'
      );
    }

    // Generic extraction error
    throw new PDFExtractionError(
      `Failed to extract text from PDF: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'EXTRACTION_FAILED'
    );
  }
}

/**
 * Extract plain text from a PDF file
 * @param filePath Path to the PDF file
 * @returns Extracted text and any warnings
 */
export async function extractPDFText(filePath: string): Promise<PDFExtractionResult> {
  try {
    // Read the PDF file
    const dataBuffer = await fs.readFile(filePath);
    
    // Use the buffer-based extraction
    return await extractPDFTextFromBuffer(dataBuffer);

  } catch (error) {
    if (error instanceof PDFExtractionError) {
      throw error;
    }

    // Handle file system errors
    if (error instanceof Error && error.message.includes('ENOENT')) {
      throw new PDFExtractionError(
        'PDF file not found or cannot be read',
        'INVALID_FILE'
      );
    }

    // Generic extraction error
    throw new PDFExtractionError(
      `Failed to extract text from PDF: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'EXTRACTION_FAILED'
    );
  }
}

/**
 * Validate PDF file before processing
 * @param filePath Path to the PDF file
 * @param maxFileSize Maximum allowed file size in bytes
 * @param originalName Original filename (optional, for extension check)
 */
export async function validatePDFFile(filePath: string, maxFileSize: number, originalName?: string): Promise<void> {
  try {
    const stats = await fs.stat(filePath);
    
    console.log('PDF validation details:', {
      filePath,
      size: stats.size,
      maxFileSize,
      sizeMB: Math.round(stats.size / 1024 / 1024 * 100) / 100
    });
    
    if (stats.size === 0) {
      throw new PDFExtractionError('PDF file is empty', 'INVALID_FILE');
    }

    if (stats.size > maxFileSize) {
      throw new PDFExtractionError(
        `PDF file too large. Maximum size: ${Math.round(maxFileSize / 1024 / 1024)}MB`,
        'INVALID_FILE'
      );
    }

    // Check file extension (use original name if available, otherwise file path)
    const fileName = (originalName || filePath).toLowerCase();
    if (!fileName.endsWith('.pdf')) {
      throw new PDFExtractionError('File is not a PDF', 'INVALID_FILE');
    }

    // Check PDF file signature (first 4 bytes should be %PDF)
    const fileBuffer = await fs.readFile(filePath);
    const pdfSignature = fileBuffer.subarray(0, 4).toString();
    const firstBytes = fileBuffer.subarray(0, 16).toString('hex');
    
    console.log('PDF signature check:', {
      pdfSignature,
      firstBytes,
      isValid: pdfSignature === '%PDF',
      fileSize: fileBuffer.length
    });
    
    if (!pdfSignature.startsWith('%PDF')) {
      // Provide more helpful error message
      let errorMessage = 'File is not a valid PDF. ';
      if (pdfSignature.startsWith('PK')) {
        errorMessage += 'This appears to be a ZIP file (possibly a renamed PowerPoint or Word document). Please export as PDF from the original application.';
      } else if (pdfSignature.startsWith('GIF') || pdfSignature.startsWith('PNG') || pdfSignature.startsWith('JPEG')) {
        errorMessage += 'This appears to be an image file. Please convert to PDF first.';
      } else if (pdfSignature.startsWith('<!DOCTYPE') || pdfSignature.startsWith('<html')) {
        errorMessage += 'This appears to be an HTML file. Please convert to PDF first.';
      } else {
        errorMessage += `Expected PDF signature (%PDF), but found: ${pdfSignature} (hex: ${firstBytes.substring(0, 8)}). Please ensure the file is a valid PDF.`;
      }
      
      throw new PDFExtractionError(errorMessage, 'INVALID_FILE');
    }

    // Additional validation: check if file has PDF structure
    const fileContent = fileBuffer.toString('utf8', 0, Math.min(1024, fileBuffer.length));
    if (!fileContent.includes('obj') && !fileContent.includes('endobj')) {
      console.warn('PDF structure validation: File may not have proper PDF structure');
    }

  } catch (error) {
    if (error instanceof PDFExtractionError) {
      throw error;
    }

    if (error instanceof Error && error.message.includes('ENOENT')) {
      throw new PDFExtractionError('PDF file not found', 'INVALID_FILE');
    }

    throw new PDFExtractionError(
      `PDF validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'INVALID_FILE'
    );
  }
}
