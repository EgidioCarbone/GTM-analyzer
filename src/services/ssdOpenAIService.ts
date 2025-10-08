// SSD OpenAI Service
// Converts extracted PDF text into validated TestSpec DSL using OpenAI
// ============================================================================

import OpenAI from 'openai';
import { z } from 'zod';
import { normalizeOrigin } from '../utils/url';
import { TestSpec, Ambiguity } from '../types/ssd';

export interface OpenAIResponse {
  dsl: TestSpec;
  ambiguities: Ambiguity[];
  meta: {
    model: string;
    tokens: {
      input: number;
      output: number;
    };
  };
}

export class OpenAIError extends Error {
  constructor(message: string, public code: string, public originalError?: any) {
    super(message);
    this.name = 'OpenAIError';
  }
}

// Zod schemas for validation
const TargetSchema = z.object({
  region: z.string().optional(), // Allow any region string for flexibility
  kind: z.enum(['text', 'selector', 'aria', 'href']),
  value: z.string().min(1),
});

const ExpectationSchema = z.object({
  type: z.enum(['dataLayer', 'ga4', 'gtm', 'network', 'navigation', 'no_repeat_on_reload']),
  event: z.string().optional(),
  params_subset: z.record(z.any()).optional(),
  near_previous_n: z.number().positive().optional(),
  contains: z.record(z.any()).optional(),
  url_contains: z.string().optional(),
  url_matches: z.string().optional(),
  for_event: z.string().optional(),
});

const StepSchema = z.object({
  description: z.string().optional(),
  action: z.enum([
    'click', 'input', 'wait_for_selector', 'wait_for_text', 'navigate',
    'maybe_set_quantity', 'choose_payment', 'complete_order', 'custom'
  ]),
  target: TargetSchema.optional(),
  value: z.string().optional(),
  expect: z.array(ExpectationSchema).optional(),
  severity: z.enum(['critical', 'major', 'minor']).optional(),
  confidence: z.number().min(0).max(1),
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
}, z.string().url());

const TestSpecSchema = z.object({
  site: SiteSchema,
  allowed_hosts: z.array(z.string()).optional(),
  consent: z.array(z.enum(['reject', 'accept'])).optional(),
  tests: z.array(TestSchema).min(1),
});

export class SSDOpenAIService {
  private openai: OpenAI;

  constructor(apiKey: string, model: string = 'gpt-4o-mini') {
    this.openai = new OpenAI({
      apiKey,
    });
    this.model = model;
  }

  private model: string;

