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
}