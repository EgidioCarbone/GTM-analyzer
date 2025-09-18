// server-ssd.js
// Complete SSD Test server with real PDF processing and Puppeteer execution
// ---------------------------------------------------------------------------

import 'dotenv/config';
import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';

// Import our SSD services
import { extractPDFText, extractPDFTextFromBuffer, validatePDFFile, PDFExtractionError } from './src/services/pdfTextExtraction.js';
import { OpenAISpecService, OpenAIError } from './src/services/openaiSpecService.js';
import { validateTestSpec, SpecValidationError } from './src/services/specValidation.js';
import { z } from 'zod';
import { SSDPuppeteerRunner, SSDRunnerError } from './src/services/ssdPuppeteerRunner.js';
import { normalizeOrigin, isValidUrl } from './src/utils/url.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for development
  crossOriginEmbedderPolicy: false, // Allow iframe embedding for CMP testing
}));

// Additional security headers
app.use((req, res, next) => {
  // Prevent caching of sensitive endpoints
  if (req.path.startsWith('/api/ssd/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

// Request logging (sanitized)
app.use((req, res, next) => {
  const startTime = Date.now();
  
  // Log request (sanitized)
  const logData = {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString(),
  };
  
  console.log('Request:', logData);
  
  // Log response time
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    console.log(`Response: ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
  });
  
  next();
});

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX || '100'), // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Input sanitization middleware
app.use((req, res, next) => {
  // Sanitize request body for SSD endpoints
  if (req.path.startsWith('/api/ssd/')) {
    if (req.body && typeof req.body === 'object') {
      // Remove any potentially dangerous keys
      const sanitizedBody = {};
      for (const [key, value] of Object.entries(req.body)) {
        // Only allow expected keys for SSD endpoints
        if (['url', 'dsl', 'runOptions'].includes(key)) {
          sanitizedBody[key] = value;
        }
      }
      req.body = sanitizedBody;
    }
  }
  next();
});

// Multer configuration for file uploads - using memory storage
const MAX_UPLOAD_MB = parseInt(process.env.MAX_UPLOAD_MB || '10');
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(), // Use memory storage to avoid disk temp issues
  limits: {
    fileSize: MAX_UPLOAD_BYTES,
  },
  fileFilter: (req, file, cb) => {
    // Accept common PDF mimetypes - do not reject at fileFilter solely by mimetype
    const isPdfMimeType = /pdf|octet-stream|x-pdf/i.test(file.mimetype || '');
    
    console.log('File validation (multer):', {
      originalname: file.originalname,
      mimetype: file.mimetype,
      isPdfMimeType,
      willAccept: isPdfMimeType
    });
    
    // Accept and verify after upload with magic number check
    if (isPdfMimeType) {
      cb(null, true);
    } else {
      // Provide helpful error message for common file types
      let errorMessage = `File type not supported. `;
      if (file.mimetype.startsWith('image/')) {
        errorMessage += `This appears to be an image file (${file.mimetype}). Please convert to PDF first.`;
      } else if (file.mimetype.includes('word') || file.mimetype.includes('powerpoint') || file.mimetype.includes('presentation')) {
        errorMessage += `This appears to be a Microsoft Office document (${file.mimetype}). Please export as PDF from the original application.`;
      } else if (file.mimetype.includes('zip') || file.mimetype.includes('compressed')) {
        errorMessage += `This appears to be a compressed file (${file.mimetype}). Please extract and convert to PDF.`;
      } else {
        errorMessage += `Received: ${file.mimetype}. Only PDF files are allowed.`;
      }
      cb(new Error(errorMessage), false);
    }
  },
});

// Ensure uploads directory exists
await fs.mkdir('uploads', { recursive: true });
await fs.mkdir('screenshots', { recursive: true });

// PDF Magic Number Validation
function isPdfBuffer(buf: Buffer): boolean {
  if (!buf || buf.length < 5) return false;
  return buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46 && buf[4] === 0x2D; // %PDF-
}

// Environment configuration
const config = {
  openaiApiKey: process.env.OPENAI_API_KEY,
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  openaiTimeoutMs: parseInt(process.env.OPENAI_TIMEOUT_MS || '60000'),
  puppeteerOriginAllowlist: (process.env.PUPPETEER_ORIGIN_ALLOWLIST || '').split(',').filter(Boolean),
  puppeteerAllowedTracking: (process.env.PUPPETEER_ALLOWED_TRACKING || 'google-analytics.com,googletagmanager.com,g.doubleclick.net,facebook.com/tr').split(',').filter(Boolean),
  puppeteerAllowedCDNs: (process.env.PUPPETEER_ALLOWED_CDNS || 'cdnjs.cloudflare.com,unpkg.com,jsdelivr.net,fonts.googleapis.com,fonts.gstatic.com').split(',').filter(Boolean),
  runnerStepTimeoutMs: parseInt(process.env.RUNNER_STEP_TIMEOUT_MS || '30000'),
  runnerNavTimeoutMs: parseInt(process.env.RUNNER_NAV_TIMEOUT_MS || '60000'),
  maxFileSize: parseInt(process.env.MAX_UPLOAD_MB || '10') * 1024 * 1024, // Convert MB to bytes
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100'),
};

// Initialize services
const openaiService = new OpenAISpecService(config.openaiApiKey, config.openaiModel, config.openaiTimeoutMs);
const puppeteerRunner = new SSDPuppeteerRunner({
  screenshotDir: 'screenshots',
  timeout: config.runnerStepTimeoutMs,
});

// Original HTML fetch endpoint
app.get('/api/fetchHtml', async (req, res) => {
  const targetUrl = req.query.url;

  // ✅ Validazione veloce dell'URL
  if (typeof targetUrl !== 'string' || !/^https?:\/\//i.test(targetUrl)) {
    return res.status(400).json({ error: 'URL non valido' });
  }

  try {
    // ✅ Scarica l'HTML remoto
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (GTM-Checklist/1.0)',
      },
      redirect: 'follow',
    });

    const html = await response.text();

    // ✅ Cache lato edge (5 minuti)
    res.setHeader('Cache-Control', 's-maxage=300');
    return res.status(200).send(html);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Strict mode: No post-processing functions - execute exactly what the LLM returns

// SSD Test API Endpoints
// ============================================================================

// POST /api/spec/generate - Create Test Specification Preview from URL + PDF
app.post('/api/spec/generate', upload.single('pdf'), async (req, res) => {
  const correlationId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    const { url } = req.body;
    const pdf = req.file;

    // Early validation - check required fields
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

    // Log file information for debugging
    console.log(`[${correlationId}] File upload details:`, {
      originalname: pdf.originalname,
      mimetype: pdf.mimetype,
      size: pdf.size,
      fieldname: pdf.fieldname,
      bufferLength: pdf.buffer?.length || 0
    });

    // Validate and normalize URL format
    let targetOrigin: string;
    try {
      targetOrigin = normalizeOrigin(url);
    } catch (urlError) {
      return res.status(400).json({ 
        error: 'Target Website URL non valida. Includi http/https (es. https://example.com).',
        code: 'INVALID_URL'
      });
    }

    if (!config.openaiApiKey) {
      return res.status(500).json({ 
        error: 'OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.',
        code: 'OPENAI_NOT_CONFIGURED'
      });
    }

    // Magic number validation - check PDF signature
    if (!isPdfBuffer(pdf.buffer)) {
      console.log(`[${correlationId}] PDF magic number check failed:`, {
        firstBytes: pdf.buffer.subarray(0, 16).toString('hex'),
        firstChars: pdf.buffer.subarray(0, 8).toString('ascii')
      });
      return res.status(415).json({ 
        error: 'Uploaded file is not a valid PDF (missing %PDF- header).',
        code: 'INVALID_PDF_SIGNATURE'
      });
    }

    // File size validation
    if (pdf.size > MAX_UPLOAD_BYTES) {
      return res.status(413).json({ 
        error: `PDF exceeds maximum size of ${MAX_UPLOAD_MB} MB.`,
        code: 'FILE_TOO_LARGE'
      });
    }

    console.log(`[${correlationId}] PDF validation passed - magic number: true, size: ${pdf.size} bytes`);

    // Extract text from PDF using buffer directly
    const extractionResult = await extractPDFTextFromBuffer(pdf.buffer);
    
    if (extractionResult.warnings.length > 0) {
      console.log(`[${correlationId}] PDF extraction warnings:`, extractionResult.warnings);
    }

    // Check if PDF has no extractable text
    if (extractionResult.text.length === 0) {
      return res.status(422).json({ 
        error: 'PDF has no extractable text. Please export the PPT as a text-based PDF (selectable text), not a scanned image.',
        code: 'NO_TEXT_CONTENT'
      });
    }

    console.log(`[${correlationId}] PDF text extracted successfully: ${extractionResult.text.length} characters`);

    // Convert PDF text to TestSpec using OpenAI with timeout
    const openaiResponse = await Promise.race([
      openaiService.convertPDFToTestSpec(extractionResult.text, targetOrigin),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('OpenAI request timeout')), 60000)
      )
    ]);

    // 1) leggi l'URL della form (accetta sia 'url' che 'site')
    const rawInputUrl = String(req.body?.url ?? req.body?.site ?? "").trim();
    if (!rawInputUrl) {
      return res.status(400).json({ 
        error: "Missing target URL", 
        code: "INVALID_URL" 
      });
    }

    // 2) ottieni il DSL dall'LLM (stringa o oggetto)
    const dslFromLLM = openaiResponse.dsl ?? {};
    
    // 3) forzatura/merge: il site del DSL è sempre l'origin scelto dall'utente
    const mergedDsl = { ...dslFromLLM, site: targetOrigin };
    
    // 4) LOG mirato: cosa stiamo per validare?
    console.info("[SSD] validating DSL with site:", mergedDsl?.site);
    
    // 5) valida con lo schema che normalizza internamente
    const validatedDSL = validateTestSpec(mergedDsl);
    
    // 6) usa **sempre** 'validatedDSL' per tutto il resto (salvataggio, run, response)
    //    Evita di riusare 'dslFromLLM' o altre copie altrove.

    // Prepare response with validated DSL as-is (no post-processing)
    const response = {
      dsl: validatedDSL,
      meta: {
        model: openaiResponse.meta.model,
        tokens: openaiResponse.meta.tokens,
      }
    };

    console.log(`[${correlationId}] Spec generation completed successfully`);

    res.json(response);

  } catch (error) {
    console.error(`[${correlationId}] Spec Generation Error:`, error);
    
    // Handle specific error types with precise error codes
    if (error instanceof PDFExtractionError) {
      if (error.code === 'NO_TEXT_CONTENT') {
        return res.status(422).json({ 
          error: 'PDF has no extractable text. Please export the PPT as a text-based PDF (selectable text), not a scanned image.',
          code: error.code 
        });
      }
      if (error.code === 'PASSWORD_PROTECTED') {
        return res.status(422).json({ 
          error: 'PDF is password-protected and cannot be parsed.',
          code: error.code 
        });
      }
      return res.status(422).json({ 
        error: error.message,
        code: error.code 
      });
    }

    if (error instanceof SpecValidationError) {
      return res.status(422).json({ 
        error: error.message,
        code: error.code,
        fieldErrors: error.errors
      });
    }

    // Handle Zod validation errors specifically
    if (error instanceof z.ZodError) {
      console.warn("[SSD] Zod fail on site with value:", mergedDsl?.site);
      return res.status(422).json({ 
        error: "DSL schema validation failed", 
        code: "SCHEMA_VALIDATION", 
        fieldErrors: error.flatten().fieldErrors 
      });
    }

    if (error instanceof OpenAIError) {
      return res.status(422).json({ 
        error: error.message,
        code: error.code 
      });
    }

    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    });
  }
});

// POST /api/ssd/run - Execute DSL tests with strict execution (no hidden post-processing)
app.post('/api/ssd/run', async (req, res) => {
  try {
    const { dsl, runOptions = {} } = req.body;

    if (!dsl) {
      return res.status(400).json({ error: 'DSL is required' });
    }

    // Validate DSL structure using our validation service
    console.info("[SSD] validating DSL for run with site:", dsl?.site);
    const validatedDSL = validateTestSpec(dsl);

    // Set default run options
    const options = {
      headless: runOptions.headless !== false,
      consent: runOptions.consent || 'both',
      timeout: config.runnerStepTimeoutMs,
      screenshotDir: 'screenshots',
      allowedHosts: validatedDSL.allowed_hosts || [],
      allowedTracking: config.puppeteerAllowedTracking,
      allowedCDNs: config.puppeteerAllowedCDNs,
    };

    console.log(`Starting SSD test execution for ${validatedDSL.site}`);
    console.log(`Options:`, options);

    // Run the tests with timeout - execute exactly what's in the DSL
    const report = await Promise.race([
      puppeteerRunner.runTests(validatedDSL, options),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Test execution timeout')), 300000) // 5 minutes
      )
    ]);

    console.log(`SSD test execution completed:`, {
      steps: report.summary.steps,
      passed: report.summary.passed,
      failed: report.summary.failed,
      duration: report.summary.duration,
    });

    res.json({ report });

  } catch (error) {
    console.error('SSD Run Error:', error);
    
    // Handle specific error types
    if (error instanceof SpecValidationError) {
      return res.status(422).json({ 
        error: error.message,
        code: error.code,
        fieldErrors: error.errors
      });
    }

    if (error instanceof SSDRunnerError) {
      return res.status(422).json({ 
        error: error.message,
        stepIndex: error.stepIndex 
      });
    }

    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    });
  }
});

// GET /api/ssd/config - Get configuration info
app.get('/api/ssd/config', (req, res) => {
  res.json({
    maxFileSize: config.maxFileSize,
    maxFileSizeMB: Math.round(config.maxFileSize / 1024 / 1024),
    allowedFileTypes: ['application/pdf'],
    supportedActions: [
      'click', 'input', 'wait_for_selector', 'wait_for_text', 
      'navigate', 'maybe_set_quantity', 'choose_payment', 
      'complete_order', 'custom'
    ],
    supportedExpectations: [
      'dataLayer', 'ga4', 'gtm', 'network', 'navigation', 'no_repeat_on_reload'
    ],
    supportedTargetTypes: ['text', 'selector', 'aria', 'href'],
    supportedRegions: ['header', 'main', 'footer', 'any'],
    supportedConsentProfiles: ['accept', 'reject', 'both'],
    openaiConfigured: !!config.openaiApiKey,
    openaiModel: config.openaiModel,
    stepTimeoutMs: config.runnerStepTimeoutMs,
    navTimeoutMs: config.runnerNavTimeoutMs,
    puppeteerAllowedTracking: config.puppeteerAllowedTracking,
    puppeteerAllowedCDNs: config.puppeteerAllowedCDNs,
    puppeteerOriginAllowlist: config.puppeteerOriginAllowlist,
    rateLimit: {
      windowMs: config.rateLimitWindowMs,
      max: config.rateLimitMax,
    },
  });
});


// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server Error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Avvio server
app.listen(PORT, () => {
  console.log(`🔌 SSD Test Server attivo su http://localhost:${PORT}`);
  console.log(`📄 HTML Proxy: GET /api/fetchHtml`);
  console.log(`📊 SSD Test: POST /api/ssd/ingest, POST /api/ssd/run`);
  console.log(`⚙️  Config: GET /api/ssd/config`);
  console.log(`🔑 OpenAI API Key: ${config.openaiApiKey ? '✅ Configured' : '❌ Missing'}`);
});

