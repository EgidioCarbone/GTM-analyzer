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
import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import vm from 'node:vm';
import { randomUUID } from 'crypto';

// Import our SSD services
import { extractPDFText, extractPDFTextFromBuffer, validatePDFFile, PDFExtractionError } from './src/services/pdfTextExtraction.js';
import { OpenAISpecService, OpenAIError as ServiceOpenAIError, type ScenarioSpecBuildInput } from './src/services/openaiSpecService.js';
import { validateTestSpec, SpecValidationError } from './src/services/specValidation.js';
import { z } from 'zod';
import { SSDPuppeteerRunner, SSDRunnerError, type RunOptions } from './src/services/ssdPuppeteerRunner.js';
import { normalizeOrigin, isValidUrl } from './src/utils/url.js';
import { extractCookieBannerWithPuppeteer } from './src/services/cookieBannerExtractor.js';
import puppeteer from 'puppeteer';
import type { Browser as PuppeteerBrowser, Page as PuppeteerPage } from 'puppeteer';
import { runConsentTest, ConsentTestInputSchema, type ConsentRunnerDependencies } from './src/ai-sentinel/pw-runner.js';
import { ConsentLLMService } from './src/ai-sentinel/llm/consent-llm-service.js';
import ga4InsightsRouter from './src/services/ga4-insights.server.ts';
import ga4ChatRouter from './src/services/ga4-chat.server.ts';
import ga4SearchRouter from './src/services/ga4-search.server.ts';
import dashboardsBuildRouter from './src/services/dashboards-build.server.ts';
import studioIntentRouter from './src/services/studio-intent.server.ts';
import studioRunRouter from './src/services/studio-run.server.ts';
import studioMetaRouter from './src/services/studio-meta.server.ts';
import studioShareRouter from './src/services/studio-share.server.ts';
import { modelSupportsCustomTemperature } from './src/utils/openaiCapabilities.ts';
import { SSD_DEFAULTS, getConfigValue, parseArray } from './src/config/ssd-defaults.js';
import {
  getModule,
  listModules as listAllModules,
  createModule as createModuleDefinition,
  updateModule as updateModuleDefinition,
  deleteModule as deleteModuleDefinition,
} from './src/modules/moduleStore.js';
import { listModuleEventDefinitions, getModuleEventDefinition } from './src/modules/eventDefinitions.js';
import {
  listModuleScenarios,
  getModuleScenario,
  upsertModuleScenario,
  deleteModuleScenario,
  deleteModuleScenarios,
  overwriteModuleScenarios
} from './src/modules/scenarioStore.js';
import { getModuleSettings, setModuleCmpSettings, deleteModuleSettings } from './src/modules/moduleSettingsStore.js';
import type {
  ModuleId,
  ModuleScenario,
  ScenarioStep,
  ModuleEventDefinition,
  SSDModule,
  ModuleCMPSettings,
  CMPValidationStatus
} from './src/modules/types.js';
import type { TestSpec, Step, TestResult, ModuleSource, ScenarioValidationOutcome } from './src/types/ssd.js';
import { extractExpectedPayloadExpression } from './shared/expectedPayload.ts';
import { llmPdfSpec } from './src/services/llmPdfSpec.ts';

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

interface AntiBotChallengeInfo {
  detected: boolean;
  reason?: string;
  provider?: string;
  title?: string;
  url?: string;
  message?: string;
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
  challenge?: AntiBotChallengeInfo | null;
  pdfTestSpec?: any;
  [key: string]: any; // Allow additional dynamic properties
}

// Helper function for sleep
const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

async function installScenarioDataLayerHook(page: PuppeteerPage, events: Array<{ timestamp: number; payload: any }>): Promise<void> {
  await page.exposeFunction('__scenarioCaptureEvent', (event: any) => {
    events.push({
      timestamp: Date.now(),
      payload: event?.payload ?? event,
    });
  });

  const hookScript = `(() => {
    const logEvent = (label, payload) => {
      try {
        const entry = { label, payload };
        if (window.__scenarioCaptureEvent) {
          window.__scenarioCaptureEvent(entry);
        }
        if (window.__ssdCaptureDataLayerEvent) {
          window.__ssdCaptureDataLayerEvent({
            timestamp: Date.now(),
            payload,
          });
        }
      } catch (error) {
        console.warn('[scenario][hook] capture failed', error);
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

    window.dataLayer = patch(window.dataLayer || [], 'window.dataLayer');
    if (window.google_tag_manager) {
      Object.values(window.google_tag_manager).forEach(container => {
        if (container && container.dataLayer) {
          container.dataLayer = patch(container.dataLayer, 'gtm.dataLayer');
        }
      });
    }
  })();`;

  await page.evaluateOnNewDocument(hookScript);
  await page.evaluate(hookScript);
}

function matchValue(expected: any, actual: any): boolean {
  if (expected === '*') {
    return actual != null && String(actual).length > 0;
  }

  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) return false;
    return expected.every((item, index) => matchValue(item, actual[index]));
  }

  if (expected && typeof expected === 'object') {
    if (!actual || typeof actual !== 'object') return false;
    return Object.entries(expected).every(([key, value]) => matchValue(value, (actual as any)[key]));
  }

  if (typeof expected === 'string' && typeof actual === 'string') {
    return expected.toLowerCase() === actual.toLowerCase();
  }

  return expected === actual;
}

function findMatchingEvent(expectation: any, events: Array<{ timestamp: number; payload: any }>): any | null {
  if (!expectation) return null;
  const eventName = expectation.event;
  return events.find(event => {
    const payload = event.payload;
    if (!payload || typeof payload !== 'object') return false;
    if (eventName && payload.event !== eventName) return false;
    if (expectation.params_subset) {
      return matchValue(expectation.params_subset, payload);
    }
    return true;
  }) || null;
}

function appendPath(base: string, segment: string): string {
  if (!base) return segment;
  if (segment.startsWith('[')) {
    return `${base}${segment}`;
  }
  return `${base}.${segment}`;
}

function valueIsPresent(value: any): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (typeof value === 'object') {
    return Object.keys(value).length > 0;
  }
  return true;
}

function resolveModuleDefaultUrl(moduleDefinition?: SSDModule): string | null {
  if (!moduleDefinition) return null;
  const candidates = [...(moduleDefinition.defaultUrls ?? []), ...(moduleDefinition.supportedHosts ?? [])];
  for (const entry of candidates) {
    if (!entry) continue;
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const candidateUrl = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed.replace(/^\/+/, '')}`;
    if (isValidUrl(candidateUrl)) {
      return candidateUrl;
    }
  }
  return null;
}

type Difference = { path: string; type: 'missing' | 'mismatch'; expected?: any; actual?: any };

function diffPayload(expected: any, actual: any, path = ''): Difference[] {
const issues: Difference[] = [];

  if (expected === '*') {
    if (!valueIsPresent(actual)) {
      issues.push({
        path: path || 'valore',
        type: 'missing',
        expected: '*',
        actual,
      });
    }
    return issues;
  }

  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) {
      issues.push({
        path: path || 'array',
        type: 'missing',
        expected,
        actual,
      });
      return issues;
    }

    if (actual.length < expected.length) {
      issues.push({
        path: path || 'array',
        type: 'mismatch',
        expected: `almeno ${expected.length} elementi`,
        actual: `${actual.length} elementi`,
      });
    }

    expected.forEach((expectedItem, index) => {
      const itemPath = appendPath(path, `[${index}]`);
      const actualItem = index < actual.length ? actual[index] : undefined;
      issues.push(...diffPayload(expectedItem, actualItem, itemPath));
    });

    return issues;
  }

  if (expected && typeof expected === 'object') {
    if (!actual || typeof actual !== 'object') {
      issues.push({
        path: path || 'oggetto',
        type: 'missing',
        expected,
        actual,
      });
      return issues;
    }

    for (const [key, value] of Object.entries(expected)) {
      const keyPath = appendPath(path, key);
      if (!Object.prototype.hasOwnProperty.call(actual, key)) {
        issues.push({
          path: keyPath,
          type: 'missing',
          expected: value,
          actual: undefined,
        });
      } else {
        issues.push(...diffPayload(value, (actual as any)[key], keyPath));
      }
    }

    return issues;
  }

  if (typeof expected === 'string' && typeof actual === 'string') {
    if (expected.toLowerCase() !== actual.toLowerCase()) {
      issues.push({
        path: path || 'valore',
        type: 'mismatch',
        expected,
        actual,
      });
      return issues;
    }
    return issues;
  }

  if (expected !== actual) {
    issues.push({
      path: path || 'valore',
      type: 'mismatch',
      expected,
      actual,
    });
  }

  return issues;
}

function formatDifferences(differences: Difference[]): string[] {
  return differences.map(diff => {
    if (diff.type === 'missing') {
      return `${diff.path} mancante o vuoto`;
    }
    return `${diff.path} atteso "${diff.expected ?? '*'}" ma trovato "${diff.actual ?? 'n/a'}"`;
  });
}

async function validateScenarioDataLayer(params: {
  scenario?: ModuleScenario | null;
  eventDefinition?: ModuleEventDefinition | null;
  capturedEvents: Array<{ timestamp: number; payload: any }>;
}): Promise<ScenarioValidationOutcome | null> {
  const { scenario, eventDefinition, capturedEvents } = params;
  const expectedSource =
    scenario?.expectedPayload ??
    eventDefinition?.expectationTemplate?.payloadTemplate ??
    null;

  if (!expectedSource) {
    console.log('[scenario][validation] No expected payload provided, skipping validation');
    return {
      status: 'SKIPPED',
      expectedPayload: null,
      normalizedExpectedPayload: null,
      matchedEventIndex: null,
      matchedEvent: null,
      reasoning: 'Nessun payload atteso fornito per questo scenario.',
    };
  }

  const normalizedExpected = normalizeManualExpectedPayload(expectedSource);
  let eventName =
    extractEventNameFromPayload(expectedSource) ||
    eventDefinition?.expectationTemplate?.event ||
    null;

  if (!eventName && typeof normalizedExpected?.event === 'string') {
    eventName = normalizedExpected.event;
  }

  const expectedStructure =
    normalizedExpected ??
    (eventName ? { event: eventName } : null);

  const candidateEvents = capturedEvents
    .map((event, index) => ({
      index,
      timestamp: event.timestamp,
      payload: event.payload,
    }))
    .filter(candidate => {
      if (!candidate.payload || typeof candidate.payload !== 'object') {
        return false;
      }
      if (!eventName) {
        return true;
      }
      const payloadEvent =
        typeof candidate.payload.event === 'string'
          ? candidate.payload.event.toLowerCase()
          : null;
      return payloadEvent === eventName.toLowerCase();
    });

  let perfectMatch: null | { index: number; payload: any } = null;
  let bestMismatch:
    | null
    | {
        index: number;
        payload: any;
        differences: Difference[];
      } = null;

  if (candidateEvents.length > 0) {
    for (const candidate of candidateEvents) {
      const differences =
        expectedStructure != null
          ? diffPayload(expectedStructure, candidate.payload, '')
          : [];

     if (differences.length === 0) {
        perfectMatch = { index: candidate.index, payload: candidate.payload };
        break;
      }

      if (!bestMismatch || differences.length < bestMismatch.differences.length) {
        bestMismatch = {
          index: candidate.index,
          payload: candidate.payload,
          differences,
        };
      }
    }
  }

  if (perfectMatch) {
    return {
      status: 'PASS',
      eventName,
      expectedPayload: expectedSource,
      normalizedExpectedPayload: normalizedExpected,
      matchedEventIndex: perfectMatch.index,
      matchedEvent: perfectMatch.payload,
      reasoning: eventName
        ? `Evento '${eventName}' trovato nel dataLayer.`
        : 'Payload atteso trovato nel dataLayer.',
      differences: [],
      matchedEventSource: 'deterministic',
    };
  }

  if (bestMismatch) {
    const differenceMessages = formatDifferences(bestMismatch.differences);
    return {
      status: 'WARNING',
      eventName,
      expectedPayload: expectedSource,
      normalizedExpectedPayload: normalizedExpected,
      matchedEventIndex: bestMismatch.index,
      matchedEvent: bestMismatch.payload,
      reasoning: eventName
        ? `Evento '${eventName}' rilevato ma la struttura presenta differenze.`
        : 'Struttura parzialmente trovata nel dataLayer ma con differenze.',
      differences: differenceMessages,
      matchedEventSource: 'deterministic',
    };
  }

  const diffMessages = formatDifferences(
    expectedStructure ? diffPayload(expectedStructure, null, '') : []
  );

  return {
    status: 'FAIL',
    eventName,
    expectedPayload: expectedSource,
    normalizedExpectedPayload: normalizedExpected,
    matchedEventIndex: null,
    matchedEvent: null,
    reasoning: eventName
      ? `Evento '${eventName}' non trovato nel dataLayer.`
      : 'Nessun evento coerente con il payload atteso è stato rilevato nel dataLayer.',
    differences:
      diffMessages.length > 0
        ? diffMessages
        : [
            eventName
              ? `Evento '${eventName}' non presente.`
              : 'Evento atteso non presente nel dataLayer.',
          ],
    matchedEventSource: 'deterministic',
  };
}

// ============================================================================
// COOKIE TEST SPEC CACHE
// Store cookie test specs generated by fetch-html for reuse in ssd/run
// ============================================================================
const cookieTestSpecCache = new Map<string, { spec: any; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCacheKey(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function slugifyModuleId(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map(item => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/[\n,]/)
      .map(item => item.trim())
      .filter(Boolean);
  }
  return [];
}

const ALLOWED_MODULE_ICONS = new Set(['ShieldCheck', 'Shield', 'Antenna', 'Sparkles', 'Layers', 'Rocket']);

function normalizeHostCandidate(value: string): string | null {
  if (!value) return null;
  let candidate = value.trim();
  if (!candidate) return null;
  if (!candidate.includes('://')) {
    candidate = `https://${candidate}`;
  }
  try {
    const url = new URL(candidate);
    return url.host || null;
  } catch {
    const sanitized = candidate.replace(/^https?:\/\//i, '').split('/')[0];
    return sanitized || null;
  }
}

function normalizeModuleUrl(value: string): string | null {
  if (!value) return null;
  let candidate = value.trim();
  if (!candidate) return null;
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`;
  }
  try {
    const url = new URL(candidate);
    return url.toString();
  } catch {
    return null;
  }
}

function sanitizeHexColor(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  let candidate = value.trim();
  if (!candidate) return undefined;
  if (!candidate.startsWith('#')) {
    candidate = `#${candidate}`;
  }
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(candidate)) {
    return candidate;
  }
  return undefined;
}

function coerceModuleIcon(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const icon = value.trim();
  if (ALLOWED_MODULE_ICONS.has(icon)) {
    return icon;
  }
  return undefined;
}

function saveCookieTestSpec(url: string, spec: any): void {
  const key = getCacheKey(url);
  cookieTestSpecCache.set(key, { spec, timestamp: Date.now() });
  console.log(`📦 Cookie test spec saved to cache for: ${key}`);
}

function getCookieTestSpec(url: string): any | null {
  const key = getCacheKey(url);
  const cached = cookieTestSpecCache.get(key);
  
  if (!cached) {
    console.log(`❌ No cookie test spec in cache for: ${key}`);
    return null;
  }
  
  const age = Date.now() - cached.timestamp;
  if (age > CACHE_TTL_MS) {
    console.log(`⏰ Cookie test spec expired for: ${key} (age: ${Math.round(age / 1000)}s)`);
    cookieTestSpecCache.delete(key);
    return null;
  }
  
  console.log(`✅ Cookie test spec retrieved from cache for: ${key}`);
  return cached.spec;
}

// Cleanup expired entries every minute
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of cookieTestSpecCache.entries()) {
    if (now - value.timestamp > CACHE_TTL_MS) {
      cookieTestSpecCache.delete(key);
    }
  }
}, 60000);

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

// CORS configuration (before rate limiting to cover preflight)
const allowedOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
const corsMiddleware = cors({
  origin: allowedOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});
app.use(corsMiddleware);
app.options('*', corsMiddleware);

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX || '100'), // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// GA4 APIs
app.use(ga4InsightsRouter);
app.use(ga4ChatRouter);
app.use(ga4SearchRouter);
app.use(dashboardsBuildRouter);
app.use(studioIntentRouter);
app.use(studioRunRouter);
app.use(studioShareRouter);
app.use(studioMetaRouter);

// Static files for artifacts with CORS headers
app.use('/artifacts', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', allowedOrigin);
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
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
      const allowedKeys = [
        'url',
        'dsl',
        'runOptions',
        'pdfContent',
        'pdfBufferPath',
        'moduleId',
        'moduleSource',
        'scenarioId',
      ];
      const sanitizedBody: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(req.body)) {
        if (allowedKeys.includes(key)) {
          sanitizedBody[key] = value;
        }
      }
      req.body = sanitizedBody;
    }
  }
  next();
});

// Multer configuration for file uploads - using memory storage
const MAX_UPLOAD_MB = getConfigValue('MAX_UPLOAD_MB', SSD_DEFAULTS.upload.maxFileSizeMB, val => Number.parseInt(val, 10));
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
      cb(new Error(errorMessage) as any, false);
    }
  },
});

