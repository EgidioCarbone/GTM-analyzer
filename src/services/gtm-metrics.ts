/**
 * GTM Metrics - Calcolo deterministico dei KPI per la dashboard
 * 
 * Questo modulo calcola tutti i KPI che compaiono nella dashboard
 * usando solo la struttura del container GTM, senza deduzioni dai nomi.
 * Include consistency checks per intercettare errori di calcolo.
 */

// ============================================================================
// 0. CONFIGURAZIONE CENTRALIZZATA
// ============================================================================

export const SCORE_WEIGHTS = {
  tags: 0.18,
  triggers: 0.18, 
  variables: 0.14,
  consent: 0.14, // 14% per consent mode
  triggerQuality: 0.14, // 14% per trigger quality
  variableQuality: 0.14, // 14% per variable quality
  htmlSecurity: 0.08, // 8% per HTML security
};

// ============================================================================
// 1. ASSUNZIONI DI INPUT
// ============================================================================

import { GenerateDocInput, GTMTag, GTMTrigger, GTMVariable } from "../types/gtm";
import { analyzeConsentMode, ConsentModeResult } from "./consentModeService";
import { analyzeTriggerQuality, TriggerQualityResult } from "./triggerQualityService";
import { analyzeVariableQuality, VariableQualityResult } from "./variableQualityService";
import { analyzeHtmlSecurity, HtmlSecurityResult } from "./htmlSecurityService";

export interface GTMContainerVersion extends GenerateDocInput {
  // Estende GenerateDocInput per compatibilità
}

// ============================================================================
// 1. NORMALIZZAZIONE & UTILITÀ
// ============================================================================

// 1.1 Family mapping - evita errori sui tipi di tag
const TAG_FAMILY: Record<string, 'ua' | 'gaawe' | 'googtag' | 'html' | 'other'> = {
  // Google templates più comuni
  ua: 'ua',                 // Universal Analytics (obsoleto)
  gaawe: 'gaawe',           // GA4 Event
  googtag: 'googtag',       // Google tag (GA4 Configuration)
  html: 'html',             // Custom HTML
  // fallback
  // aggiungi qui eventuali altri template usati nel tuo parco container
};

function familyOf(tagType: string): 'ua' | 'gaawe' | 'googtag' | 'html' | 'other' {
  return TAG_FAMILY[tagType] ?? 'other';
}

// 1.2 Lettura parametri GTM (liste/mappe annidate)
function getParam(tagOrVar: any, key: string): any {
  return (tagOrVar.parameter || []).find((p: any) => p.key === key)?.value;
}

// Estrai tutti i valori stringa (profondità arbitraria) per cercare variabili {{...}}
function deepStringValues(x: any, out: string[] = []): string[] {
  if (x == null) return out;
  if (typeof x === 'string') out.push(x);
  else if (Array.isArray(x)) x.forEach(v => deepStringValues(v, out));
  else if (typeof x === 'object') Object.values(x).forEach(v => deepStringValues(v, out));
  return out;
}

// Estrai variabili GTM referenziate come {{VAR_NAME}}
const RX_VAR = /\{\{\s*([^}]+?)\s*\}\}/g;
function extractVarRefsFromAny(obj: any): Set<string> {
  const hits = new Set<string>();
  deepStringValues(obj).forEach(s => {
    let m;
    while ((m = RX_VAR.exec(s))) {
      hits.add(m[1]);
    }
  });
  return hits;
}

// 1.3 Indici rapidi
function createIndices(cv: GTMContainerVersion) {
  const tagById = Object.fromEntries((cv.tag || []).map((t: any) => [String(t.tagId), t]));
  const trigById = Object.fromEntries((cv.trigger || []).map((t: any) => [String(t.triggerId), t]));
  const varByName = Object.fromEntries((cv.variable || []).map((v: any) => [String(v.name), v]));
  return { tagById, trigById, varByName };
}

// ============================================================================
// 2. KPI "TESTATA" (BOX ROSSI/GIALLI/AZZURRI)
// ============================================================================

// 2.1 In Pausa
function calculatePausedTags(cv: GTMContainerVersion) {
  const tags = cv.tag || [];
  const pausedTags = tags.filter(t => t.paused === true);
  return {
    count: pausedTags.length,
    tags: pausedTags
  };
}

// 2.2 Non Utilizzati
function calculateUnusedItems(cv: GTMContainerVersion) {
  const tags = cv.tag || [];
  const triggers = cv.trigger || [];
  const variables = cv.variable || [];

  // Trigger usati
  const firingRefs = new Set<string>();
  tags.forEach(t => {
    if (Array.isArray(t.firingTriggerId)) {
      t.firingTriggerId.forEach((id: string) => firingRefs.add(id));
    } else if (t.firingTriggerId) {
      firingRefs.add(t.firingTriggerId);
    }
  });
  const usedTrigIds = new Set([...firingRefs]);
  const unusedTriggers = triggers.filter(tr => !usedTrigIds.has(tr.triggerId || ''));

  // Variabili usate: in tag, trigger e variabili (riferimenti annidati)
  const varRefs = new Set<string>();
  tags.forEach(t => extractVarRefsFromAny(t).forEach(n => varRefs.add(n)));
  triggers.forEach(tr => extractVarRefsFromAny(tr).forEach(n => varRefs.add(n)));
  variables.forEach(v => extractVarRefsFromAny(v).forEach(n => varRefs.add(n)));
  const usedVarNames = varRefs;
  const unusedVariables = variables.filter(v => !usedVarNames.has(v.name));

  // Tag senza trigger
  const tagsNoTrigger = tags.filter(t => {
    if (Array.isArray(t.firingTriggerId)) {
      return t.firingTriggerId.length === 0;
    }
    return !t.firingTriggerId;
  });

  return {
    total: unusedTriggers.length + unusedVariables.length,
    triggers: unusedTriggers.length,
    variables: unusedVariables.length,
    tagsNoTrigger: tagsNoTrigger.length,
    unusedTriggers,
    unusedVariables,
    tagsNoTriggerArray: tagsNoTrigger
  };
}