  /**
   * Convert PDF text to TestSpec DSL
   */
  async convertPDFToTestSpec(
    pdfText: string,
    targetUrl: string,
    model?: string
  ): Promise<OpenAIResponse> {
    try {
      const systemPrompt = this.buildSystemPrompt();
      const userPrompt = this.buildUserPrompt(pdfText, targetUrl);

      const completion = await this.openai.chat.completions.create({
        model: model || this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1, // Low temperature for consistent output
        max_tokens: 4000,
      });

      const responseText = completion.choices[0]?.message?.content;
      if (!responseText) {
        throw new OpenAIError('No response from OpenAI', 'NO_RESPONSE');
      }

      // Parse and validate JSON response
      let parsedResponse;
      try {
        parsedResponse = JSON.parse(responseText);
      } catch (parseError) {
        throw new OpenAIError(
          'Invalid JSON response from OpenAI',
          'INVALID_JSON',
          parseError
        );
      }

      // Validate the TestSpec structure
      const validatedDSL = this.validateTestSpec(parsedResponse);
      
      // Extract ambiguities from low-confidence steps
      const ambiguities = this.extractAmbiguities(validatedDSL);

      return {
        dsl: validatedDSL,
        ambiguities,
        meta: {
          model: completion.model,
          tokens: {
            input: completion.usage?.prompt_tokens || 0,
            output: completion.usage?.completion_tokens || 0,
          },
        },
      };

    } catch (error) {
      if (error instanceof OpenAIError) {
        throw error;
      }

      if (error instanceof OpenAI.APIError) {
        throw new OpenAIError(
          `OpenAI API error: ${error.message}`,
          'API_ERROR',
          error
        );
      }

      throw new OpenAIError(
        `Failed to convert PDF to TestSpec: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'CONVERSION_FAILED',
        error
      );
    }
  }

  /**
   * Build system prompt for OpenAI
   */
  private buildSystemPrompt(): string {
    return `You are an expert in web testing and analytics. Your task is to convert PDF slide deck content into a structured TestSpec JSON that can be executed by an automated testing framework.

CRITICAL REQUIREMENTS:
1. Return ONLY a valid JSON object conforming to the TestSpec schema below
2. Include confidence scores (0.0-1.0) for each step based on clarity of instructions
3. Surface ambiguous targets with suggested alternatives
4. Focus on user interactions that would trigger analytics events
5. Be specific with selectors and expectations

TestSpec Schema:
{
  "site": "https://example.com",
  "allowed_hosts": ["example.com"],
  "consent": ["accept", "reject"],
  "tests": [
    {
      "section": "Header Navigation",
      "steps": [
        {
          "description": "Click on main logo",
          "action": "click",
          "target": {
            "region": "header",
            "kind": "text|selector|aria|href",
            "value": "specific value"
          },
          "expect": [
            {
              "type": "dataLayer|ga4|gtm|network|navigation|no_repeat_on_reload",
              "event": "event_name",
              "params_subset": {"key": "value"}
            }
          ],
          "confidence": 0.9
        }
      ]
    }
  ]
}

Target Types:
- "text": Visible text content (e.g., "Buy Now", "Add to Cart")
- "selector": CSS selector (e.g., "#buy-button", ".add-to-cart")
- "aria": ARIA attributes (e.g., "aria-label='Buy Product'")
- "href": Link URLs (e.g., "/checkout", "https://example.com/shop")

Expectation Types:
- "dataLayer": dataLayer.push events with event name and params
- "ga4": Google Analytics 4 hits (collect?v=2)
- "gtm": Google Tag Manager events
- "network": Network requests to tracking domains
- "navigation": URL changes or page navigation
- "no_repeat_on_reload": Events that shouldn't repeat on page reload

Confidence Guidelines:
- 0.9-1.0: Very clear, specific instructions with unique targets
- 0.7-0.8: Clear instructions but potentially ambiguous targets
- 0.5-0.6: Unclear instructions or multiple possible interpretations
- 0.0-0.4: Very ambiguous or impossible to determine from content

Ambiguity Handling:
- For confidence < 0.6, suggest alternative targets
- For vague targets like "all buttons", provide specific examples
- For unclear expectations, suggest common analytics events

Focus on:
- E-commerce flows (product view, add to cart, checkout, purchase)
- Navigation interactions (menu clicks, page transitions)
- Form submissions and user inputs
- Button clicks that trigger analytics
- Consent management interactions

Avoid:
- Pure content display steps without user interaction
- Steps that don't relate to analytics or user flows
- Overly complex multi-step actions in single steps`;
  }

  /**
   * Build user prompt with PDF content and target URL
   */
  private buildUserPrompt(pdfText: string, targetUrl: string): string {
    return `Please convert the following PDF slide deck content into a TestSpec JSON for automated testing of the website: ${targetUrl}

PDF Content:
${pdfText}

Instructions:
1. Extract user interaction steps from the slide deck
2. Create test sections based on the content flow (e.g., "Header", "Product Selection", "Checkout")
3. For each step, specify the action, target, and expected analytics events
4. Use appropriate confidence scores based on instruction clarity
5. Include both "accept" and "reject" consent profiles if consent management is mentioned
6. Focus on steps that would generate dataLayer events, GA4 hits, or other tracking

Return the complete TestSpec JSON with confidence scores and any ambiguous targets.`;
  }

  /**
   * Validate TestSpec against schema
   */
  private validateTestSpec(data: any): TestSpec {
    try {
      return TestSpecSchema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationErrors = error.errors.map(err => 
          `${err.path.join('.')}: ${err.message}`
        ).join('; ');
        
        throw new OpenAIError(
          `TestSpec validation failed: ${validationErrors}`,
          'VALIDATION_FAILED',
          error
        );
      }
      throw error;
    }
  }

  /**
   * Extract ambiguities from low-confidence steps
   */
  private extractAmbiguities(dsl: TestSpec): Ambiguity[] {
    const ambiguities: Ambiguity[] = [];

    dsl.tests.forEach((test, testIndex) => {
      test.steps.forEach((step, stepIndex) => {
        if (step.confidence && step.confidence < 0.6) {
          const stepPath = `tests[${testIndex}].steps[${stepIndex}]`;
          
          // Generate candidate targets based on the step
          const candidates = this.generateCandidateTargets(step);
          
          ambiguities.push({
            stepPath,
            reason: this.generateAmbiguityReason(step),
            candidates,
          });
        }
      });
    });

    return ambiguities;
  }

  /**
   * Generate candidate targets for ambiguous steps
   */
  private generateCandidateTargets(step: any): any[] {
    const candidates: any[] = [];
    
    if (step.target) {
      // Add the original target
      candidates.push(step.target);
      
      // Generate alternatives based on the action and description
      if (step.action === 'click' && step.description) {
        // Try different target types for the same action
        const description = step.description.toLowerCase();
        
        if (description.includes('button')) {
          candidates.push({
            kind: 'selector',
            value: 'button',
          });
        }
        
        if (description.includes('link') || description.includes('menu')) {
          candidates.push({
            kind: 'href',
            value: '/',
          });
        }
        
        if (description.includes('aria') || description.includes('accessible')) {
          candidates.push({
            kind: 'aria',
            value: 'button',
          });
        }
      }
    }
    
    return candidates;
  }

  /**
   * Generate reason for ambiguity
   */
  private generateAmbiguityReason(step: any): string {
    if (step.confidence && step.confidence < 0.4) {
      return 'Very ambiguous target - multiple possible interpretations';
    } else if (step.confidence && step.confidence < 0.6) {
      return 'Unclear target specification - consider more specific selectors';
    } else {
      return 'Target may need refinement for reliable execution';
    }
  }
}
