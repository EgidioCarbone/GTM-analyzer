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
import { extractCookieBannerWithPuppeteer } from './src/services/cookieBannerExtractor.js';
import puppeteer from 'puppeteer';

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

/**
 * Esegue il test di cookie consent e controlla il dataLayer
 */
async function executeCookieConsentTest(testSpec: any, page: any) {
  const result = {
    status: 'FAIL',
    dataLayerEvents: [],
    consentStatus: 'unknown',
    steps: [],
    error: null
  };

  // Variabili per tracciare il dataLayer prima e dopo il click
  let dataLayerBefore = [];
  let dataLayerAfter = [];

  try {
    console.log('Executing cookie consent test...');
    
    // Monitora il dataLayer
    await page.evaluateOnNewDocument(() => {
      window.dataLayer = window.dataLayer || [];
      window.originalDataLayerPush = window.dataLayer.push;
      window.dataLayer.push = function(...args) {
        console.log('DataLayer push:', args);
        window.originalDataLayerPush.apply(this, args);
      };
    });

    // Esegui ogni step del test
    for (let i = 0; i < testSpec.tests[0].steps.length; i++) {
      const step = testSpec.tests[0].steps[i];
      console.log(`Executing step ${i + 1}: ${step.description}`);
      
      const stepResult = {
        step: i + 1,
        description: step.description,
        action: step.action,
        status: 'FAIL',
        error: null
      };

      try {
        if (step.action === 'navigate') {
          // Naviga alla pagina
          await page.goto(step.target.value, { waitUntil: 'networkidle2' });
          stepResult.status = 'PASS';
          console.log(`✓ Navigation successful`);
          
        } else if (step.action === 'click') {
          // Trova e clicca l'elemento - gestisce selettori complessi
          let element = null;
          const selector = step.target.value;
          
          // Wait for cookie banner to load and become visible
          console.log('Waiting for cookie banner to load and become visible...');
          try {
            element = await page.waitForSelector(selector, { visible: true, timeout: 15000 });
            console.log('✓ Cookie banner button found and visible');
          } catch (waitError) {
            console.log('⚠ Cookie banner button not found within 15 seconds, trying anyway...');
          }

          // Check dataLayer BEFORE clicking
          console.log('Checking dataLayer BEFORE click...');
          dataLayerBefore = await page.evaluate(() => {
            return window.dataLayer ? [...window.dataLayer] : [];
          });
          console.log(`DataLayer BEFORE click: ${dataLayerBefore.length} events`);
          if (dataLayerBefore.length > 0) {
            console.log('DataLayer BEFORE click events:', JSON.stringify(dataLayerBefore, null, 2));
          }
          
          try {
            let clickSuccessful = false;
            
            // Se abbiamo già l'elemento da waitForSelector, usalo direttamente
            if (element) {
              console.log('Using element found by waitForSelector');
              await element.click();
              stepResult.status = 'PASS';
              console.log(`✓ Click successful on ${selector}`);
              clickSuccessful = true;
            } else if (selector.includes(':contains')) {
              // Se il selettore contiene :contains, salta il selettore diretto e usa approcci alternativi
              console.log('Trying alternative selectors for text-based search...');
              
              // Estrai il testo da cercare
              const textMatch = selector.match(/:contains\('([^']+)'\)/);
              if (textMatch) {
                const searchText = textMatch[1];
                console.log(`Looking for button with text: "${searchText}"`);
                
                // Prova diversi approcci per trovare il pulsante
                const alternativeSelectors = [
                  `.CybotCookiebotDialogBodyLevelButtonWrapper button`,
                  `.CybotCookiebotDialogBodyLevelButtonWrapper input[type="button"]`,
                  `.CybotCookiebotDialogBodyLevelButtonWrapper input[type="submit"]`,
                  `button[onclick*="accept"]`,
                  `button[onclick*="consent"]`,
                  `input[value*="${searchText}"]`,
                  `button:has-text("${searchText}")`,
                  `[role="button"]:has-text("${searchText}")`
                ];
                
                for (const altSelector of alternativeSelectors) {
                  try {
                    element = await page.$(altSelector);
                    if (element) {
                      console.log(`✓ Found element with selector: ${altSelector}`);
                      break;
                    }
                  } catch (e) {
                    // Ignora selettori non validi
                    continue;
                  }
                }
                
                // Se ancora non trova, cerca per testo usando XPath
                if (!element) {
                  try {
                    const xpath = `//button[contains(text(), '${searchText}')] | //input[@type='button' and contains(@value, '${searchText}')] | //*[contains(text(), '${searchText}') and (@role='button' or @onclick)]`;
                    const elements = await page.$x(xpath);
                    if (elements.length > 0) {
                      element = elements[0];
                      console.log(`✓ Found element using XPath`);
                    }
                  } catch (e) {
                    console.log('XPath search failed:', e.message);
                  }
                }
              }
            }
            
            // Se non abbiamo ancora cliccato l'elemento, proviamo a trovarlo e cliccarlo
            if (!clickSuccessful && element) {
              await element.click();
              stepResult.status = 'PASS';
              console.log(`✓ Click successful on ${selector}`);
              clickSuccessful = true;
            } else if (!clickSuccessful) {
              stepResult.error = `Element not found: ${selector}`;
              console.log(`✗ Element not found: ${selector}`);
            }

            // Se il click è stato effettuato, aspettiamo e controlliamo il dataLayer
            if (clickSuccessful) {
              // Aspetta 15 secondi dopo il click per completare il processo di consenso
              console.log('Waiting 15 seconds for consent to be fully processed...');
              await new Promise(resolve => setTimeout(resolve, 15000));

              // Check dataLayer AFTER clicking
              console.log('Checking dataLayer AFTER click...');
              dataLayerAfter = await page.evaluate(() => {
                return window.dataLayer ? [...window.dataLayer] : [];
              });
              console.log(`DataLayer AFTER click: ${dataLayerAfter.length} events`);
              if (dataLayerAfter.length > 0) {
                console.log('DataLayer AFTER click events:', JSON.stringify(dataLayerAfter, null, 2));
              }

              // Compare dataLayer before and after
              const newEvents = dataLayerAfter.slice(dataLayerBefore.length);
              console.log(`New events added: ${newEvents.length}`);
              if (newEvents.length > 0) {
                console.log('New events:', JSON.stringify(newEvents, null, 2));
              } else {
                console.log('No new events detected in dataLayer');
              }
            }
          } catch (selectorError) {
            stepResult.error = `Selector error: ${selectorError.message}`;
            console.log(`✗ Selector error: ${selectorError.message}`);
          }
        }
        
        result.steps.push(stepResult);
        
      } catch (stepError) {
        stepResult.error = stepError.message;
        stepResult.status = 'FAIL';
        result.steps.push(stepResult);
        console.error(`✗ Step ${i + 1} failed:`, stepError);
      }
    }

    // Controlla il dataLayer per eventi di consenso
    console.log('Checking dataLayer for consent events...');
    
    // Se non abbiamo dati dopo il click, li raccogliamo ora
    if (typeof dataLayerAfter === 'undefined') {
      console.log('Collecting dataLayer data now...');
      dataLayerAfter = await page.evaluate(() => {
        return window.dataLayer ? [...window.dataLayer] : [];
      });
    }
    
    // Debug: mostra tutti gli eventi dataLayer per capire cosa emette Cookiebot
    console.log('All dataLayer events after click:', JSON.stringify(dataLayerAfter, null, 2));
    
    const dataLayerData = {
      dataLayer: dataLayerAfter,
      consentEvents: dataLayerAfter.filter(event => 
        event && (
          event.event === 'consent_update' ||
          event.event === 'cookie_consent' ||
          event.event === 'cookie_consent_update' ||
          event.event === 'cookie_consent_preferences' ||
          event.event === 'cookie_consent_statistics' ||
          event.event === 'cookie_consent_marketing' ||
          event.event === 'consent_given' ||
          event.event === 'cookiebot_consent' ||
          event.event === 'cookiebot_consent_update' ||
          event.consent_status ||
          event.cookie_consent ||
          event.cookiebot_consent ||
          event.cookiebot_consent_status ||
          (event[0] === 'consent' && event[1] === 'update')
        )
      )
    };

    result.dataLayerEvents = dataLayerData.consentEvents;
    
    // Controlla se il cookie banner è scomparso (indicatore principale di successo)
    const bannerStillVisible = await page.$('.CybotCookiebotDialogContentWrapper');
    if (!bannerStillVisible) {
      console.log('✓ Cookie banner disappeared after consent');
      result.consentStatus = 'accepted';
      result.status = 'PASS';
    } else {
      console.log('⚠ Cookie banner still visible');
    }

    // Determina lo status del consenso basato su eventi dataLayer (indicatore secondario)
    if (dataLayerData.consentEvents.length > 0) {
      result.consentStatus = 'accepted';
      result.status = 'PASS';
      console.log(`✓ Consent events found: ${dataLayerData.consentEvents.length}`);
      console.log('Consent events:', dataLayerData.consentEvents);
    } else if (result.status !== 'PASS') {
      result.consentStatus = 'not_detected';
      console.log('✗ No consent events found in dataLayer');
    }

  } catch (error) {
    result.error = error.message;
    console.error('Error executing cookie consent test:', error);
  }

  return result;
}

