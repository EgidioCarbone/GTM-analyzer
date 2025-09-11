// src/types/websiteChecklist.ts
export type WebsiteChecklistChecks = {
  "script gtm presente": boolean;
  "id gtm valido": boolean;
  "dataLayer inizializzato": boolean;
  "cookie banner visibile": boolean;
  "consent mode": boolean;
  "csp blocca gtm": boolean;
  "performance ottimale": boolean;
  "accessibility buona": boolean;
  "seo ottimizzato": boolean;
  "consenso funzionante": boolean;
  "test interattivi passati": boolean;
};

export interface PerformanceMetrics {
  lcp: number; // Largest Contentful Paint
  fid: number; // First Input Delay
  cls: number; // Cumulative Layout Shift
  fcp: number; // First Contentful Paint
  ttfb: number; // Time to First Byte
  speedIndex: number;
  totalBlockingTime: number;
}

export interface InteractiveTestResults {
  acceptAllTest: {
    passed: boolean;
    consentUpdated: boolean;
    marketingTagsFired: boolean;
    dataLayerEvents: any[];
  };
  rejectAllTest: {
    passed: boolean;
    marketingTagsBlocked: boolean;
    consentDenied: boolean;
    dataLayerEvents: any[];
  };
  navigationTest: {
    passed: boolean;
    consentPersisted: boolean;
    gtmLoaded: boolean;
  };
}

export interface WebsiteChecklistResult {
  url: string;
  checks: WebsiteChecklistChecks;
  aiSummary: string;        // Diagnosi IA
  technicalSummary: string; // Analisi Tecnica
  aiUsed: boolean; // Flag per indicare se l'IA è stata utilizzata
  performanceScore: number;
  accessibilityScore: number;
  seoScore: number;
  overallScore: number;
  extra?: {
    gtmIds?: string[];
    cookieBannerLibs?: string[];
    consentModeCalls?: any[];
    consentCallsFoundInHtml?: { mode: string; payloadRaw: string }[];
    dataLayerSummary?: {
      count: number;
      uniqueEvents: string[];
      cmpSignals: string[];
      consentEntriesCount: number;
      sampleConsentEntries: any[];
    };
    performanceMetrics?: PerformanceMetrics;
    interactiveTestResults?: InteractiveTestResults;
    screenshots?: string[];
    timeline?: {
      timestamp: number;
      event: string;
      data: any;
    }[];
  };
}
