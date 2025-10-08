/**
 * Contextual Trigger Quality Service
 * 
 * Sistema di analisi trigger quality con contesto business
 * Risolve le lacune della valutazione binaria e mancanza di contesto
 */

import { GTMTag, GTMTrigger, GTMVariable } from "../types/gtm";

// ============================================================================
// 1. TIPI E INTERFACCE
// ============================================================================

export interface TriggerContext {
  siteType: 'ecommerce' | 'blog' | 'corporate' | 'saas' | 'news' | 'unknown';
  tagTypes: string[];
  performanceRequirements: PerformanceProfile;
  userExperience: UXProfile;
  businessGoals: BusinessGoal[];
}

export interface PerformanceProfile {
  maxLoadTime: number; // ms
  maxFiringDelay: number; // ms
  priorityLevel: 'critical' | 'high' | 'medium' | 'low';
  requiresBlocking: boolean;
}

export interface UXProfile {
  requiresSPASupport: boolean;
  requiresHistoryChange: boolean;
  requiresScrollTracking: boolean;
  requiresFormTracking: boolean;
  requiresVideoTracking: boolean;
}

export interface BusinessGoal {
  type: 'conversion' | 'engagement' | 'analytics' | 'marketing' | 'security';
  priority: number;
  description: string;
}

export interface TriggerQualityAnalysis {
  trigger: GTMTrigger;
  score: number;
  breakdown: {
    specificity: number;
    timing: number;
    blocking: number;
    spa: number;
    hygiene: number;
    context: number;
  };
  issues: TriggerIssue[];
  recommendations: string[];
  context: TriggerContext;
  usedByTags: GTMTag[];
  performanceImpact: PerformanceImpact;
}

export interface TriggerIssue {
  severity: 'critical' | 'major' | 'minor' | 'info';
  category: 'specificity' | 'timing' | 'blocking' | 'spa' | 'hygiene' | 'context';
  reason: string;
  suggestion: string;
  impact: string;
  fixable: boolean;
}

export interface PerformanceImpact {
  loadTime: number; // ms
  firingDelay: number; // ms
  blockingTime: number; // ms
  resourceUsage: 'low' | 'medium' | 'high';
  userExperience: 'excellent' | 'good' | 'fair' | 'poor';
}

// ============================================================================
// 2. CONFIGURAZIONE CONTESTUALE
// ============================================================================

