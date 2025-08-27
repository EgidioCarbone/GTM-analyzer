import { GenerateDocInput, GTMTag, GTMTrigger, GTMVariable } from "../types/gtm";

export interface QualityMetrics {
  overallScore: number;
  pausedItems: number;
  unusedItems: number;
  uaItems: number;
  namingIssues: number;
  totalItems: number;
  qualityBreakdown: {
    tags: ItemQuality;
    triggers: ItemQuality;
    variables: ItemQuality;
  };
}

export interface ItemQuality {
  score: number;
  total: number;
  paused: number;
  unused: number;
  ua: number;
  namingIssues: number;
}

/**
 * Calcola la qualità complessiva del container GTM
 */
export function calculateContainerQuality(container: GenerateDocInput): QualityMetrics {
  const tags = container.tag || [];
  const triggers = container.trigger || [];
  const variables = container.variable || [];

  // Analizza qualità per ogni tipo
  const tagsQuality = analyzeItemsQuality(tags, 'tag');
  const triggersQuality = analyzeItemsQuality(triggers, 'trigger');
  const variablesQuality = analyzeItemsQuality(variables, 'variable');

  // Calcola metriche totali
  const totalPaused = tagsQuality.paused + triggersQuality.paused + variablesQuality.paused;
  const totalUnused = tagsQuality.unused + triggersQuality.unused + variablesQuality.unused;
  const totalUa = tagsQuality.ua + triggersQuality.ua + variablesQuality.ua;
  const totalNamingIssues = tagsQuality.namingIssues + triggersQuality.namingIssues + variablesQuality.namingIssues;
  const totalItems = tagsQuality.total + triggersQuality.total + variablesQuality.total;

  // Calcola score complessivo (0-100)
  let overallScore = 100;

  // Penalità per elementi problematici
  if (totalPaused > 0) {
    overallScore -= Math.min(20, totalPaused * 2); // Max -20 punti per elementi in pausa
  }

  if (totalUnused > 0) {
    overallScore -= Math.min(25, totalUnused * 3); // Max -25 punti per elementi non utilizzati
  }

  if (totalUa > 0) {
    overallScore -= Math.min(30, totalUa * 5); // Max -30 punti per elementi UA obsoleti
  }

  if (totalNamingIssues > 0) {
    overallScore -= Math.min(15, totalNamingIssues * 2); // Max -15 punti per naming issues
  }

  // Assicurati che lo score sia tra 0 e 100
  overallScore = Math.max(0, Math.min(100, overallScore));

  return {
    overallScore: Math.round(overallScore),
    pausedItems: totalPaused,
    unusedItems: totalUnused,
    uaItems: totalUa,
    namingIssues: totalNamingIssues,
    totalItems,
    qualityBreakdown: {
      tags: tagsQuality,
      triggers: triggersQuality,
      variables: variablesQuality
    }
  };
}

/**
 * Analizza la qualità di una lista di elementi (tag, trigger o variabili)
 */
function analyzeItemsQuality(items: (GTMTag | GTMTrigger | GTMVariable)[], type: string): ItemQuality {
  const total = items.length;
  
  if (total === 0) {
    return {
      score: 100,
      total: 0,
      paused: 0,
      unused: 0,
      ua: 0,
      namingIssues: 0
    };
  }

  let paused = 0;
  let unused = 0;
  let ua = 0;
  let namingIssues = 0;

  items.forEach(item => {
    // Controlla se è in pausa
    if (isItemPaused(item)) {
      paused++;
    }

    // Controlla se è non utilizzato
    if (isItemUnused(item, type)) {
      unused++;
    }

    // Controlla se è UA obsoleto
    if (isItemUA(item)) {
      ua++;
    }

    // Controlla naming convention
    if (!hasGoodNamingConvention(item)) {
      namingIssues++;
    }
  });

  // Calcola score per questo tipo (0-100)
  let score = 100;
  if (paused > 0) score -= Math.min(20, paused * 2);
  if (unused > 0) score -= Math.min(25, unused * 3);
  if (ua > 0) score -= Math.min(30, ua * 5);
  if (namingIssues > 0) score -= Math.min(15, namingIssues * 2);
  
  score = Math.max(0, Math.min(100, score));

  return {
    score: Math.round(score),
    total,
    paused,
    unused,
    ua,
    namingIssues
  };
}

/**
 * Controlla se un elemento è in pausa
 */
function isItemPaused(item: GTMTag | GTMTrigger | GTMVariable): boolean {
  // Per ora assumiamo che se non ha la proprietà 'paused', non è in pausa
  // In futuro potremmo estendere i tipi per includere questa proprietà
  return (item as any).paused === true;
}

