// SSD Validation Schemas with Zod
// ============================================================================

import { z } from 'zod';
import { normalizeOrigin } from '../utils/url';

// Base schemas
const TargetSchema = z.object({
  region: z.enum(["header", "main", "footer", "any"]).optional(),
  kind: z.enum(["text", "selector", "aria", "href"]),
  value: z.string().min(1),
});

const ExpectationSchema = z.object({
  type: z.enum(["dataLayer", "ga4", "gtm", "network", "navigation", "no_repeat_on_reload"]),
  event: z.string().optional(),
  params_subset: z.record(z.any()).optional(),
  near_previous_n: z.number().int().positive().optional(),
  contains: z.record(z.any()).optional(),
  url_contains: z.string().optional(),
  url_matches: z.string().optional(),
  for_event: z.string().optional(),
});

const StepSchema = z.object({
  description: z.string().optional(),
  action: z.enum([
    "click", "input", "wait_for_selector", "wait_for_text", 
    "navigate", "maybe_set_quantity", "choose_payment", 
    "complete_order", "custom"
  ]),
  target: TargetSchema.optional(),
  value: z.string().optional(),
  expect: z.array(ExpectationSchema).optional(),
  severity: z.enum(["critical", "major", "minor"]).optional(),
  confidence: z.number().min(0).max(1).optional(),
});

const TestSchema = z.object({
  section: z.string().min(1),
  steps: z.array(StepSchema).min(1),
});

const SiteSchema = z.preprocess((v) => {
  // accetta undefined/string, normalizza in origin
  if (v == null) return v;
  try { 
    return normalizeOrigin(String(v)); 
  } catch { 
    return v; // lascia che Zod gestisca l'errore
  }
}, z.string().url("Site must be a valid URL"));

const TestSpecSchema = z.object({
  site: SiteSchema,
  allowed_hosts: z.array(z.string()).optional(),
  consent: z.array(z.enum(["reject", "accept"])).optional(),
  tests: z.array(TestSchema).min(1, "At least one test is required"),
});

// API Request/Response schemas
const SSDIngestRequestSchema = z.object({
  url: z.string().url("Must be a valid URL"),
  pdf: z.instanceof(File, "PDF file is required"),
});

const SSDRunRequestSchema = z.object({
  dsl: TestSpecSchema,
  runOptions: z.object({
    headless: z.boolean().optional(),
    consent: z.enum(["accept", "reject", "both"]).optional(),
  }).optional(),
});

// Validation functions
export function validateTestSpec(data: unknown): { success: boolean; data?: any; error?: string } {
  try {
    const result = TestSpecSchema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { 
        success: false, 
        error: `Validation failed: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}` 
      };
    }
    return { success: false, error: 'Unknown validation error' };
  }
}

export function validateSSDIngestRequest(data: unknown): { success: boolean; data?: any; error?: string } {
  try {
    const result = SSDIngestRequestSchema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { 
        success: false, 
        error: `Validation failed: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}` 
      };
    }
    return { success: false, error: 'Unknown validation error' };
  }
}

export function validateSSDRunRequest(data: unknown): { success: boolean; data?: any; error?: string } {
  try {
    const result = SSDRunRequestSchema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { 
        success: false, 
        error: `Validation failed: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}` 
      };
    }
    return { success: false, error: 'Unknown validation error' };
  }
}

// Utility function to check if a URL is in the allowed hosts list
export function isUrlAllowed(url: string, allowedHosts: string[]): boolean {
  try {
    const urlObj = new URL(url);
    return allowedHosts.some(host => {
      // Support both exact domain matches and wildcard subdomains
      if (host.startsWith('*.')) {
        const domain = host.substring(2);
        return urlObj.hostname === domain || urlObj.hostname.endsWith('.' + domain);
      }
      return urlObj.hostname === host;
    });
  } catch {
    return false;
  }
}

// Utility function to validate confidence scores and detect ambiguities
export function detectAmbiguities(testSpec: any, minConfidence: number = 0.6): Array<{ stepPath: string; reason: string; candidates?: any[] }> {
  const ambiguities: Array<{ stepPath: string; reason: string; candidates?: any[] }> = [];
  
  testSpec.tests?.forEach((test: any, testIndex: number) => {
    test.steps?.forEach((step: any, stepIndex: number) => {
      const stepPath = `tests[${testIndex}].steps[${stepIndex}]`;
      
      // Check for low confidence
      if (step.confidence !== undefined && step.confidence < minConfidence) {
        ambiguities.push({
          stepPath,
          reason: `Low confidence (${step.confidence}) - target may be ambiguous (threshold: ${minConfidence})`,
          candidates: step.target ? [step.target] : undefined
        });
      }
      
      // Check for vague targets
      if (step.target?.value) {
        const value = step.target.value.toLowerCase();
        if (value.includes('button') && !value.includes('specific') && !value.includes('exact')) {
          ambiguities.push({
            stepPath,
            reason: 'Vague target description - multiple buttons may match',
            candidates: [
              { ...step.target, kind: 'text', value: 'specific button text' },
              { ...step.target, kind: 'selector', value: 'button[data-testid="..."]' },
              { ...step.target, kind: 'aria', value: 'button with specific aria-label' }
            ]
          });
        }
      }
      
      // Check for missing expectations
      if (step.action !== 'wait_for_selector' && step.action !== 'wait_for_text' && (!step.expect || step.expect.length === 0)) {
        ambiguities.push({
          stepPath,
          reason: 'No expectations defined - unclear what should happen after this action'
        });
      }
    });
  });
  
  return ambiguities;
}

export {
  TestSpecSchema,
  SSDIngestRequestSchema,
  SSDRunRequestSchema,
  TargetSchema,
  ExpectationSchema,
  StepSchema,
  TestSchema,
};