const SITE_TYPE_PATTERNS = {
  ecommerce: {
    patterns: [/shop/i, /store/i, /cart/i, /checkout/i, /product/i, /buy/i, /purchase/i],
    tagTypes: ['ga4_event', 'google_ads_conversion', 'meta_pixel', 'linkedin_insight'],
    performanceRequirements: {
      maxLoadTime: 2000,
      maxFiringDelay: 100,
      priorityLevel: 'critical' as const,
      requiresBlocking: true
    },
    uxRequirements: {
      requiresSPASupport: true,
      requiresHistoryChange: true,
      requiresScrollTracking: true,
      requiresFormTracking: true,
      requiresVideoTracking: false
    },
    businessGoals: [
      { type: 'conversion', priority: 1, description: 'Track purchases and conversions' },
      { type: 'marketing', priority: 2, description: 'Retargeting and remarketing' },
      { type: 'analytics', priority: 3, description: 'User behavior analysis' }
    ]
  },
  blog: {
    patterns: [/blog/i, /article/i, /post/i, /news/i, /content/i],
    tagTypes: ['ga4_event', 'meta_pixel', 'hotjar'],
    performanceRequirements: {
      maxLoadTime: 3000,
      maxFiringDelay: 200,
      priorityLevel: 'medium' as const,
      requiresBlocking: false
    },
    uxRequirements: {
      requiresSPASupport: false,
      requiresHistoryChange: false,
      requiresScrollTracking: true,
      requiresFormTracking: false,
      requiresVideoTracking: false
    },
    businessGoals: [
      { type: 'engagement', priority: 1, description: 'Track content engagement' },
      { type: 'analytics', priority: 2, description: 'Content performance analysis' }
    ]
  },
  corporate: {
    patterns: [/corporate/i, /company/i, /about/i, /contact/i, /services/i],
    tagTypes: ['ga4_event', 'linkedin_insight', 'hotjar'],
    performanceRequirements: {
      maxLoadTime: 2500,
      maxFiringDelay: 150,
      priorityLevel: 'high' as const,
      requiresBlocking: false
    },
    uxRequirements: {
      requiresSPASupport: true,
      requiresHistoryChange: true,
      requiresScrollTracking: true,
      requiresFormTracking: true,
      requiresVideoTracking: true
    },
    businessGoals: [
      { type: 'engagement', priority: 1, description: 'Track lead generation' },
      { type: 'analytics', priority: 2, description: 'Website performance analysis' }
    ]
  },
  saas: {
    patterns: [/app/i, /dashboard/i, /login/i, /signup/i, /account/i, /billing/i],
    tagTypes: ['ga4_event', 'mixpanel', 'amplitude', 'hotjar'],
    performanceRequirements: {
      maxLoadTime: 1500,
      maxFiringDelay: 50,
      priorityLevel: 'critical' as const,
      requiresBlocking: true
    },
    uxRequirements: {
      requiresSPASupport: true,
      requiresHistoryChange: true,
      requiresScrollTracking: false,
      requiresFormTracking: true,
      requiresVideoTracking: false
    },
    businessGoals: [
      { type: 'conversion', priority: 1, description: 'Track user actions and conversions' },
      { type: 'analytics', priority: 2, description: 'Product usage analytics' },
      { type: 'engagement', priority: 3, description: 'User engagement tracking' }
    ]
  }
};

// ============================================================================
// 3. FUNZIONI DI ANALISI CONTESTUALE
// ============================================================================

/**
 * Determina il tipo di sito basato sui tag presenti
 */
export function determineSiteType(tags: GTMTag[]): TriggerContext {
  const tagTypes = tags.map(tag => tag.type?.toLowerCase() || 'unknown');
  const tagNames = tags.map(tag => tag.name?.toLowerCase() || '');
  
  // Analizza pattern nei nomi dei tag
  const allText = [...tagTypes, ...tagNames].join(' ');
  
  let bestMatch = 'unknown';
  let bestScore = 0;
  
  Object.entries(SITE_TYPE_PATTERNS).forEach(([siteType, config]) => {
    let score = 0;
    
    // Controlla pattern nei nomi
    config.patterns.forEach(pattern => {
      if (pattern.test(allText)) {
        score += 1;
      }
    });
    
    // Controlla tipi di tag
    config.tagTypes.forEach(tagType => {
      if (tagTypes.includes(tagType)) {
        score += 0.5;
      }
    });
    
    if (score > bestScore) {
      bestScore = score;
      bestMatch = siteType;
    }
  });
  
  const siteConfig = SITE_TYPE_PATTERNS[bestMatch as keyof typeof SITE_TYPE_PATTERNS];
  
  return {
    siteType: bestMatch as any,
    tagTypes,
    performanceRequirements: siteConfig.performanceRequirements,
    userExperience: siteConfig.uxRequirements,
    businessGoals: siteConfig.businessGoals
  };
}

/**
 * Analizza la qualità di un trigger con contesto
 */
