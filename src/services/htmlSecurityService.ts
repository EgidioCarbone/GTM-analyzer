/**
 * HTML Security Analysis Service
 * 
 * Analizza i tag Custom HTML nel JSON di GTM per individuare rischi di sicurezza/performance
 * e generare esito strutturato, riepilogo leggibile e suggerimenti d'azione.
 */

import { GTMTag, GTMTrigger, HtmlSecurityResult, HtmlSecurityDetail, HtmlSecurityIssue } from "../types/gtm";

// ============================================================================
// 1. CONFIGURAZIONE E PESI
// ============================================================================

const HTML_SECURITY_WEIGHTS = {
  critical: 0.5,  // 50% penalty per issue critiche
  major: 0.25,    // 25% penalty per issue maggiori
  minor: 0.1      // 10% penalty per issue minori
};

// ============================================================================
// 2. UTILITY FUNZIONI
// ============================================================================

/**
 * Estrae il codice HTML/JS da un tag
 */
function extractHtmlOrJs(tag: GTMTag): string {
  // Cerca nel campo html
  if (tag.html) {
    return String(tag.html);
  }
  
  // Cerca nei parametri
  const htmlParam = (tag.parameter || []).find(p => 
    p.key === 'html' || p.key === 'javascript' || p.key === 'customHtml'
  );
  
  if (htmlParam) {
    return String(htmlParam.value);
  }
  
  return '';
}

/**
 * Determina se un tag sembra essere un template custom
 */
function looksLikeCustomTemplate(tag: GTMTag): boolean {
  const type = tag.type?.toLowerCase() || '';
  const name = tag.name?.toLowerCase() || '';
  
  // Template custom comuni
  const customPatterns = [
    'custom', 'html', 'javascript', 'js', 'script',
    'widget', 'embed', 'iframe', 'pixel'
  ];
  
  return customPatterns.some(pattern => 
    type.includes(pattern) || name.includes(pattern)
  );
}

/**
 * Estrae tutte le URL dal codice
 */
