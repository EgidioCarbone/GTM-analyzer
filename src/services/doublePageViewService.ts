/**
 * Advanced Double Page View Detection Service
 * 
 * Sistema migliorato per il rilevamento del doppio page view
 * Risolve le lacune del pattern matching fragile e limitato
 */

import { GTMTag, GTMTrigger } from "../types/gtm";

// ============================================================================
// 1. TIPI E INTERFACCE
// ============================================================================

export interface GA4ConfigAnalysis {
  isConfig: boolean;
  sendPageView: boolean;
  confidence: number;
  evidence: string[];
  measurementId?: string;
  configCommand?: string;
  hasSendPageViewParam: boolean;
  hasMeasurementIdParam: boolean;
  hasEventNameParam: boolean;
}

export interface PageViewEventAnalysis {
  isPageView: boolean;
  confidence: number;
  evidence: string[];
  eventName?: string;
  triggerTypes: string[];
  hasHistoryChange: boolean;
  isManualPageView: boolean;
}

export interface DoublePageViewResult {
  hasDoublePageView: boolean;
  severity: 'critical' | 'warning' | 'ok';
  configTags: Array<{
    id: string;
    name: string;
    type: string;
    analysis: GA4ConfigAnalysis;
    firingTriggers: string[];
  }>;
  pageViewTags: Array<{
    id: string;
    name: string;
    type: string;
    analysis: PageViewEventAnalysis;
    firingTriggers: string[];
  }>;
  conflicts: Array<{
    configTag: string;
    pageViewTag: string;
    sharedTriggers: string[];
    hasHistoryChange: boolean;
    severity: 'critical' | 'warning';
  }>;
  recommendations: string[];
  impact: {
    dataDuplication: boolean;
    performanceImpact: boolean;
    analyticsAccuracy: boolean;
  };
}

// ============================================================================
// 2. FUNZIONI DI ANALISI AVANZATA
// ============================================================================

/**
 * Analizza se un tag è un GA4 Configuration tag
 */
export function analyzeGA4ConfigTag(tag: GTMTag): GA4ConfigAnalysis {
  const evidence: string[] = [];
  let confidence = 0;
  
  // 1. Controlla parametri espliciti
  const sendPageView = getParam(tag, 'send_page_view');
  const measurementId = getParam(tag, 'measurement_id');
  const eventName = getParam(tag, 'eventName');
  
  const hasSendPageViewParam = sendPageView !== undefined;
  const hasMeasurementIdParam = measurementId !== undefined;
  const hasEventNameParam = eventName !== undefined;
  
  if (hasSendPageViewParam) {
    evidence.push(`send_page_view: ${sendPageView}`);
    confidence += 0.4;
  }
  
  if (hasMeasurementIdParam) {
    evidence.push(`measurement_id: ${measurementId}`);
    confidence += 0.3;
  }
  
  if (hasEventNameParam) {
    evidence.push(`eventName: ${eventName}`);
    confidence -= 0.5; // Penalizza se ha eventName (è un evento, non config)
  }
  
  // 2. Analisi del tipo di tag
  const tagType = tag.type?.toLowerCase();
  if (['gaawc', 'ga4_config', 'gtag'].includes(tagType)) {
    evidence.push(`Tag type: ${tagType}`);
    confidence += 0.3;
  }
  
  // 3. Analisi del codice HTML (se presente)
  let configCommand: string | undefined;
  if (tag.html) {
    const htmlAnalysis = analyzeHTMLForGA4Config(tag.html);
    evidence.push(...htmlAnalysis.evidence);
    confidence += htmlAnalysis.confidence;
    configCommand = htmlAnalysis.configCommand;
  }
  
  // 4. Controlla che NON sia un evento
  if (hasEventNameParam) {
    confidence -= 0.5; // Penalizza se ha eventName
  }
  
  // 5. Controlla se ha parametri di configurazione
  const hasConfigParams = hasSendPageViewParam || hasMeasurementIdParam;
  if (hasConfigParams) {
    confidence += 0.2;
  }
  
  return {
    isConfig: confidence > 0.5,
    sendPageView: sendPageView !== false, // default true se non specificato
    confidence: Math.max(0, Math.min(1, confidence)),
    evidence,
    measurementId: hasMeasurementIdParam ? String(measurementId) : undefined,
    configCommand,
    hasSendPageViewParam,
    hasMeasurementIdParam,
    hasEventNameParam
  };
}

/**
 * Analizza se un tag è un page view event
 */
