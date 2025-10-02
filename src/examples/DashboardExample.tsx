import React from 'react';
import ConsentDashboard from '../components/ConsentDashboard';

// Esempio di utilizzo della nuova dashboard professionale
const DashboardExample: React.FC = () => {
  const sampleData = {
    siteName: "fibra.aruba.it",
    testDate: "2025-01-01T16:30:00Z",
    scenarios: [
      {
        name: "Reject All",
        status: "PASS" as const,
        description: "Tutti i cookie non necessari vengono bloccati correttamente. Il sito rispetta completamente le preferenze dell'utente."
      },
      {
        name: "Accept All", 
        status: "PASS" as const,
        description: "Tutti i cookie vengono accettati e caricati come previsto. Nessun problema rilevato nel processo di accettazione."
      },
      {
        name: "Custom (Analytics ON, Marketing OFF)",
        status: "FAIL" as const,
        description: "Cookie di marketing ancora attivi nonostante il rifiuto esplicito. Si consiglia di verificare la configurazione del CMP."
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
        sensitive: false
      },
      {
        name: "_gid",
        domain: ".aruba.it", 
        category: "analytics" as const,
        purpose: "Cookie di Google Analytics per identificare utenti unici",
        sensitive: false
      },
      {
        name: "_fbp",
        domain: ".aruba.it",
        category: "marketing" as const,
        purpose: "Cookie di Facebook per il pixel di tracciamento e remarketing",
        sensitive: true
      },
      {
        name: "sessionid",
        domain: ".aruba.it",
        category: "necessary" as const,
        purpose: "Cookie di sessione per mantenere lo stato di login dell'utente",
        sensitive: false
      },
      {
        name: "cookie_consent",
        domain: ".aruba.it",
        category: "preferences" as const,
        purpose: "Cookie per memorizzare le preferenze di consenso dell'utente",
        sensitive: false
      },
      {
        name: "marketing_tracking",
        domain: ".aruba.it",
        category: "marketing" as const,
        purpose: "Cookie per il tracciamento pubblicitario e remarketing",
        sensitive: true
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
      },
      {
        url: "https://analytics.tiktok.com/i18n/pixel/events.js",
        domain: "tiktok.com",
        timestamp: 3500,
        category: "marketing" as const,
        blocked: true
      },
      {
        url: "https://www.googletagmanager.com/gtag/js?id=G-ABC123",
        domain: "googletagmanager.com",
        timestamp: 1400,
        category: "analytics" as const,
        blocked: false
      },
      {
        url: "https://googleads.g.doubleclick.net/pagead/ads",
        domain: "doubleclick.net",
        timestamp: 2600,
        category: "ads" as const,
        blocked: true
      },
      {
        url: "https://www.facebook.com/tr",
        domain: "facebook.com",
        timestamp: 3300,
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
      "Monitorare regolarmente i cookie di terze parti per assicurarsi che rispettino le preferenze di consenso dell'utente.",
      "Implementare controlli più rigorosi per i cookie di marketing per garantire la piena compliance.",
      "Verificare che tutti i cookie sensibili siano correttamente gestiti secondo le normative vigenti."
    ]
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <ConsentDashboard {...sampleData} />
    </div>
  );
};

export default DashboardExample;
