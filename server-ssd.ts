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
import { extractPDFText, validatePDFFile, PDFExtractionError } from './src/services/ssdPdfExtractionService.js';
import { SSDOpenAIService, OpenAIError } from './src/services/ssdOpenAIService.js';
import { SSDPuppeteerRunner, SSDRunnerError } from './src/services/ssdPuppeteerRunner.js';

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

// Multer configuration for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: parseInt(process.env.MAX_UPLOAD_MB || '10') * 1024 * 1024, // Convert MB to bytes
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  },
});

// Ensure uploads directory exists
await fs.mkdir('uploads', { recursive: true });
await fs.mkdir('screenshots', { recursive: true });

// Environment configuration
const config = {
  openaiApiKey: process.env.OPENAI_API_KEY,
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  puppeteerOriginAllowlist: (process.env.PUPPETEER_ORIGIN_ALLOWLIST || '').split(',').filter(Boolean),
  runnerStepTimeoutMs: parseInt(process.env.RUNNER_STEP_TIMEOUT_MS || '30000'),
  runnerNavTimeoutMs: parseInt(process.env.RUNNER_NAV_TIMEOUT_MS || '60000'),
  maxFileSize: parseInt(process.env.MAX_UPLOAD_MB || '10') * 1024 * 1024, // Convert MB to bytes
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100'),
};

// Initialize services
const openaiService = new SSDOpenAIService(config.openaiApiKey, config.openaiModel);
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

// SSD Test API Endpoints
// ============================================================================

// POST /api/ssd/ingest - Convert PDF to DSL with real OpenAI processing
app.post('/api/ssd/ingest', upload.single('pdf'), async (req, res) => {
  let pdfPath = null;
  
  try {
    const { url } = req.body;
    const pdf = req.file;

    // Basic validation
    if (!url || !pdf) {
      return res.status(400).json({ error: 'URL and PDF file are required' });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch (urlError) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    if (!config.openaiApiKey) {
      return res.status(500).json({ 
        error: 'OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.' 
      });
    }

    pdfPath = pdf.path;

    // Validate PDF file
    await validatePDFFile(pdfPath, config.maxFileSize);

    // Extract text from PDF
    const extractionResult = await extractPDFText(pdfPath);
    
    if (extractionResult.warnings.length > 0) {
      console.log('PDF extraction warnings:', extractionResult.warnings);
    }

    // Convert PDF text to TestSpec using OpenAI with timeout
    const openaiResponse = await Promise.race([
      openaiService.convertPDFToTestSpec(extractionResult.text, url),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('OpenAI request timeout')), 60000)
      )
    ]);

    // Prepare response
    const response = {
      dsl: openaiResponse.dsl,
      ambiguities: openaiResponse.ambiguities,
      meta: {
        tokens: openaiResponse.meta.tokens,
        model: openaiResponse.meta.model,
        ingestionWarnings: extractionResult.warnings,
      }
    };

    // Clean up uploaded file
    await fs.unlink(pdfPath).catch(() => {});
    pdfPath = null;

    res.json(response);

  } catch (error) {
    console.error('SSD Ingest Error:', error);
    
    // Clean up uploaded file on error
    if (pdfPath) {
      await fs.unlink(pdfPath).catch(() => {});
    }

    // Handle specific error types
    if (error instanceof PDFExtractionError) {
      return res.status(422).json({ 
        error: error.message,
        code: error.code 
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

// POST /api/ssd/run - Execute DSL tests with real Puppeteer
app.post('/api/ssd/run', async (req, res) => {
  try {
    const { dsl, runOptions = {} } = req.body;

    if (!dsl) {
      return res.status(400).json({ error: 'DSL is required' });
    }

    // Validate DSL structure
    if (!dsl.site || !dsl.tests || !Array.isArray(dsl.tests)) {
      return res.status(400).json({ error: 'Invalid DSL structure' });
    }

    // Validate site URL
    try {
      new URL(dsl.site);
    } catch (urlError) {
      return res.status(400).json({ error: 'Invalid site URL in DSL' });
    }

    // Set default run options
    const options = {
      headless: runOptions.headless !== false,
      consent: runOptions.consent || 'both',
      timeout: config.runnerStepTimeoutMs,
      screenshotDir: 'screenshots',
    };

    console.log(`Starting SSD test execution for ${dsl.site}`);
    console.log(`Options:`, options);

    // Run the tests with timeout
    const report = await Promise.race([
      puppeteerRunner.runTests(dsl, options),
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

