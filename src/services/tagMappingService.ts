/**
 * Advanced Tag Mapping Service
 * 
 * Sistema estensibile e configurabile per il mapping dei tag GTM
 * Risolve le lacune del mapping hardcoded e limitato
 */

// ============================================================================
// 1. TIPI E INTERFACCE
// ============================================================================

export interface TagMappingPattern {
  id: string;
  type: string;
  patterns: RegExp[];
  family: 'ua' | 'gaawe' | 'googtag' | 'html' | 'marketing' | 'analytics' | 'utility' | 'other';
  priority: number;
  vendor?: string;
  consentRequired?: string[];
  description?: string;
  examples?: string[];
  deprecated?: boolean;
  replacement?: string;
}

export interface TagMappingConfig {
  patterns: TagMappingPattern[];
  fallback: {
    family: 'other';
    consentRequired: string[];
  };
  customMappings?: Record<string, string>;
  enableLearning?: boolean;
  confidenceThreshold?: number;
}

export interface TagAnalysisResult {
  type: string;
  family: string;
  vendor?: string;
  confidence: number;
  evidence: string[];
  consentRequired: string[];
  isDeprecated: boolean;
  replacement?: string;
  suggestions: string[];
}

// ============================================================================
// 2. CONFIGURAZIONE AVANZATA DEI PATTERN
// ============================================================================