export function analyzeTriggerQualityWithContext(
  trigger: GTMTrigger,
  context: TriggerContext,
  usedByTags: GTMTag[]
): TriggerQualityAnalysis {
  const issues: TriggerIssue[] = [];
  const recommendations: string[] = [];
  
  // Analisi specificità
  const specificityAnalysis = analyzeSpecificity(trigger, context, usedByTags);
  issues.push(...specificityAnalysis.issues);
  recommendations.push(...specificityAnalysis.recommendations);
  
  // Analisi timing
  const timingAnalysis = analyzeTiming(trigger, context, usedByTags);
  issues.push(...timingAnalysis.issues);
  recommendations.push(...timingAnalysis.recommendations);
  
  // Analisi blocking
  const blockingAnalysis = analyzeBlocking(trigger, context, usedByTags);
  issues.push(...blockingAnalysis.issues);
  recommendations.push(...blockingAnalysis.recommendations);
  
  // Analisi SPA
  const spaAnalysis = analyzeSPASupport(trigger, context, usedByTags);
  issues.push(...spaAnalysis.issues);
  recommendations.push(...spaAnalysis.recommendations);
  
  // Analisi hygiene
  const hygieneAnalysis = analyzeHygiene(trigger, context, usedByTags);
  issues.push(...hygieneAnalysis.issues);
  recommendations.push(...hygieneAnalysis.recommendations);
  
  // Analisi contesto
  const contextAnalysis = analyzeContext(trigger, context, usedByTags);
  issues.push(...contextAnalysis.issues);
  recommendations.push(...contextAnalysis.recommendations);
  
  // Calcola score
  const breakdown = {
    specificity: specificityAnalysis.score,
    timing: timingAnalysis.score,
    blocking: blockingAnalysis.score,
    spa: spaAnalysis.score,
    hygiene: hygieneAnalysis.score,
    context: contextAnalysis.score
  };
  
  const overallScore = Object.values(breakdown).reduce((sum, score) => sum + score, 0) / 6;
  
  // Valuta impatto performance
  const performanceImpact = evaluatePerformanceImpact(trigger, context, usedByTags);
  
  return {
    trigger,
    score: Math.round(overallScore * 100) / 100,
    breakdown,
    issues,
    recommendations,
    context,
    usedByTags,
    performanceImpact
  };
}

/**
 * Analizza la specificità del trigger
 */
function analyzeSpecificity(
  trigger: GTMTrigger,
  context: TriggerContext,
  usedByTags: GTMTag[]
): { score: number; issues: TriggerIssue[]; recommendations: string[] } {
  const issues: TriggerIssue[] = [];
  const recommendations: string[] = [];
  let score = 1.0;
  
  const triggerType = trigger.type?.toUpperCase() || '';
  const filters = trigger.filter || [];
  
  // Controlla se è un trigger "All Pages" senza filtri
  if (triggerType === 'PAGEVIEW' && filters.length === 0) {
    const hasMarketingTags = usedByTags.some(tag => isMarketingTag(tag));
    const hasNonCoreTags = usedByTags.some(tag => !isCoreTag(tag));
    
    if (hasMarketingTags && context.performanceRequirements.requiresBlocking) {
      issues.push({
        severity: 'critical',
        category: 'specificity',
        reason: 'All Pages trigger used for marketing tags without blocking',
        suggestion: 'Add blocking triggers or use more specific triggers',
        impact: 'Performance degradation and potential compliance issues',
        fixable: true
      });
      score -= 0.4;
    } else if (hasNonCoreTags) {
      issues.push({
        severity: 'major',
        category: 'specificity',
        reason: 'All Pages trigger used for non-core tags',
        suggestion: 'Use more specific triggers or add filters',
        impact: 'Unnecessary firing and performance impact',
        fixable: true
      });
      score -= 0.3;
    } else {
      issues.push({
        severity: 'minor',
        category: 'specificity',
        reason: 'All Pages trigger without filters',
        suggestion: 'Consider adding filters for better performance',
        impact: 'Minor performance impact',
        fixable: true
      });
      score -= 0.1;
    }
  }
  
  // Controlla filtri troppo generici
  if (filters.length > 0) {
    const genericFilters = filters.filter(filter => 
      filter.value === true || 
      filter.value === '.*' || 
      filter.value === '*' ||
      filter.value === ''
    );
    
    if (genericFilters.length === filters.length) {
      issues.push({
        severity: 'major',
        category: 'specificity',
        reason: 'All filters are generic (match everything)',
        suggestion: 'Add more specific filter conditions',
        impact: 'Reduced trigger specificity',
        fixable: true
      });
      score -= 0.2;
    }
  }
  
  // Raccomandazioni per migliorare specificità
  if (score < 0.7) {
    recommendations.push('Add more specific filter conditions');
    recommendations.push('Consider using different trigger types for different use cases');
  }
  
  return { score: Math.max(0, score), issues, recommendations };
}