// 2.3 UA Obsoleti
function calculateUAObsolete(cv: GTMContainerVersion) {
  const tags = cv.tag || [];
  const uaTags = tags.filter(t => familyOf(t.type) === 'ua');
  return {
    count: uaTags.length,
    tags: uaTags
  };
}

// 2.4 Naming Issues
function calculateNamingIssues(cv: GTMContainerVersion) {
  // Regole consigliate (configurabili)
  const NAMING_RULES: Record<'tag' | 'trigger' | 'variable', RegExp> = {
    tag: /^(UA|GA4_EVENT|GTAG|HTML)_[A-Z0-9_]+$/,
    trigger: /^TRG_[A-Z0-9_]+$/,
    variable: /^(DLV|JS|CONST|URL|CSS|RANDOM)_[A-Z0-9_]+$/
  };

  function violates(rule: RegExp, name: string): boolean {
    return !rule.test(String(name || ''));
  }

  const badTagNames = (cv.tag || []).filter(t => violates(NAMING_RULES.tag, t.name));
  const badTrigNames = (cv.trigger || []).filter(tr => violates(NAMING_RULES.trigger, tr.name));
  const badVarNames = (cv.variable || []).filter(v => violates(NAMING_RULES.variable, v.name));

  return {
    total: badTagNames.length + badTrigNames.length + badVarNames.length,
    tags: badTagNames.length,
    triggers: badTrigNames.length,
    variables: badVarNames.length,
    badTagNames,
    badTrigNames,
    badVarNames
  };
}

// 2.5 Doppio Page View (CRITICA)
function calculateDoublePageView(cv: GTMContainerVersion) {
  const tags = cv.tag || [];
  const triggers = cv.trigger || [];

  // Helper per estrarre parametri
  const getParam = (tag: any, key: string): any => {
    return (tag.parameter || []).find((p: any) => p.key === key)?.value;
  };

  // Helper per ottenere firing triggers
  const getFiringTriggers = (tag: any): string[] => {
    if (Array.isArray(tag.firingTriggerId)) {
      return tag.firingTriggerId;
    }
    return tag.firingTriggerId ? [tag.firingTriggerId] : [];
  };

  // 1. Individua GA4 Configuration tags
  const ga4ConfigTags = tags.filter(tag => {
    const type = tag.type?.toLowerCase();
    
    // Heuristics per GA4 Config
    if (['gaawc', 'ga4_config', 'gtag'].includes(type)) {
      // Se è gtag, controlla se ha comando config
      if (type === 'gtag' && tag.html) {
        return tag.html.includes('gtag(\'config\'');
      }
      return true;
    }
    
    // Controlla parametri specifici
    const hasSendPageView = getParam(tag, 'send_page_view') !== undefined;
    const hasMeasurementId = getParam(tag, 'measurement_id') !== undefined;
    const hasEventName = getParam(tag, 'eventName') !== undefined;
    
    return (hasSendPageView || hasMeasurementId) && !hasEventName;
  }).map(tag => ({
    id: tag.tagId,
    name: tag.name,
    type: tag.type,
    send_page_view: getParam(tag, 'send_page_view') !== false, // default true se assente
    firingTriggers: getFiringTriggers(tag)
  }));

  // 2. Individua page_view manuali
  const manualPageViewTags = tags.filter(tag => {
    const type = tag.type?.toLowerCase();
    const eventName = getParam(tag, 'eventName');
    
    // GA4 Event con page_view
    if (['gaawe', 'ga4_event'].includes(type) && eventName === 'page_view') {
      return true;
    }
    
    // Custom HTML/gtag con page_view
    if (type === 'html' && tag.html) {
      return tag.html.includes("gtag('event','page_view'") || 
             tag.html.includes('gtag("event","page_view"');
    }
    
    return false;
  }).map(tag => ({
    id: tag.tagId,
    name: tag.name,
    type: tag.type,
    firingTriggers: getFiringTriggers(tag)
  }));

  // 3. Controlla overlap e HISTORY_CHANGE
  let hasOverlap = false;
  let sharedTriggers: string[] = [];
  let hasHistoryChange = false;

  // Controlla se ci sono HISTORY_CHANGE triggers
  const historyChangeTriggers = triggers
    .filter(tr => tr.type === 'HISTORY_CHANGE')
    .map(tr => tr.triggerId);

  // Controlla overlap tra GA4 Config e page_view manuali
  for (const configTag of ga4ConfigTags) {
    if (!configTag.send_page_view) continue; // Se send_page_view è false, nessun problema
    
    for (const pvTag of manualPageViewTags) {
      // Controlla trigger condivisi
      const commonTriggers = configTag.firingTriggers.filter((triggerId: string) => 
        pvTag.firingTriggers.includes(triggerId)
      );
      
      if (commonTriggers.length > 0) {
        hasOverlap = true;
        sharedTriggers.push(...commonTriggers);
      }
      
      // Controlla HISTORY_CHANGE
      const hasHistoryChangeTrigger = pvTag.firingTriggers.some((triggerId: string) => 
        historyChangeTriggers.includes(triggerId)
      );
      
      if (hasHistoryChangeTrigger) {
        hasHistoryChange = true;
        hasOverlap = true;
      }
    }
  }

  // 4. Determina se c'è un doppio page_view
  const isDoublePageView = hasOverlap && ga4ConfigTags.length > 0 && manualPageViewTags.length > 0;

  return {
    status: isDoublePageView ? 'critical' : 'ok',
    isDoublePageView,
    configTags: ga4ConfigTags,
    manualPageViewTags,
    overlap: {
      sharedTriggers: [...new Set(sharedTriggers)], // rimuovi duplicati
      hasHistoryChange
    },
    action: isDoublePageView 
      ? "Imposta send_page_view:false sul GA4 Config e gestisci i page_view tramite History Change (SPA) o un solo punto di firing."
      : "Nessun doppio page_view rilevato."
  };
}