const ADVANCED_TAG_PATTERNS: TagMappingPattern[] = [
  // Google Analytics
  {
    id: 'ga4_config',
    type: 'ga4_config',
    patterns: [/^gaawc$/, /^ga4_config$/, /^gtag_config$/],
    family: 'analytics',
    priority: 1,
    vendor: 'Google Analytics',
    consentRequired: ['analytics_storage'],
    description: 'GA4 Configuration Tag',
    examples: ['GA4 Config', 'Google Analytics 4', 'gtag config']
  },
  {
    id: 'ga4_event',
    type: 'ga4_event',
    patterns: [/^gaawe$/, /^ga4_event$/, /^gtag_event$/],
    family: 'analytics',
    priority: 1,
    vendor: 'Google Analytics',
    consentRequired: ['analytics_storage'],
    description: 'GA4 Event Tag',
    examples: ['GA4 Event', 'Google Analytics Event', 'gtag event']
  },
  {
    id: 'ua_legacy',
    type: 'ua_legacy',
    patterns: [/^ua$/, /^universal_analytics$/, /^ga_legacy$/],
    family: 'ua',
    priority: 1,
    vendor: 'Google Analytics',
    consentRequired: ['analytics_storage'],
    description: 'Universal Analytics (Deprecated)',
    examples: ['Universal Analytics', 'GA Legacy'],
    deprecated: true,
    replacement: 'ga4_config'
  },

  // Google Ads
  {
    id: 'google_ads_conversion',
    type: 'google_ads_conversion',
    patterns: [/^awct$/, /^awctc$/, /google.*ads.*conversion/i, /gclid/i],
    family: 'marketing',
    priority: 1,
    vendor: 'Google Ads',
    consentRequired: ['ad_storage', 'ad_user_data', 'ad_personalization'],
    description: 'Google Ads Conversion Tracking',
    examples: ['Google Ads Conversion', 'AWCT', 'Conversion Tracking']
  },
  {
    id: 'google_ads_remarketing',
    type: 'google_ads_remarketing',
    patterns: [/^aw_remarketing$/, /google.*ads.*remarketing/i, /google.*ads.*retargeting/i],
    family: 'marketing',
    priority: 1,
    vendor: 'Google Ads',
    consentRequired: ['ad_storage', 'ad_user_data', 'ad_personalization'],
    description: 'Google Ads Remarketing',
    examples: ['Google Ads Remarketing', 'Retargeting', 'AW Remarketing']
  },

  // Meta/Facebook
  {
    id: 'meta_pixel',
    type: 'meta_pixel',
    patterns: [/^facebook_/, /^meta_/, /facebook.*pixel/i, /meta.*pixel/i, /fb.*pixel/i],
    family: 'marketing',
    priority: 1,
    vendor: 'Meta',
    consentRequired: ['ad_storage', 'ad_user_data', 'ad_personalization'],
    description: 'Meta Pixel (Facebook)',
    examples: ['Facebook Pixel', 'Meta Pixel', 'FB Pixel']
  },
  {
    id: 'meta_conversions_api',
    type: 'meta_conversions_api',
    patterns: [/meta.*conversions.*api/i, /facebook.*conversions.*api/i],
    family: 'marketing',
    priority: 1,
    vendor: 'Meta',
    consentRequired: ['ad_storage', 'ad_user_data', 'ad_personalization'],
    description: 'Meta Conversions API',
    examples: ['Meta Conversions API', 'Facebook Conversions API']
  },

  // LinkedIn
  {
    id: 'linkedin_insight',
    type: 'linkedin_insight',
    patterns: [/^linkedin_/, /linkedin.*insight/i, /linkedin.*pixel/i],
    family: 'marketing',
    priority: 1,
    vendor: 'LinkedIn',
    consentRequired: ['ad_storage', 'ad_user_data', 'ad_personalization'],
    description: 'LinkedIn Insight Tag',
    examples: ['LinkedIn Insight', 'LinkedIn Pixel', 'LinkedIn Tracking']
  },

  // Microsoft/Bing
  {
    id: 'bing_uet',
    type: 'bing_uet',
    patterns: [/^bing_/, /^msclkid_/, /bing.*uet/i, /microsoft.*ads/i],
    family: 'marketing',
    priority: 1,
    vendor: 'Microsoft',
    consentRequired: ['ad_storage', 'ad_user_data', 'ad_personalization'],
    description: 'Bing UET (Universal Event Tracking)',
    examples: ['Bing UET', 'Microsoft Ads', 'Bing Conversion']
  },

  // TikTok
  {
    id: 'tiktok_pixel',
    type: 'tiktok_pixel',
    patterns: [/^tiktok_/, /^ttq_/, /tiktok.*pixel/i, /tiktok.*ads/i],
    family: 'marketing',
    priority: 1,
    vendor: 'TikTok',
    consentRequired: ['ad_storage', 'ad_user_data', 'ad_personalization'],
    description: 'TikTok Pixel',
    examples: ['TikTok Pixel', 'TikTok Ads', 'TTQ']
  },

  // Twitter/X
  {
    id: 'twitter_pixel',
    type: 'twitter_pixel',
    patterns: [/^twitter_/, /^twq_/, /twitter.*pixel/i, /x.*pixel/i],
    family: 'marketing',
    priority: 1,
    vendor: 'Twitter/X',
    consentRequired: ['ad_storage', 'ad_user_data', 'ad_personalization'],
    description: 'Twitter/X Pixel',
    examples: ['Twitter Pixel', 'X Pixel', 'Twitter Ads']
  },

  // Snapchat
  {
    id: 'snapchat_pixel',
    type: 'snapchat_pixel',
    patterns: [/^snapchat_/, /^snap_/, /snapchat.*pixel/i, /snap.*ads/i],
    family: 'marketing',
    priority: 1,
    vendor: 'Snapchat',
    consentRequired: ['ad_storage', 'ad_user_data', 'ad_personalization'],
    description: 'Snapchat Pixel',
    examples: ['Snapchat Pixel', 'Snap Ads', 'Snapchat Tracking']
  },

  // Pinterest
  {
    id: 'pinterest_pixel',
    type: 'pinterest_pixel',
    patterns: [/^pinterest_/, /^pin_/, /pinterest.*pixel/i, /pinterest.*ads/i],
    family: 'marketing',
    priority: 1,
    vendor: 'Pinterest',
    consentRequired: ['ad_storage', 'ad_user_data', 'ad_personalization'],
    description: 'Pinterest Pixel',
    examples: ['Pinterest Pixel', 'Pinterest Ads', 'Pin Tracking']
  },

  // Analytics Tools
  {
    id: 'hotjar',
    type: 'hotjar',
    patterns: [/^hotjar_/, /hotjar/i, /heatmap/i],
    family: 'analytics',
    priority: 1,
    vendor: 'Hotjar',
    consentRequired: ['analytics_storage'],
    description: 'Hotjar Heatmaps & Recordings',
    examples: ['Hotjar', 'Heatmap', 'User Recording']
  },
  {
    id: 'mixpanel',
    type: 'mixpanel',
    patterns: [/^mixpanel_/, /mixpanel/i],
    family: 'analytics',
    priority: 1,
    vendor: 'Mixpanel',
    consentRequired: ['analytics_storage'],
    description: 'Mixpanel Analytics',
    examples: ['Mixpanel', 'Event Analytics']
  },
  {
    id: 'amplitude',
    type: 'amplitude',
    patterns: [/^amplitude_/, /amplitude/i],
    family: 'analytics',
    priority: 1,
    vendor: 'Amplitude',
    consentRequired: ['analytics_storage'],
    description: 'Amplitude Analytics',
    examples: ['Amplitude', 'Product Analytics']
  },

  // A/B Testing
  {
    id: 'google_optimize',
    type: 'google_optimize',
    patterns: [/^optimize_/, /google.*optimize/i, /gtm.*optimize/i],
    family: 'utility',
    priority: 1,
    vendor: 'Google',
    consentRequired: ['analytics_storage'],
    description: 'Google Optimize',
    examples: ['Google Optimize', 'A/B Testing', 'Optimization']
  },
  {
    id: 'vwo',
    type: 'vwo',
    patterns: [/^vwo_/, /vwo/i, /visual.*website.*optimizer/i],
    family: 'utility',
    priority: 1,
    vendor: 'VWO',
    consentRequired: ['analytics_storage'],
    description: 'VWO (Visual Website Optimizer)',
    examples: ['VWO', 'Visual Website Optimizer']
  },

  // Custom HTML
  {
    id: 'custom_html',
    type: 'custom_html',
    patterns: [/^html$/, /^custom_html$/, /^javascript$/],
    family: 'html',
    priority: 1,
    vendor: 'Custom',
    consentRequired: [], // Da determinare dinamicamente
    description: 'Custom HTML/JavaScript',
    examples: ['Custom HTML', 'JavaScript', 'Custom Code']
  },

  // Server-side
  {
    id: 'sgtm_client',
    type: 'sgtm_client',
    patterns: [/^sgtm_/, /server.*side.*gtm/i, /gtm.*server/i],
    family: 'utility',
    priority: 1,
    vendor: 'Google',
    consentRequired: [],
    description: 'Server-side GTM Client',
    examples: ['Server-side GTM', 'SGTM Client']
  }
];

