// src/types/websiteChecklist.ts
export type WebsiteChecklistChecks = {
  "script gtm presente": boolean;
  "id gtm valido": boolean;
  "dataLayer inizializzato": boolean;
  "cookie banner visibile": boolean;
  "consent mode": boolean;
  "csp blocca gtm": boolean;
};

export interface WebsiteChecklistResult {
  url: string;
  checks: WebsiteChecklistChecks;
  aiSummary: string;
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
  };
}
