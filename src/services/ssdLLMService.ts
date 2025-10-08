// SSD LLM Service for PDF to DSL Conversion
// ============================================================================

import OpenAI from 'openai';
import { TestSpec, Ambiguity } from '../types/ssd';
import { validateTestSpec, detectAmbiguities } from './ssdValidation';

export interface LLMConversionResult {
  dsl: TestSpec;
  ambiguities: Ambiguity[];
  meta: {
    tokens: number;
    model: string;
    ingestionWarnings: string[];
  };
}

export class SSDLLMService {
  private openai: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string = 'gpt-4o-mini') {
    this.openai = new OpenAI({ apiKey });
    this.model = model;
  }

  async convertPDFToDSL(
    pdfText: string,
    targetUrl: string,
    structuredContent?: {
      titles: string[];
      bullets: string[];
      speakerNotes: string[];
    }
  ): Promise<LLMConversionResult> {
    try {
      // Prepare the prompt
      const prompt = this.buildConversionPrompt(pdfText, targetUrl, structuredContent);
      
      // Call OpenAI API
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt(),
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1, // Low temperature for consistent output
        max_tokens: 4000,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No content received from OpenAI');
      }

      // Parse and validate the JSON response
      let dsl: TestSpec;
      try {
        const parsed = JSON.parse(content);
        const validation = validateTestSpec(parsed);
        if (!validation.success) {
          throw new Error(`Invalid DSL structure: ${validation.error}`);
        }
        dsl = validation.data;
      } catch (error) {
        throw new Error(`Failed to parse DSL JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Detect ambiguities
      const ambiguities = detectAmbiguities(dsl);

      // Generate ingestion warnings
      const ingestionWarnings = this.generateIngestionWarnings(pdfText, dsl, ambiguities);

      return {
        dsl,
        ambiguities,
        meta: {
          tokens: response.usage?.total_tokens || 0,
          model: this.model,
          ingestionWarnings,
        },
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`LLM conversion failed: ${error.message}`);
      }
      throw new Error('LLM conversion failed: Unknown error');
    }
  }

  private getSystemPrompt(): string {
    return `You are an expert in converting website testing specifications from natural language into structured test DSL.

Your task is to convert PDF slide deck content (typically from PowerPoint presentations) into a structured test specification that can be executed by an automated testing framework.

CRITICAL REQUIREMENTS:
1. Output ONLY valid JSON conforming to the TestSpec schema
2. Do NOT include any explanatory text outside the JSON
3. Use response_format: json_object as specified
4. Assign confidence scores (0-1) to each step based on clarity
5. Flag ambiguous targets with confidence < 0.6
6. Never include PII, credentials, or sensitive data in targets
7. Focus on user-facing actions and measurable outcomes

TARGET RESOLUTION GUIDELINES:
- Prefer semantic selectors (aria-label, data-testid) over CSS selectors
- Use text content when elements have unique, stable text
- For buttons/links, prefer text over href when possible
- Group related steps into logical sections (Header, Checkout, etc.)
- Include expectations for dataLayer events, network requests, and navigation

CONFIDENCE SCORING:
- 0.9-1.0: Very specific, unambiguous targets
- 0.7-0.8: Good targets with minor ambiguity
- 0.5-0.6: Ambiguous targets requiring disambiguation
- 0.0-0.4: Very unclear or missing information

Remember: The goal is to create executable test steps that can be run against the target website.`;
  }

  private buildConversionPrompt(
    pdfText: string,
    targetUrl: string,
    structuredContent?: {
      titles: string[];
      bullets: string[];
      speakerNotes: string[];
    }
  ): string {
    let prompt = `Convert this PDF slide deck content into a structured test specification for the website: ${targetUrl}

PDF CONTENT:
${pdfText}

TARGET WEBSITE: ${targetUrl}

`;

    if (structuredContent) {
      prompt += `STRUCTURED CONTENT ANALYSIS:
Titles: ${structuredContent.titles.join(', ')}
Key Bullets: ${structuredContent.bullets.slice(0, 10).join(', ')}
Speaker Notes: ${structuredContent.speakerNotes.slice(0, 5).join(', ')}

`;
    }

    prompt += `INSTRUCTIONS:
1. Analyze the content for testable user actions and flows
2. Create logical test sections (e.g., "Header Navigation", "Product Search", "Checkout Flow")
3. For each action, define clear targets and expectations
4. Include dataLayer event expectations where appropriate
5. Add network request expectations for tracking (GA4, GTM, etc.)
6. Mark ambiguous targets with low confidence scores
7. Ensure all steps are executable and measurable

OUTPUT: Valid JSON conforming to the TestSpec schema.`;

    return prompt;
  }

  private generateIngestionWarnings(
    pdfText: string,
    dsl: TestSpec,
    ambiguities: Ambiguity[]
  ): string[] {
    const warnings: string[] = [];

    // Check for very short PDF content
    if (pdfText.length < 500) {
      warnings.push('PDF content is very short - may lack sufficient detail for comprehensive testing');
    }

    // Check for high ambiguity ratio
    const totalSteps = dsl.tests.reduce((sum, test) => sum + test.steps.length, 0);
    const ambiguousSteps = ambiguities.length;
    if (totalSteps > 0 && ambiguousSteps / totalSteps > 0.3) {
      warnings.push('High number of ambiguous steps detected - manual review recommended');
    }

    // Check for missing expectations
    const stepsWithoutExpectations = dsl.tests.reduce((count, test) => {
      return count + test.steps.filter(step => !step.expect || step.expect.length === 0).length;
    }, 0);
    if (stepsWithoutExpectations > 0) {
      warnings.push(`${stepsWithoutExpectations} steps lack expectations - test validation may be limited`);
    }

    // Check for very low confidence steps
    const lowConfidenceSteps = dsl.tests.reduce((count, test) => {
      return count + test.steps.filter(step => (step.confidence || 1) < 0.5).length;
    }, 0);
    if (lowConfidenceSteps > 0) {
      warnings.push(`${lowConfidenceSteps} steps have very low confidence - manual verification needed`);
    }

    // Check for missing critical flows
    const hasCheckout = dsl.tests.some(test => 
      test.section.toLowerCase().includes('checkout') || 
      test.steps.some(step => step.action === 'complete_order')
    );
    if (!hasCheckout && pdfText.toLowerCase().includes('purchase')) {
      warnings.push('Purchase-related content detected but no checkout flow defined');
    }

    return warnings;
  }

  // Helper method to validate URL format
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}

// Factory function to create service instance
export function createSSDLLMService(apiKey: string, model?: string): SSDLLMService {
  if (!apiKey) {
    throw new Error('OpenAI API key is required');
  }
  return new SSDLLMService(apiKey, model);
}
