# GTM Analyzer – Architettura e Flussi Operativi

## 1. Visione d'insieme
- **Obiettivo**: automatizzare audit e monitoraggio di implementazioni Google Tag Manager (GTM), cookie consent e strumenti analitici, producendo report intelligenti e piani d'azione.
- **Stack**: frontend React 18 + Vite, backend Express/TypeScript eseguito con `tsx`, automazioni browser con Puppeteer e Playwright, integrazioni LLM (OpenAI) e Google Analytics Data API.
- **Macro-funzionalità**:
  - Gestione container GTM con calcolo qualità, remediation guidata e piani di misurazione AI.
  - SSD (Specification-Driven Testing): converte PDF con requisiti marketing in DSL eseguibile, lancia test browser automatizzati e genera report dettagliati.
  - AI Sentinel: test GDPR/CCPA con Playwright per CMP multipli, con fallback LLM per riconoscimento banner.
  - Live Tag Debugger: cattura dataLayer push, page view e hit multi-vendor (GA4/UA, Meta Pixel, LinkedIn Insight, Adobe), con insight AI in tempo reale.
  - GA4 Insights: estrazione KPI, visualizzazioni e narrativa AI sui dati GA4.

## 2. Struttura del repository
- `src/` – codice frontend (React), servizi condivisi, tipi, assets.
- `server-ssd.ts` – backend principale per SSD + router GA4 + orchestrazione tutela consenso.
- `server.js` – variante Express più leggera usata per proxy HTML e ingest SSD.
- `src/services/` – layer di dominio riutilizzabile (estrazione PDF, runner SSD, analisi container, API GA4, ecc.).
- `src/ai-sentinel/` – stack Playwright per AI Sentinel (config, runner, LLM helpers, report).
- `shared/` – tipi e analizzatori condivisi tra frontend, backend e live debugger.
- `test/` e `src/test-*` – script di validazione (Vitest, Playwright) per SSD, HTML security, qualità variabili, PDF pipeline.
- `docs/` – documentazione tecnica (SSD quick reference, test analysis).
- `puppeteerServer.js` – microservizio Express per fetch HTML headless e metriche di performance.

## 3. Frontend (Vite + React)
- **Bootstrap**: `src/main.tsx` crea Router con layout a card (HomePage) e route dedicate per ogni tool (`src/pages/*.tsx`).
- **Stato globale**: `src/context/ContainerContext.tsx` conserva container GTM, metriche (`GtmMetrics`) e cronologia attività; persiste su `localStorage` e ricalcola analisi a ogni mutazione.
- **UI Framework**: Tailwind CSS e componenti UI custom in `src/components/ui/*`, animazioni Framer Motion, icone `lucide-react`, grafici Recharts e Chart.js.
- **Pagine chiave**:
  - **HomePage** (`src/pages/HomePage.tsx`) – griglia di card interactive per navigare tra strumenti (Container Manager, AI Plan, SSD Test, AI Sentinel, GA4 Insights, Live Debugger).
  - **DashboardPage** / **ContainerManagerPage** – upload JSON GTM, overview qualità, filtri Tag/Trigger/Variable, bulk fix automatizzati (`src/services/fixers.ts`), dettagli problemi e timeline attività.
  - **PlanPage** – orchestrazione LLM per redigere piani di misurazione Word; combina `analyzeGtmSection` (prompting LLM) e `renderMeasurementDoc` (docx).
  - **SSDTestPage** – wizard 3 step (upload, review, risultati) con modale progresso (`useAnalysisProgress`), editor DSL, log esecuzione.
  - **LiveDebuggerPage** – dashboard tempo reale con stream evento, filtri avanzati, inspector, libreria casi d'uso, assistente AI.
  - **GA4Insights.tsx** – UI analitica con controlli data range, prompt LLM, grafici (timeseries, bar, area), tabella pagine/eventi/canali, narrativa Markdown.
  - **AI Sentinel** component pages (p.es. `src/ai-sentinel/IntegratedReport.tsx`, `src/pages/ConsentReportPage.tsx`) – visualizzazioni consenso, screenshot, network trace.
- **Hook e servizi front-end**:
  - `src/services/apiService.ts` gestisce chiamate REST verso backend.
  - `src/hooks/useSSDConfig.ts`, `useAnalysisProgress.ts`, `useAbortController.ts` orchestrano handshake con API e UI.
  - `src/services/live-debugger-api.ts` e `src/components/live-debugger/*` implementano WebSocket client, filtri, use case editor.