export function analyzePageViewEvent(tag: GTMTag, triggers: GTMTrigger[]): PageViewEventAnalysis {
  const evidence: string[] = [];
  let confidence = 0;
  
  // 1. Controlla parametri espliciti
  const eventName = getParam(tag, 'eventName');
  const hasEventNameParam = eventName !== undefined;
  
  if (hasEventNameParam && eventName === 'page_view') {
    evidence.push(`eventName: ${eventName}`);
    confidence += 0.8;
  }
  
  // 2. Analisi del tipo di tag
  const tagType = tag.type?.toLowerCase();
  if (['gaawe', 'ga4_event'].includes(tagType)) {
    evidence.push(`Tag type: ${tagType}`);
    confidence += 0.3;
  }
  
  // 3. Analisi del codice HTML (se presente)
  if (tag.html) {
    const htmlAnalysis = analyzeHTMLForPageView(tag.html);
    evidence.push(...htmlAnalysis.evidence);
    confidence += htmlAnalysis.confidence;
  }
  
  // 4. Analisi dei trigger
  const firingTriggers = getFiringTriggers(tag);
  const triggerTypes = firingTriggers.map(id => {
    const trigger = triggers.find(t => t.triggerId === id);
    return trigger?.type || 'unknown';
  });
  
  const hasHistoryChange = triggerTypes.includes('HISTORY_CHANGE');
  if (hasHistoryChange) {
    evidence.push('HISTORY_CHANGE trigger detected');
    confidence += 0.2;
  }
  
  // 5. Determina se è un page view manuale
  const isManualPageView = confidence > 0.5;
  
  return {
    isPageView: isManualPageView,
    confidence: Math.max(0, Math.min(1, confidence)),
    evidence,
    eventName: hasEventNameParam ? String(eventName) : undefined,
    triggerTypes,
    hasHistoryChange,
    isManualPageView
  };
}

/**
 * Analizza il codice HTML per GA4 Configuration
 */
