import OpenAI from 'openai';
import fsSync from 'fs';

export interface OpenAISpecResponse {
  dsl: any;
  meta: {
    model: string;
    tokens: {
      input: number;
      output: number;
    };
  };
}

export class OpenAIError extends Error {
  constructor(
    message: string,
    public code: 'API_ERROR' | 'TIMEOUT' | 'INVALID_RESPONSE' | 'RATE_LIMIT'
  ) {
    super(message);
    this.name = 'OpenAIError';
  }
}

export class OpenAISpecService {
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
   * Convert PDF text to TestSpec using OpenAI with the universal prompt
   * @param pdfText Extracted text from PDF
   * @param targetUrl Target website URL
   * @returns Generated DSL and metadata
   */
  async convertPDFToTestSpec(pdfText: string, targetUrl: string, customPrompt?: string): Promise<OpenAISpecResponse> {
    try {
      // Validate inputs
      if (!pdfText || pdfText.trim().length === 0) {
        throw new OpenAIError('PDF text is empty', 'INVALID_RESPONSE');
      }

      if (!targetUrl || !this.isValidUrl(targetUrl)) {
        throw new OpenAIError('Invalid target URL', 'INVALID_RESPONSE');
      }

      // Prepare the universal prompt
      const systemPrompt = this.getSystemPrompt();
      const userPrompt = customPrompt || this.getUserPrompt(targetUrl, pdfText);

      // Call OpenAI with structured output
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1, // Low temperature for consistent output
        max_tokens: 4000, // Reasonable limit for DSL generation
      });

      // Validate response
      if (!response.choices || response.choices.length === 0) {
        throw new OpenAIError('No response from OpenAI', 'INVALID_RESPONSE');
      }

      const content = response.choices[0].message?.content;
      if (!content) {
        throw new OpenAIError('Empty response from OpenAI', 'INVALID_RESPONSE');
      }