// ============================================================================
// 3. BOX CONTEGGI "TAG / TRIGGER / VARIABILI"
// ============================================================================

function calculateCounts(cv: GTMContainerVersion) {
  return {
    tags: (cv.tag || []).length,
    triggers: (cv.trigger || []).length,
    variables: (cv.variable || []).length
  };
}

// ============================================================================
// 4. DISTRIBUZIONE TIPI DI TAG + "TAG PIÙ UTILIZZATI"
// ============================================================================

function calculateDistribution(cv: GTMContainerVersion) {
  const tags = cv.tag || [];
  const byFamily = { ua: 0, gaawe: 0, googtag: 0, html: 0, other: 0 };
  
  tags.forEach(t => {
    byFamily[familyOf(t.type)] = (byFamily[familyOf(t.type)] || 0) + 1;
  });

  // "Tag più utilizzati" = ordinamento desc di byFamily
  const sortedFamilies = Object.entries(byFamily)
    .sort(([, a], [, b]) => b - a)
    .filter(([, count]) => count > 0);

  return {
    byFamily,
    sortedFamilies,
    total: tags.length,
    // Dati formattati per i grafici
    chartData: sortedFamilies.map(([family, count]) => ({ family, count }))
  };
}

// ============================================================================
// 5. ANALISI DETTAGLIATA – QUALITÀ
// ============================================================================

// 5.1 Qualità Tag (0–100)
function calculateTagQuality(cv: GTMContainerVersion) {
  const tags = cv.tag || [];
  const active = tags.filter(t => t.paused !== true);
  const valid = active.filter(t => {
    if (Array.isArray(t.firingTriggerId)) {
      return t.firingTriggerId.length > 0;
    }
    return !!t.firingTriggerId;
  });
  const score = active.length ? Math.round(100 * valid.length / active.length) : 100;
  
  return {
    score,
    active: active.length,
    valid: valid.length,
    total: tags.length
  };
}

// 5.2 Qualità Trigger (0–100)
function calculateTriggerQuality(cv: GTMContainerVersion) {
  const triggers = cv.trigger || [];
  const tags = cv.tag || [];
  
  // Trigger usati
  const usedTrigIds = new Set<string>();
  tags.forEach(t => {
    if (Array.isArray(t.firingTriggerId)) {
      t.firingTriggerId.forEach((id: string) => usedTrigIds.add(id));
    } else if (t.firingTriggerId) {
      usedTrigIds.add(t.firingTriggerId);
    }
  });
  
  const usedTr = triggers.filter(tr => usedTrigIds.has(tr.triggerId || '')).length;
  const score = triggers.length ? Math.round(100 * usedTr / triggers.length) : 100;
  
  return {
    score,
    used: usedTr,
    total: triggers.length
  };
}

// 5.3 Qualità Variabili (0–100)
function calculateVariableQuality(cv: GTMContainerVersion) {
  const variables = cv.variable || [];
  const tags = cv.tag || [];
  const triggers = cv.trigger || [];
  
  // Variabili usate
  const varRefs = new Set<string>();
  tags.forEach(t => extractVarRefsFromAny(t).forEach(n => varRefs.add(n)));
  triggers.forEach(tr => extractVarRefsFromAny(tr).forEach(n => varRefs.add(n)));
  variables.forEach(v => extractVarRefsFromAny(v).forEach(n => varRefs.add(n)));
  
  const usedV = variables.filter(v => varRefs.has(String(v.name))).length;
  const score = variables.length ? Math.round(100 * usedV / variables.length) : 100;
  
  return {
    score,
    used: usedV,
    total: variables.length
  };
}

// ============================================================================
// 6. PIANO D'AZIONE PRIORITARIO (ORDINAMENTO)
// ============================================================================

