import OpenAI from 'openai';
import fsSync from 'fs';
import { SSD_DEFAULTS, getConfigValue } from '../config/ssd-defaults';
import type { ScenarioStep } from '../modules/types';
import type { TestSpec } from '../types/ssd';

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

export interface TestEvaluationStep {
  description?: string;
  status?: string;
  expectations?: any[];
  matchedEvent?: any;
  eventDetails?: any;
  capturedEvents?: any[];
  error?: string | null;
}

export interface TestEvaluationRequest {
  site: string;
  pdfText: string;
  steps: TestEvaluationStep[];
}

export interface TestEvaluationResponse {
  overallStatus: 'PASS' | 'FAIL';
  reasoning: string;
  stepFindings: Array<{
    description: string;
    status: 'PASS' | 'FAIL';
    message: string;
  }>;
  suggestedFixes?: string[];
}

export interface ScenarioSpecBuildStep {
  id: string;
  type: ScenarioStep['type'] | string;
  label?: string;
  selector?: string;
  description?: string;
  value?: string;
  delayAfterMs?: number;
}

export interface ScenarioSpecBuildInput {
  moduleId: string;
  moduleName: string;
  moduleDescription?: string;
  targetUrl: string;
  cmp?: {
    vendor?: string;
    acceptAllSelector?: string;
    rejectAllSelector?: string;
    notes?: string;
  };
  scenarioName: string;
  eventId: string;
  steps: ScenarioSpecBuildStep[];
  expectedPayload: any | null;
  expectationTemplate?: any | null;
}

export interface ScenarioPayloadMatchRequest {
  site: string;
  scenarioName?: string;
  expectedEventName?: string;
  expectedPayload: any;
  normalizedExpectedPayload?: any;
  capturedEvents: any[];
}

export interface ScenarioPayloadMatchResponse {
  status: 'MATCH' | 'NO_MATCH';
  matchedEventIndex: number | null;
  reasoning: string;
  matchedEvent?: any;
  confidence?: number | null;
}

export interface ConsentValidationRequest {
  site: string;
  cmpVendor?: string | null;
  selector?: string | null;
  capturedEvents: Array<{ timestamp: number; payload: any }>;
}

export interface ConsentValidationResponse {
  status: 'ACCEPTED' | 'REJECTED' | 'UNKNOWN';
  reasoning: string;
  evidence?: string[];
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

