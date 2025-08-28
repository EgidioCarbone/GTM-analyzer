/**
 * Consent Mode Coverage Analysis Service
 * 
 * Analizza il JSON export di Google Tag Manager e valuta la copertura del Consent Mode v2
 * per i tag marketing. Identifica tag soggetti a consenso, verifica la presenza e
 * correttezza dei consensi, e produce un esito strutturato per la dashboard.
 */

import { GTMTag, GTMTrigger, GTMVariable } from "../types/gtm";

// ============================================================================
// 1. TIPI E INTERFACCE
// ============================================================================

export interface ConsentCoverage {
  checked: number;                // quanti tag marketing controllati
  ok: number;                     // quanti con mapping completo
  missing: number;                // quanti con uno o più consensi mancanti
  not_configured: number;         // quanti senza qualunque impostazione di consent
  details: ConsentTagDetail[];
  score: number;                  // 0..1
}

export interface ConsentTagDetail {
  id: string;
  name: string;
  type: string;
  required: string[];
  present: string[];
  missing: string[];
  severity: 'critical' | 'major' | 'minor' | 'ok';
  paused?: boolean;
  inferred?: boolean;
}

export interface ConsentModeResult {
  consent_coverage: ConsentCoverage;
  message: {
    title: string;
    status: 'critical' | 'major' | 'ok';
    summary: string;
    cta: string;
  };
  impact: {
    weight: number;
    contribution: number;
  };
}

// ============================================================================
// 2. CONFIGURAZIONE E MAPPING
// ============================================================================

// Tipi GTM da considerare come marketing
const MARKETING_TAG_TYPES = {
  // Google Analytics
  'gaawe': { required: ['analytics_storage'], vendor: 'Google Analytics' },
  'gaawc': { required: ['analytics_storage'], vendor: 'Google Analytics' },
  'gtag': { required: ['analytics_storage'], vendor: 'Google Analytics' },
  
  // Google Ads
  'awct': { required: ['ad_storage', 'ad_user_data', 'ad_personalization'], vendor: 'Google Ads' },
  'awctc': { required: ['ad_storage', 'ad_user_data', 'ad_personalization'], vendor: 'Google Ads' },
  'aw_remarketing': { required: ['ad_storage', 'ad_user_data', 'ad_personalization'], vendor: 'Google Ads' },
  'aw_conversion': { required: ['ad_storage', 'ad_user_data', 'ad_personalization'], vendor: 'Google Ads' },
  
  // Floodlight
  'dc_': { required: ['ad_storage', 'ad_user_data', 'ad_personalization'], vendor: 'Floodlight' },
  'g_doubleclick_': { required: ['ad_storage', 'ad_user_data', 'ad_personalization'], vendor: 'Floodlight' },
  
  // Meta
  'facebook_': { required: ['ad_storage', 'ad_user_data', 'ad_personalization'], vendor: 'Meta' },
  'meta_': { required: ['ad_storage', 'ad_user_data', 'ad_personalization'], vendor: 'Meta' },
  
  // LinkedIn
  'linkedin_': { required: ['ad_storage', 'ad_user_data', 'ad_personalization'], vendor: 'LinkedIn' },
  
  // Bing/Microsoft
  'bing_': { required: ['ad_storage', 'ad_user_data', 'ad_personalization'], vendor: 'Bing' },
  'msclkid_': { required: ['ad_storage', 'ad_user_data', 'ad_personalization'], vendor: 'Bing' },
  
  // TikTok
  'tiktok_': { required: ['ad_storage', 'ad_user_data', 'ad_personalization'], vendor: 'TikTok' },
  'ttq_': { required: ['ad_storage', 'ad_user_data', 'ad_personalization'], vendor: 'TikTok' },
  
  // Altri marketing tools
  'hotjar_': { required: ['analytics_storage'], vendor: 'Hotjar' },
  'optimize_': { required: ['analytics_storage'], vendor: 'Google Optimize' },
  'vwo_': { required: ['analytics_storage'], vendor: 'VWO' }
};

// Regex per identificare marketing tags in Custom HTML
const MARKETING_HTML_PATTERNS = [
  /connect\.facebook\.net/i,
  /www\.googletagmanager\.com\/gtag\/js.*config.*ads/i,
  /googleads\.g\.doubleclick\.net/i,
  /fls\.doubleclick\.net/i,
  /bat\.bing\.com/i,
  /snap\.sc/i,
  /static\.hotjar\.com/i,
  /analytics\.tiktok\.com/i,
  /px\.ads\.linkedin\.com/i
];

// ============================================================================
// 3. FUNZIONI DI IDENTIFICAZIONE TAG MARKETING
// ============================================================================

/**
 * Determina se un tag è di tipo marketing
 */
