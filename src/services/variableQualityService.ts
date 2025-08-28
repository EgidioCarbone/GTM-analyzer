/**
 * Variable Quality Analysis Service
 * 
 * Analizza le variabili nel JSON di GTM e assegna un giudizio di qualità,
 * evidenziando problemi con DLV, regex, selettori CSS, variabili JS, lookup table,
 * variabili non usate e duplicati.
 */

import { GTMTag, GTMTrigger, GTMVariable, VariableQualityResult, VariableQualityBreakdown, VariableQualityStats, VariableQualityIssue } from "../types/gtm";

// ============================================================================
// 1. CONFIGURAZIONE E PESI
// ============================================================================

const VARIABLE_QUALITY_WEIGHTS = {
  dlv: 0.30,        // 30% - Data Layer Variable quality
  selectors: 0.20,  // 20% - CSS/DOM selector quality
  js: 0.20,         // 20% - JavaScript variable quality
  lookup: 0.15,     // 15% - Lookup table quality
  regex: 0.10,      // 10% - Regex pattern quality
  hygiene: 0.05     // 5% - Variable hygiene (unused, duplicates)
};

// ============================================================================
// 2. UTILITY FUNZIONI
// ============================================================================

/**
 * Estrae un parametro da una variabile
 */
function getVariableParameter(variable: GTMVariable, key: string): any {
  return (variable.parameter || []).find(p => p.key === key)?.value;
}

/**
 * Crea un indice di utilizzo delle variabili dai tag
 */
function buildVariableUsageIndex(tags: GTMTag[]): Map<string, number> {
  const usageIndex = new Map<string, number>();
  
  tags.forEach(tag => {
    // Cerca riferimenti a variabili nei parametri del tag
    (tag.parameter || []).forEach(param => {
      if (typeof param.value === 'string') {
        // Cerca pattern {{VariableName}}
        const matches = param.value.match(/\{\{([^}]+)\}\}/g);
        if (matches) {
          matches.forEach(match => {
            const varName = match.replace(/[{}]/g, '').toLowerCase();
            usageIndex.set(varName, (usageIndex.get(varName) || 0) + 1);
          });
        }
      }
    });
    
    // Cerca anche nel codice HTML per tag custom
    if (tag.type === 'html' && tag.html) {
      const htmlMatches = tag.html.match(/\{\{([^}]+)\}\}/g);
      if (htmlMatches) {
        htmlMatches.forEach(match => {
          const varName = match.replace(/[{}]/g, '').toLowerCase();
          usageIndex.set(varName, (usageIndex.get(varName) || 0) + 1);
        });
      }
    }
  });
  
  return usageIndex;
}

/**
 * Normalizza il nome di una variabile per il confronto (case-insensitive)
 */
function normalizeVariableName(name: string): string {
  return name.toLowerCase().trim();
}

// ============================================================================
// 3. ANALISI SPECIFICHE PER TIPO DI VARIABILE
// ============================================================================

/**
 * Analizza una Data Layer Variable
 */
function analyzeDLV(variable: GTMVariable): { score: number; issues: VariableQualityIssue[] } {
  const issues: VariableQualityIssue[] = [];
  let score = 1.0;
  
  const dataLayerVersion = getVariableParameter(variable, 'dataLayerVersion');
  const dataLayerVariable = getVariableParameter(variable, 'dataLayerVariable');
  const defaultValue = getVariableParameter(variable, 'defaultValue');
  
  // KO se dataLayerVersion non è 2 (quando presente)
  if (dataLayerVersion && dataLayerVersion !== 2) {
    issues.push({
      severity: 'critical',
      name: variable.name,
      reason: 'DLV con dataLayerVersion non è 2',
      suggestion: 'Imposta dataLayerVersion = 2 per compatibilità GA4',
      variable_id: variable.variableId
    });
    score -= 0.5;
  }
  
  // KO se il path contiene segmenti vuoti o generici
  if (dataLayerVariable) {
    const path = String(dataLayerVariable);
    if (path.includes('..') || path.startsWith('.') || path.endsWith('.')) {
      issues.push({
        severity: 'critical',
        name: variable.name,
        reason: 'DLV con path malformato',
        suggestion: 'Usa path completo (es. ecommerce.items invece di items)',
        variable_id: variable.variableId
      });
      score -= 0.3;
    }
    
    // Warning per path generici
    if (path === 'items' || path === 'products' || path === 'data') {
      issues.push({
        severity: 'minor',
        name: variable.name,
        reason: 'DLV con path generico',
        suggestion: 'Specifica path completo (es. ecommerce.items)',
        variable_id: variable.variableId
      });
      score -= 0.1;
    }
  }
  
  // Warning se manca fallback
  if (!defaultValue) {
    issues.push({
      severity: 'major',
      name: variable.name,
      reason: 'DLV senza fallback',
      suggestion: 'Imposta defaultValue = {} o \'\'',
      variable_id: variable.variableId
    });
    score -= 0.2;
  }
  
  return { score: Math.max(0, score), issues };
}

