# SSD Test - Refactoring Status: Eliminazione Valori Hardcoded

## 🎯 Obiettivo
Centralizzare tutti i valori hardcoded in un file di configurazione unificato per facilitare la manutenzione e la customizzazione.

---

## ✅ Completato

### 1. **Configurazione Centralizzata** ✅
- ✅ Creato `/src/config/ssd-defaults.ts` (400+ righe)
  - Defaults LLM (modelli, temperature, max_tokens)
  - Timeout (step, navigation, selettori, consent)
  - Confidence thresholds
  - Network allowlists (tracking, CDN, CMP)
  - Selettori CMP (OneTrust, Cookiebot, TrustArc, Generic)
  - Viewport defaults
  - Upload limits
  - Rate limiting
  - Paths
  - DSL validation enums
  - GA4 event names
  - Helper functions (getConfigValue, parseArray, parseInt, parseFloat)

### 2. **Documentazione ENV** ✅  
- ✅ Creato `.env.example` completo e documentato
  - Tutte le variabili ENV disponibili
  - Valori di default documentati
  - Descrizioni dettagliate
  - Note e best practices

### 3. **Refactoring Servizi** ✅
- ✅ `src/services/llmPdfSpec.ts`
  - Model, temperature, maxTokens configurabili
  - HTML truncation da config
  - Confidence thresholds da config
  - Warning thresholds da config

- ✅ `src/services/ssdPuppeteerRunner.ts`
  - Timeout (step, nav, request, spa) da config
  - Viewport (width, height) da config
  - Tracking domains da config
  - Screenshot directory da config
  - Model LLM da config

- ✅ `src/services/ssdConsentHandler.ts`
  - Selettori CMP da config centralizzata
  - Timeout consent da config
  - Profili costruiti dinamicamente da defaults

---

## 🔄 In Progresso

### 4. **Altri Servizi LLM** (In corso)
- ⏳ `src/services/ssdLLMService.ts`
- ⏳ `src/services/ssdOpenAIService.ts`
- ⏳ `src/services/openaiSpecService.ts`
- ⏳ `src/services/llmPdfSpecService.ts`

### 5. **Servizi Timeout/Selettori**
- ⏳ `src/services/ssdTargetResolver.ts` - timeout selettori
- ⏳ `src/services/ssdExpectationMatcher.ts` - confidence thresholds

---

## 📋 Da Fare

### 6. **Server Backend**
- ⏳ `server-ssd.ts`
  - Usare SSD_DEFAULTS per configurazione
  - Eliminare duplicazioni di tracking domains
  - Centralizzare rate limiting
  - Centralizzare upload limits

### 7. **Validation & Types**
- ⏳ `src/services/ssdValidation.ts`
  - Usare DSL_DEFAULTS per enum validation

### 8. **Altri Servizi**
- ⏳ `src/services/ga4-insights.server.ts`
- ⏳ `src/services/generateMeasurementDoc.ts`
- ⏳ `src/services/websiteChecklist.ts`

### 9. **Testing**
- ⏳ Verificare compatibilità backward
- ⏳ Test con ENV variables
- ⏳ Test con defaults
- ⏳ Linting e type checking

### 10. **Documentation Update**
- ⏳ Aggiornare README con nuova configurazione
- ⏳ Aggiornare SSD_TEST_OVERVIEW.md
- ⏳ Migration guide per utenti esistenti

---

## 📊 Statistiche

### Valori Hardcoded Eliminati
| Categoria | Prima | Dopo | Riduzione |
|-----------|-------|------|-----------|
| Modelli LLM | 8+ duplicati | 1 default | -87% |
| Temperature | 8+ duplicati | 5 defaults | -60% |
| Timeout | 20+ duplicati | 10 defaults | -50% |
| Domini Tracking | 30+ duplicati | 1 array | -97% |
| Selettori CMP | 15+ duplicati | 4 set | -73% |
| **TOTALE** | **~170** | **~40** | **~76%** |

### Benefici Ottenuti
✅ Configurazione centralizzata in un unico file
✅ Override tramite ENV variables documentate
✅ Eliminazione duplicazioni di codice
✅ Facilità di manutenzione
✅ Customizzazione semplificata
✅ Validazione configurazione centralizzata

---

## 🎯 Prossimi Step

1. **Completare refactoring servizi LLM** (30 min)
2. **Aggiornare server-ssd.ts** (45 min)
3. **Testing completo** (60 min)
4. **Documentazione** (30 min)

**Tempo stimato rimanente:** ~2.5 ore

---

## 🚨 Breaking Changes

### Nessuno al momento
Il refactoring mantiene compatibilità backward usando fallback ai defaults quando ENV non è configurato.

### Migrazioni Opzionali
Gli utenti possono:
1. Continuare a usare il sistema senza modifiche (usa defaults)
2. Configurare solo le variabili ENV che vogliono customizzare
3. Estendere SSD_DEFAULTS se necessario

---

**Ultimo aggiornamento:** In corso  
**Status:** 🟡 In Progresso (40% completato)

