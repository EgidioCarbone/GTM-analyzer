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
  tags: 0.35,
  triggers: 0.35, 
  variables: 0.30,
};

// ============================================================================
// 1. ASSUNZIONI DI INPUT
// ============================================================================

import { GenerateDocInput, GTMTag, GTMTrigger, GTMVariable } from "../types/gtm";

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
    type: 'uaObsolete' | 'paused' | 'unused' | 'namingIssues';
    priority: number;
    count: number;
    action: string;
    description: string;
    impact: number;
  }> = [];
  
  if (kpi.uaObsolete > 0) {
    actions.push({
      type: 'uaObsolete',
      priority: 1,
      count: kpi.uaObsolete,
      action: 'Migra a GA4',
      description: 'UA è obsoleto, serve migrare a GA4',
      impact: 5 // +5% per migrazione UA
    });
  }
  
  if (kpi.paused > 0) {
    actions.push({
      type: 'paused',
      priority: 2,
      count: kpi.paused,
      action: 'Valuta rimozione',
      description: 'Tag in pausa appesantiscono il container',
      impact: 2 // +2% per rimozione paused
    });
  }
  
  if (kpi.unused.total > 0) {
    actions.push({
      type: 'unused',
      priority: 3,
      count: kpi.unused.total,
      action: 'Elimina elementi',
      description: 'Elementi non utilizzati creano rumore',
      impact: 3 // +3% per rimozione unused
    });
  }
  
  if (kpi.namingIssues.total > 0) {
    actions.push({
      type: 'namingIssues',
      priority: 4,
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
  quality: { tags: number; triggers: number; variables: number }; // 0–100
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
    type: 'uaObsolete' | 'paused' | 'unused' | 'namingIssues';
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
    const counts = calculateCounts(cv);
    const distribution = calculateDistribution(cv);
    const tagQuality = calculateTagQuality(cv);
    const triggerQuality = calculateTriggerQuality(cv);
    const variableQuality = calculateVariableQuality(cv);
    
    // Genera piano d'azione
    const actionPlan = generateActionPlan({
      uaObsolete: uaObsolete.count,
      paused: paused.count,
      unused: unused,
      namingIssues: namingIssues
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
      variables: variableQuality.score
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
        }
      },
      counts,
      distribution: {
        ...distribution.byFamily,
        chartData: distribution.chartData
      },
      quality: {
        tags: tagQuality.score,
        triggers: triggerQuality.score,
        variables: variableQuality.score
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

function calculateTransparentScore(quality: { tags: number; triggers: number; variables: number }) {
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
    }
  ];
  
  const total = Math.round(
    quality.tags * SCORE_WEIGHTS.tags +
    quality.triggers * SCORE_WEIGHTS.triggers +
    quality.variables * SCORE_WEIGHTS.variables
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