function isMarketingTag(tag: GTMTag): boolean {
  const tagType = tag.type?.toLowerCase() || '';
  const tagName = tag.name?.toLowerCase() || '';
  
  // Controlla tipi esatti
  if (MARKETING_TAG_TYPES[tagType as keyof typeof MARKETING_TAG_TYPES]) {
    return true;
  }
  
  // Controlla prefissi nei tipi
  for (const [prefix, config] of Object.entries(MARKETING_TAG_TYPES)) {
    if (prefix.endsWith('_') && tagType.startsWith(prefix)) {
      return true;
    }
  }
  
  // Controlla Custom HTML per pattern marketing
  if (tagType === 'html' && tag.html) {
    return MARKETING_HTML_PATTERNS.some(pattern => pattern.test(tag.html));
  }
  
  // Fallback: controlla il nome del tag per keyword marketing
  const marketingKeywords = [
    'facebook', 'meta', 'pixel', 'google ads', 'ads', 'remarketing',
    'conversion', 'floodlight', 'linkedin', 'bing', 'tiktok', 'hotjar',
    'optimize', 'vwo', 'analytics', 'gtag', 'ga4'
  ];
  
  return marketingKeywords.some(keyword => 
    tagName.includes(keyword) || tagType.includes(keyword)
  );
}

/**
 * Determina i consensi richiesti per un tag marketing
 */
function getRequiredConsents(tag: GTMTag): string[] {
  const tagType = tag.type?.toLowerCase() || '';
  
  // Controlla tipi esatti
  const exactMatch = MARKETING_TAG_TYPES[tagType as keyof typeof MARKETING_TAG_TYPES];
  if (exactMatch) {
    return [...exactMatch.required];
  }
  
  // Controlla prefissi nei tipi
  for (const [prefix, config] of Object.entries(MARKETING_TAG_TYPES)) {
    if (prefix.endsWith('_') && tagType.startsWith(prefix)) {
      return [...config.required];
    }
  }
  
  // Per Custom HTML, determina in base al contenuto
  if (tagType === 'html' && tag.html) {
    if (MARKETING_HTML_PATTERNS.some(pattern => pattern.test(tag.html))) {
      // Se contiene pattern di advertising, richiede consensi ad
      if (tag.html.includes('googleads') || tag.html.includes('facebook') || 
          tag.html.includes('doubleclick') || tag.html.includes('bing')) {
        return ['ad_storage', 'ad_user_data', 'ad_personalization'];
      }
      // Altrimenti solo analytics
      return ['analytics_storage'];
    }
  }
  
  // Default per GA4
  if (tagType.includes('ga4') || tagType.includes('gtag') || tagType.includes('gaawe')) {
    return ['analytics_storage'];
  }
  
  // Default per advertising
  return ['ad_storage', 'ad_user_data', 'ad_personalization'];
}

// ============================================================================
// 4. ESTRAZIONE CONSENSI DAI TAG
// ============================================================================

/**
 * Estrae i consensi configurati da un tag
 */
function extractConsentFromTag(tag: GTMTag): { present: string[]; inferred: boolean } {
  const present: string[] = [];
  let inferred = false;
  
  // 1. Controlla consentSettings diretto
  if (tag.consentSettings) {
    const consentSettings = tag.consentSettings;
    
    // Formato oggetto
    if (typeof consentSettings === 'object') {
      if (consentSettings.consentType) {
        present.push(consentSettings.consentType);
      }
      if (consentSettings.consentRequired) {
        present.push(consentSettings.consentRequired);
      }
    }
  }
  
  // 2. Controlla parametri del tag
  if (tag.parameter) {
    const consentParams = [
      'consentSettings',
      'consent_type',
      'ad_storage',
      'analytics_storage',
      'ad_user_data',
      'ad_personalization'
    ];
    
    for (const param of tag.parameter) {
      if (consentParams.includes(param.key)) {
        const value = param.value;
        
        // Se è un boolean true o string "true", aggiungi il consenso
        if (value === true || value === 'true' || value === '1') {
          if (param.key === 'ad_storage') present.push('ad_storage');
          if (param.key === 'analytics_storage') present.push('analytics_storage');
          if (param.key === 'ad_user_data') present.push('ad_user_data');
          if (param.key === 'ad_personalization') present.push('ad_personalization');
        }
        
        // Se è un oggetto consentSettings
        if (param.key === 'consentSettings' && typeof value === 'object') {
          if (value.consentType) present.push(value.consentType);
          if (value.consentRequired) present.push(value.consentRequired);
        }
      }
    }
  }
  
  // 3. Per GA4, se non trova consensi espliciti, inferisce analytics_storage
  if (present.length === 0 && (tag.type?.includes('ga4') || tag.type?.includes('gtag'))) {
    present.push('analytics_storage');
    inferred = true;
  }
  
  return { present, inferred };
}

