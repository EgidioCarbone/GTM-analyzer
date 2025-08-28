/**
 * Trigger Quality Analysis Service
 * 
 * Analizza i trigger nel JSON di GTM e assegna un giudizio di qualità,
 * evidenziando overuse di All Pages, mancanza di eccezioni, timing non ottimale,
 * supporto SPA, duplicati e trigger orfani.
 */

import { GTMTag, GTMTrigger, GTMVariable } from "../types/gtm";

// ============================================================================
// 1. TIPI E INTERFACCE
// ============================================================================

export interface TriggerQualityBreakdown {
  specificity: number;    // 0-1: penalizza All Pages senza filtri
  blocking: number;       // 0-1: bonus per blocking triggers su marketing
  timing: number;         // 0-1: penalizza timing non ottimale
  spa: number;           // 0-1: bonus per supporto SPA (HISTORY_CHANGE)
  hygiene: number;       // 0-1: penalizza duplicati, orfani, condizioni fragili
}

export interface TriggerQualityStats {
  total_triggers: number;
  unused_triggers: number;
  all_pages_unfiltered: number;
  with_blocking_on_marketing: number;
  history_change_present: boolean;
  duplicates: Array<{
    ids: string[];
    reason: string;
  }>;
}

export interface TriggerQualityIssue {
  severity: 'critical' | 'major' | 'minor';
  trigger_id: string;
  name: string;
  reason: string;
  used_by_tag_ids?: string[];
  suggestion: string;
}

export interface TriggerQualityResult {
  trigger_quality: {
    score: number;                    // 0-1
    breakdown: TriggerQualityBreakdown;
    stats: TriggerQualityStats;
    issues: TriggerQualityIssue[];
  };
  message: {
    title: string;
    status: 'critical' | 'major' | 'minor' | 'ok';
    summary: string;
    cta: string;
  };
  impact: {
    weight: number;
    contribution: number;
  };
}

// ============================================================================
// 2. CONFIGURAZIONE E PESI
// ============================================================================

const TRIGGER_QUALITY_WEIGHTS = {
  specificity: 0.40,    // 40% - penalizza All Pages senza filtri
  blocking: 0.20,       // 20% - bonus per blocking triggers
  timing: 0.20,         // 20% - penalizza timing non ottimale
  spa: 0.10,           // 10% - bonus per supporto SPA
  hygiene: 0.10        // 10% - penalizza duplicati/orfani
};

// ============================================================================
// 3. FUNZIONI DI IDENTIFICAZIONE
// ============================================================================

/**
 * Determina se un tag è "core" (meno penalizzato su All Pages)
 */
function isCoreTag(tag: GTMTag): boolean {
  const tagType = tag.type?.toLowerCase() || '';
  const tagName = tag.name?.toLowerCase() || '';
  
  // GA4 Config/Event page_view
  if (['gaawc', 'ga4_config', 'gtag'].includes(tagType)) {
    return true;
  }
  
  // GA4 Event page_view
  if (tagType === 'gaawe' || tagType === 'ga4_event') {
    const eventName = getTagParameter(tag, 'eventName');
    if (eventName === 'page_view') {
      return true;
    }
  }
  
  // Consent, sGTM client, server container, init
  const coreKeywords = ['consent', 'sgtm', 'server', 'init', 'client'];
  return coreKeywords.some(keyword => 
    tagType.includes(keyword) || tagName.includes(keyword)
  );
}

/**
 * Determina se un tag è marketing (richiede blocking triggers)
 */
function isMarketingTag(tag: GTMTag): boolean {
  const tagType = tag.type?.toLowerCase() || '';
  const tagName = tag.name?.toLowerCase() || '';
  
  // Marketing tag types
  const marketingTypes = [
    'awct', 'awctc', 'aw_remarketing', 'aw_conversion',
    'facebook_', 'meta_', 'linkedin_', 'bing_', 'tiktok_', 'ttq_',
    'hotjar_', 'optimize_', 'vwo_'
  ];
  
  // Check exact types
  if (marketingTypes.some(type => tagType === type)) {
    return true;
  }
  
  // Check prefixes
  if (marketingTypes.some(prefix => 
    prefix.endsWith('_') && tagType.startsWith(prefix)
  )) {
    return true;
  }
  
  // Check custom HTML for marketing patterns
  if (tagType === 'html' && tag.html) {
    const marketingPatterns = [
      /connect\.facebook\.net/i,
      /googleads\.g\.doubleclick\.net/i,
      /fls\.doubleclick\.net/i,
      /bat\.bing\.com/i,
      /analytics\.tiktok\.com/i,
      /px\.ads\.linkedin\.com/i
    ];
    return marketingPatterns.some(pattern => pattern.test(tag.html));
  }
  
  // Check name keywords
  const marketingKeywords = [
    'facebook', 'meta', 'pixel', 'google ads', 'ads', 'remarketing',
    'conversion', 'floodlight', 'linkedin', 'bing', 'tiktok', 'hotjar',
    'optimize', 'vwo'
  ];
  
  return marketingKeywords.some(keyword => 
    tagName.includes(keyword) || tagType.includes(keyword)
  );
}