## 4. Backend Express & API
- **Entrypoint SSD** (`server-ssd.ts`):
  - Middleware sicurezza: Helmet, rate limit, CORS configurabile, parsing JSON/URL-encoded.
  - Upload `multipart/form-data` con Multer, validazione dimensioni, salvataggio `uploads/`.
  - Router principali:
    - `GET /api/ssd/config` – parametri front-end (limiti file, estensioni, opzioni run).
    - `GET /api/ssd/fetch-html` – fetch remoto HTML, detection cookie banner via `extractCookieBannerWithPuppeteer`.
    - `POST /api/spec/generate` – pipeline PDF→test spec (testo estratto, arricchimento LLM, DSL).
    - `POST /api/ssd/run` – esecuzione test (consent + DSL) orchestrata da `SSDPuppeteerRunner`.
    - `POST /api/ga4/insights` – endpoint Express montato da `src/services/ga4-insights.server.ts`.
  - Integrazione AI Sentinel: `runConsentTest` da `src/ai-sentinel/pw-runner.ts` esegue Playwright prima/dopo PDF test.
- **Server legacy** (`server.js`) – espone `GET /api/fetchHtml` e versioni semplificate di ingest SSD; utile per debugging.
- **Live Debugger server** (`src/services/live-debugger-server.ts`):
  - Express + WebSocketServer con Playwright headless.
  - Normalizza eventi (`NormalizedEvent`), arricchisce con analyzer condiviso (`shared/analyzer.ts`), gestisce CRUD use-case (pushCasesStorage, pushUseCasesStorage) e richieste AI (OpenAI).
  - Espone API REST per gestione casi uso, salvataggio sessioni, assistente.
- **GA4 Insights router** (`src/services/ga4-insights.server.ts`):
  - Usa `@google-analytics/data` per report KPI/timeseries/canali/pagine/eventi/journey.
  - Costruisce prompt narrativo e invoca OpenAI se `OPENAI_API_KEY` presente.
  - Risposta aggregata `Resp` consumata da frontend (grafici + Markdown).
- **Puppeteer HTML proxy** (`puppeteerServer.js`):
  - Express standalone sul porto 4004, esegue `page.goto` headless, salva HTML su `temp-html/`, misura performance (Web Vitals, metrics) e restituisce snapshot HTML + metriche.

## 5. Pipeline SSD (Specification-Driven Testing)
1. **Upload** (`SSDTestPage`):
   - L'utente fornisce URL + PDF.
   - Configurazione (`useSSDConfig`) fornisce limiti file e MIME ammessi.
2. **Fetch HTML**:
   - Frontend invia `GET /api/ssd/fetch-html`.
   - Backend usa Puppeteer (`extractCookieBannerWithPuppeteer`) per individuare banner cookie, selettori CTA, screenshot e salvataggio su `temp-html/`.
   - Risultato memorizzato in cache (`cookieTestSpecCache`) per riuso nella successiva run DSL.
3. **Generazione DSL**:
   - `POST /api/spec/generate` o `POST /api/ssd/ingest` (variazione legacy) con PDF.
   - `pdfTextExtraction` produce testo continuo + chunking; fallback `pdfExtractionService` se necessario.
   - `llmPdfSpec` / `openaiSpecService` costruiscono prompt contestuale (testi PDF, snippet HTML, cookie banner) e invocano OpenAI (modello configurabile via `OPENAI_MODEL`).
   - `specValidation` (Zod) garantisce schema `TestSpec` (steps con azioni, aspettative, selectors, expected events).
4. **Esecuzione browser**:
   - Frontend chiama `POST /api/ssd/run` con DSL, testo PDF, path temporaneo e opzioni (`headless`, `consent` profili, allowed hosts).
   - `SSDPuppeteerRunner`:
     - Lancia Chromium headless (argomenti no-sandbox).
     - Aggancia dataLayer *universale* tramite `evaluateOnNewDocument`, patch di `push` su `window.dataLayer` e `google_tag_manager[...].dataLayer`.
     - Espone `__ssdCaptureDataLayerEvent` per stream eventi verso backend, con log condizionale.
     - Intercetta richieste (`page.setRequestInterception`) e filtra domini ammessi, registrando tracking hits (GA/Ads) in `trackingHits`.
     - Attiva SPA detection patch (override `history.pushState/replaceState` e listener `popstate`).
     - Per ogni profilo consenso (`accept`, `reject`, `both`):
       - Esegue `SSDConsentHandler` per interagire con CMP (selectors generati, fallback LLM).
       - `SSDTargetResolver` risolve selectors (LLM enhancer opzionale via `SSDLlmTargetEnhancer`).
       - `SSDExpectationMatcher` confronta eventi ottenuti vs aspettative (dataLayer, network, testo DOM).
       - Genera screenshot step, raccoglie network hits, costruisce `TestResult` (PASS/FAIL, reason, evidence).
