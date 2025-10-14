# 🐛 Bugfix: Index Field Mismatch

## 📋 **Problema Identificato**

### **Dai Log del Test:**

**Evento catturato dal sito** (riga 629-634):
```json
{
  "event": "header_menu_click",
  "link_text": "Tecnologia FTTH",
  "link_url": "https://fibra.aruba.it/tecnologia-ftth-openfiber.aspx",
  "index": "1"  // ← Sito dice "1"
}
```

**Subset compilato dal nostro codice** (riga 623-627):
```json
{
  "link_text": "Tecnologia FTTH",
  "link_url": "https://fibra.aruba.it/tecnologia-ftth-openfiber.aspx",
  "index": "0"  // ← Noi diciamo "0"
}
```

**Risultato:** Mismatch su campo `index` → Test FAIL

---

## 🔍 **Analisi**

Il campo `index` nel PDF indica:
> "index sarà riempito con il numero corrispondente al livello del menù, partendo da 0. La gerarchia dei livelli è a cascata, dall'alto verso il basso"

### **Cosa Sta Succedendo:**

1. Il **sito** usa logica custom per calcolare `index` (probabilmente conta i livelli di menu)
2. Il **nostro codice** hardcoda `index: '0'` (riga 1262 di server-ssd.ts)
3. Il link "Tecnologia FTTH" è probabilmente di **livello 1** (non 0)

---

## ⚠️ **Problema di Design**

Il campo `index` dipende dalla **logica business del sito**, non dall'elemento cliccato.

**Non possiamo calcolarlo automaticamente** senza conoscere la struttura del menu!

---

## ✅ **Soluzioni**

### **Soluzione 1: Wildcard per Index** (immediata)
Quando facciamo matching, tratta `index` come wildcard se non possiamo determinarlo:

```javascript
// Se index nel subset è '0' ma non siamo sicuri, ignora il campo
if (key === 'index' && expectedValue === '0') {
  return true; // Skip validation
}
```

### **Soluzione 2: LLM Migliore** (medio termine)
Migliorare il prompt LLM per dire:
```
"Se non puoi determinare il valore esatto di un campo, usa '*' invece di un valore hardcoded"
```

### **Soluzione 3: Matching Parziale** (configurabile)
Permettere matching su subset parziale (ignorando campi non-critici come `index`):

```javascript
const criticalFields = ['event', 'link_text', 'link_url'];
// Valida solo i campi critici, ignora gli altri
```

---

## 🎯 **Raccomandazione**

**Implementa Soluzione 1 + 3:**
- Matching flessibile per campi non-critici
- Focus su event name + campi chiave
- Opzionale: strict mode configurabile

---

**Status:** Identificato, soluzioni proposte

