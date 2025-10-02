# Consent Dashboard - Guida Completa

## 🎯 Panoramica

La **Consent Dashboard** è una dashboard professionale e moderna per visualizzare i risultati dei test di consenso cookie. Progettata per essere leggibile sia da consulenti tecnici che non tecnici, offre una vista d'insieme chiara e dettagliata dello stato di compliance di un sito web.

## 🏗️ Architettura del Sistema

### Componenti Principali

1. **ConsentDashboard** - Componente principale che orchestra tutta la dashboard
2. **SummaryBox** - Box di sintesi in alto con risultato complessivo
3. **TestTimeline** - Timeline laterale con i passi del processo di test
4. **ScenarioCard** - Card per ogni scenario di test con mini grafici
5. **NetworkChart** - Grafici a barre per le richieste di rete
6. **ConsentDashboard.css** - Stili personalizzati per la dashboard

### Struttura Layout

```
┌─────────────────────────────────────────────────────────────┐
│                    SummaryBox (Header)                      │
│  Nome sito | Punteggio | Bottone Download PDF              │
│  Metriche: Scenari | Cookie | Richieste | Durata           │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────────────────────────────┐   │
│  │             │  │                                     │   │
│  │ TestTimeline│  │        Contenuto Principale         │   │
│  │             │  │                                     │   │
│  │ • Banner    │  │ 1. Cards degli Scenari              │   │
│  │ • Scenario  │  │ 2. Google Consent Mode              │   │
│  │ • Consent   │  │ 3. Cookie Sensibili                 │   │
│  │ • Cookie    │  │ 4. Richieste di Rete (Grafici)     │   │
│  │ • Tracking  │  │ 5. Raccomandazioni                  │   │
│  │             │  │                                     │   │
│  └─────────────┘  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## 🎨 Design System

### Palette Colori

- **Verde (#16a34a)**: Successo, permesso, stato positivo
- **Rosso (#dc2626)**: Errore, blocco, stato critico
- **Grigio**: Neutro, informazioni generali
- **Blu (#2563eb)**: Informativo, analytics
- **Ambra**: Warning, attenzione, cookie sensibili

### Tipografia

- **Font**: Inter (fallback: system fonts)
- **Gerarchia**: H1-H6 per titoli, body per contenuto
- **Dimensioni**: Responsive con scale armonica

### Spaziatura

- **Padding**: 1.5rem (24px) per card principali
- **Margin**: 2rem (32px) tra sezioni
- **Border radius**: 0.75rem (12px) per card moderne

## 📊 Componenti Dettagliati

### 1. SummaryBox

**Posizione**: Header della dashboard
**Funzione**: Mostra il risultato complessivo e le metriche principali

```tsx
<SummaryBox
  siteName="example.com"
  testDate="2025-01-01T16:30:00Z"
  overallStatus="PASS"
  overallScore={85}
  totalScenarios={3}
  passedScenarios={2}
  totalCookies={15}
  sensitiveCookies={2}
  totalRequests={25}
  blockedRequests={5}
  testDuration={6100}
  onDownloadPDF={handleDownloadPDF}
/>
```

**Caratteristiche**:
- Risultato complessivo con icona e colore
- Punteggio percentuale prominente
- 4 metriche principali in card separate
- Bottone download PDF
- Gradiente di sfondo per impatto visivo

### 2. TestTimeline

**Posizione**: Sidebar sinistra
**Funzione**: Mostra i passi del processo di test

```tsx
<TestTimeline
  steps={[
    { id: 'banner', label: 'Banner', icon: Shield, status: 'completed', duration: 1200 },
    { id: 'scenario', label: 'Scenario', icon: Settings, status: 'completed', duration: 800 },
    // ...
  ]}
  totalDuration={6100}
/>
```

**Caratteristiche**:
- Timeline verticale con linea connessa
- Icone per ogni passo
- Stato visivo (completato, in corso, errore)
- Durata per ogni passo
- Statistiche riassuntive

### 3. ScenarioCard

**Posizione**: Sezione principale
**Funzione**: Card per ogni scenario di test

```tsx
<ScenarioCard
  scenario={{ name: "Reject All", status: "PASS", description: "..." }}
  index={0}
  totalCookies={15}
  totalRequests={25}
  duration={2.3}
  blockedRequests={5}