5. **Report**:
   - Backend restituisce `{ report }` con `summary`, `results`, eventuali `cookieConsentTest`, `pdfTests`, `artifacts`.
   - Frontend `ResultsStep` e `DetailedResultsStep` renderizzano tabelle, timeline, screenshot, JSON viewer.
   - Artifacts salvati in `screenshots/` e `temp-pdf/` per debug.

## 6. AI Sentinel (Playwright) – Test consenso multi-vendor
- **Runner** (`src/ai-sentinel/pw-runner.ts`):
  - Lancia `chromium` Playwright con configurazione headless/hard-timeout personalizzabile (da `defaultConfig`).
  - Sequenza: apertura URL → `waitCookieBanner` → interazione banner → validazione eventi/consent → screenshot/report.
  - `waitCookieBanner` usa selettori universali e fallback LLM (`ConsentLLMService.suggestSelectorsFromHtml`) quando i pattern falliscono. Recupera hint linguistici dal DOM prima di invocare LLM.
  - `clickCommitOnBanner` identifica pulsanti "salva/imposta selezionati" evitando "accetta tutto"/"rifiuta" per test granulari.
  - `consentProbe` e `waitForConsentOrTimeout` osservano network, cookie, `window.gtag`, GTM dataLayer per confermare aggiornamenti stato consenso.
- **Configurazioni CMP** (`src/ai-sentinel/config.ts`):
  - Mappa vendor → selectors per `accept`, `reject`, `personalize`, `confirmSelected` + regex toggles (analytics/marketing/preferences).
  - Fallback generico + features (screenshot, trace, detection).
- **LLM**: `ConsentLLMService` orchestrato con API OpenAI, modelli configurabili via `OPENAI_LIVE_DEBUGGER_MODEL` o `OPENAI_MODEL`.
- **Reportistica**: risultati salvati, integrati in frontend (`src/ai-sentinel/IntegratedReport.tsx`, `src/components/ConsentReport.tsx`) con status, eventi, network, screenshot.

## 7. Live Tag Debugger (Puppeteer + WebSocket)
- **Server**: `live-debugger-server.ts`
  - Avvia Playwright Chromium, espone WebSocket per stream eventi normalizzati.
  - `resolveMacros` interpreta variabili GTM, `pushCasesStorage` e `pushUseCasesStorage` gestiscono libreria use-case.
  - Stream comprende: `datalayer.push`, `page.view`, hit GA (`ga4.hit`, `ua.hit`), Meta Pixel, LinkedIn Insight, Adobe Analytics, log console e aggiornamenti env.
  - `EventAnalyzer` (`shared/analyzer.ts`) produce insight (severity, recommendations) usati da AI assistant.
  - Assistente AI: `openaiClient` se API key presente, risponde a `AiAssistantRequest` (intent explain/fix/qa).
- **Frontend**:
  - `LiveDebuggerPage` + `components/live-debugger/*` – layout multi-pannello (stream eventi, inspector, filtri, timeline sessione, push library editor, network table multi-vendor).
  - Stato gestito con `useReducer`; filtri includono time range, tipi (GA/UA, Meta, LinkedIn, Adobe, Page view), measurement ID/pixel, search text, host regex.
  - Eventi arricchiti con highlight, details JSON, insight AI; page view e retry push mostrati con badge dedicati.

## 8. GA4 Insights
- **Backend**:
  - `runReport` esegue 5 query GA4: KPI generali, timeseries, channel grouping, top pagine, top eventi, funnel (channel → landing → event).
  - Risposta JSON serializza numeri convertiti con `Number`.
  - Prompt LLM (`buildInsightPrompt`) fornisce contesto e istruzioni (sintesi bullet, cause, azioni, anomalie, tabella OKR).
  - Richiede variabili ambiente `GOOGLE_APPLICATION_CREDENTIALS` o set di credenziali per `BetaAnalyticsDataClient`.