// Ensure required directories exist
await fs.mkdir(SSD_DEFAULTS.path.uploads, { recursive: true });
await fs.mkdir(SSD_DEFAULTS.path.screenshots, { recursive: true });
await fs.mkdir(SSD_DEFAULTS.path.tempHtml, { recursive: true });
await fs.mkdir(SSD_DEFAULTS.path.tempPdf, { recursive: true });

// PDF Magic Number Validation
function isPdfBuffer(buf: Buffer): boolean {
  if (!buf || buf.length < 5) return false;
  const magicNumbers = SSD_DEFAULTS.upload.pdfMagicNumbers;
  return buf[0] === magicNumbers[0] && buf[1] === magicNumbers[1] && 
         buf[2] === magicNumbers[2] && buf[3] === magicNumbers[3] && buf[4] === magicNumbers[4];
}

// Environment configuration using centralized defaults
const config = {
  openaiApiKey: process.env.OPENAI_API_KEY,
  openaiModel: getConfigValue('OPENAI_MODEL', SSD_DEFAULTS.llm.models.default),
  openaiTimeoutMs: getConfigValue('OPENAI_TIMEOUT_MS', SSD_DEFAULTS.llm.timeout.default, val => Number.parseInt(val, 10)),
  puppeteerOriginAllowlist: parseArray(getConfigValue('PUPPETEER_ORIGIN_ALLOWLIST', '')),
  puppeteerAllowedTracking: parseArray(getConfigValue('PUPPETEER_ALLOWED_TRACKING', SSD_DEFAULTS.network.tracking.join(','))),
  puppeteerAllowedCDNs: parseArray(getConfigValue('PUPPETEER_ALLOWED_CDNS', SSD_DEFAULTS.network.cdn.join(','))),
  runnerStepTimeoutMs: getConfigValue('RUNNER_STEP_TIMEOUT_MS', SSD_DEFAULTS.timeout.step, val => Number.parseInt(val, 10)),
  runnerNavTimeoutMs: getConfigValue('RUNNER_NAV_TIMEOUT_MS', SSD_DEFAULTS.timeout.navigation, val => Number.parseInt(val, 10)),
  maxFileSize: getConfigValue('MAX_UPLOAD_MB', SSD_DEFAULTS.upload.maxFileSizeMB, val => Number.parseInt(val, 10)) * 1024 * 1024,
  rateLimitWindowMs: getConfigValue('RATE_LIMIT_WINDOW_MS', SSD_DEFAULTS.rateLimit.windowMs, val => Number.parseInt(val, 10)),
  rateLimitMax: getConfigValue('RATE_LIMIT_MAX', SSD_DEFAULTS.rateLimit.max, val => Number.parseInt(val, 10)),
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
  screenshotDir: SSD_DEFAULTS.path.screenshots,
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
      parsedSpec.tests.forEach((test: any, testIndex: number) => {
        console.log(`📋 Test ${testIndex + 1}: ${test.section}`);
        console.log(`📋 Original steps count: ${test.steps?.length || 0}`);
        test.steps?.forEach((step: any, stepIndex: number) => {
          console.log(`  Step ${stepIndex + 1}: ${step.description}`);
        });
      });
    }
    
    console.log('🔍 Applying cookie consent filter...');
    // Filter out cookie consent steps since cookies are already accepted
    if (parsedSpec.tests && parsedSpec.tests.length > 0) {
      parsedSpec.tests.forEach((test: any, testIndex: number) => {
        if (test.steps) {
          const originalStepCount = test.steps.length;
          // Remove steps that are related to cookie acceptance
          test.steps = test.steps.filter((step: any) => {
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
      parsedSpec.tests.forEach((test: any, testIndex: number) => {
        if (test.steps) {
          test.steps.forEach((step: any, stepIndex: number) => {
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
    } catch (cleanupError: any) {
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
    page: null, // Add page to result
    challenge: null
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
    try {
      const desktopUserAgent =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36';
      await page.setUserAgent(desktopUserAgent);
      await page.setExtraHTTPHeaders({
        'accept-language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
      });
    } catch (uaError) {
      console.warn('⚠️ Unable to set custom user agent/headers for consent test page:', (uaError as Error).message);
    }
    
    // Force desktop viewport to avoid mobile layout
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    await page.emulateMediaType('screen');
    
    console.log('✓ Browser launched and page created');
    result.page = page; // Store page in result
    
    // Execute cookie consent test steps from DSL
    for (let i = 0; i < dsl.tests[0].steps.length; i++) {
      const step = dsl.tests[0].steps[i];
      console.log(`Executing step ${i + 1}: ${step.description}`);
      
      const stepResult: any = {
        step: i + 1,
        description: step.description,
        action: step.action,
        status: 'FAIL',
        error: null as string | null,
        eventDetails: null
      };
      
      try {
        if (step.action === 'navigate') {
          // FIX: More robust navigation for SPA sites
          await page.goto(step.target.value, { 
            waitUntil: 'networkidle0', // Wait for all network activity to stop
            timeout: 60000 // Increase timeout for slow sites
          });
          // Extra wait for SPAs that load content dynamically
          await new Promise(resolve => setTimeout(resolve, 2000));
          console.log('✓ Navigation successful (with SPA wait)');

          const challenge = await detectAntiBotChallenge(page);
          if (challenge.detected) {
            const message = `Anti-bot challenge detected (${challenge.reason || 'unknown'})`;
            console.log(`⚠️ ${message}`);
            stepResult.status = 'FAIL';
            stepResult.error = message;
            result.error = message;
            result.challenge = challenge;
            result.status = 'BLOCKED';
            result.consentStatus = 'blocked';
            result.duration = Date.now() - startTime;
            (result.steps as any[]).push(stepResult);
            break;
          }

          stepResult.status = 'PASS';
        } else if (step.action === 'click') {
          // Wait for cookie banner to load and become visible
          console.log('Waiting for cookie banner to load and become visible...');
          console.log('Looking for selector:', step.target.value);
          const located = await waitForSelectorInPageOrFrames(page, step.target.value, 15000);
          if (!located) {
            throw new Error(`Selector ${step.target.value} not found in page or frames`);
          }
          const { elementHandle, context } = located;
          const isIframe = context === 'frame';
          const isShadow = context === 'shadow';
          console.log(
            `✓ Cookie banner button found${
              isIframe ? ' inside iframe' : isShadow ? ' inside shadow DOM' : ''
            } and visible`
          );
          
          // Check dataLayer BEFORE click
          const dataLayerBefore = await page.evaluate(() => window.dataLayer || []);
          console.log('DataLayer BEFORE click:', dataLayerBefore.length, 'events');
          console.log('DataLayer BEFORE click events:', dataLayerBefore);
          
          // Capture cookie button selector and outerHTML for diagnosis
          result.cookieBtnSelector = step.target.value;
          console.log(`Cookie button selector: ${step.target.value}`);
          
          // Get outerHTML of the button
          try {
            result.cookieBtnOuterHTML = await elementHandle.evaluate((el: any) => el.outerHTML);
            console.log(`Cookie button outerHTML captured: ${result.cookieBtnOuterHTML?.substring(0, 200)}...`);
          } catch (outerHTMLError) {
            console.log(`Warning: Could not capture outerHTML: ${(outerHTMLError as Error).message}`);
            result.cookieBtnOuterHTML = 'Error capturing outerHTML';
          }
          
          // Click the button
          try {
            await elementHandle.evaluate((el: any) => {
              if (typeof el.scrollIntoView === 'function') {
                el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
              }
            });
          } catch (scrollError) {
            console.log(`Warning: Could not scroll element into view: ${(scrollError as Error).message}`);
          }

          await elementHandle.click({ delay: 40 });
          console.log(
            `✓ Click successful on ${step.target.value}${
              isShadow ? ' (shadow DOM)' : isIframe ? ' (iframe)' : ''
            }`
          );
          await elementHandle.dispose().catch(() => {});
          
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
          const consentEvents = newEvents.filter((event: any) => 
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
    if (result.status === 'BLOCKED') {
      result.duration = result.duration || (Date.now() - startTime);
      console.log('⚠️ Cookie consent test blocked by anti-bot challenge');
      return result;
    }

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

async function detectAntiBotChallenge(page: any): Promise<AntiBotChallengeInfo> {
  try {
    const info = await page.evaluate(() => {
      const title = document.title || '';
      const html = document.documentElement?.innerHTML || '';
      const body = document.body?.innerText || '';
      const challengeScript = !!document.querySelector('script[src*="challenge-platform"]');
      const hasRay = html.includes('cf-ray') || html.includes('cf-chl');
      return {
        title,
        body,
        challengeScript,
        hasRay,
        locationHref: window.location.href,
      };
    });

    const title = (info.title || '').toLowerCase();
    const body = (info.body || '').toLowerCase();
    if (
      info.challengeScript ||
      info.hasRay ||
      title.includes('checking your browser') ||
      title.includes('ci siamo quasi') ||
      body.includes('checking your browser before accessing') ||
      body.includes('cloudflare') && body.includes('checking your browser')
    ) {
      return {
        detected: true,
        reason: 'cloudflare_challenge',
        provider: 'cloudflare',
        title: info.title || undefined,
        url: info.locationHref || undefined,
        message: 'Accesso bloccato da un challenge anti-bot (Cloudflare)'
      };
    }
  } catch (error) {
    console.log('⚠️ detectAntiBotChallenge error:', error);
  }

  return { detected: false };
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

// --- Helper: accepted event names with aliases ---
function acceptedNamesFor(eventName: string): Set<string> {
  const aliases: Record<string, string[]> = {
    navigation_click: ['navigation_click', 'header_menu_click'],
    header_menu_click: ['header_menu_click', 'navigation_click'],
  };
  return new Set([eventName, ...(aliases[eventName] || [])]);
}

// --- Helper: wait for dataLayer event ---
async function waitForDataLayerEvent(page: import('puppeteer').Page, expected: string, timeout = 4000): Promise<boolean> {
  const names = [...acceptedNamesFor(expected)];
  try {
    await page.waitForFunction(
      (n) => Array.isArray((window as any).dataLayer) && (window as any).dataLayer.some((e: any) => n.includes(e?.event)),
      { timeout },
      names
    );
    return true;
  } catch {
    return false;
  }
}

// --- Helper: wait for dataLayer with subset params (more flexible) ---
async function waitForDataLayerSubset(page: import('puppeteer').Page, subset: Record<string, any>, timeout = 7000): Promise<boolean> {
  try {
    await page.waitForFunction(
      (expected) => {
        const dl = (window as any).dataLayer;
        if (!Array.isArray(dl)) return false;
        return dl.some((e: any) => {
          if (!e || typeof e !== 'object') return false;
          // non vincolarti al nome evento: controlla solo che i CAMPI richiesti coincidano
          return Object.entries(expected).every(([k, v]) => {
            const ov = e?.[k];
            if (v === '*') return ov != null && String(ov).length > 0;
            return typeof v === 'string'
              ? String(ov).toLowerCase() === String(v).toLowerCase()
              : ov === v;
          });
        });
      },
      { timeout },
      subset
    );
    return true;
  } catch {
    return false;
  }
}

// --- Helper: compile wildcard values in params_subset based on clicked element ---
// UNIVERSAL: works with ANY schema (Italgas, Aruba, AC Milan, etc.)
function compileSubsetFromElement(
  paramsSubsetTemplate: Record<string, any>,
  el: Element,
  allowedHosts: string[]
): Record<string, any> {
  const compiled: Record<string, any> = {};
  
  const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
  const isA = el.tagName === 'A';
  const href = isA ? (el as HTMLAnchorElement).href : null;
  const currentUrl = location.href;
  const referrer = document.referrer;
  const lang = document.documentElement.lang || 'it';
  const viewportWidth = window.innerWidth;
  
  // Compute pathname for action fields
  let pathname = 'Non prevista'; // default if not a direct link
  if (href) {
    try {
      const u = new URL(href, location.href);
      const internal = allowedHosts.some(
        (h: string) => u.hostname === h || u.hostname.endsWith('.' + h)
      );
      if (internal) pathname = u.pathname || '/';
    } catch {}
  }
  
  // For each field in the template, compile the value if it's a wildcard
  for (const [key, templateValue] of Object.entries(paramsSubsetTemplate)) {
    // If not a wildcard, keep as is
    if (templateValue !== '*' && templateValue !== 'to-be-determined') {
      compiled[key] = templateValue;
      continue;
    }
    
    // Compile wildcard based on field name (universal patterns)
    const keyLower = key.toLowerCase();
    
    // Text-based fields
    if (keyLower.includes('text') || keyLower.includes('label')) {
      compiled[key] = text;
    }
    // URL-based fields
    else if (keyLower.includes('url') && keyLower.includes('click')) {
      compiled[key] = href || currentUrl;
    }
    else if (keyLower.includes('full') && keyLower.includes('url')) {
      compiled[key] = currentUrl;
    }
    // Generic URL fields (e.g., link_url, button_url, etc.)
    else if (keyLower.includes('url')) {
      compiled[key] = href || currentUrl;
    }
    // Action/destination fields
    else if (keyLower.includes('action') || keyLower.includes('destination')) {
      compiled[key] = pathname;
    }
    // Category fields
    else if (keyLower.includes('category')) {
      compiled[key] = 'menu_primo_livello'; // reasonable default
    }
    // Navigation type / device
    else if (keyLower.includes('navigation') || keyLower.includes('device')) {
      compiled[key] = viewportWidth >= 992 ? 'desktop' : 'mobile';
    }
    // Language
    else if (keyLower.includes('lang')) {
      compiled[key] = lang;
    }
    // Referrer
    else if (keyLower.includes('referrer')) {
      compiled[key] = referrer;
    }
    // Index/level (default to 0 for first level)
    else if (keyLower.includes('index') || keyLower.includes('level')) {
      compiled[key] = '0';
    }
    // Default: use text if we don't know what it is
    else {
      compiled[key] = text;
    }
  }
  
  return compiled;
}

// --- Helper: check for soft PASS (gtm.click / navigation / submenu) ---
async function isSoftPass(page: import('puppeteer').Page, elSelector: string, allowedHosts: string[]): Promise<boolean> {
  const before = await page.url();
  await new Promise(resolve => setTimeout(resolve, 600));
  const after = await page.url();

  // Check internal navigation
  const internalNav = (() => {
    try {
      const u = new URL(after);
      return after !== before && allowedHosts.some((h: string) => u.hostname === h || u.hostname.endsWith('.' + h));
    } catch {
      return false;
    }
  })();
  if (internalNav) return true;

  // Check submenu open
  const submenuOpen = await page.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLElement | null;
    if (!el) return false;
    if (el.getAttribute('aria-expanded') === 'true') return true;
    const li = el.closest('li');
    if (!li) return false;
    const open = li.classList.contains('is-open') || li.querySelector('ul, [role="menu"]');
    if (!open) return false;
    const r = (li as HTMLElement).getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }, elSelector);
  if (submenuOpen) return true;

  // Check gtm.click match
  const gtmClickMatch = await page.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLElement | null;
    const id = el?.id || '';
    const cls = String(el?.className || '').split(/\s+/).filter(Boolean);
    const dl = (window as any).dataLayer || [];
    return dl.some((e: any) =>
      e?.event === 'gtm.click' && (
        (id && e?.['gtm.elementId'] === id) ||
        (cls.length && cls.some((c: string) => String(e?.['gtm.elementClasses'] || '').includes(c)))
      )
    );
  }, elSelector);

  return !!gtmClickMatch;
}

// --- Helper: robust click with fallbacks ---
async function clickElementRobust(page: import('puppeteer').Page, selector: string) {
  await page.waitForSelector(selector, { visible: true, timeout: 4000 });

  // scroll in view "gentile"
  await page.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLElement | null;
    if (!el) return;
    el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' as any });
  }, selector);

  // prova hover + click "normale"
  try {
    await page.hover(selector);
  } catch { }
  
  try {
    await page.click(selector, { delay: 20 });
    return;
  } catch (e) {
    // fallback: click "al centro" via mouse
    const element = await page.$(selector);
    if (element) {
      const box = await element.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.up();
        return;
      }
    }
    // fallback finale: click JS
    await page.evaluate((sel) => {
      const el = document.querySelector(sel) as HTMLElement | null;
      if (!el) throw new Error('Element not found for JS click');
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      (el as HTMLAnchorElement).click?.();
    }, selector);
  }
}

// --- IMPROVED resolver: filters external/invisible links, returns unique selector ---
async function resolveHeaderCandidate(page: import('puppeteer').Page, allowedHosts: string[]) {
  const PASS = async (mode: 'links' | 'buttons') => {
    const selector =
      mode === 'links'
        ? "header nav a[href]:not([href='#']):not([aria-hidden='true']),[role='banner'] nav a[href]:not([href='#']):not([aria-hidden='true']),header a[href]:not([href='#']):not([aria-hidden='true']),[role='banner'] a[href]:not([href='#']):not([aria-hidden='true'])"
        : "header button[role='menuitem']:not([disabled]),[role='banner'] button[role='menuitem']:not([disabled]),nav button[role='menuitem']:not([disabled])";

    return await page.evaluate((sel, allowed) => {
      (globalThis as any).__name ||= ((t: any) => t);

      const isVisibleEnough = (el: Element) => {
        const e = el as HTMLElement;
        const cs = getComputedStyle(e);
        const r = e.getBoundingClientRect();
        // niente display:none, niente visibility:hidden, rettangolo > 2x2, non puntatore disattivato
        return cs.display !== 'none' && cs.visibility !== 'hidden' &&
               r.width > 2 && r.height > 2 && cs.pointerEvents !== 'none';
      };

      const badClass = /(logo|brand|hamburger|mobile|back|close|toggle|menuMobile|j-back|j-close|preNav|utility|search|cerca|wpml|language|lang)/i;
      const badText  = /(cerca|search|myitalgas|accedi|login|area clienti|cookie|english|inglese|lingua)/i;

      const isInternal = (a: HTMLAnchorElement) => {
        try {
          const u = new URL(a.href, location.href);
          return allowed.some((h: string) => u.hostname === h || u.hostname.endsWith(`.${h}`));
        } catch { return false; }
      };

      const score = (el: Element) => {
        const e = el as HTMLElement;
        const text = (e.innerText || e.textContent || '').trim();
        let s = Math.min(40, text.length);
        if (e.tagName === 'A') s += 4;
        if (e.getAttribute('role') === 'menuitem') s += 4;
        if (e.closest('nav')) s += 3;
        if (e.closest('header')) s += 2;
        
        // boosta i link che stanno dentro al menù principale
        if (e.closest('nav') && e.closest('nav')!.querySelector('ul,ol')) s += 4;
        
        // penalizza link "di servizio" (lang switcher WPML ecc.)
        if (/\bwpml\b|language|lang/.test(e.className)) s -= 8;
        
        return s;
      };

      const toCssPath = (el: Element): string => {
        const parts: string[] = [];
        let node: Element | null = el;
        while (node && node.nodeType === 1 && node !== document.documentElement) {
          const tag = node.tagName.toLowerCase();
          const parent: Element | null = node.parentElement;
          if (!parent) break;
          const currentNode = node; // capture for filter
          const idx = Array.from(parent.children).filter(c => (c as Element).tagName === currentNode.tagName).indexOf(node) + 1;
          parts.unshift(`${tag}:nth-of-type(${idx})`);
          node = parent;
        }
        return parts.join(' > ');
      };

      // raccogli
      const all = Array.from(document.querySelectorAll(sel)) as HTMLElement[];
      const reasons = { invisible: 0, badClass: 0, badText: 0, external: 0, targetBlank: 0 };

      // Preferisci elementi di primo livello (li > a, senza altri li antenati)
      const firstLevelLinks = Array.from(new Set(
        all.filter(el => {
          const li = el.closest('li');
          if (!li) return false;
          // evita sottovoci: se ha un li antenato con un altro li dentro, scarta
          const parentUl = li.parentElement;
          return parentUl && parentUl.closest('li') === null;
        })
      ));
      const pool = firstLevelLinks.length ? firstLevelLinks : all;

      const candidates = pool.filter(el => {
        if (!isVisibleEnough(el)) { reasons.invisible++; return false; }
        if (badClass.test(el.className || '')) { reasons.badClass++; return false; }
        const text = (el.innerText || el.textContent || '').trim().toLowerCase();
        const aria = (el.getAttribute('aria-label') || '').toLowerCase();
        if (badText.test(text) || badText.test(aria)) { reasons.badText++; return false; }
        if (el.tagName === 'A') {
          const a = el as HTMLAnchorElement;
          if (a.target === '_blank') { reasons.targetBlank++; return false; }
          try {
            const u = new URL(a.href, location.href);
            if (!allowed.some((h: string) => u.hostname === h || u.hostname.endsWith(`.${h}`))) { reasons.external++; return false; }
          } catch { return false; }
        }
        return true;
      }).map(el => ({ el, s: score(el) }))
        .sort((a, b) => b.s - a.s);

      if (!candidates.length) {
        console.debug('[resolver][debug] Filter stats:', reasons, 'in', all.length, 'elements for', sel);
        return null;
      }
      const best = candidates[0].el;
      return {
        uniqueSelector: toCssPath(best),
        debug: {
          tag: best.tagName,
          text: (best.innerText || best.textContent || '').trim(),
          href: best instanceof HTMLAnchorElement ? best.href : null,
          score: candidates[0].s,
          pool: candidates.slice(0, 5).map(c => ({
            tag: c.el.tagName,
            t: (c.el.innerText || c.el.textContent || '').trim().slice(0, 60),
            href: c.el instanceof HTMLAnchorElement ? c.el.href : null,
            s: c.s
          }))
        }
      };
    }, selector, allowedHosts);
  };

  // PASS 1: preferisci link <a>
  const pass1 = await PASS('links');
  if (pass1) {
    console.log('[resolver] ✅ LINK scelto:', pass1.debug);
    return pass1.uniqueSelector;
  }

  // PASS 2: fallback su <button role="menuitem">
  const pass2 = await PASS('buttons');
  if (pass2) {
    console.log('[resolver] ✅ BUTTON scelto:', pass2.debug);
    return pass2.uniqueSelector;
  }

  console.log('[resolver] ⚠️ Nessun candidato valido trovato nel header.');
  return null;
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
    
    if (browserInstance && existingPage) {
      options = {
        ...options,
        reuseBrowser: browserInstance,
        reusePage: existingPage,
      };
    }
    
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
    // FIX: Remove hardcoded fallback, use site from options or testSpec
    const testSpecForRunner = {
      site: options.site || testSpec.site,
      allowed_hosts: options.allowedHosts || testSpec.allowed_hosts,
      consent: ['accept'] as ('accept' | 'reject')[],
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
      (existingPage as any).__ssdCapturedEvents = [];
      
      // CRITICAL: Re-apply the universal hook to the existing page
      console.log('🔄 Re-applying universal hook to existing page...');
      
      // Expose the capture function to the existing page
      await existingPage.exposeFunction('__ssdCaptureDataLayerEvent', (event: any) => {
        const eventName = event.payload?.event || 'unknown';
        console.log('[ssd][capture] Event captured:', eventName);
        
        // 🔍 DEBUG: Log full event payload for important events
        if (eventName !== 'unknown' && eventName !== 'gtm.js' && eventName !== 'gtm.dom' && eventName !== 'gtm.load') {
          console.log('[ssd][capture] Full payload:', JSON.stringify(event.payload, null, 2));
        }
        
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
      await existingPage.evaluateOnNewDocument(hookScript);
      await existingPage.evaluate(hookScript);
      
      console.log('✅ Universal hook injected into existing page');
      
      // IMPORTANT: Skip navigation since we're using existing page
      console.log('🚫 Skipping navigation - using existing page with consent state');
    } else {
      // Initialize browser and page
      // Note: initializeBrowser is private, use runTests instead
      console.log('⚠️ Browser initialization skipped - using runTests method');
    }
    
    // Execute tests directly on existing page
    if (existingPage) {
      console.log('🎯 Executing tests directly on existing page...');
      
      const tests = normalized.tests || [];
      const stepResults: any[] = [];

      for (let testIndex = 0; testIndex < tests.length; testIndex++) {
        const test = tests[testIndex];
        const steps = Array.isArray(test?.steps) ? test.steps : [];

        for (let stepIndex = 0; stepIndex < steps.length; stepIndex++) {
          const step = steps[stepIndex];
          const globalStepIndex = stepResults.length;
          console.log(`===== PDF TEST STEP ${globalStepIndex + 1} (section: ${test.section || test.id || 'N/A'}) =====`);
          console.log(`📝 Description: ${step.description || 'No description'}`);
          console.log(`🎯 Action: ${step.action}`);
          console.log(`🎯 Target: ${step.target?.value ?? 'N/A'}`);

          const stepResult: any = {
            step: globalStepIndex + 1,
            section: test.section || test.id || `Test ${testIndex + 1}`,
            description: step.description || 'No description',
            action: step.action,
            status: 'FAIL',
            error: null as string | null,
            eventDetails: null,
            expectations: step.expect || [],
          };

          try {
          if (step.action === 'navigate') {
            const targetUrl = step.target?.value || normalized.site || testSpec.site;
            if (targetUrl) {
              console.log(`🌐 Navigating to ${targetUrl}`);
              await existingPage.goto(targetUrl, { waitUntil: 'networkidle0', timeout: options.navTimeoutMs || options.timeout || 60000 });
              await new Promise(resolve => setTimeout(resolve, 2000));
              const currentUrl = await existingPage.url();
              console.log(`📍 Current URL after navigation: ${currentUrl}`);
            } else {
              console.log('⚠️ Navigate step without valid target URL - skipping');
            }
            stepResult.status = 'PASS';
          } else if (step.action === 'custom') {
            const dataLayerExpectations = (step.expect || []).filter((e: any) => e?.type === 'dataLayer');
            if (dataLayerExpectations.length === 0) {
              console.log('ℹ️ Custom step without dataLayer expectations → marking PASS by default');
              stepResult.status = 'PASS';
            } else {
              const capturedEvents = (existingPage as any).__ssdCapturedEvents || [];
              console.log(`🗂️ Captured events available: ${capturedEvents.length}`);

            const allMatched = dataLayerExpectations.every((expectation: any, idx: number) => {
              const expectedEvent = expectation.event;
              const subset = expectation.params_subset || null;

                if (!expectedEvent) {
                  console.log(`⚠️ DataLayer expectation ${idx} has no event name, skipping`);
                  return true;
                }

                const matchingEvent = capturedEvents.find((captured: any) => {
                  const payload = captured?.payload;
                  if (!payload || typeof payload !== 'object') return false;
                  if (payload.event !== expectedEvent) return false;

                  if (subset && typeof subset === 'object') {
                    return Object.entries(subset).every(([key, value]) => {
                      const actual = (payload as any)[key];
                      if (value === '*') return actual != null && String(actual).length > 0;
                      if (typeof value === 'string' && typeof actual === 'string') {
                        return actual.toLowerCase() === value.toLowerCase();
                      }
                      return actual === value;
                    });
                  }

                  return true;
                });

                if (!matchingEvent) {
                  console.warn(`❌ Expected event "${expectedEvent}" not found in captured events`);
                } else {
                  console.log(`✅ Found expected event "${expectedEvent}"`, matchingEvent.payload);
                  if (!stepResult.eventDetails) {
                    stepResult.eventDetails = { events: [] };
                  }
                  if (!stepResult.eventDetails.events) {
                    stepResult.eventDetails.events = [];
                  }
                  stepResult.eventDetails.events.push({
                    event: matchingEvent.payload?.event,
                    payload: matchingEvent.payload,
                  });
                  stepResult.matchedEvent = matchingEvent.payload;
                }

                return Boolean(matchingEvent);
              });

              if (allMatched) {
                stepResult.status = 'PASS';
                stepResult.capturedEvents = capturedEvents.slice(0, 10).map((e: any) => e.payload);
              } else {
                stepResult.error = 'Expected dataLayer event(s) not found';
                stepResult.capturedEvents = capturedEvents.slice(0, 10).map((e: any) => e.payload);
              }
            }
          } else if (step.action === 'click') {
            // Resolve selector if needed
            let selector = step.target?.value;
            if (!selector || selector === 'to-be-determined') {
              console.log('🔍 Resolving selector in runtime...');
              // Get allowed hosts from testSpec
              const allowedHosts = testSpec.allowed_hosts || ['italgas.it', 'www.italgas.it'];
              const uniqueSelector = await resolveHeaderCandidate(existingPage, allowedHosts);
              
              if (!uniqueSelector) {
                throw new Error('No suitable header link found');
              }
              
              selector = uniqueSelector;
              console.log(`✅ Resolved unique selector: ${selector}`);
            }
            
            // Get element handle for computing expected values
            const elHandle = await existingPage.$(selector);
            if (!elHandle) {
              throw new Error(`Element not found with selector: ${selector}`);
            }
            
            // Get element info before clicking (for debug)
            const clickedElementInfo = await existingPage.evaluate((sel: string) => {
              const el = document.querySelector(sel);
              if (!el) return null;
              return {
                tagName: el.tagName,
                text: (el.textContent?.trim() || '').substring(0, 100),
                href: (el as HTMLAnchorElement).href || 'no-href',
                id: el.id || 'no-id',
                className: el.className || 'no-class'
              };
            }, selector);
            
            console.log(`🎯 CLICKING ELEMENT:`, clickedElementInfo);
            
            // Take screenshot before click
            const beforeScreenshot = await existingPage.screenshot({ 
              path: `${SSD_DEFAULTS.path.screenshots}/pdf_test_step_${globalStepIndex + 1}_before_${Date.now()}.png`,
              fullPage: true 
            });
            
            // Get params_subset template from step expectation
            const allowedHosts = testSpec.allowed_hosts || [];
            const paramsSubsetTemplate = (step.expect || []).find((e: any) => e?.type === 'dataLayer')?.params_subset || {};
            
            // Compile wildcard values (*) from element
            const subset = await existingPage.evaluate(compileSubsetFromElement, paramsSubsetTemplate, elHandle, allowedHosts);
            
            console.log(`📊 Compiled subset from element:`, subset);
            
            // Robust click with fallbacks
            await clickElementRobust(existingPage, selector);
            console.log(`✅ Click completed`);
            
            // Take screenshot after click
            const afterScreenshot = await existingPage.screenshot({ 
              path: `${SSD_DEFAULTS.path.screenshots}/pdf_test_step_${globalStepIndex + 1}_after_${Date.now()}.png`,
              fullPage: true 
            });
            
            // Wait a bit for events to be processed
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // ✅ NEW LOGIC: Check captured events from hook instead of window.dataLayer
            console.log(`⏱️ Checking captured events for subset:`, subset);
            const capturedEvents = (existingPage as any).__ssdCapturedEvents || [];
            
            console.log(`🔍 Total captured events: ${capturedEvents.length}`);
            
            // Find event matching the subset
            // ✅ FLEXIBLE MATCHING: Critical fields must match, non-critical can be lenient
            const criticalFields = ['event', 'link_text', 'link_url', 'button_text', 'button_url'];
            
            const matchingEvent = capturedEvents.find((captured: any) => {
              const payload = captured.payload;
              if (!payload || typeof payload !== 'object') return false;
              
              // Check if all subset fields match
              return Object.entries(subset).every(([key, expectedValue]) => {
                const actualValue = payload[key];
                const isCritical = criticalFields.some(cf => key.toLowerCase().includes(cf.toLowerCase()));
                
                // Wildcard matching
                if (expectedValue === '*') {
                  return actualValue != null && String(actualValue).length > 0;
                }
                
                // For non-critical fields (like index, level), be lenient
                if (!isCritical && actualValue != null && String(actualValue).length > 0) {
                  // Field exists with some value → OK
                  console.log(`⚠️ Non-critical field "${key}": expected="${expectedValue}", actual="${actualValue}" → LENIENT PASS`);
                  return true;
                }
                
                // Case-insensitive string matching for critical fields
                if (typeof expectedValue === 'string' && typeof actualValue === 'string') {
                  return actualValue.toLowerCase() === expectedValue.toLowerCase();
                }
                
                // Exact matching
                return actualValue === expectedValue;
              });
            });
            
            if (matchingEvent) {
              console.log(`✅ Found matching event in captured events:`, matchingEvent.payload);
              stepResult.status = 'PASS';
              stepResult.eventDetails = { 
                event: matchingEvent.payload?.event, 
                payload: matchingEvent.payload, 
                clickedElement: clickedElementInfo 
              };
              stepResult.matchedEvent = matchingEvent.payload;
            } else {
              // No match → Check for soft PASS (gtm.click / navigation / submenu)
              const soft = await isSoftPass(existingPage, selector, allowedHosts);
              if (soft) {
                console.log(`✅ PASS (soft): gtm.click / nav interna / submenu aperto`);
                stepResult.status = 'PASS';
                stepResult.eventDetails = { softPass: true, clickedElement: clickedElementInfo };
              } else {
                // Real FAIL - log what we found
                const capturedEventNames = capturedEvents.map((e: any) => e.payload?.event).filter(Boolean);
                
                console.log('🔍 DEBUG: Captured events:', capturedEventNames);
                console.log('🔍 DEBUG: Looking for subset:', JSON.stringify(subset, null, 2));
                console.log('🔍 DEBUG: Captured event payloads:');
                capturedEvents.forEach((e: any, idx: number) => {
                  if (e.payload?.event && e.payload.event !== 'gtm.js' && e.payload.event !== 'gtm.dom') {
                    console.log(`  Event ${idx}:`, JSON.stringify(e.payload, null, 2));
                  }
                });
                
                stepResult.error = `Expected event with subset ${JSON.stringify(subset)}, captured events: [${capturedEventNames.join(', ')}]`;
                stepResult.capturedEvents = capturedEvents.slice(0, 10).map((e: any) => e.payload);
                console.log(`❌ ${stepResult.error}`);
              }
            }
          }
        } catch (error: any) {
          stepResult.error = error.message;
          console.error(`❌ Step ${globalStepIndex + 1} failed:`, error.message);
        }
        
        stepResults.push(stepResult);
        console.log(`===== STEP ${globalStepIndex + 1} RESULT: ${stepResult.status} =====`);
        }
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
      const runResult = await runner.runTests(testSpecForRunner, {
        ...options,
        reuseBrowser: browserInstance,
        reusePage: existingPage,
      });
      
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

async function runScenarioFlow(params: {
  requestId: string;
  validatedDSL: TestSpec;
  options: RunOptions;
  moduleId?: ModuleId | null;
  scenario?: ModuleScenario;
  eventDefinition?: ModuleEventDefinition;
  cmpSelector?: string | null;
}): Promise<any> {
  const { requestId, validatedDSL, options, moduleId, scenario, eventDefinition, cmpSelector } =
    params;

  console.log('===== SCENARIO FLOW START =====');

  const scenarioSpec = normalizeScenarioSpec(validatedDSL, validatedDSL.site, cmpSelector);
  const flatSteps: Array<{
    section: string;
    testIndex: number;
    step: Step;
    stepIndex: number;
  }> = [];

  (scenarioSpec.tests || []).forEach((test, testIndex) => {
    (test.steps || []).forEach((step, stepIndex) => {
      flatSteps.push({
        section: test.section || `Sezione ${testIndex + 1}`,
        testIndex,
        step,
        stepIndex,
      });
    });
  });

  console.log(
    '[scenario] Normalized spec summary:',
    JSON.stringify(
      flatSteps.map(item => ({ section: item.section, action: item.step.action })),
      null,
      0
    )
  );

  const capturedEvents: Array<{ timestamp: number; payload: any }> = [];
  const stepResults: TestResult[] = [];
  let browser: PuppeteerBrowser | null = null;
  let page: PuppeteerPage | null = null;

  const stepTimeoutMs = options.timeout ?? SSD_DEFAULTS.timeout.step;
  const navigationTimeoutMs = options.navTimeoutMs ?? SSD_DEFAULTS.timeout.navigation;
  const postActionDelayMs = Number.parseInt(process.env.SSD_SCENARIO_DELAY_MS || '1500', 10);
  const extraPostRunDelayMs = Number.parseInt(process.env.SSD_SCENARIO_POST_DELAY_MS || '2000', 10);

  let flowStatus: 'PASS' | 'FAIL' | 'WARNING' | 'ERROR' = 'PASS';
  let flowError: string | null = null;

  try {
    browser = await puppeteer.launch({
      headless: options.headless !== false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
      ],
    });

    page = await browser.newPage();
    // Manual delay helper while we work around missing waitForTimeout
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
    );
    await page.setExtraHTTPHeaders({
      'accept-language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
    });
    await page.emulateMediaType('screen');
    await installScenarioDataLayerHook(page, capturedEvents);

    for (const item of flatSteps) {
      const { step, section } = item;
      const stepStart = Date.now();
      const baselineEventIndex = capturedEvents.length;
      let stepStatus: 'PASS' | 'FAIL' = 'PASS';
      let stepError: string | null = null;

      console.log(
        `[scenario] Executing step t${item.testIndex}#${item.stepIndex} action=${step.action}`
      );

      try {
        if (step.action === 'navigate') {
          const targetUrl =
            (step.target?.kind === 'href' && typeof step.target.value === 'string'
              ? step.target.value
              : scenarioSpec.site) || scenarioSpec.site;
          if (!targetUrl) {
            throw new Error('Missing target URL for navigation step');
          }
          await page.goto(targetUrl, {
            waitUntil: 'networkidle2',
            timeout: navigationTimeoutMs,
          });
        } else if (step.action === 'click') {
          if (!step.target || step.target.kind !== 'selector') {
            throw new Error('Click step requires a CSS selector target');
          }
          const selector = step.target.value;
          if (!selector || selector.trim().length === 0) {
            throw new Error('Click step selector is empty');
          }
          await page.waitForSelector(selector, { timeout: stepTimeoutMs, visible: true });
          await page.click(selector);
          await page
            .waitForNetworkIdle({ idleTime: 500, timeout: 5000 })
            .catch(() => undefined);
        } else if (step.action === 'wait_for_selector') {
          if (!step.target || step.target.kind !== 'selector') {
            throw new Error('wait_for_selector requires a CSS selector target');
          }
          const selector = step.target.value;
          if (!selector || selector.trim().length === 0) {
            throw new Error('wait_for_selector selector is empty');
          }
          await page.waitForSelector(selector, { timeout: stepTimeoutMs, visible: true });
        } else if (step.action === 'wait_for_text') {
          if (!step.target || !step.target.value) {
            throw new Error('wait_for_text requires a target value');
          }
          const text = step.target.value;
          await page.waitForFunction(
            (value: string) => document.body && document.body.innerText.includes(value),
            { timeout: stepTimeoutMs },
            text
          );
        } else {
          console.warn(`[scenario] Unsupported step action "${step.action}" – skipping`);
        }

        if (typeof step.delayAfterMs === 'number' && step.delayAfterMs > 0) {
          await sleep(step.delayAfterMs);
        } else if (postActionDelayMs > 0) {
          await sleep(postActionDelayMs);
        }
      } catch (error) {
        stepStatus = 'FAIL';
        stepError = error instanceof Error ? error.message : 'Errore sconosciuto';
        flowStatus = 'FAIL';
        if (!flowError) {
          flowError = stepError;
        }
        console.error(`[scenario] Step failed: ${stepError}`);
      }

      let screenshotB64 = '';
      if (page) {
        try {
          screenshotB64 = await page.screenshot({ encoding: 'base64', fullPage: true });
        } catch (screenshotError) {
          console.warn('[scenario] Unable to capture screenshot:', screenshotError);
        }
      }

      const stepEnd = Date.now();
      const newEvents = capturedEvents.slice(baselineEventIndex);

      stepResults.push({
        section,
        stepIndex: item.stepIndex,
        description: step.description,
        status: stepStatus,
        reasons: stepError ? [stepError] : undefined,
        evidence: {
          screenshotPathOrB64: screenshotB64,
          dataLayerEvents: newEvents,
          trackingHits: [],
        },
        timings: {
          startTime: stepStart,
          endTime: stepEnd,
          duration: stepEnd - stepStart,
        },
        action: step.action,
        target: step.target,
        value: step.value,
      } as TestResult);

      if (stepStatus === 'FAIL') {
        console.warn('[scenario] Stopping execution due to failed step');
        break;
      }
    }

    if (extraPostRunDelayMs > 0) {
      await sleep(extraPostRunDelayMs);
    }

    const validation = await validateScenarioDataLayer({
      scenario: scenario ?? null,
      eventDefinition: eventDefinition ?? null,
      capturedEvents,
    });

    if (validation) {
      if (validation.status === 'FAIL') {
        flowStatus = 'FAIL';
      } else if (validation.status === 'ERROR') {
        flowStatus = 'ERROR';
      } else if (validation.status === 'WARNING' && flowStatus === 'PASS') {
        flowStatus = 'WARNING';
      }
    }

    const summary = {
      steps: stepResults.length,
      passed: stepResults.filter(step => step.status === 'PASS').length,
      failed: stepResults.filter(step => step.status === 'FAIL').length,
      duration:
        stepResults.length > 0
          ? stepResults[stepResults.length - 1].timings.endTime - stepResults[0].timings.startTime
          : 0,
      consentProfiles: Array.isArray(scenarioSpec.consent) ? scenarioSpec.consent : ['accept'],
    };

    let htmlPath: string | null = null;
    try {
      const html = await page.content();
      const tempHtmlDir = join(process.cwd(), 'temp-html');
      await fs.mkdir(tempHtmlDir, { recursive: true });
      htmlPath = join(tempHtmlDir, `${requestId}.html`);
      await fs.writeFile(htmlPath, html, 'utf8');
      console.log(`✓ Scenario HTML snapshot saved to ${htmlPath}`);
    } catch (snapshotError) {
      console.warn('⚠️ Unable to save scenario HTML snapshot:', snapshotError);
    }

    const scenarioPayload = {
      status: flowStatus,
      steps: stepResults,
      summary,
      duration: summary.duration,
      spec: scenarioSpec,
      source: 'scenario',
      events: capturedEvents,
      validation,
      expectedPayload:
        scenario?.expectedPayload ??
        eventDefinition?.expectationTemplate?.payloadTemplate ??
        null,
      scenarioId: scenario?.id ?? scenarioSpec.meta?.scenarioId ?? null,
      scenarioName: scenario?.name ?? scenarioSpec.meta?.scenarioName ?? null,
      error: flowError,
    };

    console.log('===== SCENARIO FLOW COMPLETED =====');
    console.log(`Scenario status: ${flowStatus}`);

    return {
      requestId,
      url: scenarioSpec.site,
      module: {
        id: moduleId ?? null,
        source: 'scenario',
      },
      artifacts: {
        htmlFile: htmlPath,
        screenshotsFolder: SSD_DEFAULTS.path.screenshots,
      },
      scenario: scenarioPayload,
      summary,
      challenge: null,
      cookie: null,
      pdf: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Errore sconosciuto';
    console.error('[scenario] Fatal error during scenario flow:', error);
    flowStatus = 'ERROR';
    flowError = message;

    return {
      requestId,
      url: scenarioSpec.site,
      module: {
        id: moduleId ?? null,
        source: 'scenario',
      },
      scenario: {
        status: 'ERROR',
        steps: stepResults,
        summary: {
          steps: stepResults.length,
          passed: stepResults.filter(step => step.status === 'PASS').length,
          failed: stepResults.filter(step => step.status === 'FAIL').length,
          duration: 0,
          consentProfiles: Array.isArray(scenarioSpec.consent)
            ? scenarioSpec.consent
            : ['accept'],
        },
        duration: 0,
        spec: scenarioSpec,
        source: 'scenario',
        events: capturedEvents,
        validation: null,
        expectedPayload:
          scenario?.expectedPayload ??
          eventDefinition?.expectationTemplate?.payloadTemplate ??
          null,
        error: message,
      },
      summary: {
        steps: stepResults.length,
        passed: stepResults.filter(step => step.status === 'PASS').length,
        failed: stepResults.filter(step => step.status === 'FAIL').length,
        duration: 0,
        consentProfiles: Array.isArray(scenarioSpec.consent)
          ? scenarioSpec.consent
          : ['accept'],
      },
      challenge: null,
      cookie: null,
      pdf: null,
    };
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
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
      
      const stepResult: any = {
        step: i + 1,
        description: step.description,
        action: step.action,
        status: 'FAIL',
        error: null as string | null,
        eventDetails: null
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
              (result as any).cookieBtnOuterHTML = await page.$eval(selector, (el: any) => el.outerHTML);
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
                  } catch (e: any) {
                    console.log('XPath search failed:', e instanceof Error ? e.message : String(e));
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
          } catch (selectorError: any) {
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

  // 1. Static CMP hints
  let acceptSelector: string | null = detectCMPAcceptSelector(cookieBanner);

  // 2. LLM suggestion using real banner HTML
  if (!acceptSelector && consentLLMService && cookieBanner?.html) {
    try {
      console.log('🤖 Requesting CMP selectors from ConsentLLMService using banner HTML snippet...');
      const llmSelectors = await consentLLMService.suggestSelectorsFromHtml({
        pageUrl: siteUrl,
        html: cookieBanner.html,
        languageHints: cookieBanner.languageHints ?? [],
      });
      console.log('🤖 LLM selector suggestion:', llmSelectors);

      if (llmSelectors?.acceptSelector) {
        acceptSelector = llmSelectors.acceptSelector;
      } else if (llmSelectors?.bannerSelector) {
        acceptSelector = `${llmSelectors.bannerSelector} button`;
      }
    } catch (error) {
      console.error('❌ Failed to get selectors from ConsentLLMService:', error);
    }
  }

  // 3. Fallback prompt (legacy)
  if (!acceptSelector) {
    const selectorPrompt = `Identifica il selettore CSS del pulsante per accettare tutti i cookie nella CMP mostrata quando si visita il sito ${siteUrl}. ` +
      `Rispondi solo con il selettore, senza testo aggiuntivo o spiegazioni.`;
    
    console.log('====================================');
    console.log('🤖 PROMPT INVIATO AD OPENAI (fallback selettore):');
    console.log(selectorPrompt);
    console.log('====================================');
    
    try {
      const selectorRequestBody: Record<string, unknown> = {
        model: config.openaiModel,
        messages: [
          {
            role: 'user',
            content: selectorPrompt
          }
        ],
        max_tokens: 100,
        temperature: modelSupportsCustomTemperature(config.openaiModel) ? 0.1 : undefined,
      };

      const selectorResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(selectorRequestBody)
      });

      if (selectorResponse.ok) {
        const selectorData = await selectorResponse.json() as any;
        const rawContent = selectorData.choices[0]?.message?.content?.trim();

        console.log('====================================');
        console.log('🤖 RISPOSTA COMPLETA DA OPENAI (fallback selettore):');
        console.log('Raw content:', rawContent);
        console.log('Model:', selectorData.model);
        console.log('Finish reason:', selectorData.choices[0]?.finish_reason);
        console.log('====================================');

        if (rawContent) {
          let cleaned = rawContent;
          if (cleaned.startsWith('```')) {
            cleaned = cleaned.replace(/^```[a-z]*\s*/, '').replace(/\s*```$/, '').trim();
            console.log('🧹 Cleaned selector (removed markdown):', cleaned);
          }
          acceptSelector = cleaned;
        }
      } else {
        console.error('❌ OpenAI response not OK:', selectorResponse.status, selectorResponse.statusText);
      }
    } catch (error) {
      console.error('❌ Error calling OpenAI fallback for selector:', error);
    }
  }

  // 4. Final fallback heuristic
  if (!acceptSelector) {
    acceptSelector = 'button[id*="accept" i], button[aria-label*="accept" i], [data-testid*="accept" i]';
  }

  const hostname = (() => {
    try {
      return new URL(siteUrl).hostname;
    } catch {
      return siteUrl;
    }
  })();

  const allowedHosts = Array.from(new Set([
    hostname,
    hostname.startsWith('www.') ? hostname.replace(/^www\./, '') : `www.${hostname}`,
  ])).filter(Boolean);

  const bannerSelector = cookieBanner?.selectors?.[0] || null;

  const testSpec = {
    site: siteUrl,
    allowed_hosts: allowedHosts,
    consent: ['accept'] as ('accept' | 'reject')[],
    tests: [
      {
        section: 'Cookie Consent Acceptance',
        steps: [
          {
            description: 'Navigate to the website',
            action: 'navigate',
            target: {
              kind: 'href',
              value: siteUrl,
            },
            expect: [
              {
                type: 'navigation',
                url_contains: hostname,
              },
            ],
          },
          {
            description: 'Click Accept All Cookies button',
            action: 'click',
            target: {
              kind: 'selector',
              value: acceptSelector,
            },
            expect: [
              bannerSelector
                ? {
                    type: 'invisible',
                    selector: bannerSelector,
                  }
                : {
                    type: 'sleep',
                    durationMs: 1000,
                  },
            ].filter(Boolean),
          },
        ],
      },
    ],
  };

  console.log('===== COOKIE CONSENT TEST SPEC (local generation) =====');
  console.log(JSON.stringify(testSpec, null, 2));
  console.log('=======================================================');

  return testSpec;
}

function detectCMPAcceptSelector(cookieBanner: any): string | null {
  if (!cookieBanner) return null;

  const selectors: string[] = Array.isArray(cookieBanner.selectors) ? cookieBanner.selectors : [];
  const html: string = typeof cookieBanner.html === 'string' ? cookieBanner.html : '';
  const text: string = typeof cookieBanner.text === 'string' ? cookieBanner.text : '';

  const matches = (pattern: RegExp) =>
    pattern.test(html) || pattern.test(text) || selectors.some(sel => pattern.test(sel));

  if (matches(/onetrust/i)) return '#onetrust-accept-btn-handler';
  if (matches(/CybotCookiebotDialogBody/i) || matches(/cookiebot/i)) return '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll';
  if (matches(/didomi/i)) return 'button[data-qa="consent-accept-all"]';
  if (matches(/usercentrics/i)) return 'button[data-testid="uc-accept-all-button"]';
  if (matches(/trustarc/i)) return '#truste-consent-button';
  if (matches(/cookieyes/i) || matches(/cky-btn/i)) return '.cky-btn-accept';
  if (matches(/complianz/i)) return '.cmplz-accept';
  if (matches(/cookiebot-[\w-]*accept/i)) return '#CybotCookiebotDialogBodyButtonAccept';

  return null;
}

type LocatedSelector = {
  elementHandle: any;
  frame: any;
  context: 'page' | 'frame' | 'shadow';
};

async function waitForSelectorInPageOrFrames(page: any, selector: string, timeoutMs = 15000): Promise<LocatedSelector | null> {
  const start = Date.now();
  const pollTimeout = 600;

  while (Date.now() - start < timeoutMs) {
    const elapsed = Date.now() - start;
    const remaining = Math.max(timeoutMs - elapsed, 100);
    const attemptTimeout = Math.min(pollTimeout, remaining);

    const pageHandle = await tryFindSelectorInFrame(page, selector, attemptTimeout);
    if (pageHandle) {
      return { frame: page, elementHandle: pageHandle, context: 'page' };
    }

    const frames = page.frames();
    for (const frame of frames) {
      if (frame === page.mainFrame()) continue;
      const frameHandle = await tryFindSelectorInFrame(frame, selector, attemptTimeout);
      if (frameHandle) {
        return { frame, elementHandle: frameHandle, context: 'frame' };
      }
    }

    const shadowHandle = await findSelectorInShadowRoots(page, selector);
    if (shadowHandle) {
      return { frame: page, elementHandle: shadowHandle, context: 'shadow' };
    }

    await new Promise(resolve => setTimeout(resolve, 150));
  }

  return null;
}

async function tryFindSelectorInFrame(frame: any, selector: string, timeout: number) {
  try {
    const visibleHandle = await frame.waitForSelector(selector, { timeout, visible: true });
    if (visibleHandle) {
      return visibleHandle;
    }
  } catch {
    // Ignore and fall back to non-visible lookup
  }

  try {
    const handle = await frame.waitForSelector(selector, { timeout });
    if (!handle) return null;

    const isVisible = await isElementVisible(handle);
    if (isVisible) {
      return handle;
    }

    const diagnostic = await handle.evaluate((el: any) => {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return {
        display: style?.display,
        visibility: style?.visibility,
        opacity: style?.opacity,
        width: rect?.width,
        height: rect?.height,
      };
    }).catch(() => null);

    console.log(`[waitForSelectorInPageOrFrames] Selector ${selector} found but not visible yet:`, diagnostic);
    await handle.dispose();
  } catch {
    // Ignore and continue
  }

  return null;
}

async function isElementVisible(handle: any): Promise<boolean> {
  try {
    return await handle.evaluate((el: any) => {
      if (!el || !(el instanceof Element)) return false;
      const style = window.getComputedStyle(el);
      if (!style) return false;
      if (style.visibility === 'hidden' || style.display === 'none') return false;
      const opacity = parseFloat(style.opacity ?? '1');
      if (Number.isNaN(opacity) || opacity <= 0) return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
  } catch (error) {
    console.log('[waitForSelectorInPageOrFrames] Failed to evaluate visibility:', (error as Error).message);
    return false;
  }
}

async function findSelectorInShadowRoots(page: any, selector: string) {
  const searchFn = new Function(
    'sel',
    `
      const visited = new WeakSet();
      const stack = [document];

      while (stack.length > 0) {
        const root = stack.pop();
        if (!root || visited.has(root)) {
          continue;
        }
        visited.add(root);

        if (typeof root.querySelector === 'function') {
          const direct = root.querySelector(sel);
          if (direct) {
            return direct;
          }
        }

        if (typeof root.querySelectorAll === 'function') {
          const elements = root.querySelectorAll('*');
          for (let i = 0; i < elements.length; i++) {
            const el = elements[i];
            if (el && el.shadowRoot) {
              stack.push(el.shadowRoot);
            }
          }
        }
      }

      return null;
    `
  ) as (sel: string) => Element | null;

  try {
    const handle = await page.evaluateHandle(searchFn, selector);
    const elementHandle = handle.asElement();
    if (!elementHandle) {
      await handle.dispose();
      return null;
    }
    await handle.dispose();

    const isVisible = await elementHandle.evaluate((el: HTMLElement) => {
      if (!el) return false;
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return (
        style &&
        style.visibility !== 'hidden' &&
        style.display !== 'none' &&
        rect.width > 0 &&
        rect.height > 0
      );
    });

    if (!isVisible) {
      await elementHandle.dispose();
      return null;
    }

    return elementHandle;
  } catch (error) {
    console.log(`Shadow DOM selector lookup error for ${selector}:`, (error as Error).message);
    return null;
  }
}


// ---------------------------------------------------------------------------
// Scenario & module configuration endpoints
// ---------------------------------------------------------------------------

function buildDefaultScenarioSteps(
  eventDefinition: ReturnType<typeof getModuleEventDefinition>
): ScenarioStep[] {
  if (!eventDefinition) return [];
  return eventDefinition.steps.map((step: any) => ({
    id: step.id,
    type: step.type,
    label: step.label,
    description: step.description,
    selector: undefined,
    value: undefined,
  }));
}

function sanitizeManualSteps(rawSteps: any[]): ScenarioStep[] {
  if (!Array.isArray(rawSteps)) return [];
  return rawSteps
    .filter(entry => entry && typeof entry === 'object')
    .map((entry, index) => {
      const selector = typeof entry.selector === 'string' ? entry.selector.trim() : '';
      const label =
        typeof entry.label === 'string' && entry.label.trim().length > 0
          ? entry.label.trim()
          : `Step ${index + 1}`;
      const id =
        typeof entry.id === 'string' && entry.id.trim().length > 0
          ? entry.id.trim()
          : `manual_${Date.now()}_${index}`;
      const delayAfterMs = typeof entry.delayAfterMs === 'number' ? entry.delayAfterMs : 10000;

      return {
        id,
        type: 'click',
        label,
        description: typeof entry.description === 'string' ? entry.description : undefined,
        selector: selector.length > 0 ? selector : undefined,
        value: undefined,
        delayAfterMs,
      };
    });
}

function tryParseLoosePayloadExpression(expression: string): any | null {
  const trimmed = expression.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    /* fall through to VM evaluation */
  }

  try {
    return vm.runInNewContext(`(${trimmed})`, {}, { timeout: 250 });
  } catch {
    return null;
  }
}

function coerceExpectedPayloadValue(payload: any): any {
  if (payload == null) return null;
  if (typeof payload === 'object') return payload;
  if (typeof payload !== 'string') return null;

  const expression = extractExpectedPayloadExpression(payload);
  if (!expression) return null;

  return tryParseLoosePayloadExpression(expression);
}

function normalizeManualExpectedPayload(payload: any): any {
  const value = coerceExpectedPayloadValue(payload);
  if (value == null) return null;

  if (Array.isArray(value)) {
    return value.map(item => normalizeManualExpectedPayload(item));
  }

  if (typeof value === 'object') {
    const normalized: Record<string, any> = {};
    for (const [key, nested] of Object.entries(value)) {
      if (key === 'event' && typeof nested === 'string') {
        normalized[key] = nested.trim();
      } else if (nested !== null && typeof nested === 'object') {
        normalized[key] = normalizeManualExpectedPayload(nested);
      } else {
        normalized[key] = '*';
      }
    }
    return normalized;
  }

  return '*';
}

function extractEventNameFromPayload(payload: any): string {
  const value = coerceExpectedPayloadValue(payload);
  if (value && typeof value === 'object' && typeof (value as any).event === 'string') {
    const eventName = (value as any).event.trim();
    return eventName;
  }
  return '';
}

function sanitizeTestSpecPlaceholders(spec: TestSpec): TestSpec {
  const cloned = JSON.parse(JSON.stringify(spec)) as TestSpec;
  cloned.tests = cloned.tests?.map(test => ({
    ...test,
    steps: (test.steps?.map(step => {
      const sanitizedStep: any = { ...step };

      if (typeof sanitizedStep.value === 'string') {
        const trimmedValue = sanitizedStep.value.trim();
        if (trimmedValue.length === 0) {
          delete sanitizedStep.value;
        } else {
          sanitizedStep.value = trimmedValue;
        }
      }

      if (typeof sanitizedStep.confidence !== 'number' || sanitizedStep.confidence <= 0 || sanitizedStep.confidence > 1) {
        delete sanitizedStep.confidence;
      }

      if (sanitizedStep.target) {
        const targetValue = sanitizedStep.target.value;
        if (typeof targetValue === 'string') {
          const trimmedTarget = targetValue.trim();
          if (trimmedTarget.length === 0) {
            delete sanitizedStep.target;
          } else {
            sanitizedStep.target.value = trimmedTarget;
          }
        }
      }

      if (sanitizedStep.expect) {
        sanitizedStep.expect = sanitizedStep.expect
          .map((expectation: any) => {
            const sanitizedExpectation: any = { ...expectation };
            if (sanitizedExpectation.params_subset) {
              sanitizedExpectation.params_subset = normalizeManualExpectedPayload(sanitizedExpectation.params_subset);
            }
            return sanitizedExpectation;
          })
          .filter((expectation: any) => expectation != null);

        if (sanitizedStep.expect.length === 0) {
          delete sanitizedStep.expect;
        }
      }

      return sanitizedStep;
    })) ?? [],
  })) ?? [];
  return cloned;
}

function ensureCookieStep(spec: TestSpec, cmpSelector?: string | null): void {
  const selector = typeof cmpSelector === 'string' ? cmpSelector.trim() : '';
  if (!selector) {
    return;
  }

  if (!spec.tests || spec.tests.length === 0) {
    spec.tests = [
      {
        section: 'Scenario DSL',
        steps: [],
      },
    ];
  }

  const firstTest = spec.tests[0];
  if (!Array.isArray(firstTest.steps)) {
    firstTest.steps = [];
  }

  const alreadyExists = firstTest.steps.some(
    step => step.action === 'click' && step.target?.value === selector
  );

  if (alreadyExists) {
    return;
  }

  const cookieStep: Step = {
    description: 'Accetta tutti i cookie',
    action: 'click',
    target: {
      kind: 'selector',
      value: selector,
    },
    severity: 'critical',
  };

  const navigateIndex = firstTest.steps.findIndex(step => step.action === 'navigate');
  if (navigateIndex >= 0) {
    firstTest.steps.splice(navigateIndex + 1, 0, cookieStep);
  } else {
    firstTest.steps.unshift(cookieStep);
  }
}

function ensureAllowedHosts(spec: TestSpec, siteUrl?: string): void {
  const hosts = new Set<string>(spec.allowed_hosts ?? []);
  const target = siteUrl || spec.site;
  try {
    const parsed = new URL(target);
    hosts.add(parsed.host);
    if (!parsed.host.startsWith('www.')) {
      hosts.add(`www.${parsed.host}`);
    }
  } catch {
    // ignore invalid URL
  }
  spec.allowed_hosts = Array.from(hosts);
}

function buildNavigationStep(url: string): Step {
  const expectedHost = (() => {
    try {
      return new URL(url).host;
    } catch {
      return url;
    }
  })();
  return {
    description: 'Vai al sito indicato',
    action: 'navigate',
    target: {
      kind: 'href',
      value: url,
    },
    expect: [
      {
        type: 'navigation',
        url_contains: expectedHost,
      },
    ],
    severity: 'critical',
  };
}

function ensureNavigationStep(spec: TestSpec, scenarioUrl?: string): void {
  if (!spec.tests || spec.tests.length === 0) {
    spec.tests = [
      {
        section: 'Scenario DSL',
        steps: [buildNavigationStep(scenarioUrl || spec.site)],
      },
    ];
    return;
  }

  const hasNavigateStep = spec.tests.some(test =>
    Array.isArray(test.steps) && test.steps.some(step => step.action === 'navigate')
  );

  if (!hasNavigateStep) {
    const firstTest = spec.tests[0];
    const steps = Array.isArray(firstTest.steps) ? firstTest.steps.slice() : [];
    steps.unshift(buildNavigationStep(scenarioUrl || spec.site));
    firstTest.steps = steps;
  }
}

function normalizeScenarioSpec(spec: TestSpec, siteUrl?: string, cmpSelector?: string | null): TestSpec {
  const sanitized = sanitizeTestSpecPlaceholders(spec);
  const normalizedSite = siteUrl || sanitized.site;
  if (!sanitized.site && normalizedSite) {
    sanitized.site = normalizedSite;
  }
  sanitized.tests =
    sanitized.tests
      ?.filter(test => Array.isArray(test.steps) && test.steps.length > 0)
      .map(test => ({
        ...test,
        steps: (test.steps ?? []).filter(step => step.action !== 'custom'),
      })) ?? [];
  ensureNavigationStep(sanitized, normalizedSite);
  ensureCookieStep(sanitized, cmpSelector);
  ensureAllowedHosts(sanitized, normalizedSite);
  if (!sanitized.consent || sanitized.consent.length === 0) {
    sanitized.consent = ['accept'];
  }
  return sanitized;
}

function buildManualScenarioTestSpec(moduleId: ModuleId, scenario: ModuleScenario) {
  const allowedHosts = new Set<string>();
  let host: string | null = null;
  try {
    const parsed = new URL(scenario.url);
    host = parsed.host;
    allowedHosts.add(parsed.host);
  } catch {
    /* ignore invalid URL */
  }

  const steps: any[] = [];

  const navigationStep: any = {
    description: 'Naviga alla pagina indicata',
    action: 'navigate',
    target: { kind: 'href', value: scenario.url },
  };
  if (host) {
    navigationStep.expect = [
      {
        type: 'navigation',
        url_contains: host,
      },
    ];
  }
  steps.push(navigationStep);

  const manualSteps = Array.isArray(scenario.steps)
    ? scenario.steps.filter(step => step.type === 'click' && typeof step.selector === 'string' && step.selector.trim().length > 0)
    : [];

  manualSteps.forEach((step, index) => {
    steps.push({
      description: step.label || `Click step ${index + 1}`,
      action: 'click',
      target: { kind: 'selector', value: step.selector!.trim() },
      delayAfterMs: typeof step.delayAfterMs === 'number' ? step.delayAfterMs : 10000,
    });
  });

  const rawEventName = extractEventNameFromPayload(scenario.expectedPayload);

  return {
    site: scenario.url,
    allowed_hosts: Array.from(allowedHosts),
    consent: ['accept'] as ('accept' | 'reject')[],
    tests: [
      {
        section: `Evento manuale: ${rawEventName || 'dataLayer'}`,
        steps,
      },
    ],
    meta: {
      model: 'module-scenario:manual',
      moduleId,
      tokens: { input: 0, output: 0 },
    },
  };
}

interface ScenarioCmpContext {
  selector: string;
  vendor?: string | null;
}

async function generateScenarioTestSpecForScenario(
  moduleDefinition: SSDModule,
  scenario: ModuleScenario,
  eventDefinition?: ModuleEventDefinition,
  cmpContext?: ScenarioCmpContext | null
): Promise<{ spec: TestSpec; meta: NonNullable<ModuleScenario['testSpecMeta']> }> {
  const generationTimestamp = new Date().toISOString();
  let fallbackReason: string | undefined;

  const cmpAcceptSelector =
    typeof cmpContext?.selector === 'string' && cmpContext.selector.trim().length > 0
      ? cmpContext.selector.trim()
      : null;
  let rawGeneratedSpec: TestSpec | null = null;
  let sanitizedGeneratedSpec: TestSpec | null = null;

  if (openaiService) {
    try {
      const llmInput: ScenarioSpecBuildInput = {
        moduleId: moduleDefinition.meta.id,
        moduleName: moduleDefinition.meta.title,
        moduleDescription: moduleDefinition.meta.description,
        targetUrl: scenario.url,
        cmp: cmpAcceptSelector
          ? {
              vendor: cmpContext?.vendor ?? undefined,
              acceptAllSelector: cmpAcceptSelector,
            }
          : undefined,
        scenarioName: scenario.name,
        eventId: scenario.eventId,
        steps: Array.isArray(scenario.steps)
          ? scenario.steps.map(step => ({
              id: step.id,
              type: step.type,
              label: step.label,
              selector: step.selector,
              description: step.description,
              value: step.value,
              delayAfterMs: step.delayAfterMs,
            }))
          : [],
        expectedPayload: null,
        expectationTemplate: null,
      };

      const response = await openaiService.buildScenarioTestSpec(llmInput);
      rawGeneratedSpec = response.dsl as TestSpec;
      ensureCookieStep(rawGeneratedSpec, cmpAcceptSelector);
      sanitizedGeneratedSpec = normalizeScenarioSpec(
        rawGeneratedSpec,
        scenario.url,
        cmpAcceptSelector
      );

      if (!sanitizedGeneratedSpec.meta) {
        sanitizedGeneratedSpec.meta = {
          model: `scenario-llm:${moduleDefinition.meta.id}`,
          moduleId: moduleDefinition.meta.id,
          scenarioId: scenario.id,
          scenarioName: scenario.name,
          tokens: response.meta.tokens,
        };
      } else {
        sanitizedGeneratedSpec.meta.model = sanitizedGeneratedSpec.meta.model || `scenario-llm:${moduleDefinition.meta.id}`;
        sanitizedGeneratedSpec.meta.moduleId = moduleDefinition.meta.id;
        sanitizedGeneratedSpec.meta.tokens = sanitizedGeneratedSpec.meta.tokens || response.meta.tokens;
        sanitizedGeneratedSpec.meta.scenarioId = scenario.id;
        sanitizedGeneratedSpec.meta.scenarioName = scenario.name;
      }

      const validated = validateTestSpec(sanitizedGeneratedSpec) as TestSpec;

      return {
        spec: validated,
        meta: {
          generatedAt: generationTimestamp,
          model: response.meta.model,
          tokens: response.meta.tokens,
          source: 'scenario-llm',
        },
      };
    } catch (error) {
      if (error instanceof SpecValidationError) {
        let debugPath: string | null = null;
        if (rawGeneratedSpec) {
          const debugDir = join(process.cwd(), 'temp-html', 'scenario-spec-debug');
          try {
            await fs.mkdir(debugDir, { recursive: true });
            debugPath = join(debugDir, `${scenario.id}-${Date.now()}.json`);
            const debugPayload = {
              moduleId: moduleDefinition.meta.id,
              scenarioId: scenario.id,
              scenarioName: scenario.name,
              rawSpec: rawGeneratedSpec,
              sanitizedSpec: sanitizedGeneratedSpec,
              validationError: {
                message: error.message,
                code: error.code,
                details: error.errors,
              },
            };
            await fs.writeFile(debugPath, JSON.stringify(debugPayload, null, 2), 'utf8');
          } catch (debugError) {
            console.warn('[ScenarioSpec] Unable to write LLM spec debug file:', debugError);
          }
        }
        fallbackReason = `[ScenarioSpec] LLM generation failed: ${error.message}${debugPath ? ` (debug: ${debugPath})` : ''}`;
      } else {
        const message = error instanceof Error ? error.message : 'Unknown error';
        fallbackReason = `[ScenarioSpec] LLM generation failed: ${message}`;
      }
      console.error(fallbackReason);
    }
  } else {
    fallbackReason = '[ScenarioSpec] OpenAI service not configured';
    console.warn(fallbackReason);
  }

  const fallbackSpec = eventDefinition
    ? eventDefinition.buildTestSpec({
        moduleId: moduleDefinition.meta.id,
        url: scenario.url,
        config: scenario.config ?? {},
        steps: scenario.steps ?? [],
      })
    : buildManualScenarioTestSpec(moduleDefinition.meta.id, scenario);

  ensureCookieStep(fallbackSpec, cmpAcceptSelector);
  const sanitizedFallback = normalizeScenarioSpec(
    fallbackSpec,
    scenario.url,
    cmpAcceptSelector
  );
  const validatedFallback = validateTestSpec(sanitizedFallback) as TestSpec;
  if (!validatedFallback.meta) {
    validatedFallback.meta = {
      model: eventDefinition ? 'module-definition' : 'manual-builder',
      moduleId: moduleDefinition.meta.id,
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      tokens: { input: 0, output: 0 },
    };
  } else {
    validatedFallback.meta.model = validatedFallback.meta.model || (eventDefinition ? 'module-definition' : 'manual-builder');
    validatedFallback.meta.moduleId = moduleDefinition.meta.id;
    validatedFallback.meta.scenarioId = scenario.id;
    validatedFallback.meta.scenarioName = scenario.name;
    validatedFallback.meta.tokens = validatedFallback.meta.tokens || { input: 0, output: 0 };
  }

  return {
    spec: validatedFallback,
    meta: {
      generatedAt: generationTimestamp,
      model: eventDefinition ? 'module-definition' : 'manual-builder',
      tokens: { input: 0, output: 0 },
      source: eventDefinition ? 'module' : 'manual',
      ...(fallbackReason ? { error: fallbackReason } : {}),
    },
  };
}

function mergeScenarioSteps(
  eventDefinition: ReturnType<typeof getModuleEventDefinition>,
  rawSteps: any,
  config: Record<string, unknown>
): ScenarioStep[] {
  if (!eventDefinition) {
    if (!Array.isArray(rawSteps)) {
      return [];
    }
    return sanitizeManualSteps(rawSteps);
  }
  const defaults = buildDefaultScenarioSteps(eventDefinition).map(step => {
    const def = eventDefinition.steps.find((def: any) => def.id === step.id);
    if (def?.input?.id) {
      const preset = config?.[def.input.id];
      if (typeof preset === 'string') {
        return { ...step, selector: preset };
      }
    }
    return step;
  });

  if (!Array.isArray(rawSteps)) {
    return defaults;
  }

  const rawMap = new Map<string, any>(
    rawSteps
      .filter((entry: any) => entry && typeof entry.id === 'string')
      .map((entry: any) => [entry.id, entry])
  );

  return defaults.map(step => {
    const def = eventDefinition.steps.find((def: any) => def.id === step.id);
    const raw = rawMap.get(step.id);
    const selector =
      raw && typeof raw.selector === 'string'
        ? raw.selector
        : def?.input?.id && typeof config?.[def.input.id] === 'string'
        ? String(config[def.input.id])
        : step.selector;
    return {
      ...step,
      selector,
      value: raw && typeof raw.value === 'string' ? raw.value : step.value,
    };
  });
}

async function requireVerifiedCmpContext(moduleId: ModuleId): Promise<ScenarioCmpContext> {
  const settings = await getModuleSettings(moduleId);
  if (!settings?.cmp) {
    throw new ValidationError(
      'Configura la CMP del modulo prima di creare, modificare o eliminare scenari.',
      'CMP_NOT_CONFIGURED'
    );
  }

  if (settings.cmp.lastValidation.status !== 'ACCEPTED') {
    throw new ValidationError(
      'La CMP non è stata validata con successo. Completa la verifica per continuare.',
      'CMP_NOT_VERIFIED'
    );
  }

  return {
    selector: settings.cmp.selector,
    vendor: settings.cmp.vendor ?? null,
  };
}

function ensureConfigFromSteps(
  eventDefinition: ReturnType<typeof getModuleEventDefinition>,
  steps: ScenarioStep[],
  config: Record<string, unknown>
): Record<string, unknown> {
  if (!eventDefinition) return config;
  const updated = { ...config };
  eventDefinition.steps.forEach((stepDef: any) => {
    if (stepDef.input?.id) {
      const step = steps.find(s => s.id === stepDef.id);
      if (stepDef.input.type === 'selector') {
        const value = step?.selector ?? updated[stepDef.input.id];
        if (typeof value === 'string') {
          updated[stepDef.input.id] = value.trim();
        }
      } else {
        const value = step?.value ?? updated[stepDef.input.id];
        if (typeof value === 'string') {
          updated[stepDef.input.id] = value;
        }
      }
    }
  });
  return updated;
}

function parseExpectedPayload(
  eventDefinition: ReturnType<typeof getModuleEventDefinition>,
  rawPayload: any
) {
  const template = eventDefinition?.expectationTemplate?.payloadTemplate ?? null;
  const cloneTemplate = template ? JSON.parse(JSON.stringify(template)) : null;

  if (rawPayload == null) {
    return cloneTemplate;
  }

  if (typeof rawPayload === 'string') {
    const trimmed = rawPayload.trim();
    if (trimmed.length === 0) {
      return cloneTemplate;
    }

    const parsed = coerceExpectedPayloadValue(trimmed);

    if (parsed == null) {
      throw new ValidationError(
        'Invalid expected payload definition. Provide a JSON object or a dataLayer.push snippet.',
        'INVALID_EXPECTED_PAYLOAD'
      );
    }

    return parsed;
  }

  if (typeof rawPayload === 'object') {
    return rawPayload;
  }

  return cloneTemplate;
}

function ensureRequiredInputs(
  eventDefinition: ReturnType<typeof getModuleEventDefinition>,
  url: string,
  config: Record<string, unknown>,
  steps: ScenarioStep[]
) {
  if (!eventDefinition) {
    return [];
  }

  const missing: string[] = [];

  (eventDefinition.steps || []).forEach((stepDef: any) => {
    if (!stepDef.input?.required) return;
    const step = steps.find(s => s.id === stepDef.id);
    const value = step?.selector ?? step?.value;
    if (!value || (typeof value === 'string' && value.trim().length === 0)) {
      missing.push(stepDef.input.label || stepDef.input.id);
    }
  });

  return missing;
}

app.get('/api/modules', async (_req, res) => {
  try {
    const modules = await listAllModules();
    return res.json({ modules });
  } catch (error) {
    console.error('[ModuleAPI] Failed to list modules', error);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

app.post('/api/modules', async (req, res) => {
  try {
    const payload = req.body ?? {};
    const title = typeof payload.title === 'string' ? payload.title.trim() : '';
    if (!title) {
      return res.status(400).json({ error: 'INVALID_TITLE', message: 'Il nome del modulo è obbligatorio.' });
    }

    const description =
      typeof payload.description === 'string' && payload.description.trim().length > 0
        ? payload.description.trim()
        : 'Modulo personalizzato';

    const requestedId =
      typeof payload.id === 'string' && payload.id.trim().length > 0
        ? slugifyModuleId(payload.id)
        : slugifyModuleId(title);
    if (!requestedId) {
      return res.status(400).json({ error: 'INVALID_ID', message: 'Impossibile generare un ID per il modulo indicato.' });
    }

    const normalizedUrls = parseStringList(payload.defaultUrls)
      .map(normalizeModuleUrl)
      .filter((url): url is string => Boolean(url));
    if (normalizedUrls.length === 0) {
      return res.status(400).json({
        error: 'INVALID_URLS',
        message: 'Inserisci almeno un URL valido per il modulo.',
      });
    }

    let normalizedHosts = parseStringList(payload.supportedHosts)
      .map(value => normalizeHostCandidate(value))
      .filter((value): value is string => Boolean(value));
    if (normalizedHosts.length === 0) {
      const derivedHosts = normalizedUrls
        .map(url => {
          try {
            return new URL(url).host;
          } catch {
            return null;
          }
        })
        .filter((host): host is string => Boolean(host));
      normalizedHosts = Array.from(new Set(derivedHosts));
    }

    if (normalizedHosts.length === 0) {
      return res.status(400).json({
        error: 'INVALID_HOSTS',
        message: 'Indica almeno un dominio supportato o un URL valido per inferirlo.',
      });
    }

    const moduleDefinition: SSDModule = {
      meta: {
        id: requestedId,
        title,
        description,
        tags: parseStringList(payload.tags),
        accentColor: sanitizeHexColor(payload.accentColor),
        icon: coerceModuleIcon(payload.icon) ?? 'ShieldCheck',
      },
      supportedHosts: Array.from(new Set(normalizedHosts)),
      defaultUrls: normalizedUrls,
      configFields: Array.isArray(payload.configFields) ? payload.configFields : [],
      defaultConfig:
        typeof payload.defaultConfig === 'object' && payload.defaultConfig !== null ? payload.defaultConfig : {},
    };

    const created = await createModuleDefinition(moduleDefinition);
    return res.status(201).json({ module: created });
  } catch (error) {
    console.error('[ModuleAPI] Failed to create module', error);
    if (error instanceof Error && /already exists/i.test(error.message)) {
      return res.status(409).json({ error: 'MODULE_EXISTS', message: error.message });
    }
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

app.put('/api/modules/:moduleId', async (req, res) => {
  try {
    const moduleId = req.params.moduleId as ModuleId;
    const existing = await getModule(moduleId);
    if (!existing) {
      return res.status(404).json({ error: `Module '${moduleId}' not found` });
    }

    const payload = req.body ?? {};
    const nextTitle =
      typeof payload.title === 'string' && payload.title.trim().length > 0 ? payload.title.trim() : existing.meta.title;
    const nextDescription =
      typeof payload.description === 'string' && payload.description.trim().length > 0
        ? payload.description.trim()
        : existing.meta.description;

    let updatedHosts: string[] | undefined;
    if (payload.supportedHosts !== undefined) {
      const parsedHosts = parseStringList(payload.supportedHosts)
        .map(value => normalizeHostCandidate(value))
        .filter((value): value is string => Boolean(value));
      if (parsedHosts.length === 0) {
        return res.status(400).json({
          error: 'INVALID_HOSTS',
          message: 'Inserisci almeno un dominio valido.',
        });
      }
      updatedHosts = Array.from(new Set(parsedHosts));
    }

    let updatedUrls: string[] | undefined;
    if (payload.defaultUrls !== undefined) {
      const parsedUrls = parseStringList(payload.defaultUrls)
        .map(normalizeModuleUrl)
        .filter((url): url is string => Boolean(url));
      if (parsedUrls.length === 0) {
        return res.status(400).json({
          error: 'INVALID_URLS',
          message: 'Inserisci almeno un URL valido.',
        });
      }
      updatedUrls = parsedUrls;
    }

    const updatedModule: SSDModule = {
      ...existing,
      meta: {
        ...existing.meta,
        title: nextTitle,
        description: nextDescription,
        tags: payload.tags !== undefined ? parseStringList(payload.tags) : existing.meta.tags,
        accentColor: payload.accentColor !== undefined ? sanitizeHexColor(payload.accentColor) : existing.meta.accentColor,
        icon: payload.icon !== undefined ? coerceModuleIcon(payload.icon) ?? existing.meta.icon : existing.meta.icon,
      },
      supportedHosts: updatedHosts ?? existing.supportedHosts,
      defaultUrls: updatedUrls ?? existing.defaultUrls,
      configFields: Array.isArray(payload.configFields) ? payload.configFields : existing.configFields,
      defaultConfig:
        typeof payload.defaultConfig === 'object' && payload.defaultConfig !== null
          ? payload.defaultConfig
          : existing.defaultConfig,
    };

    const stored = await updateModuleDefinition(moduleId, updatedModule);
    return res.json({ module: stored });
  } catch (error) {
    console.error('[ModuleAPI] Failed to update module', error);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

app.delete('/api/modules/:moduleId', async (req, res) => {
  try {
    const moduleId = req.params.moduleId as ModuleId;
    const deleted = await deleteModuleDefinition(moduleId);
    if (!deleted) {
      return res.status(404).json({ error: `Module '${moduleId}' not found` });
    }
    await Promise.all([deleteModuleSettings(moduleId), deleteModuleScenarios(moduleId)]);
    return res.status(204).send();
  } catch (error) {
    console.error('[ModuleAPI] Failed to delete module', error);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

app.get('/api/modules/:moduleId/events', async (req, res) => {
  try {
    const moduleId = req.params.moduleId as ModuleId;
    const moduleDefinition = await getModule(moduleId);
    if (!moduleDefinition) {
      return res.status(404).json({ error: `Module '${moduleId}' not found` });
    }
    const events = listModuleEventDefinitions(moduleId);
    return res.json({ moduleId, events });
  } catch (error) {
    console.error('[ScenarioAPI] Failed to list module events', error);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

app.get('/api/modules/:moduleId/scenarios', async (req, res) => {
  try {
    const moduleId = req.params.moduleId as ModuleId;
    const moduleDefinition = await getModule(moduleId);
    if (!moduleDefinition) {
      return res.status(404).json({ error: `Module '${moduleId}' not found` });
    }
    const scenarios = await listModuleScenarios(moduleId);
    return res.json({ moduleId, scenarios });
  } catch (error) {
    console.error('[ScenarioAPI] Failed to list scenarios', error);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

app.post('/api/modules/:moduleId/cmp/validate', async (req, res) => {
  try {
    const moduleId = req.params.moduleId as ModuleId;
    const moduleDefinition = await getModule(moduleId);
    if (!moduleDefinition) {
      return res.status(404).json({ error: `Module '${moduleId}' not found` });
    }

    const selector =
      typeof req.body?.selector === 'string' ? req.body.selector.trim() : '';
    if (!selector) {
      return res.status(400).json({
        error: 'INVALID_SELECTOR',
        message: 'Fornisci il selettore della CTA per accettare i cookie.',
      });
    }

    if (!openaiService) {
      return res.status(503).json({
        error: 'OPENAI_NOT_CONFIGURED',
        message: 'Configura OPENAI_API_KEY per validare automaticamente la CMP.',
      });
    }

    let rawTestUrl = typeof req.body?.testUrl === 'string' ? req.body.testUrl.trim() : '';
    if (rawTestUrl && !/^https?:\/\//i.test(rawTestUrl)) {
      rawTestUrl = `https://${rawTestUrl.replace(/^\/+/, '')}`;
    }

    const fallbackUrl = resolveModuleDefaultUrl(moduleDefinition);
    const testUrl = rawTestUrl || fallbackUrl;
    if (!testUrl || !isValidUrl(testUrl)) {
      return res.status(400).json({
        error: 'INVALID_URL',
        message: 'Specifica un URL di test valido per verificare la CMP.',
      });
    }

    let host: string;
    try {
      host = new URL(testUrl).host;
    } catch {
      return res.status(400).json({
        error: 'INVALID_URL',
        message: 'Impossibile analizzare il dominio dell’URL indicato.',
      });
    }

    const cmpSpec: TestSpec = {
      site: testUrl,
      allowed_hosts: [host],
      consent: ['accept'] as ('accept' | 'reject')[],
      tests: [
        {
          section: 'cmp-validation',
          steps: [
            {
              description: 'Vai alla pagina del modulo',
              action: 'navigate',
              target: {
                kind: 'href',
                value: testUrl,
              },
              expect: [
                {
                  type: 'navigation',
                  url_contains: host,
                },
              ],
              severity: 'critical',
            },
            {
              description: 'Accetta tutti i cookie',
              action: 'click',
              target: {
                kind: 'selector',
                value: selector,
              },
              severity: 'critical',
            },
          ],
        },
      ],
      meta: {
        model: 'cmp-validation',
        moduleId,
        tokens: { input: 0, output: 0 },
      },
    };

    const runOptions: RunOptions = {
      headless: req.body?.headless !== false,
      consent: 'accept',
      timeout: config.runnerStepTimeoutMs,
      screenshotDir: 'screenshots',
      allowedHosts: [host],
      allowedTracking: config.puppeteerAllowedTracking,
      allowedCDNs: config.puppeteerAllowedCDNs,
    };

    const requestId = `cmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const scenarioResponse = await runScenarioFlow({
      requestId,
      validatedDSL: cmpSpec,
      options: runOptions,
      moduleId,
      cmpSelector: selector,
    });

    const capturedEvents = scenarioResponse?.scenario?.events ?? [];
    const evaluation = await openaiService.evaluateConsentValidation({
      site: testUrl,
      cmpVendor: typeof req.body?.vendor === 'string' ? req.body.vendor.trim() : moduleDefinition.meta.title,
      selector,
      capturedEvents,
    });

    const runnerStatus = scenarioResponse?.scenario?.status ?? 'ERROR';
    const runnerError = scenarioResponse?.scenario?.error ?? null;
    const finalStatus: CMPValidationStatus =
      runnerStatus === 'ERROR' || runnerStatus === 'FAIL'
        ? 'ERROR'
        : evaluation.status;
    const reasoning =
      runnerStatus === 'ERROR' || runnerStatus === 'FAIL'
        ? runnerError || 'Il runner non è riuscito a completare il test CMP.'
        : evaluation.reasoning;

    const cmpSettings: ModuleCMPSettings = {
      selector,
      vendor: typeof req.body?.vendor === 'string' && req.body.vendor.trim().length > 0 ? req.body.vendor.trim() : undefined,
      testUrl,
      validatedAt: new Date().toISOString(),
      lastValidation: {
        status: finalStatus,
        reasoning,
        executedAt: new Date().toISOString(),
        evidence: evaluation.evidence,
        eventsCaptured: capturedEvents.length,
        sampleEvents: capturedEvents.slice(-5).map((event: any) => event.payload),
      },
    };

    const savedSettings = await setModuleCmpSettings(moduleId, cmpSettings);

    return res.json({
      moduleId,
      settings: savedSettings,
      runner: {
        status: runnerStatus,
        error: runnerError,
      },
      validation: savedSettings.cmp?.lastValidation ?? null,
      scenario: scenarioResponse?.scenario ?? null,
    });
  } catch (error) {
    console.error('[CMP] Validation failed', error);
    if (error instanceof ValidationError) {
      return res.status(400).json({ error: error.code, message: error.message });
    }
    return res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'Unexpected error',
    });
  }
});

app.get('/api/modules/:moduleId/settings', async (req, res) => {
  try {
    const moduleId = req.params.moduleId as ModuleId;
    const moduleDefinition = await getModule(moduleId);
    if (!moduleDefinition) {
      return res.status(404).json({ error: `Module '${moduleId}' not found` });
    }
    const settings = await getModuleSettings(moduleId);
    return res.json({ moduleId, settings });
  } catch (error) {
    console.error('[ModuleSettings] Failed to load settings', error);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

app.post('/api/modules/:moduleId/scenarios', async (req, res) => {
  try {
    const moduleId = req.params.moduleId as ModuleId;
    const moduleDefinition = await getModule(moduleId);
    if (!moduleDefinition) {
      return res.status(404).json({ error: `Module '${moduleId}' not found` });
    }
    const cmpContext = await requireVerifiedCmpContext(moduleId);

    const { name, eventId, url, config = {}, steps, expectedPayload } = req.body ?? {};
    if (typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'INVALID_NAME', message: 'Scenario name is required.' });
    }
    if (typeof eventId !== 'string' || eventId.trim().length === 0) {
      return res.status(400).json({ error: 'INVALID_EVENT', message: 'eventId is required.' });
    }
    if (typeof url !== 'string' || url.trim().length === 0) {
      return res.status(400).json({ error: 'INVALID_URL', message: 'Scenario URL is required.' });
    }
    if (!isValidUrl(url)) {
      return res.status(400).json({ error: 'INVALID_URL', message: 'URL is not valid.' });
    }

    const eventDefinition = getModuleEventDefinition(moduleId, eventId);
    const normalizedConfig = typeof config === 'object' && config !== null ? { ...config } : {};
    const mergedSteps = mergeScenarioSteps(eventDefinition, steps, normalizedConfig);
    if (!eventDefinition) {
      const hasInvalidSelector = mergedSteps.some(step => !step.selector || step.selector.trim().length === 0);
      if (hasInvalidSelector) {
        return res.status(400).json({
          error: 'INVALID_STEPS',
          message: 'Ogni step clic deve includere un selettore CSS valido.',
        });
      }
    }
    const requiredMissing = ensureRequiredInputs(eventDefinition, url, normalizedConfig, mergedSteps);
    if (requiredMissing.length > 0) {
      return res.status(400).json({
        error: 'MISSING_FIELDS',
        message: `Missing required inputs: ${requiredMissing.join(', ')}`,
      });
    }

    const syncedConfig = ensureConfigFromSteps(eventDefinition, mergedSteps, normalizedConfig);
    const payload = parseExpectedPayload(eventDefinition, expectedPayload);

    const now = new Date().toISOString();
    const scenario: ModuleScenario = {
      id: randomUUID(),
      moduleId,
      name: name.trim(),
      eventId,
      url: url.trim(),
      config: syncedConfig,
      steps: mergedSteps,
      expectedPayload: payload,
      testSpec: null,
      testSpecMeta: null,
      createdAt: now,
      updatedAt: now,
    };

    const { spec: generatedSpec, meta: specMeta } = await generateScenarioTestSpecForScenario(
      moduleDefinition,
      scenario,
      eventDefinition,
      cmpContext
    );
    scenario.testSpec = generatedSpec;
    scenario.testSpecMeta = specMeta;

    const stored = await upsertModuleScenario(scenario);
    return res.status(201).json({ scenario: stored });
  } catch (error) {
    console.error('[ScenarioAPI] Failed to create scenario', error);
    if (error instanceof ValidationError) {
      return res.status(400).json({ error: error.code, message: error.message });
    }
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

app.put('/api/modules/:moduleId/scenarios/:scenarioId', async (req, res) => {
  try {
    const moduleId = req.params.moduleId as ModuleId;
    const scenarioId = req.params.scenarioId;
    if (typeof scenarioId !== 'string') {
      return res.status(400).json({ error: 'INVALID_ID', message: 'scenarioId is required.' });
    }

    const moduleDefinition = await getModule(moduleId);
    if (!moduleDefinition) {
      return res.status(404).json({ error: `Module '${moduleId}' not found` });
    }
    const cmpContext = await requireVerifiedCmpContext(moduleId);

    const existing = await getModuleScenario(moduleId, scenarioId);
    if (!existing) {
      return res.status(404).json({ error: 'SCENARIO_NOT_FOUND' });
    }

    const { name, eventId, url, config = {}, steps, expectedPayload } = req.body ?? {};

    const updatedEventId = typeof eventId === 'string' && eventId.trim().length > 0 ? eventId : existing.eventId;
    const updatedUrl = typeof url === 'string' && url.trim().length > 0 ? url.trim() : existing.url;
    if (!isValidUrl(updatedUrl)) {
      return res.status(400).json({ error: 'INVALID_URL', message: 'URL is not valid.' });
    }

    const eventDefinition = getModuleEventDefinition(moduleId, updatedEventId);
    const normalizedConfig = typeof config === 'object' && config !== null ? { ...config } : existing.config ?? {};
    const mergedSteps = mergeScenarioSteps(eventDefinition, steps ?? existing.steps, normalizedConfig);
    if (!eventDefinition) {
      const hasInvalidSelector = mergedSteps.some(step => !step.selector || step.selector.trim().length === 0);
      if (hasInvalidSelector) {
        return res.status(400).json({
          error: 'INVALID_STEPS',
          message: 'Ogni step clic deve includere un selettore CSS valido.',
        });
      }
    }
    const requiredMissing = ensureRequiredInputs(eventDefinition, updatedUrl, normalizedConfig, mergedSteps);
    if (requiredMissing.length > 0) {
      return res.status(400).json({
        error: 'MISSING_FIELDS',
        message: `Missing required inputs: ${requiredMissing.join(', ')}`,
      });
    }

    const syncedConfig = ensureConfigFromSteps(eventDefinition, mergedSteps, normalizedConfig);
    const payload = parseExpectedPayload(eventDefinition, expectedPayload ?? existing.expectedPayload);

    const updatedScenario: ModuleScenario = {
      ...existing,
      name: typeof name === 'string' && name.trim().length > 0 ? name.trim() : existing.name,
      eventId: updatedEventId,
      url: updatedUrl,
      config: syncedConfig,
      steps: mergedSteps,
      expectedPayload: payload,
      testSpec: existing.testSpec ?? null,
      testSpecMeta: existing.testSpecMeta ?? null,
      updatedAt: new Date().toISOString(),
    };

    const { spec: regeneratedSpec, meta: regeneratedMeta } = await generateScenarioTestSpecForScenario(
      moduleDefinition,
      updatedScenario,
      eventDefinition,
      cmpContext
    );
    updatedScenario.testSpec = regeneratedSpec;
    updatedScenario.testSpecMeta = regeneratedMeta;

    const stored = await upsertModuleScenario(updatedScenario);
    return res.json({ scenario: stored });
  } catch (error) {
    console.error('[ScenarioAPI] Failed to update scenario', error);
    if (error instanceof ValidationError) {
      return res.status(400).json({ error: error.code, message: error.message });
    }
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

app.delete('/api/modules/:moduleId/scenarios/:scenarioId', async (req, res) => {
  try {
    const moduleId = req.params.moduleId as ModuleId;
    const scenarioId = req.params.scenarioId;
    if (typeof scenarioId !== 'string') {
      return res.status(400).json({ error: 'INVALID_ID', message: 'scenarioId is required.' });
    }

    const moduleDefinition = await getModule(moduleId);
    if (!moduleDefinition) {
      return res.status(404).json({ error: `Module '${moduleId}' not found` });
    }

    const deleted = await deleteModuleScenario(moduleId, scenarioId);
    if (!deleted) {
      return res.status(404).json({ error: 'SCENARIO_NOT_FOUND' });
    }
    return res.status(204).send();
  } catch (error) {
    console.error('[ScenarioAPI] Failed to delete scenario', error);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

  app.post('/api/modules/:moduleId/scenarios/:scenarioId/build', async (req, res) => {
  try {
    const moduleId = req.params.moduleId as ModuleId;
    const scenarioId = req.params.scenarioId;
    if (typeof scenarioId !== 'string') {
      return res.status(400).json({ error: 'INVALID_ID', message: 'scenarioId is required.' });
    }

    const moduleDefinition = await getModule(moduleId);
    if (!moduleDefinition) {
      return res.status(404).json({ error: `Module '${moduleId}' not found` });
    }
    const cmpContext = await requireVerifiedCmpContext(moduleId);

    let scenario = await getModuleScenario(moduleId, scenarioId);
    if (!scenario) {
      return res.status(404).json({ error: 'SCENARIO_NOT_FOUND' });
    }

    const eventDefinition = getModuleEventDefinition(moduleId, scenario.eventId);

    let dsl: TestSpec | null = scenario.testSpec ?? null;
    let meta = scenario.testSpecMeta ?? null;
    const requiresRegeneration =
      !dsl || !meta || meta.source !== 'scenario-llm';

    if (requiresRegeneration) {
      const { spec, meta: generatedMeta } = await generateScenarioTestSpecForScenario(
        moduleDefinition,
        scenario,
        eventDefinition || undefined,
        cmpContext
      );
      dsl = spec;
      meta = generatedMeta;
      scenario = {
        ...scenario,
        testSpec: spec,
        testSpecMeta: generatedMeta,
        updatedAt: new Date().toISOString(),
      };
      await upsertModuleScenario(scenario);
    }

    return res.json({
      moduleId,
      scenarioId,
      dsl,
      meta,
    });
  } catch (error) {
    console.error('[ScenarioAPI] Failed to build scenario DSL', error);
    if (error instanceof ValidationError) {
      return res.status(400).json({ error: error.code, message: error.message });
    }
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

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
  } catch (err: any) {
    const httpError = toHttpError(err instanceof Error ? err : new Error(err?.message || 'Unknown error'));
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

    const rawModuleId = typeof req.body?.moduleId === 'string' ? req.body.moduleId.trim() : '';
    const moduleId = rawModuleId.length > 0 ? rawModuleId : null;
    let moduleConfig: Record<string, unknown> = {};
    if (typeof req.body?.moduleConfig === 'string' && req.body.moduleConfig.trim().length > 0) {
      try {
        moduleConfig = JSON.parse(req.body.moduleConfig);
      } catch (parseError) {
        console.warn(`[${correlationId}] Unable to parse moduleConfig JSON:`, parseError);
      }
    }

    const moduleDefinition = moduleId ? await getModule(moduleId) : undefined;
    console.log(`[${correlationId}] Module selection`, {
      moduleId,
    });

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

    let generatedDsl: any | null = null;
    let metaSource: 'openai' = 'openai';
    let openaiMeta: { model?: string; tokens?: any } | null = null;
    if (!config.openaiApiKey) {
      return sendError(res, 500, 'OPENAI_NOT_CONFIGURED', 'OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.');
    }

    if (!openaiService) {
      return sendError(res, 503, 'SERVICE_UNAVAILABLE', 'OpenAI service is not configured. Please set VITE_OPENAI_API_KEY environment variable.');
    }

    const openaiResponse = await Promise.race([
      openaiService.convertPDFToTestSpec(extractionResult.text, targetOrigin),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('OpenAI request timeout')), 60000)
      )
    ]);

    const rawInputUrl = String(req.body?.url ?? req.body?.site ?? '').trim();
    if (!rawInputUrl) {
      return res.status(400).json({
        error: 'Missing target URL',
        code: 'INVALID_URL'
      });
    }

    const dslFromLLM = (openaiResponse as any).dsl ?? {};
    generatedDsl = { ...dslFromLLM, site: targetOrigin };
    openaiMeta = (openaiResponse as any).meta ?? null;
    console.info('[SSD] validating DSL with site (LLM):', generatedDsl?.site);

    const validatedDSL = validateTestSpec(generatedDsl);
    const existingMeta = validatedDSL.meta ?? {};
    const metaModel = existingMeta.model ?? openaiMeta?.model ?? 'openai';
    const metaTokens = existingMeta.tokens ?? openaiMeta?.tokens ?? { input: 0, output: 0 };

    validatedDSL.meta = {
      ...existingMeta,
      model: metaModel,
      tokens: metaTokens,
    };
    if (moduleId) {
      validatedDSL.meta.moduleId = moduleId;
    }

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
        model: openaiMeta?.model ?? 'openai',
        tokens: openaiMeta?.tokens ?? { input: 0, output: 0 },
      },
      moduleId,
      moduleSource: metaSource,
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
    const scenarioIdFromBody =
      typeof req.body?.scenarioId === 'string' && req.body.scenarioId.trim().length > 0
        ? req.body.scenarioId.trim()
        : null;

    const rawModuleId = typeof req.body?.moduleId === 'string' ? req.body.moduleId.trim() : '';
    const moduleId = rawModuleId.length > 0 ? rawModuleId : null;
    const rawModuleSource = typeof req.body?.moduleSource === 'string' ? req.body.moduleSource.trim() : '';
    const allowedModuleSources: ModuleSource[] = ['manifest', 'openai', 'scenario'];
    const moduleSourceInitial = allowedModuleSources.includes(rawModuleSource as ModuleSource)
      ? (rawModuleSource as ModuleSource)
      : null;

    let inferredModuleId = moduleId;
    let inferredModuleSource = moduleSourceInitial;

    if (!inferredModuleId && typeof dsl?.meta?.moduleId === 'string') {
      inferredModuleId = dsl.meta.moduleId as ModuleId;
      console.log('🧠 Inferred moduleId from DSL meta.moduleId:', inferredModuleId);
      if (!inferredModuleSource) {
        inferredModuleSource = /^scenario-llm:/i.test(dsl?.meta?.model || '') ? 'scenario' : 'manifest';
      }
    }

    if (!inferredModuleId && typeof dsl?.meta?.model === 'string') {
      const match = /^module-manifest:([a-z0-9-_]+)/i.exec(dsl.meta.model);
      if (match && match[1]) {
        inferredModuleId = match[1] as ModuleId;
        console.log('🧠 Inferred moduleId from DSL meta:', inferredModuleId);
        if (!inferredModuleSource) {
          inferredModuleSource = 'manifest';
        }
      }
    }
    if (!inferredModuleSource && typeof dsl?.meta?.model === 'string' && /^scenario-llm:/i.test(dsl.meta.model)) {
      inferredModuleSource = 'scenario';
    }

    const finalModuleSource: ModuleSource = (inferredModuleSource || moduleSourceInitial || 'scenario') as ModuleSource;
    const moduleDefinition = inferredModuleId ? await getModule(inferredModuleId) : undefined;
    const moduleSettings = inferredModuleId ? await getModuleSettings(inferredModuleId) : null;
    const useManifestDsl = finalModuleSource === 'manifest';
    const scenarioIdFromDsl =
      typeof dsl?.meta?.scenarioId === 'string' && dsl.meta.scenarioId.trim().length > 0
        ? dsl.meta.scenarioId.trim()
        : null;
    const finalScenarioId = scenarioIdFromBody ?? scenarioIdFromDsl ?? null;

    console.log('🧩 Module context:', {
      moduleId: inferredModuleId,
      moduleSource: finalModuleSource,
      cmpConfigured: moduleSettings?.cmp?.lastValidation?.status === 'ACCEPTED',
      useManifestDsl,
    });

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

    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log(`[${requestId}] Starting SSD test execution for ${validatedDSL.site}`);
    console.log(`[${requestId}] Options:`, options);

    if (finalModuleSource === 'scenario') {
      let scenarioEntry: ModuleScenario | null = null;
      let scenarioEventDefinition: ModuleEventDefinition | null = null;
      if (inferredModuleId && finalScenarioId) {
        try {
          scenarioEntry = (await getModuleScenario(inferredModuleId, finalScenarioId)) ?? null;
          if (!scenarioEntry) {
            console.warn(`[ScenarioFlow] Scenario '${finalScenarioId}' not found for module '${inferredModuleId}'`);
          } else {
            scenarioEventDefinition = getModuleEventDefinition(inferredModuleId, scenarioEntry.eventId) ?? null;
          }
        } catch (scenarioLookupError) {
          console.warn(
            `[ScenarioFlow] Unable to load scenario '${finalScenarioId}' for module '${inferredModuleId}':`,
            scenarioLookupError
          );
        }
      }

      const scenarioResponse = await runScenarioFlow({
        requestId,
        validatedDSL,
        options,
        moduleId: inferredModuleId,
        scenario: scenarioEntry ?? undefined,
        eventDefinition: scenarioEventDefinition ?? undefined,
        cmpSelector: moduleSettings?.cmp?.selector ?? null,
      });
      res.json(scenarioResponse);
      return;
    }

    // ============================================================================
    // STEP 2: Avvia runner → fai goto e genera snapshot HTML (P0). Ottieni htmlPath
    // ============================================================================
    const cachedCookieSpec = getCookieTestSpec(validatedDSL.site);

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
      const desktopUserAgent =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36';
      try {
        await page.setUserAgent(desktopUserAgent);
        await page.setExtraHTTPHeaders({
          'accept-language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
        });
      } catch (uaError) {
        console.warn(`[${requestId}] Unable to set custom user agent/headers:`, (uaError as Error).message);
      }
      page.on('console', (msg: any) => {
        try {
          console.log(`[${requestId}] [page console] [${msg.type()}]`, msg.text());
        } catch {
          console.log(`[${requestId}] [page console] [${msg.type()}]`, '<<unserializable>>');
        }
      });
      page.on('pageerror', (err: Error) => {
        console.warn(`[${requestId}] [page error]`, err?.message || err);
      });
      page.on('response', (response: any) => {
        const status = response.status();
        if (status >= 400) {
          const url = response.url();
          console.warn(`[${requestId}] [page response ${status}] ${url}`);
        }
      });
      page.on('requestfailed', (request: any) => {
        try {
          const failure = request.failure();
          console.warn(
            `[${requestId}] [request failed] ${request.url()} :: ${failure?.errorText || 'unknown'}`
          );
          try {
            const headers = request.headers();
            console.warn(`[${requestId}] [request headers]`, headers);
          } catch {
            // ignore header serialization errors
          }
        } catch {
          console.warn(`[${requestId}] [request failed] <<unserializable>>`);
        }
      });
      
      // Force desktop viewport to avoid mobile layout
      await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
      await page.emulateMediaType('screen');
      
      console.log('✓ Browser launched and page created');
      
      // Navigate to the site and generate HTML snapshot
      await page.goto(validatedDSL.site, { waitUntil: 'networkidle2' });

      const acceptSelectorFromSpec =
        cachedCookieSpec?.tests?.flatMap((test: any) => test.steps || [])
          .find((step: any) => step.action === 'click' && step.target?.value)?.target?.value || null;
      const bannerSelectorFromSpec =
        cachedCookieSpec?.tests?.flatMap((test: any) => test.steps || [])
          .find((step: any) => step.action === 'click')
          ?.expect?.find((expectation: any) => expectation.type === 'invisible')?.selector || null;

      const candidateSelectors = [
        acceptSelectorFromSpec,
        bannerSelectorFromSpec,
        '#CybotCookiebotDialog',
        '.CybotCookiebotDialogContentWrapper',
        '#onetrust-banner-sdk'
      ].filter((sel): sel is string => typeof sel === 'string' && sel.length > 0);

      if (candidateSelectors.length > 0) {
        console.log(`[${requestId}] Waiting for cookie banner selectors before snapshot:`, candidateSelectors);
        let selectorSatisfied = false;
        const waitTimeout = 30000;
        for (const sel of candidateSelectors) {
          try {
            const elementHandle = await page.waitForSelector(sel, { timeout: waitTimeout });
            if (elementHandle) {
              const outer = await elementHandle.evaluate((el: any) => el.outerHTML).catch(() => null);
              console.log(`[${requestId}] Selector ${sel} detected before snapshot`);
              if (outer) {
                console.log(`[${requestId}] First match outerHTML (${sel}): ${outer.substring(0, 200)}…`);
              }
            }
            selectorSatisfied = true;
            break;
          } catch (err) {
            console.warn(
              `[${requestId}] Selector ${sel} not detected before snapshot: ${(err as Error).message}`
            );
            try {
              const diag = await page.evaluate((selector: string) => {
                const el = document.querySelector(selector);
                if (!el) return null;
                const style = window.getComputedStyle(el);
                const rect = el.getBoundingClientRect();
                return {
                  exists: true,
                  display: style.display,
                  visibility: style.visibility,
                  opacity: style.opacity,
                  width: rect.width,
                  height: rect.height,
                };
              }, sel);
              console.warn(`[${requestId}] Diagnostic for ${sel}:`, diag);
            } catch (diagError) {
              console.warn(
                `[${requestId}] Failed to gather diagnostics for ${sel}: ${(diagError as Error).message}`
              );
            }
          }
        }
        if (!selectorSatisfied) {
          console.warn(`[${requestId}] None of the cookie banner selectors became visible before snapshot`);
        }
      } else {
        console.log(`[${requestId}] No cookie selectors available prior to snapshot; using generic delay`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      const currentUrl = await page.url();
      console.log(`[${requestId}] Current URL before snapshot: ${currentUrl}`);

      // Generate HTML snapshot
      const html = await page.content();
      
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
    // FIX #7: Use cookie test spec from fetch-html cache (most reliable!)
    // ============================================================================
    console.log('===== STEP 3: EXECUTING COOKIE CONSENT TEST =====');
    
    let cookieConsentDSL: any;
    
    if (cachedCookieSpec) {
      // Use cached spec from fetch-html (has the correct selector!)
      console.log('✅ Using cached cookie test spec from fetch-html');
      cookieConsentDSL = cachedCookieSpec;
    } else {
      // Fallback: Use cookie step from DSL or hardcoded
      console.log('⚠️ No cached cookie spec, falling back to DSL or hardcoded selector');
      
      const cookieStepFromDSL = validatedDSL.tests[0]?.steps.find((s: any) => 
        s.description?.toLowerCase().includes('accept') ||
        s.description?.toLowerCase().includes('cookie') ||
        s.action === 'click'
      );
      
      cookieConsentDSL = {
        site: validatedDSL.site,
        allowed_hosts: validatedDSL.allowed_hosts,
        consent: ['accept'] as ('accept' | 'reject')[],
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
            cookieStepFromDSL || {
              description: 'Click Accept All Cookies button (generic fallback)',
              action: 'click',
              target: {
                kind: 'text',
                value: 'Accept' // Generic text-based approach works across ALL CMPs
              },
              expect: [{
                type: 'dataLayer',
                event: 'consent_update'
              }]
            }
          ]
        }]
      };
    }
    
    console.log('Cookie consent step selector:', cookieConsentDSL.tests[0].steps[1].target?.value);
    
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
    // STEP 4: Scenario DSL execution (replaces legacy PDF flow)
    // - Use the validated DSL from the request (already sanitized)
    // - Execute steps with the universal runner
    // - Reuse browser/page from cookie consent when available
    // ============================================================================
    console.log('===== STEP 4: PROCESSING PDF TESTS =====');
    
    let pdfResult: any = null;
    let pdfSpec: any = null;
    let pdfTextFile: string | null = null;

    if (useManifestDsl) {
      console.log('📘 Manifest module detected – using DSL tests directly (skipping LLM generation)');
      const manifestSpec = JSON.parse(JSON.stringify({
        site: validatedDSL.site,
        allowed_hosts: validatedDSL.allowed_hosts,
        tests: validatedDSL.tests,
      }));
      
      try {
        const pdfTestResult = await executePdfTests(manifestSpec, options, cookieConsentResult.browserInstance, cookieConsentResult.page);
        pdfResult = {
          status: pdfTestResult.status,
          spec: manifestSpec,
          result: pdfTestResult,
          steps: pdfTestResult.steps || [],
          source: 'manifest',
        };
        console.log(`✓ PDF tests executed from manifest: ${pdfTestResult.status}`);
      } catch (error: any) {
        console.error('Error executing manifest tests:', error);
        pdfResult = {
          status: 'error',
          code: 'MANIFEST_RUNNER_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          source: 'manifest',
          spec: manifestSpec,
          steps: [],
        };
      }

      if (
        pdfResult &&
        openaiService &&
        typeof pdfContent === 'string' &&
        pdfContent.trim().length > 0 &&
        Array.isArray(pdfResult.steps) &&
        pdfResult.steps.length > 0
      ) {
        try {
          const evaluation = await openaiService.evaluateTestOutcome({
            site: validatedDSL.site,
            pdfText: pdfContent,
            steps: pdfResult.steps.map((step: any) => ({
              description: step.description,
              status: step.status,
              expectations: step.expectations,
              matchedEvent: step.matchedEvent,
              eventDetails: step.eventDetails,
              capturedEvents: step.capturedEvents,
              error: step.error,
            })),
          });
          pdfResult.llm = evaluation;
          if (evaluation?.overallStatus) {
            pdfResult.status = evaluation.overallStatus;
          }
        } catch (llmError) {
          console.error('LLM evaluation failed:', llmError);
          pdfResult.llmError = llmError instanceof Error ? llmError.message : String(llmError);
        }
      }
    } else {
      // Use pdfContent from req.body directly (already extracted text)
      const pdfText = typeof pdfContent === 'string' ? pdfContent.trim() : '';

      if (!pdfText) {
        console.log('PDF content empty → skipping PDF spec');
        pdfResult = {
          status: 'skipped',
          reason: 'PDF_EMPTY',
          source: 'openai'
        };
      } else {
        try {
          const tempPdfDir = join(process.cwd(), 'temp-pdf');
          await fs.mkdir(tempPdfDir, { recursive: true });

          pdfTextFile = join(tempPdfDir, `txt_${requestId}.txt`);
          await fs.writeFile(pdfTextFile!, pdfText, 'utf8');
          console.log(`✓ PDF text saved for diagnosis: ${pdfTextFile}`);

          console.log('🤖 Generating PDF spec using LLM...');
          pdfSpec = await llmPdfSpec({
            url: validatedDSL.site,
            pdfText,
            htmlPath: htmlPath || undefined
          });

          console.log('✓ PDF spec generated successfully');

          let normalizedPdfSpec;
          try {
            normalizedPdfSpec = normalizePdfSpec(pdfSpec);
            console.log('🔧 Normalized PDF spec (runner shape):', JSON.stringify(normalizedPdfSpec, null, 2));
          } catch (error: any) {
            console.error('❌ Error normalizing PDF spec:', (error as Error).message);
            pdfResult = {
              status: 'error',
              code: 'INVALID_PDF_SPEC',
              message: error.message,
              source: 'openai'
            };
          }

          if (normalizedPdfSpec) {
            const pdfSpecWithSite = {
              site: validatedDSL.site,
              allowed_hosts: validatedDSL.allowed_hosts,
              ...normalizedPdfSpec
            };
            console.log('🚀 Executing PDF spec with runner...');
            const pdfTestResult = await executePdfTests(pdfSpecWithSite, options, cookieConsentResult.browserInstance, cookieConsentResult.page);

            pdfResult = {
              status: pdfTestResult.status,
              spec: pdfSpec,
              result: pdfTestResult,
              steps: pdfTestResult.steps || [],
              source: 'openai'
            };

            console.log(`✓ PDF tests executed: ${pdfTestResult.status}`);
          }

        } catch (error: any) {
          console.error('Error processing PDF:', error);

          if (error instanceof Error && error.message.includes('JSON')) {
            pdfResult = {
              status: 'error',
              code: 'INVALID_JSON',
              message: 'Lo spec generato non è JSON valido',
              source: 'openai'
            };
          } else if (!pdfResult) {
            pdfResult = {
              status: 'error',
              code: 'PDF_PROCESSING_ERROR',
              message: error instanceof Error ? error.message : 'Unknown error',
              source: 'openai'
            };
          }
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
    if (cookieConsentResult.browserInstance) {
      try {
        await cookieConsentResult.browserInstance.close();
        console.log('✓ Cookie consent browser closed');
      } catch (closeError) {
        console.log('⚠️ Error closing cookie consent browser:', closeError instanceof Error ? closeError.message : closeError);
      }
    }

    // Clean up temporary PDF file
    // Prepare final response
    const finalResponse = {
      requestId,
      url: validatedDSL.site,
      module: {
        id: inferredModuleId,
        source: finalModuleSource,
      },
      artifacts: {
        htmlFile: htmlPath,
        pdfTextFile: pdfTextFile,
        screenshotsFolder: SSD_DEFAULTS.path.screenshots
      },
      cookie: {
        status: cookieResult.status,
        consentStatus: cookieResult.consentStatus,
        dataLayerEvents: cookieResult.dataLayerEvents || [],
        steps: cookieResult.steps || [],
        error: cookieResult.error,
        duration: cookieResult.duration || 0,
        cookieBtnSelector: cookieResult.cookieBtnSelector,
        cookieBtnOuterHTML: cookieResult.cookieBtnOuterHTML,
        challenge: cookieResult.challenge || null
      },
      pdf: pdfResult,
      scenario: null,
      challenge: cookieResult.challenge || null
    };

    console.log('===== SSD TEST EXECUTION COMPLETED =====');
    console.log(`Request ID: ${requestId}`);
    console.log(`URL: ${validatedDSL.site}`);
    console.log(`Cookie Test Status: ${cookieResult.status}`);
    console.log(`PDF Test Status: ${(pdfResult as any)?.status || 'N/A'} (source: ${(pdfResult as any)?.source || 'unknown'})`);
    console.log(`HTML File: ${htmlPath}`);
    console.log(`Scenario Debug File: ${pdfTextFile}`);
    console.log('========================================');

    // Debug: mostra la struttura della risposta finale
    console.log('🔍 FINAL RESPONSE STRUCTURE:');
    console.log('  📦 finalResponse keys:', Object.keys(finalResponse));
    console.log('  📋 finalResponse.report exists:', !!(finalResponse as any).report);
    console.log('  📋 finalResponse.pdf exists:', !!(finalResponse as any).pdf);
    console.log('  📋 finalResponse.cookie exists:', !!(finalResponse as any).cookie);
    console.log('  📋 finalResponse.artifacts exists:', !!(finalResponse as any).artifacts);
    console.log('  📊 finalResponse.report keys:', (finalResponse as any).report ? Object.keys((finalResponse as any).report) : 'N/A');
    console.log('  📊 finalResponse.pdf keys:', (finalResponse as any).pdf ? Object.keys((finalResponse as any).pdf) : 'N/A');
    console.log('  📊 finalResponse.cookie keys:', (finalResponse as any).cookie ? Object.keys((finalResponse as any).cookie) : 'N/A');

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
          
          // FIX #7: Save cookie test spec to cache for reuse in ssd/run
          saveCookieTestSpec(targetUrl, cookieTestSpec);
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
      allowedMimeTypes: SSD_DEFAULTS.upload.allowedMimeTypes,
      allowedExtensions: SSD_DEFAULTS.upload.allowedExtensions,
      supportedFormats: ['PDF with selectable text'],
      ambiguityMinConfidence: SSD_DEFAULTS.confidence.ambiguity
    },
    supportedActions: SSD_DEFAULTS.dsl.supportedActions,
    supportedExpectations: SSD_DEFAULTS.dsl.supportedExpectationTypes,
    supportedTargetTypes: SSD_DEFAULTS.dsl.supportedTargetKinds,
    supportedRegions: SSD_DEFAULTS.dsl.supportedRegions,
    supportedConsentProfiles: SSD_DEFAULTS.dsl.supportedConsentProfiles,
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
    
    const scenarios = customScenarios?.filter((scenario: any) => {
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
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server Error:', error);
  const httpError = toHttpError(error instanceof Error ? error : new Error('Unknown error'));
  res.status(httpError.httpStatus).json({ error: { code: httpError.code, message: httpError.message, details: httpError.details } });
});

// Handle OPTIONS preflight requests for screenshots
app.options('/api/screenshot/*', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Credentials', 'false');
  res.status(200).end();
});

// Serve screenshot images
app.get('/api/screenshot/*', (req, res) => {
  const imagePath = (req as any).params[0];
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
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
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
      if ((err as any).code !== 'EPIPE' && (err as any).code !== 'ECONNRESET') {
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
const server = app.listen(PORT, () => {
  console.log(`🔌 SSD Test Server attivo su http://localhost:${PORT}`);
  console.log(`📄 HTML Proxy: GET /api/fetchHtml`);
  console.log(`📊 SSD Test: POST /api/ssd/ingest, POST /api/ssd/run`);
  console.log(`⚙️  Config: GET /api/ssd/config`);
  console.log(`🔑 OpenAI API Key: ${config.openaiApiKey ? '✅ Configured' : '❌ Missing'}`);
});
