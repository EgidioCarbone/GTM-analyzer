// server-ssd.js
// Simplified server for SSD Test feature
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;

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

// POST /api/ssd/ingest - Convert PDF to DSL (simplified version)
app.post('/api/ssd/ingest', upload.single('pdf'), async (req, res) => {
  try {
    const { url } = req.body;
    const pdf = req.file;

    // Basic validation
    if (!url || !pdf) {
      return res.status(400).json({ error: 'URL and PDF file are required' });
    }

    if (!config.openaiApiKey) {
      return res.status(500).json({ 
        error: 'OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.' 
      });
    }

    // Enhanced mock response that simulates real PDF analysis
    const hostname = new URL(url).hostname;
    const mockResponse = {
      dsl: {
        site: url,
        allowed_hosts: [hostname],
        consent: ["accept", "reject"],
        tests: [
          {
            section: "Header Navigation",
            steps: [
              {
                description: "Click on main logo",
                action: "click",
                target: {
                  kind: "text",
                  value: "Logo"
                },
                expect: [
                  {
                    type: "navigation",
                    url_matches: `https://${hostname}`
                  }
                ],
                confidence: 0.9
              },
              {
                description: "Navigate to main menu",
                action: "click",
                target: {
                  kind: "text",
                  value: "Menu"
                },
                expect: [
                  {
                    type: "dataLayer",
                    event: "menu_click"
                  }
                ],
                confidence: 0.8
              }
            ]
          },
          {
            section: "Product Selection",
            steps: [
              {
                description: "Select product category",
                action: "click",
                target: {
                  kind: "text",
                  value: "Category"
                },
                expect: [
                  {
                    type: "dataLayer",
                    event: "category_view",
                    params_subset: {
                      category: "products"
                    }
                  }
                ],
                confidence: 0.85
              },
              {
                description: "Add item to cart",
                action: "click",
                target: {
                  kind: "text",
                  value: "Add to Cart"
                },
                expect: [
                  {
                    type: "dataLayer",
                    event: "add_to_cart"
                  },
                  {
                    type: "ga4",
                    url_contains: "collect?v=2"
                  }
                ],
                confidence: 0.9
              }
            ]
          },
          {
            section: "Checkout Process",
            steps: [
              {
                description: "Proceed to checkout",
                action: "click",
                target: {
                  kind: "text",
                  value: "Checkout"
                },
                expect: [
                  {
                    type: "navigation",
                    url_contains: "checkout"
                  }
                ],
                confidence: 0.95
              },
              {
                description: "Fill customer information",
                action: "input",
                target: {
                  kind: "selector",
                  value: "input[name='email']"
                },
                value: "test@example.com",
                expect: [
                  {
                    type: "dataLayer",
                    event: "form_start"
                  }
                ],
                confidence: 0.8
              },
              {
                description: "Complete purchase",
                action: "complete_order",
                expect: [
                  {
                    type: "dataLayer",
                    event: "purchase"
                  },
                  {
                    type: "ga4",
                    url_contains: "collect?v=2"
                  },
                  {
                    type: "no_repeat_on_reload",
                    for_event: "purchase"
                  }
                ],
                confidence: 0.9
              }
            ]
          }
        ]
      },
      ambiguities: [
        {
          stepPath: "tests[0].steps[1]",
          reason: "Menu button text might be ambiguous - could be 'Menu', 'Navigation', or '☰'",
          candidates: [
            { kind: "text", value: "Menu" },
            { kind: "text", value: "Navigation" },
            { kind: "selector", value: "button[aria-label='Menu']" }
          ]
        },
        {
          stepPath: "tests[1].steps[0]",
          reason: "Category selection might have multiple options",
          candidates: [
            { kind: "text", value: "Category" },
            { kind: "selector", value: ".category-dropdown" },
            { kind: "aria", value: "category selector" }
          ]
        }
      ],
      meta: {
        tokens: 1250,
        model: config.openaiModel,
        ingestionWarnings: [
          "PDF contains 15 slides with complex navigation flows",
          "Some button texts are in Italian - consider language-specific selectors",
          "Multiple checkout steps detected - ensure proper sequencing"
        ]
      }
    };

    // Clean up uploaded file
    await fs.unlink(pdf.path).catch(() => {});

    res.json(mockResponse);

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

// POST /api/ssd/run - Execute DSL tests (simplified version)
app.post('/api/ssd/run', async (req, res) => {
  try {
    const { dsl, runOptions = {} } = req.body;

    if (!dsl) {
      return res.status(400).json({ error: 'DSL is required' });
    }

    // Enhanced mock response that simulates running all tests
    const allSteps = dsl.tests.reduce((acc, test) => {
      return acc + test.steps.length;
    }, 0);
    
    const mockResults = [];
    let passedCount = 0;
    let failedCount = 0;
    
    // Generate results for all tests
    dsl.tests.forEach((test, testIndex) => {
      test.steps.forEach((step, stepIndex) => {
        const isPass = Math.random() > 0.1; // 90% pass rate
        const duration = Math.floor(Math.random() * 3000) + 1000; // 1-4 seconds
        
        if (isPass) passedCount++;
        else failedCount++;
        
        mockResults.push({
          section: test.section,
          stepIndex: stepIndex,
          description: step.description,
          status: isPass ? "PASS" : "FAIL",
          reasons: isPass ? [] : ["Element not found", "Timeout waiting for element"],
          evidence: {
            screenshotPathOrB64: `screenshots/step-${testIndex}-${stepIndex}.png`,
            dataLayerEvents: isPass ? [
              { timestamp: Date.now() - 1000, payload: { event: "test_event" } }
            ] : [],
            trackingHits: isPass ? [
              { timestamp: Date.now() - 500, url: "https://www.google-analytics.com/collect", method: "GET", domain: "google-analytics.com" }
            ] : []
          },
          timings: {
            startTime: Date.now() - duration,
            endTime: Date.now(),
            duration: duration
          }
        });
      });
    });
    
    const mockReport = {
      summary: {
        steps: allSteps,
        passed: passedCount,
        failed: failedCount,
        duration: Math.floor(Math.random() * 10000) + 5000, // 5-15 seconds total
        consentProfiles: dsl.consent || ["accept"]
      },
      results: mockResults,
      artifacts: {
        screenshotsFolder: "screenshots",
        rawLogsPath: "screenshots/raw-logs.json"
      }
    };

    res.json({ report: mockReport });

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
  console.log(`🔌 SSD Test Server attivo su http://localhost:${PORT}`);
  console.log(`📄 HTML Proxy: GET /api/fetchHtml`);
  console.log(`📊 SSD Test: POST /api/ssd/ingest, POST /api/ssd/run`);
  console.log(`⚙️  Config: GET /api/ssd/config`);
  console.log(`🔑 OpenAI API Key: ${config.openaiApiKey ? '✅ Configured' : '❌ Missing'}`);
});

