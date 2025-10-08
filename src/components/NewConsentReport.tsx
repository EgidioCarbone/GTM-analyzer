import React from 'react';
import { Download, Share2, Mail } from 'lucide-react';
import CriticalIssuesSection from './CriticalIssuesSection';
import ComplianceStatusSection from './ComplianceStatusSection';
import CollapsibleSection from './CollapsibleSection';
import TechnicalDetailsSection from './TechnicalDetailsSection';
import { Code, Camera, Database, Network } from 'lucide-react';

interface NewConsentReportProps {
  siteName: string;
  testDate: string;
  scenarios: Array<{
    name: string;
    status: 'PASS' | 'FAIL';
    description: string;
  }>;
  googleConsent: {
    analytics_storage: 'granted' | 'denied';
    ad_storage: 'granted' | 'denied';
    ad_user_data: 'granted' | 'denied';
    ad_personalization: 'granted' | 'denied';
    functionality_storage: 'granted' | 'denied';
    personalization_storage: 'granted' | 'denied';
    security_storage: 'granted' | 'denied';
  };
  cookies: Array<{
    name: string;
    domain: string;
    category: 'necessary' | 'analytics' | 'marketing' | 'preferences';
    purpose: string;
    sensitive: boolean;
  }>;
  networkRequests: Array<{
    url: string;
    domain: string;
    timestamp: number;
    category: 'analytics' | 'ads' | 'marketing' | 'other';
    blocked: boolean;
  }>;
  recommendations: string[];
  // Dati tecnici per i dettagli
  technicalData?: {
    scenarios: Array<{
      name: string;
      data: {
        cookies: Array<{ name: string; domain: string; expires: number }>;
        gaAdsRequests: Array<{ url: string; ts: number }>;
        gtagCalls: any[];
        dataLayer: any[];
        latestConsent: any;
        artifacts?: {
          screenshotPath?: string;
          screenshotDataUrl?: string;
          tracePath?: string;
        };
      };
    }>;
  };
}

