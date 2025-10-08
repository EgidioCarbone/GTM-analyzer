import { z } from 'zod';
import { normalizeOrigin } from '../utils/url';

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export class SpecValidationError extends Error {
  constructor(
    message: string,
    public errors: ValidationError[],
    public code: 'SCHEMA_VALIDATION' | 'PLACEHOLDER_DETECTED' | 'INVALID_URL' | 'INVALID_REGION'
  ) {
    super(message);
    this.name = 'SpecValidationError';
  }
}

// Zod schemas for DSL validation
const TargetSchema = z.object({
  region: z.enum(['header', 'main', 'footer', 'any']).optional(),
  kind: z.enum(['text', 'aria', 'href', 'selector']),
  value: z.string().min(1, 'Target value cannot be empty'),
});

const ExpectationSchema = z.object({
  type: z.enum(['dataLayer', 'ga4', 'gtm', 'network', 'navigation', 'no_repeat_on_reload']),
  event: z.string().optional(),
  params_subset: z.record(z.any()).optional(),
  url_contains: z.string().optional(),
  url_matches: z.string().optional(),
  for_event: z.string().optional(),
});

const StepSchema = z.object({
  description: z.string().optional(),
  action: z.enum(['click', 'input', 'wait_for_selector', 'wait_for_text', 'navigate', 'custom']),
  target: TargetSchema.optional(),
  value: z.string().optional(),
  expect: z.array(ExpectationSchema).optional(),
  severity: z.enum(['critical', 'major', 'minor']).optional(),
  confidence: z.number().min(0).max(1).optional(),
});

const TestSchema = z.object({
  section: z.string().min(1, 'Test section cannot be empty'),
  steps: z.array(StepSchema).min(1, 'Test must contain at least one step'),
});

const SiteSchema = z.preprocess((v) => {
  // accetta undefined/string, normalizza in origin
  if (v == null) return v;
  try { 
    return normalizeOrigin(String(v)); 
  } catch { 
    return v; // lascia che Zod gestisca l'errore
  }
}, z.string().url('Site must be a valid URL'));

const TestSpecSchema = z.object({
  site: SiteSchema,
  allowed_hosts: z.array(z.string()).optional(),
  consent: z.array(z.enum(['accept', 'reject'])).optional(),
  tests: z.array(TestSchema).min(1, 'TestSpec must contain at least one test'),
});

/**
 * Validate a TestSpec DSL against the schema
 * @param dsl The DSL object to validate
 * @returns Validated DSL
 * @throws SpecValidationError if validation fails
 */
