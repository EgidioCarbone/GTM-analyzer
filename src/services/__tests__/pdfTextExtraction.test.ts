import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractPDFTextFromBuffer, PDFExtractionError } from '../pdfTextExtraction';

// Mock pdf-parse
vi.mock('pdf-parse', () => ({
  default: vi.fn()
}));

import pdf from 'pdf-parse';

describe('PDF Text Extraction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('extractPDFTextFromBuffer', () => {
    it('should extract text from valid PDF buffer', async () => {
      const mockPdfData = {
        text: 'This is test PDF content with multiple lines.\nSecond line of content.',
        numpages: 2,
        numrender: 2
      };

      vi.mocked(pdf).mockResolvedValue(mockPdfData);

      const buffer = Buffer.from('%PDF-1.4\n%Test content');
      const result = await extractPDFTextFromBuffer(buffer);

      expect(result).toEqual({
        text: 'This is test PDF content with multiple lines.\nSecond line of content.',
        pageCount: 2,
        warnings: []
      });
      expect(pdf).toHaveBeenCalledWith(buffer, {
        max: 0,
        version: 'v1.10.100'
      });
    });

    it('should handle PDF with no extractable text', async () => {
      const mockPdfData = {
        text: '',
        numpages: 1,
        numrender: 1
      };

      vi.mocked(pdf).mockResolvedValue(mockPdfData);

      const buffer = Buffer.from('%PDF-1.4\n%Empty content');
      
      await expect(extractPDFTextFromBuffer(buffer)).rejects.toThrow(
        PDFExtractionError
      );
      await expect(extractPDFTextFromBuffer(buffer)).rejects.toThrow(
        'PDF has no extractable text. Please export the PPT as a text-based PDF (selectable text), not a scanned image.'
      );
    });

    it('should handle password-protected PDF', async () => {
      vi.mocked(pdf).mockRejectedValue(new Error('Password required'));

      const buffer = Buffer.from('%PDF-1.4\n%Encrypted content');
      
      await expect(extractPDFTextFromBuffer(buffer)).rejects.toThrow(
        PDFExtractionError
      );
      await expect(extractPDFTextFromBuffer(buffer)).rejects.toThrow(
        'PDF is password-protected and cannot be parsed.'
      );
    });

    it('should handle encrypted PDF', async () => {
      vi.mocked(pdf).mockRejectedValue(new Error('Encrypted PDF'));

      const buffer = Buffer.from('%PDF-1.4\n%Encrypted content');
      
      await expect(extractPDFTextFromBuffer(buffer)).rejects.toThrow(
        PDFExtractionError
      );
      await expect(extractPDFTextFromBuffer(buffer)).rejects.toThrow(
        'PDF is password-protected and cannot be parsed.'
      );
    });

    it('should generate warnings for very short text', async () => {
      const mockPdfData = {
        text: 'Short',
        numpages: 1,
        numrender: 1
      };

      vi.mocked(pdf).mockResolvedValue(mockPdfData);

      const buffer = Buffer.from('%PDF-1.4\n%Short content');
      const result = await extractPDFTextFromBuffer(buffer);

      expect(result.warnings).toContain('Very short text extracted - PDF might be image-based');
      expect(result.warnings).toContain('Extracted text is very short - please ensure PDF contains selectable text');
    });

    it('should generate warnings for image-only indicators', async () => {
      const mockPdfData = {
        text: 'This page cannot be displayed',
        numpages: 1,
        numrender: 1
      };

      vi.mocked(pdf).mockResolvedValue(mockPdfData);

      const buffer = Buffer.from('%PDF-1.4\n%Image content');
      const result = await extractPDFTextFromBuffer(buffer);

      expect(result.warnings).toContain('PDF appears to contain image-only content');
    });

    it('should generate warnings for very long text', async () => {
      const longText = 'A'.repeat(150000);
      const mockPdfData = {
        text: longText,
        numpages: 10,
        numrender: 10
      };

      vi.mocked(pdf).mockResolvedValue(mockPdfData);

      const buffer = Buffer.from('%PDF-1.4\n%Long content');
      const result = await extractPDFTextFromBuffer(buffer);

      expect(result.warnings).toContain('Extracted text is very long - processing may take longer');
    });

    it('should handle PDF parsing errors', async () => {
      vi.mocked(pdf).mockRejectedValue(new Error('Invalid PDF'));

      const buffer = Buffer.from('Not a PDF');
      
      await expect(extractPDFTextFromBuffer(buffer)).rejects.toThrow(
        PDFExtractionError
      );
      await expect(extractPDFTextFromBuffer(buffer)).rejects.toThrow(
        'Invalid PDF file format'
      );
    });

    it('should handle generic extraction errors', async () => {
      vi.mocked(pdf).mockRejectedValue(new Error('Unknown error'));

      const buffer = Buffer.from('%PDF-1.4\n%Test content');
      
      await expect(extractPDFTextFromBuffer(buffer)).rejects.toThrow(
        PDFExtractionError
      );
      await expect(extractPDFTextFromBuffer(buffer)).rejects.toThrow(
        'Failed to extract text from PDF: Unknown error'
      );
    });

    it('should handle null/undefined text from pdf-parse', async () => {
      const mockPdfData = {
        text: null,
        numpages: 1,
        numrender: 1
      };

      vi.mocked(pdf).mockResolvedValue(mockPdfData);

      const buffer = Buffer.from('%PDF-1.4\n%Null content');
      
      await expect(extractPDFTextFromBuffer(buffer)).rejects.toThrow(
        PDFExtractionError
      );
      await expect(extractPDFTextFromBuffer(buffer)).rejects.toThrow(
        'PDF has no extractable text. Please export the PPT as a text-based PDF (selectable text), not a scanned image.'
      );
    });

    it('should handle empty string text from pdf-parse', async () => {
      const mockPdfData = {
        text: '   ',
        numpages: 1,
        numrender: 1
      };

      vi.mocked(pdf).mockResolvedValue(mockPdfData);

      const buffer = Buffer.from('%PDF-1.4\n%Whitespace content');
      
      await expect(extractPDFTextFromBuffer(buffer)).rejects.toThrow(
        PDFExtractionError
      );
      await expect(extractPDFTextFromBuffer(buffer)).rejects.toThrow(
        'PDF has no extractable text. Please export the PPT as a text-based PDF (selectable text), not a scanned image.'
      );
    });
  });
});