/**
 * Analizza una Regex Variable
 */
function analyzeRegex(variable: GTMVariable): { score: number; issues: VariableQualityIssue[] } {
  const issues: VariableQualityIssue[] = [];
  let score = 1.0;
  
  const pattern = getVariableParameter(variable, 'pattern');
  
  if (pattern) {
    try {
      // Testa se la regex è compilabile
      new RegExp(pattern);
      
      // Warning se pattern contiene .* senza ancoraggi
      if (pattern.includes('.*') && !pattern.startsWith('^') && !pattern.endsWith('$')) {
        issues.push({
          severity: 'minor',
          name: variable.name,
          reason: 'Regex senza ancoraggi ^/$',
          suggestion: 'Aggiungi ^ e $ per match completo',
          variable_id: variable.variableId
        });
        score -= 0.1;
      }
    } catch (error) {
      issues.push({
        severity: 'critical',
        name: variable.name,
        reason: 'Regex malformata',
        suggestion: 'Correggi la sintassi regex',
        variable_id: variable.variableId
      });
      score -= 0.5;
    }
  }
  
  return { score: Math.max(0, score), issues };
}

/**
 * Analizza una CSS/DOM Selector Variable
 */
function analyzeCSSSelector(variable: GTMVariable): { score: number; issues: VariableQualityIssue[] } {
  const issues: VariableQualityIssue[] = [];
  let score = 1.0;
  
  const selector = getVariableParameter(variable, 'selector');
  
  if (selector) {
    const selectorStr = String(selector);
    
    // Warning per classi "randomiche" (pattern tipo css-abc123)
    const randomClassPattern = /(^|\\.)(css|sc|chakra|Mui|_[a-z])[-_][a-z0-9]{6,}/i;
    if (randomClassPattern.test(selectorStr)) {
      issues.push({
        severity: 'minor',
        name: variable.name,
        reason: 'Selettore fragile (classe generata)',
        suggestion: 'Usa data-attribute stabile (es. [data-cta=\'buy\'])',
        variable_id: variable.variableId
      });
      score -= 0.2;
    }
    
    // Warning per nth-child
    if (selectorStr.includes('nth-child')) {
      issues.push({
        severity: 'minor',
        name: variable.name,
        reason: 'Selettore con nth-child',
        suggestion: 'Usa selettori più stabili (classi, ID, data-attributes)',
        variable_id: variable.variableId
      });
      score -= 0.1;
    }
    
    // Warning per percorsi troppo profondi
    const depth = (selectorStr.match(/>/g) || []).length;
    if (depth > 4) {
      issues.push({
        severity: 'minor',
        name: variable.name,
        reason: 'Selettore troppo profondo',
        suggestion: 'Semplifica il selettore CSS',
        variable_id: variable.variableId
      });
      score -= 0.1;
    }
  }
  
  return { score: Math.max(0, score), issues };
}

/**
 * Analizza una JavaScript Variable
 */