// ============================================================================
// 5. VALIDAZIONE E CALCOLO SEVERITÀ
// ============================================================================

/**
 * Determina la severità di un tag in base ai consensi
 */
function calculateSeverity(required: string[], present: string[], inferred: boolean): 'critical' | 'major' | 'minor' | 'ok' {
  // Se tutti i consensi richiesti sono presenti
  if (required.every(consent => present.includes(consent))) {
    return 'ok';
  }
  
  // Se non ci sono consensi configurati
  if (present.length === 0) {
    return 'critical';
  }
  
  // Se mancano consensi critici
  const missing = required.filter(consent => !present.includes(consent));
  if (missing.length > 0) {
    return 'major';
  }
  
  return 'minor';
}

// ============================================================================
// 6. FUNZIONE PRINCIPALE DI ANALISI
// ============================================================================

/**
 * Analizza la copertura del Consent Mode per un container GTM
 */
export function analyzeConsentMode(containerVersion: {
  tag?: GTMTag[];
  trigger?: GTMTrigger[];
  variable?: GTMVariable[];
}): ConsentModeResult {
  const tags = containerVersion.tag || [];
  
  // Filtra solo i tag marketing
  const marketingTags = tags.filter(isMarketingTag);
  
  const result: ConsentCoverage = {
    checked: 0,
    ok: 0,
    missing: 0,
    not_configured: 0,
    details: [],
    score: 0
  };
  
  // Analizza ogni tag marketing
  for (const tag of marketingTags) {
    const required = getRequiredConsents(tag);
    const { present, inferred } = extractConsentFromTag(tag);
    const missing = required.filter(consent => !present.includes(consent));
    const severity = calculateSeverity(required, present, inferred);
    
    // Aggiorna contatori
    result.checked++;
    
    if (severity === 'ok') {
      result.ok++;
    } else if (severity === 'critical') {
      result.not_configured++;
    } else {
      result.missing++;
    }
    
    // Aggiungi dettaglio
    result.details.push({
      id: tag.tagId || tag.name || 'unknown',
      name: tag.name || 'Unnamed Tag',
      type: tag.type || 'unknown',
      required,
      present,
      missing,
      severity,
      paused: tag.paused || false,
      inferred
    });
  }
  
  // Calcola score
  result.score = result.checked === 0 ? 1 : result.ok / result.checked;
  
  // Genera messaggio per UI
  const message = generateConsentMessage(result);
  
  // Calcola impatto sul punteggio complessivo
  const impact = {
    weight: 0.25, // 25% del punteggio totale
    contribution: result.score * 0.25
  };
  
  return {
    consent_coverage: result,
    message,
    impact
  };
}

/**
 * Genera il messaggio per l'interfaccia utente
 */
function generateConsentMessage(coverage: ConsentCoverage): ConsentModeResult['message'] {
  const totalIssues = coverage.missing + coverage.not_configured;
  
  let status: 'critical' | 'major' | 'ok';
  if (coverage.not_configured > 0) {
    status = 'critical';
  } else if (coverage.missing > 0) {
    status = 'major';
  } else {
    status = 'ok';
  }
  
  let summary: string;
  if (coverage.checked === 0) {
    summary = 'Nessun tag marketing rilevato';
  } else {
    summary = `${totalIssues} su ${coverage.checked} tag marketing con mapping incompleto`;
  }
  
  const cta = totalIssues > 0 ? 'Rivedi impostazioni Consent' : 'Consent Mode configurato correttamente';
  
  return {
    title: 'Consent Mode',
    status,
    summary,
    cta
  };
}

// ============================================================================
// 7. FUNZIONI UTILITY PER LA DASHBOARD
// ============================================================================

/**
 * Ottiene informazioni per la visualizzazione di una metrica consent
 */