/**
 * Analizza il timing del trigger
 */
function analyzeTiming(
  trigger: GTMTrigger,
  context: TriggerContext,
  usedByTags: GTMTag[]
): { score: number; issues: TriggerIssue[]; recommendations: string[] } {
  const issues: TriggerIssue[] = [];
  const recommendations: string[] = [];
  let score = 1.0;
  
  const triggerType = trigger.type?.toUpperCase() || '';
  
  // Valuta timing in base al contesto
  if (triggerType === 'PAGEVIEW') {
    const hasMarketingTags = usedByTags.some(tag => isMarketingTag(tag));
    const hasUXTags = usedByTags.some(tag => isUXTag(tag));
    
    if (hasMarketingTags && context.performanceRequirements.requiresBlocking) {
      issues.push({
        severity: 'critical',
        category: 'timing',
        reason: 'PAGEVIEW trigger for marketing tags without blocking',
        suggestion: 'Use DOM_READY or add blocking triggers',
        impact: 'Performance and compliance issues',
        fixable: true
      });
      score -= 0.4;
    } else if (hasUXTags) {
      issues.push({
        severity: 'minor',
        category: 'timing',
        reason: 'PAGEVIEW trigger for UX tags',
        suggestion: 'Consider WINDOW_LOADED for better UX tracking',
        impact: 'Minor UX impact',
        fixable: true
      });
      score -= 0.1;
    }
  } else if (triggerType === 'WINDOW_LOADED') {
    const hasNonUXTags = usedByTags.some(tag => !isUXTag(tag));
    
    if (hasNonUXTags) {
      issues.push({
        severity: 'major',
        category: 'timing',
        reason: 'WINDOW_LOADED trigger for non-UX tags',
        suggestion: 'Use DOM_READY for better performance',
        impact: 'Performance degradation',
        fixable: true
      });
      score -= 0.3;
    }
  } else if (triggerType === 'DOM_READY') {
    // DOM_READY è generalmente buono
    score = 1.0;
  }
  
  // Controlla se il timing è appropriato per il tipo di sito
  if (context.siteType === 'saas' && triggerType === 'PAGEVIEW') {
    issues.push({
      severity: 'minor',
      category: 'timing',
      reason: 'PAGEVIEW trigger in SaaS application',
      suggestion: 'Consider DOM_READY for better SPA support',
      impact: 'Minor SPA compatibility issues',
      fixable: true
    });
    score -= 0.1;
  }
  
  return { score: Math.max(0, score), issues, recommendations };
}

/**
 * Analizza il supporto SPA
 */
function analyzeSPASupport(
  trigger: GTMTrigger,
  context: TriggerContext,
  usedByTags: GTMTag[]
): { score: number; issues: TriggerIssue[]; recommendations: string[] } {
  const issues: TriggerIssue[] = [];
  const recommendations: string[] = [];
  let score = 1.0;
  
  const triggerType = trigger.type?.toUpperCase() || '';
  
  if (context.userExperience.requiresSPASupport) {
    if (triggerType === 'PAGEVIEW') {
      issues.push({
        severity: 'critical',
        category: 'spa',
        reason: 'PAGEVIEW trigger in SPA application',
        suggestion: 'Use HISTORY_CHANGE trigger for SPA navigation',
        impact: 'SPA navigation not tracked properly',
        fixable: true
      });
      score -= 0.5;
    } else if (triggerType === 'HISTORY_CHANGE') {
      // HISTORY_CHANGE è perfetto per SPA
      score = 1.0;
    } else {
      issues.push({
        severity: 'minor',
        category: 'spa',
        reason: 'Non-HISTORY_CHANGE trigger in SPA application',
        suggestion: 'Consider adding HISTORY_CHANGE trigger for SPA support',
        impact: 'Limited SPA navigation tracking',
        fixable: true
      });
      score -= 0.2;
    }
  }
  
  return { score: Math.max(0, score), issues, recommendations };
}