  async evaluateTestOutcome(request: TestEvaluationRequest): Promise<TestEvaluationResponse> {
    const { site, pdfText, steps } = request;

    if (!pdfText || pdfText.trim().length === 0) {
      throw new OpenAIError('PDF text is empty', 'INVALID_RESPONSE');
    }

    if (!Array.isArray(steps) || steps.length === 0) {
      throw new OpenAIError('Steps array is empty', 'INVALID_RESPONSE');
    }

    const truncatedPdf = this.truncateText(
      pdfText,
      getConfigValue('PDF_MAX_LENGTH', SSD_DEFAULTS.content.maxPdfLength, val => Number.parseInt(val, 10))
    );

    const stepsSummary = steps.map(step => ({
      description: step.description || 'No description',
      status: step.status || 'UNKNOWN',
      expectations: step.expectations || [],
      matchedEvent: step.matchedEvent || step.eventDetails?.payload || null,
      capturedEvents: step.capturedEvents || [],
      error: step.error || null,
    }));

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: this.getEvaluationSystemPrompt() },
        { role: 'user', content: this.buildEvaluationPrompt(site, truncatedPdf, stepsSummary) },
      ],
      response_format: { type: 'json_object' },
      temperature: SSD_DEFAULTS.llm.temperature.evaluation ?? 0,
      max_tokens: SSD_DEFAULTS.llm.maxTokens.evaluation ?? 1200,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new OpenAIError('Empty response from OpenAI during evaluation', 'INVALID_RESPONSE');
    }

    try {
      return JSON.parse(content) as TestEvaluationResponse;
    } catch (error) {
      throw new OpenAIError(
        `Invalid JSON response from OpenAI evaluation: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'INVALID_RESPONSE'
      );
    }
  }

  async evaluateScenarioDataLayerMatch(
    request: ScenarioPayloadMatchRequest
  ): Promise<ScenarioPayloadMatchResponse> {
    const sliceLimit = Math.min(
      Number.parseInt(process.env.SSD_SCENARIO_EVENT_LIMIT ?? '25', 10),
      50
    );
    const startIndex =
      request.capturedEvents.length > sliceLimit
        ? request.capturedEvents.length - sliceLimit
        : 0;
    const truncatedEvents = request.capturedEvents.slice(startIndex);

    const payload = {
      site: request.site,
      scenarioName: request.scenarioName ?? null,
      expectedEventName: request.expectedEventName ?? null,
      expectedPayload: request.expectedPayload,
      normalizedExpectedPayload: request.normalizedExpectedPayload ?? null,
      capturedEvents: truncatedEvents,
      totalCapturedEvents: request.capturedEvents.length,
      startIndex,
    };

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: this.getScenarioValidationSystemPrompt() },
        { role: 'user', content: this.buildScenarioValidationPrompt(payload) },
      ],
      response_format: { type: 'json_object' },
      temperature: SSD_DEFAULTS.llm.temperature.evaluation ?? 0,
      max_tokens: 800,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new OpenAIError('Empty response from OpenAI during scenario validation', 'INVALID_RESPONSE');
    }

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      throw new OpenAIError(
        `Invalid JSON response from OpenAI scenario validation: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        'INVALID_RESPONSE'
      );
    }

    const status = parsed.status === 'MATCH' ? 'MATCH' : 'NO_MATCH';
    const matchedIndex =
      typeof parsed.matched_event_index === 'number'
        ? parsed.matched_event_index
        : typeof parsed.matchedEventIndex === 'number'
        ? parsed.matchedEventIndex
        : null;

    return {
      status,
      matchedEventIndex: matchedIndex,
      reasoning:
        typeof parsed.reasoning === 'string'
          ? parsed.reasoning
          : 'Nessuna motivazione fornita.',
      matchedEvent: parsed.matched_event ?? parsed.matchedEvent ?? null,
      confidence:
        typeof parsed.confidence === 'number'
          ? parsed.confidence
          : null,
    };
  }

  async evaluateConsentValidation(
    request: ConsentValidationRequest
  ): Promise<ConsentValidationResponse> {
    const sliceLimit = Math.min(
      Number.parseInt(process.env.SSD_SCENARIO_EVENT_LIMIT ?? '25', 10),
      50
    );
    const startIndex =
      request.capturedEvents.length > sliceLimit
        ? request.capturedEvents.length - sliceLimit
        : 0;
    const truncatedEvents = request.capturedEvents.slice(startIndex);

    const payload = {
      site: request.site,
      cmpVendor: request.cmpVendor ?? null,
      selector: request.selector ?? null,
      totalCapturedEvents: request.capturedEvents.length,
      startIndex,
      events: truncatedEvents,
    };

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: this.getConsentValidationSystemPrompt() },
        { role: 'user', content: this.buildConsentValidationPrompt(payload) },
      ],
      response_format: { type: 'json_object' },
      temperature: SSD_DEFAULTS.llm.temperature.evaluation ?? 0,
      max_tokens: 600,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new OpenAIError('Empty response from OpenAI during consent validation', 'INVALID_RESPONSE');
    }

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      throw new OpenAIError(
        `Invalid JSON response from OpenAI consent validation: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        'INVALID_RESPONSE'
      );
    }

    const normalizedStatus =
      typeof parsed.status === 'string' ? parsed.status.toUpperCase() : 'UNKNOWN';
    const status: ConsentValidationResponse['status'] =
      normalizedStatus === 'ACCEPTED'
        ? 'ACCEPTED'
        : normalizedStatus === 'REJECTED'
        ? 'REJECTED'
        : 'UNKNOWN';

    const evidence =
      Array.isArray(parsed.evidence) && parsed.evidence.length > 0
        ? parsed.evidence.filter((item: unknown) => typeof item === 'string')
        : undefined;

    return {
      status,
      reasoning:
        typeof parsed.reasoning === 'string'
          ? parsed.reasoning
          : 'Nessuna motivazione fornita.',
      evidence,
    };
  }

  async buildScenarioTestSpec(input: ScenarioSpecBuildInput): Promise<OpenAISpecResponse> {
    const systemPrompt = this.getScenarioSystemPrompt();
    const userPrompt = this.buildScenarioPrompt(input);

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: SSD_DEFAULTS.llm.temperature.specGeneration ?? 0.2,
      max_tokens: SSD_DEFAULTS.llm.maxTokens.specGeneration ?? 4000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new OpenAIError('Empty response from OpenAI (scenario spec)', 'INVALID_RESPONSE');
    }

    let parsed: TestSpec;
    try {
      parsed = JSON.parse(content) as TestSpec;
    } catch (error) {
      throw new OpenAIError(
        `Invalid JSON response from OpenAI (scenario spec): ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        'INVALID_RESPONSE'
      );
    }

    const usage = response.usage;
    const meta = {
      model: response.model,
      tokens: {
        input: usage?.prompt_tokens || 0,
        output: usage?.completion_tokens || 0,
      },
    };

    return {
      dsl: parsed,
      meta,
    };
  }

  /**
   * Get the universal system prompt for DSL generation
   */
  private getSystemPrompt(): string {
    return `You are a test-spec compiler. Convert SDD text (extracted from a PDF) into a strict JSON Test Specification for a Puppeteer-based runner.

Universal rules:
- Output ONLY JSON conforming to the TestSpec schema (no prose).
- Must work on ANY site with NO brand-specific assumptions unless explicitly present in the SDD text.
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
- Include ONLY the host and "www." of TARGET URL, plus subdomains explicitly present in the SDD text. Do not invent hosts.

Confidence:
- Set 0..1 per step. If instruction is generic (e.g., "click header link"), keep a generic target and lower confidence (~0.6–0.8).

IMPORTANT:
- Do not output empty fields (e.g., no empty "url_contains", "url_matches", "for_event").
- The "consent" field must ALWAYS be an array: ["accept"] or ["accept", "reject"] - never a string.
- The runner will execute EXACTLY what you return. Be precise and conservative.`;
  }

  private getScenarioValidationSystemPrompt(): string {
    return `You are an analytics QA assistant. Determine whether any captured dataLayer payload matches the expected event structure.

Rules:
- Treat "*" in the normalized expected payload as a wildcard meaning any non-empty value.
- Treat placeholder strings in the original payload (e.g. "[NOME PRODOTTO]") as wildcards.
- Compare object structures using subset semantics: the captured event may contain additional fields.
- If "expectedEventName" is provided, the event field must match (case-insensitive).
- Consider array order when relevant, but allow extra items unless explicitly constrained.
- The captured events array may be truncated; "startIndex" indicates the absolute index of the first event in the provided list.

Respond ONLY with JSON containing:
{
  "status": "MATCH" | "NO_MATCH",
  "matched_event_index": number | null,  // absolute index considering startIndex
  "matched_event": object | null,
  "reasoning": string,
  "confidence": number | null
}`;
  }

  private buildScenarioValidationPrompt(payload: {
    site: string;
    scenarioName: string | null;
    expectedEventName: string | null;
    expectedPayload: any;
    normalizedExpectedPayload: any;
    capturedEvents: any[];
    totalCapturedEvents: number;
    startIndex: number;
  }): string {
    return `Confronta il payload atteso con gli eventi catturati nel dataLayer.

CONTESTO:
${JSON.stringify(
  {
    site: payload.site,
    scenarioName: payload.scenarioName,
    expectedEventName: payload.expectedEventName,
    expectedPayload: payload.expectedPayload,
    normalizedExpectedPayload: payload.normalizedExpectedPayload,
    totalCapturedEvents: payload.totalCapturedEvents,
    startIndex: payload.startIndex,
  },
  null,
  2
)}

EVENTI CATTURATI (indice assoluto = startIndex + posizione):
${JSON.stringify(payload.capturedEvents, null, 2)}

TASK:
- Indica se esiste un evento che corrisponde al payload atteso.
- Usa "MATCH" se trovi un evento compatibile, altrimenti "NO_MATCH".
- Se trovi un match, restituisci l'indice assoluto (startIndex + indice locale) in "matched_event_index".
- Includi "matched_event" con il payload dell'evento compatibile se trovato.
- Fornisci una breve spiegazione in italiano nel campo "reasoning".
- Opzionalmente assegna "confidence" tra 0 e 1.`;
  }

  private getConsentValidationSystemPrompt(): string {
    return `Sei un assistente QA per la gestione del consenso. Analizza la sequenza di eventi dataLayer e stabilisci se il banner cookie è stato accettato con successo.

Linee guida:
- "ACCEPTED": esistono segnali che confermano la concessione dei consensi (es. eventi come "cookie_consent_update" con valori granted, GTM consent mode impostato su granted per tutti gli storage, ecc.).
- "REJECTED": trovi eventi che indicano rifiuto o assenza di consensi (es. stati denied/pending).
- "UNKNOWN": i dati non permettono di derivare l'esito.
- Riassumi i segnali più rilevanti in "evidence".

Rispondi SOLO con JSON:
{
  "status": "ACCEPTED" | "REJECTED" | "UNKNOWN",
  "reasoning": "string",
  "evidence": ["signal1", "signal2"]
}`;
  }

  private buildConsentValidationPrompt(payload: {
    site: string;
    cmpVendor: string | null;
    selector: string | null;
    totalCapturedEvents: number;
    startIndex: number;
    events: any[];
  }): string {
    return `Valuta se il banner cookie risulta accettato.

CONTESTO:
${JSON.stringify(
  {
    site: payload.site,
    cmpVendor: payload.cmpVendor,
    selector: payload.selector,
    totalCapturedEvents: payload.totalCapturedEvents,
    startIndex: payload.startIndex,
  },
  null,
  2
)}

EVENTI CATTURATI (in ordine cronologico):
${JSON.stringify(payload.events, null, 2)}

ISTRUZIONI:
- Analizza gli eventi e determina lo stato complessivo del consenso.
- Elenca nella proprietà "evidence" i segnali più significativi (es. nome evento o proprietà rilevati).
- Scrivi il reasoning in italiano, conciso e diretto.`;
  }

  private getScenarioSystemPrompt(): string {
    return `You are an expert SDD Test spec builder. Given scenario information (URL, module metadata, CMP selector, optional user-defined interaction steps) produce a STRICT TestSpec JSON ready for execution by a Puppeteer runner.

Hard constraints:
- Output ONLY JSON that matches the TestSpec schema (no prose or comments).
- The spec must focus on reproducing the user's navigation and interaction steps. DO NOT add verification steps or dataLayer expectations.
- Avoid using action "custom". Use only navigate, click, input, wait_for_selector, wait_for_text, etc.
- Always include a first step that ACCEPTS the cookie banner using the provided CMP selector when available; otherwise use a generic, multilingual fallback as described below.
- Maintain the order of user-provided steps AFTER the cookie step. For steps without selectors infer conservative targets (prefer text/aria before selector).
- Ensure allowed_hosts only includes the main host of the URL plus "www." variant when relevant.
- consent MUST be an array (["accept"] or ["accept","reject"]).
- Fill meta.model with "scenario-llm::<moduleId>" and meta.moduleId with the module id.

Cookie acceptance rules:
- If an explicit selector is provided (cmp.actions.acceptAllButton), use it as a selector step labelled "Accetta tutti i cookie".
- If missing, use a resilient selector targeting buttons with text variations ("Accept all","Accetta","Consenti tutti","Allow all") while excluding cookie dialogs later (use :not() to avoid interfering elements).

General:
- Do not include expectations, dataLayer assertions, or additional checks.
- Do not leave empty arrays or null fields unless required.`;
  }

  private buildScenarioPrompt(input: ScenarioSpecBuildInput): string {
    const context = {
      module: {
        id: input.moduleId,
        name: input.moduleName,
        description: input.moduleDescription,
        cmp: input.cmp,
      },
      scenario: {
        name: input.scenarioName,
        eventId: input.eventId,
        targetUrl: input.targetUrl,
        steps: input.steps,
      },
    };

    const schema = {
      site: 'string',
      allowed_hosts: ['string'],
      consent: ['accept', 'reject'],
      tests: [
        {
          section: 'string',
          steps: [
            {
              description: 'string',
              action: 'click|input|wait_for_selector|wait_for_text|navigate|maybe_set_quantity|choose_payment|complete_order',
              target: {
                region: 'header|main|footer|any',
                kind: 'text|aria|href|selector',
                value: 'string',
              },
              value: 'string',
              expect: [],
              confidence: 0.0,
              severity: 'critical|major|minor',
            },
          ],
        },
      ],
      meta: {
        model: 'string',
        moduleId: input.moduleId,
        tokens: { input: 0, output: 0 },
      },
    };

    return `SCHEMA (do not echo literally, only follow it):\n${JSON.stringify(
      schema,
      null,
      2
    )}\n\nSCENARIO CONTEXT:\n${JSON.stringify(
      context,
      null,
      2
    )}\n\nTASK:\n- Produce ONE TestSpec JSON following the schema.\n- Always include a cookie-acceptance first step as required by the system instructions.\n- Use the provided steps in order after the cookie step. Missing selectors must be inferred conservatively (prefer text/aria before selector).\n- Focus ONLY on navigation and interaction steps; do NOT add verification steps, dataLayer expectations or action:\"custom\".\n- Omit the "expect" array unless a navigation expectation is strictly necessary.\n- Return ONLY JSON with no comments.`;
  }

  /**
   * Get the user prompt with target URL and PDF text
   */
  private getUserPrompt(targetUrl: string, pdfText: string): string {
    // Log PDF content to console for debugging
    console.log('📄 PDF Content being sent to ChatGPT:');
    console.log('=====================================');
    console.log(pdfText);
    console.log('=====================================');
    console.log(`📏 PDF Content length: ${pdfText.length} characters`);
    
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
- Build "allowed_hosts" from the URL host (+ "www.") and subdomains explicitly found in the SDD text only.
- IMPORTANT: The "consent" field must be an array of strings like ["accept", "reject"] or ["accept"] - never a single string.
- EXAMPLE: "consent": ["accept"] or "consent": ["accept", "reject"] - NOT "consent": "accept"
- Return ONLY JSON. No comments.`;
  }

  private getEvaluationSystemPrompt(): string {
    return `You are an analytics quality auditor. Compare captured dataLayer payloads with the expected behaviour described in a PDF specification and determine whether the implementation is correct.

IMPORTANT DOMAIN RULES:
- La colonna "Value example" del PDF rappresenta esempi di valori, NON obblighi testuali. Trattala come placeholder: il campo passa se esiste e contiene un valore plausibile/compatibile con il tipo richiesto.
- Usa la colonna "Value status" (quando presente) per capire se il campo è "required" o opzionale. Se non trovi indicazioni, considera obbligatori i campi elencati nella tabella.
- I valori numerici possono arrivare come stringhe parsabili ("61.00") oppure come numeri. Accetta entrambi purché il parsing riesca e i constraint (es. > 0) siano rispettati.
- Per i tipi dichiarati come "float" o "int" consenti piccole approssimazioni decimali; confronta usando il valore numerico.
- Verifica la presenza dei parametri richiesti e che rispettino il tipo (string, float, int). Controlla anche elementi fondamentali come prezzi > 0, quantity >= 1 quando rilevante.
- Se il PDF specifica un valore fisso o una regola esplicita (es. "deve essere uguale a X"), allora esigi la corrispondenza esatta.
- Considera FAIL solo quando manca un campo obbligatorio, il tipo è errato, il valore è vuoto o palesemente fuori specifica, oppure l'evento stesso non è presente.
- Accetta eventuali campi extra nel payload: non sono un errore.

Return ONLY valid JSON with this structure:
{
  "overallStatus": "PASS" | "FAIL",
  "reasoning": "string",
  "stepFindings": [
    { "description": "string", "status": "PASS" | "FAIL", "message": "string" }
  ],
  "suggestedFixes": ["string"]
}

Guidelines:
- Mark overallStatus as PASS only if every mandatory requirement described in the PDF is satisfied by the captured payloads.
- Evaluate field-by-field (item_name, item_id, item_brand, price, quantity, etc.).
- Highlight missing or incorrect values in stepFindings.
- suggestedFixes can be omitted or empty if not needed.`;
  }

  private buildEvaluationPrompt(site: string, pdfText: string, steps: any[]): string {
    const stepsJson = JSON.stringify(steps, null, 2);
    return `SITO: ${site}

SPECIFICA PDF (estratto):
${pdfText}

EVENTI CATTURATI:
${stepsJson}

Istruzioni:
- Confronta le aspettative del PDF con gli eventi registrati.
- Valuta se ogni parametro richiesto è presente e coerente.
- Considera PASS solo se l'evento contiene tutti i campi obbligatori con valori plausibili.
- Riporta eventuali anomalie o campi mancanti nelle stepFindings.
- Concludi con overallStatus PASS/FAIL e un reasoning sintetico.`;
  }

  private truncateText(text: string, maxLength: number): string {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return `${text.substring(0, maxLength)}${SSD_DEFAULTS.content.truncationMarker}`;
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