function analyzeJSVariable(variable: GTMVariable): { score: number; issues: VariableQualityIssue[] } {
  const issues: VariableQualityIssue[] = [];
  let score = 1.0;
  
  const jsCode = getVariableParameter(variable, 'javascript');
  
  if (jsCode) {
    const code = String(jsCode);
    
    // KO se include eval o document.write
    if (code.includes('eval(') || code.includes('document.write')) {
      issues.push({
        severity: 'critical',
        name: variable.name,
        reason: 'JS con eval o document.write',
        suggestion: 'Rimuovi eval() e document.write per sicurezza',
        variable_id: variable.variableId
      });
      score -= 0.5;
    }
    
    // Warning se non rilevi try/catch e contiene accessi a proprietà annidate
    if (!code.includes('try') && !code.includes('catch')) {
      const nestedAccessPattern = /\w+\.\w+\.\w+/;
      if (nestedAccessPattern.test(code)) {
        issues.push({
          severity: 'minor',
          name: variable.name,
          reason: 'JS senza try/catch per accessi annidati',
          suggestion: 'Aggiungi try/catch per gestire errori',
          variable_id: variable.variableId
        });
        score -= 0.1;
      }
    }
  }
  
  return { score: Math.max(0, score), issues };
}

/**
 * Analizza una Lookup Table Variable
 */
function analyzeLookupTable(variable: GTMVariable): { score: number; issues: VariableQualityIssue[] } {
  const issues: VariableQualityIssue[] = [];
  let score = 1.0;
  
  const defaultTable = getVariableParameter(variable, 'defaultTable');
  const inputVariable = getVariableParameter(variable, 'inputVariable');
  
  // KO se manca default
  if (!defaultTable) {
    issues.push({
      severity: 'critical',
      name: variable.name,
      reason: 'Lookup Table senza default',
      suggestion: 'Imposta un valore di default',
      variable_id: variable.variableId
    });
    score -= 0.5;
  }
  
  // Bonus se chiavi normalizzate e default presente
  if (defaultTable && inputVariable) {
    score += 0.1; // Bonus per configurazione corretta
  }
  
  return { score: Math.min(1.0, score), issues };
}

/**
 * Analizza variabili URL/COOKIE/RANDOM
 */
function analyzeOtherVariable(variable: GTMVariable): { score: number; issues: VariableQualityIssue[] } {
  const issues: VariableQualityIssue[] = [];
  let score = 1.0;
  
  const type = variable.type.toLowerCase();
  
  if (type === 'url') {
    const urlPart = getVariableParameter(variable, 'urlPart');
    if (!urlPart || urlPart === '') {
      issues.push({
        severity: 'minor',
        name: variable.name,
        reason: 'URL part non valido',
        suggestion: 'Specifica una parte URL valida',
        variable_id: variable.variableId
      });
      score -= 0.1;
    }
  }
  
  if (type === 'cookie') {
    const cookieName = getVariableParameter(variable, 'cookieName');
    if (!cookieName || cookieName === '') {
      issues.push({
        severity: 'minor',
        name: variable.name,
        reason: 'Cookie name vuoto',
        suggestion: 'Specifica un nome cookie valido',
        variable_id: variable.variableId
      });
      score -= 0.1;
    }
  }
  
  return { score: Math.max(0, score), issues };
}

// ============================================================================
// 4. FUNZIONE PRINCIPALE DI ANALISI
// ============================================================================

/**
 * Analizza la qualità delle variabili in un container GTM
 */
