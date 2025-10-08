import React from 'react';
import ConsentReport from '../components/ConsentReport';
import { useConsentReport } from '../hooks/useConsentReport';

// Dati di esempio per il test
const sampleConsentData = {
  siteName: "fibra.aruba.it",
  testDate: "2025-01-01T16:30:00Z",
  scenarios: [
    {
      name: "Reject All",
      status: "PASS" as const,
      description: "Tutti i cookie non necessari vengono bloccati correttamente"
    },
    {
      name: "Accept All", 
      status: "PASS" as const,
      description: "Tutti i cookie vengono accettati e caricati"
    },
    {
      name: "Custom (Analytics ON, Marketing OFF)",
      status: "FAIL" as const,
      description: "Cookie di marketing ancora attivi nonostante il rifiuto esplicito"
    }
  ],
  googleConsent: {
    analytics_storage: "granted" as const,
    ad_storage: "denied" as const,
    ad_user_data: "denied" as const,
    ad_personalization: "denied" as const,
    functionality_storage: "granted" as const,
    personalization_storage: "denied" as const,
    security_storage: "granted" as const
  },
  cookies: [
    {
      name: "_ga",
      domain: ".aruba.it",
      category: "analytics" as const,
      purpose: "Cookie di Google Analytics per tracciare le visite e il comportamento degli utenti",
      sensitive: false,
      expires: "2 anni",
      size: 27
    },
    {
      name: "_gid",
      domain: ".aruba.it", 
      category: "analytics" as const,
      purpose: "Cookie di Google Analytics per identificare utenti unici",
      sensitive: false,
      expires: "24 ore",
      size: 22
    },
    {
      name: "_fbp",
      domain: ".aruba.it",
      category: "marketing" as const,
      purpose: "Cookie di Facebook per il pixel di tracciamento e remarketing",
      sensitive: true,
      expires: "3 mesi",
      size: 36
    },
    {
      name: "sessionid",
      domain: ".aruba.it",
      category: "necessary" as const,
      purpose: "Cookie di sessione per mantenere lo stato di login dell'utente",
      sensitive: false,
      expires: "Sessione",
      size: 32
    },
    {
      name: "cookie_consent",
      domain: ".aruba.it",
      category: "preferences" as const,
      purpose: "Cookie per memorizzare le preferenze di consenso dell'utente",
      sensitive: false,
      expires: "1 anno",
      size: 15
    }
  ],
  networkRequests: [
    {
      url: "https://www.googletagmanager.com/gtag/js?id=G-70RFMKCTXJ",
      domain: "googletagmanager.com",
      timestamp: 1200,
      category: "analytics" as const,
      blocked: false
    },
    {
      url: "https://googleads.g.doubleclick.net/pagead/viewthroughconversion/471649049/",
      domain: "doubleclick.net",
      timestamp: 2500,
      category: "ads" as const,
      blocked: true
    },
    {
      url: "https://connect.facebook.net/en_US/fbevents.js",
      domain: "facebook.net",
      timestamp: 3200,
      category: "marketing" as const,
      blocked: true
    },
    {
      url: "https://stats.g.doubleclick.net/g/collect",
      domain: "doubleclick.net",
      timestamp: 1800,
      category: "analytics" as const,
      blocked: false
    },
    {
      url: "https://www.google-analytics.com/g/collect",
      domain: "google-analytics.com",
      timestamp: 2100,
      category: "analytics" as const,
      blocked: false
    },
    {
      url: "https://tr.snapchat.com/v2/ct",
      domain: "snapchat.com",
      timestamp: 2800,
      category: "marketing" as const,
      blocked: true
    }
  ],
  recommendations: [
    "Il sito rispetta correttamente il consenso per i cookie di analytics, permettendo il tracciamento delle visite quando autorizzato.",
    "Le richieste pubblicitarie sono state correttamente bloccate quando l'utente ha rifiutato il consenso marketing.",
    "Si consiglia di verificare la configurazione del pixel Facebook per assicurarsi che non venga caricato quando il consenso marketing è negato.",
    "Il cookie di sessione è correttamente classificato come necessario e non richiede consenso esplicito.",
    "Considerare l'implementazione di un banner di consenso più chiaro per migliorare l'esperienza utente e la compliance GDPR.",
    "Monitorare regolarmente i cookie di terze parti per assicurarsi che rispettino le preferenze di consenso dell'utente."
  ]
};

const ConsentReportPage: React.FC = () => {
  const {
    data,
    loading,
    error,
    overallStatus,
    overallScore,
    cookieStats,
    networkStats,
    updateData,
    exportData
  } = useConsentReport(sampleConsentData);

  // Simula il caricamento dei dati
  React.useEffect(() => {
    if (!data) {
      // Qui potresti caricare i dati da un'API
      // loadData('/api/consent-report');
    }
  }, [data]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Caricamento report consenso...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 mb-4">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Errore nel caricamento</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Riprova
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Nessun dato disponibile</h2>
          <p className="text-gray-600">Non ci sono report di consenso da visualizzare.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header con azioni */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">AI Sentinel - Report Consenso</h1>
              <p className="text-sm text-gray-500 mt-1">
                Analisi dettagliata della gestione del consenso cookie
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => exportData('json')}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Esporta JSON
              </button>
              <button
                onClick={() => exportData('csv')}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Esporta CSV
              </button>
              <button
                onClick={() => window.print()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Stampa Report
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Report principale */}
      <ConsentReport {...data} />

      {/* Footer con statistiche aggiuntive */}
      <div className="bg-white border-t border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{overallScore}%</div>
              <div className="text-sm text-gray-500">Punteggio Complessivo</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{cookieStats.total}</div>
              <div className="text-sm text-gray-500">Cookie Rilevati</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{networkStats.total}</div>
              <div className="text-sm text-gray-500">Richieste di Rete</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConsentReportPage;
