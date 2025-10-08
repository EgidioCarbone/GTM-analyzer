// LLM PDF Spec Service
// Converts PDF text to test specification using LLM
// ============================================================================

import OpenAI from 'openai';
import { TestSpec } from '../types/ssd';

export interface LLMPdfSpecOptions {
  url: string;
  pdfText: string;
  htmlPath?: string;
}

export interface LLMPdfSpecResult {
  spec: TestSpec;
  warnings?: string[];
}

export class LLMPdfSpecService {
  private openai: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string = 'gpt-4o-mini') {
    this.openai = new OpenAI({ apiKey });
    this.model = model;
  }

  async generatePdfSpec(options: LLMPdfSpecOptions): Promise<LLMPdfSpecResult> {
    const { url, pdfText, htmlPath } = options;

    if (!pdfText || pdfText.trim().length === 0) {
      throw new Error('PDF_EMPTY: PDF text content is empty');
    }

    try {
      // Read HTML content if htmlPath is provided
      let htmlContent = '';
      if (htmlPath) {
        const fs = await import('fs/promises');
        try {
          htmlContent = await fs.readFile(htmlPath, 'utf-8');
        } catch (error) {
          console.warn('Could not read HTML file:', error);
        }
      }

      // Build the prompt
      const prompt = this.buildPrompt(url, pdfText, htmlContent);

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
        temperature: 0.1,
        max_tokens: 4000,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No content received from OpenAI');
      }

      // Parse the JSON response
      let spec: TestSpec;
      try {
        const parsed = JSON.parse(content);
        spec = parsed as TestSpec;
      } catch (error) {
        throw new Error(`Failed to parse LLM response as JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Generate warnings
      const warnings = this.generateWarnings(pdfText, spec);

      return {
        spec,
        warnings: warnings.length > 0 ? warnings : undefined,
      };

    } catch (error) {
      if (error instanceof Error && error.message === 'PDF_EMPTY: PDF text content is empty') {
        throw error;
      }
      throw new Error(`LLM PDF spec generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private getSystemPrompt(): string {
    return `You are an expert in converting website testing specifications from natural language into structured test DSL.

Your task is to convert PDF slide deck content into a structured test specification that can be executed by an automated testing framework.

CRITICAL REQUIREMENTS:
1. Output SOLO JSON valido con questa struttura ESATTA:
{
  "tests": [
    {
      "section": "Header Navigation",
      "steps": [
        {
          "action": "click",
          "target": { "kind": "selector", "value": "<css selector>" },
          "expect": [
            { "type": "dataLayer", "event": "header_menu_click", "params_subset": { "link_text": "*", "link_url": "*", "index": "*" } }
          ]
        }
      ]
    }
  ]
}

2. Non usare proprietà chiamate "test_spec" o "expectations".
3. Non generare codice eseguibile, SOLO JSON.
4. Se un selettore non è certo dal PDF, usa "selector": "to-be-determined" e metti una nota in un campo "notes" a livello di test (NON serve per il runner).
5. IGNORA completamente il cookie banner (già testato altrove).
6. Do NOT include any explanatory text outside the JSON
7. Use response_format: json_object as specified
8. Assign confidence scores (0-1) to each step based on clarity
9. Flag ambiguous targets with confidence < 0.6
10. Never include PII, credentials, or sensitive data in targets
11. Focus on user-facing actions and measurable outcomes

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

  private buildPrompt(url: string, pdfText: string, htmlContent: string): string {
    let prompt = `Convert this PDF slide deck content into a structured test specification for the website: ${url}

PDF CONTENT:
${pdfText}

TARGET WEBSITE: ${url}

`;

    if (htmlContent) {
      const truncatedHtml = htmlContent.length > 50000 ? 
        htmlContent.substring(0, 50000) + '\n\n[HTML CONTENT TRUNCATED...]' : 
        htmlContent;
      
      prompt += `HTML CONTENT OF THE WEBSITE:
\`\`\`html
${truncatedHtml}
\`\`\`

Please analyze the HTML to generate accurate selectors for the test specification.

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
8. IGNORA completamente il cookie banner (già testato altrove)
9. Se un selettore non è certo dal PDF, usa "selector": "to-be-determined" e metti una nota in un campo "notes" a livello di test

OUTPUT: SOLO JSON valido con la struttura ESATTA del runner:
{
  "tests": [
    {
      "section": "Header Navigation",
      "steps": [
        {
          "action": "click",
          "target": { "kind": "selector", "value": "<css selector>" },
          "expect": [
            { "type": "dataLayer", "event": "header_menu_click", "params_subset": { "link_text": "*", "link_url": "*", "index": "*" } }
          ]
        }
      ]
    }
  ]
}

Non usare proprietà chiamate "test_spec" o "expectations". Non generare codice eseguibile, SOLO JSON.`;

    return prompt;
  }

  private generateWarnings(pdfText: string, spec: TestSpec): string[] {
    const warnings: string[] = [];

    // Check for very short PDF content
    if (pdfText.length < 500) {
      warnings.push('PDF content is very short - may lack sufficient detail for comprehensive testing');
    }

    // Check for high ambiguity ratio
    const totalSteps = spec.tests?.reduce((sum, test) => sum + (test.steps?.length || 0), 0) || 0;
    const ambiguousSteps = spec.tests?.reduce((count, test) => {
      return count + (test.steps?.filter(step => (step.confidence || 1) < 0.6).length || 0);
    }, 0) || 0;
    
    if (totalSteps > 0 && ambiguousSteps / totalSteps > 0.3) {
      warnings.push('High number of ambiguous steps detected - manual review recommended');
    }

    // Check for missing expectations
    const stepsWithoutExpectations = spec.tests?.reduce((count, test) => {
      return count + (test.steps?.filter(step => !step.expect || step.expect.length === 0).length || 0);
    }, 0) || 0;
    
    if (stepsWithoutExpectations > 0) {
      warnings.push(`${stepsWithoutExpectations} steps lack expectations - test validation may be limited`);
    }

    return warnings;
  }
}

// Factory function to create service instance
export function createLLMPdfSpecService(apiKey: string, model?: string): LLMPdfSpecService {
  if (!apiKey) {
    throw new Error('OpenAI API key is required');
  }
  return new LLMPdfSpecService(apiKey, model);
}

// Convenience function for direct usage
export async function llmPdfSpec(options: LLMPdfSpecOptions): Promise<TestSpec> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }
  
  const service = createLLMPdfSpecService(apiKey);
  const result = await service.generatePdfSpec(options);
  return result.spec;
}
