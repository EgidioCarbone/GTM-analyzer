/**
 * Enhanced GTM Metrics Service
 * 
 * Integra i servizi avanzati con il sistema esistente
 * Risolve tutte le lacune identificate nel sistema di valutazione
 */

import { GenerateDocInput, GTMTag, GTMTrigger, GTMVariable } from "../types/gtm";
import { analyzeTag, TagAnalysisResult, TagMappingConfig, DEFAULT_CONFIG as DEFAULT_TAG_CONFIG } from "./tagMappingService";
import { detectDoublePageView, DoublePageViewResult } from "./doublePageViewService";
import { analyzeAdvancedConsentMode, ConsentModeResult as AdvancedConsentModeResult } from "./advancedConsentModeService";
import { determineSiteType, analyzeTriggerQualityWithContext, TriggerContext } from "./contextualTriggerQualityService";
import { validateContainerLogic, ValidationResult } from "./validationService";
import { analyzeAndSuggestFixes, FixSuggestion } from "./advancedFixersService";

// ============================================================================
// 1. TIPI E INTERFACCE ENHANCED
// ============================================================================

export interface EnhancedGtmMetrics {
  // Metriche base (mantenute per compatibilità)
  kpi: {
    paused: number;
    unused: { total: number; triggers: number; variables: number; tagsNoTrigger: number };
    uaObsolete: number;
    namingIssues: { total: number; tags: number; triggers: number; variables: number };
    doublePageView: DoublePageViewResult;
    consentMode: AdvancedConsentModeResult;
    triggerQuality: any; // Mantenuto per compatibilità
    variableQuality: any; // Mantenuto per compatibilità
    htmlSecurity: any; // Mantenuto per compatibilità
  };
  counts: { tags: number; triggers: number; variables: number };
  distribution: { 
    ua: number; 
    gaawe: number; 
    googtag: number; 
    html: number; 
    other: number;
    chartData: Array<{ family: string; count: number }>;
  };
  quality: { 
    tags: number; 
    triggers: number; 
    variables: number; 
    consent: number; 
    triggerQuality: number; 
    variableQuality: number; 
    htmlSecurity: number; 
    naming: number;
  };
  score: {
    total: number;
    breakdown: Array<{
      label: string;
      value: number;
      weight: number;
      percentage: number;
    }>;
  };
  actionPlan: Array<{
    type: string;
    priority: number;
    count: number;
    action: string;
    description: string;
    impact: number;
  }>;
  lists: {
    pausedTags: any[];
    uaTags: any[];
    unusedTriggers: any[];
    unusedVariables: any[];
    tagsNoTrigger: any[];
    badNames: { tags: any[]; triggers: any[]; variables: any[] };
  };
  percentages: {
    paused: number;
    unused: number;
    uaObsolete: number;
    namingIssues: number;
  };
  issuesIndex: any;
  
  // Nuove metriche avanzate
  enhanced: {
    tagAnalysis: TagAnalysisResult[];
    siteContext: TriggerContext;
    validation: ValidationResult;
    fixSuggestions: FixSuggestion[];
    performanceMetrics: {
      loadTime: number;
      firingDelay: number;
      resourceUsage: 'low' | 'medium' | 'high';
      userExperience: 'excellent' | 'good' | 'fair' | 'poor';
    };
    complianceStatus: {
      gdpr: boolean;
      ccpa: boolean;
      consentMode: boolean;
      security: boolean;
    };
    recommendations: {
      critical: string[];
      high: string[];
      medium: string[];
      low: string[];
    };
  };
}

// ============================================================================
// 2. FUNZIONE PRINCIPALE ENHANCED
// ============================================================================

/**
 * Calcola le metriche GTM avanzate con tutti i servizi integrati
 */