/**
 * Analizza il blocking
 */
function analyzeBlocking(
  trigger: GTMTrigger,
  context: TriggerContext,
  usedByTags: GTMTag[]
): { score: number; issues: TriggerIssue[]; recommendations: string[] } {
  const issues: TriggerIssue[] = [];
  const recommendations: string[] = [];
  let score = 1.0;
  
  const hasMarketingTags = usedByTags.some(tag => isMarketingTag(tag));
  const hasBlockingTriggers = usedByTags.some(tag => 
    Array.isArray(tag.blockingTriggerId) && tag.blockingTriggerId.length > 0
  );
  
  if (hasMarketingTags && !hasBlockingTriggers && context.performanceRequirements.requiresBlocking) {
    issues.push({
      severity: 'critical',
      category: 'blocking',
      reason: 'Marketing tags without blocking triggers',
      suggestion: 'Add blocking triggers for marketing tags',
      impact: 'Compliance and performance issues',
      fixable: true
    });
    score -= 0.5;
  }
  
  return { score: Math.max(0, score), issues, recommendations };
}

/**
 * Analizza l'hygiene del trigger
 */
function analyzeHygiene(
  trigger: GTMTrigger,
  context: TriggerContext,
  usedByTags: GTMTag[]
): { score: number; issues: TriggerIssue[]; recommendations: string[] } {
  const issues: TriggerIssue[] = [];
  const recommendations: string[] = [];
  let score = 1.0;
  
  // Controlla se il trigger è usato
  if (usedByTags.length === 0) {
    issues.push({
      severity: 'major',
      category: 'hygiene',
      reason: 'Trigger not used by any tags',
      suggestion: 'Remove unused trigger or assign to tags',
      impact: 'Container bloat',
      fixable: true
    });
    score -= 0.4;
  }
  
  // Controlla naming convention
  if (!trigger.name?.match(/^TRG_[A-Z0-9_]+$/)) {
    issues.push({
      severity: 'minor',
      category: 'hygiene',
      reason: 'Trigger name does not follow convention',
      suggestion: 'Rename to TRG_ format',
      impact: 'Maintenance difficulty',
      fixable: true
    });
    score -= 0.1;
  }
  
  return { score: Math.max(0, score), issues, recommendations };
}

/**
 * Analizza il contesto del trigger
 */
function analyzeContext(
  trigger: GTMTrigger,
  context: TriggerContext,
  usedByTags: GTMTag[]
): { score: number; issues: TriggerIssue[]; recommendations: string[] } {
  const issues: TriggerIssue[] = [];
  const recommendations: string[] = [];
  let score = 1.0;
  
  // Controlla se il trigger è appropriato per il tipo di sito
  const triggerType = trigger.type?.toUpperCase() || '';
  
  if (context.siteType === 'ecommerce' && triggerType === 'PAGEVIEW') {
    const hasConversionTags = usedByTags.some(tag => 
      tag.type?.includes('conversion') || tag.name?.toLowerCase().includes('conversion')
    );
    
    if (hasConversionTags) {
      issues.push({
        severity: 'minor',
        category: 'context',
        reason: 'PAGEVIEW trigger for conversion tags in ecommerce',
        suggestion: 'Consider DOM_READY for better conversion tracking',
        impact: 'Potential conversion tracking issues',
        fixable: true
      });
      score -= 0.1;
    }
  }
  
  return { score: Math.max(0, score), issues, recommendations };
}

