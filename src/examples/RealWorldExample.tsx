import React, { useState, useEffect } from 'react';
import ConsentReport from '../components/ConsentReport';
import { useConsentReport } from '../hooks/useConsentReport';
import { ConsentReportData } from '../types/consent-report';

// Esempio con dati reali di un sito e-commerce
const RealWorldExample: React.FC = () => {
  const [currentSite, setCurrentSite] = useState<string>('amazon.it');
  const [reportData, setReportData] = useState<ConsentReportData | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    data,
    updateData,
    exportData,
    overallStatus,
    overallScore,
    cookieStats,
    networkStats
  } = useConsentReport();

  // Dati di esempio per diversi siti
  const siteData: Record<string, ConsentReportData> = {
    'amazon.it': {
      siteName: "amazon.it",
      testDate: "2025-01-01T14:30:00Z",
      scenarios: [
        {
          name: "Reject All",
          status: "PASS",
          description: "Tutti i cookie non necessari vengono bloccati correttamente"
        },
        {
          name: "Accept All",
          status: "PASS",
          description: "Tutti i cookie vengono accettati e caricati"
        },
        {
          name: "Custom (Analytics ON, Marketing OFF)",
          status: "FAIL",
          description: "Cookie di marketing ancora attivi nonostante il rifiuto esplicito"
        }
      ],
      googleConsent: {
        analytics_storage: "granted",
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
        functionality_storage: "granted",
        personalization_storage: "denied",
        security_storage: "granted"
      },
      cookies: [
        {
          name: "_ga",
          domain: ".amazon.it",
          category: "analytics",
          purpose: "Cookie di Google Analytics per tracciare le visite e il comportamento degli utenti",
          sensitive: false,
          expires: "2 anni",
          size: 27
        },
        {
          name: "_gid",
          domain: ".amazon.it",
          category: "analytics",
          purpose: "Cookie di Google Analytics per identificare utenti unici",
          sensitive: false,
          expires: "24 ore",
          size: 22
        },
        {
          name: "_fbp",
          domain: ".amazon.it",
          category: "marketing",
          purpose: "Cookie di Facebook per il pixel di tracciamento e remarketing",
          sensitive: true,
          expires: "3 mesi",
          size: 36
        },
        {
          name: "session-id",
          domain: ".amazon.it",
          category: "necessary",
          purpose: "Cookie di sessione per mantenere lo stato di login dell'utente",
          sensitive: false,
          expires: "Sessione",
          size: 32
        },
        {
          name: "aws-target-data",
          domain: ".amazon.it",
          category: "marketing",
          purpose: "Cookie per il targeting pubblicitario di Amazon",
          sensitive: true,
          expires: "1 anno",
          size: 45
        },
        {
          name: "pref",
          domain: ".amazon.it",
          category: "preferences",
          purpose: "Cookie per memorizzare le preferenze dell'utente (lingua, valuta, etc.)",
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
          category: "analytics",
          blocked: false
        },
        {
          url: "https://googleads.g.doubleclick.net/pagead/viewthroughconversion/471649049/",
          domain: "doubleclick.net",
          timestamp: 2500,
          category: "ads",
          blocked: true
        },
        {
          url: "https://connect.facebook.net/en_US/fbevents.js",
          domain: "facebook.net",
          timestamp: 3200,
          category: "marketing",
          blocked: true
        },
        {
          url: "https://stats.g.doubleclick.net/g/collect",
          domain: "doubleclick.net",
          timestamp: 1800,
          category: "analytics",
          blocked: false
        },
        {
          url: "https://www.google-analytics.com/g/collect",
          domain: "google-analytics.com",
          timestamp: 2100,
          category: "analytics",
          blocked: false
        },
        {
          url: "https://tr.snapchat.com/v2/ct",
          domain: "snapchat.com",
          timestamp: 2800,
          category: "marketing",
          blocked: true
        },
        {
          url: "https://analytics.tiktok.com/i18n/pixel/events.js",
          domain: "tiktok.com",
          timestamp: 3500,
          category: "marketing",
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
    },
    'netflix.com': {
      siteName: "netflix.com",
      testDate: "2025-01-01T15:45:00Z",
      scenarios: [
        {
          name: "Reject All",
          status: "PASS",
          description: "Tutti i cookie non necessari vengono bloccati correttamente"
        },
        {
          name: "Accept All",
          status: "PASS",
          description: "Tutti i cookie vengono accettati e caricati"
        },
        {
          name: "Custom (Analytics ON, Marketing OFF)",
          status: "PASS",
          description: "Il consenso personalizzato viene rispettato correttamente"
        }
      ],
      googleConsent: {
        analytics_storage: "granted",
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
        functionality_storage: "granted",
        personalization_storage: "granted",
        security_storage: "granted"
      },
      cookies: [
        {
          name: "_ga",
          domain: ".netflix.com",
          category: "analytics",
          purpose: "Cookie di Google Analytics per tracciare le visite",
          sensitive: false,
          expires: "2 anni",
          size: 27
        },
        {
          name: "NetflixId",
          domain: ".netflix.com",
          category: "necessary",
          purpose: "Cookie di sessione per l'autenticazione utente",
          sensitive: false,
          expires: "Sessione",
          size: 28
        },
        {
          name: "preferences",
          domain: ".netflix.com",
          category: "preferences",
          purpose: "Cookie per memorizzare le preferenze di visualizzazione",
          sensitive: false,
          expires: "1 anno",
          size: 18
        }
      ],
      networkRequests: [
        {
          url: "https://www.googletagmanager.com/gtag/js?id=G-ABC123",
          domain: "googletagmanager.com",
          timestamp: 1100,
          category: "analytics",
          blocked: false
        },
        {
          url: "https://www.google-analytics.com/g/collect",
          domain: "google-analytics.com",
          timestamp: 1900,
          category: "analytics",
          blocked: false
        }
      ],
      recommendations: [
        "Il sito dimostra un'eccellente compliance con le normative di consenso cookie.",
        "Tutti i cookie sono correttamente categorizzati e gestiti secondo le preferenze dell'utente.",
        "Le richieste di rete rispettano completamente le impostazioni di consenso.",
        "Il banner di consenso è chiaro e user-friendly.",
        "Si consiglia di mantenere questo livello di compliance per tutti i futuri aggiornamenti."
      ]
    },
    'facebook.com': {
      siteName: "facebook.com",
      testDate: "2025-01-01T16:20:00Z",
      scenarios: [
        {
          name: "Reject All",
          status: "FAIL",
          description: "Alcuni cookie di marketing non vengono bloccati correttamente"
        },
        {
          name: "Accept All",
          status: "PASS",
          description: "Tutti i cookie vengono accettati e caricati"
        },
        {
          name: "Custom (Analytics ON, Marketing OFF)",
          status: "FAIL",
          description: "Cookie di marketing ancora attivi nonostante il rifiuto esplicito"
        }
      ],
      googleConsent: {
        analytics_storage: "granted",
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
        functionality_storage: "granted",
        personalization_storage: "denied",
        security_storage: "granted"
      },
      cookies: [
        {
          name: "_ga",
          domain: ".facebook.com",
          category: "analytics",
          purpose: "Cookie di Google Analytics",
          sensitive: false,
          expires: "2 anni",
          size: 27
        },
        {
          name: "_fbp",
          domain: ".facebook.com",
          category: "marketing",
          purpose: "Cookie di Facebook per il pixel di tracciamento",
          sensitive: true,
          expires: "3 mesi",
          size: 36
        },
        {
          name: "datr",
          domain: ".facebook.com",
          category: "marketing",
          purpose: "Cookie per il riconoscimento del browser",
          sensitive: true,
          expires: "2 anni",
          size: 24
        },
        {
          name: "sb",
          domain: ".facebook.com",
          category: "marketing",
          purpose: "Cookie per il tracciamento delle sessioni",
          sensitive: true,
          expires: "2 anni",
          size: 22
        }
      ],
      networkRequests: [
        {
          url: "https://www.googletagmanager.com/gtag/js?id=G-DEF456",
          domain: "googletagmanager.com",
          timestamp: 1300,
          category: "analytics",
          blocked: false
        },
        {
          url: "https://connect.facebook.net/en_US/fbevents.js",
          domain: "facebook.net",
          timestamp: 2200,
          category: "marketing",
          blocked: false
        },
        {
          url: "https://www.facebook.com/tr",
          domain: "facebook.com",
          timestamp: 2400,
          category: "marketing",
          blocked: false
        }
      ],
      recommendations: [
        "Il sito presenta problemi significativi nella gestione del consenso cookie.",
        "I cookie di marketing non vengono bloccati correttamente quando l'utente rifiuta il consenso.",
        "Si consiglia di rivedere urgentemente la configurazione del banner di consenso.",
        "Implementare controlli più rigorosi per i cookie di terze parti.",
        "Verificare la compliance con le normative GDPR e CCPA.",
        "Considerare l'implementazione di un sistema di consenso più robusto."
      ]
    }
  };

  // Carica i dati del sito selezionato
  useEffect(() => {
    if (siteData[currentSite]) {
      setReportData(siteData[currentSite]);
      updateData(siteData[currentSite]);
    }
  }, [currentSite, updateData]);

  // Gestisce il cambio di sito
  const handleSiteChange = (site: string) => {
    setCurrentSite(site);
    setLoading(true);
    
    // Simula un caricamento
    setTimeout(() => {
      setLoading(false);
    }, 500);
  };

  // Gestisce l'esportazione
  const handleExport = (format: 'json' | 'csv') => {
    if (!reportData) return;
    exportData(format);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Caricamento dati per {currentSite}...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header con controlli */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Esempi Real-World</h1>
              <p className="text-sm text-gray-500 mt-1">
                Report di consenso per siti reali con dati di esempio
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <select
                value={currentSite}
                onChange={(e) => handleSiteChange(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="amazon.it">Amazon.it</option>
                <option value="netflix.com">Netflix.com</option>
                <option value="facebook.com">Facebook.com</option>
              </select>
              
              <button
                onClick={() => handleExport('json')}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Esporta JSON
              </button>
              
              <button
                onClick={() => handleExport('csv')}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Esporta CSV
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Report principale */}
      {reportData && (
        <ConsentReport {...reportData} />
      )}

      {/* Footer con statistiche */}
      {reportData && (
        <div className="bg-white border-t border-gray-200">
          <div className="max-w-6xl mx-auto px-6 py-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{networkStats.blocked}</div>
                <div className="text-sm text-gray-500">Richieste Bloccate</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RealWorldExample;
