import OpenAI from 'openai';

// Types for PDF Spec response
export interface PdfSpecResponse {
  version: string;
  spec: {
    steps: Array<{
      description: string;
      action: string;
      target?: {
        selector?: string;
        text?: string;
        region?: string;
      };
      value?: string;
      expect?: Array<{
        type: string;
        event?: string;
        params?: any;
      }>;
    }>;
    assertions: Array<{
      description: string;
      type: string;
      condition: string;
      expected?: any;
    }>;
  };
  notes: string;
}

export class LlmPdfSpecError extends Error {
  constructor(
    message: string,
    public code: 'INVALID_JSON' | 'API_ERROR' | 'TIMEOUT' | 'RATE_LIMIT' | 'EMPTY_PDF_TEXT'
  ) {
    super(message);
    this.name = 'LlmPdfSpecError';
  }
}

export class LlmPdfSpecService {
  private client: OpenAI;
  private model: string;
  private timeout: number;

  constructor(apiKey: string, model: string = 'gpt-4o-mini', timeout: number = 60000) {
    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }

    this.client = new OpenAI({
      apiKey,
      timeout: timeout,
    });
    this.model = model;
    this.timeout = timeout;
  }

  /**
   * Generate PDF spec from PDF text using LLM
   * @param params Object containing pdfText (required), url and htmlPath (optional)
   * @returns PdfSpecResponse or null if pdfText is empty
   */
  async llmPdfSpec({ 
    pdfText, 
    url, 
    htmlPath 
  }: { 
    pdfText: string; 
    url?: string; 
    htmlPath?: string; 
  }): Promise<PdfSpecResponse | null> {
    try {
      // Check if pdfText is empty
      if (!pdfText || pdfText.trim().length === 0) {
        return null;
      }

      // Prepare the prompt
      const systemPrompt = this.getSystemPrompt();
      const userPrompt = this.getUserPrompt(pdfText, url, htmlPath);

      // Call OpenAI
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1, // Low temperature for consistent output
        max_tokens: 4000,
      });

      // Validate response
      if (!response.choices || response.choices.length === 0) {
        throw new LlmPdfSpecError('No response from OpenAI', 'API_ERROR');
      }

      const content = response.choices[0].message?.content;
      if (!content) {
        throw new LlmPdfSpecError('Empty response from OpenAI', 'API_ERROR');
      }

      // Parse and validate JSON response
      let pdfSpec: PdfSpecResponse;
      try {
        const parsed = JSON.parse(content);
        
        // Basic validation of required fields
        if (!parsed.version || !parsed.spec || !parsed.notes) {
          throw new LlmPdfSpecError('Invalid JSON structure: missing required fields', 'INVALID_JSON');
        }

        if (!parsed.spec.steps || !Array.isArray(parsed.spec.steps)) {
          throw new LlmPdfSpecError('Invalid JSON structure: spec.steps must be an array', 'INVALID_JSON');
        }

        if (!parsed.spec.assertions || !Array.isArray(parsed.spec.assertions)) {
          throw new LlmPdfSpecError('Invalid JSON structure: spec.assertions must be an array', 'INVALID_JSON');
        }

        pdfSpec = parsed as PdfSpecResponse;
      } catch (parseError) {
        if (parseError instanceof LlmPdfSpecError) {
          throw parseError;
        }
        throw new LlmPdfSpecError(
          `Invalid JSON response from OpenAI: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
          'INVALID_JSON'
        );
      }

      return pdfSpec;

    } catch (error) {
      if (error instanceof LlmPdfSpecError) {
        throw error;
      }

      // Handle OpenAI API errors
      if (error instanceof Error) {
        if (error.message.includes('timeout')) {
          throw new LlmPdfSpecError('OpenAI request timeout', 'TIMEOUT');
        }
        
        if (error.message.includes('rate limit')) {
          throw new LlmPdfSpecError('OpenAI rate limit exceeded', 'RATE_LIMIT');
        }

        if (error.message.includes('API key')) {
          throw new LlmPdfSpecError('Invalid OpenAI API key', 'API_ERROR');
        }

        if (error.message.includes('quota')) {
          throw new LlmPdfSpecError('OpenAI quota exceeded', 'API_ERROR');
        }
      }

      throw new LlmPdfSpecError(
        `LLM PDF Spec error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'API_ERROR'
      );
    }
  }

  /**
   * Get the system prompt for PDF spec generation
   */
  private getSystemPrompt(): string {
    return `Sei un assistente che genera una specifica di test (JSON) per attività descritte in un PDF.

REGOLE IMPORTANTI:
- IGNORA completamente il cookie banner (viene testato separatamente).
- Output SOLO JSON valido con struttura:
{
  "version": "1.0",
  "spec": { "steps": [...], "assertions": [...] },
  "notes": "..."
}
- Steps deterministici; assertion su dati osservabili; se il selettore non è ricavabile dal PDF metti "selector": "to-be-determined" e spiega in "notes".`;
  }

  /**
   * Get the user prompt with PDF text and optional context
   */
  private getUserPrompt(pdfText: string, url?: string, htmlPath?: string): string {
    let prompt = `CONTESTO:`;

    if (url) {
      prompt += `\n- URL: ${url}`;
    }

    if (htmlPath) {
      prompt += `\n- HTML (solo contesto, path su disco): ${htmlPath}`;
    }

    prompt += `\n- TESTO PDF (fonte autorevole):
"""
${pdfText}
"""`;

    return prompt;
  }
}

// Convenience function for easy usage
export async function llmPdfSpec({ 
  pdfText, 
  url, 
  htmlPath 
}: { 
  pdfText: string; 
  url?: string; 
  htmlPath?: string; 
}): Promise<PdfSpecResponse | null> {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new LlmPdfSpecError('OpenAI API key not found in environment variables', 'API_ERROR');
  }

  const service = new LlmPdfSpecService(apiKey);
  return await service.llmPdfSpec({ pdfText, url, htmlPath });
}