      // Parse JSON response
      let dsl;
      try {
        dsl = JSON.parse(content);
      } catch (parseError) {
        throw new OpenAIError(
          `Invalid JSON response from OpenAI: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
          'INVALID_RESPONSE'
        );
      }

      // Extract metadata
      const usage = response.usage;
      const meta = {
        model: response.model,
        tokens: {
          input: usage?.prompt_tokens || 0,
          output: usage?.completion_tokens || 0,
        }
      };

      return {
        dsl,
        meta
      };

    } catch (error) {
      if (error instanceof OpenAIError) {
        throw error;
      }

      // Handle OpenAI API errors
      if (error instanceof Error) {
        if (error.message.includes('timeout')) {
          throw new OpenAIError('OpenAI request timeout', 'TIMEOUT');
        }
        
        if (error.message.includes('rate limit')) {
          throw new OpenAIError('OpenAI rate limit exceeded', 'RATE_LIMIT');
        }

        if (error.message.includes('API key')) {
          throw new OpenAIError('Invalid OpenAI API key', 'API_ERROR');
        }

        if (error.message.includes('quota')) {
          throw new OpenAIError('OpenAI quota exceeded', 'API_ERROR');
        }
      }

      throw new OpenAIError(
        `OpenAI API error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'API_ERROR'
      );
    }
  }

  /**
   * Get the universal system prompt for DSL generation
   */
  private getSystemPrompt(): string {
    return `You are a test-spec compiler. Convert SSD text (extracted from a PDF) into a strict JSON Test Specification for a Puppeteer-based runner.

Universal rules:
- Output ONLY JSON conforming to the TestSpec schema (no prose).
- Must work on ANY site with NO brand-specific assumptions unless explicitly present in the SSD text.
- Targets priority: 1) "text" (visible label)  2) "aria"  3) "href" (partial/contains)  4) "selector" (last resort, generic and safe).
- Regions allowed: "header" | "main" | "footer" | "any". Coerce anything else to "any".
- Never emit literal placeholders like "[PRODUCT NAME]"; for variable values either omit the key or use wildcard "*".
- Expectations use SUBSET matching via "params_subset". Keep params minimal and stable.

Consent/CMP rule (very important):
- If a cookie banner can block interactions (even if not mentioned explicitly), ADD a first step that tries to ACCEPT ALL using generic selectors/text in multiple languages. Use a resilient selector that avoids dialogs:
  selector candidates to try (in order):
    1) button, [role="button"], input[type="button"], input[type="submit"]
    2) text matches (case-insensitive): "Accept all", "I agree", "Accept", "Allow all", "OK", "Ho capito", "Accetta", "Accetta tutto", "Consenti tutti", "Acconsento"
    3) common CMPs: 
       - Cookiebot: #CybotCookiebotDialogBodyButtonAccept, #CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll, #CybotCookiebotDialogBodyButtonAcceptAll
       - OneTrust: .onetrust-accept-btn-handler
       - IAB TCF: [id*="accept"], [id*="agree"]
  AND exclude hitting inside cookie dialogs for later steps using CSS negations like
    :not(#CybotCookiebotDialog, #CybotCookiebotDialog * , [class*="cookie" i], [id*="cookie" i], [aria-label*="cookie" i])

Header target rule (generic but robust):
- When the SSD says "header menu click", and labels are unknown, use a broad selector that covers common header containers, EXCLUDING cookie dialogs:
  "selector": ":is(header,[role='banner'],.header,#header,nav[aria-label*='menu' i],nav[aria-label*='navigation' i]) :is(a,button):not(#CybotCookiebotDialog * , [class*='cookie' i], [id*='cookie' i])"
- If labels are explicit in the SSD, prefer { "kind":"text", "value":"<label>" } with region "header" or "any".

Allowed hosts:
- Include ONLY the host and "www." of TARGET URL, plus subdomains explicitly present in the SSD text. Do not invent hosts.

Confidence:
- Set 0..1 per step. If instruction is generic (e.g., "click header link"), keep a generic target and lower confidence (~0.6–0.8).

IMPORTANT:
- Do not output empty fields (e.g., no empty "url_contains", "url_matches", "for_event").
- The "consent" field must ALWAYS be an array: ["accept"] or ["accept", "reject"] - never a string.
- The runner will execute EXACTLY what you return. Be precise and conservative.`;
  }

  /**
   * Get the user prompt with target URL and PDF text
   */
  private getUserPrompt(targetUrl: string, pdfText: string): string {
    return `TARGET URL:
${targetUrl}

TEST SPEC SCHEMA (do not echo):
{
  "site": "string",
  "allowed_hosts": ["string"],
  "consent": ["accept", "reject"],
  "tests": [
    {
      "section": "string",
      "steps": [
        {
          "description": "string",
          "action": "click|input|wait_for_selector|wait_for_text|navigate|custom",
          "target": { "region": "header|main|footer|any", "kind": "text|aria|href|selector", "value": "string" },
          "value": "string",
          "expect": [
            {
              "type": "dataLayer|ga4|gtm|network|navigation|no_repeat_on_reload",
              "event": "string",
              "params_subset": { "any": "object" }
            }
          ],
          "severity": "critical|major|minor",
          "confidence": 0.0
        }
      ]
    }
  ]
}

SSD TEXT (raw, from PDF):
<<<
${pdfText}
>>>

YOUR TASK:
- Produce a single TestSpec JSON for the TARGET URL.
- Add a FIRST STEP to accept cookies (as described in the system message) to avoid overlays blocking clicks.
- For "header menu click", if labels are missing, use the robust "header" selector from the system message (with cookie-dialog exclusions). If labels are present, use kind:"text".
- Use subset expectations with "*" wildcards for variable values.
- Build "allowed_hosts" from the URL host (+ "www.") and subdomains explicitly found in the SSD text only.
- IMPORTANT: The "consent" field must be an array of strings like ["accept", "reject"] or ["accept"] - never a single string.
- EXAMPLE: "consent": ["accept"] or "consent": ["accept", "reject"] - NOT "consent": "accept"
- Return ONLY JSON. No comments.`;
  }

  /**
   * Convert PDF and HTML files to TestSpec using OpenAI with file attachments
   * @param pdfFilePath Path to PDF file
   * @param htmlFilePath Path to HTML file
   * @param prompt Custom prompt for the test generation
   * @param targetUrl Target website URL
   * @returns Generated DSL and metadata
   */
  async convertPDFToTestSpecWithFiles(pdfFilePath: string, htmlFilePath: string, prompt: string, targetUrl: string): Promise<OpenAISpecResponse> {
    try {
      // Validate inputs (PDF file path is optional now, we use extracted text in prompt)
      if (!htmlFilePath) {
        throw new OpenAIError('HTML file path is required', 'INVALID_RESPONSE');
      }

      if (!targetUrl || !this.isValidUrl(targetUrl)) {
        throw new OpenAIError('Invalid target URL', 'INVALID_RESPONSE');
      }

      console.log('📝 Preparing HTML file for attachment...');
      
      // Create HTML file object for OpenAI
      const htmlFile = await this.client.files.create({
        file: fsSync.createReadStream(htmlFilePath),
        purpose: 'assistants'
      });

      console.log('✅ HTML file uploaded to OpenAI:', {
        htmlFileId: htmlFile.id
      });

      // Create enhanced prompt (without HTML content in text)
      const enhancedPrompt = `${prompt}

Note: I've attached the HTML content as a separate file. Use the HTML file to generate accurate selectors for the test specification.`;

      console.log('📤 Using Assistants API with HTML file attachment...');
      console.log('📋 Enhanced prompt length:', enhancedPrompt.length);

      // Create assistant
      const assistant = await this.client.beta.assistants.create({
        name: 'Web Test Generator',
        instructions: 'You are an expert in web testing. Generate test specifications based on PDF content and HTML files.',
        model: this.model,
        tools: [{ type: 'file_search' }],
      });

      console.log('✅ Assistant created:', assistant.id);

      // Create thread
      console.log('🔍 About to create thread...');
      const thread = await this.client.beta.threads.create();
      console.log('✅ Thread created:', thread.id);
      console.log('🔍 Thread object:', JSON.stringify(thread, null, 2));
      console.log('🔍 Thread ID type:', typeof thread.id, 'value:', thread.id);
      
      if (!thread.id) {
        throw new OpenAIError('Failed to create thread: thread.id is undefined', 'API_ERROR');
      }

      // Save thread ID to avoid reference issues
      const threadId = thread.id;
      console.log('🔒 Thread ID saved:', threadId);
      console.log('🔒 Thread ID type after save:', typeof threadId, 'value:', threadId);

      // Add message with file attachment
      await this.client.beta.threads.messages.create(threadId, {
        role: 'user',
        content: enhancedPrompt,
        attachments: [{ 
          file_id: htmlFile.id,
          tools: [{ type: 'file_search' }]
        }]
      });

      console.log('✅ Message with HTML file attachment added to thread');

      // Run assistant
      console.log('🔍 About to create run with threadId:', threadId);
      const run = await this.client.beta.threads.runs.create(threadId, {
        assistant_id: assistant.id,
      });

      console.log('✅ Run started:', run.id);
      console.log('🔍 Run object:', JSON.stringify(run, null, 2));
      console.log('🔍 Run ID type:', typeof run.id, 'value:', run.id);
      
      if (!run.id) {
        throw new OpenAIError('Failed to create run: run.id is undefined', 'API_ERROR');
      }

      // Save run ID to avoid reference issues
      const runId = run.id;
      console.log('🔒 Run ID saved:', runId);
      console.log('🔒 Run ID type after save:', typeof runId, 'value:', runId);

      // Wait for completion
      console.log('🔍 About to retrieve run status with:', { threadId, runId });
      console.log('🔍 Thread ID type:', typeof threadId, 'value:', threadId);
      console.log('🔍 Run ID type:', typeof runId, 'value:', runId);
      console.log('🔍 Client type:', typeof this.client);
      console.log('🔍 Client beta type:', typeof this.client.beta);
      console.log('🔍 Client beta threads type:', typeof this.client.beta.threads);
      console.log('🔍 Client beta threads runs type:', typeof this.client.beta.threads.runs);
      console.log('🔍 Client beta threads runs retrieve type:', typeof this.client.beta.threads.runs.retrieve);
      
      let runStatus = await this.client.beta.threads.runs.retrieve(threadId, runId);
      while (runStatus.status === 'queued' || runStatus.status === 'in_progress') {
        await new Promise(resolve => setTimeout(resolve, 1000));
        runStatus = await this.client.beta.threads.runs.retrieve(threadId, runId);
      }

      if (runStatus.status === 'failed') {
        throw new OpenAIError(`Assistant run failed: ${runStatus.last_error?.message}`, 'API_ERROR');
      }

      console.log('✅ Run completed with status:', runStatus.status);

      // Get messages
      const messages = await this.client.beta.threads.messages.list(threadId);
      const lastMessage = messages.data[0];
      
      if (!lastMessage || lastMessage.role !== 'assistant') {
        throw new OpenAIError('No response from assistant', 'INVALID_RESPONSE');
      }

      const content = lastMessage.content[0];
      if (content.type !== 'text') {
        throw new OpenAIError('Invalid response type from assistant', 'INVALID_RESPONSE');
      }

      // Parse JSON response
      let dsl;
      try {
        dsl = JSON.parse(content.text.value);
      } catch (parseError) {
        throw new OpenAIError(
          `Invalid JSON response from OpenAI: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
          'INVALID_RESPONSE'
        );
      }

      // Clean up resources
      try {
        await this.client.beta.assistants.del(assistant.id);
        await this.client.beta.threads.del(threadId);
        await this.client.files.del(htmlFile.id);
        console.log('✅ Resources cleaned up');
      } catch (cleanupError) {
        console.log('⚠️ Error cleaning up resources:', cleanupError.message);
      }

      // Extract metadata
      const meta = {
        model: this.model,
        tokens: {
          input: 0, // Assistants API doesn't provide token usage in response
          output: 0,
        }
      };

      return {
        dsl,
        meta
      };

    } catch (error) {
      if (error instanceof OpenAIError) {
        throw error;
      }

      // Handle OpenAI API errors
      if (error instanceof Error) {
        if (error.message.includes('timeout')) {
          throw new OpenAIError('OpenAI request timeout', 'TIMEOUT');
        }
        
        if (error.message.includes('rate limit')) {
          throw new OpenAIError('OpenAI rate limit exceeded', 'RATE_LIMIT');
        }

        if (error.message.includes('API key')) {
          throw new OpenAIError('Invalid OpenAI API key', 'API_ERROR');
        }

        if (error.message.includes('quota')) {
          throw new OpenAIError('OpenAI quota exceeded', 'API_ERROR');
        }
      }

      throw new OpenAIError(
        `OpenAI API error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'API_ERROR'
      );
    }
  }

  /**
   * Validate URL format
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}
