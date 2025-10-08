import React from 'react';
import IntegratedReport from './IntegratedReport';

interface ScenarioResult {
  latestConsent: {
    ad_user_data: string;
    ad_personalization: string;
    ad_storage: string;
    analytics_storage: string;
    functionality_storage: string;
    security_storage: string;
  };
  cookies: Array<{
    name: string;
    domain: string;
    expires: number;
  }>;
  gaAdsRequests: Array<{
    url: string;
    ts: number;
    frameUrl?: string;
    resourceType?: string;
    method?: string;
  }>;
  gtagCalls: any[];
  dataLayer: any[];
  llmTestResult?: boolean; // Risultato del test LLM (true = passato, false = fallito)
  llmServiceAvailable?: boolean; // Indica se il servizio LLM era disponibile durante il test
  artifacts: {
    screenshotPath?: string;
    screenshotDataUrl?: string;
    cookieBannerScreenshotPath?: string;
    tracePath?: string;
  };
  warnings?: string[];
  skipped?: boolean;
}

interface ConsentTestResult {
  engine: string;
  url: string;
  generatedAt: string;
  summary: {
    pass: boolean;
    notes: string[];
  };
  results: {
    reject: ScenarioResult;
    accept: ScenarioResult;
    [key: string]: ScenarioResult;
  };
  env: {
    userAgent: string;
    locale: string;
    region: string;
  };
}

interface ConsentReportWrapperProps {
  result: ConsentTestResult;
  activeTab: string;
}