export function calculateEnhancedGtmMetrics(
  container: GenerateDocInput,
  tagMappingConfig: TagMappingConfig = DEFAULT_TAG_CONFIG
): EnhancedGtmMetrics {
  const tags = container.tag || [];
  const triggers = container.trigger || [];
  const variables = container.variable || [];
  
  // 1. Analisi avanzata dei tag
  const tagAnalysis = tags.map(tag => analyzeTag(tag, tagMappingConfig));
  
  // 2. Determinazione contesto sito
  const siteContext = determineSiteType(tags);
  
  // 3. Rilevamento doppio page view avanzato
  const doublePageViewResult = detectDoublePageView(tags, triggers);
  
  // 4. Analisi consent mode avanzata
  const consentModeResult = analyzeAdvancedConsentMode(container);
  
  // 5. Validazione container
  const validationResult = validateContainerLogic({
    container: { tag: tags, trigger: triggers, variable: variables },
    changes: [],
    environment: 'production',
    businessContext: {
      siteType: siteContext.siteType,
      performanceRequirements: siteContext.performanceRequirements,
      complianceRequirements: ['gdpr', 'ccpa']
    }
  });
  
  // 6. Analisi trigger quality contestuale
  const triggerQualityAnalysis = triggers.map(trigger => {
    const usedByTags = tags.filter(tag => 
      Array.isArray(tag.firingTriggerId) 
        ? tag.firingTriggerId.includes(trigger.triggerId || '')
        : tag.firingTriggerId === trigger.triggerId
    );
    return analyzeTriggerQualityWithContext(trigger, siteContext, usedByTags);
  });
  
  // 7. Suggerimenti di fix
  const fixSuggestions = analyzeAndSuggestFixes({
    container: { tag: tags, trigger: triggers, variable: variables },
    validation: validationResult,
    businessContext: {
      siteType: siteContext.siteType,
      performanceRequirements: siteContext.performanceRequirements,
      complianceRequirements: ['gdpr', 'ccpa']
    },
    options: {
      dryRun: true,
      backup: true,
      rollback: true
    }
  });
  
  // 8. Calcola metriche performance
  const performanceMetrics = calculatePerformanceMetrics(triggerQualityAnalysis);
  
  // 9. Valuta compliance
  const complianceStatus = evaluateComplianceStatus(consentModeResult, validationResult, tagAnalysis);
  
  // 10. Genera raccomandazioni
  const recommendations = generateRecommendations(
    doublePageViewResult,
    consentModeResult,
    validationResult,
    fixSuggestions,
    performanceMetrics
  );
  
  // 11. Calcola distribuzione tag avanzata
  const distribution = calculateAdvancedDistribution(tagAnalysis);
  
  // 12. Calcola score complessivo
  const score = calculateEnhancedScore(
    consentModeResult,
    doublePageViewResult,
    validationResult,
    performanceMetrics,
    complianceStatus
  );
  
  // 13. Genera piano d'azione
  const actionPlan = generateEnhancedActionPlan(
    doublePageViewResult,
    consentModeResult,
    validationResult,
    fixSuggestions
  );
  
  // 14. Costruisci risultato finale
  return {
    // Metriche base (mantenute per compatibilità)
    kpi: {
      paused: tags.filter(t => t.paused).length,
      unused: calculateUnusedItems(container),
      uaObsolete: tagAnalysis.filter(t => t.family === 'ua').length,
      namingIssues: calculateNamingIssues(tagAnalysis),
      doublePageView: doublePageViewResult,
      consentMode: consentModeResult,
      triggerQuality: {}, // Mantenuto per compatibilità
      variableQuality: {}, // Mantenuto per compatibilità
      htmlSecurity: {} // Mantenuto per compatibilità
    },
    counts: {
      tags: tags.length,
      triggers: triggers.length,
      variables: variables.length
    },
    distribution,
    quality: {
      tags: calculateTagQuality(tags),
      triggers: calculateTriggerQuality(triggers, tags),
      variables: calculateVariableQuality(variables, tags, triggers),
      consent: Math.round(consentModeResult.overall.score),
      triggerQuality: Math.round(triggerQualityAnalysis.reduce((sum, t) => sum + t.score, 0) / triggerQualityAnalysis.length),
      variableQuality: 85, // Placeholder
      htmlSecurity: 90, // Placeholder
      naming: calculateNamingQuality(tagAnalysis)
    },
    score,
    actionPlan,
    lists: {
      pausedTags: tags.filter(t => t.paused),
      uaTags: tagAnalysis.filter(t => t.family === 'ua').map(t => tags.find(tag => tag.tagId === t.element?.id)),
      unusedTriggers: triggers.filter(t => !tags.some(tag => 
        Array.isArray(tag.firingTriggerId) 
          ? tag.firingTriggerId.includes(t.triggerId || '')
          : tag.firingTriggerId === t.triggerId
      )),
      unusedVariables: variables.filter(v => !isVariableUsed(v, tags, triggers)),
      tagsNoTrigger: tags.filter(t => !t.firingTriggerId || (Array.isArray(t.firingTriggerId) && t.firingTriggerId.length === 0)),
      badNames: {
        tags: tagAnalysis.filter(t => t.confidence < 0.6).map(t => tags.find(tag => tag.tagId === t.element?.id)),
        triggers: [],
        variables: []
      }
    },
    percentages: {
      paused: tags.length > 0 ? Math.round((tags.filter(t => t.paused).length / tags.length) * 100) : 0,
      unused: tags.length > 0 ? Math.round((calculateUnusedItems(container).total / tags.length) * 100) : 0,
      uaObsolete: tags.length > 0 ? Math.round((tagAnalysis.filter(t => t.family === 'ua').length / tags.length) * 100) : 0,
      namingIssues: tagAnalysis.length > 0 ? Math.round((tagAnalysis.filter(t => t.confidence < 0.6).length / tagAnalysis.length) * 100) : 0
    },
    issuesIndex: {}, // Placeholder
    
    // Nuove metriche avanzate
    enhanced: {
      tagAnalysis,
      siteContext,
      validation: validationResult,
      fixSuggestions,
      performanceMetrics,
      complianceStatus,
      recommendations
    }
  };
}