export function analyzeVariableQuality(containerVersion: {
  variable?: GTMVariable[];
  tag?: GTMTag[];
  trigger?: GTMTrigger[];
}): VariableQualityResult {
  const variables = containerVersion.variable || [];
  const tags = containerVersion.tag || [];
  
  // Crea indice di utilizzo
  const usageIndex = buildVariableUsageIndex(tags);
  
  // Contatori per statistiche
  let total = variables.length;
  let unused = 0;
  let duplicates = 0;
  let dlvMissingFallback = 0;
  let lookupWithoutDefault = 0;
  let regexMalformed = 0;
  let cssFragileSelectors = 0;
  let jsUnsafeCode = 0;
  
  // Punteggi per categoria
  let dlvScore = 0;
  let regexScore = 0;
  let selectorsScore = 0;
  let jsScore = 0;
  let lookupScore = 0;
  let hygieneScore = 0;
  
  let dlvCount = 0;
  let regexCount = 0;
  let selectorsCount = 0;
  let jsCount = 0;
  let lookupCount = 0;
  
  const allIssues: VariableQualityIssue[] = [];
  const nameMap = new Map<string, string[]>(); // Per rilevare duplicati
  
  // Analizza ogni variabile
  variables.forEach(variable => {
    const type = variable.type.toLowerCase();
    const normalizedName = normalizeVariableName(variable.name);
    
    // Controlla utilizzo
    const usageCount = usageIndex.get(normalizedName) || 0;
    if (usageCount === 0) {
      unused++;
    }
    
    // Rileva duplicati (case-insensitive)
    if (nameMap.has(normalizedName)) {
      nameMap.get(normalizedName)!.push(variable.name);
      duplicates++;
    } else {
      nameMap.set(normalizedName, [variable.name]);
    }
    
    // Analizza per tipo
    let analysis: { score: number; issues: VariableQualityIssue[] } = { score: 1, issues: [] };
    
    switch (type) {
      case 'v':
      case 'dataLayerVariable':
        analysis = analyzeDLV(variable);
        dlvScore += analysis.score;
        dlvCount++;
        
        // Conta problemi specifici
        if (analysis.issues.some(issue => issue.reason.includes('senza fallback'))) {
          dlvMissingFallback++;
        }
        break;
        
      case 'regex':
        analysis = analyzeRegex(variable);
        regexScore += analysis.score;
        regexCount++;
        
        if (analysis.issues.some(issue => issue.reason.includes('malformata'))) {
          regexMalformed++;
        }
        break;
        
      case 'css':
      case 'dom':
        analysis = analyzeCSSSelector(variable);
        selectorsScore += analysis.score;
        selectorsCount++;
        
        if (analysis.issues.some(issue => issue.reason.includes('fragile'))) {
          cssFragileSelectors++;
        }
        break;
        
      case 'js':
      case 'javascript':
        analysis = analyzeJSVariable(variable);
        jsScore += analysis.score;
        jsCount++;
        
        if (analysis.issues.some(issue => issue.reason.includes('eval') || issue.reason.includes('document.write'))) {
          jsUnsafeCode++;
        }
        break;
        
      case 'lookup':
      case 'lookupTable':
        analysis = analyzeLookupTable(variable);
        lookupScore += analysis.score;
        lookupCount++;
        
        if (analysis.issues.some(issue => issue.reason.includes('senza default'))) {
          lookupWithoutDefault++;
        }
        break;
        
      case 'url':
      case 'cookie':
      case 'random':
        analysis = analyzeOtherVariable(variable);
        // Questi non contribuiscono a categorie specifiche
        break;
    }
    
    allIssues.push(...analysis.issues);
  });
  
  // Calcola punteggi medi per categoria
  const breakdown: VariableQualityBreakdown = {
    dlv: dlvCount > 0 ? dlvScore / dlvCount : 1,
    regex: regexCount > 0 ? regexScore / regexCount : 1,
    selectors: selectorsCount > 0 ? selectorsScore / selectorsCount : 1,
    js: jsCount > 0 ? jsScore / jsCount : 1,
    lookup: lookupCount > 0 ? lookupScore / lookupCount : 1,
    hygiene: Math.max(0, 1 - ((unused + duplicates) / Math.max(total, 1)))
  };
  
  // Calcola punteggio finale ponderato
  const score = 
    VARIABLE_QUALITY_WEIGHTS.dlv * breakdown.dlv +
    VARIABLE_QUALITY_WEIGHTS.selectors * breakdown.selectors +
    VARIABLE_QUALITY_WEIGHTS.js * breakdown.js +
    VARIABLE_QUALITY_WEIGHTS.lookup * breakdown.lookup +
    VARIABLE_QUALITY_WEIGHTS.regex * breakdown.regex +
    VARIABLE_QUALITY_WEIGHTS.hygiene * breakdown.hygiene;
  
  // Genera messaggio per UI
  const message = generateVariableMessage({
    total,
    unused,
    dlvMissingFallback,
    lookupWithoutDefault,
    score
  });
  
  // Calcola impatto
  const impact = {
    weight: 0.15, // 15% del punteggio totale
    contribution: score * 0.15
  };
  
  return {
    variable_quality: {
      score,
      breakdown,
      stats: {
        total,
        unused,
        duplicates,
        dlv_missing_fallback: dlvMissingFallback,
        lookup_without_default: lookupWithoutDefault,
        regex_malformed: regexMalformed,
        css_fragile_selectors: cssFragileSelectors,
        js_unsafe_code: jsUnsafeCode
      },
      issues: allIssues
    },
    message,
    impact
  };
}