/**
 * Genera Test Specification per testare la CTA di accettazione cookie
 */
async function generateCookieConsentTestSpec(siteUrl: string, cookieBanner: any) {
  if (!config.openaiApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  // Filtra solo i bottoni "Accept All" con alta confidence
  const acceptAllButtons = cookieBanner.buttons?.filter((btn: any) => btn.isAcceptAll && btn.confidence > 0.5) || [];
  
  const prompt = `You are an expert in web testing and cookie consent management. 

I need you to generate a Test Specification Preview for testing ONLY the cookie consent acceptance CTA (Call-to-Action) button.

SITE TO TEST: ${siteUrl}

COOKIE BANNER INFORMATION:
- Type: ${cookieBanner.type}
- Position: ${cookieBanner.position}
- Selectors: ${cookieBanner.selectors.join(', ')}

ACCEPT ALL BUTTONS FOUND:
${acceptAllButtons.length > 0 ? acceptAllButtons.map((btn: any, index: number) => `
Button ${index + 1}:
- ID: ${btn.id}
- Class: ${btn.className}
- Text: "${btn.text}"
- Type: ${btn.type}
- Role: ${btn.role}
- Selector: ${btn.selector}
- Confidence: ${btn.confidence}
`).join('\n') : 'No Accept All buttons identified with high confidence'}

ALL BUTTONS IN COOKIE BANNER:
${cookieBanner.buttons?.map((btn: any, index: number) => `
Button ${index + 1}:
- ID: ${btn.id}
- Class: ${btn.className}
- Text: "${btn.text}"
- Type: ${btn.type}
- Role: ${btn.role}
- Selector: ${btn.selector}
- Is Accept All: ${btn.isAcceptAll} (confidence: ${btn.confidence})
`).join('\n') || 'No buttons found'}

TASK: Generate a TestSpec JSON that tests ONLY the cookie consent acceptance functionality. The test should:

1. Navigate to the site
2. Find and click the "Accept All" or "Accept Cookies" button
3. Verify that the consent was properly given (check for dataLayer events, network calls, or UI changes)
4. Be specific to this exact site and cookie banner

CRITICAL: Use ONLY simple CSS selectors that work with Puppeteer:
- ✅ GOOD: .class-name, #id, button, input[type="button"]
- ❌ BAD: :contains(), :has-text(), :nth-child(), complex pseudo-selectors

Return ONLY a valid JSON TestSpec object with this structure:
{
  "site": "${siteUrl}",
  "allowed_hosts": ["${new URL(siteUrl).hostname}"],
  "consent": ["accept"],
  "tests": [
    {
      "section": "Cookie Consent Acceptance",
      "steps": [
        {
          "description": "Navigate to the website",
          "action": "navigate",
          "target": {
            "kind": "href",
            "value": "${siteUrl}"
          },
          "expect": [
            {
              "type": "navigation",
              "url_contains": "${new URL(siteUrl).hostname}"
            }
          ]
        },
        {
          "description": "Click Accept All Cookies button",
          "action": "click",
          "target": {
            "kind": "text",
            "value": "Accept All"
          },
          "expect": [
            {
              "type": "dataLayer",
              "event": "consent_update"
            }
          ]
        }
      ]
    }
  ]
}

IMPORTANT: 
- Use the exact selectors and text from the cookie banner information provided
- Focus ONLY on cookie consent acceptance testing
- Make the test specific to this site and cookie banner
- Use ONLY simple CSS selectors that work with Puppeteer (NO :contains(), :has-text(), or complex pseudo-selectors)
- For text-based selection, use simple selectors like: .class-name, #id, button, input[type="button"]
- Return valid JSON only, no explanations`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.openaiModel,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Clean the response - remove markdown code blocks if present
    let jsonContent = content.trim();
    if (jsonContent.startsWith('```json')) {
      jsonContent = jsonContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (jsonContent.startsWith('```')) {
      jsonContent = jsonContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    // Parse the JSON response
    const testSpec = JSON.parse(jsonContent);
    
    return testSpec;
  } catch (error) {
    console.error('Error calling OpenAI for cookie consent test:', error);
    throw error;
  }
}

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

// GET /api/ssd/fetch-html - Download HTML and extract cookie banner
app.get('/api/ssd/fetch-html', async (req, res) => {
  const correlationId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    const { url } = req.query;

    // Validazione URL
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ 
        error: 'URL parameter is required',
        code: 'MISSING_URL'
      });
    }

    // Normalizza URL
    let targetUrl: string;
    try {
      targetUrl = normalizeOrigin(url);
    } catch (urlError) {
      return res.status(400).json({ 
        error: 'Invalid URL format',
        code: 'INVALID_URL'
      });
    }

    console.log(`[${correlationId}] Fetching HTML and extracting cookie banner for: ${targetUrl}`);

    // Avvia Puppeteer per scaricare l'HTML
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
      const page = await browser.newPage();
      
      // Imposta user agent per evitare blocchi
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      // Naviga alla pagina
      await page.goto(targetUrl, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });

      // Aspetta un po' per assicurarsi che i cookie banner si carichino
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Estrai l'HTML completo
      const html = await page.content();

      // Estrai il cookie banner
      const cookieBanner = await extractCookieBannerWithPuppeteer(page);

      console.log(`[${correlationId}] Cookie banner extraction completed:`, {
        found: cookieBanner.found,
        type: cookieBanner.type,
        position: cookieBanner.position,
        textLength: cookieBanner.text.length
      });

      // Stampa il cookie banner nel backend
      if (cookieBanner.found) {
        console.log(`[${correlationId}] ===== COOKIE BANNER FOUND =====`);
        console.log(`[${correlationId}] Type: ${cookieBanner.type}`);
        console.log(`[${correlationId}] Position: ${cookieBanner.position}`);
        console.log(`[${correlationId}] Selectors: ${cookieBanner.selectors.join(', ')}`);
        console.log(`[${correlationId}] Text: ${cookieBanner.text.substring(0, 200)}${cookieBanner.text.length > 200 ? '...' : ''}`);
        console.log(`[${correlationId}] HTML: ${cookieBanner.html.substring(0, 500)}${cookieBanner.html.length > 500 ? '...' : ''}`);
        console.log(`[${correlationId}] ===== BUTTONS FOUND =====`);
        if (cookieBanner.buttons && cookieBanner.buttons.length > 0) {
          cookieBanner.buttons.forEach((button, index) => {
            console.log(`[${correlationId}] Button ${index + 1}:`);
            console.log(`[${correlationId}]   ID: ${button.id}`);
            console.log(`[${correlationId}]   Class: ${button.className}`);
            console.log(`[${correlationId}]   Text: "${button.text}"`);
            console.log(`[${correlationId}]   Type: ${button.type}`);
            console.log(`[${correlationId}]   Role: ${button.role}`);
            console.log(`[${correlationId}]   Selector: ${button.selector}`);
            console.log(`[${correlationId}]   Is Accept All: ${button.isAcceptAll} (confidence: ${button.confidence})`);
            console.log(`[${correlationId}]   Position: ${button.position}`);
          });
        } else {
          console.log(`[${correlationId}] No buttons found in cookie banner`);
        }
        console.log(`[${correlationId}] ================================`);
        
        // Genera Test Specification per la CTA di accettazione cookie
        console.log(`[${correlationId}] ===== GENERATING COOKIE CONSENT TEST =====`);
        try {
          const cookieTestSpec = await generateCookieConsentTestSpec(targetUrl, cookieBanner);
          console.log(`[${correlationId}] Generated Cookie Consent Test Specification:`);
          console.log(`[${correlationId}] Site: ${cookieTestSpec.site}`);
          console.log(`[${correlationId}] Test Section: ${cookieTestSpec.tests[0].section}`);
          console.log(`[${correlationId}] Steps: ${cookieTestSpec.tests[0].steps.length}`);
          console.log(`[${correlationId}] Full Test Spec:`);
          console.log(JSON.stringify(cookieTestSpec, null, 2));
          console.log(`[${correlationId}] ==========================================`);
          
          // ESEGUI IL TEST GENERATO
          console.log(`[${correlationId}] ===== EXECUTING COOKIE CONSENT TEST =====`);
          try {
            const testResult = await executeCookieConsentTest(cookieTestSpec, page);
            console.log(`[${correlationId}] Cookie Consent Test Result:`);
            console.log(`[${correlationId}] Status: ${testResult.status}`);
            console.log(`[${correlationId}] DataLayer Events Found: ${testResult.dataLayerEvents.length}`);
            console.log(`[${correlationId}] Consent Status: ${testResult.consentStatus}`);
            console.log(`[${correlationId}] Test Details:`);
            console.log(JSON.stringify(testResult, null, 2));
            console.log(`[${correlationId}] ==========================================`);
          } catch (testError) {
            console.error(`[${correlationId}] Error executing cookie consent test:`, testError);
          }
        } catch (error) {
          console.error(`[${correlationId}] Error generating cookie consent test:`, error);
        }
      } else {
        console.log(`[${correlationId}] No cookie banner found on the page`);
      }

      res.json({
        url: targetUrl,
        html: html,
        cookieBanner: cookieBanner,
        timestamp: new Date().toISOString()
      });

    } finally {
      await browser.close();
    }

  } catch (error) {
    console.error(`[${correlationId}] Error fetching HTML and extracting cookie banner:`, error);
    
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Internal server error',
      code: 'FETCH_ERROR'
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