/**
 * Controlla se un elemento è non utilizzato
 */
function isItemUnused(item: GTMTag | GTMTrigger | GTMVariable, type: string): boolean {
  // Logica per determinare se un elemento è non utilizzato
  // Per ora implementiamo una logica base che può essere estesa
  
  if (type === 'tag') {
    const tag = item as GTMTag;
    // Tag di test o debug sono considerati non utilizzati in produzione
    if (tag.name.toLowerCase().includes('test') || 
        tag.name.toLowerCase().includes('debug') ||
        tag.name.toLowerCase().includes('temp')) {
      return true;
    }
  }

  if (type === 'trigger') {
    const trigger = item as GTMTrigger;
    // Trigger di test sono considerati non utilizzati
    if (trigger.name.toLowerCase().includes('test') ||
        trigger.name.toLowerCase().includes('debug')) {
      return true;
    }
  }

  if (type === 'variable') {
    const variable = item as GTMVariable;
    // Variabili di test sono considerate non utilizzate
    if (variable.name.toLowerCase().includes('test') ||
        variable.name.toLowerCase().includes('debug') ||
        variable.name.toLowerCase().includes('temp')) {
      return true;
    }
  }

  return false;
}

/**
 * Controlla se un elemento è UA obsoleto
 */
function isItemUA(item: GTMTag | GTMTrigger | GTMVariable): boolean {
  const name = item.name.toLowerCase();
  const type = item.type.toLowerCase();

  // Controlla per riferimenti UA obsoleti
  const uaPatterns = [
    'ua-',
    'universal analytics',
    'ga.js',
    'analytics.js',
    'gtag',
    'google analytics'
  ];

  return uaPatterns.some(pattern => 
    name.includes(pattern) || type.includes(pattern)
  );
}

/**
 * Controlla se un elemento ha una buona naming convention
 */
function hasGoodNamingConvention(item: GTMTag | GTMTrigger | GTMVariable): boolean {
  const name = item.name;
  
  // Regole di naming convention
  const rules = [
    // Non deve iniziare con numeri
    () => /^[a-zA-Z_]/i.test(name),
    
    // Non deve contenere spazi
    () => !/\s/.test(name),
    
    // Deve essere in snake_case o camelCase
    () => /^[a-z][a-z0-9_]*$|^[a-z][a-zA-Z0-9]*$/.test(name),
    
    // Non deve essere troppo corto
    () => name.length >= 3,
    
    // Non deve essere troppo lungo
    () => name.length <= 50,
    
    // Non deve contenere caratteri speciali problematici
    () => !/[^a-zA-Z0-9_-]/.test(name)
  ];

  return rules.every(rule => rule());
}

/**
 * Ottiene raccomandazioni per migliorare la qualità del container
 */
export function getQualityRecommendations(metrics: QualityMetrics): string[] {
  const recommendations: string[] = [];

  if (metrics.pausedItems > 0) {
    recommendations.push(
      `Rimuovi ${metrics.pausedItems} elementi in pausa per migliorare le performance`
    );
  }

  if (metrics.unusedItems > 0) {
    recommendations.push(
      `Elimina ${metrics.unusedItems} elementi non utilizzati per ridurre la complessità`
    );
  }

  if (metrics.uaItems > 0) {
    recommendations.push(
      `Aggiorna ${metrics.uaItems} elementi UA obsoleti a GA4 per mantenere la compatibilità`
    );
  }

  if (metrics.namingIssues > 0) {
    recommendations.push(
      `Correggi ${metrics.namingIssues} elementi con naming convention non conformi`
    );
  }

  if (recommendations.length === 0) {
    recommendations.push("Il tuo container è già ottimizzato! 🎉");
  }

  return recommendations;
}

/**
 * Calcola il potenziale miglioramento della qualità
 */
export function calculatePotentialImprovement(metrics: QualityMetrics): number {
  let potential = 0;

  if (metrics.pausedItems > 0) {
    potential += Math.min(20, metrics.pausedItems * 2);
  }

  if (metrics.unusedItems > 0) {
    potential += Math.min(25, metrics.unusedItems * 3);
  }

  if (metrics.uaItems > 0) {
    potential += Math.min(30, metrics.uaItems * 5);
  }

  if (metrics.namingIssues > 0) {
    potential += Math.min(15, metrics.namingIssues * 2);
  }

  return Math.min(100 - metrics.overallScore, potential);
}
