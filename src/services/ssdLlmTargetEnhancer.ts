import OpenAI from 'openai';
import crypto from 'crypto';

interface EnhancementRequest {
  siteUrl?: string;
  originalSelector: string;
  stepDescription?: string;
  expectations?: any[];
  region?: string;
  htmlSnippet: string;
}

interface EnhancementSelector {
  selector: string;
  confidence: number;
  reason?: string;
}

interface EnhancementResponse {
  selectors: EnhancementSelector[];
  notes?: string;
}

interface SSDLlmTargetEnhancerOptions {
  apiKey: string;
  model?: string;
  temperature?: number;
  cacheTtlMs?: number;
}

interface CacheEntry {
  createdAt: number;
  response: EnhancementResponse;
}

const MAX_HTML_CHARS = 12000;
const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_CACHE_TTL = 1000 * 60 * 60; // 1 hour

function sanitizeHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim();
}

export class SSDLlmTargetEnhancer {
  private openai: OpenAI;
  private model: string;
  private temperature: number;
  private cacheTtl: number;
  private cache = new Map<string, CacheEntry>();

  constructor(options: SSDLlmTargetEnhancerOptions) {
    this.openai = new OpenAI({
      apiKey: options.apiKey,
    });
    this.model = options.model || DEFAULT_MODEL;
    this.temperature = options.temperature ?? 0.1;
    this.cacheTtl = options.cacheTtlMs ?? DEFAULT_CACHE_TTL;
  }

  async suggestSelectors(request: EnhancementRequest): Promise<EnhancementResponse | null> {
    if (!request.htmlSnippet || request.htmlSnippet.trim().length === 0) {
      return null;
    }

    const sanitizedHtml = sanitizeHtml(request.htmlSnippet).slice(0, MAX_HTML_CHARS);
    if (!sanitizedHtml) {
      return null;
    }

    const cacheKey = this.computeCacheKey({
      siteUrl: request.siteUrl || '',
      selector: request.originalSelector,
      stepDescription: request.stepDescription || '',
      expectations: JSON.stringify(request.expectations || []),
      htmlSnippet: sanitizedHtml,
      region: request.region || '',
    });

    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    const prompt = this.buildPrompt({
      siteUrl: request.siteUrl,
      originalSelector: request.originalSelector,
      stepDescription: request.stepDescription,
      expectations: request.expectations,
      region: request.region,
      htmlSnippet: sanitizedHtml,
    });

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        temperature: this.temperature,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'Sei un assistente QA che identifica selettori CSS resilienti per interazioni automatizzate. Rispondi sempre in JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 800,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return null;
      }

      const parsed = JSON.parse(content);
      const selectors: EnhancementSelector[] = Array.isArray(parsed.selectors)
        ? parsed.selectors
            .map((entry: any) => ({
              selector: String(entry.selector || '').trim(),
              confidence: Number(entry.confidence ?? 0),
              reason: entry.reason ? String(entry.reason) : undefined,
            }))
            .filter(item => item.selector.length > 0)
        : [];

      if (selectors.length === 0) {
        return null;
      }

      const result: EnhancementResponse = {
        selectors,
        notes: parsed.notes ? String(parsed.notes) : undefined,
      };

      this.storeInCache(cacheKey, result);
      return result;
    } catch (error) {
      console.error('[llm-target-enhancer] OpenAI request failed:', error);
      return null;
    }
  }

  private buildPrompt(args: {
    siteUrl?: string;
    originalSelector: string;
    stepDescription?: string;
    expectations?: any[];
    region?: string;
    htmlSnippet: string;
  }): string {
    const expectationsSummary = Array.isArray(args.expectations)
      ? args.expectations
          .map(exp => {
            if (typeof exp?.type === 'string') {
              const detail = exp.event || exp.url_contains || exp.selector || '';
              return `- ${exp.type}${detail ? ` → ${detail}` : ''}`;
            }
            return '';
          })
          .filter(Boolean)
          .join('\n')
      : '';

    return `ANALISI CONTESTO
Site URL: ${args.siteUrl || 'unknown'}
Region: ${args.region || 'unspecified'}
Original selector (generic): ${args.originalSelector}
Step description: ${args.stepDescription || 'none provided'}
Expectations:
${expectationsSummary || '- (none)'}

HTML SNIPPET (parziale):
${args.htmlSnippet}

OBIETTIVO
Individua selettori CSS resilienti per identificare gli elementi più adatti al test automatizzato, preferendo voci di menu primarie o controlli con testo leggibile. Evita logo, switch lingua o elementi che non producono l'evento previsto.

RISPOSTA ATTESA (JSON):
{
  "selectors": [
    { "selector": "...", "confidence": 0.0-1.0, "reason": "..." }
  ],
  "notes": "opzionale"
}

Linee guida:
- Usa selettori CSS standard (no XPath).
- Prediligi pattern specifici (es. nav > ul > li > a) rispetto a wildcard generici.
- Restituisci massimo 3 selettori, ordinati dal più al meno affidabile.
- Conferma che il selettore sia coerente con lo snippet (classi, attribute, struttura).`;
  }

  private computeCacheKey(parts: {
    siteUrl: string;
    selector: string;
    stepDescription: string;
    expectations: string;
    htmlSnippet: string;
    region: string;
  }): string {
    return crypto
      .createHash('sha1')
      .update(
        [
          parts.siteUrl,
          parts.selector,
          parts.stepDescription,
          parts.expectations,
          parts.htmlSnippet,
          parts.region,
          this.model,
        ].join('|')
      )
      .digest('hex');
  }

  private getFromCache(key: string): EnhancementResponse | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.createdAt > this.cacheTtl) {
      this.cache.delete(key);
      return null;
    }
    return entry.response;
  }

  private storeInCache(key: string, response: EnhancementResponse): void {
    this.cache.set(key, {
      createdAt: Date.now(),
      response,
    });
  }
}