function generateActionPlan(kpi: any) {
  const actions: Array<{
    type: 'uaObsolete' | 'paused' | 'unused' | 'namingIssues' | 'doublePageView' | 'consentMode' | 'triggerQuality' | 'variableQuality' | 'htmlSecurity';
    priority: number;
    count: number;
    action: string;
    description: string;
    impact: number;
  }> = [];
  
  if (kpi.doublePageView) {
    actions.push({
      type: 'doublePageView',
      priority: 0, // Priorità massima
      count: 1,
      action: 'Risolvi doppio page_view',
      description: 'Doppio page_view rilevato - duplicazione dati GA4',
      impact: 10 // +10% per risoluzione critica
    });
  }
  
  if (kpi.consentMode > 0) {
    actions.push({
      type: 'consentMode',
      priority: 1, // Priorità alta per compliance
      count: kpi.consentMode,
      action: 'Configura Consent Mode',
      description: 'Tag marketing senza consensi configurati - rischio compliance',
      impact: 8 // +8% per risoluzione compliance
    });
  }
  
  if (kpi.triggerQuality > 0) {
    actions.push({
      type: 'triggerQuality',
      priority: 2, // Priorità alta per performance
      count: kpi.triggerQuality,
      action: 'Ottimizza Trigger',
      description: 'Trigger con problemi di configurazione - impatto performance',
      impact: 6 // +6% per ottimizzazione trigger
    });
  }
  
  if (kpi.variableQuality > 0) {
    actions.push({
      type: 'variableQuality',
      priority: 2.5, // Priorità alta per affidabilità
      count: kpi.variableQuality,
      action: 'Ottimizza Variabili',
      description: 'Variabili con problemi di configurazione - impatto affidabilità',
      impact: 5 // +5% per ottimizzazione variabili
    });
  }
  
  if (kpi.htmlSecurity > 0) {
    actions.push({
      type: 'htmlSecurity',
      priority: 1.5, // Priorità alta per sicurezza
      count: kpi.htmlSecurity,
      action: 'Rivedi Sicurezza HTML',
      description: 'Tag HTML con problemi di sicurezza - rischio critico',
      impact: 8 // +8% per risoluzione sicurezza
    });
  }
  
  if (kpi.uaObsolete > 0) {
    actions.push({
      type: 'uaObsolete',
      priority: 3,
      count: kpi.uaObsolete,
      action: 'Migra a GA4',
      description: 'UA è obsoleto, serve migrare a GA4',
      impact: 5 // +5% per migrazione UA
    });
  }
  
  if (kpi.paused > 0) {
    actions.push({
      type: 'paused',
      priority: 4,
      count: kpi.paused,
      action: 'Valuta rimozione',
      description: 'Tag in pausa appesantiscono il container',
      impact: 2 // +2% per rimozione paused
    });
  }
  
  if (kpi.unused.total > 0) {
    actions.push({
      type: 'unused',
      priority: 5,
      count: kpi.unused.total,
      action: 'Elimina elementi',
      description: 'Elementi non utilizzati creano rumore',
      impact: 3 // +3% per rimozione unused
    });
  }
  
  if (kpi.namingIssues.total > 0) {
    actions.push({
      type: 'namingIssues',
      priority: 6,
      count: kpi.namingIssues.total,
      action: 'Standardizza nomi',
      description: 'Nomi incoerenti complicano la manutenzione',
      impact: 1 // +1% per standardizzazione naming
    });
  }
  
  return actions.sort((a, b) => a.priority - b.priority);
}

// ============================================================================
// 7. SUGGERIMENTI AUTOMATICI PER NAMING
// ============================================================================

function suggestTagName(t: any): string {
  const fam = familyOf(t.type);
  const base = String(t.name || '').replace(/\W+/g, '_').toUpperCase();
  const prefix = fam === 'ua' ? 'UA' : fam === 'gaawe' ? 'GA4_EVENT' : fam === 'googtag' ? 'GTAG' : fam === 'html' ? 'HTML' : 'TAG';
  return `${prefix}_${base}`.replace(/_+/g, '_');
}

// ============================================================================
// 8. CONSISTENCY CHECKS (BLOCHIAMO FALSI NUMERI)
// ============================================================================

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`GTM Metrics: ${msg}`);
}

function runConsistencyChecks(metrics: any, distribution: any, counts: any) {
  // Somma delle famiglie deve essere uguale al totale tag
  const familySum = Object.values(distribution.byFamily).reduce((a: number, b: number) => a + b, 0);
  assert(familySum === counts.tags, `Tag distribution mismatch: ${familySum} vs ${counts.tags}`);
  
  // Paused non può essere maggiore del totale tag
  assert(metrics.kpi.paused <= counts.tags, `Paused > total tags: ${metrics.kpi.paused} > ${counts.tags}`);
  
  // UA non può essere maggiore del totale tag
  assert(metrics.kpi.uaObsolete <= counts.tags, `UA > total tags: ${metrics.kpi.uaObsolete} > ${counts.tags}`);
  
  // Naming issues non può essere maggiore della somma di tutti gli elementi
  const totalElements = counts.tags + counts.triggers + counts.variables;
  assert(metrics.kpi.namingIssues.total <= totalElements, `Naming issues > total elements: ${metrics.kpi.namingIssues.total} > ${totalElements}`);
  
  console.log('✅ GTM Metrics consistency checks passed');
}

// ============================================================================
// 9. OUTPUT TIPIZZATO
// ============================================================================

