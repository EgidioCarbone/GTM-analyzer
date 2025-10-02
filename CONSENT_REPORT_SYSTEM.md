# Sistema Report Consenso - AI Sentinel

Un sistema completo e modulare per la visualizzazione di report dettagliati sui test di consenso cookie, progettato per essere user-friendly sia per utenti tecnici che non tecnici.

## 🎯 Caratteristiche Principali

### Design Modulare
- **Componenti riutilizzabili**: Ogni sezione è un componente indipendente
- **Layout responsive**: Ottimizzato per desktop, tablet e mobile
- **Sezioni espandibili**: Ogni modulo può essere collassato/espanso
- **Sticky header**: Header e badge risultato sempre visibili

### User Experience
- **Linguaggio semplice**: Spiegazioni chiare per utenti non tecnici
- **Tooltip informativi**: Hover su elementi tecnici per spiegazioni
- **Badge di stato**: Indicatori visivi chiari (PASS/FAIL, granted/denied)
- **Timeline interattiva**: Visualizzazione temporale delle richieste di rete

### Accessibilità
- **Screen reader friendly**: Supporto completo per tecnologie assistive
- **Navigazione da tastiera**: Tutti gli elementi sono navigabili via tastiera
- **Alto contrasto**: Colori adatti per utenti con difficoltà visive
- **Focus management**: Gestione corretta del focus per l'accessibilità

## 📁 Struttura del Sistema

```
src/
├── components/
│   ├── ConsentReport.tsx          # Componente principale del report
│   ├── ConsentReportExample.tsx   # Esempio di utilizzo
│   ├── ConsentReport.css          # Stili personalizzati
│   ├── NetworkTimeline.tsx        # Timeline delle richieste di rete
│   └── CookieList.tsx             # Lista dettagliata dei cookie
├── hooks/
│   └── useConsentReport.ts        # Hook personalizzato per gestione dati
└── pages/
    └── ConsentReportPage.tsx      # Pagina completa di esempio
```

## 🧩 Componenti Principali

### 1. ConsentReport
Il componente principale che orchestra l'intero report:

```tsx
<ConsentReport
  siteName="example.com"
  testDate="2025-01-01T16:30:00Z"
  scenarios={[...]}
  googleConsent={{...}}
  cookies={[...]}
  networkRequests={[...]}
  recommendations={[...]}
/>
```

**Caratteristiche:**
- Header sticky con nome sito e data test
- Badge centrale del risultato (PASS/FAIL) con percentuale
- Due pannelli affiancati per Google Consent Mode e Cookie
- Sezioni espandibili per Network Requests e Raccomandazioni
- Design responsive e accessibile

### 2. NetworkTimeline
Visualizzazione temporale delle richieste di rete:

```tsx
<NetworkTimeline
  requests={networkRequests}
  maxHeight="400px"
  showFilters={true}
  showSearch={true}
/>
```

**Caratteristiche:**
- Timeline visiva con punti temporali
- Filtri per categoria e stato (bloccata/permessa)
- Ricerca per URL o dominio
- Dettagli espandibili per ogni richiesta
- Indicatori visivi per richieste bloccate/permesse

### 3. CookieList
Lista dettagliata e categorizzata dei cookie:

```tsx
<CookieList
  cookies={cookies}
  maxHeight="400px"
  showFilters={true}
  showSearch={true}
  showDetails={true}
/>
```

**Caratteristiche:**
- Categorizzazione automatica (necessary, analytics, marketing, preferences)
- Filtri per categoria e sensibilità
- Ordinamento per nome, categoria o dominio
- Dettagli espandibili con informazioni complete
- Indicatori per cookie sensibili

### 4. useConsentReport Hook
Hook personalizzato per la gestione dei dati:

```tsx
const {
  data,
  loading,
  error,
  overallStatus,
  overallScore,
  cookieStats,
  networkStats,
  updateData,
  exportData,
  toggleSection
} = useConsentReport(initialData, options);
```

**Funzionalità:**
- Gestione dello stato del report
- Calcolo automatico di statistiche
- Filtri e ordinamento
- Esportazione in JSON/CSV
- Auto-refresh opzionale

## 🎨 Design System

### Palette Colori
- **Verde**: Successo, permesso, stato positivo
- **Rosso**: Errore, blocco, stato negativo  
- **Ambra**: Warning, attenzione, cookie sensibili
- **Blu**: Analytics, informazioni
- **Viola**: Marketing, ads
- **Grigio**: Necessari, neutro

### Icone
Utilizzo di Lucide React per consistenza:
- `CheckCircle`: Successo, permesso
- `XCircle`: Errore, blocco
- `AlertTriangle`: Warning, sensibile
- `Globe`: Analytics, web
- `Network`: Marketing, ads
- `Shield`: Sicurezza, necessari
- `Cookie`: Cookie, preferenze

### Tipografia
- **Font**: Inter (fallback: system fonts)
- **Gerarchia**: H1-H6 per titoli, body per contenuto
- **Dimensioni**: Responsive con scale armonica

## 📊 Struttura Dati

### Scenario
```typescript
interface Scenario {
  name: string;           // "Reject All", "Accept All", "Custom"
  status: 'PASS' | 'FAIL';
  description: string;    // Descrizione in linguaggio semplice
}
```

### Google Consent Mode
```typescript
interface GoogleConsent {
  analytics_storage: 'granted' | 'denied';
  ad_storage: 'granted' | 'denied';
  ad_user_data: 'granted' | 'denied';
  ad_personalization: 'granted' | 'denied';
  functionality_storage: 'granted' | 'denied';
  personalization_storage: 'granted' | 'denied';
  security_storage: 'granted' | 'denied';
}
```