// ============================================================================
// 3. CONFIGURAZIONE DEFAULT
// ============================================================================

const DEFAULT_CONFIG: TagMappingConfig = {
  patterns: ADVANCED_TAG_PATTERNS,
  fallback: {
    family: 'other',
    consentRequired: ['analytics_storage']
  },
  customMappings: {},
  enableLearning: true,
  confidenceThreshold: 0.6
};

// ============================================================================
// 4. FUNZIONI DI ANALISI AVANZATA
// ============================================================================

/**
 * Analizza un tag e determina il suo tipo, vendor e consensi richiesti
 */
export function analyzeTag(tag: GTMTag, config: TagMappingConfig = DEFAULT_CONFIG): TagAnalysisResult {
  const results: Array<TagAnalysisResult & { pattern: TagMappingPattern }> = [];
  
  // 1. Analisi per tipo esatto
  const exactMatch = config.patterns.find(p => p.type === tag.type);
  if (exactMatch) {
    results.push({
      type: exactMatch.type,
      family: exactMatch.family,
      vendor: exactMatch.vendor,
      confidence: 1.0,
      evidence: [`Exact type match: ${tag.type}`],
      consentRequired: exactMatch.consentRequired || [],
      isDeprecated: exactMatch.deprecated || false,
      replacement: exactMatch.replacement,
      suggestions: [],
      pattern: exactMatch
    });
  }
  
  // 2. Analisi per pattern nel nome
  const nameMatches = config.patterns
    .filter(p => p.patterns.some(pattern => pattern.test(tag.name)))
    .map(p => ({
      type: p.type,
      family: p.family,
      vendor: p.vendor,
      confidence: 0.8,
      evidence: [`Name pattern match: ${tag.name}`],
      consentRequired: p.consentRequired || [],
      isDeprecated: p.deprecated || false,
      replacement: p.replacement,
      suggestions: [],
      pattern: p
    }));
  results.push(...nameMatches);
  
  // 3. Analisi del codice HTML (se presente)
  if (tag.html) {
    const htmlMatches = analyzeHTMLForTagType(tag.html, config);
    results.push(...htmlMatches);
  }
  
  // 4. Analisi dei parametri
  const paramMatches = analyzeParametersForTagType(tag.parameter || [], config);
  results.push(...paramMatches);
  
  // 5. Seleziona il risultato migliore
  if (results.length === 0) {
    return {
      type: 'unknown',
      family: config.fallback.family,
      vendor: undefined,
      confidence: 0,
      evidence: ['No patterns matched'],
      consentRequired: config.fallback.consentRequired,
      isDeprecated: false,
      suggestions: ['Consider adding custom mapping for this tag type'],
      pattern: undefined as any
    };
  }
  
  // Ordina per priorità e confidenza
  results.sort((a, b) => {
    if (a.pattern.priority !== b.pattern.priority) {
      return a.pattern.priority - b.pattern.priority;
    }
    return b.confidence - a.confidence;
  });
  
  const bestMatch = results[0];
  
  // Genera suggerimenti
  const suggestions = generateSuggestions(bestMatch, tag);
  
  return {
    type: bestMatch.type,
    family: bestMatch.family,
    vendor: bestMatch.vendor,
    confidence: bestMatch.confidence,
    evidence: bestMatch.evidence,
    consentRequired: bestMatch.consentRequired,
    isDeprecated: bestMatch.isDeprecated,
    replacement: bestMatch.replacement,
    suggestions
  };
}

