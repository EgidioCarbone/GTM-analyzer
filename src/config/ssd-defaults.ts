// SSD Test - Centralized Default Configuration
// ============================================================================
// All hardcoded values are centralized here for easy maintenance and override
// via environment variables.

/**
 * LLM Configuration Defaults
 */
export const LLM_DEFAULTS = {
  // Default models
  models: {
    default: 'gpt-4o-mini',
    fallback: 'gpt-3.5-turbo',
    advanced: 'gpt-4o',
  },
  
  // Temperature settings per task type
  temperature: {
    specGeneration: 0.1,      // Low for consistent DSL output
    targetEnhancement: 0.1,   // Low for precise selector suggestions
    consentAnalysis: 0.2,     // Slightly higher for CMP detection
    documentGeneration: 0.2,  // For measurement doc generation
    insights: 0.2,            // For GA4 insights
  },
  
  // Max tokens per task type
  maxTokens: {
    specGeneration: 4000,
    targetEnhancement: 800,
    documentGeneration: 4000,
    insights: 4000,
  },
  
  // Timeouts
  timeout: {
    default: 60000,           // 60 seconds
    extended: 120000,         // 2 minutes for complex tasks
  },
} as const;

/**
 * Puppeteer/Runner Timeout Defaults
 */
export const TIMEOUT_DEFAULTS = {
  // Step execution timeouts
  step: 30000,                // 30 seconds per step
  navigation: 60000,          // 60 seconds for navigation
  request: 10000,             // 10 seconds for network requests
  spaRoute: 5000,             // 5 seconds for SPA route changes
  
  // Selector resolution timeouts
  selector: {
    default: 5000,            // 5 seconds default
    quick: 1000,              // 1 second for quick checks
    medium: 2000,             // 2 seconds for medium priority
  },
  
  // Consent handler timeouts
  consent: {
    bannerDetection: 5000,    // 5 seconds to detect banner
    bannerInteraction: 10000, // 10 seconds for interaction
    bannerDisappear: 5000,    // 5 seconds to wait for disappearance
  },
  
  // Server timeouts
  server: {
    screenshot: 30000,        // 30 seconds for screenshot serving
    upload: 60000,            // 60 seconds for file upload
  },
  
  // Cache and cleanup
  cache: {
    ttl: 5 * 60 * 1000,       // 5 minutes
    cleanupInterval: 60000,   // 1 minute
    consentLlm: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
} as const;

/**
 * Confidence Threshold Defaults
 */
export const CONFIDENCE_DEFAULTS = {
  // Ambiguity detection thresholds
  ambiguity: 0.6,             // Below this = ambiguous
  warning: 0.5,               // Warning threshold
  critical: 0.4,              // Critical issues
  
  // Quality thresholds
  accept: 0.3,                // Minimum to accept
  high: 0.7,                  // High confidence
  veryHigh: 0.8,              // Very high confidence
  excellent: 0.9,             // Excellent confidence
  
  // Ratio thresholds
  maxAmbiguityRatio: 0.3,     // Max 30% ambiguous steps allowed
  
  // Content thresholds
  minPdfLength: 500,          // Minimum PDF text length
} as const;

/**
 * Network Allowlist Defaults
 */
export const NETWORK_DEFAULTS = {
  // Tracking domains
  tracking: [
    'google-analytics.com',
    'googletagmanager.com',
    'g.doubleclick.net',
    'analytics.google.com',
    'www.google-analytics.com',
    'facebook.com/tr',
    'connect.facebook.net',
    'analytics.tiktok.com',
    'linkedin.com/analytics',
    'bing.com/analytics',
  ],
  
  // CDN domains
  cdn: [
    'cdnjs.cloudflare.com',
    'unpkg.com',
    'jsdelivr.net',
    'fonts.googleapis.com',
    'fonts.gstatic.com',
    '*.gstatic.com',
    '*.googleapis.com',
    '*.cdn.jsdelivr.net',
    '*.unpkg.com',
  ],
  
  // CMP/Consent domains
  cmp: [
    'consent.trustarc.com',
    'consent.cookiebot.com',
    'cdn.cookielaw.org',
    'geolocation.onetrust.com',
  ],
  
  // Allowed resource extensions
  resourceExtensions: [
    'css', 'js', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'ico',
    'woff', 'woff2', 'ttf', 'eot', 'webp',
  ],
} as const;

/**
 * CMP Selector Defaults
 */
export const CMP_SELECTORS = {
  // OneTrust
  onetrust: {
    accept: [
      '#onetrust-accept-btn-handler',
      '.onetrust-accept-btn-handler',
      '[id*="onetrust"][id*="accept"]',
    ],
    reject: [
      '#onetrust-reject-all-handler',
      '.onetrust-reject-all-handler',
      '[id*="onetrust"][id*="reject"]',
    ],
    banner: [
      '#onetrust-consent-sdk',
      '#onetrust-banner-sdk',
    ],
  },
  
  // Cookiebot
  cookiebot: {
    accept: [
      '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
      '#CybotCookiebotDialogBodyButtonAccept',
      '#CybotCookiebotDialogBodyButtonAcceptAll',
    ],
    reject: [
      '#CybotCookiebotDialogBodyLevelButtonLevelOptinDeclineAll',
      '#CybotCookiebotDialogBodyButtonDecline',
    ],
    banner: [
      '#CybotCookiebotDialog',
      '.CybotCookiebotDialogContentWrapper',
      '.CybotCookiebotDialog',
    ],
  },
  
  // TrustArc
  trustarc: {
    accept: [
      '#truste-consent-button',
      '.truste-button1',
    ],
    reject: [
      '.truste-button2',
      '#truste-reject-button',
    ],
    banner: [
      '#truste-consent-track',
      '.truste-consent-track',
    ],
  },
  
  // Generic fallbacks
  generic: {
    accept: [
      '[data-consent="accept"]',
      '[aria-label*="accept" i][aria-label*="cookie" i]',
      'button:contains("Accept"):contains("Cookie")',
    ],
    reject: [
      '[data-consent="reject"]',
      '[aria-label*="reject" i][aria-label*="cookie" i]',
      'button:contains("Reject"):contains("Cookie")',
    ],
  },
} as const;

/**
 * Viewport Defaults
 */
export const VIEWPORT_DEFAULTS = {
  width: 1280,
  height: 720,
  deviceScaleFactor: 1,
  isMobile: false,
} as const;

/**
 * File Upload Defaults
 */
export const UPLOAD_DEFAULTS = {
  maxFileSizeMB: 10,
  maxFileSizeBytes: 10 * 1024 * 1024,
  allowedMimeTypes: ['application/pdf', 'application/octet-stream'],
  allowedExtensions: ['.pdf'],
  
  // PDF validation
  pdfMagicNumbers: [0x25, 0x50, 0x44, 0x46, 0x2D], // %PDF-
} as const;

/**
 * Rate Limiting Defaults
 */
export const RATE_LIMIT_DEFAULTS = {
  windowMs: 15 * 60 * 1000,   // 15 minutes
  max: 100,                    // 100 requests per window
} as const;

/**
 * Content Processing Defaults
 */
export const CONTENT_DEFAULTS = {
  // HTML truncation
  maxHtmlLength: 50000,        // 50KB
  
  // Text extraction
  minTextLength: 10,
  maxTextLength: 100000,
  
  // Truncation markers
  truncationMarker: '\n\n[CONTENT TRUNCATED...]',
} as const;

/**
 * Path Defaults
 */
export const PATH_DEFAULTS = {
  screenshots: 'screenshots',
  uploads: 'uploads',
  tempHtml: 'temp-html',
  tempPdf: 'temp-pdf',
  tempOpenai: 'temp-openai',
  artifacts: 'artifacts',
} as const;

/**
 * DSL Validation Defaults
 */
export const DSL_DEFAULTS = {
  supportedRegions: ['header', 'main', 'footer', 'any'] as const,
  supportedTargetKinds: ['text', 'selector', 'aria', 'href'] as const,
  supportedActions: [
    'click', 'input', 'wait_for_selector', 'wait_for_text',
    'navigate', 'maybe_set_quantity', 'choose_payment',
    'complete_order', 'custom',
  ] as const,
  supportedExpectationTypes: [
    'dataLayer', 'ga4', 'gtm', 'network', 'navigation', 'no_repeat_on_reload',
  ] as const,
  supportedConsentProfiles: ['accept', 'reject', 'both'] as const,
} as const;

/**
 * GA4/Ecommerce Event Names
 */
export const GA4_EVENTS = {
  ecommerce: [
    'add_to_cart',
    'begin_checkout',
    'add_payment_info',
    'add_shipping_info',
    'add_billing_info',
    'purchase',
    'remove_from_cart',
    'view_item',
    'view_item_list',
    'select_item',
  ],
  
  // Events that require ecommerce reset
  requiresReset: [
    'add_to_cart',
    'begin_checkout',
    'add_payment_info',
    'add_shipping_info',
    'add_billing_info',
    'purchase',
  ],
  
  // Events that should not repeat on reload
  noRepeatOnReload: [
    'purchase',
  ],
} as const;

/**
 * Get configuration value with environment variable override
 */
export function getConfigValue<T>(
  envVar: string,
  defaultValue: T,
  parser?: (val: string) => T
): T {
  const envValue = process.env[envVar];
  
  if (!envValue) {
    return defaultValue;
  }
  
  if (parser) {
    try {
      return parser(envValue);
    } catch (error) {
      console.warn(`Failed to parse ${envVar}=${envValue}, using default:`, defaultValue);
      return defaultValue;
    }
  }
  
  return envValue as unknown as T;
}

/**
 * Parse comma-separated string to array
 */
export function parseArray(value: string): string[] {
  return value.split(',').map(s => s.trim()).filter(Boolean);
}

/**
 * Parse integer with validation
 */
export function parseInt(value: string, min?: number, max?: number): number {
  const parsed = Number.parseInt(value, 10);
  
  if (isNaN(parsed)) {
    throw new Error(`Invalid integer: ${value}`);
  }
  
  if (min !== undefined && parsed < min) {
    throw new Error(`Value ${parsed} is below minimum ${min}`);
  }
  
  if (max !== undefined && parsed > max) {
    throw new Error(`Value ${parsed} is above maximum ${max}`);
  }
  
  return parsed;
}

/**
 * Parse float with validation
 */
export function parseFloat(value: string, min?: number, max?: number): number {
  const parsed = Number.parseFloat(value);
  
  if (isNaN(parsed)) {
    throw new Error(`Invalid float: ${value}`);
  }
  
  if (min !== undefined && parsed < min) {
    throw new Error(`Value ${parsed} is below minimum ${min}`);
  }
  
  if (max !== undefined && parsed > max) {
    throw new Error(`Value ${parsed} is above maximum ${max}`);
  }
  
  return parsed;
}

/**
 * Export all defaults as a single object for easy access
 */
export const SSD_DEFAULTS = {
  llm: LLM_DEFAULTS,
  timeout: TIMEOUT_DEFAULTS,
  confidence: CONFIDENCE_DEFAULTS,
  network: NETWORK_DEFAULTS,
  cmp: CMP_SELECTORS,
  viewport: VIEWPORT_DEFAULTS,
  upload: UPLOAD_DEFAULTS,
  rateLimit: RATE_LIMIT_DEFAULTS,
  content: CONTENT_DEFAULTS,
  path: PATH_DEFAULTS,
  dsl: DSL_DEFAULTS,
  ga4: GA4_EVENTS,
} as const;

export default SSD_DEFAULTS;