- **Frontend** (`GA4Insights.tsx`):
  - Form con date, prompt utente, stato `phase` (idle → ga4 → ai).
  - Visualizzazioni Recharts: line chart KPI, bar chart canali, area chart timeseries.
  - Markdown narrative renderizzata con `ReactMarkdown` e componenti personalizzati (styling card, tabelle).

## 9. Analisi e Remediation Container GTM
- **Metriche** (`src/services/gtm-metrics.ts`) – calcola score `0-100` per tags/triggers/variables, percentuali paused, unused, UA, naming issues.
- **Fixers** (`src/services/fixers.ts`) – suggeriscono naming standard, fallback DLV, default Lookup, wrapping JS in try/catch, forzano HTTPS, aggiungono idempotency guard, modificano timing trigger.
- **Contextual Trigger Quality** (`src/services/contextualTriggerQualityService.ts`) – controlli avanzati su pattern trigger.
- **UI** (`src/components/Dashboard.tsx`, `QualityAccordion.tsx`, `TriggerQualityCard.tsx`, ecc.) – presenta scoreboard, breakdown, issue cards, modali confirm, timeline attività.
- **AI Plan**:
  - `generateMeasurementDoc` orchestrato da `analyzeGtmSection` → LLM produce analisi per tags/triggers/variables.
  - `renderMeasurementDoc` usa `docx` per esportare `.docx` con sezioni personalizzate.
  - `PlanPage` salva anteprima su localStorage, visualizza loader Lottie e step animati.

## 10. Integrazione Puppeteer esterna
- **`puppeteerServer.js`**:
  - Espone `GET /api/fetchHtmlPuppeteer?url=...&multiStep=true/false`.
  - Esegue `page.goto` con user agent `GTM-Checklist`, disabilita cache, raccoglie metriche DOM + performance + Web Vitals.
  - Salva HTML su `temp-html/req_<timestamp>.txt` per analisi successive.
  - Raccoglie `performance.getEntriesByType()` (navigation, paint, LCP, FID, CLS) e metrics (heap, nodes, stylesheet, scripts).
- **Uso**: supporta debugging manuale, alimenta servizi che necessitano HTML completo oltre l'embed front-end.

## 11. Configurazione, variabili ambiente e script
- **Scripts NPM** (`package.json`):
  - `npm run dev` – esegue in parallelo backend (server-ssd), puppeteer server, live debugger server, frontend.
  - `npm run frontend` – avvia solo Vite.
  - `npm run backend` / `npm run ssd:server` – server Express/TSX.
  - `npm run puppeteer` – `node puppeteerServer.js`.
  - `npm run ssd:run:smoke`, `npm run ssd:validate` – smoke test e unit test SSD.
- **Env principali**:
  - `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_LIVE_DEBUGGER_MODEL`, `TARGET_LLM_MODEL`.
  - `PORT`, `CORS_ORIGIN`, `MAX_FILE_SIZE`, `RUNNER_*_TIMEOUT_MS`.
  - `PUPPETEER_ORIGIN_ALLOWLIST`, `PUPPETEER_ALLOWED_TRACKING`.
  - Credenziali GA4 (`GOOGLE_APPLICATION_CREDENTIALS` o `GA4_PROPERTY_ID` in configurazioni personalizzate).
  - `LIVE_DEBUGGER_PORT` per server websocket.
- **Directories runtime**:
  - `uploads/` – PDF ricevuti (Multer).
  - `temp-html/`, `temp-pdf/` – cache temporanea per HTML e PDF processati.
  - `screenshots/` – screenshot test SSD e AI Sentinel (organizzati per request ID).
  - `artifacts/`, `dist/`, `uploads/`, `secret/` – output vari, generati a runtime.

## 12. Testing e validazione
- **Vitest**: `npm run ssd:validate` avvia test unit `src/services/__tests__`.
- **Playwright/Puppeteer**: script in `test/` (es. `test-interactive-cmp.js`, `test-ssd-runner-smoke.ts`, `test-ga4.ts`) verificano pipeline end-to-end, hooking dataLayer, crawling PDF, fallback LLM.
- **Lint/TS**: `tsx` esegue TypeScript on-the-fly; `npx tsc --noEmit` segnalato come attualmente fallente per vecchi tipi AI Sentinel (documentato in `docs/SSD_TEST_OVERVIEW.md`).
- **Documentazione**: `docs/SSD_TEST_OVERVIEW.md`, `docs/SSD_TEST_ANALYSIS.md`, `LIVE_DEBUGGER_SETUP.md` forniscono manuali rapidi.

