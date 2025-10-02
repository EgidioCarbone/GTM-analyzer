# 🎯 AI Sentinel - Scenari Custom Multipli

## 📋 Riepilogo Miglioramenti

### ✅ Cosa è stato implementato

1. **Validazione Scenari Custom**: Ogni scenario custom viene ora validato verificando che il dataLayer corrisponda esattamente alle scelte dell'utente
2. **Supporto Multiplo**: È possibile aggiungere più scenari custom in un singolo test
3. **Feedback Dettagliato**: Messaggi specifici per ogni scenario custom nel summary dei risultati

---

## 🔍 Come Funziona la Validazione

### **Scenario REJECT**
- ✅ **Nessun cookie** sensibile deve essere presente
- ✅ **Nessuna richiesta** GA/Ads deve essere intercettata
- ✅ **Tutti i consent mode** devono essere `denied`

```javascript
// dataLayer atteso:
{
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  ad_storage: 'denied',
  analytics_storage: 'denied'
}
```

### **Scenario ACCEPT**
- ✅ **Almeno un consent** deve essere `granted`
- ✅ **Tracking attivo** (cookie e/o richieste GA/Ads presenti)

```javascript
// dataLayer atteso (esempio):
{
  ad_user_data: 'granted',
  ad_personalization: 'granted',
  ad_storage: 'granted',
  analytics_storage: 'granted'
}
```

### **Scenario CUSTOM**
La validazione dipende dalle scelte specifiche:

#### Esempio 1: `Analytics:ON, Marketing:OFF, Preferences:ON`

**Stato atteso nel dataLayer:**
```javascript
{
  ad_user_data: 'denied',           // ❌ Marketing OFF
  ad_personalization: 'denied',     // ❌ Marketing OFF
  ad_storage: 'denied',             // ❌ Marketing OFF
  analytics_storage: 'granted'      // ✅ Analytics ON
}
```

**Validazioni applicate:**
- ✅ `analytics_storage` = `granted`
- ✅ `ad_storage` = `denied`
- ✅ `ad_personalization` = `denied`
- ✅ `ad_user_data` = `denied`
- ⚠️ Nessuna richiesta GA/Ads (perché marketing=OFF)

#### Esempio 2: `Analytics:OFF, Marketing:ON, Preferences:OFF`

**Stato atteso nel dataLayer:**
```javascript
{
  ad_user_data: 'granted',          // ✅ Marketing ON
  ad_personalization: 'granted',    // ✅ Marketing ON
  ad_storage: 'granted',            // ✅ Marketing ON
  analytics_storage: 'denied'       // ❌ Analytics OFF
}
```

**Validazioni applicate:**
- ✅ `analytics_storage` = `denied`
- ✅ `ad_storage` = `granted`
- ✅ `ad_personalization` = `granted`
- ✅ `ad_user_data` = `granted`
- ✅ Richieste GA/Ads presenti (perché marketing=ON)

#### Esempio 3: `Analytics:ON, Marketing:ON, Preferences:ON`

**Stato atteso nel dataLayer:**
```javascript
{
  ad_user_data: 'granted',          // ✅ Marketing ON
  ad_personalization: 'granted',    // ✅ Marketing ON
  ad_storage: 'granted',            // ✅ Marketing ON
  analytics_storage: 'granted'      // ✅ Analytics ON
}
```

**Validazioni applicate:**
- ✅ `analytics_storage` = `granted`
- ✅ `ad_storage` = `granted`
- ✅ `ad_personalization` = `granted`
- ✅ `ad_user_data` = `granted`

---

## 🚀 Come Usare gli Scenari Custom Multipli

### **1. Dall'Interfaccia UI**

1. Inserisci l'URL del sito da testare
2. Clicca su **"+ Aggiungi Scenario"**
3. Configura il primo scenario custom:
   - Nome: es. "Solo Analytics"
   - Toggle: ✅ Analytics, ❌ Marketing, ❌ Preferences
4. Clicca **"Aggiungi Scenario"**
5. Ripeti per aggiungere altri scenari:
   - Nome: es. "Solo Marketing"
   - Toggle: ❌ Analytics, ✅ Marketing, ❌ Preferences
6. Clicca **"Avvia Test Consenso"**

### **2. Via API**

```bash
curl -X POST http://localhost:4000/api/consent/audit-pw \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "options": {
      "timeoutSoftMs": 10000,
      "timeoutHardMs": 25000,
      "captureScreens": true,
      "trace": false,
      "region": "EU"
    },
    "customScenarios": [
      {
        "custom": {
          "analytics": true,
          "marketing": false,
          "preferences": true
        }
      },
      {
        "custom": {
          "analytics": false,
          "marketing": true,
          "preferences": false
        }
      },
      {
        "custom": {
          "analytics": true,
          "marketing": true,
          "preferences": true
        }
      }
    ]
  }'
```

---

## 📊 Output dei Risultati

### **Esempio di Summary con Scenari Custom**

```json
{
  "pass": true,
  "notes": [
    "REJECT: ✅ Nessun cookie sensibile rilevato",
    "REJECT: ✅ Nessuna richiesta GA/Ads rilevata",
    "ACCEPT: ✅ Consenso granted rilevato",
    "CUSTOM [Analytics:ON, Marketing:OFF, Preferences:ON]: ✅ Validazione superata",
    "CUSTOM [Analytics:OFF, Marketing:ON, Preferences:OFF]: ✅ Validazione superata",
    "CUSTOM [Analytics:ON, Marketing:ON, Preferences:ON]: ✅ Validazione superata"
  ]
}
```