export function validateTestSpec(dsl: any): any {
  try {
    // First, validate against the basic schema
    const validatedDsl = TestSpecSchema.parse(dsl);

    // Additional custom validations
    const errors: ValidationError[] = [];

    // Check for placeholders in the DSL
    const placeholderErrors = detectPlaceholders(dsl);
    errors.push(...placeholderErrors);

    // Validate allowed_hosts if present
    if (validatedDsl.allowed_hosts) {
      const hostErrors = validateAllowedHosts(validatedDsl.allowed_hosts, validatedDsl.site);
      errors.push(...hostErrors);
    }

    // Validate each test and step
    validatedDsl.tests.forEach((test: any, testIndex: number) => {
      test.steps.forEach((step: any, stepIndex: number) => {
        // Check for placeholders in step descriptions
        if (step.description) {
          const stepPlaceholderErrors = detectPlaceholders(step.description, `tests[${testIndex}].steps[${stepIndex}].description`);
          errors.push(...stepPlaceholderErrors);
        }

        // Check for placeholders in target values
        if (step.target?.value) {
          const targetPlaceholderErrors = detectPlaceholders(step.target.value, `tests[${testIndex}].steps[${stepIndex}].target.value`);
          errors.push(...targetPlaceholderErrors);
        }

        // Check for placeholders in input values
        if (step.value) {
          const valuePlaceholderErrors = detectPlaceholders(step.value, `tests[${testIndex}].steps[${stepIndex}].value`);
          errors.push(...valuePlaceholderErrors);
        }

        // Validate expectations
        if (step.expect) {
          step.expect.forEach((expectation: any, expIndex: number) => {
            if (expectation.params_subset) {
              const paramsPlaceholderErrors = detectPlaceholders(expectation.params_subset, `tests[${testIndex}].steps[${stepIndex}].expect[${expIndex}].params_subset`);
              errors.push(...paramsPlaceholderErrors);
            }
          });
        }
      });
    });

    if (errors.length > 0) {
      throw new SpecValidationError(
        'DSL validation failed',
        errors,
        'SCHEMA_VALIDATION'
      );
    }

    return validatedDsl;

  } catch (error) {
    if (error instanceof SpecValidationError) {
      throw error;
    }

    if (error instanceof z.ZodError) {
      const errors: ValidationError[] = error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        code: 'SCHEMA_VALIDATION'
      }));

      throw new SpecValidationError(
        'DSL schema validation failed',
        errors,
        'SCHEMA_VALIDATION'
      );
    }

    throw new SpecValidationError(
      `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      [],
      'SCHEMA_VALIDATION'
    );
  }
}

/**
 * Detect placeholder patterns in the DSL
 * @param obj Object to check for placeholders
 * @param fieldPath Path to the field being checked
 * @returns Array of validation errors
 */
function detectPlaceholders(obj: any, fieldPath: string = ''): ValidationError[] {
  const errors: ValidationError[] = [];

  if (typeof obj === 'string') {
    // Check for various placeholder patterns - be more permissive for generic selectors
    const placeholderPatterns = [
      // Only flag specific literal placeholders that are clearly problematic
      { pattern: /\[PRODUCT NAME\]/gi, message: 'Contains literal placeholder [PRODUCT NAME]' },
      { pattern: /\[PRICE\]/gi, message: 'Contains literal placeholder [PRICE]' },
      { pattern: /\[ID\]/gi, message: 'Contains literal placeholder [ID]' },
      { pattern: /\[URL\]/gi, message: 'Contains literal placeholder [URL]' },
      { pattern: /\[TIMESTAMP\]/gi, message: 'Contains literal placeholder [TIMESTAMP]' },
      { pattern: /N\/A/gi, message: 'Contains placeholder value N/A' },
      { pattern: /TBD/gi, message: 'Contains placeholder value TBD' },
      { pattern: /TODO/gi, message: 'Contains placeholder value TODO' },
      // Allow generic brackets for CSS selectors and text patterns
      // { pattern: /\[.*?\]/g, message: 'Contains placeholder brackets [text]' }, // REMOVED - too restrictive
      { pattern: /\{\{.*?\}\}/g, message: 'Contains placeholder braces {{text}}' },
      { pattern: /\$\{.*?\}/g, message: 'Contains placeholder variables ${text}' },
    ];

    placeholderPatterns.forEach(({ pattern, message }) => {
      if (pattern.test(obj)) {
        errors.push({
          field: fieldPath,
          message,
          code: 'PLACEHOLDER_DETECTED'
        });
      }
    });
  } else if (typeof obj === 'object' && obj !== null) {
    // Recursively check object properties
    Object.entries(obj).forEach(([key, value]) => {
      const currentPath = fieldPath ? `${fieldPath}.${key}` : key;
      errors.push(...detectPlaceholders(value, currentPath));
    });
  }

  return errors;
}

/**
 * Validate allowed_hosts array
 * @param allowedHosts Array of allowed hosts
 * @param siteUrl The site URL to validate against
 * @returns Array of validation errors
 */
function validateAllowedHosts(allowedHosts: string[], siteUrl: string): ValidationError[] {
  const errors: ValidationError[] = [];

  try {
    const siteUrlObj = new URL(siteUrl);
    const siteHostname = siteUrlObj.hostname;
    const baseDomain = siteHostname.startsWith('www.') ? siteHostname.substring(4) : siteHostname;

    allowedHosts.forEach((host, index) => {
      // Check if host is a valid domain
      try {
        // Allow hosts without protocol
        const hostToCheck = host.startsWith('http') ? host : `https://${host}`;
        const hostUrl = new URL(hostToCheck);
        const hostname = hostUrl.hostname;

        // Check if host is related to the site domain
        if (hostname !== siteHostname && 
            hostname !== baseDomain && 
            !hostname.endsWith('.' + baseDomain) &&
            !baseDomain.endsWith('.' + hostname.split('.').slice(-2).join('.'))) {
          errors.push({
            field: `allowed_hosts[${index}]`,
            message: `Host "${host}" is not related to site domain "${siteHostname}"`,
            code: 'INVALID_URL'
          });
        }
      } catch {
        errors.push({
          field: `allowed_hosts[${index}]`,
          message: `Invalid host format: "${host}"`,
          code: 'INVALID_URL'
        });
      }
    });

  } catch {
    errors.push({
      field: 'site',
      message: 'Invalid site URL format',
      code: 'INVALID_URL'
    });
  }

  return errors;
}

/**
 * Validate a single step's target region
 * @param target Target object to validate
 * @returns Array of validation errors
 */
export function validateTargetRegion(target: any): ValidationError[] {
  const errors: ValidationError[] = [];

  if (target && target.region) {
    const validRegions = ['header', 'main', 'footer', 'any'];
    if (!validRegions.includes(target.region)) {
      errors.push({
        field: 'target.region',
        message: `Invalid region "${target.region}". Must be one of: ${validRegions.join(', ')}`,
        code: 'INVALID_REGION'
      });
    }
  }

  return errors;
}

/**
 * Validate params_subset for wildcard usage
 * @param paramsSubset Object to validate
 * @returns Array of validation errors
 */
export function validateParamsSubset(paramsSubset: any): ValidationError[] {
  const errors: ValidationError[] = [];

  if (paramsSubset && typeof paramsSubset === 'object') {
    Object.entries(paramsSubset).forEach(([key, value]) => {
      if (typeof value === 'string' && value === '*') {
        // Wildcard is allowed, no error
        return;
      }
      
      if (typeof value === 'string' && value.includes('[') && value.includes(']')) {
        errors.push({
          field: `params_subset.${key}`,
          message: `Contains placeholder pattern: "${value}". Use "*" for wildcards.`,
          code: 'PLACEHOLDER_DETECTED'
        });
      }
    });
  }

  return errors;
}
