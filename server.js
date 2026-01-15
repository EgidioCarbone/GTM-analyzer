// server.js
// ---------------------------------------------------------------------------
// Backend Express che funge da proxy HTML. Riceve GET /api/fetchHtml?url=…
// Scarica l'HTML grezzo e lo restituisce al frontend per l'analisi.
// Aggiunto supporto per SSD Test con PDF processing e LLM conversion.
// ---------------------------------------------------------------------------

import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';
import { pdfExtractionService } from './src/services/pdfExtractionService.js';
import { createSSDLLMService } from './src/services/ssdLLMService.js';
import { createSSDPuppeteerRunner } from './src/services/ssdPuppeteerRunner.js';
import { validateSSDIngestRequest, validateSSDRunRequest } from './src/services/ssdValidation.js';

// Helper function for uniform error responses
function sendError(res, httpStatus, code, message) {
  return res.status(httpStatus).json({ error: { code, message } });
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;

// Healthcheck endpoint for load balancers / EB
app.get('/api/health', (_req, res) => {
  res.status(200).send('ok');
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for development
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX || '100'), // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
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

// Multer configuration for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB default
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
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'),
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100'),
};

// Initialize services
const llmService = createSSDLLMService(config.openaiApiKey, config.openaiModel);

// Original HTML fetch endpoint
app.get('/api/fetchHtml', async (req, res) => {
  const targetUrl = req.query.url;

  // ✅ Validazione veloce dell'URL
  if (typeof targetUrl !== 'string' || !/^https?:\/\//i.test(targetUrl)) {
    return sendError(res, 400, 'URL_INVALID', 'URL non valido');
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
    return sendError(res, 500, 'FETCH_ERROR', err.message);
  }
});

// SSD Test API Endpoints
// ============================================================================

// POST /api/ssd/ingest - Convert PDF to DSL
app.post('/api/ssd/ingest', upload.single('pdf'), async (req, res) => {
  try {
    // Debug logging
    console.log('Request body:', req.body);
    console.log('Request file:', req.file);
    
    // Validate request
    const validation = validateSSDIngestRequest({
      url: req.body.url,
      pdf: req.file,
    });

    if (!validation.success) {
      console.log('Validation error:', validation.error);
      return res.status(400).json({ 
        error: validation.error,
        code: 'SCHEMA_VALIDATION',
        fieldErrors: [
          {
            field: 'site',
            message: 'Site must be a valid URL',
            code: 'SCHEMA_VALIDATION'
          }
        ]
      });
    }

    const { url, pdf } = validation.data;

    // Check if OpenAI API key is configured
    if (!config.openaiApiKey) {
      return res.status(500).json({ 
        error: 'OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.' 
      });
    }

    // Extract text from PDF
    const pdfResult = await pdfExtractionService.extractText(pdf);
    
    // Extract structured content
    const structuredContent = pdfExtractionService.extractStructuredContent(pdfResult.text);

    // Convert to DSL using LLM
    const conversionResult = await llmService.convertPDFToDSL(
      pdfResult.text,
      url,
      structuredContent
    );

    // Clean up uploaded file
    await fs.unlink(pdf.path).catch(() => {});

    res.json(conversionResult);

  } catch (error) {
    console.error('SSD Ingest Error:', error);
    
    // Clean up uploaded file on error
    if (req.file) {
      await fs.unlink(req.file.path).catch(() => {});
    }

    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    });
  }
});

// POST /api/ssd/run - Execute DSL tests
app.post('/api/ssd/run', async (req, res) => {
  try {
    // Validate request
    const validation = validateSSDRunRequest(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error });
    }

    const { dsl, runOptions = {} } = validation.data;

    // Determine consent profiles to run
    const consentProfiles = dsl.consent || ['accept'];
    if (runOptions.consent === 'both') {
      consentProfiles.push('reject');
    } else if (runOptions.consent) {
      consentProfiles[0] = runOptions.consent;
    }

    // Create runner configuration
    const runnerConfig = {
      headless: runOptions.headless !== false,
      stepTimeoutMs: config.runnerStepTimeoutMs,
      navTimeoutMs: config.runnerNavTimeoutMs,
      allowedHosts: dsl.allowed_hosts || [new URL(dsl.site).hostname],
      screenshotDir: 'screenshots',
      consentProfiles,
    };

    // Create and run tests
    const runner = createSSDPuppeteerRunner(runnerConfig);
    const result = await runner.runTests(dsl);

    res.json({ report: result });

  } catch (error) {
    console.error('SSD Run Error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    });
  }
});

// GET /api/ssd/config - Get configuration info
app.get('/api/ssd/config', (req, res) => {
  res.json({
    maxFileSize: config.maxFileSize,
    allowedFileTypes: ['application/pdf'],
    supportedActions: [
      'click', 'input', 'wait_for_selector', 'wait_for_text', 
      'navigate', 'maybe_set_quantity', 'choose_payment', 
      'complete_order', 'custom'
    ],
    supportedExpectations: [
      'dataLayer', 'ga4', 'gtm', 'network', 'navigation', 'no_repeat_on_reload'
    ],
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
  console.log(`🔌 Server attivo su http://localhost:${PORT}`);
  console.log(`📄 HTML Proxy: GET /api/fetchHtml`);
  console.log(`📊 SSD Test: POST /api/ssd/ingest, POST /api/ssd/run`);
  console.log(`⚙️  Config: GET /api/ssd/config`);
  console.log(`🔑 OpenAI API Key: ${config.openaiApiKey ? '✅ Configured' : '❌ Missing'}`);
});
