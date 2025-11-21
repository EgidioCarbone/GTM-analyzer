import OpenAI from 'openai';
import crypto from 'crypto';
import { FileLLMPlanCache, computeBannerSignature } from './cache';
import {
  ConsentLLMContext,
  ConsentLLMRequest,
  ConsentLLMServiceOptions,
  LLMActionStep,
  LLMResolution,
  LLMPlanCache,
  CachedLLMEntry,
  LLMScenarioDetails,
} from './types';

const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_CACHE_TTL = 1000 * 60 * 60 * 24 * 7; // 7 days
const MAX_HTML_CHARS = 8000;
const MAX_PREVIOUS_ERRORS = 3;
const BANNER_SELECTOR_CACHE_TTL = 1000 * 60 * 60 * 24; // 24 ore

function truncate(text: string, max = MAX_HTML_CHARS): string {
  if (text.length <= max) return text;
  return `${text.substring(0, max)}\n<!-- truncated ${text.length - max} chars -->`;
}

function truncatePlain(text: string, max = 4000, maxLines = 80): string {
  if (!text) return '';
  const lines = text.split('\n').slice(0, maxLines);
  const joined = lines.join('\n');
  if (joined.length <= max) return joined;
  return `${joined.substring(0, max)} …`;
}

function textSnippet(html: string, maxLength = 400): string {
  const stripped = html
    .replace(/\s+/g, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .trim();
  if (stripped.length <= maxLength) return stripped;
  return `${stripped.substring(0, maxLength)} …`;
}

function scenarioLabel(details: LLMScenarioDetails): string {
  if (details.type !== 'custom') return details.type.toUpperCase();
  const prefs = details.customPreferences || {};
  const parts = ['CUSTOM'];
  parts.push(`analytics=${prefs.analytics ? 'on' : 'off'}`);
  parts.push(`marketing=${prefs.marketing ? 'on' : 'off'}`);
  parts.push(`preferences=${prefs.preferences ? 'on' : 'off'}`);
  return parts.join(' ');
}

function buildScenarioInstructions(details: LLMScenarioDetails): string {
  if (details.type === 'accept') {
    return 'User goal: accept or allow all optional cookies and close the banner.';
  }
  if (details.type === 'reject') {
    return 'User goal: refuse/deny all optional cookies, keeping only strictly necessary ones.';
  }
  const prefs = details.customPreferences || {};
  const parts: string[] = ['User goal: apply custom preferences.'];
  parts.push(`Analytics / statistics cookies: ${prefs.analytics ? 'ENABLE' : 'DISABLE'}.`);
  parts.push(`Marketing / advertising cookies: ${prefs.marketing ? 'ENABLE' : 'DISABLE'}.`);
  parts.push(`Preferences / functional cookies: ${prefs.preferences ? 'ENABLE' : 'DISABLE'} (usually required).`);
  parts.push('Ensure settings are saved/confirmed at the end.');
  return parts.join(' ');
}

function buildCacheKey(context: ConsentLLMContext, model: string): string {
  const hostname = (() => {
    try {
      return new URL(context.pageUrl).hostname;
    } catch {
      return 'unknown-host';
    }
  })();
  const signature = computeBannerSignature(context.bannerHtml);
  return crypto
    .createHash('sha1')
    .update([model, hostname, context.scenario.type, JSON.stringify(context.scenario.customPreferences || {}), signature].join('|'))
    .digest('hex');
}

export class ConsentLLMService {
  private openai: OpenAI;
  private model: string;
  private cache: LLMPlanCache;
  private cacheTtlMs: number;
  private temperature: number;
  private bannerSelectorCache = new Map<string, { createdAt: number; value: {
    bannerSelector: string | null;
    acceptSelector: string | null;
    rejectSelector: string | null;
  }}>();

  constructor(options: ConsentLLMServiceOptions) {
    if (!options.apiKey) {
      throw new Error('OpenAI API key is required for ConsentLLMService');
    }
    this.openai = new OpenAI({ apiKey: options.apiKey });
    this.model = options.model || DEFAULT_MODEL;
    this.cache = new FileLLMPlanCache();
    this.cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL;
    this.temperature = options.temperature ?? 0.2;
  }

  async resolve(request: ConsentLLMRequest): Promise<LLMResolution> {
    const context = await this.normaliseContext(request.context);
    const cacheKey = buildCacheKey(context, this.model);
    const skipCache = (request.previousAttempts?.length || 0) > 0;

    await this.cache.purgeExpired(this.cacheTtlMs);
    if (!skipCache) {
      const cached = await this.cache.load(cacheKey);
      if (cached && Date.now() - cached.createdAt <= this.cacheTtlMs) {
        return {
          steps: cached.steps,
          model: cached.model,
          usageTokens: undefined,
          cacheKey,
          cacheHit: true,
        };
      }
    }

    const response = await this.queryLLM(context, request.previousAttempts || []);
    const steps = this.parseSteps(response);

    if (!skipCache) {
      const entry: CachedLLMEntry = {
        cacheKey,
        createdAt: Date.now(),
        model: this.model,
        scenario: context.scenario,
        steps,
        metadata: {
          bannerSignature: computeBannerSignature(context.bannerHtml),
          hostname: (() => {
            try {
              return new URL(context.pageUrl).hostname;
            } catch {
              return 'unknown-host';
            }
          })(),
        },
      };
      await this.cache.save(entry);
    }

    return {
      steps,
      model: this.model,
      usageTokens: response.usage?.total_tokens,
      cacheKey,
      cacheHit: false,
      raw: response,
    };
  }

  private async normaliseContext(context: ConsentLLMContext): Promise<ConsentLLMContext> {
    const cleanedHtml = truncate(context.bannerHtml);
    const snippet = context.bannerTextSnippet || textSnippet(cleanedHtml);
    const languages = context.languageHints && context.languageHints.length > 0
      ? context.languageHints
      : ['auto'];
    return {
      ...context,
      bannerHtml: cleanedHtml,
      bannerTextSnippet: snippet,
      languageHints: languages,
    };
  }

  private async queryLLM(context: ConsentLLMContext, previous: Array<{ error: string }>) {
    const instruction = buildScenarioInstructions(context.scenario);
    const systemPrompt = `You are an expert QA automation engineer specialising in cookie consent banners across many CMP vendors (OneTrust, Cookiebot, Didomi, Usercentrics, custom solutions).
You receive the DOM snippet of a banner and must plan reliable UI actions to reach the desired consent outcome.
- Focus only on elements inside the provided banner HTML.
- Prefer concrete CSS selectors present in the snippet.
- If no id/class, provide robust text-based targets (case-insensitive substrings).
- Limit the number of steps to the minimum needed.
- Never reference global document selectors or areas outside the banner.
- Return pure JSON matching the required schema.`;

    const hints = context.languageHints.join(', ');

    const previousNotes = previous.slice(-MAX_PREVIOUS_ERRORS).map((item, idx) => `Attempt ${idx + 1} failed because: ${item.error}`).join('\n');

    const userPrompt = `SCENARIO: ${scenarioLabel(context.scenario)}
${instruction}

PAGE URL: ${context.pageUrl}
LANGUAGE HINTS: ${hints || 'auto-detect'}
BANNER TEXT PREVIEW: ${context.bannerTextSnippet}

RETURN FORMAT (strict JSON):
{
  "steps": [
    {
      "action": "click" | "waitForHidden" | "waitForVisible",
      "target": {
        "selector": "CSS selector within banner (preferred)",
        "role": "button" | "link" | "checkbox" | "switch" | "generic",
        "text": "Exact label or innerText (optional)",
        "contains": "Substring to match when text not exact (optional)",
        "description": "Optional clarification"
      },
      "confidence": 0-1,
      "rationale": "Why this action",
      "timeoutMs": optional positive integer for waits
    }
  ]
}
Do not include any additional fields.

BANNER HTML SNIPPET (trimmed):
\n\n${context.bannerHtml}

${previousNotes ? `PREVIOUS ATTEMPTS:\n${previousNotes}` : ''}`;

    return this.openai.chat.completions.create({
      model: this.model,
      temperature: this.temperature,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 1200,
    });
  }

  private parseSteps(response: Awaited<ReturnType<OpenAI['chat']['completions']['create']>>): LLMActionStep[] {
    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('LLM response missing content');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to parse LLM JSON: ${(error as Error).message}`);
    }

    if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as any).steps)) {
      throw new Error('LLM response missing steps array');
    }

    const steps = (parsed as any).steps as LLMActionStep[];
    return steps
      .filter(step => step && typeof step === 'object' && typeof step.action === 'string')
      .map(step => ({
        action: step.action,
        target: step.target || {},
        confidence: typeof step.confidence === 'number' ? step.confidence : 0.5,
        rationale: step.rationale,
        timeoutMs: typeof step.timeoutMs === 'number' ? step.timeoutMs : undefined,
      }))
      .filter(step => step.target && (step.target.selector || step.target.text || step.target.contains));
  }

  async resolveBannerSelectors(prompt: string): Promise<{
    bannerSelector: string | null;
    rejectSelector: string | null;
    acceptSelector: string | null;
  } | null> {
    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        temperature: 0.1, // Bassa temperatura per risposte più deterministiche
        messages: [
          { role: 'user', content: prompt },
        ],
        max_tokens: 500,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('LLM response missing content');
      }

      // Pulisce la risposta da eventuali markdown o testo extra
      const cleanContent = content.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '');
      
      const parsed = JSON.parse(cleanContent);
      
      return {
        bannerSelector: parsed.banner_selector || null,
        rejectSelector: parsed.reject_selector || null,
        acceptSelector: parsed.accept_selector || null,
      };
    } catch (error) {
      console.error('❌ Errore parsing risposta LLM banner selectors:', error);
      return null;
    }
  }

  async suggestSelectorsFromHtml(options: {
    pageUrl: string;
    html: string;
    languageHints?: string[];
    interactiveSummary?: string;
  }): Promise<{
    bannerSelector: string | null;
    acceptSelector: string | null;
    rejectSelector: string | null;
  } | null> {
    const { pageUrl, html, languageHints = [], interactiveSummary } = options;
    if (!html || !html.trim()) {
      return null;
    }

    const cleanedHtml = truncate(stripScriptsAndStyles(html));
    const signature = computeBannerSignature(cleanedHtml);
    const cacheKey = `${this.model}:${signature}`;
    const cached = this.bannerSelectorCache.get(cacheKey);
    if (cached && Date.now() - cached.createdAt < BANNER_SELECTOR_CACHE_TTL) {
      return cached.value;
    }

    const systemPrompt = `You are an automation engineer specialised in cookie consent banners.
You receive the rendered HTML of a page at first load and must identify the cookie/consent banner container and the primary accept/reject controls, if present.
- Analyse ONLY the provided HTML.
- Prefer stable selectors (id, data-*, aria) and avoid guesses.
- If a selector is missing or ambiguous, return null for that field.
- Answer strictly with the required JSON object (no extra text).`;

    const hints = languageHints.length > 0 ? languageHints.join(', ') : 'auto-detect';

    const interactiveBlock = interactiveSummary && interactiveSummary.trim()
      ? `\nINTERACTIVE ELEMENTS SNAPSHOT (within potential banner):\n${truncatePlain(interactiveSummary.trim())}\n`
      : '';

    const userPrompt = `PAGE URL: ${pageUrl}
LANGUAGE HINTS: ${hints}
HTML SNIPPET (trimmed):\n${cleanedHtml}
${interactiveBlock}

Return JSON with keys "banner_selector", "accept_selector", "reject_selector". Use null when unsure.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 500,
      });

      const content = response.choices[0]?.message?.content?.trim();
      if (!content) {
        return null;
      }

      const parsed = JSON.parse(content);
      const value = {
        bannerSelector: parsed.banner_selector ?? null,
        acceptSelector: parsed.accept_selector ?? null,
        rejectSelector: parsed.reject_selector ?? null,
      };

      this.bannerSelectorCache.set(cacheKey, { createdAt: Date.now(), value });
      return value;
    } catch (error) {
      console.error('❌ Errore LLM suggerimento selettori da HTML:', error);
      return null;
    }
  }
}

function stripScriptsAndStyles(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');
}