### **Esempio con Fallimenti**

```json
{
  "pass": false,
  "notes": [
    "REJECT: ✅ Nessun cookie sensibile rilevato",
    "REJECT: ✅ Nessuna richiesta GA/Ads rilevata",
    "ACCEPT: ✅ Consenso granted rilevato",
    "CUSTOM [Analytics:ON, Marketing:OFF, Preferences:ON]: ❌ analytics_storage dovrebbe essere \"granted\" ma è \"denied\"",
    "CUSTOM [Analytics:ON, Marketing:OFF, Preferences:ON]: ⚠️ Marketing disabilitato ma rilevate 3 richieste GA/Ads"
  ]
}
```

---

## 🔧 Dettagli Tecnici

### **Mapping Categorie → Consent Mode**

| Categoria | Consent Mode Parameters |
|-----------|-------------------------|
| **Analytics** | `analytics_storage` |
| **Marketing** | `ad_storage`, `ad_personalization`, `ad_user_data` |
| **Preferences** | (Cookie tecnici, sempre granted) |

### **Logica di Validazione**

```typescript
// Analytics ON → analytics_storage deve essere 'granted'
if (selectedCategories.analytics === true) {
  if (consent.analytics_storage !== 'granted') {
    // ❌ FAIL
  }
}

// Marketing ON → tutti i parametri ad_* devono essere 'granted'
if (selectedCategories.marketing === true) {
  if (consent.ad_storage !== 'granted' ||
      consent.ad_personalization !== 'granted' ||
      consent.ad_user_data !== 'granted') {
    // ❌ FAIL
  }
}

// Marketing OFF → nessuna richiesta GA/Ads dovrebbe essere presente
if (selectedCategories.marketing === false && gaAdsRequests.length > 0) {
  // ⚠️ WARNING
}
```

### **Struttura Risultati**

```typescript
{
  "engine": "playwright",
  "url": "https://example.com",
  "generatedAt": "2025-01-01T12:00:00.000Z",
  "summary": {
    "pass": true,
    "notes": [...]
  },
  "results": {
    "reject": { /* ScenarioResult */ },
    "accept": { /* ScenarioResult */ },
    "custom-analyticstrue,marketingfalse,preferencestrue": { /* ScenarioResult */ },
    "custom-analyticsfalse,marketingtrue,preferencesfalse": { /* ScenarioResult */ }
  },
  "env": {
    "userAgent": "...",
    "locale": "it-IT",
    "region": "EU"
  }
}
```

---

## 🎯 Use Cases Comuni

### **1. Test Completo con Tutte le Combinazioni**
```javascript
customScenarios: [
  { custom: { analytics: true,  marketing: true,  preferences: true  } },
  { custom: { analytics: true,  marketing: false, preferences: true  } },
  { custom: { analytics: false, marketing: true,  preferences: true  } },
  { custom: { analytics: false, marketing: false, preferences: true  } }
]
```

### **2. Test Solo Analytics/Marketing**
```javascript
customScenarios: [
  { custom: { analytics: true,  marketing: false } },
  { custom: { analytics: false, marketing: true  } }
]
```

### **3. Test Granulare per Debugging**
```javascript
customScenarios: [
  { custom: { analytics: true, marketing: false, preferences: false } }
]
```

---

## ⚠️ Note Importanti

1. **Browser Isolati**: Ogni scenario (reject, accept, custom) viene eseguito in un browser completamente nuovo e isolato per evitare contaminazione
2. **Timeout**: Configurabile via `timeoutSoftMs` e `timeoutHardMs`
3. **Screenshot**: Ogni scenario cattura uno screenshot del cookie banner rilevato
4. **Performance**: Ogni scenario custom aggiunge circa 10-15 secondi al tempo totale del test
5. **CMP Support**: I selettori sono configurati per OneTrust, Cookiebot, Iubenda, Didomi, Usercentrics e fallback generico

---

## 🐛 Troubleshooting

### **Scenario custom non validato**
- ✅ Verifica che il cookie banner sia stato rilevato correttamente
- ✅ Controlla che i toggle siano stati configurati (visibili in `selectedCategories`)
- ✅ Verifica che il sito implementi Consent Mode v2

### **Timeout durante test custom**
- ✅ Aumenta `timeoutSoftMs` a 15000+
- ✅ Aumenta `timeoutHardMs` a 30000+
- ✅ Verifica che il pulsante "Conferma scelte" sia cliccabile

### **dataLayer non riflette le scelte**
- ✅ Verifica che il sito implementi correttamente il Consent Mode
- ✅ Controlla il log del browser per chiamate `gtag('consent', 'update', ...)`
- ✅ Valida che il CMP stia effettivamente aggiornando il dataLayer

---

## 📝 File Modificati

- ✅ `src/ai-sentinel/pw-runner.ts` - Aggiunta validazione scenari custom
  - Metodo `evaluateResults()` esteso
  - Aggiunto `formatCustomScenarioName()` helper

---

**Versione**: 2.1.0  
**Data**: Gennaio 2025  
**Autore**: AI Assistant

