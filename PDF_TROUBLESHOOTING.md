# PDF Troubleshooting Guide

## Problema: "PDF validation failed: File is not a PDF"

Questo errore si verifica quando il sistema non riesce a riconoscere il file come un PDF valido. Ecco le cause più comuni e le soluzioni:

### 🔍 Diagnosi del Problema

1. **Controlla il tipo di file**: Assicurati che il file abbia estensione `.pdf`
2. **Verifica la firma PDF**: Il file deve iniziare con `%PDF`
3. **Controlla la dimensione**: Il file non deve superare i 10MB

### 🛠️ Soluzioni Comuni

#### 1. File ZIP rinominato come PDF
**Sintomi**: Errore con firma `PK` invece di `%PDF`
**Causa**: File PowerPoint/Word salvato come ZIP e rinominato
**Soluzione**:
- Apri il file in PowerPoint/Word
- Usa "Esporta" → "Crea PDF/XPS"
- Oppure "Stampa" → "Microsoft Print to PDF"

#### 2. File immagine rinominato come PDF
**Sintomi**: Errore con firma `GIF`, `PNG`, `JPEG`
**Causa**: Immagine salvata con estensione PDF
**Soluzione**:
- Usa un convertitore online (es. SmallPDF, ILovePDF)
- Oppure stampa l'immagine come PDF dal browser

#### 3. File HTML rinominato come PDF
**Sintomi**: Errore con firma `<!DOCTYPE` o `<html`
**Causa**: Pagina web salvata come PDF
**Soluzione**:
- Usa "Stampa" → "Salva come PDF" nel browser
- Oppure usa un'estensione browser per salvare come PDF

#### 4. File corrotto o danneggiato
**Sintomi**: Firma PDF corretta ma errore di parsing
**Causa**: File PDF danneggiato
**Soluzione**:
- Prova ad aprire il PDF in un visualizzatore
- Se si apre, salva nuovamente come PDF
- Se non si apre, ricrea il PDF dall'originale

### 🧪 Strumenti di Debug

#### 1. Script di Test (Node.js)
```bash
node test-pdf-validation.js your-file.pdf
```

#### 2. Debugger Web (Solo in sviluppo)
- Carica il file nel debugger PDF nella pagina SSD Test
- Controlla i dettagli tecnici del file
- Segui le raccomandazioni mostrate

#### 3. Controllo Manuale
```bash
# Controlla la firma del file
head -c 4 your-file.pdf

# Dovrebbe mostrare: %PDF
```

### ✅ Best Practices

1. **Sempre esportare come PDF** dall'applicazione originale
2. **Non rinominare** file con estensioni diverse
3. **Verificare la dimensione** (max 10MB)
4. **Testare il PDF** aprendolo prima di caricarlo

### 🔧 Configurazione Avanzata

Se continui ad avere problemi, controlla:

1. **Variabili d'ambiente**:
   ```bash
   MAX_UPLOAD_MB=10  # Dimensione massima file
   ```

2. **Log del server**:
   ```bash
   # Cerca questi log nel terminale del server
   File upload details: { ... }
   PDF validation details: { ... }
   PDF signature check: { ... }
   ```

3. **Endpoint di debug** (solo sviluppo):
   ```bash
   POST /api/ssd/debug-pdf
   ```

### 📞 Supporto

Se il problema persiste:
1. Controlla i log del server per dettagli tecnici
2. Usa il debugger PDF per analisi dettagliata
3. Verifica che il file sia un PDF valido con strumenti esterni
4. Prova con un PDF diverso per confermare il problema

---

**Nota**: Questo sistema è progettato per funzionare con PDF che contengono testo selezionabile. PDF basati su immagini potrebbero non funzionare correttamente.
