// server-ssd.js
// Complete SSD Test server with real PDF processing and Puppeteer execution
// ---------------------------------------------------------------------------
// @ts-nocheck

import 'dotenv/config';
import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';

// Import our SSD services
import { extractPDFText, extractPDFTextFromBuffer, validatePDFFile, PDFExtractionError } from './src/services/pdfTextExtraction.js';
import { OpenAISpecService, OpenAIError as ServiceOpenAIError } from './src/services/openaiSpecService.js';
import { validateTestSpec, SpecValidationError } from './src/services/specValidation.js';
import { z } from 'zod';
import { SSDPuppeteerRunner, SSDRunnerError } from './src/services/ssdPuppeteerRunner.js';
import { normalizeOrigin, isValidUrl } from './src/utils/url.js';
import { extractCookieBannerWithPuppeteer } from './src/services/cookieBannerExtractor.js';
import { llmPdfSpec } from './src/services/llmPdfSpec.js';
import puppeteer from 'puppeteer';
import { runConsentTest, ConsentTestInputSchema, type ConsentRunnerDependencies } from './src/ai-sentinel/pw-runner.js';
import { ConsentLLMService } from './src/ai-sentinel/llm/consent-llm-service.js';
import ga4InsightsRouter from './src/services/ga4-insights.server.ts';
import ga4SearchRouter from "./src/services/ga4-search.server";
import ga4ChatRouter from './src/services/ga4-chat.server.ts';
import dashboardsBuildRouter from "./src/services/dashboards-build.server";
import studioIntentRouter from "./src/services/studio-intent.server";
import studioRunRouter from "./src/services/studio-run.server";
import studioMetaRouter from "./src/services/studio-meta.server";
import studioShareRouter from "./src/services/studio-share.server";


// Global type declarations
declare global {
  interface Window {
    dataLayer?: any[];
    _originalDataLayer?: any[];
    _capturedEvent?: any;
    _capturedDataLayer?: any;
    _finalDataLayer?: any;
    originalDataLayerPush?: any;
  }
}

// Type definitions
interface TestStep {
  step: number;
  description: string;
  action: string;
  status: string;
  error: string | null;
}

interface ConsentTestResult {
  status: string;
  dataLayerEvents: any[];
  consentStatus: string;
  steps: TestStep[];
  error: string | null;
  duration: number;
  browserInstance: any | null;
  cookieBtnSelector: string | null;
  cookieBtnOuterHTML: string | null;
  page: any | null;
  pdfTestSpec?: any;
  [key: string]: any; // Allow additional dynamic properties
}

// Helper function for sleep
const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

// Error Classes with predefined codes
// ============================================================================

export class PdfExtractionError extends Error {
  constructor(message: string, public code: string = 'PDF_EXTRACTION_ERROR', public details?: any) {
    super(message);
    this.name = 'PdfExtractionError';
  }
}

export class OpenAIError extends Error {
  constructor(message: string, public code: string = 'OPENAI_ERROR', public details?: any) {
    super(message);
    this.name = 'OpenAIError';
  }
}

export class RunnerTimeoutError extends Error {
  constructor(message: string, public code: string = 'RUNNER_TIMEOUT', public details?: any) {
    super(message);
    this.name = 'RunnerTimeoutError';
  }
}

export class ValidationError extends Error {
  constructor(message: string, public code: string = 'VALIDATION_ERROR', public details?: any) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NavigationError extends Error {
  constructor(message: string, public code: string = 'NAVIGATION_ERROR', public details?: any) {
    super(message);
    this.name = 'NavigationError';
  }
}

export class FileUploadError extends Error {
  constructor(message: string, public code: string = 'FILE_UPLOAD_ERROR', public details?: any) {
    super(message);
    this.name = 'FileUploadError';
  }
}

export class ConfigurationError extends Error {
  constructor(message: string, public code: string = 'CONFIGURATION_ERROR', public details?: any) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

// HTTP Error Normalization Function
// ============================================================================

interface HttpError {
  code: string;
  httpStatus: number;
  message: string;
  details?: any;
}

export function toHttpError(e: Error): HttpError {
  // Handle specific error classes
  if (e instanceof PdfExtractionError) {
    switch (e.code) {
      case 'NO_TEXT_CONTENT':
        return { code: 'PDF_EMPTY', httpStatus: 400, message: e.message, details: e.details };
      case 'PASSWORD_PROTECTED':
        return { code: 'PDF_PASSWORD_PROTECTED', httpStatus: 422, message: e.message, details: e.details };
      default:
        return { code: 'PDF_EXTRACTION_ERROR', httpStatus: 422, message: e.message, details: e.details };
    }
  }

  if (e instanceof OpenAIError) {
    switch (e.code) {
      case 'RATE_LIMIT':
        return { code: 'OPENAI_RATE_LIMIT', httpStatus: 429, message: e.message, details: e.details };
      case 'INVALID_API_KEY':
        return { code: 'OPENAI_INVALID_KEY', httpStatus: 401, message: e.message, details: e.details };
      case 'TIMEOUT':
        return { code: 'OPENAI_TIMEOUT', httpStatus: 504, message: e.message, details: e.details };
      default:
        return { code: 'OPENAI_ERROR', httpStatus: 422, message: e.message, details: e.details };
    }
  }

  if (e instanceof RunnerTimeoutError) {
    return { code: 'NAVIGATION_TIMEOUT', httpStatus: 504, message: e.message, details: e.details };
  }

  if (e instanceof ValidationError) {
    switch (e.code) {
      case 'INVALID_JSON':
        return { code: 'INVALID_JSON', httpStatus: 422, message: e.message, details: e.details };
      case 'SCHEMA_VALIDATION':
        return { code: 'SCHEMA_VALIDATION', httpStatus: 422, message: e.message, details: e.details };
      default:
        return { code: 'VALIDATION_ERROR', httpStatus: 422, message: e.message, details: e.details };
    }
  }

  if (e instanceof NavigationError) {
    return { code: 'NAVIGATION_ERROR', httpStatus: 504, message: e.message, details: e.details };
  }

  if (e instanceof FileUploadError) {
    switch (e.code) {
      case 'INVALID_FILE_TYPE':
        return { code: 'INVALID_FILE_TYPE', httpStatus: 415, message: e.message, details: e.details };
      case 'FILE_TOO_LARGE':
        return { code: 'FILE_TOO_LARGE', httpStatus: 413, message: e.message, details: e.details };
      case 'INVALID_PDF_SIGNATURE':
        return { code: 'INVALID_PDF_SIGNATURE', httpStatus: 415, message: e.message, details: e.details };
      default:
        return { code: 'FILE_UPLOAD_ERROR', httpStatus: 400, message: e.message, details: e.details };
    }
  }

  if (e instanceof ConfigurationError) {
    return { code: 'CONFIGURATION_ERROR', httpStatus: 500, message: e.message, details: e.details };
  }

  // Handle generic errors with common patterns
  const message = e.message || 'Unknown error';
  
  if (message.includes('URL') && message.includes('invalid')) {
    return { code: 'URL_INVALID', httpStatus: 400, message, details: { originalError: e.name } };
  }
  
  if (message.includes('timeout') || message.includes('TIMEOUT')) {
    return { code: 'NAVIGATION_TIMEOUT', httpStatus: 504, message, details: { originalError: e.name } };
  }
  
  if (message.includes('JSON') && (message.includes('invalid') || message.includes('parse'))) {
    return { code: 'INVALID_JSON', httpStatus: 422, message, details: { originalError: e.name } };
  }
  
  if (message.includes('rate limit') || message.includes('too many requests')) {
    return { code: 'OPENAI_RATE_LIMIT', httpStatus: 429, message, details: { originalError: e.name } };
  }

  // Fallback for unknown errors
  return { 
    code: 'INTERNAL_ERROR', 
    httpStatus: 500, 
    message: 'Internal server error', 
    details: { originalError: e.name, originalMessage: e.message } 
  };
}

// Helper function for uniform error responses
// Usage examples:
// - PDF vuoto → sendError(res, 400, 'PDF_EMPTY', 'PDF text content is empty')
// - JSON non valido da LLM → sendError(res, 422, 'INVALID_JSON', 'Invalid JSON response from OpenAI')
// - Timeout navigazione runner → sendError(res, 504, 'NAVIGATION_TIMEOUT', 'Navigation timeout occurred')
export function sendError(res: any, httpStatus: number, code: string, message: string, details?: any) {
  const response: any = { error: { code, message } };
  if (details !== undefined) {
    response.error.details = details;
  }
  return res.status(httpStatus).json(response);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT ?? 3001);

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

// GA4 insights API
app.use(ga4InsightsRouter);
//GA4 Search
app.use(ga4SearchRouter);
//GA4 Chat
app.use(ga4ChatRouter);
app.use(studioIntentRouter);
app.use(studioRunRouter);
app.use(studioShareRouter);
app.use(studioMetaRouter);

console.log("[GA4] Chat router: montato su /api/ga4/chat");
console.log("[GA4] Quick Search router: montato su /api/ga4/search");

// Static files for artifacts with CORS headers
app.use('/artifacts', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || 'http://localhost:5173');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  next();
}, express.static('artifacts'));