/>
```

**Caratteristiche**:
- Header con icona e stato
- Badge di stato colorato
- Mini grafico a barre per performance
- Descrizione dettagliata
- Metriche in fondo (durata, cookie, richieste)
- Indicatori di trend

### 4. NetworkChart

**Posizione**: Sezione richieste di rete
**Funzione**: Grafici a barre per le richieste di rete

```tsx
<NetworkChart
  requests={analyticsRequests}
  title="Google Analytics"
  category="analytics"
  color="bg-blue-100"
  icon={Globe}
/>
```

**Caratteristiche**:
- Grafico a barre per dominio
- Colori diversi per permesse/bloccate
- Statistiche riassuntive
- Indicatori di trend
- Top 5 domini più attivi

## 🔧 Utilizzo

### Installazione

```bash
npm install lucide-react
```

### Importazione

```tsx
import ConsentDashboard from './components/ConsentDashboard';
import './components/ConsentDashboard.css';
```

### Esempio Base

```tsx
const MyDashboard = () => {
  const dashboardData = {
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

  return <ConsentDashboard {...dashboardData} />;
};
```

## 📱 Responsive Design

### Breakpoints

- **Desktop**: > 1024px - Layout completo con sidebar
- **Tablet**: 768px - 1024px - Layout adattivo
- **Mobile**: < 768px - Layout a colonna singola

### Adattamenti Mobile

- Timeline spostata in alto
- Cards degli scenari impilate
- Grafici ridimensionati
- Testo ottimizzato per touch

## ♿ Accessibilità

### ARIA Labels

```tsx
<div 
  role="region" 
  aria-label="Dashboard consenso cookie"
  aria-expanded={expanded}
>
  {/* Contenuto */}
</div>
```

### Navigazione da Tastiera

- `Tab`: Navigazione tra elementi
- `Enter/Space`: Attivazione bottoni
- `Escape`: Chiusura modali
- `Arrow keys`: Navigazione in liste

### Screen Reader

- Testi alternativi per icone
- Descrizioni per elementi complessi
- Annunci di stato per cambiamenti

## 🎨 Personalizzazione

### Tema Personalizzato

```css
/* Override dei colori */
.consent-dashboard {
  --color-success: #16a34a;
  --color-error: #dc2626;
  --color-warning: #f59e0b;
  --color-info: #2563eb;
}
```

### Stili CSS

```css
/* Personalizzazione card */
.scenario-card {
  border-radius: 1rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

/* Personalizzazione grafici */
.network-chart .chart-bar {
  height: 12px;
  border-radius: 6px;
}
```

## 📊 Dati e Struttura

### Interfaccia Principale

```typescript
interface ConsentDashboardProps {
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

## 🚀 Funzionalità Avanzate

### Download PDF

```tsx
const handleDownloadPDF = () => {
  // Implementazione download PDF
  const pdfData = generatePDF(dashboardData);
  downloadFile(pdfData, 'consent-report.pdf', 'application/pdf');
};
```

### Esportazione Dati

```tsx
const handleExportData = (format: 'json' | 'csv') => {
  if (format === 'json') {
    const jsonData = JSON.stringify(dashboardData, null, 2);
    downloadFile(jsonData, 'consent-data.json', 'application/json');
  } else if (format === 'csv') {
    const csvData = convertToCSV(dashboardData);
    downloadFile(csvData, 'consent-data.csv', 'text/csv');
  }
};
```

### Real-time Updates

```tsx
const [dashboardData, setDashboardData] = useState(initialData);

useEffect(() => {
  const interval = setInterval(async () => {
    const newData = await fetchLatestData();
    setDashboardData(newData);
  }, 30000);
  
  return () => clearInterval(interval);
}, []);
```

## 🧪 Testing

### Test Unitari

```tsx
import { render, screen } from '@testing-library/react';
import ConsentDashboard from './ConsentDashboard';

test('renders dashboard with correct data', () => {
  render(<ConsentDashboard {...mockData} />);
  expect(screen.getByText('example.com')).toBeInTheDocument();
  expect(screen.getByText('CONSENSO CONFORME')).toBeInTheDocument();
});
```

### Test di Accessibilità

```tsx
import { axe, toHaveNoViolations } from 'jest-axe';

test('should not have accessibility violations', async () => {
  const { container } = render(<ConsentDashboard {...mockData} />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

## 📈 Performance

### Ottimizzazioni

- **Lazy loading**: Caricamento ottimizzato dei componenti
- **Memoization**: Caching intelligente dei calcoli
- **Virtualizzazione**: Gestione efficiente di grandi dataset
- **Debouncing**: Ottimizzazione delle interazioni

### Metriche

- **First Contentful Paint**: < 1.5s
- **Largest Contentful Paint**: < 2.5s
- **Cumulative Layout Shift**: < 0.1
- **Time to Interactive**: < 3.5s

## 🔄 Integrazione

### Con AI Sentinel

```tsx
const AISentinelDashboard = () => {
  const [testResults, setTestResults] = useState(null);
  
  useEffect(() => {
    const loadResults = async () => {
      const results = await fetch('/api/ai-sentinel/results');
      setTestResults(results);
    };
    loadResults();
  }, []);
  
  if (!testResults) return <LoadingSpinner />;
  
  return <ConsentDashboard {...testResults} />;
};
```

### Con API Backend

```tsx
const BackendDashboard = () => {
  const { data, loading, error } = useSWR('/api/consent-results', fetcher);
  
  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;
  
  return <ConsentDashboard {...data} />;
};
```

## 📚 Esempi

### Dashboard Completa

Vedi `DashboardExample.tsx` per un esempio completo con dati reali.

### Integrazione AI Sentinel

Vedi `AISentinelIntegration.tsx` per l'integrazione con il sistema AI Sentinel.

### Personalizzazione

Vedi `ConsentDashboard.css` per esempi di personalizzazione degli stili.

## 🎯 Best Practices

### Design

1. **Mantieni la coerenza**: Usa sempre la stessa palette di colori
2. **Priorità visiva**: Evidenzia le informazioni più importanti
3. **Spaziatura**: Usa spaziature generose per migliorare la leggibilità
4. **Contrasto**: Assicurati che il contrasto sia sufficiente per l'accessibilità

### Performance

1. **Lazy loading**: Carica i componenti solo quando necessario
2. **Memoization**: Cache i calcoli costosi
3. **Debouncing**: Ottimizza le interazioni dell'utente
4. **Virtualizzazione**: Gestisci grandi dataset in modo efficiente

### Accessibilità

1. **ARIA labels**: Fornisci sempre etichette appropriate
2. **Navigazione da tastiera**: Assicurati che tutto sia navigabile
3. **Contrasto**: Mantieni un contrasto sufficiente
4. **Screen reader**: Testa con tecnologie assistive

## 🚀 Roadmap

### Funzionalità Future

- [ ] **Filtri avanzati**: Filtri per data, categoria, stato
- [ ] **Comparazione**: Confronto tra diversi test
- [ ] **Alerting**: Notifiche per problemi critici
- [ ] **API**: Endpoint per integrazione con altri sistemi
- [ ] **Mobile app**: App mobile per monitoraggio
- [ ] **Dashboard personalizzabile**: Layout configurabile dall'utente

### Miglioramenti

- [ ] **Performance**: Ottimizzazioni per dataset molto grandi
- [ ] **Accessibilità**: Miglioramenti per screen reader
- [ ] **Internazionalizzazione**: Supporto per più lingue
- [ ] **Temi**: Temi scuri e personalizzati
- [ ] **Animazioni**: Animazioni più fluide e moderne

## 📞 Supporto

Per domande o supporto:
- Consultare questa documentazione
- Verificare gli esempi forniti
- Controllare i test per casi d'uso specifici
- Utilizzare i tooltip informativi nella dashboard

La dashboard è progettata per essere auto-documentata e intuitiva, con tooltip e descrizioni integrate per guidare l'utente nell'utilizzo.
