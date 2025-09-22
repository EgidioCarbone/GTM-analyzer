# Cookie Banner Extraction - SSD Test Enhancement

## Overview

Questa modifica aggiunge la funzionalità di estrazione del cookie banner al sistema SSD Test. Quando l'utente clicca "Process PDF", il sistema ora:

1. **Scarica l'HTML** della pagina indicata nell'URL usando Puppeteer
2. **Estrae il cookie banner** dall'HTML usando selettori CSS comuni
3. **Stampa le informazioni** del cookie banner nel backend
4. **Procede** con il normale processo di generazione DSL

## Implementazione

### Backend Changes

#### Nuovo Servizio: `src/services/cookieBannerExtractor.ts`
- **`extractCookieBanner()`** - Estrae cookie banner da HTML statico
- **`extractCookieBannerWithPuppeteer()`** - Estrae cookie banner usando Puppeteer
- Supporta 30+ selettori CSS comuni per cookie banner
- Rileva tipo (banner/modal/popup), posizione (top/bottom/center), e attributi

#### Nuovo Endpoint: `GET /api/ssd/fetch-html`
- **Input**: `?url=https://example.com`
- **Processo**:
  1. Valida e normalizza l'URL
  2. Avvia Puppeteer in modalità headless
  3. Naviga alla pagina con user agent realistico
  4. Aspetta 3 secondi per caricamento cookie banner
  5. Estrae HTML completo
  6. Estrae cookie banner usando selettori CSS
  7. Stampa informazioni nel backend
- **Output**: JSON con HTML, cookie banner info, timestamp

### Frontend Changes

#### Modifiche a `src/pages/SSDTestPage.tsx`
- **`handleIngest()`** ora esegue 2 step:
  1. **Step 1**: Chiama `/api/ssd/fetch-html` per scaricare HTML e estrarre cookie banner
  2. **Step 2**: Chiama `/api/spec/generate` per processare PDF e generare DSL
- **Toast notifications** per ogni step
- **Loading steps** aggiornati per includere "Download HTML e estrazione cookie banner"

## Selettori CSS Supportati

Il sistema cerca cookie banner usando questi pattern:

```css
/* Pattern comuni */
[id*="cookie"], [class*="cookie"]
[id*="consent"], [class*="consent"]
[id*="gdpr"], [class*="gdpr"]
[id*="privacy"], [class*="privacy"]
[id*="banner"], [class*="banner"]

/* Librerie CMP specifiche */
#onetrust-consent-sdk
.ot-sdk-container
#cookieChoiceInfo
.cookie-notice
.cookie-banner
.consent-banner
.gdpr-banner
.privacy-banner

/* E molti altri... */
```

## Output del Backend

Quando viene trovato un cookie banner, il backend stampa:

```
[correlationId] ===== COOKIE BANNER FOUND =====
[correlationId] Type: banner
[correlationId] Position: bottom
[correlationId] Selectors: .cookie-banner
[correlationId] Text: We use cookies to enhance your experience...
[correlationId] HTML: <div class="cookie-banner">...</div>
[correlationId] ================================
```

## Test

### Script di Test
Esegui il test con:
```bash
node test-cookie-banner-extraction.js
```

Il test verifica l'endpoint con URL comuni e stampa i risultati.

### Test Manuale
1. Avvia il server: `npm run dev`
2. Vai alla pagina SSD Test
3. Inserisci un URL (es. https://www.google.com)
4. Carica un PDF
5. Clicca "Process PDF"
6. Controlla i log del backend per vedere l'estrazione del cookie banner

## Configurazione

### Variabili Ambiente
```bash
# Puppeteer configuration (opzionale)
PUPPETEER_HEADLESS=true
PUPPETEER_ARGS=--no-sandbox,--disable-setuid-sandbox
```

### Timeout
- **HTML Download**: 60 secondi
- **Puppeteer Navigation**: 30 secondi
- **Cookie Banner Wait**: 3 secondi

## Sicurezza

- ✅ User agent realistico per evitare blocchi
- ✅ Timeout configurati per evitare hang
- ✅ Validazione URL per prevenire attacchi
- ✅ Cleanup automatico del browser Puppeteer
- ✅ Error handling robusto

## Prossimi Passi

Questa è la **prima modifica** in piccoli passi. I prossimi step potrebbero includere:

1. **Analisi del cookie banner** per estrarre pulsanti di accettazione/rifiuto
2. **Integrazione con il DSL** per includere test specifici per cookie banner
3. **Screenshot del cookie banner** per evidenze visive
4. **Classificazione automatica** del tipo di cookie banner (GDPR, CCPA, etc.)

## File Modificati

- ✅ `src/services/cookieBannerExtractor.ts` - Nuovo servizio
- ✅ `server-ssd.ts` - Nuovo endpoint `/api/ssd/fetch-html`
- ✅ `src/pages/SSDTestPage.tsx` - Integrazione frontend
- ✅ `test-cookie-banner-extraction.js` - Script di test
- ✅ `COOKIE_BANNER_EXTRACTION.md` - Documentazione

La funzionalità è ora **pronta per il test**! 🚀
