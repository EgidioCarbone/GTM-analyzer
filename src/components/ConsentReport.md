# ConsentReport Component

Un componente React modulare e responsive per visualizzare report dettagliati sui test di consenso cookie.

## Caratteristiche

- **Design modulare**: Ogni sezione è espandibile/collassabile
- **Responsive**: Ottimizzato per desktop, tablet e mobile
- **Accessibile**: Supporto per screen reader e navigazione da tastiera
- **User-friendly**: Tooltip informativi e linguaggio semplice
- **Sticky header**: Header e badge risultato sempre visibili
- **Timeline network**: Visualizzazione temporale delle richieste di rete

## Struttura del Componente

### Header Sticky
- Nome del sito e data del test
- Scenari attivi con badge di stato
- Badge centrale del risultato (PASS/FAIL) con percentuale
- Descrizione in linguaggio semplice

### Pannelli Affiancati
1. **Google Consent Mode**: Stato delle categorie di consenso
2. **Cookie Rilevati**: Elenco categorizzato dei cookie

### Sezioni Espandibili
1. **Richieste di Rete**: Timeline con domini e tempi
2. **Raccomandazioni**: Suggerimenti basati sui risultati

## Props

```typescript
interface ConsentReportProps {
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
}
```

## Utilizzo

```tsx
import ConsentReport from './ConsentReport';

const MyComponent = () => {
  const reportData = {
    siteName: "example.com",
    testDate: "2025-01-01T16:30:00Z",
    scenarios: [
      {
        name: "Reject All",
        status: "PASS",
        description: "Tutti i cookie non necessari vengono bloccati"
      }
    ],
    googleConsent: {
      analytics_storage: "granted",
      ad_storage: "denied",
      // ... altre categorie
    },
    cookies: [
      {
        name: "_ga",
        domain: ".example.com",
        category: "analytics",
        purpose: "Cookie di Google Analytics",
        sensitive: false
      }
    ],
    networkRequests: [
      {
        url: "https://www.googletagmanager.com/gtag/js",
        domain: "googletagmanager.com",
        timestamp: 1200,
        category: "analytics",
        blocked: false
      }
    ],
    recommendations: [
      "Il sito rispetta correttamente il consenso per i cookie di analytics."
    ]
  };

  return <ConsentReport {...reportData} />;
};
```

## Stili

Il componente utilizza Tailwind CSS con classi personalizzate. Include:

- **Palette colori**: Verde (successo), Rosso (errore), Ambra (warning)
- **Icone**: Lucide React per consistenza visiva
- **Animazioni**: Transizioni smooth per sezioni espandibili
- **Tooltip**: Informazioni contestuali per elementi tecnici

## Accessibilità

- **ARIA labels**: Per screen reader
- **Focus management**: Navigazione da tastiera
- **Contrasto**: Colori ad alto contrasto
- **Tooltip**: Informazioni accessibili via hover

## Responsive Design

- **Desktop**: Layout a due colonne per pannelli principali
- **Tablet**: Layout adattivo con sezioni impilate
- **Mobile**: Layout a colonna singola con header non sticky

## Estensibilità

Il componente è progettato per essere facilmente estendibile:

- **Nuove sezioni**: Aggiungere sezioni espandibili
- **Nuovi scenari**: Supporto per tipi di test aggiuntivi
- **Personalizzazione**: Override degli stili via CSS
- **Integrazione**: Facile integrazione con API di AI Sentinel

## Dipendenze

- React 18+
- Tailwind CSS
- Lucide React (icone)
- TypeScript (opzionale ma raccomandato)

## Esempi

Vedi `ConsentReportExample.tsx` per un esempio completo di utilizzo con dati di esempio.
