import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import multer from 'multer';
import { extractPDFTextFromBuffer } from '../pdfTextExtraction';

// Mock the services
vi.mock('../pdfTextExtraction', () => ({
  extractPDFTextFromBuffer: vi.fn(),
  PDFExtractionError: class PDFExtractionError extends Error {
    constructor(message: string, public code: string) {
      super(message);
      this.name = 'PDFExtractionError';
    }
  }
}));

vi.mock('../openaiSpecService', () => ({
  OpenAISpecService: class {
    async convertPDFToTestSpec() {
      return {
        dsl: {
          site: 'https://example.com',
          tests: [{
            section: 'Test Section',
            steps: [{
              action: 'click',
              target: 'button',
              expectation: 'dataLayer'
            }]
          }]
        },
        meta: {
          model: 'gpt-4o-mini',
          tokens: { input: 100, output: 50 }
        }
      };
    }
  },
  OpenAIError: class OpenAIError extends Error {
    constructor(message: string, public code: string) {
      super(message);
      this.name = 'OpenAIError';
    }
  }
}));

vi.mock('../specValidation', () => ({
  validateTestSpec: (dsl: any) => dsl,
  SpecValidationError: class SpecValidationError extends Error {
    constructor(message: string, public code: string) {
      super(message);
      this.name = 'SpecValidationError';
    }
  }
}));

// Create a minimal Express app for testing
const app = express();
app.use(express.json());

// Multer configuration for testing
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const isPdfMimeType = /pdf|octet-stream|x-pdf/i.test(file.mimetype || '');
    if (isPdfMimeType) {
      cb(null, true);
    } else {
      cb(new Error('File type not supported'), false);
    }
  },
});

// PDF Magic Number Validation
function isPdfBuffer(buf: Buffer): boolean {
  if (!buf || buf.length < 5) return false;
  return buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46 && buf[4] === 0x2D; // %PDF-
}

// Test route
app.post('/api/spec/generate', upload.single('pdf'), async (req, res) => {
  try {
    const { url } = req.body;
    const pdf = req.file;

    // Early validation
    if (!pdf) {
      return res.status(400).json({ 
        error: "Missing 'pdf' file field in multipart/form-data.",
        code: 'MISSING_FILE_FIELD'
      });
    }

    if (!url) {
      return res.status(400).json({ 
        error: 'URL is required',
        code: 'MISSING_URL'
      });
    }

    // Magic number validation
    if (!isPdfBuffer(pdf.buffer)) {
      return res.status(415).json({ 
        error: 'Uploaded file is not a valid PDF (missing %PDF- header).',
        code: 'INVALID_PDF_SIGNATURE'
      });
    }

    // File size validation
    if (pdf.size > 10 * 1024 * 1024) {
      return res.status(413).json({ 
        error: 'PDF exceeds maximum size of 10 MB.',
        code: 'FILE_TOO_LARGE'
      });
    }

    // Extract text from PDF
    const extractionResult = await extractPDFTextFromBuffer(pdf.buffer);
    
    if (extractionResult.text.length === 0) {
      return res.status(422).json({ 
        error: 'PDF has no extractable text. Please export the PPT as a text-based PDF (selectable text), not a scanned image.',
        code: 'NO_TEXT_CONTENT'
      });
    }

    // Mock OpenAI response
    const response = {
      dsl: {
        site: url,
        tests: [{
          section: 'Test Section',
          steps: [{
            action: 'click',
            target: 'button',
            expectation: 'dataLayer'
          }]
        }]
      },
      meta: {
        model: 'gpt-4o-mini',
        tokens: { input: 100, output: 50 }
      }
    };

    res.json(response);

  } catch (error) {
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    });
  }
});