function extractUrls(code: string): string[] {
  const urlRegex = /https?:\/\/[^\s"'<>]+/gi;
  const matches = code.match(urlRegex) || [];
  return matches.map(url => url.replace(/[.,;!?]+$/, '')); // Rimuovi punteggiatura finale
}

/**
 * Estrae i domini dalle URL
 */
function extractDomains(urls: string[]): string[] {
  const domains = new Set<string>();
  
  urls.forEach(url => {
    try {
      const domain = new URL(url).hostname;
      domains.add(domain);
    } catch (e) {
      // URL malformata, ignora
    }
  });
  
  return Array.from(domains);
}

/**
 * Crea un indice dei trigger per ID
 */
function indexTriggers(triggers: GTMTrigger[]): Map<string, GTMTrigger> {
  const index = new Map<string, GTMTrigger>();
  triggers.forEach(trigger => {
    if (trigger.triggerId) {
      index.set(trigger.triggerId, trigger);
    }
  });
  return index;
}

/**
 * Determina il timing di esecuzione di un tag
 */
function inferTiming(tag: GTMTag, triggersById: Map<string, GTMTrigger>): string {
  const firingTriggers = Array.isArray(tag.firingTriggerId) 
    ? tag.firingTriggerId 
    : tag.firingTriggerId ? [tag.firingTriggerId] : [];
  
  for (const triggerId of firingTriggers) {
    const trigger = triggersById.get(triggerId);
    if (trigger) {
      const type = trigger.type?.toUpperCase() || '';
      if (type === 'PAGEVIEW') return 'PAGEVIEW';
      if (type === 'DOM_READY') return 'DOM_READY';
      if (type === 'WINDOW_LOADED') return 'WINDOW_LOADED';
    }
  }
  
  return 'UNKNOWN';
}

/**
 * Controlla se un blocco di codice è lungo senza try/catch
 */
function isLongBlockWithoutTryCatch(code: string): boolean {
  const lines = code.split('\n').filter(line => line.trim().length > 0);
  
  if (lines.length <= 5) return false;
  
  // Cerca blocchi di codice senza try/catch
  const hasTryCatch = /try\s*\{/.test(code);
  const hasLongBlocks = lines.length > 5;
  
  return hasLongBlocks && !hasTryCatch;
}

/**
 * Determina la severità peggiore da una lista di issues
 */
function worstSeverity(issues: HtmlSecurityIssue[]): 'critical' | 'major' | 'minor' {
  if (issues.some(issue => issue.type.includes('critical'))) return 'critical';
  if (issues.some(issue => issue.type.includes('major'))) return 'major';
  return 'minor';
}

// ============================================================================
// 3. ANALISI DI SICUREZZA
// ============================================================================

/**
 * Analizza pattern pericolosi (severity = critical)
 */
function analyzeCriticalPatterns(code: string): HtmlSecurityIssue[] {
  const issues: HtmlSecurityIssue[] = [];
  
  // eval(, new Function(
  if (/(^|[^a-zA-Z0-9_])eval\s*\(/.test(code)) {
    issues.push({
      type: 'eval',
      message: 'Uso di eval() - rischio di code injection'
    });
  }
  
  if (/new\s+Function\s*\(/.test(code)) {
    issues.push({
      type: 'new_function',
      message: 'Uso di new Function() - rischio di code injection'
    });
  }
  
  // document.write(
  if (/document\.write\s*\(/.test(code)) {
    issues.push({
      type: 'document_write',
      message: 'Uso di document.write() - può bloccare il rendering'
    });
  }
  
  // innerHTML += / element.insertAdjacentHTML( con markup dinamico
  if (/innerHTML\s*\+?=/.test(code)) {
    issues.push({
      type: 'innerHTML_injection',
      message: 'Uso di innerHTML con contenuto dinamico - rischio XSS'
    });
  }
  
  if (/insertAdjacentHTML\s*\(/.test(code)) {
    issues.push({
      type: 'insertAdjacentHTML',
      message: 'Uso di insertAdjacentHTML con contenuto dinamico - rischio XSS'
    });
  }
  
  // XMLHttpRequest/fetch verso domini non https
  const urls = extractUrls(code);
  urls.forEach(url => {
    if (url.startsWith('http://')) {
      issues.push({
        type: 'insecure_request',
        message: 'Richiesta HTTP non sicura',
        url: url
      });
    }
  });
  
  // Script inject da stringhe
  if (/["']<script[^>]*>/.test(code)) {
    issues.push({
      type: 'script_injection',
      message: 'Possibile script injection da stringa concatenata'
    });
  }
  
  // Traccianti che inviano potenziali PII in chiaro
  if (/[?&](email|e-?mail|mail|phone|tel)=/i.test(code)) {
    issues.push({
      type: 'possible_pii',
      message: 'Possibile invio di dati sensibili (email/telefono) in chiaro'
    });
  }
  
  return issues;
}

/**
 * Analizza pattern rischiosi (severity = major)
 */
function analyzeMajorPatterns(code: string): HtmlSecurityIssue[] {
  const issues: HtmlSecurityIssue[] = [];
  
  // setInterval( con intervallo < 1000ms
  const setIntervalMatch = code.match(/setInterval\s*\(\s*[^,]+,\s*(\d+)\s*\)/);
  if (setIntervalMatch) {
    const interval = parseInt(setIntervalMatch[1]);
    if (interval < 1000) {
      issues.push({
        type: 'tight_interval',
        message: `setInterval con intervallo troppo breve (${interval}ms) - impatto performance`
      });
    }
  }
  
  // Event delegation aggressiva
  if (/addEventListener\s*\(\s*['"]click['"]\s*,/.test(code) && 
      /document\.body|document\)/.test(code)) {
    issues.push({
      type: 'broad_click_handler',
      message: 'Event delegation troppo ampia su document.body - impatto performance'
    });
  }
  
  // Accessi diretti a localStorage/sessionStorage per dati sensibili
  if (/(localStorage|sessionStorage)\.getItem\(['"](.*user|email|token)/i.test(code)) {
    issues.push({
      type: 'storage_sensitive',
      message: 'Accesso a dati sensibili in localStorage/sessionStorage'
    });
  }
  
  // Caricamento librerie duplicate
  const duplicateLibraries = [
    'gtag/js', 'jquery', 'gtm.js', 'analytics.js', 'ga.js'
  ];
  
  duplicateLibraries.forEach(lib => {
    const regex = new RegExp(lib.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    if (regex.test(code)) {
      issues.push({
        type: 'duplicate_library',
        message: `Possibile caricamento duplicato di ${lib}`
      });
    }
  });
  
  return issues;
}

/**
 * Analizza pattern best-practice mancanti (severity = minor)
 */
function analyzeMinorPatterns(code: string, tag: GTMTag, firesOn: string): HtmlSecurityIssue[] {
  const issues: HtmlSecurityIssue[] = [];
  
  // Mancanza di try/catch
  if (isLongBlockWithoutTryCatch(code)) {
    issues.push({
      type: 'no_try_catch',
      message: 'Blocco di codice lungo senza try/catch'
    });
  }
  
  // Mancanza di guardie di idempotenza
  if (!/window\.__.*_loaded/.test(code) && code.length > 100) {
    issues.push({
      type: 'no_idempotency_guard',
      message: 'Mancanza di guardia idempotenza per evitare esecuzioni multiple'
    });
  }
  
  // Nessun timeout su fetch/XMLHttpRequest
  if (/fetch\s*\(/.test(code) && !/timeout|AbortController/.test(code)) {
    issues.push({
      type: 'no_fetch_timeout',
      message: 'fetch() senza timeout - rischio di hang'
    });
  }
  
  if (/XMLHttpRequest/.test(code) && !/timeout/.test(code)) {
    issues.push({
      type: 'no_xhr_timeout',
      message: 'XMLHttpRequest senza timeout - rischio di hang'
    });
  }
  
  // Uso * in postMessage
  if (/postMessage\s*\([^,]+,\s*['"]\*['"]\s*\)/.test(code)) {
    issues.push({
      type: 'postMessage_star',
      message: 'postMessage con targetOrigin="*" - rischio sicurezza'
    });
  }
  
  // Timing non ottimale
  if (firesOn === 'PAGEVIEW' && !/hotjar|heatmap|consent|init|ga4|gtag/i.test(tag.name || '')) {
    issues.push({
      type: 'timing_pageview',
      message: 'Tag HTML su PAGEVIEW senza necessità evidente - considerare WINDOW_LOADED'
    });
  }
  
  return issues;
}

// ============================================================================
// 4. FUNZIONE PRINCIPALE DI ANALISI
// ============================================================================

/**
 * Analizza la sicurezza dei tag HTML in un container GTM
 */
export function analyzeHtmlSecurity(containerVersion: {
  tag?: GTMTag[];
  trigger?: GTMTrigger[];
}): HtmlSecurityResult {
  const tags = (containerVersion.tag || []).filter(t => 
    t.type === 'html' || looksLikeCustomTemplate(t)
  );
  
  const triggersById = indexTriggers(containerVersion.trigger || []);
  
  const result = {
    checked: 0,
    critical: 0,
    major: 0,
    minor: 0,
    third_parties: [] as string[],
    details: [] as HtmlSecurityDetail[],
    score: 1
  };
  
  // Analizza ogni tag HTML
  tags.forEach(tag => {
    const code = extractHtmlOrJs(tag);
    if (!code) return;
    
    const issues: HtmlSecurityIssue[] = [];
    
    // Estrai URL e domini terzi
    const urls = extractUrls(code);
    const domains = extractDomains(urls);
    result.third_parties.push(...domains);
    
    // Determina timing
    const firesOn = inferTiming(tag, triggersById);
    
    // Analizza pattern per severità
    issues.push(...analyzeCriticalPatterns(code));
    issues.push(...analyzeMajorPatterns(code));
    issues.push(...analyzeMinorPatterns(code, tag, firesOn));
    
    if (issues.length === 0) return; // Nessun problema trovato
    
    // Determina severità peggiore
    const severity = worstSeverity(issues);
    
    // Aggiorna contatori
    if (severity === 'critical') result.critical++;
    else if (severity === 'major') result.major++;
    else if (severity === 'minor') result.minor++;
    
    result.checked++;
    
    // Genera suggerimento
    const suggestion = generateSuggestion(issues, severity);
    
    // Aggiungi dettaglio
    result.details.push({
      id: tag.tagId || tag.name || 'unknown',
      name: tag.name || 'Unnamed HTML Tag',
      severity,
      issues,
      suggestion,
      fires_on: firesOn,
      paused: tag.paused || false
    });
  });
  
  // Rimuovi duplicati dai domini terzi
  result.third_parties = [...new Set(result.third_parties)];
  
  // Calcola score
  result.score = Math.max(0, 1 - (
    result.critical * HTML_SECURITY_WEIGHTS.critical +
    result.major * HTML_SECURITY_WEIGHTS.major +
    result.minor * HTML_SECURITY_WEIGHTS.minor
  ) / Math.max(result.checked, 1));
  
  // Genera messaggio per UI
  const message = generateHtmlMessage(result);
  
  // Calcola impatto
  const impact = {
    weight: 0.10, // 10% del punteggio totale
    contribution: result.score * 0.10
  };
  
  return {
    html_security: result,
    message,
    impact
  };
}

/**
 * Genera suggerimenti basati sugli issues trovati
 */
function generateSuggestion(issues: HtmlSecurityIssue[], severity: string): string {
  const suggestions: string[] = [];
  
  if (issues.some(i => i.type === 'eval' || i.type === 'new_function')) {
    suggestions.push('Rimuovi eval() e new Function(); usa API DOM sicure');
  }
  
  if (issues.some(i => i.type === 'document_write')) {
    suggestions.push('Sostituisci document.write() con createElement/appendChild');
  }
  
  if (issues.some(i => i.type === 'innerHTML_injection' || i.type === 'insertAdjacentHTML')) {
    suggestions.push('Sanitizza il contenuto prima di inserirlo nel DOM');
  }
  
  if (issues.some(i => i.type === 'insecure_request')) {
    suggestions.push('Forza HTTPS per tutte le richieste esterne');
  }
  
  if (issues.some(i => i.type === 'possible_pii')) {
    suggestions.push('Cripta i dati sensibili prima dell\'invio');
  }
  
  if (issues.some(i => i.type === 'tight_interval')) {
    suggestions.push('Aumenta l\'intervallo di setInterval a >= 1000ms');
  }
  
  if (issues.some(i => i.type === 'broad_click_handler')) {
    suggestions.push('Limita l\'event delegation a elementi specifici');
  }
  
  if (issues.some(i => i.type === 'no_try_catch')) {
    suggestions.push('Aggiungi try/catch intorno ai blocchi di codice');
  }
  
  if (issues.some(i => i.type === 'no_idempotency_guard')) {
    suggestions.push('Aggiungi guardia idempotenza: if (window.__tag_loaded) return;');
  }
  
  if (issues.some(i => i.type === 'postMessage_star')) {
    suggestions.push('Specifica il dominio atteso in postMessage');
  }
  
  if (issues.some(i => i.type === 'timing_pageview')) {
    suggestions.push('Considera di spostare il tag su WINDOW_LOADED');
  }
  
  return suggestions.length > 0 ? suggestions.join('; ') : 'Rivedi la configurazione del tag';
}

/**
 * Genera il messaggio per l'interfaccia utente
 */
function generateHtmlMessage(result: any): HtmlSecurityResult['message'] {
  const { checked, critical, major, minor } = result;
  
  let status: 'critical' | 'major' | 'minor' | 'ok';
  if (critical > 0) {
    status = 'critical';
  } else if (major > 0) {
    status = 'major';
  } else if (minor > 0) {
    status = 'minor';
  } else {
    status = 'ok';
  }
  
  const summary = `${checked} tag HTML · ${critical} critici · ${major} maggiori · ${minor} minori`;
  const cta = 'Rivedi tag HTML';
  
  return {
    title: 'Sicurezza Custom HTML',
    status,
    summary,
    cta
  };
}

// ============================================================================
// 5. FUNZIONI UTILITY PER LA DASHBOARD
// ============================================================================

/**
 * Ottiene informazioni per la visualizzazione di una metrica HTML security
 */
export function getHtmlSecurityMetricInfo(severity: 'critical' | 'major' | 'minor' | 'ok') {
  const metricInfo = {
    critical: {
      icon: "🚨",
      title: "Sicurezza Custom HTML",
      subtitle: "Tag HTML con problemi critici di sicurezza",
      impact: "Tag HTML con vulnerabilità critiche che possono compromettere la sicurezza.",
      risk: "Rischio: code injection, XSS, dati sensibili esposti.",
      priority: "Critica",
      priorityColor: "bg-red-100 text-red-800",
      color: "bg-red-50 dark:bg-red-900/20",
      textColor: "text-red-600 dark:text-red-400"
    },
    major: {
      icon: "⚠️",
      title: "Sicurezza Custom HTML",
      subtitle: "Tag HTML con problemi di sicurezza",
      impact: "Tag HTML con problemi che possono impattare performance e sicurezza.",
      risk: "Rischio: performance degradate, possibili vulnerabilità.",
      priority: "Maggiore",
      priorityColor: "bg-orange-100 text-orange-800",
      color: "bg-orange-50 dark:bg-orange-900/20",
      textColor: "text-orange-600 dark:text-orange-400"
    },
    minor: {
      icon: "ℹ️",
      title: "Sicurezza Custom HTML",
      subtitle: "Tag HTML con piccole ottimizzazioni possibili",
      impact: "Tag HTML configurati correttamente con margini di miglioramento.",
      risk: "Rischio: configurazione buona ma non ottimale.",
      priority: "Bassa",
      priorityColor: "bg-blue-100 text-blue-800",
      color: "bg-blue-50 dark:bg-blue-900/20",
      textColor: "text-blue-600 dark:text-blue-400"
    },
    ok: {
      icon: "✅",
      title: "Sicurezza Custom HTML",
      subtitle: "Tag HTML configurati correttamente",
      impact: "Tutti i tag HTML sono configurati in modo sicuro.",
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
 * Esegue test di accettazione per la funzionalità HTML Security
 */
export function runHtmlSecurityTests(): boolean {
  console.log('🧪 Running HTML Security Tests...');
  
  try {
    // TC1: eval + HTTP → 1 critical
    const tc1Container = {
      tag: [
        {
          tagId: 'tag_1',
          name: 'HTML – Widget Partner',
          type: 'html',
          html: 'eval("some code"); fetch("http://cdn.example.com/lib.js");'
        }
      ],
      trigger: []
    };
    
    const tc1Result = analyzeHtmlSecurity(tc1Container);
    if (tc1Result.html_security.critical !== 1) {
      throw new Error('TC1 failed: Should detect 1 critical issue');
    }
    if (!tc1Result.html_security.third_parties.includes('cdn.example.com')) {
      throw new Error('TC1 failed: Should include cdn.example.com in third parties');
    }
    console.log('✅ TC1 passed: eval + HTTP detected');
    
    // TC2: setInterval(200) + no try/catch → major + minor
    const tc2Container = {
      tag: [
        {
          tagId: 'tag_2',
          name: 'HTML – AB Test',
          type: 'html',
          html: 'setInterval(function() { console.log("test"); }, 200);'
        }
      ],
      trigger: []
    };
    
    const tc2Result = analyzeHtmlSecurity(tc2Container);
    if (tc2Result.html_security.major !== 1) {
      throw new Error('TC2 failed: Should detect 1 major issue');
    }
    console.log('✅ TC2 passed: tight interval detected');
    
    // TC3: postMessage('*') → minor
    const tc3Container = {
      tag: [
        {
          tagId: 'tag_3',
          name: 'HTML – PostMessage',
          type: 'html',
          html: 'window.postMessage(data, "*");'
        }
      ],
      trigger: []
    };
    
    const tc3Result = analyzeHtmlSecurity(tc3Container);
    if (tc3Result.html_security.minor !== 1) {
      throw new Error('TC3 failed: Should detect 1 minor issue');
    }
    console.log('✅ TC3 passed: postMessage star detected');
    
    // TC4: HTML su PAGEVIEW non necessario → minor timing
    const tc4Container = {
      tag: [
        {
          tagId: 'tag_4',
          name: 'HTML – Custom Widget',
          type: 'html',
          html: 'console.log("custom widget");',
          firingTriggerId: ['trg_1']
        }
      ],
      trigger: [
        {
          triggerId: 'trg_1',
          name: 'All Pages',
          type: 'PAGEVIEW'
        }
      ]
    };
    
    const tc4Result = analyzeHtmlSecurity(tc4Container);
    if (tc4Result.html_security.minor !== 1) {
      throw new Error('TC4 failed: Should detect 1 minor timing issue');
    }
    console.log('✅ TC4 passed: PAGEVIEW timing issue detected');
    
    // TC5: Nessun tag HTML → checked=0, score=1
    const tc5Container = {
      tag: [
        {
          tagId: 'tag_5',
          name: 'GA4 Config',
          type: 'gaawc'
        }
      ],
      trigger: []
    };
    
    const tc5Result = analyzeHtmlSecurity(tc5Container);
    if (tc5Result.html_security.checked !== 0) {
      throw new Error('TC5 failed: Should have 0 checked HTML tags');
    }
    if (tc5Result.html_security.score !== 1) {
      throw new Error('TC5 failed: Should have score 1 with no HTML tags');
    }
    console.log('✅ TC5 passed: No HTML tags handled correctly');
    
    console.log('🎉 All HTML Security tests passed!');
    return true;
    
  } catch (error) {
    console.error('❌ HTML Security tests failed:', error);
    return false;
  }
}