// Input sanitization middleware
app.use((req, res, next) => {
  // Sanitize request body for SSD endpoints
  if (req.path.startsWith('/api/ssd/')) {
    if (req.body && typeof req.body === 'object') {
      // Remove any potentially dangerous keys
      const sanitizedBody = {};
      for (const [key, value] of Object.entries(req.body)) {
        // Only allow expected keys for SSD endpoints
        if (['url', 'dsl', 'runOptions', 'pdfContent', 'pdfBufferPath'].includes(key)) {
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
let openaiService: OpenAISpecService | null = null;
try {
  if (config.openaiApiKey) {
    openaiService = new OpenAISpecService(config.openaiApiKey, config.openaiModel, config.openaiTimeoutMs);
  }
} catch (error: any) {
  console.log('⚠️  OpenAI service not available:', error.message);
}

let consentLLMService: ConsentLLMService | undefined;
if (config.openaiApiKey) {
  try {
    consentLLMService = new ConsentLLMService({
      apiKey: config.openaiApiKey,
      model: process.env.CONSENT_LLM_MODEL || config.openaiModel,
      cacheTtlMs: parseInt(process.env.CONSENT_LLM_CACHE_TTL_MS || '604800000'),
      temperature: parseFloat(process.env.CONSENT_LLM_TEMPERATURE || '0.2'),
    });
    console.log('🤖 Consent LLM resolver attivo');
  } catch (error: any) {
    console.log('⚠️  Consent LLM service not available:', error.message);
  }
} else {
  console.log('⚠️  Consent LLM disabilitato: manca OPENAI_API_KEY');
}

const puppeteerRunner = new SSDPuppeteerRunner({
  screenshotDir: 'screenshots',
  timeout: config.runnerStepTimeoutMs,
});

/**
 * Genera test specification per contenuto PDF
 */
async function generatePdfTestSpec(siteUrl: string, pdfContent: string, htmlContent?: string, pdfBuffer?: Buffer) {
  console.log('===== GENERATING PDF TEST SPECIFICATION =====');
  console.log('Site URL:', siteUrl);
  console.log('PDF Content length:', pdfContent?.length || 0);
  console.log('PDF Content preview:', pdfContent?.substring(0, 200) + '...');
  console.log('PDF Buffer available:', !!pdfBuffer);
  console.log('PDF Buffer size:', pdfBuffer?.length || 0, 'bytes');
  console.log('HTML Content available:', !!htmlContent);
  console.log('HTML Content size:', htmlContent?.length || 0, 'bytes');
  
  // Fix: Handle empty pdfContent
  if (!pdfContent || pdfContent.trim().length === 0) {
    console.log('⚠️ PDF Content is empty, skipping PDF test generation');
    return null;
  }
  
  if (!config.openaiApiKey) {
    throw new ConfigurationError('OpenAI API key not configured', 'OPENAI_NOT_CONFIGURED');
  }
  
  console.log('🔑 OpenAI API Key configured:', !!config.openaiApiKey);
  console.log('📝 Preparing files for OpenAI...');

  try {
    // Create temporary directory for files
    const tempDir = join(process.cwd(), 'temp-openai');
    await fs.mkdir(tempDir, { recursive: true });
    
    let pdfFilePath = '';
    let htmlFilePath = '';
    
    // Note: We don't need to save PDF file anymore, we use the extracted text directly
    
        // Use existing HTML file instead of saving new one
        htmlFilePath = join(process.cwd(), 'temp-openai', 'website.txt');
        if (!fsSync.existsSync(htmlFilePath)) {
          // Fallback: save HTML file if website.txt doesn't exist
          htmlFilePath = join(tempDir, 'website.html');
          fsSync.writeFileSync(htmlFilePath, htmlContent || '');
          console.log('✅ HTML file saved:', htmlFilePath);
        } else {
          // Use existing website.txt
          htmlContent = fsSync.readFileSync(htmlFilePath, 'utf8');
          console.log('✅ Using existing HTML file:', htmlFilePath);
          console.log('✅ HTML Content size from file:', htmlContent.length);
        }
        
        // Use existing toTest.pdf instead of document.pdf
        const toTestPdfPath = join(process.cwd(), 'temp-openai', 'toTest.pdf');
        if (fsSync.existsSync(toTestPdfPath)) {
          console.log('✅ Using toTest.pdf instead of document.pdf');
          console.log('✅ toTest.pdf size:', fsSync.statSync(toTestPdfPath).size, 'bytes');
        }
    
    // Create prompt for OpenAI
    const prompt = `You are an expert in web testing and digital marketing. 

    I need you to generate a test specification based on the PDF content and the HTML content provided.

    IMPORTANT: The cookies have ALREADY been accepted in the browser session. 

    You must IGNORE any cookie-related steps and generate a test that focuses ONLY on the main action described in the PDF.

    DO NOT include any cookie acceptance, cookie consent, or cookie-related steps in your test specification.
    The test should start directly with the main interaction described in the PDF.

    Site URL: ${siteUrl}

    PDF Content:
    ${pdfContent}

    Please analyze the PDF content above and the HTML content to create a test specification that focuses ONLY on the specific test described in the PDF (e.g., header menu clicks, form submissions, etc.).
    
    Generate the specification in the following JSON format:
    
    {
      "site": "${siteUrl}",
      "allowed_hosts": ["${new URL(siteUrl).hostname}"],
      "consent": ["accept"],
      "tests": [
        {
          "section": "PDF Test Scenarios",
          "steps": [
            {
              "description": "Step description",
              "action": "navigate|click|wait|scroll|type",
              "target": {
                "kind": "selector|href|text",
                "value": "target value"
              },
              "expect": [
                {
                  "type": "navigation|dataLayer|element|text",
                  "url_contains": "expected URL part",
                  "event": "expected event name",
                  "text_contains": "expected text",
                  "selector": "expected element selector"
                }
              ]
            }
          ]
        }
      ]
    }
    
    CRITICAL SELECTOR REQUIREMENTS:
    - ANALYZE the HTML content provided below to find REAL selectors that exist
    - DO NOT invent selectors - only use ones that actually exist in the HTML
    - Use ONLY standard CSS selectors that work in Puppeteer
    - Use "header a" instead of specific IDs like "a#nav-privati-mobile"
    - Use "nav a" instead of mobile-specific selectors
    - Use "button" instead of complex selectors
    - Use "input[type='submit']" for form buttons
    - Use attribute selectors like "a[href*='home']" instead of :contains()
    - AVOID jQuery selectors like :contains(), :is(), :not()
    - AVOID mobile-specific IDs, classes, or selectors
    - AVOID complex CSS selectors with multiple conditions
    - AVOID selectors that end with "-mobile" or contain "mobile"
    - Make selectors work universally across all device types
    - Use ONLY valid CSS selectors that Puppeteer can understand
    - NEVER use "kind": "text" - always use "kind": "selector" with CSS selectors
    - Look for buttons by class names like ".btn", ".button", or specific classes
    - For text-based targeting, use CSS selectors that match the button's class or ID
    - ALWAYS use "kind": "selector" in the target object
    - NEVER use "kind": "text" - this will cause test failures
    - Look for actual button elements in the HTML and use their CSS selectors
    - Examples of valid selectors: ".btn", "#button-id", "button[class*='btn']"
    - Examples of INVALID selectors: text content, button text, etc.
    - IMPORTANT: Search the HTML content for actual button elements and use their real selectors
    - If you cannot find specific selectors, use generic ones like "button", "a", "input[type='submit']"

    Important guidelines:
    - DO NOT include any cookie-related steps (cookies are already accepted)
    - Focus ONLY on the main action described in the PDF
    - Create realistic test steps based on the PDF content
    - Include dataLayer event expectations where relevant
    - Make sure the test is executable and meaningful
    - Focus on user interactions and expected outcomes
    - Include navigation steps if needed
    - Add wait steps for dynamic content if necessary
    
    Return only the JSON specification, no additional text.`;

    console.log('📤 Sending request to OpenAI with files...');
    console.log('📋 Prompt length:', prompt.length);
    
    // Use standard chat completion with HTML content in prompt
    const htmlContentTruncated = htmlContent && htmlContent.length > 100000 ? 
      htmlContent.substring(0, 100000) + '\n\n[HTML CONTENT TRUNCATED...]' : 
      htmlContent || '';
    
    const promptWithHtml = `${prompt}

HTML Content of the website:
\`\`\`html
${htmlContentTruncated}
\`\`\`

Please analyze the HTML to generate accurate selectors for the test specification.`;

    console.log('📤 Using standard chat completion with HTML in prompt...');
    console.log('📋 Final prompt length:', promptWithHtml.length);
    
    if (!openaiService) {
      throw new Error('OpenAI service is not configured. Please set VITE_OPENAI_API_KEY environment variable.');
    }
    
    const response = await openaiService.convertPDFToTestSpec(pdfContent, siteUrl, promptWithHtml);
    console.log('✅ OpenAI response received');
    console.log('📊 Response type:', typeof response);
    console.log('📊 Response keys:', Object.keys(response || {}));
    console.log('📊 Response.dsl type:', typeof response?.dsl);
    
    const generatedSpec = JSON.stringify(response.dsl);
    console.log('===== OPENAI PDF TEST SPECIFICATION RESPONSE =====');
    console.log('Generated PDF Test Specification:', generatedSpec);
    console.log('==================================================');
    
    console.log('🔄 Parsing JSON response...');
    const parsedSpec = JSON.parse(generatedSpec);
    console.log('✅ JSON parsed successfully');
    console.log('📊 Parsed spec keys:', Object.keys(parsedSpec || {}));
    console.log('📊 Number of tests:', parsedSpec.tests?.length || 0);
    
    // Log original steps before filtering
    if (parsedSpec.tests && parsedSpec.tests.length > 0) {
      parsedSpec.tests.forEach((test, testIndex) => {
        console.log(`📋 Test ${testIndex + 1}: ${test.section}`);
        console.log(`📋 Original steps count: ${test.steps?.length || 0}`);
        test.steps?.forEach((step, stepIndex) => {
          console.log(`  Step ${stepIndex + 1}: ${step.description}`);
        });
      });
    }
    
    console.log('🔍 Applying cookie consent filter...');
    // Filter out cookie consent steps since cookies are already accepted
    if (parsedSpec.tests && parsedSpec.tests.length > 0) {
      parsedSpec.tests.forEach((test, testIndex) => {
        if (test.steps) {
          const originalStepCount = test.steps.length;
          // Remove steps that are related to cookie acceptance
          test.steps = test.steps.filter(step => {
            const description = step.description?.toLowerCase() || '';
            const isCookieStep = description.includes('cookie') || 
                                description.includes('consent') || 
                                description.includes('accept all');
            
            if (isCookieStep) {
              console.log('🚫 Filtered out cookie consent step:', step.description);
            }
            
            return !isCookieStep;
          });
          console.log(`📊 Test ${testIndex + 1}: Filtered ${originalStepCount} → ${test.steps.length} steps`);
        }
      });
    }
    
    console.log('🔍 Converting text selectors to CSS selectors...');
    console.log('🔍 DEBUG: parsedSpec.tests exists:', !!parsedSpec.tests);
    console.log('🔍 DEBUG: parsedSpec.tests.length:', parsedSpec.tests?.length);
    // Convert text-based selectors to CSS selectors
    if (parsedSpec.tests && parsedSpec.tests.length > 0) {
      parsedSpec.tests.forEach((test, testIndex) => {
        if (test.steps) {
          test.steps.forEach((step, stepIndex) => {
            if (step.target && step.target.kind === 'text') {
              const textValue = step.target.value;
              console.log(`🔄 Converting text selector "${textValue}" to CSS selector`);
              
              // Convert text to CSS selector based on common patterns
              let cssSelector = '';
              if (textValue.toLowerCase().includes('chiamiamo gratis')) {
                cssSelector = 'button, a[href*="call"], [class*="call"]';
              } else if (textValue.toLowerCase().includes('scrivi in chat')) {
                cssSelector = 'button, a[href*="chat"], [class*="chat"]';
              } else if (textValue.toLowerCase().includes('verifica copertura')) {
                cssSelector = 'button, a[href*="verifica"], [class*="verifica"]';
              } else if (textValue.toLowerCase().includes('maggiori dettagli')) {
                cssSelector = 'button, a[href*="dettagli"], [class*="dettagli"]';
              } else {
                // Generic fallback - use common button patterns
                cssSelector = 'button, a[role="button"], input[type="submit"]';
              }
              
              // Update the target
              step.target = {
                kind: 'selector',
                value: cssSelector
              };
              
              console.log(`✅ Converted "${textValue}" → "${cssSelector}"`);
            }
          });
        }
      });
    }
    
    console.log('===== FILTERED PDF TEST SPECIFICATION =====');
    console.log('Filtered PDF Test Specification:', JSON.stringify(parsedSpec, null, 2));
    console.log('===========================================');
    
    // Clean up temporary files
    try {
      if (htmlFilePath && fsSync.existsSync(htmlFilePath)) {
        fsSync.unlinkSync(htmlFilePath);
      }
      if (fsSync.existsSync(tempDir)) {
        fsSync.rmdirSync(tempDir);
      }
      console.log('✅ Temporary files cleaned up');
    } catch (cleanupError) {
      console.log('⚠️ Error cleaning up temporary files:', cleanupError.message);
    }
    
    console.log('✅ PDF Test Specification generation completed successfully');
    return parsedSpec;
  } catch (error: any) {
    console.error('❌ Error generating PDF test specification:', error);
    console.error('❌ Error details:', {
      message: (error as Error).message,
      stack: error.stack,
      name: error.name
    });
    throw new OpenAIError(`Failed to generate PDF test specification: ${(error as Error).message}`, 'PDF_SPEC_GENERATION_FAILED');
  }
}

/**
 * Esegue il cookie consent test usando il DSL fornito
 */
async function executeCookieConsentTestFromDSL(dsl: any, options: any): Promise<ConsentTestResult> {
  const result: ConsentTestResult = {
    status: 'FAIL',
    dataLayerEvents: [],
    consentStatus: 'unknown',
    steps: [],
    error: null,
    duration: 0,
    browserInstance: null,
    cookieBtnSelector: null,
    cookieBtnOuterHTML: null,
    page: null // Add page to result
  };

  const startTime = Date.now();
  let browser: any | null = null;

  try {
    console.log('===== EXECUTING COOKIE CONSENT TEST FROM DSL =====');
    console.log('DSL site:', dsl.site);
    console.log('DSL tests:', dsl.tests?.length || 0);
    console.log('==================================================');
    
    // Launch browser
    browser = await puppeteer.launch({
      headless: options.headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    result.browserInstance = browser;
    
    const page = await browser.newPage();
    console.log('✓ Browser launched and page created');
    result.page = page; // Store page in result
    
    // Execute cookie consent test steps from DSL
    for (let i = 0; i < dsl.tests[0].steps.length; i++) {
      const step = dsl.tests[0].steps[i];
      console.log(`Executing step ${i + 1}: ${step.description}`);
      
      const stepResult: TestStep = {
        step: i + 1,
        description: step.description,
        action: step.action,
        status: 'FAIL',
        error: null
      };
      
      try {
        if (step.action === 'navigate') {
          await page.goto(step.target.value, { waitUntil: 'networkidle2' });
          console.log('✓ Navigation successful');
          stepResult.status = 'PASS';
        } else if (step.action === 'click') {
          // Wait for cookie banner to load and become visible
          console.log('Waiting for cookie banner to load and become visible...');
          console.log('Looking for selector:', step.target.value);
          await page.waitForSelector(step.target.value, { timeout: 15000 });
          console.log('✓ Cookie banner button found and visible');
          
          // Check dataLayer BEFORE click
          const dataLayerBefore = await page.evaluate(() => window.dataLayer || []);
          console.log('DataLayer BEFORE click:', dataLayerBefore.length, 'events');
          console.log('DataLayer BEFORE click events:', dataLayerBefore);
          
          // Capture cookie button selector and outerHTML for diagnosis
          result.cookieBtnSelector = step.target.value;
          console.log(`Cookie button selector: ${step.target.value}`);
          
          // Get outerHTML of the button
          try {
            result.cookieBtnOuterHTML = await page.$eval(step.target.value, el => el.outerHTML);
            console.log(`Cookie button outerHTML captured: ${result.cookieBtnOuterHTML?.substring(0, 200)}...`);
          } catch (outerHTMLError) {
            console.log(`Warning: Could not capture outerHTML: ${(outerHTMLError as Error).message}`);
            result.cookieBtnOuterHTML = 'Error capturing outerHTML';
          }
          
          // Click the button
          await page.click(step.target.value);
          console.log(`✓ Click successful on ${step.target.value}`);
          
          // Wait for consent to be processed
          console.log('Waiting 15 seconds for consent to be fully processed...');
          await new Promise(resolve => setTimeout(resolve, 15000));
          
          // Check dataLayer AFTER click
          const dataLayerAfter = await page.evaluate(() => window.dataLayer || []);
          console.log('DataLayer AFTER click:', dataLayerAfter.length, 'events');
          console.log('DataLayer AFTER click events:', dataLayerAfter);
          
          // Find new events
          const newEvents = dataLayerAfter.slice(dataLayerBefore.length);
          console.log('New events added:', newEvents.length);
          console.log('New events:', newEvents);
          
          // Check for consent events
          const consentEvents = newEvents.filter(event => 
            (event.event && event.event.includes('consent')) ||
            (event['0'] === 'consent') ||
            (event['1'] === 'update')
          );
          
          console.log('Consent events found:', consentEvents.length);
          console.log('Consent events:', consentEvents);
          
          if (consentEvents.length > 0) {
            result.dataLayerEvents = consentEvents;
            result.consentStatus = 'accepted';
            stepResult.status = 'PASS';
          } else {
            stepResult.status = 'FAIL';
            stepResult.error = 'No consent events found in dataLayer';
          }
        }
        
        (result.steps as any[]).push(stepResult);
      } catch (stepError) {
        console.error(`Error in step ${i + 1}:`, stepError);
        stepResult.status = 'FAIL';
        stepResult.error = (stepError as Error).message;
        (result.steps as any[]).push(stepResult);
        break;
      }
    }
    
    // Determine overall result
    const allStepsPassed = result.steps.every(step => step.status === 'PASS');
    result.status = allStepsPassed ? 'PASS' : 'FAIL';
    result.duration = Date.now() - startTime;
    
    console.log('✓ Cookie consent test completed:', result.status);
    return result;
    
  } catch (error: any) {
    console.error('Error executing cookie consent test:', error);
        (result as any).error = (error as Error).message;
    result.duration = Date.now() - startTime;
    return result;
  }
}

/**
 * Normalizza la specifica PDF per il formato runner
 * Accetta sia il formato "LLM" che quello "interno" e li mappa al formato runner
 */
function normalizePdfSpec(input: any): any {
  // Se input?.tests è già un array → restituisci così com'è (già formato runner)
  if (input?.tests && Array.isArray(input.tests)) {
    return input;
  }
  
  // Se input?.test_spec esiste, processa il formato interno
  if (input?.test_spec) {
    const testSpec = input.test_spec;
    
    if (!testSpec.steps || !Array.isArray(testSpec.steps)) {
      const error = new Error('Spec PDF priva di test/steps');
      (error as any).code = 'INVALID_PDF_SPEC';
      throw error;
    }
    
    // Mappa ogni item con { section, steps }
    const mappedTests = testSpec.steps.map((item: any) => {
      if (!item.section || !item.steps || !Array.isArray(item.steps)) {
        const error = new Error('Spec PDF priva di test/steps');
        (error as any).code = 'INVALID_PDF_SPEC';
        throw error;
      }
      
      return {
        section: item.section,
        steps: item.steps.map((step: any) => {
          const normalizedStep: any = {
            action: step.action,
            target: step.target,
            value: step.value
          };
          
          // Processa expectations se esistono
          if (step.expectations) {
            const expectArray: any[] = [];
            
            // Se c'è expectations.dataLayer
            if (step.expectations.dataLayer) {
              const dataLayer = step.expectations.dataLayer;
              let event = '';
              let params_subset = {};
              
              if (typeof dataLayer === 'string') {
                event = dataLayer;
              } else if (typeof dataLayer === 'object' && dataLayer !== null) {
                // Se dataLayer è un oggetto con chiavi (event + params)
                if (dataLayer.event) {
                  event = dataLayer.event;
                  // Metti le altre chiavi in params_subset
                  const { event: _, ...rest } = dataLayer;
                  params_subset = rest;
                } else {
                  // Se non c'è event, usa la prima chiave come event
                  const keys = Object.keys(dataLayer);
                  if (keys.length > 0) {
                    event = keys[0];
                    const { [keys[0]]: _, ...rest } = dataLayer;
                    params_subset = rest;
                  }
                }
              }
              
              if (event) {
                expectArray.push({
                  type: 'dataLayer',
                  event: event,
                  params_subset: Object.keys(params_subset).length > 0 ? params_subset : undefined
                });
              }
            }
            
            // Se c'è expectations.network_requests (array)
            if (step.expectations.network_requests && Array.isArray(step.expectations.network_requests)) {
              step.expectations.network_requests.forEach((url: string) => {
                expectArray.push({
                  type: 'network',
                  url_contains: url
                });
              });
            }
            
            if (expectArray.length > 0) {
              normalizedStep.expect = expectArray;
            }
          }
          
          // Rimuovi il campo expectations
          delete normalizedStep.expectations;
          
          return normalizedStep;
        })
      };
    });
    
    return { tests: mappedTests };
  }
  
  // Se dopo la normalizzazione tests è vuoto o non-array, lancia errore
  if (!input?.tests || !Array.isArray(input.tests) || input.tests.length === 0) {
    const error = new Error('Spec PDF priva di test/steps');
    (error as any).code = 'INVALID_PDF_SPEC';
    throw error;
  }
  
  return input;
}

// --- UNIVERSAL resolver that clicks ONLY links, never containers ---
async function resolveSelectorForHeaderLink(page: import('puppeteer').Page) {
  console.log('[resolver] Starting UNIVERSAL header link resolution...');
  
  try {
    // Use sleep instead of page.waitForTimeout (not available in all versions)
    await sleep(300);
    
    // UNIVERSAL APPROACH: Only target actual clickable elements, never containers
    // Priority order: links in header > any links > buttons > other clickable
    
    // 1. First try: Links specifically within header/nav areas
    const headerLinkSelector = "header a[href]:not([href='#']):not([aria-hidden='true']), [role='banner'] a[href]:not([href='#']):not([aria-hidden='true']), .header a[href]:not([href='#']):not([aria-hidden='true']), #header a[href]:not([href='#']):not([aria-hidden='true']), nav[aria-label*='menu' i] a[href]:not([href='#']):not([aria-hidden='true']), nav[aria-label*='navigation' i] a[href]:not([href='#']):not([aria-hidden='true'])";
    
    const headerLinks = await page.$$(headerLinkSelector);
    if (headerLinks.length > 0) {
      console.log(`[resolver] ✅ Found ${headerLinks.length} links in header areas`);
      return headerLinkSelector;
    }
    
    // 2. Second try: Any visible links on the page (universal fallback)
    const anyLinkSelector = "a[href]:not([href='#']):not([aria-hidden='true']):not([tabindex='-1'])";
    const anyLinks = await page.$$(anyLinkSelector);
    if (anyLinks.length > 0) {
      console.log(`[resolver] ✅ Found ${anyLinks.length} links on page (universal fallback)`);
      return anyLinkSelector;
    }
    
    // 3. Third try: Buttons in header areas
    const headerButtonSelector = "header button:not([disabled]), [role='banner'] button:not([disabled]), .header button:not([disabled]), #header button:not([disabled]), nav[aria-label*='menu' i] button:not([disabled]), nav[aria-label*='navigation' i] button:not([disabled])";
    const headerButtons = await page.$$(headerButtonSelector);
    if (headerButtons.length > 0) {
      console.log(`[resolver] ✅ Found ${headerButtons.length} buttons in header areas`);
      return headerButtonSelector;
    }
    
    // 4. Last resort: Any clickable elements (but still avoid containers)
    const anyClickableSelector = "button:not([disabled]), [role='button']:not([disabled]), [onclick]:not([disabled])";
    const anyClickable = await page.$$(anyClickableSelector);
    if (anyClickable.length > 0) {
      console.log(`[resolver] ✅ Found ${anyClickable.length} clickable elements (last resort)`);
      return anyClickableSelector;
    }
    
    console.log('[resolver] ❌ No clickable elements found');
    return null;
    
  } catch (error: any) {
    console.error('[resolver] Error in header link resolution:', error);
    return null;
  }
}

/**
 * Esegue i test PDF usando il SSDPuppeteerRunner UNIVERSALE
 */
async function executePdfTests(testSpec: any, options: any, browserInstance: any, existingPage?: any) {
  const startTime = Date.now();

  try {
    console.log('===== EXECUTING PDF TESTS WITH UNIVERSAL RUNNER =====');
    console.log('Browser instance available:', !!browserInstance);
    console.log('Test specification type:', typeof testSpec);
    console.log('Number of tests:', testSpec?.tests?.length || 0);
    
    // Guard-rails: Check if spec is valid and has tests
    if (!testSpec || !Array.isArray(testSpec.tests) || testSpec.tests.length === 0) {
      console.warn('[PDF] No tests in spec, skipping');
      return { 
        status: 'error', 
        code: 'INVALID_PDF_SPEC', 
        message: 'Nessun test trovato nella spec PDF',
        steps: [],
        error: 'Nessun test trovato nella spec PDF',
        duration: Date.now() - startTime
      };
    }
    
    // Normalize PDF spec to runner format
    let normalized;
    try {
      normalized = normalizePdfSpec(testSpec);
      console.log('🔧 Normalized PDF spec (runner shape):', JSON.stringify(normalized, null, 2));
    } catch (error: any) {
      console.error('❌ Error normalizing PDF spec:', (error as Error).message);
      return {
          status: 'FAIL',
        steps: [],
        error: (error as Error).message,
        duration: Date.now() - startTime
      };
    }
    
    // Create a TestSpec for the SSDPuppeteerRunner
    const testSpecForRunner = {
      site: options.site || testSpec.site || 'https://fibra.aruba.it',
      allowed_hosts: options.allowedHosts || testSpec.allowed_hosts || ['fibra.aruba.it'],
      consent: ['accept'],
      tests: normalized.tests
    };
    
    console.log('🌐 TestSpec site:', testSpecForRunner.site);
    console.log('🌐 TestSpec allowed_hosts:', testSpecForRunner.allowed_hosts);
    
    console.log('🚀 Using SSDPuppeteerRunner with universal hook...');
    
    // Import and use the SSDPuppeteerRunner
    const { SSDPuppeteerRunner } = await import('./src/services/ssdPuppeteerRunner.js');
    
    // Create runner instance
    const runner = new SSDPuppeteerRunner({
      screenshotDir: options.screenshotDir || 'screenshots',
      timeout: options.timeout || 30000,
      navTimeoutMs: options.navTimeoutMs || 60000,
      requestTimeoutMs: options.requestTimeoutMs || 10000,
      spaRouteTimeoutMs: options.spaRouteTimeoutMs || 5000,
      fuzzy: false
    });
    
    // Enable debug logging for dataLayer
    process.env.SSD_DEBUG_LOGS = '1';
    
    // Use existing page if provided
    if (existingPage) {
      console.log('✓ Using existing page from cookie consent test - preserving consent state');
      // Set the page in the runner
      (runner as any).page = existingPage;
      (runner as any).browser = browserInstance;
      
      // CRITICAL: Re-apply the universal hook to the existing page
      console.log('🔄 Re-applying universal hook to existing page...');
      
      // Expose the capture function to the existing page
      await existingPage.exposeFunction('__ssdCaptureDataLayerEvent', (event: any) => {
        console.log('[ssd][capture] Event captured:', event.payload?.event || 'unknown');
        // Store events for later analysis
        if (!(existingPage as any).__ssdCapturedEvents) {
          (existingPage as any).__ssdCapturedEvents = [];
        }
        (existingPage as any).__ssdCapturedEvents.push(event);
      });
      
      // Inject hook directly into existing page using pure JavaScript string
      const hookScript = `
        console.log('[ssd][hook] Injecting UNIVERSAL hook into existing page');
        
        // EXACT COPY of the working manual code - NO CHANGES
        const logEvent = (label, payload) => {
          try {
            // Forward to backend capture function
            if (window.__ssdCaptureDataLayerEvent) {
              window.__ssdCaptureDataLayerEvent({
                timestamp: Date.now(),
                payload,
              });
            }
            console.log('[DL HOOK] ' + label, JSON.stringify(payload, null, 2));
          } catch (error) {
            console.warn('Failed to log dataLayer event', error);
          }
        };

        const patch = (arr, label) => {
          if (!Array.isArray(arr) || arr.__patched) return arr;
          
          const originalPush = arr.push;
          Object.defineProperty(arr, 'push', {
            configurable: true,
            writable: true,
            value: function patchedPush(...items) {
              items.forEach(ev => logEvent(label, ev));
              return originalPush.apply(this, items);
            },
          });
          arr.__patched = true;
          arr.forEach(ev => logEvent(label + ' (existing)', ev));
          return arr;
        };

        // Patch main dataLayer
        window.dataLayer = patch(window.dataLayer || [], 'window.dataLayer');

        // Patch GTM containers
        if (window.google_tag_manager) {
          Object.values(window.google_tag_manager).forEach(container => {
            if (container && container.dataLayer) {
              container.dataLayer = patch(container.dataLayer, 'gtm.dataLayer');
            }
          });
        }

        console.log('Hook attivo: ora premi il link header e guarda i log sopra.');
        logEvent('__ssd_hook_installed__', { event: '__ssd_hook_installed__' });
      `;
      
      await existingPage.evaluate(hookScript);
      
      console.log('✅ Universal hook injected into existing page');
      
      // IMPORTANT: Skip navigation since we're using existing page
      console.log('🚫 Skipping navigation - using existing page with consent state');
    } else {
      // Initialize browser and page
      await runner.initializeBrowser(options);
    }
    
    // Execute tests directly on existing page
    if (existingPage) {
      console.log('🎯 Executing tests directly on existing page...');
      
      const steps = normalized.tests[0]?.steps || [];
      const stepResults = [];
      
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
      console.log(`===== PDF TEST STEP ${i + 1} =====`);
      console.log(`📝 Description: ${step.description || 'No description'}`);
      console.log(`🎯 Action: ${step.action}`);
        console.log(`🎯 Target: ${step.target?.value}`);
      
      const stepResult = {
        step: i + 1,
        description: step.description || 'No description',
        action: step.action,
        status: 'FAIL',
        error: null
      };

      try {
          if (step.action === 'click') {
            // Resolve selector if needed
            let selector = step.target?.value;
            if (!selector || selector === 'to-be-determined') {
              console.log('🔍 Resolving selector in runtime...');
              const resolved = await resolveSelectorForHeaderLink(existingPage);
              if (resolved) {
                selector = resolved;
                console.log(`✅ Resolved selector: ${selector}`);
          } else {
                throw new Error('Could not resolve selector');
              }
            }
            
            // DIRECT APPROACH: Find and click without waiting for visibility
            console.log(`🖱️ Using direct approach: ${selector}`);
            
            // First, let's see what links we actually have
            const allLinks = await existingPage.$$('header a[href]:not([href="#"])');
            console.log(`🔍 Found ${allLinks.length} total links in header`);
            
            // Get details of each link for debugging
            for (let i = 0; i < Math.min(allLinks.length, 5); i++) {
              const linkInfo = await existingPage.evaluate((el) => {
            return {
              tagName: el.tagName,
                  text: el.textContent?.trim().substring(0, 50) || 'no-text',
              href: el.href || 'no-href',
              id: el.id || 'no-id',
                  className: el.className || 'no-class',
                  visible: el.offsetParent !== null,
                  display: window.getComputedStyle(el).display,
                  visibility: window.getComputedStyle(el).visibility,
                  opacity: window.getComputedStyle(el).opacity
                };
              }, allLinks[i]);
              console.log(`  Link ${i + 1}:`, linkInfo);
            }
            
            // Try to find a clickable link (prefer visible ones, but fallback to any)
            let element = null;
            let linkIndex = 0;
            
            // First try: find a visible link
            for (let i = 0; i < allLinks.length; i++) {
              const isVisible = await existingPage.evaluate((el) => {
                return el.offsetParent !== null && 
                       window.getComputedStyle(el).display !== 'none' &&
                       window.getComputedStyle(el).visibility !== 'hidden' &&
                       parseFloat(window.getComputedStyle(el).opacity) > 0;
              }, allLinks[i]);
              
              if (isVisible) {
                element = allLinks[i];
                linkIndex = i;
                console.log(`✅ Found visible link at index ${i}`);
                break;
              }
            }
            
            // Fallback: use first link if no visible ones found
            if (!element && allLinks.length > 0) {
              element = allLinks[0];
              linkIndex = 0;
              console.log(`⚠️ No visible links found, using first link at index 0`);
            }
            
            if (!element) {
              throw new Error('No clickable links found in header');
            }
            
            // DEBUG: Log which specific element we're clicking
            const clickedElementInfo = await existingPage.evaluate((el) => {
              return {
                tagName: el.tagName,
                text: el.textContent?.trim().substring(0, 100) || 'no-text',
                href: el.href || 'no-href',
                id: el.id || 'no-id',
                className: el.className || 'no-class',
                outerHTML: el.outerHTML.substring(0, 200) + '...',
                visible: el.offsetParent !== null,
                display: window.getComputedStyle(el).display,
                visibility: window.getComputedStyle(el).visibility,
                opacity: window.getComputedStyle(el).opacity
              };
            }, element);
            
            console.log(`🎯 CLICKING LINK ${linkIndex + 1}:`);
            console.log('  📝 Tag:', clickedElementInfo.tagName);
            console.log('  📝 Text:', clickedElementInfo.text);
            console.log('  📝 Href:', clickedElementInfo.href);
            console.log('  📝 ID:', clickedElementInfo.id);
            console.log('  📝 Class:', clickedElementInfo.className);
            console.log('  📝 Visible:', clickedElementInfo.visible);
            console.log('  📝 Display:', clickedElementInfo.display);
            console.log('  📝 Visibility:', clickedElementInfo.visibility);
            console.log('  📝 Opacity:', clickedElementInfo.opacity);
            console.log('  📝 HTML:', clickedElementInfo.outerHTML);
            
            // CRITICAL: Set up navigation monitoring BEFORE clicking
            console.log('🔄 Setting up navigation monitoring...');
            let navigationCompleted = false;
            let capturedEventsDuringNavigation = [];
            
            // Monitor for navigation
            const navigationPromise = existingPage.waitForNavigation({ 
              waitUntil: 'networkidle2', 
              timeout: 10000 
            }).then(() => {
              navigationCompleted = true;
              console.log('🌐 Navigation completed');
            }).catch(() => {
              console.log('⚠️ Navigation timeout or no navigation occurred');
            });
            
            // Set up beforeunload listener to capture events during navigation
            await existingPage.evaluate(() => {
              window.addEventListener('beforeunload', () => {
                console.log('🔄 Page unloading, capturing final dataLayer...');
                if (window.dataLayer) {
                  window._finalDataLayer = [...window.dataLayer];
                  console.log('📊 Final dataLayer captured:', window._finalDataLayer.length, 'events');
                }
              });
            });
            
            // Click the element with force if needed
            try {
            await element.click();
              console.log(`✅ Click successful`);
            } catch (error) {
              console.log(`⚠️ Normal click failed, trying force click:`, error.message);
              await element.click({ force: true });
              console.log(`✅ Force click successful`);
            }
            
            // Wait for navigation or timeout
            try {
              await navigationPromise;
            } catch (error) {
              console.log('⚠️ Navigation monitoring completed');
            }
            
            // Check for events captured during navigation
            const finalDataLayer = await existingPage.evaluate(() => {
              return window._finalDataLayer || window.dataLayer || [];
            });
            
            console.log(`📊 Final dataLayer after click: ${finalDataLayer.length} events`);
            
            // Wait additional time for any delayed events
            console.log('⏱️ Waiting for additional events...');
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            // Check current dataLayer again after waiting
            const currentDataLayer = await existingPage.evaluate(() => window.dataLayer || []);
            console.log(`📊 Current dataLayer after waiting: ${currentDataLayer.length} events`);
            const currentEvents = currentDataLayer.map(e => e?.event).filter(Boolean);
            console.log(`📊 Current events:`, currentEvents);
            
            // Check if header_menu_click is in current dataLayer
            const hasHeaderEvent = currentDataLayer.some(event => event?.event === 'header_menu_click');
            if (hasHeaderEvent) {
              console.log('🎉 FOUND header_menu_click in current dataLayer!');
              const headerEvent = currentDataLayer.find(event => event?.event === 'header_menu_click');
              console.log('📋 Header event details:', JSON.stringify(headerEvent, null, 2));
              
              // SAVE EVENT DETAILS TO STEP RESULT
              stepResult.eventDetails = {
                event: headerEvent?.event,
                link_text: headerEvent?.link_text,
                link_url: headerEvent?.link_url,
                index: headerEvent?.index,
                clickedElement: clickedElementInfo
              };
            } else {
              console.log('❌ header_menu_click NOT found in current dataLayer');
            }
            
            // Check expectations using current dataLayer (after waiting)
            if (step.expect && step.expect.length > 0) {
          for (const expectation of step.expect) {
                if (expectation.type === 'dataLayer' && expectation.event) {
                  // Use the current dataLayer after waiting for delayed events
                  const hasEvent = currentDataLayer.some(event => event?.event === expectation.event);
                  
                  if (hasEvent) {
                    console.log(`✅ Found expected event: ${expectation.event}`);
                    stepResult.status = 'PASS';
              } else {
                    const availableEvents = currentDataLayer.map(e => e?.event).filter(Boolean);
                    stepResult.error = `Expected event '${expectation.event}' not found. Available: [${availableEvents.join(', ')}]`;
                    console.log(`❌ ${stepResult.error}`);
                    console.log(`📊 Current dataLayer events:`, availableEvents);
                  }
                }
              }
              } else {
              stepResult.status = 'PASS';
            }
          }
        } catch (error: any) {
          stepResult.error = error.message;
          console.error(`❌ Step ${i + 1} failed:`, error.message);
        }
        
        stepResults.push(stepResult);
        console.log(`===== STEP ${i + 1} RESULT: ${stepResult.status} =====`);
      }
      
      const failedSteps = stepResults.filter(s => s.status === 'FAIL');
      const overallStatus = failedSteps.length === 0 ? 'PASS' : 'FAIL';
      
      console.log('✅ PDF tests completed with direct execution');
      console.log('📊 Results:', {
        steps: stepResults.length,
        passed: stepResults.length - failedSteps.length,
        failed: failedSteps.length,
        duration: Date.now() - startTime
      });
      
      return {
        status: overallStatus,
        steps: stepResults,
        error: failedSteps.length > 0 ? `${failedSteps.length} steps failed` : null,
        duration: Date.now() - startTime
      };
    } else {
      // Fallback to runner for new pages
      const runResult = await runner.runTests(testSpecForRunner, options);
      
      console.log('✅ PDF tests completed with universal runner');
      console.log('📊 Results:', {
        steps: runResult.summary.steps,
        passed: runResult.summary.passed,
        failed: runResult.summary.failed,
        duration: runResult.summary.duration
      });
      
      return {
        status: runResult.summary.failed === 0 ? 'PASS' : 'FAIL',
        steps: runResult.results.map((result, index) => ({
          step: index + 1,
          description: result.description || 'No description',
          action: 'click',
          status: result.status,
          error: result.reasons?.join(', ') || null
        })),
        error: runResult.summary.failed > 0 ? `${runResult.summary.failed} steps failed` : null,
        duration: Date.now() - startTime
      };
    }
    
  } catch (error: any) {
    console.error('❌ Error in PDF tests execution:', error);
    return {
      status: 'FAIL',
      steps: [],
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime
    };
  }
}

/**
 * Esegue il flusso unificato: cookie consent + PDF tests in un unico browser
 */
async function executeUnifiedTestFlow(siteUrl: string, pdfContent: string, options: any) {
  console.log('===== EXECUTE UNIFIED TEST FLOW DEBUG =====');
  console.log('siteUrl:', siteUrl);
  console.log('pdfContent:', pdfContent);
  console.log('pdfContent length:', pdfContent?.length);
  console.log('pdfContent type:', typeof pdfContent);
  console.log('==========================================');
  
  const result = {
    status: 'FAIL',
    consentStatus: 'unknown',
    dataLayerEvents: [],
    steps: [],
    error: null,
    browserInstance: null,
    page: null,
    pdfTests: null,
    pdfTestSpec: null,
    cookieBtnSelector: null,
    cookieBtnOuterHTML: null
  };

  let browser: any | null = null;
  let page: any | null = null;

  try {
    console.log('🚀 Starting unified test flow...');
    
    // Launch browser
    browser = await puppeteer.launch({
      headless: options.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });
    
    page = await browser.newPage();
    console.log('✓ Browser launched and page created');
    
    // STEP 1: Navigate and wait for cookie banner
    console.log('===== STEP 1: NAVIGATING TO SITE =====');
    await page.goto(siteUrl, { waitUntil: 'networkidle2' });
    await new Promise(resolve => setTimeout(resolve, 10000));
    console.log('✓ Site loaded and cookie banner should be visible');
    
    // STEP 2: Extract cookie banner and generate test spec
    console.log('===== STEP 2: EXTRACTING COOKIE BANNER =====');
    const cookieBanner = await extractCookieBannerWithPuppeteer(page);
    const cookieTestSpec = await generateCookieConsentTestSpec(siteUrl, cookieBanner);
    console.log('✓ Cookie banner extracted and test spec generated');
    
    // STEP 3: Execute cookie consent test
    console.log('===== STEP 3: EXECUTING COOKIE CONSENT TEST =====');
    const cookieTestResult = await executeCookieConsentTest(cookieTestSpec, page);
    console.log(`✓ Cookie consent test completed: ${cookieTestResult.status}`);
    
    // Update result with cookie test results
    result.status = cookieTestResult.status;
    result.consentStatus = cookieTestResult.consentStatus;
    result.dataLayerEvents = cookieTestResult.dataLayerEvents;
    result.steps = cookieTestResult.steps;
    result.error = cookieTestResult.error;
    result.cookieBtnSelector = cookieTestResult.cookieBtnSelector;
    result.cookieBtnOuterHTML = cookieTestResult.cookieBtnOuterHTML;
    result.browserInstance = browser;
    result.page = page;
    
    // If cookie consent failed, return early
    if (cookieTestResult.status !== 'PASS') {
      console.log('❌ Cookie consent test failed, stopping unified flow');
      return result;
    }
    
    // STEP 4: Generate PDF test specification
    console.log('===== STEP 4: GENERATING PDF TEST SPECIFICATION =====');
    const pdfTestSpec = await generatePdfTestSpec(siteUrl, pdfContent, undefined, undefined);
    result.pdfTestSpec = pdfTestSpec;
    
    if (pdfTestSpec) {
      console.log('✓ PDF test specification generated');
    } else {
      console.log('⚠️ PDF test specification skipped (empty content)');
    }
    
    // STEP 5: Execute PDF tests in the same browser session
    console.log('===== STEP 5: EXECUTING PDF TESTS =====');
    
    let pdfTestResult: any = null;
    if (pdfTestSpec) {
      pdfTestResult = await executePdfTests(pdfTestSpec, options, browser, page);
      console.log('✓ PDF tests executed');
    } else {
      console.log('⚠️ PDF tests skipped (no specification)');
      pdfTestResult = {
        status: 'SKIPPED',
        steps: [],
        error: 'PDF content was empty'
      };
    }
    
    result.pdfTests = pdfTestResult;
    console.log('✓ PDF tests completed');
    
    console.log('🎉 Unified test flow completed successfully!');
    return result;
    
  } catch (error: any) {
        (result as any).error = (error as Error).message;
    console.error('Error in unified test flow:', error);
    
    // Close browser on error
    if (browser) {
      await browser.close();
    }
    
    return result;
  }
}

/**
 * Esegue il test di consenso cookie con gestione browser
 */
async function executeCookieConsentTestWithBrowser(siteUrl: string, options: any) {
  const result = {
    status: 'FAIL',
    consentStatus: 'not_detected',
    dataLayerEvents: [],
    steps: [],
    error: null,
    browserInstance: null,
    page: null,
    cookieBtnSelector: null,
    cookieBtnOuterHTML: null
  };

  let browser: any | null = null;
  let page: any | null = null;

  try {
    console.log('Executing cookie consent test with browser management...');
    
    // Initialize browser
    browser = await puppeteer.launch({
      headless: options.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });
    
    page = await browser.newPage();
    
    // Navigate to the site first
    await page.goto(siteUrl, { waitUntil: 'networkidle2' });
    
    // Wait for cookie banner to load
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Generate cookie consent test specification
    const cookieBanner = await extractCookieBannerWithPuppeteer(page);
    const testSpec = await generateCookieConsentTestSpec(siteUrl, cookieBanner);
    
    // Execute cookie consent test
    const cookieTestResult = await executeCookieConsentTest(testSpec, page);
    
    // Update result with cookie test results
    result.status = cookieTestResult.status;
    result.consentStatus = cookieTestResult.consentStatus;
    result.dataLayerEvents = cookieTestResult.dataLayerEvents;
    result.steps = cookieTestResult.steps;
    result.error = cookieTestResult.error;
    result.cookieBtnSelector = cookieTestResult.cookieBtnSelector;
    result.cookieBtnOuterHTML = cookieTestResult.cookieBtnOuterHTML;
    result.browserInstance = browser;
    result.page = page;

  } catch (error: any) {
        (result as any).error = (error as Error).message;
    console.error('Error in cookie consent test with browser:', error);
    
    // Close browser on error
    if (browser) {
      await browser.close();
    }
  }

  return result;
}

/**
 * Esegue il test di cookie consent e controlla il dataLayer
 */
async function executeCookieConsentTest(testSpec: any, page: any) {
  const result = {
    status: 'FAIL',
    dataLayerEvents: [],
    consentStatus: 'unknown',
    steps: [],
    error: null,
    cookieBtnSelector: null,
    cookieBtnOuterHTML: null
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
        return window.originalDataLayerPush.apply(this, args);
      };
    });

    // Esegui ogni step del test
    for (let i = 0; i < testSpec.tests[0].steps.length; i++) {
      const step = testSpec.tests[0].steps[i];
      console.log(`Executing step ${i + 1}: ${step.description}`);
      
      const stepResult: TestStep = {
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

          // Capture cookie button selector and outerHTML for diagnosis
          result.cookieBtnSelector = selector;
          console.log(`Cookie button selector: ${selector}`);
          
          // Get outerHTML of the button if element is found
          if (element) {
            try {
              (result as any).cookieBtnOuterHTML = await page.$eval(selector, el => el.outerHTML);
              console.log(`Cookie button outerHTML captured: ${(result as any).cookieBtnOuterHTML?.substring(0, 200)}...`);
            } catch (outerHTMLError) {
              console.log(`Warning: Could not capture outerHTML: ${(outerHTMLError as Error).message}`);
              (result as any).cookieBtnOuterHTML = 'Error capturing outerHTML';
            }
          } else {
            console.log('Warning: No element found, cannot capture outerHTML');
            (result as any).cookieBtnOuterHTML = 'Element not found';
          }
          
          try {
            let clickSuccessful = false;
            
            // Se abbiamo già l'elemento da waitForSelector, usalo direttamente
            if (element) {
              console.log('Using element found by waitForSelector');
              await (element as any).click();
              console.log(`✓ Click successful on ${selector}`);
              
              // Wait 15 seconds after click for dataLayer events to be processed
              console.log('Waiting 15 seconds for dataLayer events to be processed...');
              await new Promise(resolve => setTimeout(resolve, 15000));
              
              stepResult.status = 'PASS';
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
                await (element as any).click();
                console.log(`✓ Click successful on ${selector}`);
                
                // Wait 15 seconds after click for dataLayer events to be processed
                console.log('Waiting 15 seconds for dataLayer events to be processed...');
                await new Promise(resolve => setTimeout(resolve, 15000));
                
                stepResult.status = 'PASS';
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
        
        (result.steps as any[]).push(stepResult);
        
      } catch (stepError) {
        stepResult.error = (stepError as Error).message;
        stepResult.status = 'FAIL';
        (result.steps as any[]).push(stepResult);
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
        consentEvents: dataLayerAfter.filter((event: any) => 
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

  } catch (error: any) {
        (result as any).error = (error as Error).message;
    console.error('Error executing cookie consent test:', error);
  }

  return result;
}

/**
 * Genera Test Specification per testare la CTA di accettazione cookie
 */
async function generateCookieConsentTestSpec(siteUrl: string, cookieBanner: any) {
  if (!config.openaiApiKey) {
    throw new ConfigurationError('OpenAI API key not configured', 'OPENAI_NOT_CONFIGURED');
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
      if (response.status === 429) {
        throw new OpenAIError(`OpenAI API rate limit exceeded`, 'RATE_LIMIT');
      }
      if (response.status === 401) {
        throw new OpenAIError(`OpenAI API key invalid`, 'INVALID_API_KEY');
      }
      throw new OpenAIError(`OpenAI API error: ${response.status}`, 'API_ERROR');
    }

    const data = await response.json() as any;
    const content = data.choices[0].message.content;
    
    console.log('===== OPENAI COOKIE CONSENT TEST RESPONSE =====');
    console.log('Raw OpenAI response:', content);
    console.log('===============================================');
    
    // Clean the response - remove markdown code blocks if present
    let jsonContent = content.trim();
    if (jsonContent.startsWith('```json')) {
      jsonContent = jsonContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (jsonContent.startsWith('```')) {
      jsonContent = jsonContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    // Remove JavaScript-style comments (// comments) but preserve URLs
    // This regex matches // comments but not URLs like https://
    jsonContent = jsonContent.replace(/(?<!https?:)\/\/.*$/gm, '');
    
    // Clean up any trailing commas that might be left after comment removal
    jsonContent = jsonContent.replace(/,(\s*[}\]])/g, '$1');
    
    console.log('===== CLEANED JSON CONTENT =====');
    console.log('Cleaned JSON:', jsonContent);
    console.log('================================');
    
    // Parse the JSON response
    const testSpec = JSON.parse(jsonContent);
    
    console.log('===== PARSED COOKIE CONSENT TEST SPEC =====');
    console.log('Parsed TestSpec:', JSON.stringify(testSpec, null, 2));
    console.log('==========================================');
    
    return testSpec;
  } catch (error: any) {
    console.error('Error calling OpenAI for cookie consent test:', error);
    if (error instanceof OpenAIError) {
      throw error;
    }
    throw new OpenAIError(`Failed to generate cookie consent test spec: ${error.message}`, 'COOKIE_SPEC_GENERATION_FAILED');
  }
}

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
    const httpError = toHttpError(err instanceof Error ? err : new Error(err.message || 'Unknown error'));
    return res.status(httpError.httpStatus).json({ error: { code: httpError.code, message: httpError.message, details: httpError.details } });
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
      return sendError(res, 400, 'MISSING_FILE_FIELD', "Missing 'pdf' file field in multipart/form-data.");
    }

    if (!url) {
      return sendError(res, 400, 'MISSING_URL', 'URL is required');
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
      return sendError(res, 400, 'INVALID_URL', 'Target Website URL non valida. Includi http/https (es. https://example.com).');
    }

    if (!config.openaiApiKey) {
      return sendError(res, 500, 'OPENAI_NOT_CONFIGURED', 'OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.');
    }

    // Magic number validation - check PDF signature
    if (!isPdfBuffer(pdf.buffer)) {
      console.log(`[${correlationId}] PDF magic number check failed:`, {
        firstBytes: pdf.buffer.subarray(0, 16).toString('hex'),
        firstChars: pdf.buffer.subarray(0, 8).toString('ascii')
      });
      const httpError = toHttpError(new FileUploadError('Uploaded file is not a valid PDF (missing %PDF- header).', 'INVALID_PDF_SIGNATURE'));
      return res.status(httpError.httpStatus).json({ error: { code: httpError.code, message: httpError.message, details: httpError.details } });
    }

    // File size validation
    if (pdf.size > MAX_UPLOAD_BYTES) {
      const httpError = toHttpError(new FileUploadError(`PDF exceeds maximum size of ${MAX_UPLOAD_MB} MB.`, 'FILE_TOO_LARGE'));
      return res.status(httpError.httpStatus).json({ error: { code: httpError.code, message: httpError.message, details: httpError.details } });
    }

    console.log(`[${correlationId}] PDF validation passed - magic number: true, size: ${pdf.size} bytes`);

    // Extract text from PDF using buffer directly
    const extractionResult = await extractPDFTextFromBuffer(pdf.buffer);
    
    if (extractionResult.warnings.length > 0) {
      console.log(`[${correlationId}] PDF extraction warnings:`, extractionResult.warnings);
    }

    // Check if PDF has no extractable text
    if (extractionResult.text.length === 0) {
      return sendError(res, 400, 'PDF_EMPTY', 'PDF has no extractable text. Please export the PPT as a text-based PDF (selectable text), not a scanned image.');
    }

    console.log(`[${correlationId}] PDF text extracted successfully: ${extractionResult.text.length} characters`);

    // Convert PDF text to TestSpec using OpenAI with timeout
    if (!openaiService) {
      return sendError(res, 503, 'SERVICE_UNAVAILABLE', 'OpenAI service is not configured. Please set VITE_OPENAI_API_KEY environment variable.');
    }
    
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
    const dslFromLLM = (openaiResponse as any).dsl ?? {};
    
    // 3) forzatura/merge: il site del DSL è sempre l'origin scelto dall'utente
    const mergedDsl = { ...dslFromLLM, site: targetOrigin };
    
    // 4) LOG mirato: cosa stiamo per validare?
    console.info("[SSD] validating DSL with site:", mergedDsl?.site);
    
    // 5) valida con lo schema che normalizza internamente
    const validatedDSL = validateTestSpec(mergedDsl);
    
    // 6) usa **sempre** 'validatedDSL' per tutto il resto (salvataggio, run, response)
    //    Evita di riusare 'dslFromLLM' o altre copie altrove.

    // Save PDF buffer to temporary file for later use
    const tempDir = join(process.cwd(), 'temp-pdf');
    await fs.mkdir(tempDir, { recursive: true });
    const pdfBufferPath = join(tempDir, `pdf_${correlationId}.pdf`);
    fsSync.writeFileSync(pdfBufferPath, pdf.buffer);
    console.log(`[${correlationId}] PDF buffer saved to: ${pdfBufferPath}`);

    // Prepare response with validated DSL as-is (no post-processing)
    const response = {
      dsl: validatedDSL,
      pdfContent: extractionResult.text,
      pdfBufferPath: pdfBufferPath, // Add path to saved PDF buffer
      meta: {
        model: (openaiResponse as any).meta.model,
        tokens: (openaiResponse as any).meta.tokens,
      }
    };

    console.log(`[${correlationId}] Spec generation completed successfully`);

    res.json(response);

  } catch (error: any) {
    console.error(`[${correlationId}] Spec Generation Error:`, error);
    
    const httpError = toHttpError(error instanceof Error ? error : new Error('Unknown error'));
    return res.status(httpError.httpStatus).json({ error: { code: httpError.code, message: httpError.message, details: httpError.details } });
  }
});

// POST /api/ssd/run - Execute SSD tests following the new order
app.post('/api/ssd/run', async (req, res) => {
  try {
    console.log('🚀 API /api/ssd/run CALLED!');
    console.log('📦 req.body keys:', Object.keys(req.body || {}));
    console.log('📄 pdfContent exists:', !!req.body?.pdfContent);
    console.log('📄 pdfContent length:', req.body?.pdfContent?.length || 0);
    console.log('📦 req.body full:', JSON.stringify(req.body, null, 2));
    
    const { dsl, runOptions = {}, pdfContent, pdfBufferPath } = req.body;

    if (!dsl) {
      const httpError = toHttpError(new ValidationError('DSL is required', 'MISSING_DSL'));
      return res.status(httpError.httpStatus).json({ error: { code: httpError.code, message: httpError.message, details: httpError.details } });
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

    // ============================================================================
    // STEP 1: Prepara requestId
    // ============================================================================
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log(`[${requestId}] Starting SSD test execution`);

    // ============================================================================
    // STEP 2: Avvia runner → fai goto e genera snapshot HTML (P0). Ottieni htmlPath
    // ============================================================================
    console.log('===== STEP 2: LAUNCHING RUNNER AND GENERATING HTML SNAPSHOT =====');
    
    let htmlPath: string | null = null;
    let browser: any = null;
    let page: any = null;

    try {
      // Launch browser
      browser = await puppeteer.launch({
        headless: options.headless,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      });
      
      page = await browser.newPage();
      console.log('✓ Browser launched and page created');
      
      // Navigate to the site and generate HTML snapshot
      await page!.goto(validatedDSL.site, { waitUntil: 'networkidle2' });
      await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for dynamic content
      
      // Generate HTML snapshot
      const html = await page!.content();
      
      // Save HTML to file
      const tempHtmlDir = join(process.cwd(), 'temp-html');
      await fs.mkdir(tempHtmlDir, { recursive: true });
      htmlPath = join(tempHtmlDir, `${requestId}.html`);
      await fs.writeFile(htmlPath!, html, 'utf8');
      
      console.log(`✓ HTML snapshot generated and saved to: ${htmlPath}`);
      
    } catch (error: any) {
      console.error('Error generating HTML snapshot:', error);
      throw new Error(`Failed to generate HTML snapshot: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // ============================================================================
    // STEP 3: (Cookie) Esegui il test cookie ESATTAMENTE come oggi. 
    // NON cambiarne logica, attese, matcher.
    // Il runner ora riporterà anche cookieBtnSelector e cookieBtnOuterHTML (P1)
    // ============================================================================
    console.log('===== STEP 3: EXECUTING COOKIE CONSENT TEST =====');
    
    // Create cookie consent test DSL
    const cookieConsentDSL = {
      site: validatedDSL.site,
      allowed_hosts: validatedDSL.allowed_hosts,
      consent: ['accept'],
      tests: [{
        section: 'Cookie Consent Acceptance',
        steps: [
          {
            description: 'Navigate to the website',
            action: 'navigate',
            target: {
              kind: 'href',
              value: validatedDSL.site
            },
            expect: [{
              type: 'navigation',
              url_contains: validatedDSL.site.replace('https://', '').replace('http://', '')
            }]
          },
          {
            description: 'Click Accept All Cookies button',
            action: 'click',
            target: {
              kind: 'selector',
              value: '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll'
            },
            expect: [{
              type: 'dataLayer',
              event: 'consent_update'
            }]
          }
        ]
      }]
    };
    
    // Execute cookie consent test using existing logic
    const cookieConsentResult = await executeCookieConsentTestFromDSL(cookieConsentDSL, options);
    
    // Add cookieBtnSelector and cookieBtnOuterHTML to result (P1)
    const cookieResult = {
      ...cookieConsentResult,
      cookieBtnSelector: cookieConsentResult.cookieBtnSelector,
      cookieBtnOuterHTML: cookieConsentResult.cookieBtnOuterHTML
    };

    console.log(`✓ Cookie consent test completed: ${cookieResult.status}`);
    console.log(`✓ Cookie button selector: ${cookieResult.cookieBtnSelector}`);
    console.log(`✓ Cookie button outerHTML: ${cookieResult.cookieBtnOuterHTML?.substring(0, 100)}...`);

    // ============================================================================
    // STEP 4: (PDF) Processing PDF Tests
    // - Use pdfContent from req.body directly (already extracted text)
    // - Handle empty PDF content with proper logging and status
    // - Generate PDF spec using LLM with JSON validation
    // - Save pdfText to disk for diagnosis purposes
    // ============================================================================
    console.log('===== STEP 4: PROCESSING PDF TESTS =====');
    
    let pdfResult: any = null;
    let pdfSpec: any = null;
    let pdfTextFile: string | null = null;

    // Use pdfContent from req.body directly (already extracted text)
    const pdfText = typeof req.body.pdfContent === 'string' ? req.body.pdfContent.trim() : '';
    
    if (!pdfText) {
      console.log('PDF content empty → skipping PDF spec');
      pdfResult = {
        status: 'skipped',
        reason: 'PDF_EMPTY'
      };
    } else {
      try {
        // Ensure temp-pdf directory exists
        const tempPdfDir = join(process.cwd(), 'temp-pdf');
        await fs.mkdir(tempPdfDir, { recursive: true });
        
        // Save pdfText to disk for diagnosis
        pdfTextFile = join(tempPdfDir, `txt_${requestId}.txt`);
        await fs.writeFile(pdfTextFile!, pdfText, 'utf8');
        console.log(`✓ PDF text saved for diagnosis: ${pdfTextFile}`);
        
        // Generate PDF spec using LLM
        console.log('🤖 Generating PDF spec using LLM...');
        pdfSpec = await llmPdfSpec({
          url: validatedDSL.site,
          pdfText: pdfText,
          htmlPath: htmlPath || undefined
        });
        
        console.log('✓ PDF spec generated successfully');
        
        // Normalize PDF spec to runner format
        let normalizedPdfSpec;
        try {
          normalizedPdfSpec = normalizePdfSpec(pdfSpec);
          console.log('🔧 Normalized PDF spec (runner shape):', JSON.stringify(normalizedPdfSpec, null, 2));
        } catch (error: any) {
          console.error('❌ Error normalizing PDF spec:', (error as Error).message);
          pdfResult = {
            status: 'error',
            code: 'INVALID_PDF_SPEC',
            message: error.message
          };
          return;
        }
        
        // Execute PDF spec with runner using the same page from cookie test
        console.log('🚀 Executing PDF spec with runner...');
        const pdfTestResult = await executePdfTests(normalizedPdfSpec, options, cookieConsentResult.browserInstance, cookieConsentResult.page);
        
        pdfResult = {
          status: pdfTestResult.status,
          spec: pdfSpec,
          result: pdfTestResult,
          steps: pdfTestResult.steps || []
        };
        
        console.log(`✓ PDF tests executed: ${pdfTestResult.status}`);
        
      } catch (error: any) {
        console.error('Error processing PDF:', error);
        
        // Check if it's a JSON parsing error
        if (error instanceof Error && error.message.includes('JSON')) {
          pdfResult = {
            status: 'error',
            code: 'INVALID_JSON',
            message: 'Lo spec generato non è JSON valido'
          };
        } else {
          pdfResult = {
            status: 'error',
            code: 'PDF_PROCESSING_ERROR',
            message: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      }
    }

    // ============================================================================
    // STEP 5: Rispondi con un JSON finale che contenga:
    // {
    //   requestId, url,
    //   artifacts: { htmlFile: htmlPath, pdfTextFile: <se salvato> },
    //   cookie: { ...result del runner + selector + outerHTML },
    //   pdf: { spec: pdfSpec, result: <esito o skipped> }
    // }
    // ============================================================================
    console.log('===== STEP 5: PREPARING FINAL RESPONSE =====');

    // Clean up browser
    if (browser) {
      await (browser as any).close();
      console.log('✓ Browser closed');
    }

    // Clean up temporary PDF file
    if (pdfBufferPath && fsSync.existsSync(pdfBufferPath)) {
      try {
        fsSync.unlinkSync(pdfBufferPath);
        console.log('✅ Temporary PDF file cleaned up');
      } catch (cleanupError) {
        console.log('⚠️ Error cleaning up temporary PDF file:', cleanupError.message);
      }
    }

    // Prepare final response
    const finalResponse = {
      requestId,
      url: validatedDSL.site,
      artifacts: {
        htmlFile: htmlPath,
        pdfTextFile: pdfTextFile
      },
      cookie: {
        status: cookieResult.status,
        consentStatus: cookieResult.consentStatus,
        dataLayerEvents: cookieResult.dataLayerEvents || [],
        steps: cookieResult.steps || [],
        error: cookieResult.error,
        duration: cookieResult.duration || 0,
        cookieBtnSelector: cookieResult.cookieBtnSelector,
        cookieBtnOuterHTML: cookieResult.cookieBtnOuterHTML
      },
      pdf: pdfResult
    };

    console.log('===== SSD TEST EXECUTION COMPLETED =====');
    console.log(`Request ID: ${requestId}`);
    console.log(`URL: ${validatedDSL.site}`);
    console.log(`Cookie Test Status: ${cookieResult.status}`);
    console.log(`PDF Test Status: ${(pdfResult as any)?.status || 'N/A'}`);
    console.log(`HTML File: ${htmlPath}`);
    console.log(`PDF Text File: ${pdfTextFile}`);
    console.log('========================================');

    // Debug: mostra la struttura della risposta finale
    console.log('🔍 FINAL RESPONSE STRUCTURE:');
    console.log('  📦 finalResponse keys:', Object.keys(finalResponse));
    console.log('  📋 finalResponse.report exists:', !!finalResponse.report);
    console.log('  📋 finalResponse.pdf exists:', !!finalResponse.pdf);
    console.log('  📋 finalResponse.cookie exists:', !!finalResponse.cookie);
    console.log('  📋 finalResponse.artifacts exists:', !!finalResponse.artifacts);
    console.log('  📊 finalResponse.report keys:', finalResponse.report ? Object.keys(finalResponse.report) : 'N/A');
    console.log('  📊 finalResponse.pdf keys:', finalResponse.pdf ? Object.keys(finalResponse.pdf) : 'N/A');
    console.log('  📊 finalResponse.cookie keys:', finalResponse.cookie ? Object.keys(finalResponse.cookie) : 'N/A');

    res.json(finalResponse);

  } catch (error: any) {
    console.error('SSD Run Error:', error);
    
    const httpError = toHttpError(error instanceof Error ? error : new Error('Unknown error'));
    return res.status(httpError.httpStatus).json({ error: { code: httpError.code, message: httpError.message, details: httpError.details } });
  }
});

// GET /api/ssd/fetch-html - Download HTML and extract cookie banner
app.get('/api/ssd/fetch-html', async (req, res) => {
  const correlationId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    const { url } = req.query;

    // Validazione URL
    if (!url || typeof url !== 'string') {
      const httpError = toHttpError(new ValidationError('URL parameter is required', 'MISSING_URL'));
      return res.status(httpError.httpStatus).json({ error: { code: httpError.code, message: httpError.message, details: httpError.details } });
    }

    // Normalizza URL
    let targetUrl: string;
    try {
      targetUrl = normalizeOrigin(url);
    } catch (urlError) {
      const httpError = toHttpError(new ValidationError('Invalid URL format', 'INVALID_URL'));
      return res.status(httpError.httpStatus).json({ error: { code: httpError.code, message: httpError.message, details: httpError.details } });
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

      // Aspetta 10 secondi per assicurarsi che i cookie banner si carichino completamente
      await new Promise(resolve => setTimeout(resolve, 10000));

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
            console.log(`[${correlationId}]   Position: ${(button as any).position}`);
          });
        } else {
          console.log(`[${correlationId}] No buttons found in cookie banner`);
        }
        console.log(`[${correlationId}] ================================`);
        
        // Genera Test Specification per la CTA di accettazione cookie (NON ESEGUIRE ANCORA)
        console.log(`[${correlationId}] ===== GENERATING COOKIE CONSENT TEST SPEC =====`);
        try {
          const cookieTestSpec = await generateCookieConsentTestSpec(targetUrl, cookieBanner);
          console.log(`[${correlationId}] Generated Cookie Consent Test Specification:`);
          console.log(`[${correlationId}] Site: ${cookieTestSpec.site}`);
          console.log(`[${correlationId}] Test Section: ${cookieTestSpec.tests[0].section}`);
          console.log(`[${correlationId}] Steps: ${cookieTestSpec.tests[0].steps.length}`);
          console.log(`[${correlationId}] Full Test Spec:`);
          console.log(JSON.stringify(cookieTestSpec, null, 2));
          console.log(`[${correlationId}] ==========================================`);
          
          // AGGIUNGI IL TEST SPEC AL RISULTATO (NON ESEGUIRE ANCORA)
          (cookieBanner as any).testSpec = cookieTestSpec;
          console.log(`[${correlationId}] ✅ Cookie consent test spec generated and saved (NOT executed yet)`);
        } catch (error: any) {
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

  } catch (error: any) {
    console.error(`[${correlationId}] Error fetching HTML and extracting cookie banner:`, error);
    
    const httpError = toHttpError(error instanceof Error ? error : new Error('Unknown error'));
    return res.status(httpError.httpStatus).json({ error: { code: httpError.code, message: httpError.message, details: httpError.details } });
  }
});

// GET /api/ssd/artifact - Serve artifacts (HTML files, PDF text, screenshots)
app.get('/api/ssd/artifact', async (req, res) => {
  try {
    const { file, folder } = req.query;
    
    if (!file && !folder) {
      return res.status(400).json({ error: 'Missing file or folder parameter' });
    }
    
    let filePath = '';
    
    if (file) {
      filePath = decodeURIComponent(file as string);
    } else if (folder) {
      // For folders, list contents or serve index
      const folderPath = decodeURIComponent(folder as string);
      const files = await fs.readdir(folderPath);
      return res.json({ 
        folder: folderPath, 
        files: files.filter(f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg'))
      });
    }
    
    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Get file stats
    const stats = await fs.stat(filePath);
    
    // Set appropriate headers
    if (filePath.endsWith('.html')) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
    } else if (filePath.endsWith('.txt')) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    } else if (filePath.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/png');
    } else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
      res.setHeader('Content-Type', 'image/jpeg');
    }
    
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Cache-Control', 'no-cache');
    
    // Stream the file
    const fileStream = fsSync.createReadStream(filePath);
    fileStream.pipe(res);
    
  } catch (error: any) {
    console.error('Error serving artifact:', error);
    res.status(500).json({ error: 'Failed to serve artifact' });
  }
});

// GET /api/ssd/config - Get configuration info
app.get('/api/ssd/config', (req, res) => {
  res.json({
    success: true,
    config: {
      maxFileSize: config.maxFileSize,
      maxFileSizeMB: Math.round(config.maxFileSize / 1024 / 1024),
      allowedMimeTypes: ['application/pdf', 'application/octet-stream'],
      allowedExtensions: ['.pdf'],
      supportedFormats: ['PDF with selectable text'],
      ambiguityMinConfidence: 0.6
    },
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

// POST /api/consent/audit-pw - Consent Test B con Playwright
app.post('/api/consent/audit-pw', async (req, res) => {
  const correlationId = `consent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    console.log(`[${correlationId}] Starting Consent Test B with Playwright`);
    
    // Validazione input
    const validationResult = ConsentTestInputSchema.safeParse(req.body);
    if (!validationResult.success) {
      console.log(`[${correlationId}] Validation failed:`, validationResult.error);
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Input validation failed',
          details: validationResult.error.errors
        }
      });
    }

    const input = validationResult.data;
    console.log(`[${correlationId}] Validated input:`, { url: input.url, options: input.options });

    // Anti-SSRF check in produzione
    if (process.env.NODE_ENV === 'production') {
      const url = new URL(input.url);
      const hostname = url.hostname;
      
      // Blocca IP privati e localhost in produzione
      if (hostname === 'localhost' || 
          hostname === '127.0.0.1' || 
          hostname.startsWith('192.168.') ||
          hostname.startsWith('10.') ||
          hostname.startsWith('172.16.') ||
          hostname.startsWith('172.17.') ||
          hostname.startsWith('172.18.') ||
          hostname.startsWith('172.19.') ||
          hostname.startsWith('172.20.') ||
          hostname.startsWith('172.21.') ||
          hostname.startsWith('172.22.') ||
          hostname.startsWith('172.23.') ||
          hostname.startsWith('172.24.') ||
          hostname.startsWith('172.25.') ||
          hostname.startsWith('172.26.') ||
          hostname.startsWith('172.27.') ||
          hostname.startsWith('172.28.') ||
          hostname.startsWith('172.29.') ||
          hostname.startsWith('172.30.') ||
          hostname.startsWith('172.31.')) {
        return res.status(400).json({
          error: {
            code: 'SSRF_BLOCKED',
            message: 'Access to private/localhost URLs is not allowed in production'
          }
        });
      }
    }

    // Check for custom scenarios (se presenti nell'input)
    const customScenarios = req.body.customScenarios;
    console.log(`[${correlationId}] Received body customScenarios:`, customScenarios);
    console.log(`[${correlationId}] typeof customScenarios:`, typeof customScenarios);
    if (customScenarios && Array.isArray(customScenarios)) {
      console.log(`[${correlationId}] customScenarios array length:`, customScenarios.length);
      customScenarios.forEach((s, i) => {
        console.log(`[${correlationId}] customScenarios[${i}]:`, typeof s, JSON.stringify(s));
      });
    }
    
    const scenarios = customScenarios?.filter(scenario => {
      const isValid = typeof scenario === 'object' && scenario !== null && !Array.isArray(scenario) && scenario.hasOwnProperty('custom');
      if (isValid) {
        console.log(`[${correlationId}] Valid custom scenario found:`, scenario);
      }
      return isValid;
    });
    
    // Esegui il test
    console.log(`[${correlationId}] Running consent test... ${scenarios && scenarios.length > 0 ? `with ${scenarios.length} custom scenarios` : 'basic scenarios only'}`);
    console.log(`[${correlationId}] Passing scenarios to runConsentTest:`, scenarios);
    const runnerDependencies: ConsentRunnerDependencies | undefined = consentLLMService
      ? { llmService: consentLLMService }
      : undefined;

    const result = await runConsentTest(input, scenarios, runnerDependencies);
    
    console.log(`[${correlationId}] Consent test completed successfully`);
    res.json(result);

  } catch (error: any) {
    console.error(`[${correlationId}] Error running consent test:`, error);
    
    const httpError = toHttpError(error instanceof Error ? error : new Error('Unknown error'));
    return res.status(httpError.httpStatus).json({ 
      error: { 
        code: httpError.code, 
        message: httpError.message, 
        details: httpError.details 
      } 
    });
  }
});


// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server Error:', error);
  const httpError = toHttpError(error instanceof Error ? error : new Error('Unknown error'));
  res.status(httpError.httpStatus).json({ error: { code: httpError.code, message: httpError.message, details: httpError.details } });
});

// Handle OPTIONS preflight requests for screenshots
app.options('/api/screenshot/*', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Credentials', 'false');
  res.status(200).end();
});

// Serve screenshot images
app.get('/api/screenshot/*', (req, res) => {
  const imagePath = req.params[0];
  console.log('📸 Screenshot request:', imagePath);
  
  const fullPath = path.join(process.cwd(), imagePath);
  console.log('📸 Full path:', fullPath);
  
  // Security check - only serve files from artifacts directory
  if (!fullPath.includes('artifacts') || !fullPath.endsWith('.png')) {
    console.log('❌ Security check failed');
    return res.status(403).json({ error: 'Access denied' });
  }
  
  // Check if file exists
  if (!fsSync.existsSync(fullPath)) {
    console.log('❌ File not found:', fullPath);
    return res.status(404).json({ error: 'Screenshot not found' });
  }
  
  console.log('✅ Serving screenshot:', fullPath);
  
  // Aggiungi header CORS per permettere al frontend di caricare le immagini
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Credentials', 'false');
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  res.header('Cache-Control', 'public, max-age=3600'); // Cache per 1 ora
  
  // Imposta timeout per evitare connessioni aperte troppo a lungo
  res.setTimeout(30000, () => {
    if (!res.headersSent) {
      console.log('⏰ Screenshot request timeout');
      res.status(408).json({ error: 'Request timeout' });
    }
  });
  
  // Gestisci la chiusura della connessione
  req.on('close', () => {
    console.log('🔌 Client disconnected during screenshot download');
  });
  
  res.sendFile(fullPath, (err) => {
    if (err) {
      // Log solo se non è un errore di connessione chiusa
      if (err.code !== 'EPIPE' && err.code !== 'ECONNRESET') {
        console.error('❌ Error serving screenshot:', err);
      } else {
        console.log('🔌 Client disconnected during file transfer');
      }
      
      // Verifica se la risposta è già stata inviata
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error serving screenshot' });
      }
    }
  });
});

// 404 handler
app.use((req, res) => {
  const httpError = toHttpError(new Error('Endpoint not found'));
  res.status(404).json({ error: { code: 'ENDPOINT_NOT_FOUND', message: 'Endpoint not found', details: { path: req.path, method: req.method } } });
});

// Avvio server
app.listen(PORT, () => {
  console.log(`🔌 SSD Test Server attivo su http://localhost:${PORT}`);
  console.log(`📄 HTML Proxy: GET /api/fetchHtml`);
  console.log(`📊 SSD Test: POST /api/ssd/ingest, POST /api/ssd/run`);
  console.log(`⚙️  Config: GET /api/ssd/config`);
  console.log(`🔑 OpenAI API Key: ${config.openaiApiKey ? '✅ Configured' : '❌ Missing'}`);
});
