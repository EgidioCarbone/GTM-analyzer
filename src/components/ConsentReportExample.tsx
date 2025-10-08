import React from 'react';
import ConsentReport from './ConsentReport';

// Esempio di utilizzo del componente ConsentReport
const ConsentReportExample: React.FC = () => {
  const sampleData = {
    siteName: "fibra.aruba.it",
    testDate: "2025-01-01T16:30:00Z",
    scenarios: [
      {
        name: "Reject All",
        status: "PASS" as const,
        description: "Tutti i cookie non necessari vengono bloccati"
      },
      {
        name: "Accept All", 
        status: "PASS" as const,
        description: "Tutti i cookie vengono accettati"
      },
      {
        name: "Custom (Analytics ON, Marketing OFF)",
        status: "FAIL" as const,
        description: "Cookie di marketing ancora attivi nonostante il rifiuto"
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
        purpose: "Cookie di Google Analytics per tracciare le visite",
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
        purpose: "Cookie di Facebook per il pixel di tracciamento",
        sensitive: true
      },
      {
        name: "sessionid",
        domain: ".aruba.it",
        category: "necessary" as const,
        purpose: "Cookie di sessione per mantenere lo stato di login",
        sensitive: false
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
      }
    ],
    recommendations: [
      "Il sito rispetta correttamente il consenso per i cookie di analytics, permettendo il tracciamento delle visite.",
      "Le richieste pubblicitarie sono state correttamente bloccate quando l'utente ha rifiutato il consenso marketing.",
      "Si consiglia di verificare la configurazione del pixel Facebook per assicurarsi che non venga caricato quando il consenso marketing è negato.",
      "Il cookie di sessione è correttamente classificato come necessario e non richiede consenso.",
      "Considerare l'implementazione di un banner di consenso più chiaro per migliorare l'esperienza utente."
    ]
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <ConsentReport {...sampleData} />
    </div>
  );
};

export default ConsentReportExample;