## 13. Flussi operativi consigliati
1. **Setup**: installa dipendenze (`npm install`), configura variabili (OpenAI, GA4, ecc.), assicurati che directory runtime esistano o lascia al server crearle.
2. **Avvio sviluppo**: `npm run dev` per avere backend SSD, live debugger, puppeteer proxy e frontend simultanei.
3. **Uso strumenti**:
   - Carica JSON GTM → esplora qualità → applica fixers → salva attività.
   - Genera piano misurazione AI → esegui export Word.
   - Carica PDF requisiti marketing → attendi generazione DSL → lancia test SSD → analizza report.
   - Avvia AI Sentinel per validare cookie banner su accetta/rifiuta → confronta screenshot e network trace.
   - Lancia live debugger per monitorare eventi real-time, usare use-case (expected hits) e chiedere spiegazioni all'assistente AI.
   - Esegui GA4 Insights per trend e narrativa AI.
4. **Analisi risultati**: consultare cartelle `screenshots/req_*`, `temp-html/req_*`, log in console server. Utilizzare `shared/analyzer` per arricchire insight o creare nuovi use-case.
5. **Testing**: lanciare smoke test SSD (`npm run ssd:run:smoke`) dopo modifiche alla pipeline; usare script Playwright per validare miglioramenti CMP.

## 14. Estendibilità e punti di integrazione
- **Modellazione DSL**: `src/types/ssd.ts` definisce `TestSpec`, `TestStep`, `Expectation` – può essere esteso per nuovi tipi di check (es. network assertions, DOM diff).
- **LLM**: wrapper `createSSDLLMService`, `SSDLlmTargetEnhancer`, `ConsentLLMService` centralizzano prompt e modelli. Possibile sostituire provider (Azure OpenAI, Anthropic) mantenendo interfaccia.
- **Hook dataLayer**: `setupDataLayerTracking` patcha ogni `push`; può essere esteso per `window.gtag` o `gtm.push` custom.
- **Consent runner**: config CMP modulare; aggiunta vendor comporta popolare `defaultConfig.cmp.selectors`.
- **Live debugger**: libreria use-case memorizzata su filesystem/DB (cartella `server/data`); facile promettere export/import.
- **GA4**: prompt custom tramite campo `prompt` UI; possibile aggiungere modelli di grafico o frequenza auto-aggiornamento.
- **CI/CD**: repository predisposto a pipeline che esegua `npm run build`, `npm run ssd:run:smoke`, eventuali test Playwright headless.

## 15. Riferimenti rapidi file chiave
- Frontend: `src/pages/HomePage.tsx`, `DashboardPage.tsx`, `PlanPage.tsx`, `SSDTestPage.tsx`, `GA4Insights.tsx`, `LiveDebuggerPage.tsx`, `ai-sentinel/*.tsx`.
- Backend: `server-ssd.ts`, `src/services/ga4-insights.server.ts`, `src/services/live-debugger-server.ts`, `server.js`, `puppeteerServer.js`.
- Servizi SSD: `src/services/pdfTextExtraction.ts`, `openaiSpecService.ts`, `ssdPuppeteerRunner.ts`, `ssdConsentHandler.ts`, `ssdExpectationMatcher.ts`, `ssdValidation.ts`, `ssdTargetResolver.ts`.
- AI Sentinel: `src/ai-sentinel/pw-runner.ts`, `config.ts`, `features/*`, `llm/consent-llm-service.ts`.
- Utility condivise: `shared/types.ts`, `shared/analyzer.ts`, `src/utils/*`.
- Documenti: `docs/SSD_TEST_OVERVIEW.md`, `docs/SSD_TEST_ANALYSIS.md`, `docs/PROJECT_OVERVIEW.md` (questo file).

---
Questo documento offre una mappa completa per comprendere l'applicativo, contestualizzare l'uso di Puppeteer/Playwright e identificare punti di estensione. È pensato per lettura sia umana sia da parte di agenti AI che necessitano di ricostruire rapidamente architettura, flussi e dipendenze operative.