describe('PDF Upload Route Integration Tests', () => {
  it('should accept valid PDF with correct %PDF- header', async () => {
    const validPdfBuffer = Buffer.from('%PDF-1.4\n%Test PDF content');
    
    vi.mocked(extractPDFTextFromBuffer).mockResolvedValue({
      text: 'Test PDF content',
      pageCount: 1,
      warnings: []
    });

    const response = await request(app)
      .post('/api/spec/generate')
      .field('url', 'https://example.com')
      .attach('pdf', validPdfBuffer, 'test.pdf');

    expect(response.status).toBe(200);
    expect(response.body.dsl).toBeDefined();
    expect(response.body.meta).toBeDefined();
  });

  it('should accept application/octet-stream with correct %PDF- header', async () => {
    const validPdfBuffer = Buffer.from('%PDF-1.4\n%Test PDF content');
    
    vi.mocked(extractPDFTextFromBuffer).mockResolvedValue({
      text: 'Test PDF content',
      pageCount: 1,
      warnings: []
    });

    const response = await request(app)
      .post('/api/spec/generate')
      .field('url', 'https://example.com')
      .attach('pdf', validPdfBuffer, 'test.pdf')
      .set('Content-Type', 'multipart/form-data');

    expect(response.status).toBe(200);
    expect(response.body.dsl).toBeDefined();
  });

  it('should reject file without %PDF- header', async () => {
    const invalidBuffer = Buffer.from('Not a PDF file');

    const response = await request(app)
      .post('/api/spec/generate')
      .field('url', 'https://example.com')
      .attach('pdf', invalidBuffer, 'not-a-pdf.txt');

    expect(response.status).toBe(415);
    expect(response.body.error).toContain('missing %PDF- header');
    expect(response.body.code).toBe('INVALID_PDF_SIGNATURE');
  });

  it('should reject missing file field', async () => {
    const response = await request(app)
      .post('/api/spec/generate')
      .field('url', 'https://example.com');

    expect(response.status).toBe(400);
    expect(response.body.error).toContain("Missing 'pdf' file field");
    expect(response.body.code).toBe('MISSING_FILE_FIELD');
  });

  it('should reject missing URL field', async () => {
    const validPdfBuffer = Buffer.from('%PDF-1.4\n%Test PDF content');

    const response = await request(app)
      .post('/api/spec/generate')
      .attach('pdf', validPdfBuffer, 'test.pdf');

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('URL is required');
    expect(response.body.code).toBe('MISSING_URL');
  });

  it('should reject file that is too large', async () => {
    // Create a buffer larger than 10MB
    const largeBuffer = Buffer.alloc(11 * 1024 * 1024);
    largeBuffer.write('%PDF-1.4', 0);

    const response = await request(app)
      .post('/api/spec/generate')
      .field('url', 'https://example.com')
      .attach('pdf', largeBuffer, 'large.pdf');

    expect(response.status).toBe(413);
    expect(response.body.error).toContain('exceeds maximum size of 10 MB');
    expect(response.body.code).toBe('FILE_TOO_LARGE');
  });

  it('should reject PDF with no extractable text', async () => {
    const validPdfBuffer = Buffer.from('%PDF-1.4\n%Empty PDF');
    
    vi.mocked(extractPDFTextFromBuffer).mockResolvedValue({
      text: '',
      pageCount: 1,
      warnings: []
    });

    const response = await request(app)
      .post('/api/spec/generate')
      .field('url', 'https://example.com')
      .attach('pdf', validPdfBuffer, 'empty.pdf');

    expect(response.status).toBe(422);
    expect(response.body.error).toContain('no extractable text');
    expect(response.body.code).toBe('NO_TEXT_CONTENT');
  });

  it('should handle password-protected PDF', async () => {
    const validPdfBuffer = Buffer.from('%PDF-1.4\n%Encrypted PDF');
    
    vi.mocked(extractPDFTextFromBuffer).mockRejectedValue(
      new Error('Password required')
    );

    const response = await request(app)
      .post('/api/spec/generate')
      .field('url', 'https://example.com')
      .attach('pdf', validPdfBuffer, 'encrypted.pdf');

    expect(response.status).toBe(500);
    expect(response.body.error).toContain('Password required');
  });
});