### Cookie
```typescript
interface Cookie {
  name: string;
  domain: string;
  category: 'necessary' | 'analytics' | 'marketing' | 'preferences';
  purpose: string;        // Descrizione in linguaggio semplice
  sensitive: boolean;
  expires?: string;       // "2 anni", "Sessione", "1 anno"
  size?: number;          // Dimensione in bytes
}
```

### Network Request
```typescript
interface NetworkRequest {
  url: string;
  domain: string;
  timestamp: number;      // Millisecondi dall'inizio del test
  category: 'analytics' | 'ads' | 'marketing' | 'other';
  blocked: boolean;       // Se la richiesta è stata bloccata
}
```

## 🚀 Utilizzo

### Installazione Dipendenze
```bash
npm install lucide-react
```

### Importazione
```tsx
import ConsentReport from './components/ConsentReport';
import { useConsentReport } from './hooks/useConsentReport';
```

### Esempio Base
```tsx
const MyReport = () => {
  const reportData = {
    siteName: "example.com",
    testDate: new Date().toISOString(),
    scenarios: [
      {
        name: "Reject All",
        status: "PASS",
        description: "Tutti i cookie non necessari vengono bloccati"
      }
    ],
    googleConsent: {
      analytics_storage: "denied",
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

## 🔧 Personalizzazione

### Stili CSS
Il file `ConsentReport.css` contiene tutti gli stili personalizzati:

```css
/* Badge personalizzati */
.consent-report .status-badge {
  /* Stili per i badge di stato */
}

/* Tooltip */
.consent-report .tooltip .tooltip-content {
  /* Stili per i tooltip informativi */
}

/* Responsive */
@media (max-width: 768px) {
  /* Stili per mobile */
}
```

### Tema Personalizzato
```tsx
// Override dei colori
const customTheme = {
  success: '#10b981',
  error: '#ef4444',
  warning: '#f59e0b',
  info: '#3b82f6'
};
```

## 📱 Responsive Design

### Breakpoints
- **Desktop**: > 1024px - Layout a due colonne
- **Tablet**: 768px - 1024px - Layout adattivo
- **Mobile**: < 768px - Layout a colonna singola

### Adattamenti Mobile
- Header non sticky per risparmiare spazio
- Sezioni impilate verticalmente
- Filtri in modalità accordion
- Touch-friendly per interazioni

## ♿ Accessibilità

### ARIA Labels
```tsx
<div 
  role="region" 
  aria-label="Report consenso cookie"
  aria-expanded={expanded}
>
  {/* Contenuto */}
</div>
```

### Navigazione da Tastiera
- `Tab`: Navigazione tra elementi
- `Enter/Space`: Attivazione bottoni
- `Escape`: Chiusura modali/tooltip
- `Arrow keys`: Navigazione in liste

### Screen Reader
- Testi alternativi per icone
- Descrizioni per elementi complessi
- Annunci di stato per cambiamenti dinamici

## 🔄 Integrazione con AI Sentinel

### API Endpoint
```typescript
// Caricamento dati da API
const loadReportData = async (testId: string) => {
  const response = await fetch(`/api/consent-report/${testId}`);
  return response.json();
};
```

### Real-time Updates
```tsx
const { data, updateData } = useConsentReport();

// Aggiornamento in tempo reale
useEffect(() => {
  const interval = setInterval(async () => {
    const newData = await loadReportData(testId);
    updateData(newData);
  }, 30000);
  
  return () => clearInterval(interval);
}, [testId]);
```

## 📈 Estensibilità

### Nuove Sezioni
```tsx
// Aggiunta di una nuova sezione
const CustomSection = ({ data, expanded, onToggle }) => (
  <div className="bg-gray-50 rounded-lg p-6">
    <div onClick={() => onToggle('customSection')}>
      <h2>Sezione Personalizzata</h2>
    </div>
    {expanded && (
      <div className="mt-4">
        {/* Contenuto della sezione */}
      </div>
    )}
  </div>
);
```

### Nuovi Filtri
```tsx
// Aggiunta di filtri personalizzati
const customFilters = {
  dateRange: { from: '2025-01-01', to: '2025-01-31' },
  severity: ['high', 'medium', 'low'],
  compliance: ['gdpr', 'ccpa', 'lgpd']
};
```

## 🧪 Testing

### Test Unitari
```tsx
import { render, screen } from '@testing-library/react';
import ConsentReport from './ConsentReport';

test('renders report with correct data', () => {
  render(<ConsentReport {...mockData} />);
  expect(screen.getByText('example.com')).toBeInTheDocument();
  expect(screen.getByText('CONSENSO CONFORME')).toBeInTheDocument();
});
```

### Test di Accessibilità
```tsx
import { axe, toHaveNoViolations } from 'jest-axe';

test('should not have accessibility violations', async () => {
  const { container } = render(<ConsentReport {...mockData} />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

## 📚 Esempi Completi

Vedi i file di esempio per implementazioni complete:
- `ConsentReportExample.tsx` - Esempio base
- `ConsentReportPage.tsx` - Pagina completa con hook
- `NetworkTimeline.tsx` - Timeline avanzata
- `CookieList.tsx` - Lista cookie con filtri

## 🤝 Contributi

Per contribuire al sistema:
1. Segui le convenzioni di naming
2. Aggiungi test per nuove funzionalità
3. Documenta le modifiche
4. Mantieni la compatibilità con i componenti esistenti

## 📄 Licenza

Questo sistema è parte del progetto AI Sentinel e segue le stesse licenze del progetto principale.