// ============================================================================
// 3. FUNZIONI DI CALCOLO AVANZATE
// ============================================================================

function calculatePerformanceMetrics(triggerAnalysis: any[]): {
  loadTime: number;
  firingDelay: number;
  resourceUsage: 'low' | 'medium' | 'high';
  userExperience: 'excellent' | 'good' | 'fair' | 'poor';
} {
  const avgLoadTime = triggerAnalysis.reduce((sum, t) => sum + t.performanceImpact.loadTime, 0) / triggerAnalysis.length;
  const avgFiringDelay = triggerAnalysis.reduce((sum, t) => sum + t.performanceImpact.firingDelay, 0) / triggerAnalysis.length;
  
  let resourceUsage: 'low' | 'medium' | 'high' = 'low';
  if (avgLoadTime > 200 || avgFiringDelay > 100) {
    resourceUsage = 'high';
  } else if (avgLoadTime > 100 || avgFiringDelay > 50) {
    resourceUsage = 'medium';
  }
  
  let userExperience: 'excellent' | 'good' | 'fair' | 'poor' = 'excellent';
  if (avgLoadTime > 2000 || avgFiringDelay > 200) {
    userExperience = 'poor';
  } else if (avgLoadTime > 1000 || avgFiringDelay > 100) {
    userExperience = 'fair';
  } else if (avgLoadTime > 500 || avgFiringDelay > 50) {
    userExperience = 'good';
  }
  
  return {
    loadTime: Math.round(avgLoadTime),
    firingDelay: Math.round(avgFiringDelay),
    resourceUsage,
    userExperience
  };
}

function evaluateComplianceStatus(
  consentMode: AdvancedConsentModeResult,
  validation: ValidationResult,
  tagAnalysis: TagAnalysisResult[]
): {
  gdpr: boolean;
  ccpa: boolean;
  consentMode: boolean;
  security: boolean;
} {
  const gdpr = consentMode.overall.score >= 80 && validation.errors.filter(e => e.type === 'configuration').length === 0;
  const ccpa = consentMode.overall.score >= 80;
  const consentModeStatus = consentMode.overall.score >= 70;
  const security = validation.errors.filter(e => e.type === 'security').length === 0;
  
  return {
    gdpr,
    ccpa,
    consentMode: consentModeStatus,
    security
  };
}