export type GtmMetrics = {
  kpi: {
    paused: number;
    unused: { total: number; triggers: number; variables: number; tagsNoTrigger: number };
    uaObsolete: number;
    namingIssues: { total: number; tags: number; triggers: number; variables: number };
    doublePageView: { 
      status: 'critical' | 'ok';
      isDoublePageView: boolean;
      configTags: Array<{ id: any; name: string; type: string; send_page_view: boolean; firingTriggers: string[] }>;
      manualPageViewTags: Array<{ id: any; name: string; type: string; firingTriggers: string[] }>;
      overlap: { sharedTriggers: string[]; hasHistoryChange: boolean };
      action: string;
    };
    consentMode: ConsentModeResult;
    triggerQuality: TriggerQualityResult;
    variableQuality: VariableQualityResult;
    htmlSecurity: HtmlSecurityResult;
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
  quality: { tags: number; triggers: number; variables: number; consent: number; triggerQuality: number; variableQuality: number; htmlSecurity: number }; // 0–100
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
    type: 'uaObsolete' | 'paused' | 'unused' | 'namingIssues' | 'doublePageView' | 'consentMode' | 'triggerQuality' | 'variableQuality' | 'htmlSecurity';
    priority: number;
    count: number;
    action: string;
    description: string;
    impact: number; // Stima incremento score
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
};

// ============================================================================
// 10. FUNZIONE PRINCIPALE
// ============================================================================

export function calculateGtmMetrics(cv: GTMContainerVersion): GtmMetrics {
  try {
    // Calcola tutti i KPI
    const paused = calculatePausedTags(cv);
    const unused = calculateUnusedItems(cv);
    const uaObsolete = calculateUAObsolete(cv);
    const namingIssues = calculateNamingIssues(cv);
    const doublePageView = calculateDoublePageView(cv);
    const consentMode = analyzeConsentMode(cv);
    const triggerQualityAnalysis = analyzeTriggerQuality(cv);
    const variableQualityAnalysis = analyzeVariableQuality(cv);
    const htmlSecurityAnalysis = analyzeHtmlSecurity(cv);
    const counts = calculateCounts(cv);
    const distribution = calculateDistribution(cv);
    const tagQuality = calculateTagQuality(cv);
    const triggerQuality = calculateTriggerQuality(cv);
    const variableQuality = calculateVariableQuality(cv);
    const consentQuality = Math.round(consentMode.consent_coverage.score * 100);
    const triggerQualityScore = Math.round(triggerQualityAnalysis.trigger_quality.score * 100);
    const variableQualityScore = Math.round(variableQualityAnalysis.variable_quality.score * 100);
    const htmlSecurityScore = Math.round(htmlSecurityAnalysis.html_security.score * 100);
    
    // Genera piano d'azione
    const actionPlan = generateActionPlan({
      uaObsolete: uaObsolete.count,
      paused: paused.count,
      unused: unused,
      namingIssues: namingIssues,
      doublePageView: doublePageView.isDoublePageView,
      consentMode: consentMode.consent_coverage.missing + consentMode.consent_coverage.not_configured,
      triggerQuality: triggerQualityAnalysis.trigger_quality.issues.filter(issue => issue.severity === 'major' || issue.severity === 'critical').length,
      variableQuality: variableQualityAnalysis.variable_quality.issues.filter(issue => issue.severity === 'major' || issue.severity === 'critical').length,
      htmlSecurity: htmlSecurityAnalysis.html_security.critical + htmlSecurityAnalysis.html_security.major
    });
    
    // Calcola percentuali per UX
    const percentages = {
      paused: counts.tags > 0 ? Math.round((paused.count / counts.tags) * 100) : 0,
      unused: counts.tags > 0 ? Math.round((unused.total / counts.tags) * 100) : 0,
      uaObsolete: counts.tags > 0 ? Math.round((uaObsolete.count / counts.tags) * 100) : 0,
      namingIssues: counts.tags > 0 ? Math.round((namingIssues.total / counts.tags) * 100) : 0
    };
    
    // Calcola score trasparente
    const score = calculateTransparentScore({
      tags: tagQuality.score,
      triggers: triggerQuality.score,
      variables: variableQuality.score,
      consent: consentQuality,
      triggerQuality: triggerQualityScore,
      variableQuality: variableQualityScore,
      htmlSecurity: htmlSecurityScore
    });

    const metrics: GtmMetrics = {
      kpi: {
        paused: paused.count,
        unused: {
          total: unused.total,
          triggers: unused.triggers,
          variables: unused.variables,
          tagsNoTrigger: unused.tagsNoTrigger
        },
        uaObsolete: uaObsolete.count,
        namingIssues: {
          total: namingIssues.total,
          tags: namingIssues.tags,
          triggers: namingIssues.triggers,
          variables: namingIssues.variables
        },
        doublePageView,
        consentMode,
        triggerQuality: triggerQualityAnalysis,
        variableQuality: variableQualityAnalysis,
        htmlSecurity: htmlSecurityAnalysis
      },
      counts,
      distribution: {
        ...distribution.byFamily,
        chartData: distribution.chartData
      },
      quality: {
        tags: tagQuality.score,
        triggers: triggerQuality.score,
        variables: variableQuality.score,
        consent: consentQuality,
        triggerQuality: triggerQualityScore,
        variableQuality: variableQualityScore,
        htmlSecurity: htmlSecurityScore
      },
      score,
      actionPlan,
      lists: {
        pausedTags: paused.tags,
        uaTags: uaObsolete.tags,
        unusedTriggers: unused.unusedTriggers,
        unusedVariables: unused.unusedVariables,
        tagsNoTrigger: unused.tagsNoTriggerArray,
        badNames: {
          tags: namingIssues.badTagNames,
          triggers: namingIssues.badTrigNames,
          variables: namingIssues.badVarNames
        }
      },
      percentages
    };
    
    // Esegui consistency checks
    runConsistencyChecks(metrics, distribution, counts);
    
    return metrics;
    
  } catch (error) {
    console.error('❌ GTM Metrics calculation failed:', error);
    throw error;
  }
}

// ============================================================================
// 10. CALCOLO SCORE TRASPARENTE E STIMA IMPATTO
// ============================================================================

function calculateTransparentScore(quality: { tags: number; triggers: number; variables: number; consent: number; triggerQuality: number; variableQuality: number; htmlSecurity: number }) {
  const breakdown = [
    {
      label: 'Pulizia tag',
      value: quality.tags,
      weight: SCORE_WEIGHTS.tags,
      percentage: Math.round(quality.tags * SCORE_WEIGHTS.tags)
    },
    {
      label: 'Qualità trigger',
      value: quality.triggers,
      weight: SCORE_WEIGHTS.triggers,
      percentage: Math.round(quality.triggers * SCORE_WEIGHTS.triggers)
    },
    {
      label: 'Qualità variabili',
      value: quality.variables,
      weight: SCORE_WEIGHTS.variables,
      percentage: Math.round(quality.variables * SCORE_WEIGHTS.variables)
    },
    {
      label: 'Consent Mode',
      value: quality.consent,
      weight: SCORE_WEIGHTS.consent,
      percentage: Math.round(quality.consent * SCORE_WEIGHTS.consent)
    },
    {
      label: 'Configurazione Trigger',
      value: quality.triggerQuality,
      weight: SCORE_WEIGHTS.triggerQuality,
      percentage: Math.round(quality.triggerQuality * SCORE_WEIGHTS.triggerQuality)
    },
    {
      label: 'Qualità Variabili',
      value: quality.variableQuality,
      weight: SCORE_WEIGHTS.variableQuality,
      percentage: Math.round(quality.variableQuality * SCORE_WEIGHTS.variableQuality)
    },
    {
      label: 'Sicurezza HTML',
      value: quality.htmlSecurity,
      weight: SCORE_WEIGHTS.htmlSecurity,
      percentage: Math.round(quality.htmlSecurity * SCORE_WEIGHTS.htmlSecurity)
    }
  ];
  
  const total = Math.round(
    quality.tags * SCORE_WEIGHTS.tags +
    quality.triggers * SCORE_WEIGHTS.triggers +
    quality.variables * SCORE_WEIGHTS.variables +
    quality.consent * SCORE_WEIGHTS.consent +
    quality.triggerQuality * SCORE_WEIGHTS.triggerQuality +
    quality.variableQuality * SCORE_WEIGHTS.variableQuality +
    quality.htmlSecurity * SCORE_WEIGHTS.htmlSecurity
  );
  
  return { total, breakdown };
}

// Funzione per simulare la chiusura di un task e calcolare l'impatto
function simulateFix(current: GtmMetrics, taskType: string): { delta: number; newScore: number } {
  const next = structuredClone(current);
  
  switch (taskType) {
    case 'uaObsolete':
      // Migra UA → aumenta quality.tags
      next.quality.tags = Math.min(100, next.quality.tags + 5);
      break;
    case 'unused':
      // Rimuovi unused → aumenta quality.variables e quality.triggers
      if (next.kpi.unused.variables > 0) {
        next.quality.variables = Math.min(100, next.quality.variables + 3);
      }
      if (next.kpi.unused.triggers > 0) {
        next.quality.triggers = Math.min(100, next.quality.triggers + 3);
      }
      break;
    case 'paused':
      // Rimuovi paused → aumenta quality.tags
      next.quality.tags = Math.min(100, next.quality.tags + 2);
      break;
    case 'namingIssues':
      // Standardizza naming → aumenta tutte le qualità
      next.quality.tags = Math.min(100, next.quality.tags + 1);
      next.quality.triggers = Math.min(100, next.quality.triggers + 1);
      next.quality.variables = Math.min(100, next.quality.variables + 1);
      break;
  }
  
  const newScore = calculateTransparentScore(next.quality);
  const delta = newScore.total - current.score.total;
  
  return { delta: Math.max(0, delta), newScore: newScore.total };
}

// ============================================================================
// 11. FUNZIONI UTILITY PER LA DASHBOARD
// ============================================================================

export function getMetricInfo(type: string) {
  const metricInfo = {
    paused: {
      icon: "🛑",
      title: "In Pausa",
      subtitle: "Tag presenti ma disattivati",
      impact: "Mantenerli appesantisce il container, valuta se eliminarli.",
      risk: "Rischio: appesantiscono il container, valutare rimozione.",
      priority: "Alta",
      priorityColor: "bg-red-100 text-red-800",
      color: "bg-red-50 dark:bg-red-900/20",
      textColor: "text-red-600 dark:text-red-400"
    },
    unused: {
      icon: "🗑️",
      title: "Non Utilizzati",
      subtitle: "Trigger o variabili mai richiamati",
      impact: "Elementi inutili creano rumore e confusione.",
      risk: "Rischio: variabile mai richiamata, inutile.",
      priority: "Media",
      priorityColor: "bg-orange-100 text-orange-800",
      color: "bg-orange-50 dark:bg-orange-900/20",
      textColor: "text-orange-600 dark:text-orange-400"
    },
    uaObsolete: {
      icon: "⏳",
      title: "UA Obsoleti",
      subtitle: "Tag Universal Analytics",
      impact: "UA è dismesso, serve migrare a GA4.",
      risk: "Rischio: non raccoglie più dati.",
      priority: "Critica",
      priorityColor: "bg-red-100 text-red-800",
      color: "bg-yellow-50 dark:bg-yellow-900/20",
      textColor: "text-yellow-600 dark:text-yellow-400"
    },
    namingIssues: {
      icon: "📝",
      title: "Naming Issues",
      subtitle: "Nomi non standardizzati",
      impact: "Nomi incoerenti complicano la manutenzione in team.",
      risk: "Standardizzare i nomi riduce errori e accelera la collaborazione.",
      priority: "Bassa",
      priorityColor: "bg-blue-100 text-blue-800",
      color: "bg-blue-50 dark:bg-blue-900/20",
      textColor: "text-blue-600 dark:text-blue-400"
    },
    doublePageView: {
      icon: "🔄",
      title: "Doppio Page View",
      subtitle: "Duplicazione eventi page_view",
      impact: "GA4 riceve page_view duplicati, distorcendo le metriche.",
      risk: "Rischio: dati GA4 non affidabili, metriche gonfiate.",
      priority: "Critica",
      priorityColor: "bg-red-100 text-red-800",
      color: "bg-red-50 dark:bg-red-900/20",
      textColor: "text-red-600 dark:text-red-400"
    },
    consentMode: {
      icon: "🔒",
      title: "Consent Mode",
      subtitle: "Tag marketing senza consensi configurati",
      impact: "Tag marketing senza consensi configurati violano le normative privacy.",
      risk: "Rischio: violazione GDPR/CCPA, multe e problemi legali.",
      priority: "Critica",
      priorityColor: "bg-red-100 text-red-800",
      color: "bg-red-50 dark:bg-red-900/20",
      textColor: "text-red-600 dark:text-red-400"
    },
    triggerQuality: {
      icon: "⚡",
      title: "Qualità Trigger",
      subtitle: "Trigger con problemi di configurazione",
      impact: "Trigger mal configurati possono causare problemi di performance e tracking.",
      risk: "Rischio: tracking non affidabile, performance degradate.",
      priority: "Maggiore",
      priorityColor: "bg-orange-100 text-orange-800",
      color: "bg-orange-50 dark:bg-orange-900/20",
      textColor: "text-orange-600 dark:text-orange-400"
    },
    variableQuality: {
      icon: "🧩",
      title: "Qualità Variabili",
      subtitle: "Variabili con problemi di configurazione",
      impact: "Variabili mal configurate possono causare errori di tracking e performance.",
      risk: "Rischio: tracking non affidabile, errori JavaScript.",
      priority: "Maggiore",
      priorityColor: "bg-orange-100 text-orange-800",
      color: "bg-orange-50 dark:bg-orange-900/20",
      textColor: "text-orange-600 dark:text-orange-400"
    },
    htmlSecurity: {
      icon: "🔒",
      title: "Sicurezza Custom HTML",
      subtitle: "Tag HTML con problemi di sicurezza",
      impact: "Tag HTML con vulnerabilità che possono compromettere la sicurezza del sito.",
      risk: "Rischio: code injection, XSS, dati sensibili esposti.",
      priority: "Critica",
      priorityColor: "bg-red-100 text-red-800",
      color: "bg-red-50 dark:bg-red-900/20",
      textColor: "text-red-600 dark:text-red-400"
    }
  };
  
  const result = metricInfo[type as keyof typeof metricInfo];
  if (!result) {
    console.warn(`Unknown metric type: ${type}`);
    // Return a default fallback object
    return {
      icon: "❓",
      title: "Metrica Sconosciuta",
      subtitle: "Tipo di metrica non riconosciuto",
      impact: "Verificare la configurazione delle metriche.",
      risk: "Rischio: configurazione non valida.",
      priority: "Sconosciuta",
      priorityColor: "bg-gray-100 text-gray-800",
      color: "bg-gray-50 dark:bg-gray-900/20",
      textColor: "text-gray-600 dark:text-gray-400"
    };
  }
  
  return result;
}

export function getQualityInfo(type: string) {
  const qualityInfo = {
    tags: {
      description: "% di tag con trigger attivi e senza duplicati.",
      icon: "🏷️"
    },
    triggers: {
      description: "% di trigger effettivamente usati da almeno un tag.",
      icon: "⚡"
    },
    variables: {
      description: "% di variabili usate in almeno un tag o trigger.",
      icon: "🧩"
    },
    consent: {
      description: "% di tag marketing con consensi configurati correttamente.",
      icon: "🔒"
    },
    triggerQuality: {
      description: "% di trigger configurati in modo ottimale (specificità, timing, blocking).",
      icon: "⚡"
    },
    variableQuality: {
      description: "% di variabili configurate in modo ottimale (DLV, regex, selettori, JS, lookup).",
      icon: "🧩"
    },
    htmlSecurity: {
      description: "% di tag HTML custom configurati in modo sicuro (no eval, HTTPS, try/catch).",
      icon: "🔒"
    }
  };
  return qualityInfo[type as keyof typeof qualityInfo];
}

// ============================================================================
// 12. TEST RAPIDO (AUTO-VERIFICA)
// ============================================================================

export function runQuickTest() {
  console.log('🧪 Running GTM Metrics quick test...');
  
  // Test container di esempio
  const testContainer: GTMContainerVersion = {
    tag: [
      { tagId: 1, name: "UA_Test", type: "ua", paused: false, firingTriggerId: ["tr1"] },
      { tagId: 2, name: "GA4_Test", type: "gaawe", paused: false, firingTriggerId: ["tr2"] },
      { tagId: 3, name: "HTML_Test", type: "html", paused: true, firingTriggerId: [] }
    ],
    trigger: [
      { triggerId: "tr1", name: "TRG_Test1", type: "pageview" },
      { triggerId: "tr2", name: "TRG_Test2", type: "click" },
      { triggerId: "tr3", name: "TRG_Test3", type: "custom" }
    ],
    variable: [
      { variableId: 1, name: "DLV_Test", type: "constant" },
      { variableId: 2, name: "JS_Test", type: "javascript" }
    ]
  };
  
  try {
    const metrics = calculateGtmMetrics(testContainer);
    
    // Verifiche
    assert(metrics.counts.tags === 3, 'Tag count should be 3');
    assert(metrics.counts.triggers === 3, 'Trigger count should be 3');
    assert(metrics.counts.variables === 2, 'Variable count should be 2');
    assert(metrics.kpi.paused === 1, 'Paused count should be 1');
    assert(metrics.kpi.uaObsolete === 1, 'UA count should be 1');
    assert(metrics.distribution.ua === 1, 'UA distribution should be 1');
    assert(metrics.distribution.gaawe === 1, 'GA4 distribution should be 1');
    assert(metrics.distribution.html === 1, 'HTML distribution should be 1');
    
    console.log('✅ Quick test passed!');
    return true;
    
  } catch (error) {
    console.error('❌ Quick test failed:', error);
    return false;
  }
}

// ============================================================================
// 13. TEST CASI DI ACCETTAZIONE - DOPPIO PAGE VIEW
// ============================================================================

export function runDoublePageViewTests() {
  console.log('🧪 Running Double Page View Tests...');
  
  // TC1: Deve segnalare - GA4 Config + GA4 Event page_view con stesso trigger
  const tc1Container: GTMContainerVersion = {
    tag: [
      { 
        tagId: 1, 
        name: "GA4 Config", 
        type: "gaawc", 
        firingTriggerId: ["all_pages"],
        parameter: [
          { key: "measurement_id", value: "G-XXXXXXXXXX" }
          // send_page_view mancante = true (default)
        ]
      },
      { 
        tagId: 2, 
        name: "GA4 Event page_view", 
        type: "gaawe", 
        firingTriggerId: ["all_pages"],
        parameter: [
          { key: "eventName", value: "page_view" }
        ]
      }
    ],
    trigger: [
      { triggerId: "all_pages", name: "All Pages", type: "pageview" }
    ],
    variable: []
  };
  
  // TC2: Deve segnalare - SPA con HISTORY_CHANGE
  const tc2Container: GTMContainerVersion = {
    tag: [
      { 
        tagId: 1, 
        name: "GA4 Config", 
        type: "gaawc", 
        firingTriggerId: ["all_pages"],
        parameter: [
          { key: "measurement_id", value: "G-XXXXXXXXXX" },
          { key: "send_page_view", value: true }
        ]
      },
      { 
        tagId: 2, 
        name: "GA4 Event page_view SPA", 
        type: "gaawe", 
        firingTriggerId: ["history_change"],
        parameter: [
          { key: "eventName", value: "page_view" }
        ]
      }
    ],
    trigger: [
      { triggerId: "all_pages", name: "All Pages", type: "pageview" },
      { triggerId: "history_change", name: "History Change", type: "HISTORY_CHANGE" }
    ],
    variable: []
  };
  
  // TC3: Non deve segnalare - GA4 Config con send_page_view:false
  const tc3Container: GTMContainerVersion = {
    tag: [
      { 
        tagId: 1, 
        name: "GA4 Config", 
        type: "gaawc", 
        firingTriggerId: ["all_pages"],
        parameter: [
          { key: "measurement_id", value: "G-XXXXXXXXXX" },
          { key: "send_page_view", value: false }
        ]
      },
      { 
        tagId: 2, 
        name: "GA4 Event page_view", 
        type: "gaawe", 
        firingTriggerId: ["all_pages"],
        parameter: [
          { key: "eventName", value: "page_view" }
        ]
      }
    ],
    trigger: [
      { triggerId: "all_pages", name: "All Pages", type: "pageview" }
    ],
    variable: []
  };
  
  // TC4: Non deve segnalare - Trigger diversi senza overlap
  const tc4Container: GTMContainerVersion = {
    tag: [
      { 
        tagId: 1, 
        name: "GA4 Config", 
        type: "gaawc", 
        firingTriggerId: ["all_pages"],
        parameter: [
          { key: "measurement_id", value: "G-XXXXXXXXXX" }
        ]
      },
      { 
        tagId: 2, 
        name: "GA4 Event page_view thank you", 
        type: "gaawe", 
        firingTriggerId: ["thank_you_page"],
        parameter: [
          { key: "eventName", value: "page_view" }
        ]
      }
    ],
    trigger: [
      { triggerId: "all_pages", name: "All Pages", type: "pageview" },
      { triggerId: "thank_you_page", name: "Thank You Page", type: "pageview" }
    ],
    variable: []
  };
  
  try {
    // Test TC1
    const tc1Result = calculateDoublePageView(tc1Container);
    assert(tc1Result.isDoublePageView === true, 'TC1: Should detect double page view');
    assert(tc1Result.configTags.length === 1, 'TC1: Should find 1 config tag');
    assert(tc1Result.manualPageViewTags.length === 1, 'TC1: Should find 1 manual page view tag');
    assert(tc1Result.overlap.sharedTriggers.includes('all_pages'), 'TC1: Should find shared trigger');
    console.log('✅ TC1 passed: Double page view detected correctly');
    
    // Test TC2
    const tc2Result = calculateDoublePageView(tc2Container);
    assert(tc2Result.isDoublePageView === true, 'TC2: Should detect SPA double page view');
    assert(tc2Result.overlap.hasHistoryChange === true, 'TC2: Should detect HISTORY_CHANGE');
    console.log('✅ TC2 passed: SPA double page view detected correctly');
    
    // Test TC3
    const tc3Result = calculateDoublePageView(tc3Container);
    assert(tc3Result.isDoublePageView === false, 'TC3: Should NOT detect double page view (send_page_view:false)');
    console.log('✅ TC3 passed: No double page view when send_page_view is false');
    
    // Test TC4
    const tc4Result = calculateDoublePageView(tc4Container);
    assert(tc4Result.isDoublePageView === false, 'TC4: Should NOT detect double page view (no overlap)');
    console.log('✅ TC4 passed: No double page view when triggers don\'t overlap');
    
    console.log('🎉 All Double Page View tests passed!');
    return true;
    
  } catch (error) {
    console.error('❌ Double Page View tests failed:', error);
    return false;
  }
}