const NewConsentReport: React.FC<NewConsentReportProps> = ({
  siteName,
  testDate,
  scenarios,
  googleConsent,
  cookies,
  networkRequests,
  recommendations,
  technicalData
}) => {
  // Analizza i dati per identificare problemi critici
  const analyzeCriticalIssues = () => {
    const issues = [];

    // Problema 1: Marketing cookies attivi nonostante rifiuto
    const marketingCookiesWithReject = cookies.filter(cookie => 
      cookie.category === 'marketing' && 
      googleConsent.ad_storage === 'denied'
    );

    if (marketingCookiesWithReject.length > 0) {
      issues.push({
        id: 'marketing-cookies-reject',
        severity: 'critical' as const,
        title: 'Marketing cookies attivi nonostante rifiuto del consenso',
        businessImpact: 'Violazione GDPR Art. 6 - Rischio multa fino a €20M o 4% del fatturato',
        technicalCause: `Cookie di marketing (${marketingCookiesWithReject.map(c => c.name).join(', ')}) attivi quando ad_storage=denied`,
        solution: {
          immediate: 'Configurare il CMP per bloccare i cookie di marketing quando marketing=OFF',
          verification: 'Testare il sito con marketing=OFF e verificare che i cookie marketing non siano presenti',
          monitoring: 'Implementare alert per cookie marketing non autorizzati'
        },
        affectedElements: marketingCookiesWithReject.map(c => c.name)
      });
    }

    // Problema 2: Richieste di rete non bloccate
    const unblockedMarketingRequests = networkRequests.filter(req => 
      req.category === 'ads' && 
      !req.blocked && 
      googleConsent.ad_storage === 'denied'
    );

    if (unblockedMarketingRequests.length > 0) {
      issues.push({
        id: 'unblocked-requests',
        severity: 'critical' as const,
        title: 'Richieste pubblicitarie non bloccate nonostante rifiuto',
        businessImpact: 'Tracking non autorizzato - Violazione ePrivacy Directive',
        technicalCause: `Richieste a ${unblockedMarketingRequests.map(r => r.domain).join(', ')} non bloccate quando ad_storage=denied`,
        solution: {
          immediate: 'Configurare il CMP per bloccare le richieste pubblicitarie quando marketing=OFF',
          verification: 'Verificare che le richieste a doubleclick.net, googleadservices.com siano bloccate',
          monitoring: 'Monitorare le richieste di rete per identificare tracking non autorizzato'
        },
        affectedElements: unblockedMarketingRequests.map(r => r.domain)
      });
    }

    // Problema 3: Analytics senza consenso
    const analyticsWithoutConsent = cookies.filter(cookie => 
      cookie.category === 'analytics' && 
      googleConsent.analytics_storage === 'denied'
    );

    if (analyticsWithoutConsent.length > 0) {
      issues.push({
        id: 'analytics-without-consent',
        severity: 'warning' as const,
        title: 'Cookie analytics attivi senza consenso esplicito',
        businessImpact: 'Perdita di dati analytics e possibile violazione GDPR',
        technicalCause: `Cookie analytics (${analyticsWithoutConsent.map(c => c.name).join(', ')}) attivi quando analytics_storage=denied`,
        solution: {
          immediate: 'Implementare consent mode v2 per Google Analytics',
          verification: 'Testare che _ga, _gid non siano presenti quando analytics=OFF',
          monitoring: 'Verificare che i dati analytics rispettino le preferenze di consenso'
        },
        affectedElements: analyticsWithoutConsent.map(c => c.name)
      });
    }

    return issues;
  };

  // Analizza lo stato di conformità per categoria
  const analyzeComplianceCategories = () => {
    const categories = [];

    // Analytics
    const analyticsCookies = cookies.filter(c => c.category === 'analytics');
    const analyticsCompliant = googleConsent.analytics_storage === 'granted' || analyticsCookies.length === 0;
    
    categories.push({
      name: 'analytics' as const,
      status: analyticsCompliant ? 'compliant' as const : 'non-compliant' as const,
      description: analyticsCompliant 
        ? 'Il sito rispetta correttamente le preferenze di consenso per i cookie analytics'
        : 'Cookie analytics attivi senza consenso esplicito dell\'utente',
      details: {
        cookiesDetected: analyticsCookies.length,
        consentRespected: analyticsCompliant,
        blockingWorking: googleConsent.analytics_storage === 'denied' ? analyticsCookies.length === 0 : true
      }
    });

    // Marketing
    const marketingCookies = cookies.filter(c => c.category === 'marketing');
    const marketingCompliant = googleConsent.ad_storage === 'granted' || marketingCookies.length === 0;
    
    categories.push({
      name: 'marketing' as const,
      status: marketingCompliant ? 'compliant' as const : 'non-compliant' as const,
      description: marketingCompliant
        ? 'Il sito rispetta correttamente le preferenze di consenso per i cookie marketing'
        : 'Cookie marketing attivi nonostante il rifiuto del consenso',
      details: {
        cookiesDetected: marketingCookies.length,
        consentRespected: marketingCompliant,
        blockingWorking: googleConsent.ad_storage === 'denied' ? marketingCookies.length === 0 : true
      }
    });

    // Preferenze
    const preferencesCookies = cookies.filter(c => c.category === 'preferences');
    categories.push({
      name: 'preferences' as const,
      status: 'compliant' as const,
      description: 'Cookie di preferenze sempre attivi (necessari per il funzionamento del sito)',
      details: {
        cookiesDetected: preferencesCookies.length,
        consentRespected: true,
        blockingWorking: true
      }
    });

    // Necessari
    const necessaryCookies = cookies.filter(c => c.category === 'necessary');
    categories.push({
      name: 'necessary' as const,
      status: 'compliant' as const,
      description: 'Cookie necessari sempre attivi (richiesti per il funzionamento del sito)',
      details: {
        cookiesDetected: necessaryCookies.length,
        consentRespected: true,
        blockingWorking: true
      }
    });

    return categories;
  };

  // Calcola il punteggio complessivo
  const calculateOverallScore = () => {
    const categories = analyzeComplianceCategories();
    const compliantCategories = categories.filter(c => c.status === 'compliant').length;
    return Math.round((compliantCategories / categories.length) * 100);
  };

  const criticalIssues = analyzeCriticalIssues();
  const complianceCategories = analyzeComplianceCategories();
  const overallScore = calculateOverallScore();

  const handleDownloadPDF = () => {
    // TODO: Implementare download PDF
    console.log('Download PDF triggered');
  };

  const handleShareReport = () => {
    // TODO: Implementare condivisione report
    console.log('Share report triggered');
  };

  const handleEmailReport = () => {
    // TODO: Implementare invio email
    console.log('Email report triggered');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 relative overflow-hidden">
      {/* Sfondo dinamico con particelle - stesso della HomePage */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Cerchi animati */}
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-40 left-20 w-80 h-80 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
        <div className="absolute -bottom-40 right-20 w-80 h-80 bg-blue-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-6000"></div>
        
        {/* Particelle fluttuanti */}
        <div className="absolute inset-0">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 bg-purple-400 rounded-full opacity-60 animate-float"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 10}s`,
                animationDuration: `${3 + Math.random() * 4}s`
              }}
            />
          ))}
        </div>
      </div>

      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200 relative z-10">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{siteName}</h1>
              <p className="text-gray-600 mt-1">
                Test eseguito il {new Date(testDate).toLocaleDateString('it-IT', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>
            
            {/* Azioni secondarie */}
            <div className="flex space-x-3">
              <button
                onClick={handleShareReport}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
              >
                <Share2 className="w-4 h-4 mr-2" />
                Condividi
              </button>
              <button
                onClick={handleEmailReport}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
              >
                <Mail className="w-4 h-4 mr-2" />
                Invia Email
              </button>
              <button
                onClick={handleDownloadPDF}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                <Download className="w-4 h-4 mr-2" />
                PDF
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Contenuto principale - Centrato verticalmente */}
      <main className="flex-grow flex items-center justify-center px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto relative z-10">
        <div className="w-full space-y-8">
        
        {/* Problemi critici */}
        <CriticalIssuesSection issues={criticalIssues} />
        
        {/* Stato conformità */}
        <ComplianceStatusSection 
          categories={complianceCategories}
          overallScore={overallScore}
        />
        
        {/* Dettagli tecnici */}
        {technicalData && (
          <CollapsibleSection 
            title="Dettagli Tecnici"
            icon={<Code className="w-5 h-5" />}
          >
            <TechnicalDetailsSection scenarios={technicalData.scenarios} />
          </CollapsibleSection>
        )}
        
        </div>
      </main>
    </div>
  );
};

export default NewConsentReport;