/**
 * Determina se un tag ha blocking triggers
 */
function hasBlockingTriggers(tag: GTMTag): boolean {
  return Array.isArray(tag.blockingTriggerId) && tag.blockingTriggerId.length > 0;
}

/**
 * Determina se un tag è UX/heatmap/video (ok con WINDOW_LOADED)
 */
function isUXTag(tag: GTMTag): boolean {
  const tagName = tag.name?.toLowerCase() || '';
  const tagType = tag.type?.toLowerCase() || '';
  
  const uxKeywords = ['video', 'heatmap', 'ux', 'hotjar', 'fullstory', 'logrocket'];
  return uxKeywords.some(keyword => 
    tagName.includes(keyword) || tagType.includes(keyword)
  );
}

// ============================================================================
// 4. UTILITY FUNZIONI
// ============================================================================

/**
 * Estrae un parametro da un tag
 */
function getTagParameter(tag: GTMTag, key: string): any {
  return (tag.parameter || []).find(p => p.key === key)?.value;
}

/**
 * Normalizza i filtri di un trigger per il confronto
 */
function normalizeFilters(filters: any[]): any[] {
  if (!Array.isArray(filters)) return [];
  
  return filters.map(filter => {
    if (typeof filter === 'object' && filter !== null) {
      // Rimuovi proprietà che non influenzano la logica
      const { key, value, operator } = filter;
      return { key, value, operator };
    }
    return filter;
  }).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

/**
 * Determina se un filtro è "vuoto" (match all)
 */
function isEmptyFilter(filters: any[]): boolean {
  if (!Array.isArray(filters) || filters.length === 0) {
    return true;
  }
  
  // Se c'è solo una condizione che matcha tutto
  if (filters.length === 1) {
    const filter = filters[0];
    if (typeof filter === 'object' && filter !== null) {
      const value = filter.value;
      if (value === true || value === 'true' || value === '.*' || value === '*') {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Crea una signature unica per un trigger (per rilevare duplicati)
 */
function createTriggerSignature(trigger: GTMTrigger): string {
  const type = trigger.type || 'unknown';
  const filters = normalizeFilters(trigger.filter || []);
  return `${type}|${JSON.stringify(filters)}`;
}

/**
 * Valuta il timing di un trigger
 */
function evaluateTiming(trigger: GTMTrigger, usedByTags: GTMTag[]): 'good' | 'ok' | 'bad' {
  const type = trigger.type?.toUpperCase() || '';
  
  // PAGEVIEW per tag non-core è problematico
  if (type === 'PAGEVIEW') {
    const hasNonCoreTags = usedByTags.some(tag => !isCoreTag(tag));
    if (hasNonCoreTags) {
      return 'bad';
    }
    return 'ok';
  }
  
  // WINDOW_LOADED per tag non-UX è problematico
  if (type === 'WINDOW_LOADED') {
    const hasNonUXTags = usedByTags.some(tag => !isUXTag(tag));
    if (hasNonUXTags) {
      return 'bad';
    }
    return 'ok';
  }
  
  // DOM_READY è generalmente ok
  if (type === 'DOM_READY') {
    return 'good';
  }
  
  // Altri tipi sono neutri
  return 'ok';
}

// ============================================================================
// 5. FUNZIONE PRINCIPALE DI ANALISI
// ============================================================================

/**
 * Analizza la qualità dei trigger in un container GTM
 */
export function analyzeTriggerQuality(containerVersion: {
  trigger?: GTMTrigger[];
  tag?: GTMTag[];
  variable?: GTMVariable[];
}): TriggerQualityResult {
  const triggers = containerVersion.trigger || [];
  const tags = containerVersion.tag || [];
  
  // Crea mappa di utilizzo: triggerId -> [tagIds che lo usano]
  const triggerUsage = new Map<string, GTMTag[]>();
  const triggerById = new Map<string, GTMTrigger>();
  
  // Inizializza mappe
  triggers.forEach(trigger => {
    if (trigger.triggerId) {
      triggerById.set(trigger.triggerId, trigger);
      triggerUsage.set(trigger.triggerId, []);
    }
  });
  
  // Popola utilizzo
  tags.forEach(tag => {
    const firingTriggers = Array.isArray(tag.firingTriggerId) 
      ? tag.firingTriggerId 
      : tag.firingTriggerId ? [tag.firingTriggerId] : [];
    
    firingTriggers.forEach(triggerId => {
      if (triggerUsage.has(triggerId)) {
        triggerUsage.get(triggerId)!.push(tag);
      }
    });
  });
  
  // Contatori e analisi
  let allPagesUnfiltered = 0;
  let unused = 0;
  let withBlockingOnMarketing = 0;
  let hasHistoryChange = false;
  let badTimingCount = 0;
  let totalTimingChecks = 0;
  
  const issues: TriggerQualityIssue[] = [];
  const duplicates: Array<{ ids: string[]; reason: string }> = [];
  const signatures = new Map<string, string>();
  
  // Analizza ogni trigger
  triggers.forEach(trigger => {
    if (!trigger.triggerId) return;
    
    const usedByTags = triggerUsage.get(trigger.triggerId) || [];
    const type = trigger.type?.toUpperCase() || '';
    const filters = trigger.filter || [];
    const isUnfilteredAllPages = ['PAGEVIEW', 'DOM_READY', 'WINDOW_LOADED'].includes(type) && isEmptyFilter(filters);
    
    // Contatori
    if (isUnfilteredAllPages) {
      allPagesUnfiltered++;
    }
    
    if (usedByTags.length === 0) {
      unused++;
    }
    
    // Controlla blocking triggers su tag marketing
    const marketingTags = usedByTags.filter(isMarketingTag);
    if (marketingTags.length > 0) {
      const hasBlocking = marketingTags.some(tag => hasBlockingTriggers(tag));
      if (hasBlocking) {
        withBlockingOnMarketing++;
      }
    }
    
    if (type === 'HISTORY_CHANGE') {
      hasHistoryChange = true;
    }
    
    // Valuta timing
    const timing = evaluateTiming(trigger, usedByTags);
    totalTimingChecks++;
    if (timing === 'bad') {
      badTimingCount++;
    }
    
    // Rileva duplicati
    const signature = createTriggerSignature(trigger);
    if (signatures.has(signature)) {
      const existingId = signatures.get(signature)!;
      duplicates.push({
        ids: [existingId, trigger.triggerId],
        reason: 'same type+conditions'
      });
    } else {
      signatures.set(signature, trigger.triggerId);
    }
    
    // Genera issues
    if (isUnfilteredAllPages) {
      const nonCoreTags = usedByTags.filter(tag => !isCoreTag(tag));
      if (nonCoreTags.length > 0) {
        issues.push({
          severity: 'major',
          trigger_id: trigger.triggerId,
          name: trigger.name || 'Unnamed Trigger',
          reason: 'All Pages senza filtri usato da tag non-core',
          used_by_tag_ids: nonCoreTags.map(tag => tag.tagId || tag.name || 'unknown'),
          suggestion: 'Aggiungi filtro su hostname/path o sposta a DOM_READY'
        });
      }
    }
    
    if (timing === 'bad') {
      issues.push({
        severity: 'minor',
        trigger_id: trigger.triggerId,
        name: trigger.name || 'Unnamed Trigger',
        reason: 'Timing non ottimale',
        suggestion: 'Valuta DOM_READY o verifica necessità'
      });
    }
    
    if (usedByTags.length === 0) {
      issues.push({
        severity: 'minor',
        trigger_id: trigger.triggerId,
        name: trigger.name || 'Unnamed Trigger',
        reason: 'Trigger non utilizzato',
        suggestion: 'Rimuovi se non necessario'
      });
    }
  });
  
  // Calcola sottopunteggi
  const specificity = Math.max(0, 1 - (allPagesUnfiltered / Math.max(triggers.length, 1)));
  
  const marketingTagsCount = tags.filter(isMarketingTag).length;
  const blocking = marketingTagsCount > 0 
    ? Math.min(1, withBlockingOnMarketing / marketingTagsCount)
    : 0.5;
  
  const timing = totalTimingChecks > 0 
    ? 1 - (badTimingCount / totalTimingChecks)
    : 1;
  
  const spa = hasHistoryChange ? 1 : 0.5;
  
  const hygiene = Math.max(0, 1 - ((unused + duplicates.length) / Math.max(triggers.length, 1)));
  
  // Calcola punteggio finale
  const breakdown: TriggerQualityBreakdown = {
    specificity,
    blocking,
    timing,
    spa,
    hygiene
  };
  
  const score = 
    TRIGGER_QUALITY_WEIGHTS.specificity * specificity +
    TRIGGER_QUALITY_WEIGHTS.blocking * blocking +
    TRIGGER_QUALITY_WEIGHTS.timing * timing +
    TRIGGER_QUALITY_WEIGHTS.spa * spa +
    TRIGGER_QUALITY_WEIGHTS.hygiene * hygiene;
  
  // Genera messaggio per UI
  const message = generateTriggerMessage({
    total: triggers.length,
    unused,
    allPagesUnfiltered,
    score
  });
  
  // Calcola impatto
  const impact = {
    weight: 0.20, // 20% del punteggio totale
    contribution: score * 0.20
  };
  
  return {
    trigger_quality: {
      score,
      breakdown,
      stats: {
        total_triggers: triggers.length,
        unused_triggers: unused,
        all_pages_unfiltered: allPagesUnfiltered,
        with_blocking_on_marketing: withBlockingOnMarketing,
        history_change_present: hasHistoryChange,
        duplicates
      },
      issues
    },
    message,
    impact
  };
}

/**
 * Genera il messaggio per l'interfaccia utente
 */
function generateTriggerMessage(stats: {
  total: number;
  unused: number;
  allPagesUnfiltered: number;
  score: number;
}): TriggerQualityResult['message'] {
  const { total, unused, allPagesUnfiltered, score } = stats;
  
  let status: 'critical' | 'major' | 'minor' | 'ok';
  if (score < 0.5) {
    status = 'critical';
  } else if (score < 0.7) {
    status = 'major';
  } else if (score < 0.85) {
    status = 'minor';
  } else {
    status = 'ok';
  }
  
  const summary = `${total} trigger totali · ${unused} non usati · ${allPagesUnfiltered} All Pages senza filtri`;
  const cta = 'Rivedi trigger';
  
  return {
    title: 'Qualità Trigger',
    status,
    summary,
    cta
  };
}

// ============================================================================
// 6. FUNZIONI UTILITY PER LA DASHBOARD
// ============================================================================

/**
 * Ottiene informazioni per la visualizzazione di una metrica trigger
 */
export function getTriggerMetricInfo(severity: 'critical' | 'major' | 'minor' | 'ok') {
  const metricInfo = {
    critical: {
      icon: "🚨",
      title: "Qualità Trigger",
      subtitle: "Trigger con problemi critici di configurazione",
      impact: "Trigger mal configurati possono causare problemi di performance e tracking.",
      risk: "Rischio: tracking non affidabile, performance degradate.",
      priority: "Critica",
      priorityColor: "bg-red-100 text-red-800",
      color: "bg-red-50 dark:bg-red-900/20",
      textColor: "text-red-600 dark:text-red-400"
    },
    major: {
      icon: "⚠️",
      title: "Qualità Trigger",
      subtitle: "Trigger con problemi di configurazione",
      impact: "Alcuni trigger potrebbero essere ottimizzati per migliori performance.",
      risk: "Rischio: configurazione sub-ottimale dei trigger.",
      priority: "Maggiore",
      priorityColor: "bg-orange-100 text-orange-800",
      color: "bg-orange-50 dark:bg-orange-900/20",
      textColor: "text-orange-600 dark:text-orange-400"
    },
    minor: {
      icon: "ℹ️",
      title: "Qualità Trigger",
      subtitle: "Trigger con piccole ottimizzazioni possibili",
      impact: "Trigger configurati correttamente con margini di miglioramento.",
      risk: "Rischio: configurazione buona ma non ottimale.",
      priority: "Bassa",
      priorityColor: "bg-blue-100 text-blue-800",
      color: "bg-blue-50 dark:bg-blue-900/20",
      textColor: "text-blue-600 dark:text-blue-400"
    },
    ok: {
      icon: "✅",
      title: "Qualità Trigger",
      subtitle: "Trigger configurati correttamente",
      impact: "Tutti i trigger sono configurati in modo ottimale.",
      risk: "Nessun rischio: configurazione eccellente.",
      priority: "OK",
      priorityColor: "bg-green-100 text-green-800",
      color: "bg-green-50 dark:bg-green-900/20",
      textColor: "text-green-600 dark:text-green-400"
    }
  };
  
  return metricInfo[severity];
}

// ============================================================================
// 7. TEST CASI DI ACCETTAZIONE
// ============================================================================

/**
 * Esegue test di accettazione per la funzionalità Trigger Quality
 */
export function runTriggerQualityTests(): boolean {
  console.log('🧪 Running Trigger Quality Tests...');
  
  try {
    // TC1: All Pages non filtrato usato da Ads
    const tc1Container = {
      trigger: [
        {
          triggerId: 'trg_1',
          name: 'TRG_AllPages',
          type: 'PAGEVIEW',
          filter: []
        }
      ],
      tag: [
        {
          tagId: 'tag_1',
          name: 'Google Ads Conversion',
          type: 'awct',
          firingTriggerId: ['trg_1']
        }
      ]
    };
    
    const tc1Result = analyzeTriggerQuality(tc1Container);
    if (tc1Result.trigger_quality.breakdown.specificity >= 1) {
      throw new Error('TC1 failed: Should penalize unfiltered All Pages');
    }
    if (!tc1Result.trigger_quality.issues.some(issue => issue.severity === 'major')) {
      throw new Error('TC1 failed: Should detect major issue for unfiltered All Pages');
    }
    console.log('✅ TC1 passed: Unfiltered All Pages detected');
    
    // TC2: Trigger non usati
    const tc2Container = {
      trigger: [
        {
          triggerId: 'trg_1',
          name: 'TRG_Used',
          type: 'DOM_READY',
          filter: []
        },
        {
          triggerId: 'trg_2',
          name: 'TRG_Unused1',
          type: 'CLICK',
          filter: []
        },
        {
          triggerId: 'trg_3',
          name: 'TRG_Unused2',
          type: 'FORM_SUBMISSION',
          filter: []
        }
      ],
      tag: [
        {
          tagId: 'tag_1',
          name: 'GA4 Config',
          type: 'gaawc',
          firingTriggerId: ['trg_1']
        }
      ]
    };
    
    const tc2Result = analyzeTriggerQuality(tc2Container);
    if (tc2Result.trigger_quality.stats.unused_triggers !== 2) {
      throw new Error('TC2 failed: Should detect 2 unused triggers');
    }
    console.log('✅ TC2 passed: Unused triggers detected');
    
    // TC3: Timing errato
    const tc3Container = {
      trigger: [
        {
          triggerId: 'trg_1',
          name: 'TRG_Pageview_Bad',
          type: 'PAGEVIEW',
          filter: []
        }
      ],
      tag: [
        {
          tagId: 'tag_1',
          name: 'Hotjar Tracking',
          type: 'html',
          firingTriggerId: ['trg_1']
        }
      ]
    };
    
    const tc3Result = analyzeTriggerQuality(tc3Container);
    if (tc3Result.trigger_quality.breakdown.timing >= 1) {
      throw new Error('TC3 failed: Should penalize bad timing');
    }
    console.log('✅ TC3 passed: Bad timing detected');
    
    // TC4: SPA support presente
    const tc4Container = {
      trigger: [
        {
          triggerId: 'trg_1',
          name: 'TRG_HistoryChange',
          type: 'HISTORY_CHANGE',
          filter: []
        }
      ],
      tag: [
        {
          tagId: 'tag_1',
          name: 'GA4 Page View SPA',
          type: 'gaawe',
          firingTriggerId: ['trg_1'],
          parameter: [
            { key: 'eventName', value: 'page_view' }
          ]
        }
      ]
    };
    
    const tc4Result = analyzeTriggerQuality(tc4Container);
    if (tc4Result.trigger_quality.breakdown.spa !== 1) {
      throw new Error('TC4 failed: Should detect SPA support');
    }
    console.log('✅ TC4 passed: SPA support detected');
    
    // TC5: Duplicati
    const tc5Container = {
      trigger: [
        {
          triggerId: 'trg_1',
          name: 'TRG_AllPages1',
          type: 'PAGEVIEW',
          filter: []
        },
        {
          triggerId: 'trg_2',
          name: 'TRG_AllPages2',
          type: 'PAGEVIEW',
          filter: []
        }
      ],
      tag: []
    };
    
    const tc5Result = analyzeTriggerQuality(tc5Container);
    if (tc5Result.trigger_quality.stats.duplicates.length !== 1) {
      throw new Error('TC5 failed: Should detect duplicate triggers');
    }
    console.log('✅ TC5 passed: Duplicate triggers detected');
    
    console.log('🎉 All Trigger Quality tests passed!');
    return true;
    
  } catch (error) {
    console.error('❌ Trigger Quality tests failed:', error);
    return false;
  }
}
