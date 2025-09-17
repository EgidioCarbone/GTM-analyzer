/**
 * Advanced Consent Mode Service
 * 
 * Sistema intelligente per il rilevamento e la configurazione del Consent Mode
 * Risolve le lacune del mapping vendor incompleto e pattern matching primitivo
 */

import { GTMTag, GTMTrigger, GTMVariable } from "../types/gtm";

// ============================================================================
// 1. TIPI E INTERFACCE
// ============================================================================

export interface ConsentAnalysis {
  vendor: string;
  confidence: number;
  requiredConsents: string[];
  detectedPatterns: string[];
  suggestedConfiguration: ConsentConfig;
  evidence: string[];
  isMarketing: boolean;
  isAnalytics: boolean;
  isUtility: boolean;
}

export interface ConsentConfig {
  ad_storage?: boolean;
  analytics_storage?: boolean;
  ad_user_data?: boolean;
  ad_personalization?: boolean;
  functionality_storage?: boolean;
  personalization_storage?: boolean;
  security_storage?: boolean;
}

export interface ConsentModeResult {
  overall: {
    score: number;
    status: 'excellent' | 'good' | 'needs_improvement' | 'critical';
    message: string;
  };
  coverage: {
    total: number;
    configured: number;
    missing: number;
    inferred: number;
  };
  byVendor: Record<string, {
    count: number;
    configured: number;
    missing: string[];
    confidence: number;
  }>;
  recommendations: string[];
  criticalIssues: string[];
}

// ============================================================================
// 2. CONFIGURAZIONE AVANZATA DEI VENDOR
// ============================================================================