const ConsentReportWrapper: React.FC<ConsentReportWrapperProps> = ({ result, activeTab }) => {
  // DEBUG: Stampa TUTTI i dati ricevuti dal backend
  console.log('🔍 DEBUG COMPLETO - Tutti i dati ricevuti dal backend:', JSON.stringify(result, null, 2));
  
  // Converte i dati dal formato attuale al formato della nuova dashboard
  const convertToDashboardFormat = () => {
    // Verifica che result e result.results esistano
    if (!result || !result.results) {
      console.error('❌ Dati mancanti: result o result.results sono undefined', { result, activeTab });
      return null;
    }
    
    const activeScenario = result.results[activeTab];
    if (!activeScenario) {
      console.error('❌ Scenario non trovato:', { activeTab, availableResults: Object.keys(result.results) });
      return null;
    }

    // Determina se è uno scenario custom (ora sempre false)
    const isCustomScenario = false;
    
    // Crea gli scenari per la dashboard
    const scenarios: Array<{
      name: string;
      status: 'PASS' | 'FAIL';
      description: string;
      weight: number;
      score: number;
      issues?: string[];
    }> = [];
    
    // Aggiungi scenario reject
    if (result.results.reject) {
      const rejectData = result.results.reject;
      
      // DEBUG: Stampa TUTTI i dati del scenario REJECT
      console.log('🔍 DEBUG REJECT COMPLETO - Tutti i dati del scenario reject:', JSON.stringify(rejectData, null, 2));
      
      // DEBUG: Log completo per verificare i dati ricevuti
      console.log('🔍 DEBUG REJECT - Dati completi:', {
        llmTestResult: rejectData.llmTestResult,
        llmServiceAvailable: rejectData.llmServiceAvailable,
        typeof: typeof rejectData.llmTestResult,
        latestConsent: rejectData.latestConsent,
        cookies: rejectData.cookies?.length || 0,
        gaAdsRequests: rejectData.gaAdsRequests?.length || 0
      });
      
      // DEBUG: Verifica se llmTestResult è presente
      console.log('🔍 DEBUG REJECT - llmTestResult check:', {
        isUndefined: rejectData.llmTestResult === undefined,
        isNull: rejectData.llmTestResult === null,
        isBoolean: typeof rejectData.llmTestResult === 'boolean',
        value: rejectData.llmTestResult
      });
      
      // PRIORITÀ: Usa sempre il risultato LLM se disponibile
      if (rejectData.llmTestResult !== undefined && rejectData.llmTestResult !== null) {
        const passed = rejectData.llmTestResult;
        console.log('🔍 DEBUG REJECT - ✅ Usando logica LLM, passed:', passed);
        scenarios.push({
          name: "Reject All",
          status: passed ? 'PASS' as const : 'FAIL' as const,
          weight: 0.7,
          score: passed ? 100 : 0,
          issues: passed ? [] : ['Il test LLM ha rilevato che i consensi non sono stati rifiutati correttamente'],
          description: passed 
            ? "✅ Il test LLM ha confermato che i consensi sono stati rifiutati correttamente. Analytics e security storage granted sono considerati normali."
            : "❌ Il test LLM ha rilevato che i consensi non sono stati rifiutati correttamente dopo il click sul banner."
        });
      } else {
        const llmUnavailable = rejectData.llmServiceAvailable === false;
        console.log('🔍 DEBUG REJECT - ⚠️ llmTestResult non disponibile, usando logica migliorata', {
          llmUnavailable,
          llmServiceAvailable: rejectData.llmServiceAvailable
        });
        
        // Logica migliorata: analizza il consent state invece di solo cookie/richieste
        const consentState = rejectData.latestConsent;
        const issues: string[] = [];
        
        // Verifica se i consensi sono stati rifiutati correttamente
        if (consentState.ad_storage === 'granted') {
          issues.push('ad_storage è ancora granted dopo il rifiuto');
        }
        if (consentState.ad_user_data === 'granted') {
          issues.push('ad_user_data è ancora granted dopo il rifiuto');
        }
        if (consentState.ad_personalization === 'granted') {
          issues.push('ad_personalization è ancora granted dopo il rifiuto');
        }
        
        // Analytics e security storage possono essere granted (normale)
        const hasIssues = issues.length > 0;
        scenarios.push({
          name: "Reject All",
          status: hasIssues ? 'FAIL' as const : 'PASS' as const,
          weight: 0.7,
          score: hasIssues ? 0 : 100,
          issues,
          description: hasIssues 
            ? `❌ Problemi rilevati: ${issues.join(', ')}${llmUnavailable ? ' (Test LLM non disponibile)' : ''}`
            : `✅ I consensi di marketing sono stati correttamente rifiutati. Analytics e security storage granted sono normali.${llmUnavailable ? ' (Test LLM non disponibile)' : ''}`
        });
      }
    }
    
    // Aggiungi scenario accept
    if (result.results.accept) {
      const acceptData = result.results.accept;
      
      // DEBUG: Stampa TUTTI i dati del scenario ACCEPT
      console.log('🔍 DEBUG ACCEPT COMPLETO - Tutti i dati del scenario accept:', JSON.stringify(acceptData, null, 2));
      
      // DEBUG: Log completo per verificare i dati ricevuti
      console.log('🔍 DEBUG ACCEPT - Dati completi:', {
        llmTestResult: acceptData.llmTestResult,
        llmServiceAvailable: acceptData.llmServiceAvailable,
        typeof: typeof acceptData.llmTestResult,
        latestConsent: acceptData.latestConsent,
        cookies: acceptData.cookies?.length || 0,
        gaAdsRequests: acceptData.gaAdsRequests?.length || 0
      });
      
      // PRIORITÀ: Usa sempre il risultato LLM se disponibile
      if (acceptData.llmTestResult !== undefined && acceptData.llmTestResult !== null) {
        const passed = acceptData.llmTestResult;
        console.log('🔍 DEBUG ACCEPT - ✅ Usando logica LLM, passed:', passed);
        scenarios.push({
          name: "Accept All",
          status: passed ? 'PASS' as const : 'FAIL' as const,
          weight: 0.1,
          score: passed ? 100 : 0,
          issues: passed ? [] : ['Il test LLM ha rilevato che i consensi non sono stati accettati correttamente'],
          description: passed 
            ? "✅ Il test LLM ha confermato che i consensi sono stati accettati correttamente. Tutti i consensi risultano granted."
            : "❌ Il test LLM ha rilevato che i consensi non sono stati accettati correttamente dopo il click sul banner."
        });
      } else {
        const llmUnavailable = acceptData.llmServiceAvailable === false;
        console.log('🔍 DEBUG ACCEPT - ⚠️ llmTestResult non disponibile, usando logica migliorata', {
          llmUnavailable,
          llmServiceAvailable: acceptData.llmServiceAvailable
        });
        
        // Logica migliorata: analizza il consent state per determinare se l'accettazione è avvenuta
        const consentState = acceptData.latestConsent;
        const issues: string[] = [];
        
        // Verifica se i consensi sono stati accettati correttamente
        if (consentState.ad_storage !== 'granted') {
          issues.push('ad_storage non è granted dopo l\'accettazione');
        }
        if (consentState.ad_user_data !== 'granted') {
          issues.push('ad_user_data non è granted dopo l\'accettazione');
        }
        if (consentState.ad_personalization !== 'granted') {
          issues.push('ad_personalization non è granted dopo l\'accettazione');
        }
        if (consentState.analytics_storage !== 'granted') {
          issues.push('analytics_storage non è granted dopo l\'accettazione');
        }
        
        const hasIssues = issues.length > 0;
        scenarios.push({
          name: "Accept All",
          status: hasIssues ? 'FAIL' as const : 'PASS' as const,
          weight: 0.1,
          score: hasIssues ? Math.max(0, 100 - (issues.length * 25)) : 100,
          issues,
          description: hasIssues
            ? `❌ Problemi rilevati: ${issues.join(', ')}${llmUnavailable ? ' (Test LLM non disponibile)' : ''}`
            : `✅ Tutti i consensi sono stati correttamente accettati e attivati.${llmUnavailable ? ' (Test LLM non disponibile)' : ''}`
        });
      }
    }
    

    // Converte i cookie
    const cookies = (activeScenario.cookies || []).map(cookie => ({
      name: cookie.name,
      domain: cookie.domain,
      category: determineCookieCategory(cookie.name, cookie.domain),
      purpose: getCookiePurpose(cookie.name),
      sensitive: isSensitiveCookie(cookie.name)
    }));

    // Converte le richieste di rete
    const networkRequests = (activeScenario.gaAdsRequests || []).map(request => ({
      url: request.url,
      domain: new URL(request.url).hostname,
      timestamp: request.ts,
      category: determineRequestCategory(request.url),
      blocked: false, // Per ora assumiamo che se sono nella lista, sono state permesse
      frameUrl: request.frameUrl,
      resourceType: request.resourceType,
      method: request.method
    }));

    // Crea le raccomandazioni
    const recommendations = generateRecommendations(activeScenario, result.summary);

    const totalWeight = scenarios.reduce((acc, scenario) => acc + scenario.weight, 0) || 1;
    const weightedScore = Math.round(
      scenarios.reduce((sum, scenario) => sum + (scenario.score * scenario.weight), 0) / totalWeight
    );

    return {
      siteName: new URL(result.url).hostname,
      testDate: result.generatedAt,
      scenarios,
      googleConsent: {
        analytics_storage: activeScenario.latestConsent.analytics_storage as 'granted' | 'denied',
        ad_storage: activeScenario.latestConsent.ad_storage as 'granted' | 'denied',
        ad_user_data: activeScenario.latestConsent.ad_user_data as 'granted' | 'denied',
        ad_personalization: activeScenario.latestConsent.ad_personalization as 'granted' | 'denied',
        functionality_storage: 'granted' as const, // Cookie necessari - sempre granted
        personalization_storage: activeScenario.latestConsent.ad_personalization as 'granted' | 'denied', // Mappa da ad_personalization
        security_storage: 'granted' as const // Cookie di sicurezza - sempre granted
      },
      cookies,
      networkRequests,
      recommendations,
      weightedScore,
      scenarioIssues: scenarios
        .filter(s => s.status === 'FAIL' && s.issues && s.issues.length > 0)
        .map(s => ({ name: s.name, issues: s.issues! }))
    };
  };

  // Funzioni helper
  const determineCookieCategory = (name: string, domain: string): 'necessary' | 'analytics' | 'marketing' | 'preferences' => {
    const nameLower = name.toLowerCase();
    if (nameLower.includes('_ga') || nameLower.includes('_gid') || nameLower.includes('analytics')) {
      return 'analytics';
    }
    if (nameLower.includes('_fbp') || nameLower.includes('marketing') || nameLower.includes('ads')) {
      return 'marketing';
    }
    if (nameLower.includes('preference') || nameLower.includes('consent')) {
      return 'preferences';
    }
    return 'necessary';
  };

  const getCookiePurpose = (name: string): string => {
    const nameLower = name.toLowerCase();
    if (nameLower.includes('_ga')) return 'Cookie di Google Analytics per tracciare le visite e il comportamento degli utenti';
    if (nameLower.includes('_gid')) return 'Cookie di Google Analytics per identificare utenti unici';
    if (nameLower.includes('_fbp')) return 'Cookie di Facebook per il pixel di tracciamento e remarketing';
    if (nameLower.includes('session')) return 'Cookie di sessione per mantenere lo stato di login dell\'utente';
    if (nameLower.includes('consent')) return 'Cookie per memorizzare le preferenze di consenso dell\'utente';
    return 'Cookie per funzionalità del sito';
  };

  const isSensitiveCookie = (name: string): boolean => {
    const nameLower = name.toLowerCase();
    return nameLower.includes('_fbp') || 
           nameLower.includes('marketing') || 
           nameLower.includes('ads') ||
           nameLower.includes('tracking');
  };

  const determineRequestCategory = (url: string): 'analytics' | 'ads' | 'marketing' | 'other' => {
    const urlLower = url.toLowerCase();
    if (urlLower.includes('google-analytics.com') || urlLower.includes('googletagmanager.com')) {
      return 'analytics';
    }
    if (urlLower.includes('doubleclick.net') || urlLower.includes('googleadservices.com')) {
      return 'ads';
    }
    if (urlLower.includes('facebook.com') || urlLower.includes('snapchat.com') || urlLower.includes('tiktok.com')) {
      return 'marketing';
    }
    return 'other';
  };

  const generateRecommendations = (scenario: ScenarioResult, summary: any): string[] => {
    const recommendations = [];
    
    if (scenario.latestConsent.analytics_storage === 'granted') {
      recommendations.push('Il sito rispetta correttamente il consenso per i cookie di analytics, permettendo il tracciamento delle visite quando autorizzato.');
    }
    
    if (scenario.latestConsent.ad_storage === 'denied' && (scenario.gaAdsRequests || []).length === 0) {
      recommendations.push('Le richieste pubblicitarie sono state correttamente bloccate quando l\'utente ha rifiutato il consenso marketing.');
    }
    
    if ((scenario.cookies || []).length > 0) {
      const sensitiveCookies = (scenario.cookies || []).filter(cookie => isSensitiveCookie(cookie.name));
      if (sensitiveCookies.length > 0) {
        recommendations.push(`Si consiglia di verificare la configurazione del pixel per assicurarsi che non venga caricato quando il consenso marketing è negato.`);
      }
    }
    
    if (summary.pass) {
      recommendations.push('Il sito rispetta correttamente le preferenze di consenso dell\'utente. I cookie e le richieste di rete sono gestiti secondo le impostazioni selezionate.');
    } else {
      recommendations.push('Sono stati rilevati problemi nella gestione del consenso. Alcune richieste o cookie potrebbero non rispettare le preferenze dell\'utente.');
    }
    
    recommendations.push('Monitorare regolarmente i cookie di terze parti per assicurarsi che rispettino le preferenze di consenso dell\'utente.');
    recommendations.push('Implementare controlli più rigorosi per i cookie di marketing per garantire la piena compliance.');
    
    return recommendations;
  };

  const dashboardData = convertToDashboardFormat();
  
  if (!dashboardData) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <p className="text-gray-500">Nessun dato disponibile per lo scenario selezionato.</p>
      </div>
    );
  }

  // Prepara i dati tecnici per il nuovo componente
  const technicalData = {
    scenarios: Object.entries(result.results).map(([key, scenarioData]) => ({
      name: key === 'reject' ? 'Reject All' : key === 'accept' ? 'Accept All' : key,
      data: {
        cookies: scenarioData.cookies || [],
        gaAdsRequests: scenarioData.gaAdsRequests || [],
        gtagCalls: scenarioData.gtagCalls || [],
        dataLayer: scenarioData.dataLayer || [],
        latestConsent: scenarioData.latestConsent || {},
        artifacts: scenarioData.artifacts || {}
      }
    }))
  };

  return <IntegratedReport result={result} activeTab={activeTab} />;
};

export default ConsentReportWrapper;