/**
 * Analizza il codice HTML per determinare il tipo di tag
 */
function analyzeHTMLForTagType(html: string, config: TagMappingConfig): Array<TagAnalysisResult & { pattern: TagMappingPattern }> {
  const results: Array<TagAnalysisResult & { pattern: TagMappingPattern }> = [];
  
  // Pattern comuni nel codice HTML
  const htmlPatterns = [
    { pattern: /gtag\s*\(\s*['"]config['"]/i, type: 'ga4_config', confidence: 0.9 },
    { pattern: /gtag\s*\(\s*['"]event['"]/i, type: 'ga4_event', confidence: 0.9 },
    { pattern: /connect\.facebook\.net/i, type: 'meta_pixel', confidence: 0.95 },
    { pattern: /googleads\.g\.doubleclick\.net/i, type: 'google_ads_conversion', confidence: 0.9 },
    { pattern: /fls\.doubleclick\.net/i, type: 'google_ads_remarketing', confidence: 0.9 },
    { pattern: /bat\.bing\.com/i, type: 'bing_uet', confidence: 0.9 },
    { pattern: /analytics\.tiktok\.com/i, type: 'tiktok_pixel', confidence: 0.9 },
    { pattern: /px\.ads\.linkedin\.com/i, type: 'linkedin_insight', confidence: 0.9 },
    { pattern: /static\.hotjar\.com/i, type: 'hotjar', confidence: 0.9 }
  ];
  
  for (const htmlPattern of htmlPatterns) {
    if (htmlPattern.pattern.test(html)) {
      const configPattern = config.patterns.find(p => p.type === htmlPattern.type);
      if (configPattern) {
        results.push({
          type: htmlPattern.type,
          family: configPattern.family,
          vendor: configPattern.vendor,
          confidence: htmlPattern.confidence,
          evidence: [`HTML pattern match: ${htmlPattern.pattern.source}`],
          consentRequired: configPattern.consentRequired || [],
          isDeprecated: configPattern.deprecated || false,
          replacement: configPattern.replacement,
          suggestions: [],
          pattern: configPattern
        });
      }
    }
  }
  
  return results;
}

/**
 * Analizza i parametri per determinare il tipo di tag
 */
function analyzeParametersForTagType(parameters: Array<{key: string; value: any}>, config: TagMappingConfig): Array<TagAnalysisResult & { pattern: TagMappingPattern }> {
  const results: Array<TagAnalysisResult & { pattern: TagMappingPattern }> = [];
  
  // Parametri chiave per identificare il tipo
  const keyParams = [
    { key: 'measurement_id', type: 'ga4_config', confidence: 0.8 },
    { key: 'eventName', type: 'ga4_event', confidence: 0.8 },
    { key: 'pixel_id', type: 'meta_pixel', confidence: 0.9 },
    { key: 'conversion_id', type: 'google_ads_conversion', confidence: 0.9 },
    { key: 'linkedin_partner_id', type: 'linkedin_insight', confidence: 0.9 },
    { key: 'bing_id', type: 'bing_uet', confidence: 0.9 },
    { key: 'tiktok_pixel_id', type: 'tiktok_pixel', confidence: 0.9 }
  ];
  
  for (const param of parameters) {
    const keyParam = keyParams.find(kp => kp.key === param.key);
    if (keyParam) {
      const configPattern = config.patterns.find(p => p.type === keyParam.type);
      if (configPattern) {
        results.push({
          type: keyParam.type,
          family: configPattern.family,
          vendor: configPattern.vendor,
          confidence: keyParam.confidence,
          evidence: [`Parameter match: ${param.key} = ${param.value}`],
          consentRequired: configPattern.consentRequired || [],
          isDeprecated: configPattern.deprecated || false,
          replacement: configPattern.replacement,
          suggestions: [],
          pattern: configPattern
        });
      }
    }
  }
  
  return results;
}

/**
 * Genera suggerimenti per il tag
 */
function generateSuggestions(analysis: TagAnalysisResult, tag: GTMTag): string[] {
  const suggestions: string[] = [];
  
  if (analysis.isDeprecated && analysis.replacement) {
    suggestions.push(`Consider migrating from ${analysis.type} to ${analysis.replacement}`);
  }
  
  if (analysis.confidence < 0.6) {
    suggestions.push('Low confidence in tag type detection. Consider adding custom mapping.');
  }
  
  if (analysis.consentRequired.length > 0) {
    suggestions.push(`Ensure consent mode is configured for: ${analysis.consentRequired.join(', ')}`);
  }
  
  if (analysis.family === 'marketing' && !tag.blockingTriggerId) {
    suggestions.push('Consider adding blocking triggers for marketing tags');
  }
  
  return suggestions;
}

/**
 * Aggiorna la configurazione con nuovi pattern
 */
export function updateTagMappingConfig(
  config: TagMappingConfig, 
  newPatterns: TagMappingPattern[]
): TagMappingConfig {
  return {
    ...config,
    patterns: [...config.patterns, ...newPatterns].sort((a, b) => a.priority - b.priority)
  };
}

/**
 * Salva la configurazione personalizzata
 */
export function saveCustomMapping(
  config: TagMappingConfig,
  tagType: string,
  mapping: Partial<TagMappingPattern>
): TagMappingConfig {
  const existingIndex = config.patterns.findIndex(p => p.type === tagType);
  const newPattern: TagMappingPattern = {
    id: `custom_${tagType}`,
    type: tagType,
    patterns: mapping.patterns || [],
    family: mapping.family || 'other',
    priority: mapping.priority || 10,
    vendor: mapping.vendor,
    consentRequired: mapping.consentRequired || [],
    description: mapping.description,
    examples: mapping.examples,
    deprecated: mapping.deprecated || false,
    replacement: mapping.replacement
  };
  
  if (existingIndex >= 0) {
    config.patterns[existingIndex] = newPattern;
  } else {
    config.patterns.push(newPattern);
  }
  
  return config;
}

/**
 * Esporta la configurazione per backup o condivisione
 */
export function exportTagMappingConfig(config: TagMappingConfig): string {
  return JSON.stringify(config, null, 2);
}

/**
 * Importa una configurazione da backup
 */
export function importTagMappingConfig(configJson: string): TagMappingConfig {
  try {
    const imported = JSON.parse(configJson);
    return {
      ...DEFAULT_CONFIG,
      ...imported,
      patterns: [...DEFAULT_CONFIG.patterns, ...(imported.patterns || [])]
    };
  } catch (error) {
    console.error('Error importing tag mapping config:', error);
    return DEFAULT_CONFIG;
  }
}