const VENDOR_CONSENT_PATTERNS = [
  // Google Analytics
  {
    vendor: 'Google Analytics',
    patterns: [
      { type: 'tag_type', patterns: [/^gaawc$/, /^ga4_config$/, /^gtag$/] },
      { type: 'name', patterns: [/google.*analytics/i, /ga4/i, /gtag/i] },
      { type: 'html', patterns: [/gtag\s*\(\s*['"]config['"]/i, /google-analytics/i] },
      { type: 'param', patterns: [/measurement_id/i, /ga_measurement_id/i] }
    ],
    consents: ['analytics_storage'],
    confidence: 0.9
  },
  
  // Google Ads
  {
    vendor: 'Google Ads',
    patterns: [
      { type: 'tag_type', patterns: [/^awct$/, /^awctc$/, /^aw_remarketing$/] },
      { type: 'name', patterns: [/google.*ads/i, /awct/i, /remarketing/i, /conversion/i] },
      { type: 'html', patterns: [/googleads\.g\.doubleclick\.net/i, /fls\.doubleclick\.net/i] },
      { type: 'param', patterns: [/conversion_id/i, /conversion_label/i, /gclid/i] }
    ],
    consents: ['ad_storage', 'ad_user_data', 'ad_personalization'],
    confidence: 0.95
  },
  
  // Meta/Facebook
  {
    vendor: 'Meta',
    patterns: [
      { type: 'tag_type', patterns: [/^facebook_/, /^meta_/] },
      { type: 'name', patterns: [/facebook/i, /meta/i, /fb.*pixel/i] },
      { type: 'html', patterns: [/connect\.facebook\.net/i, /facebook\.com\/tr/i] },
      { type: 'param', patterns: [/pixel_id/i, /fb_pixel_id/i] }
    ],
    consents: ['ad_storage', 'ad_user_data', 'ad_personalization'],
    confidence: 0.95
  },
  
  // LinkedIn
  {
    vendor: 'LinkedIn',
    patterns: [
      { type: 'tag_type', patterns: [/^linkedin_/] },
      { type: 'name', patterns: [/linkedin/i, /li.*pixel/i] },
      { type: 'html', patterns: [/px\.ads\.linkedin\.com/i, /snap\.licdn\.com/i] },
      { type: 'param', patterns: [/linkedin_partner_id/i, /li_pixel_id/i] }
    ],
    consents: ['ad_storage', 'ad_user_data', 'ad_personalization'],
    confidence: 0.9
  },
  
  // Microsoft/Bing
  {
    vendor: 'Microsoft',
    patterns: [
      { type: 'tag_type', patterns: [/^bing_/, /^msclkid_/] },
      { type: 'name', patterns: [/bing/i, /microsoft.*ads/i, /uet/i] },
      { type: 'html', patterns: [/bat\.bing\.com/i, /bing\.com\/analytics/i] },
      { type: 'param', patterns: [/bing_id/i, /uet_id/i] }
    ],
    consents: ['ad_storage', 'ad_user_data', 'ad_personalization'],
    confidence: 0.9
  },
  
  // TikTok
  {
    vendor: 'TikTok',
    patterns: [
      { type: 'tag_type', patterns: [/^tiktok_/, /^ttq_/] },
      { type: 'name', patterns: [/tiktok/i, /ttq/i] },
      { type: 'html', patterns: [/analytics\.tiktok\.com/i, /tiktok\.com\/analytics/i] },
      { type: 'param', patterns: [/tiktok_pixel_id/i, /ttq_id/i] }
    ],
    consents: ['ad_storage', 'ad_user_data', 'ad_personalization'],
    confidence: 0.9
  },
  
  // Twitter/X
  {
    vendor: 'Twitter',
    patterns: [
      { type: 'tag_type', patterns: [/^twitter_/, /^twq_/] },
      { type: 'name', patterns: [/twitter/i, /x.*pixel/i, /twq/i] },
      { type: 'html', patterns: [/static\.ads-twitter\.com/i, /analytics\.twitter\.com/i] },
      { type: 'param', patterns: [/twitter_pixel_id/i, /twq_id/i] }
    ],
    consents: ['ad_storage', 'ad_user_data', 'ad_personalization'],
    confidence: 0.9
  },
  
  // Snapchat
  {
    vendor: 'Snapchat',
    patterns: [
      { type: 'tag_type', patterns: [/^snapchat_/, /^snap_/] },
      { type: 'name', patterns: [/snapchat/i, /snap.*pixel/i] },
      { type: 'html', patterns: [/tr\.snapchat\.com/i, /analytics\.snapchat\.com/i] },
      { type: 'param', patterns: [/snapchat_pixel_id/i, /snap_id/i] }
    ],
    consents: ['ad_storage', 'ad_user_data', 'ad_personalization'],
    confidence: 0.9
  },
  
  // Pinterest
  {
    vendor: 'Pinterest',
    patterns: [
      { type: 'tag_type', patterns: [/^pinterest_/, /^pin_/] },
      { type: 'name', patterns: [/pinterest/i, /pin.*pixel/i] },
      { type: 'html', patterns: [/analytics\.pinterest\.com/i, /tr\.pinterest\.com/i] },
      { type: 'param', patterns: [/pinterest_pixel_id/i, /pin_id/i] }
    ],
    consents: ['ad_storage', 'ad_user_data', 'ad_personalization'],
    confidence: 0.9
  },
  
  // Analytics Tools
  {
    vendor: 'Hotjar',
    patterns: [
      { type: 'tag_type', patterns: [/^hotjar_/] },
      { type: 'name', patterns: [/hotjar/i, /heatmap/i] },
      { type: 'html', patterns: [/static\.hotjar\.com/i, /script\.hotjar\.com/i] },
      { type: 'param', patterns: [/hotjar_id/i, /hj_id/i] }
    ],
    consents: ['analytics_storage'],
    confidence: 0.9
  },
  
  {
    vendor: 'Mixpanel',
    patterns: [
      { type: 'tag_type', patterns: [/^mixpanel_/] },
      { type: 'name', patterns: [/mixpanel/i] },
      { type: 'html', patterns: [/cdn\.mixpanel\.com/i, /api\.mixpanel\.com/i] },
      { type: 'param', patterns: [/mixpanel_token/i, /mp_token/i] }
    ],
    consents: ['analytics_storage'],
    confidence: 0.9
  },
  
  {
    vendor: 'Amplitude',
    patterns: [
      { type: 'tag_type', patterns: [/^amplitude_/] },
      { type: 'name', patterns: [/amplitude/i] },
      { type: 'html', patterns: [/cdn\.amplitude\.com/i, /api\.amplitude\.com/i] },
      { type: 'param', patterns: [/amplitude_api_key/i, /amp_api_key/i] }
    ],
    consents: ['analytics_storage'],
    confidence: 0.9
  }
];

// ============================================================================
// 3. FUNZIONI DI ANALISI AVANZATA
// ============================================================================

/**
 * Analizza un tag per determinare i consensi richiesti
 */
export function analyzeConsentRequirements(tag: GTMTag): ConsentAnalysis {
  const analyses: ConsentAnalysis[] = [];
  
  // 1. Analisi per tipo di tag
  const typeAnalysis = analyzeTagTypeForConsent(tag);
  if (typeAnalysis) analyses.push(typeAnalysis);
  
  // 2. Analisi per nome del tag
  const nameAnalysis = analyzeTagNameForConsent(tag);
  if (nameAnalysis) analyses.push(nameAnalysis);
  
  // 3. Analisi del codice HTML
  if (tag.html) {
    const htmlAnalysis = analyzeHTMLForConsent(tag.html);
    if (htmlAnalysis) analyses.push(htmlAnalysis);
  }
  
  // 4. Analisi dei parametri
  const paramAnalysis = analyzeParametersForConsent(tag.parameter || []);
  if (paramAnalysis) analyses.push(paramAnalysis);
  
  // 5. Seleziona il risultato migliore
  if (analyses.length === 0) {
    return {
      vendor: 'Unknown',
      confidence: 0,
      requiredConsents: ['analytics_storage'], // Default conservativo
      detectedPatterns: [],
      suggestedConfiguration: { analytics_storage: true },
      evidence: ['No patterns matched'],
      isMarketing: false,
      isAnalytics: true,
      isUtility: false
    };
  }
  
  // Ordina per confidenza
  analyses.sort((a, b) => b.confidence - a.confidence);
  const bestMatch = analyses[0];
  
  // Determina il tipo di tag
  const isMarketing = bestMatch.requiredConsents.some(c => 
    ['ad_storage', 'ad_user_data', 'ad_personalization'].includes(c)
  );
  const isAnalytics = bestMatch.requiredConsents.includes('analytics_storage');
  const isUtility = !isMarketing && !isAnalytics;
  
  return {
    ...bestMatch,
    isMarketing,
    isAnalytics,
    isUtility
  };
}

/**
 * Analizza il tipo di tag per i consensi
 */
function analyzeTagTypeForConsent(tag: GTMTag): ConsentAnalysis | null {
  const tagType = tag.type?.toLowerCase();
  if (!tagType) return null;
  
  for (const vendorPattern of VENDOR_CONSENT_PATTERNS) {
    const typePattern = vendorPattern.patterns.find(p => p.type === 'tag_type');
    if (typePattern && typePattern.patterns.some(pattern => pattern.test(tagType))) {
      return {
        vendor: vendorPattern.vendor,
        confidence: vendorPattern.confidence,
        requiredConsents: [...vendorPattern.consents],
        detectedPatterns: [`Tag type: ${tagType}`],
        suggestedConfiguration: createConsentConfig(vendorPattern.consents),
        evidence: [`Tag type match: ${tagType}`],
        isMarketing: false,
        isAnalytics: false,
        isUtility: false
      };
    }
  }
  
  return null;
}

/**
 * Analizza il nome del tag per i consensi
 */
function analyzeTagNameForConsent(tag: GTMTag): ConsentAnalysis | null {
  const tagName = tag.name?.toLowerCase();
  if (!tagName) return null;
  
  for (const vendorPattern of VENDOR_CONSENT_PATTERNS) {
    const namePattern = vendorPattern.patterns.find(p => p.type === 'name');
    if (namePattern && namePattern.patterns.some(pattern => pattern.test(tagName))) {
      return {
        vendor: vendorPattern.vendor,
        confidence: vendorPattern.confidence * 0.8, // Riduci confidenza per nome
        requiredConsents: [...vendorPattern.consents],
        detectedPatterns: [`Name pattern: ${tagName}`],
        suggestedConfiguration: createConsentConfig(vendorPattern.consents),
        evidence: [`Name pattern match: ${tagName}`],
        isMarketing: false,
        isAnalytics: false,
        isUtility: false
      };
    }
  }
  
  return null;
}

/**
 * Analizza il codice HTML per i consensi
 */
function analyzeHTMLForConsent(html: string): ConsentAnalysis | null {
  for (const vendorPattern of VENDOR_CONSENT_PATTERNS) {
    const htmlPattern = vendorPattern.patterns.find(p => p.type === 'html');
    if (htmlPattern && htmlPattern.patterns.some(pattern => pattern.test(html))) {
      return {
        vendor: vendorPattern.vendor,
        confidence: vendorPattern.confidence * 0.9, // Alta confidenza per HTML
        requiredConsents: [...vendorPattern.consents],
        detectedPatterns: [`HTML pattern: ${htmlPattern.patterns[0].source}`],
        suggestedConfiguration: createConsentConfig(vendorPattern.consents),
        evidence: [`HTML pattern match: ${htmlPattern.patterns[0].source}`],
        isMarketing: false,
        isAnalytics: false,
        isUtility: false
      };
    }
  }
  
  return null;
}

/**
 * Analizza i parametri per i consensi
 */
function analyzeParametersForConsent(parameters: Array<{key: string; value: any}>): ConsentAnalysis | null {
  for (const param of parameters) {
    const paramKey = param.key.toLowerCase();
    const paramValue = String(param.value).toLowerCase();
    
    for (const vendorPattern of VENDOR_CONSENT_PATTERNS) {
      const paramPattern = vendorPattern.patterns.find(p => p.type === 'param');
      if (paramPattern && paramPattern.patterns.some(pattern => 
        pattern.test(paramKey) || pattern.test(paramValue)
      )) {
        return {
          vendor: vendorPattern.vendor,
          confidence: vendorPattern.confidence * 0.85,
          requiredConsents: [...vendorPattern.consents],
          detectedPatterns: [`Parameter: ${paramKey} = ${paramValue}`],
          suggestedConfiguration: createConsentConfig(vendorPattern.consents),
          evidence: [`Parameter match: ${paramKey} = ${paramValue}`],
          isMarketing: false,
          isAnalytics: false,
          isUtility: false
        };
      }
    }
  }
  
  return null;
}

/**
 * Crea una configurazione di consenso
 */
function createConsentConfig(consents: string[]): ConsentConfig {
  const config: ConsentConfig = {};
  consents.forEach(consent => {
    config[consent as keyof ConsentConfig] = true;
  });
  return config;
}

/**
 * Analizza la copertura del Consent Mode per un container
 */
export function analyzeAdvancedConsentMode(containerVersion: {
  tag?: GTMTag[];
  trigger?: GTMTrigger[];
  variable?: GTMVariable[];
}): ConsentModeResult {
  const tags = containerVersion.tag || [];
  
  // Analizza tutti i tag
  const analyses = tags.map(tag => ({
    tag,
    analysis: analyzeConsentRequirements(tag)
  }));
  
  // Filtra solo i tag che richiedono consensi
  const consentTags = analyses.filter(({ analysis }) => 
    analysis.requiredConsents.length > 0
  );
  
  // Raggruppa per vendor
  const byVendor: Record<string, {
    count: number;
    configured: number;
    missing: string[];
    confidence: number;
  }> = {};
  
  let totalConfigured = 0;
  let totalMissing = 0;
  let totalInferred = 0;
  
  consentTags.forEach(({ tag, analysis }) => {
    const vendor = analysis.vendor;
    if (!byVendor[vendor]) {
      byVendor[vendor] = {
        count: 0,
        configured: 0,
        missing: [],
        confidence: 0
      };
    }
    
    byVendor[vendor].count++;
    byVendor[vendor].confidence = Math.max(byVendor[vendor].confidence, analysis.confidence);
    
    // Controlla se il tag ha consensi configurati
    const hasConsentConfig = hasConsentConfiguration(tag);
    if (hasConsentConfig) {
      byVendor[vendor].configured++;
      totalConfigured++;
    } else {
      byVendor[vendor].missing.push(...analysis.requiredConsents);
      totalMissing++;
      
      if (analysis.confidence > 0.7) {
        totalInferred++;
      }
    }
  });
  
  // Calcola score complessivo
  const totalTags = consentTags.length;
  const score = totalTags > 0 ? (totalConfigured / totalTags) * 100 : 100;
  
  // Determina status
  let status: 'excellent' | 'good' | 'needs_improvement' | 'critical';
  if (score >= 90) status = 'excellent';
  else if (score >= 70) status = 'good';
  else if (score >= 50) status = 'needs_improvement';
  else status = 'critical';
  
  // Genera messaggio
  const message = generateConsentMessage(score, totalConfigured, totalMissing, totalInferred);
  
  // Genera raccomandazioni
  const recommendations = generateConsentRecommendations(byVendor, analyses);
  
  // Identifica problemi critici
  const criticalIssues = identifyCriticalConsentIssues(byVendor, analyses);
  
  return {
    overall: {
      score: Math.round(score),
      status,
      message
    },
    coverage: {
      total: totalTags,
      configured: totalConfigured,
      missing: totalMissing,
      inferred: totalInferred
    },
    byVendor,
    recommendations,
    criticalIssues
  };
}

/**
 * Controlla se un tag ha consensi configurati
 */
function hasConsentConfiguration(tag: GTMTag): boolean {
  // Controlla consentSettings diretto
  if (tag.consentSettings) {
    return true;
  }
  
  // Controlla parametri di consenso
  const consentParams = ['consentSettings', 'ad_storage', 'analytics_storage', 'ad_user_data', 'ad_personalization'];
  return (tag.parameter || []).some(param => 
    consentParams.includes(param.key) && param.value !== undefined
  );
}

/**
 * Genera messaggio di stato
 */
function generateConsentMessage(score: number, configured: number, missing: number, inferred: number): string {
  if (score >= 90) {
    return `Excellent consent mode coverage: ${configured} tags properly configured`;
  } else if (score >= 70) {
    return `Good consent mode coverage: ${configured} configured, ${missing} need configuration`;
  } else if (score >= 50) {
    return `Consent mode needs improvement: ${missing} tags missing configuration`;
  } else {
    return `Critical consent mode issues: ${missing} tags need immediate attention`;
  }
}

/**
 * Genera raccomandazioni per il consent mode
 */
function generateConsentRecommendations(
  byVendor: Record<string, any>,
  analyses: Array<{ tag: GTMTag; analysis: ConsentAnalysis }>
): string[] {
  const recommendations: string[] = [];
  
  // Raccomandazioni per vendor
  Object.entries(byVendor).forEach(([vendor, data]) => {
    if (data.missing.length > 0) {
      recommendations.push(`Configure consent mode for ${vendor}: ${data.missing.join(', ')}`);
    }
  });
  
  // Raccomandazioni generali
  const marketingTags = analyses.filter(({ analysis }) => analysis.isMarketing);
  if (marketingTags.length > 0) {
    recommendations.push(`Add blocking triggers for ${marketingTags.length} marketing tags`);
  }
  
  const lowConfidenceTags = analyses.filter(({ analysis }) => analysis.confidence < 0.6);
  if (lowConfidenceTags.length > 0) {
    recommendations.push(`Review ${lowConfidenceTags.length} tags with low confidence detection`);
  }
  
  return recommendations;
}

/**
 * Identifica problemi critici del consent mode
 */
function identifyCriticalConsentIssues(
  byVendor: Record<string, any>,
  analyses: Array<{ tag: GTMTag; analysis: ConsentAnalysis }>
): string[] {
  const issues: string[] = [];
  
  // Tag marketing senza consensi
  const marketingTagsWithoutConsent = analyses.filter(({ tag, analysis }) => 
    analysis.isMarketing && !hasConsentConfiguration(tag)
  );
  
  if (marketingTagsWithoutConsent.length > 0) {
    issues.push(`${marketingTagsWithoutConsent.length} marketing tags without consent configuration`);
  }
  
  // Tag con bassa confidenza
  const lowConfidenceTags = analyses.filter(({ analysis }) => analysis.confidence < 0.5);
  if (lowConfidenceTags.length > 0) {
    issues.push(`${lowConfidenceTags.length} tags with very low confidence detection`);
  }
  
  return issues;
}