/**
 * Valuta l'impatto performance del trigger
 */
function evaluatePerformanceImpact(
  trigger: GTMTrigger,
  context: TriggerContext,
  usedByTags: GTMTag[]
): PerformanceImpact {
  const triggerType = trigger.type?.toUpperCase() || '';
  
  // Stima tempi di caricamento
  let loadTime = 0;
  let firingDelay = 0;
  let blockingTime = 0;
  
  switch (triggerType) {
    case 'PAGEVIEW':
      loadTime = 0;
      firingDelay = 0;
      blockingTime = 0;
      break;
    case 'DOM_READY':
      loadTime = 100;
      firingDelay = 50;
      blockingTime = 0;
      break;
    case 'WINDOW_LOADED':
      loadTime = 200;
      firingDelay = 100;
      blockingTime = 0;
      break;
    case 'HISTORY_CHANGE':
      loadTime = 50;
      firingDelay = 25;
      blockingTime = 0;
      break;
    default:
      loadTime = 50;
      firingDelay = 25;
      blockingTime = 0;
  }
  
  // Aggiungi impatto per tag marketing
  const hasMarketingTags = usedByTags.some(tag => isMarketingTag(tag));
  if (hasMarketingTags) {
    loadTime += 100;
    firingDelay += 50;
  }
  
  // Determina utilizzo risorse
  let resourceUsage: 'low' | 'medium' | 'high' = 'low';
  if (loadTime > 200 || firingDelay > 100) {
    resourceUsage = 'high';
  } else if (loadTime > 100 || firingDelay > 50) {
    resourceUsage = 'medium';
  }
  
  // Determina UX
  let userExperience: 'excellent' | 'good' | 'fair' | 'poor' = 'excellent';
  if (loadTime > context.performanceRequirements.maxLoadTime || 
      firingDelay > context.performanceRequirements.maxFiringDelay) {
    userExperience = 'poor';
  } else if (loadTime > context.performanceRequirements.maxLoadTime * 0.7 || 
             firingDelay > context.performanceRequirements.maxFiringDelay * 0.7) {
    userExperience = 'fair';
  } else if (loadTime > context.performanceRequirements.maxLoadTime * 0.5 || 
             firingDelay > context.performanceRequirements.maxFiringDelay * 0.5) {
    userExperience = 'good';
  }
  
  return {
    loadTime,
    firingDelay,
    blockingTime,
    resourceUsage,
    userExperience
  };
}

// ============================================================================
// 4. FUNZIONI UTILITY
// ============================================================================

function isMarketingTag(tag: GTMTag): boolean {
  const marketingTypes = ['awct', 'awctc', 'facebook_', 'meta_', 'linkedin_', 'bing_', 'tiktok_'];
  const tagType = tag.type?.toLowerCase() || '';
  const tagName = tag.name?.toLowerCase() || '';
  
  return marketingTypes.some(type => 
    tagType.includes(type) || tagName.includes(type)
  );
}

function isCoreTag(tag: GTMTag): boolean {
  const coreTypes = ['gaawc', 'ga4_config', 'gtag'];
  const tagType = tag.type?.toLowerCase() || '';
  const tagName = tag.name?.toLowerCase() || '';
  
  return coreTypes.some(type => 
    tagType.includes(type) || tagName.includes(type)
  );
}

function isUXTag(tag: GTMTag): boolean {
  const uxKeywords = ['hotjar', 'heatmap', 'ux', 'video', 'recording'];
  const tagName = tag.name?.toLowerCase() || '';
  const tagType = tag.type?.toLowerCase() || '';
  
  return uxKeywords.some(keyword => 
    tagName.includes(keyword) || tagType.includes(keyword)
  );
}