export function getConsentMetricInfo(severity: 'critical' | 'major' | 'minor' | 'ok') {
  const metricInfo = {
    critical: {
      icon: "🚨",
      title: "Consent Mode",
      subtitle: "Tag marketing senza consensi configurati",
      impact: "Tag marketing senza consensi configurati violano le normative privacy.",
      risk: "Rischio: violazione GDPR/CCPA, multe e problemi legali.",
      priority: "Critica",
      priorityColor: "bg-red-100 text-red-800",
      color: "bg-red-50 dark:bg-red-900/20",
      textColor: "text-red-600 dark:text-red-400"
    },
    major: {
      icon: "⚠️",
      title: "Consent Mode",
      subtitle: "Tag marketing con consensi parziali",
      impact: "Alcuni consensi mancanti possono causare problemi di compliance.",
      risk: "Rischio: consensi parziali, potenziali problemi di privacy.",
      priority: "Maggiore",
      priorityColor: "bg-orange-100 text-orange-800",
      color: "bg-orange-50 dark:bg-orange-900/20",
      textColor: "text-orange-600 dark:text-orange-400"
    },
    minor: {
      icon: "ℹ️",
      title: "Consent Mode",
      subtitle: "Consensi configurati con piccole imperfezioni",
      impact: "Consensi configurati ma con piccole ottimizzazioni possibili.",
      risk: "Rischio: configurazione sub-ottimale.",
      priority: "Bassa",
      priorityColor: "bg-blue-100 text-blue-800",
      color: "bg-blue-50 dark:bg-blue-900/20",
      textColor: "text-blue-600 dark:text-blue-400"
    },
    ok: {
      icon: "✅",
      title: "Consent Mode",
      subtitle: "Consensi configurati correttamente",
      impact: "Tutti i tag marketing hanno i consensi appropriati configurati.",
      risk: "Nessun rischio: compliance completa.",
      priority: "OK",
      priorityColor: "bg-green-100 text-green-800",
      color: "bg-green-50 dark:bg-green-900/20",
      textColor: "text-green-600 dark:text-green-400"
    }
  };
  
  return metricInfo[severity];
}

// ============================================================================
// 8. TEST CASI DI ACCETTAZIONE
// ============================================================================

/**
 * Esegue test di accettazione per la funzionalità Consent Mode
 */
export function runConsentModeTests(): boolean {
  console.log('🧪 Running Consent Mode Tests...');
  
  try {
    // TC1: GA Ads senza mapping
    const tc1Container = {
      tag: [
        {
          tagId: '1',
          name: 'Google Ads Conversion',
          type: 'awct',
          parameter: []
        }
      ]
    };
    
    const tc1Result = analyzeConsentMode(tc1Container);
    if (tc1Result.consent_coverage.not_configured !== 1 || 
        tc1Result.consent_coverage.details[0].severity !== 'critical') {
      throw new Error('TC1 failed: Should detect missing consent for Google Ads');
    }
    console.log('✅ TC1 passed: Google Ads without consent detected');
    
    // TC2: Meta Pixel con solo ad_storage
    const tc2Container = {
      tag: [
        {
          tagId: '2',
          name: 'Meta Pixel',
          type: 'facebook_pixel',
          parameter: [
            { key: 'ad_storage', value: 'true' }
          ]
        }
      ]
    };
    
    const tc2Result = analyzeConsentMode(tc2Container);
    if (tc2Result.consent_coverage.missing !== 1 || 
        tc2Result.consent_coverage.details[0].severity !== 'major') {
      throw new Error('TC2 failed: Should detect partial consent for Meta Pixel');
    }
    console.log('✅ TC2 passed: Meta Pixel with partial consent detected');
    
    // TC3: GA4 Config senza parametri consent
    const tc3Container = {
      tag: [
        {
          tagId: '3',
          name: 'GA4 Config',
          type: 'gaawc',
          parameter: [
            { key: 'measurement_id', value: 'G-XXXXXXXXXX' }
          ]
        }
      ]
    };
    
    const tc3Result = analyzeConsentMode(tc3Container);
    if (tc3Result.consent_coverage.details[0].severity !== 'ok' || 
        !tc3Result.consent_coverage.details[0].inferred) {
      throw new Error('TC3 failed: Should infer analytics_storage for GA4');
    }
    console.log('✅ TC3 passed: GA4 consent inferred correctly');
    
    // TC4: Tutti ok
    const tc4Container = {
      tag: [
        {
          tagId: '4',
          name: 'Google Ads Complete',
          type: 'awct',
          parameter: [
            { key: 'ad_storage', value: 'true' },
            { key: 'ad_user_data', value: 'true' },
            { key: 'ad_personalization', value: 'true' }
          ]
        }
      ]
    };
    
    const tc4Result = analyzeConsentMode(tc4Container);
    if (tc4Result.consent_coverage.ok !== 1 || 
        tc4Result.consent_coverage.score !== 1) {
      throw new Error('TC4 failed: Should detect complete consent configuration');
    }
    console.log('✅ TC4 passed: Complete consent configuration detected');
    
    // TC5: Nessun tag marketing
    const tc5Container = {
      tag: [
        {
          tagId: '5',
          name: 'Custom HTML',
          type: 'html',
          html: '<script>console.log("test");</script>'
        }
      ]
    };
    
    const tc5Result = analyzeConsentMode(tc5Container);
    if (tc5Result.consent_coverage.checked !== 0 || 
        tc5Result.consent_coverage.score !== 1) {
      throw new Error('TC5 failed: Should handle no marketing tags correctly');
    }
    console.log('✅ TC5 passed: No marketing tags handled correctly');
    
    console.log('🎉 All Consent Mode tests passed!');
    return true;
    
  } catch (error) {
    console.error('❌ Consent Mode tests failed:', error);
    return false;
  }
}