/**
 * Genera il messaggio per l'interfaccia utente
 */
function generateVariableMessage(stats: {
  total: number;
  unused: number;
  dlvMissingFallback: number;
  lookupWithoutDefault: number;
  score: number;
}): VariableQualityResult['message'] {
  const { total, unused, dlvMissingFallback, lookupWithoutDefault, score } = stats;
  
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
  
  const summary = `${total} variabili · ${unused} non usate · ${dlvMissingFallback} DLV senza fallback · ${lookupWithoutDefault} Lookup senza default`;
  const cta = 'Rivedi variabili';
  
  return {
    title: 'Qualità Variabili',
    status,
    summary,
    cta
  };
}

// ============================================================================
// 5. FUNZIONI UTILITY PER LA DASHBOARD
// ============================================================================

/**
 * Ottiene informazioni per la visualizzazione di una metrica variabile
 */
export function getVariableMetricInfo(severity: 'critical' | 'major' | 'minor' | 'ok') {
  const metricInfo = {
    critical: {
      icon: "🚨",
      title: "Qualità Variabili",
      subtitle: "Variabili con problemi critici di configurazione",
      impact: "Variabili mal configurate possono causare errori di tracking e performance.",
      risk: "Rischio: tracking non affidabile, errori JavaScript.",
      priority: "Critica",
      priorityColor: "bg-red-100 text-red-800",
      color: "bg-red-50 dark:bg-red-900/20",
      textColor: "text-red-600 dark:text-red-400"
    },
    major: {
      icon: "⚠️",
      title: "Qualità Variabili",
      subtitle: "Variabili con problemi di configurazione",
      impact: "Alcune variabili potrebbero essere ottimizzate per migliori performance.",
      risk: "Rischio: configurazione sub-ottimale delle variabili.",
      priority: "Maggiore",
      priorityColor: "bg-orange-100 text-orange-800",
      color: "bg-orange-50 dark:bg-orange-900/20",
      textColor: "text-orange-600 dark:text-orange-400"
    },
    minor: {
      icon: "ℹ️",
      title: "Qualità Variabili",
      subtitle: "Variabili con piccole ottimizzazioni possibili",
      impact: "Variabili configurate correttamente con margini di miglioramento.",
      risk: "Rischio: configurazione buona ma non ottimale.",
      priority: "Bassa",
      priorityColor: "bg-blue-100 text-blue-800",
      color: "bg-blue-50 dark:bg-blue-900/20",
      textColor: "text-blue-600 dark:text-blue-400"
    },
    ok: {
      icon: "✅",
      title: "Qualità Variabili",
      subtitle: "Variabili configurate correttamente",
      impact: "Tutte le variabili sono configurate in modo ottimale.",
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
// 6. TEST CASI DI ACCETTAZIONE
// ============================================================================

/**
 * Esegue test di accettazione per la funzionalità Variable Quality
 */
export function runVariableQualityTests(): boolean {
  console.log('🧪 Running Variable Quality Tests...');
  
  try {
    // TC1: DLV senza fallback
    const tc1Container = {
      variable: [
        {
          variableId: 'var_1',
          name: 'DLV - items',
          type: 'v',
          parameter: [
            { key: 'dataLayerVariable', value: 'items' },
            { key: 'dataLayerVersion', value: 2 }
            // Manca defaultValue
          ]
        }
      ],
      tag: []
    };
    
    const tc1Result = analyzeVariableQuality(tc1Container);
    if (tc1Result.variable_quality.stats.dlv_missing_fallback !== 1) {
      throw new Error('TC1 failed: Should detect DLV without fallback');
    }
    if (!tc1Result.variable_quality.issues.some(issue => issue.reason.includes('senza fallback'))) {
      throw new Error('TC1 failed: Should detect major issue for missing fallback');
    }
    console.log('✅ TC1 passed: DLV without fallback detected');
    
    // TC2: Lookup senza default
    const tc2Container = {
      variable: [
        {
          variableId: 'var_1',
          name: 'Lookup - Country',
          type: 'lookup',
          parameter: [
            { key: 'inputVariable', value: '{{Country}}' }
            // Manca defaultTable
          ]
        }
      ],
      tag: []
    };
    
    const tc2Result = analyzeVariableQuality(tc2Container);
    if (tc2Result.variable_quality.stats.lookup_without_default !== 1) {
      throw new Error('TC2 failed: Should detect Lookup without default');
    }
    if (!tc2Result.variable_quality.issues.some(issue => issue.reason.includes('senza default'))) {
      throw new Error('TC2 failed: Should detect critical issue for missing default');
    }
    console.log('✅ TC2 passed: Lookup without default detected');
    
    // TC3: CSS con classe generata
    const tc3Container = {
      variable: [
        {
          variableId: 'var_1',
          name: 'CSS - Button',
          type: 'css',
          parameter: [
            { key: 'selector', value: '.css-1ab23cd .btn' }
          ]
        }
      ],
      tag: []
    };
    
    const tc3Result = analyzeVariableQuality(tc3Container);
    if (tc3Result.variable_quality.stats.css_fragile_selectors !== 1) {
      throw new Error('TC3 failed: Should detect fragile CSS selector');
    }
    if (!tc3Result.variable_quality.issues.some(issue => issue.reason.includes('fragile'))) {
      throw new Error('TC3 failed: Should detect warning for fragile selector');
    }
    console.log('✅ TC3 passed: Fragile CSS selector detected');
    
    // TC4: JS con eval
    const tc4Container = {
      variable: [
        {
          variableId: 'var_1',
          name: 'JS - Dynamic',
          type: 'js',
          parameter: [
            { key: 'javascript', value: 'eval("some code")' }
          ]
        }
      ],
      tag: []
    };
    
    const tc4Result = analyzeVariableQuality(tc4Container);
    if (tc4Result.variable_quality.stats.js_unsafe_code !== 1) {
      throw new Error('TC4 failed: Should detect unsafe JS code');
    }
    if (!tc4Result.variable_quality.issues.some(issue => issue.reason.includes('eval'))) {
      throw new Error('TC4 failed: Should detect critical issue for eval');
    }
    console.log('✅ TC4 passed: Unsafe JS code detected');
    
    // TC5: Variabili non usate
    const tc5Container = {
      variable: [
        {
          variableId: 'var_1',
          name: 'Unused Var 1',
          type: 'v',
          parameter: []
        },
        {
          variableId: 'var_2',
          name: 'Unused Var 2',
          type: 'v',
          parameter: []
        },
        {
          variableId: 'var_3',
          name: 'Unused Var 3',
          type: 'v',
          parameter: []
        },
        {
          variableId: 'var_4',
          name: 'Unused Var 4',
          type: 'v',
          parameter: []
        },
        {
          variableId: 'var_5',
          name: 'Unused Var 5',
          type: 'v',
          parameter: []
        }
      ],
      tag: [] // Nessun tag che usa le variabili
    };
    
    const tc5Result = analyzeVariableQuality(tc5Container);
    if (tc5Result.variable_quality.stats.unused !== 5) {
      throw new Error('TC5 failed: Should detect 5 unused variables');
    }
    console.log('✅ TC5 passed: Unused variables detected');
    
    console.log('🎉 All Variable Quality tests passed!');
    return true;
    
  } catch (error) {
    console.error('❌ Variable Quality tests failed:', error);
    return false;
  }
}
