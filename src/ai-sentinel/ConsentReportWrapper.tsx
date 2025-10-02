import React from 'react';
import IntegratedReport from './IntegratedReport';

interface ScenarioResult {
  latestConsent: {
    ad_user_data: string;
    ad_personalization: string;
    ad_storage: string;
    analytics_storage: string;
  };
  cookies: Array<{
    name: string;
    domain: string;
    expires: number;
  }>;
  gaAdsRequests: Array<{
    url: string;
    ts: number;
  }>;
  gtagCalls: any[];
  dataLayer: any[];
  artifacts: {
    screenshotPath?: string;
    tracePath?: string;
  };
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
  customScenarios?: Array<{
    name: string;
    analytics: boolean;
    marketing: boolean;
    preferences: boolean;
  }>;
}

const ConsentReportWrapper: React.FC<ConsentReportWrapperProps> = ({ result, activeTab, customScenarios }) => {
  // Converte i dati dal formato attuale al formato della nuova dashboard
  const convertToDashboardFormat = () => {
    const activeScenario = result.results[activeTab];
    if (!activeScenario) return null;

    // Determina se è uno scenario custom
    const isCustomScenario = activeTab.includes('custom') || activeTab.includes('analysis');
    
    // Crea gli scenari per la dashboard
    const scenarios = [];
    
    // Aggiungi scenario reject
    if (result.results.reject) {
      const rejectData = result.results.reject;
      const hasIssues = rejectData.cookies.length > 0 || rejectData.gaAdsRequests.length > 0;
      scenarios.push({
        name: "Reject All",
        status: hasIssues ? 'FAIL' as const : 'PASS' as const,
        description: hasIssues 
          ? "Sono stati rilevati cookie o richieste non necessarie nonostante il rifiuto del consenso."
          : "Tutti i cookie non necessari vengono bloccati correttamente. Il sito rispetta completamente le preferenze dell'utente."
      });
    }
    
    // Aggiungi scenario accept
    if (result.results.accept) {
      const acceptData = result.results.accept;
      const hasIssues = acceptData.cookies.length > 0 || acceptData.gaAdsRequests.length > 0;
      scenarios.push({
        name: "Accept All",
        status: hasIssues ? 'FAIL' as const : 'PASS' as const,
        description: hasIssues
          ? "Problemi rilevati nel processo di accettazione dei cookie."
          : "Tutti i cookie vengono accettati e caricati come previsto. Nessun problema rilevato nel processo di accettazione."
      });
    }
    
    // Aggiungi scenario custom se presente
    if (isCustomScenario) {
      const customData = activeScenario;
      const hasIssues = customData.cookies.length > 0 || customData.gaAdsRequests.length > 0;
      
      // Determina la configurazione custom dal nome dello scenario
      const analytics = activeTab.includes('analyticstrue') || activeTab.includes('analytics: true');
      const marketing = activeTab.includes('marketingtrue') || activeTab.includes('marketing: true');
      const preferences = activeTab.includes('preferencestrue') || activeTab.includes('preferences: true');
      
      scenarios.push({
        name: `Custom (Analytics ${analytics ? 'ON' : 'OFF'}, Marketing ${marketing ? 'ON' : 'OFF'})`,
        status: hasIssues ? 'FAIL' as const : 'PASS' as const,
        description: hasIssues
          ? "Cookie di marketing ancora attivi nonostante il rifiuto esplicito. Si consiglia di verificare la configurazione del CMP."
          : "La configurazione personalizzata funziona correttamente. I cookie vengono gestiti secondo le preferenze specificate."
      });
    }

    // Converte i cookie
    const cookies = activeScenario.cookies.map(cookie => ({
      name: cookie.name,
      domain: cookie.domain,
      category: determineCookieCategory(cookie.name, cookie.domain),
      purpose: getCookiePurpose(cookie.name),
      sensitive: isSensitiveCookie(cookie.name)
    }));

    // Converte le richieste di rete
    const networkRequests = activeScenario.gaAdsRequests.map(request => ({
      url: request.url,
      domain: new URL(request.url).hostname,
      timestamp: request.ts,
      category: determineRequestCategory(request.url),
      blocked: false // Per ora assumiamo che se sono nella lista, sono state permesse
    }));

    // Crea le raccomandazioni
    const recommendations = generateRecommendations(activeScenario, result.summary);

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
      recommendations
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
    
    if (scenario.latestConsent.ad_storage === 'denied' && scenario.gaAdsRequests.length === 0) {
      recommendations.push('Le richieste pubblicitarie sono state correttamente bloccate quando l\'utente ha rifiutato il consenso marketing.');
    }
    
    if (scenario.cookies.length > 0) {
      const sensitiveCookies = scenario.cookies.filter(cookie => isSensitiveCookie(cookie.name));
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

  return <IntegratedReport result={result} activeTab={activeTab} customScenarios={customScenarios} />;
};

export default ConsentReportWrapper;
