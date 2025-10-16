# 🚀 Live Debugger - Setup e Utilizzo

Il **Live Debugger** è ora integrato nel tuo progetto GTM Analyzer! 

## ✅ Cosa è stato implementato

- ✅ **Backend Express + WebSocket** (porta 5180)
- ✅ **Playwright automation** per browser headless
- ✅ **Auto-consent cookie** (Cookiebot + gtag fallback)
- ✅ **Rilevamento ambiente** (GTM, gtag, Cookiebot)
- ✅ **DataLayer hook** (snapshot + push real-time)
- ✅ **GA sniffer** (intercetta GA4/UA hits)
- ✅ **UI React completa** con filtri e pannelli
- ✅ **Integrazione** nella tua LiveDebuggerPage esistente

## 🚀 Come Avviare

### 1. Installa Playwright (se non già fatto)
```bash
npx playwright install chromium
```

### 2. Avvia il Live Debugger
```bash
# Opzione A: Solo Live Debugger + Frontend
npm run dev:live

# Opzione B: Tutto insieme (Backend + Puppeteer + Frontend + Live Debugger)
npm run dev
```

### 3. Apri l'interfaccia
Vai su: **http://localhost:5173/live-debugger**

## 🎯 Come Usare

1. **Inserisci URL** nel campo (es. `https://demo.google-analytics.com/`)
2. **Clicca "Avvia"** - il sistema:
   - Avvia Playwright headless
   - Accetta automaticamente i cookie
   - Rileva GTM/gtag/Cookiebot
   - Inietta hook dataLayer
   - Intercetta richieste GA
3. **Osserva i risultati** in tempo reale:
   - **Status Bar**: RUNNING/STOPPED + timer
   - **Environment Panel**: chip GTM/gtag/Cookiebot
   - **DataLayer Panel**: eventi dataLayer (collapsible)
   - **Network Table**: hit GA4/UA con dettagli
4. **Usa i filtri**:
   - ☑️ Solo GA collect
   - 🔍 Search nel payload
   - 📋 Tipo evento (DataLayer, GA4, UA, Console, Note)
5. **Clicca "Stop"** per terminare

## 🔧 Configurazione

### Porte
- **Frontend**: http://localhost:5173
- **Backend principale**: http://localhost:4010
- **Live Debugger**: http://localhost:5180
- **WebSocket Live Debugger**: ws://localhost:5180/events

### Script disponibili
```bash
npm run dev:live          # Solo Live Debugger + Frontend
npm run live-debugger     # Solo server Live Debugger
npm run dev               # Tutto insieme
```

## 🎨 UI Features

- **UrlForm**: Input URL + bottoni Avvia/Stop
- **StatusBar**: Status con timer real-time
- **EnvPanel**: Chip colorati per GTM/gtag/Cookiebot
- **FiltersBar**: Filtri GA only, search, event type
- **DataLayerPanel**: Lista eventi dataLayer (JSON collapsible)
- **NetworkTable**: Tabella GA hits (time, event, MI, CID, status)

## 🧪 Test Consigliati

| URL | Features da testare |
|-----|-------------------|
| `https://demo.google-analytics.com/` | GA4 events, dataLayer |
| `https://www.google.com/analytics/` | GTM + GA4 detection |
| `https://www.cookiebot.com/en/` | Cookiebot auto-consent |
| `https://analytics.google.com/` | Multiple trackers |

## 🐛 Troubleshooting

### ❌ "Cannot find module 'playwright'"
```bash
npx playwright install chromium
```

### ❌ "WebSocket connection failed"
Verifica che il server Live Debugger sia attivo:
```bash
curl http://localhost:5180/api/status
# Deve rispondere: {"running":false}
```

### ❌ Nessun evento intercettato
- Verifica che il sito usi GA4/UA
- Controlla che i cookie siano accettati
- Prova con siti di test noti

### ❌ Porta 5180 occupata
Cambia porta con variabile d'ambiente:
```bash
LIVE_DEBUGGER_PORT=3000 npm run live-debugger
```

## 📁 File Creati/Modificati

### Nuovi file
- `src/types/live-debugger.ts` - Tipi TypeScript
- `src/services/live-debugger-server.ts` - Backend Express + WebSocket
- `src/services/live-debugger-api.ts` - API client
- `src/components/live-debugger/` - Componenti React
  - `UrlForm.tsx`
  - `StatusBar.tsx`
  - `EnvPanel.tsx`
  - `FiltersBar.tsx`
  - `DataLayerPanel.tsx`
  - `NetworkTable.tsx`

### File modificati
- `package.json` - Aggiunto script `live-debugger` e `dev:live`
- `src/pages/LiveDebuggerPage.tsx` - Sostituito con implementazione funzionante
- `vite.config.mts` - Aggiunto proxy per Live Debugger

## 🎉 Risultato

La pagina "Live Tag Debugger" che prima mostrava "Pagina in Costruzione" ora è **completamente funzionante** con:

- ✅ Auto-consent cookie senza CTA utente
- ✅ Rilevamento GTM/gtag/Cookiebot automatico
- ✅ DataLayer hook completo (snapshot + push)
- ✅ GA sniffer (GET/POST, region, debug)
- ✅ WebSocket real-time streaming
- ✅ UI moderna con filtri funzionanti
- ✅ Stop rilascia risorse correttamente

**Pronto all'uso!** 🚀