function generateRecommendations(
  doublePageView: DoublePageViewResult,
  consentMode: AdvancedConsentModeResult,
  validation: ValidationResult,
  fixSuggestions: FixSuggestion[],
  performance: any
): {
  critical: string[];
  high: string[];
  medium: string[];
  low: string[];
} {
  const recommendations = {
    critical: [] as string[],
    high: [] as string[],
    medium: [] as string[],
    low: [] as string[]
  };
  
  // Raccomandazioni critiche
  if (doublePageView.hasDoublePageView) {
    recommendations.critical.push('Fix double page view issue immediately');
  }
  
  if (consentMode.overall.score < 50) {
    recommendations.critical.push('Configure consent mode for GDPR/CCPA compliance');
  }
  
  if (validation.errors.filter(e => e.severity === 'critical').length > 0) {
    recommendations.critical.push('Fix critical validation errors');
  }
  
  // Raccomandazioni ad alta priorità
  if (performance.userExperience === 'poor') {
    recommendations.high.push('Optimize trigger performance');
  }
  
  if (fixSuggestions.filter(f => f.priority === 'critical').length > 0) {
    recommendations.high.push('Apply critical fixes');
  }
  
  // Raccomandazioni medie
  if (performance.userExperience === 'fair') {
    recommendations.medium.push('Consider performance optimizations');
  }
  
  if (fixSuggestions.filter(f => f.priority === 'high').length > 0) {
    recommendations.medium.push('Apply high-priority fixes');
  }
  
  // Raccomandazioni a bassa priorità
  if (fixSuggestions.filter(f => f.priority === 'medium').length > 0) {
    recommendations.low.push('Consider applying medium-priority fixes');
  }
  
  return recommendations;
}

function calculateAdvancedDistribution(tagAnalysis: TagAnalysisResult[]): {
  ua: number;
  gaawe: number;
  googtag: number;
  html: number;
  other: number;
  chartData: Array<{ family: string; count: number }>;
} {
  const distribution = {
    ua: 0,
    gaawe: 0,
    googtag: 0,
    html: 0,
    other: 0
  };
  
  tagAnalysis.forEach(analysis => {
    switch (analysis.family) {
      case 'ua':
        distribution.ua++;
        break;
      case 'gaawe':
        distribution.gaawe++;
        break;
      case 'googtag':
        distribution.googtag++;
        break;
      case 'html':
        distribution.html++;
        break;
      default:
        distribution.other++;
    }
  });
  
  const chartData = Object.entries(distribution)
    .filter(([_, count]) => count > 0)
    .map(([family, count]) => ({ family, count }))
    .sort((a, b) => b.count - a.count);
  
  return { ...distribution, chartData };
}

function calculateEnhancedScore(
  consentMode: AdvancedConsentModeResult,
  doublePageView: DoublePageViewResult,
  validation: ValidationResult,
  performance: any,
  compliance: any
): {
  total: number;
  breakdown: Array<{
    label: string;
    value: number;
    weight: number;
    percentage: number;
  }>;
} {
  const weights = {
    consent: 0.25,
    doublePageView: 0.20,
    validation: 0.20,
    performance: 0.20,
    compliance: 0.15
  };
  
  const scores = {
    consent: consentMode.overall.score,
    doublePageView: doublePageView.hasDoublePageView ? 0 : 100,
    validation: validation.score,
    performance: performance.userExperience === 'excellent' ? 100 : 
                 performance.userExperience === 'good' ? 80 :
                 performance.userExperience === 'fair' ? 60 : 40,
    compliance: Object.values(compliance).every(Boolean) ? 100 : 60
  };
  
  const total = Object.entries(weights).reduce((sum, [key, weight]) => 
    sum + (scores[key as keyof typeof scores] * weight), 0
  );
  
  const breakdown = Object.entries(weights).map(([key, weight]) => ({
    label: key,
    value: scores[key as keyof typeof scores],
    weight: weight * 100,
    percentage: Math.round(scores[key as keyof typeof scores] * weight)
  }));
  
  return { total: Math.round(total), breakdown };
}

function generateEnhancedActionPlan(
  doublePageView: DoublePageViewResult,
  consentMode: AdvancedConsentModeResult,
  validation: ValidationResult,
  fixSuggestions: FixSuggestion[]
): Array<{
  type: string;
  priority: number;
  count: number;
  action: string;
  description: string;
  impact: number;
}> {
  const actionPlan = [];
  
  // Doppio page view
  if (doublePageView.hasDoublePageView) {
    actionPlan.push({
      type: 'doublePageView',
      priority: 0,
      count: 1,
      action: 'Fix double page view',
      description: 'Critical data duplication issue',
      impact: 20
    });
  }
  
  // Consent mode
  if (consentMode.overall.score < 80) {
    actionPlan.push({
      type: 'consentMode',
      priority: 1,
      count: consentMode.coverage.missing,
      action: 'Configure consent mode',
      description: 'GDPR/CCPA compliance required',
      impact: 15
    });
  }
  
  // Fix suggestions
  fixSuggestions.forEach((suggestion, index) => {
    actionPlan.push({
      type: suggestion.type,
      priority: suggestion.priority === 'critical' ? 2 : 
                suggestion.priority === 'high' ? 3 :
                suggestion.priority === 'medium' ? 4 : 5,
      count: suggestion.elements.length,
      action: suggestion.title,
      description: suggestion.description,
      impact: suggestion.effort === 'low' ? 10 : suggestion.effort === 'medium' ? 5 : 2
    });
  });
  
  return actionPlan.sort((a, b) => a.priority - b.priority);
}