function analyzeHTMLForGA4Config(html: string): {
  evidence: string[];
  confidence: number;
  configCommand?: string;
} {
  const evidence: string[] = [];
  let confidence = 0;
  let configCommand: string | undefined;
  
  // Pattern per gtag config
  const gtagConfigPatterns = [
    /gtag\s*\(\s*['"]config['"]/gi,
    /gtag\s*\(\s*["']config["']/gi,
    /gtag\s*\(\s*`config`/gi
  ];
  
  for (const pattern of gtagConfigPatterns) {
    if (pattern.test(html)) {
      evidence.push(`HTML gtag config detected: ${pattern.source}`);
      confidence += 0.4;
      configCommand = 'gtag config';
    }
  }
  
  // Pattern per measurement ID
  const measurementIdPattern = /['"`]G-[A-Z0-9]{10}['"`]/g;
  if (measurementIdPattern.test(html)) {
    evidence.push('Measurement ID found in HTML');
    confidence += 0.3;
  }
  
  // Pattern per send_page_view
  const sendPageViewPattern = /send_page_view\s*:\s*(true|false)/gi;
  if (sendPageViewPattern.test(html)) {
    evidence.push('send_page_view parameter found in HTML');
    confidence += 0.2;
  }
  
  // Pattern per GA4 specifici
  const ga4Patterns = [
    /gtag\s*\(\s*['"]config['"]\s*,\s*['"]G-/gi,
    /gtag\s*\(\s*["']config["']\s*,\s*["']G-/gi
  ];
  
  for (const pattern of ga4Patterns) {
    if (pattern.test(html)) {
      evidence.push('GA4 configuration detected in HTML');
      confidence += 0.3;
    }
  }
  
  return { evidence, confidence, configCommand };
}

/**
 * Analizza il codice HTML per page view events
 */
function analyzeHTMLForPageView(html: string): {
  evidence: string[];
  confidence: number;
} {
  const evidence: string[] = [];
  let confidence = 0;
  
  // Pattern per gtag event page_view
  const pageViewPatterns = [
    /gtag\s*\(\s*['"]event['"]\s*,\s*['"]page_view['"]/gi,
    /gtag\s*\(\s*["']event["']\s*,\s*["']page_view["']/gi,
    /gtag\s*\(\s*`event`\s*,\s*`page_view`/gi
  ];
  
  for (const pattern of pageViewPatterns) {
    if (pattern.test(html)) {
      evidence.push(`HTML page_view event detected: ${pattern.source}`);
      confidence += 0.6;
    }
  }
  
  // Pattern per dataLayer push
  const dataLayerPatterns = [
    /dataLayer\s*\.\s*push\s*\(\s*\{[^}]*event\s*:\s*['"]page_view['"]/gi,
    /dataLayer\s*\.\s*push\s*\(\s*\{[^}]*event\s*:\s*["']page_view["']/gi
  ];
  
  for (const pattern of dataLayerPatterns) {
    if (pattern.test(html)) {
      evidence.push('dataLayer page_view push detected');
      confidence += 0.5;
    }
  }
  
  return { evidence, confidence };
}

/**
 * Analizza i conflitti tra GA4 Config e page view events
 */
function analyzeConflicts(
  configTags: Array<{ id: string; name: string; firingTriggers: string[]; analysis: GA4ConfigAnalysis }>,
  pageViewTags: Array<{ id: string; name: string; firingTriggers: string[]; analysis: PageViewEventAnalysis }>
): Array<{
  configTag: string;
  pageViewTag: string;
  sharedTriggers: string[];
  hasHistoryChange: boolean;
  severity: 'critical' | 'warning';
}> {
  const conflicts: Array<{
    configTag: string;
    pageViewTag: string;
    sharedTriggers: string[];
    hasHistoryChange: boolean;
    severity: 'critical' | 'warning';
  }> = [];
  
  for (const configTag of configTags) {
    if (!configTag.analysis.sendPageView) continue; // Se send_page_view è false, nessun problema
    
    for (const pageViewTag of pageViewTags) {
      // Controlla trigger condivisi
      const sharedTriggers = configTag.firingTriggers.filter(triggerId => 
        pageViewTag.firingTriggers.includes(triggerId)
      );
      
      if (sharedTriggers.length > 0) {
        const hasHistoryChange = pageViewTag.analysis.hasHistoryChange;
        const severity = hasHistoryChange ? 'critical' : 'warning';
        
        conflicts.push({
          configTag: configTag.name,
          pageViewTag: pageViewTag.name,
          sharedTriggers,
          hasHistoryChange,
          severity
        });
      }
    }
  }
  
  return conflicts;
}

/**
 * Genera raccomandazioni per risolvere i conflitti
 */
function generateRecommendations(conflicts: Array<{
  configTag: string;
  pageViewTag: string;
  sharedTriggers: string[];
  hasHistoryChange: boolean;
  severity: 'critical' | 'warning';
}>): string[] {
  const recommendations: string[] = [];
  
  if (conflicts.length === 0) {
    recommendations.push('✅ No double page view detected');
    return recommendations;
  }
  
  const criticalConflicts = conflicts.filter(c => c.severity === 'critical');
  const warningConflicts = conflicts.filter(c => c.severity === 'warning');
  
  if (criticalConflicts.length > 0) {
    recommendations.push('🚨 CRITICAL: Double page view detected with HISTORY_CHANGE triggers');
    recommendations.push('• Set send_page_view: false on GA4 Configuration tags');
    recommendations.push('• Use only manual page_view events for SPA navigation');
    recommendations.push('• Consider using gtag(\'event\', \'page_view\') instead of automatic page views');
  }
  
  if (warningConflicts.length > 0) {
    recommendations.push('⚠️ WARNING: Potential double page view detected');
    recommendations.push('• Review trigger configuration to avoid overlap');
    recommendations.push('• Consider using different triggers for config vs events');
  }
  
  // Raccomandazioni specifiche per ogni conflitto
  conflicts.forEach(conflict => {
    if (conflict.hasHistoryChange) {
      recommendations.push(`• Fix conflict between ${conflict.configTag} and ${conflict.pageViewTag} (HISTORY_CHANGE)`);
    } else {
      recommendations.push(`• Review shared triggers between ${conflict.configTag} and ${conflict.pageViewTag}`);
    }
  });
  
  return recommendations;
}

/**
 * Funzione principale per rilevare il doppio page view
 */
export function detectDoublePageView(
  tags: GTMTag[],
  triggers: GTMTrigger[]
): DoublePageViewResult {
  // 1. Analizza GA4 Configuration tags
  const configTags = tags
    .map(tag => ({
      id: tag.tagId || tag.name,
      name: tag.name,
      type: tag.type,
      analysis: analyzeGA4ConfigTag(tag),
      firingTriggers: getFiringTriggers(tag)
    }))
    .filter(item => item.analysis.isConfig);
  
  // 2. Analizza page view events
  const pageViewTags = tags
    .map(tag => ({
      id: tag.tagId || tag.name,
      name: tag.name,
      type: tag.type,
      analysis: analyzePageViewEvent(tag, triggers),
      firingTriggers: getFiringTriggers(tag)
    }))
    .filter(item => item.analysis.isPageView);
  
  // 3. Analizza conflitti
  const conflicts = analyzeConflicts(configTags, pageViewTags);
  
  // 4. Determina severità
  const hasDoublePageView = conflicts.length > 0;
  const hasCriticalConflicts = conflicts.some(c => c.severity === 'critical');
  const severity = hasCriticalConflicts ? 'critical' : hasDoublePageView ? 'warning' : 'ok';
  
  // 5. Genera raccomandazioni
  const recommendations = generateRecommendations(conflicts);
  
  // 6. Valuta l'impatto
  const impact = {
    dataDuplication: hasDoublePageView,
    performanceImpact: hasDoublePageView,
    analyticsAccuracy: hasDoublePageView
  };
  
  return {
    hasDoublePageView,
    severity,
    configTags,
    pageViewTags,
    conflicts,
    recommendations,
    impact
  };
}

// ============================================================================
// 3. FUNZIONI UTILITY
// ============================================================================

function getParam(tag: GTMTag, key: string): any {
  return (tag.parameter || []).find(p => p.key === key)?.value;
}

function getFiringTriggers(tag: GTMTag): string[] {
  if (Array.isArray(tag.firingTriggerId)) {
    return tag.firingTriggerId;
  }
  return tag.firingTriggerId ? [tag.firingTriggerId] : [];
}