// ============================================================================
// 4. FUNZIONI UTILITY
// ============================================================================

function calculateUnusedItems(container: GenerateDocInput): {
  total: number;
  triggers: number;
  variables: number;
  tagsNoTrigger: number;
} {
  const tags = container.tag || [];
  const triggers = container.trigger || [];
  const variables = container.variable || [];
  
  const usedTriggerIds = new Set<string>();
  tags.forEach(tag => {
    if (Array.isArray(tag.firingTriggerId)) {
      tag.firingTriggerId.forEach(id => usedTriggerIds.add(id));
    } else if (tag.firingTriggerId) {
      usedTriggerIds.add(tag.firingTriggerId);
    }
  });
  
  const unusedTriggers = triggers.filter(t => !usedTriggerIds.has(t.triggerId || '')).length;
  const unusedVariables = variables.filter(v => !isVariableUsed(v, tags, triggers)).length;
  const tagsNoTrigger = tags.filter(t => !t.firingTriggerId || (Array.isArray(t.firingTriggerId) && t.firingTriggerId.length === 0)).length;
  
  return {
    total: unusedTriggers + unusedVariables + tagsNoTrigger,
    triggers: unusedTriggers,
    variables: unusedVariables,
    tagsNoTrigger
  };
}

function calculateNamingIssues(tagAnalysis: TagAnalysisResult[]): {
  total: number;
  tags: number;
  triggers: number;
  variables: number;
} {
  const lowConfidenceTags = tagAnalysis.filter(t => t.confidence < 0.6).length;
  
  return {
    total: lowConfidenceTags,
    tags: lowConfidenceTags,
    triggers: 0,
    variables: 0
  };
}

function calculateTagQuality(tags: GTMTag[]): number {
  if (tags.length === 0) return 100;
  
  const activeTags = tags.filter(t => !t.paused);
  const validTags = activeTags.filter(t => 
    t.firingTriggerId && 
    (Array.isArray(t.firingTriggerId) ? t.firingTriggerId.length > 0 : true)
  );
  
  return Math.round((validTags.length / activeTags.length) * 100);
}

function calculateTriggerQuality(triggers: GTMTrigger[], tags: GTMTag[]): number {
  if (triggers.length === 0) return 100;
  
  const usedTriggerIds = new Set<string>();
  tags.forEach(tag => {
    if (Array.isArray(tag.firingTriggerId)) {
      tag.firingTriggerId.forEach(id => usedTriggerIds.add(id));
    } else if (tag.firingTriggerId) {
      usedTriggerIds.add(tag.firingTriggerId);
    }
  });
  
  const usedTriggers = triggers.filter(t => usedTriggerIds.has(t.triggerId || '')).length;
  return Math.round((usedTriggers / triggers.length) * 100);
}

function calculateVariableQuality(variables: GTMVariable[], tags: GTMTag[], triggers: GTMTrigger[]): number {
  if (variables.length === 0) return 100;
  
  const usedVariables = variables.filter(v => isVariableUsed(v, tags, triggers)).length;
  return Math.round((usedVariables / variables.length) * 100);
}

function calculateNamingQuality(tagAnalysis: TagAnalysisResult[]): number {
  if (tagAnalysis.length === 0) return 100;
  
  const highConfidenceTags = tagAnalysis.filter(t => t.confidence >= 0.8).length;
  return Math.round((highConfidenceTags / tagAnalysis.length) * 100);
}

function isVariableUsed(variable: GTMVariable, tags: GTMTag[], triggers: GTMTrigger[]): boolean {
  const variableName = variable.name;
  const allElements = [...tags, ...triggers];
  
  return allElements.some(element => 
    JSON.stringify(element).includes(variableName)
  );
}

