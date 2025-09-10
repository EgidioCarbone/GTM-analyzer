// src/services/websiteChecklist.ts

import OpenAI from "openai";
import type {
  WebsiteChecklistResult,
  WebsiteChecklistChecks,
} from "../types/websiteChecklist";
import { cacheService } from "./cacheService";
import { toast } from "react-hot-toast";

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY, // ✅ Vite env, non process.env
  dangerouslyAllowBrowser: true,
});

/** Puppeteer backend con analisi multi-step */
async function fetchWebsiteData(url: string): Promise<{
  html: string;
  dataLayer: any[];
  consentModePresent: boolean;
  consentModeCalls: any[];
  gtmIds: string[];
  cookieBannerLibs: string[];
  performanceMetrics: any;
  accessibilityScore: number;
  seoScore: number;
  interactiveTestResults: any;
  screenshots: string[];
}> {
  const res = await fetch(
    `http://localhost:4001/api/fetchHtmlPuppeteer?url=${encodeURIComponent(url)}&multiStep=true`
  );

  if (!res.ok) throw new Error(`Errore da Puppeteer: ${res.status}`);

  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    throw new Error("Risposta non valida dal backend: atteso JSON.");
  }

  const json = await res.json();
  return {
    html: json.html || "",
    dataLayer: json.dataLayer || [],
    consentModePresent: json.consentModePresent || false,
    consentModeCalls: json.consentModeCalls || [],
    gtmIds: json.gtmIds || [],
    cookieBannerLibs: json.cookieBannerLibs || [],
    performanceMetrics: json.performanceMetrics || {},
    accessibilityScore: json.accessibilityScore || 0,
    seoScore: json.seoScore || 0,
    interactiveTestResults: json.interactiveTestResults || {},
    screenshots: json.screenshots || [],
  };
}

/** Estrae gtag('consent', ...) dall’HTML */
function extractConsentCallsFromHtml(html: string) {
  const out: { mode: string; payloadRaw: string }[] = [];
  const re =
    /gtag\s*\(\s*['"]consent['"]\s*,\s*['"]([^'"]+)['"]\s*,\s*(\{[^)]+\})\s*\)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    out.push({ mode: m[1], payloadRaw: m[2] });
  }
  return out;
}

/** Riepiloga il dataLayer */
function summarizeDataLayer(dataLayer: any[]) {
  const uniqueEvents = Array.from(
    new Set(
      dataLayer
        .map((e) => e?.event)
        .filter((e): e is string => typeof e === "string")
    )
  );

  const cmpSignals = Array.from(
    new Set(
      dataLayer
        .flatMap((e) => Object.keys(e || {}))
        .filter((k) => /consent|cmp|gdpr|privacy/i.test(k))
    )
  );

  const consentEntries = dataLayer.filter((e) =>
    Object.keys(e || {}).some((k) => /consent/i.test(k))
  );

  return {
    count: dataLayer.length,
    uniqueEvents,
    cmpSignals,
    consentEntriesCount: consentEntries.length,
    sampleConsentEntries: consentEntries.slice(0, 3),
  };
}

/** Fallback: crea osservazioni fattuali dallo snapshot se l'AI non le fornisce */
function buildFallbackObservations(params: {
  gtmIds: string[];
  cookieBannerLibs: string[];
  consentModePresent: boolean;
  dataLayerSummary: ReturnType<typeof summarizeDataLayer>;
  consentCallsFoundInHtml: { mode: string; payloadRaw: string }[];
}) {
  const { gtmIds, cookieBannerLibs, consentModePresent, dataLayerSummary, consentCallsFoundInHtml } =
    params;

  const obs: Array<{ titolo: string; prova: string }> = [];

  if (gtmIds.length) {
    obs.push({
      titolo: "GTM rilevato",
      prova: `GTM IDs: ${gtmIds.join(", ").slice(0, 150)}`,
    });
  }
  if (cookieBannerLibs.length) {
    obs.push({
      titolo: "Cookie banner rilevato",
      prova: `Librerie CMP: ${cookieBannerLibs.join(", ").slice(0, 150)}`,
    });
  }
  obs.push({
    titolo: "Consent Mode presenza",
    prova: `consentModePresent: ${String(consentModePresent)}`,
  });
  obs.push({
    titolo: "DataLayer iniziale",
    prova: `count: ${dataLayerSummary.count}, eventi: [${dataLayerSummary.uniqueEvents
      .slice(0, 5)
      .join(", ")}]`.slice(0, 150),
  });
  obs.push({
    titolo: "Chiamate gtag('consent') nell'HTML",
    prova: `trovate: ${consentCallsFoundInHtml.length}`,
  });

  return obs;
}

/** Calcola il performance score basato sulle metriche Core Web Vitals */
function calculatePerformanceScore(metrics: any): number {
  if (!metrics || typeof metrics !== 'object') return 0;

  let score = 100;
  let metricsCount = 0;
  
  // LCP (Largest Contentful Paint) - Good: <2.5s, Needs Improvement: 2.5-4s, Poor: >4s
  if (metrics.lcp && metrics.lcp > 0 && metrics.lcp !== "N/A") {
    metricsCount++;
    if (metrics.lcp > 4000) score -= 30;
    else if (metrics.lcp > 2500) score -= 15;
  }
  
  // FID (First Input Delay) - Good: <100ms, Needs Improvement: 100-300ms, Poor: >300ms
  if (metrics.fid && metrics.fid > 0 && metrics.fid !== "N/A") {
    metricsCount++;
    if (metrics.fid > 300) score -= 25;
    else if (metrics.fid > 100) score -= 10;
  }
  
  // CLS (Cumulative Layout Shift) - Good: <0.1, Needs Improvement: 0.1-0.25, Poor: >0.25
  if (metrics.cls && metrics.cls >= 0 && metrics.cls !== "N/A") {
    metricsCount++;
    if (metrics.cls > 0.25) score -= 25;
    else if (metrics.cls > 0.1) score -= 10;
  }
  
  // FCP (First Contentful Paint) - Good: <1.8s, Needs Improvement: 1.8-3s, Poor: >3s
  if (metrics.fcp && metrics.fcp > 0 && metrics.fcp !== "N/A") {
    metricsCount++;
    if (metrics.fcp > 3000) score -= 20;
    else if (metrics.fcp > 1800) score -= 10;
  }
  
  // TTFB (Time to First Byte) - Good: <800ms, Needs Improvement: 800-1800ms, Poor: >1800ms
  if (metrics.ttfb && metrics.ttfb > 0 && metrics.ttfb !== "N/A") {
    metricsCount++;
    if (metrics.ttfb > 1800) score -= 15;
    else if (metrics.ttfb > 800) score -= 8;
  }
  
  // Se non abbiamo metriche valide, restituisci un score neutro
  if (metricsCount === 0) {
    return 50; // Score neutro quando non ci sono metriche valide
  }
  
  return Math.max(0, Math.min(100, score));
}

/** Fallback: suggerisci prossimi test interattivi */
function buildFallbackNextSteps(cookieBannerLibs: string[]) {
  const hasOneTrust = cookieBannerLibs.some((x) =>
    /onetrust/i.test(String(x))
  );

  const steps: string[] = [];

  steps.push(
    "Prima del consenso: verificare che non partano chiamate di marketing e che i cookie non essenziali non vengano impostati."
  );

  if (hasOneTrust) {
    steps.push(
      "Click su 'Accetta tutti' del banner OneTrust e verificare `gtag('consent','update', {...})` e nuovi push nel dataLayer."
    );
    steps.push(
      "Click su 'Rifiuta tutti' e verificare che i tag marketing restino bloccati e che i consensi risultino denied."
    );
    steps.push(
      "Aprire Preferenze OneTrust, selezionare alcune categorie, salvare e verificare gating selettivo dei tag."
    );
  } else {
    steps.push(
      "Accetta tutti i cookie dalla CMP e verificare `gtag('consent','update', {...})` e nuovi push nel dataLayer."
    );
    steps.push(
      "Rifiuta tutti i cookie e verificare che i tag marketing restino bloccati."
    );
  }

  steps.push(
    "Ricaricare la pagina per controllare la persistenza del consenso e il comportamento dei tag al ritorno."
  );

  return steps;
}

/** Converte il JSON dell'auditor in un report leggibile (Markdown) */
function renderReportFromJson(a: any): string {
  try {
    if (!a || typeof a !== "object") {
      return "Impossibile leggere i risultati dell'analisi.";
    }

    const criticita: any[] = Array.isArray(a.criticita) ? a.criticita : [];
    const nonVer: string[] = Array.isArray(a.non_verificabile_snapshot_iniziale)
      ? a.non_verificabile_snapshot_iniziale
      : [];
    const noteNormali: string[] = Array.isArray(a.note_normali)
      ? a.note_normali
      : [];
    const osservazioni: any[] = Array.isArray(a.osservazioni_fattuali)
      ? a.osservazioni_fattuali
      : [];
    const nextSteps: string[] = Array.isArray(a.prossimi_test)
      ? a.prossimi_test
      : [];

    const lines: string[] = [];
    lines.push("### Diagnosi Tecnica");

    if (criticita.length === 0) {
      lines.push(
        "Non sono emerse **criticità** dai dati dello snapshot iniziale (pre-interazione)."
      );
    } else {
      lines.push("**Criticità rilevate:**");
      criticita.forEach((c, i) => {
        const titolo = c?.titolo ?? `Criticità ${i + 1}`;
        const perche = c?.perche ?? "—";
        const prova = c?.prova ? `\`${String(c.prova).slice(0, 150)}\`` : "—";
        const fix = c?.fix ?? "—";
        lines.push(
          `${i + 1}. **${titolo}**\n` +
            `   - Motivo: ${perche}\n` +
            `   - Prova: ${prova}\n` +
            `   - Fix: ${fix}`
        );
      });
    }

    if (osservazioni.length) {
      lines.push("**Osservazioni dallo snapshot:**");
      osservazioni.forEach((o) =>
        lines.push(
          `- **${o?.titolo ?? "Osservazione"}** — prova: \`${String(
            o?.prova ?? ""
          ).slice(0, 150)}\``
        )
      );
    }

    if (noteNormali.length) {
      lines.push("**Comportamenti normali nello snapshot iniziale:**");
      noteNormali.forEach((n) => lines.push(`- ${n}`));
    }

    if (nonVer.length) {
      lines.push("**Non verificabile nello snapshot iniziale:**");
      nonVer.forEach((n) => lines.push(`- ${n}`));
    }

    if (nextSteps.length) {
      lines.push("**Prossimi test interattivi consigliati:**");
      nextSteps.forEach((s) => lines.push(`- ${s}`));
    }

    if (nonVer.length || nextSteps.length) {
      lines.push(
        "_Suggerimento_: eseguire test interattivi (accetta/rifiuta dal banner, ricarica, naviga) e catturare nuovi push del `dataLayer`/chiamate `gtag('consent')`."
      );
    }

    return lines.join("\n\n");
  } catch {
    return "Impossibile formattare il report.";
  }
}

export async function runWebsiteChecklist(
  url: string,
  onProgress?: (step: string, status: 'running' | 'completed' | 'error', details?: string) => void
): Promise<WebsiteChecklistResult> {
  try {
    // Check cache first
    const cacheKey = cacheService.generateUrlKey(url);
    const cachedResult = cacheService.get(cacheKey);
    
    if (cachedResult) {
      console.log('Returning cached result for:', url);
      return cachedResult;
    }

    // Inizia l'analisi
    onProgress?.('navigation', 'running', 'Navigando verso il sito...');
    await new Promise(resolve => setTimeout(resolve, 500));

    onProgress?.('navigation', 'completed', 'Sito caricato con successo');
    onProgress?.('html_extraction', 'running', 'Estraendo HTML e analizzando il codice...');
    await new Promise(resolve => setTimeout(resolve, 300));

    const {
      html,
      dataLayer,
      consentModePresent,
      consentModeCalls,
      gtmIds,
      cookieBannerLibs,
      performanceMetrics = {},
      accessibilityScore = 0,
      seoScore = 0,
      interactiveTestResults = {},
      screenshots = [],
    } = await fetchWebsiteData(url);

    onProgress?.('html_extraction', 'completed', `HTML estratto (${Math.round(html.length / 1024)}KB)`);
    onProgress?.('gtm_detection', 'running', `Rilevando GTM... Trovati ${gtmIds.length} container`);
    await new Promise(resolve => setTimeout(resolve, 300));

    onProgress?.('gtm_detection', 'completed', `GTM rilevato: ${gtmIds.join(', ')}`);
    onProgress?.('consent_analysis', 'running', 'Analizzando Consent Mode e banner cookie...');
    await new Promise(resolve => setTimeout(resolve, 300));

    // Estrazioni locali aggiuntive
    const consentCallsFoundInHtml = extractConsentCallsFromHtml(html);
    const dataLayerSummary = summarizeDataLayer(dataLayer);

    onProgress?.('consent_analysis', 'completed', `Consent Mode: ${consentModePresent ? 'Attivo' : 'Non rilevato'}, Banner: ${cookieBannerLibs.join(', ') || 'Nessuno'}`);
    onProgress?.('performance_metrics', 'running', 'Calcolando Core Web Vitals...');
    await new Promise(resolve => setTimeout(resolve, 300));

    // Calcola score complessivi
    const performanceScore = calculatePerformanceScore(performanceMetrics);
    const overallScore = Math.round((performanceScore + accessibilityScore + seoScore) / 3);

    onProgress?.('performance_metrics', 'completed', `Performance: ${performanceScore}%, Accessibilità: ${accessibilityScore}%, SEO: ${seoScore}%`);
    onProgress?.('interactive_tests', 'running', 'Eseguendo test interattivi...');
    await new Promise(resolve => setTimeout(resolve, 300));

  // Aggiungi dati di fallback se mancanti e gestisci valori "N/A"
  const enhancedPerformanceMetrics = {
    ...performanceMetrics, // Prima applica tutti i dati originali
    // Poi sovrascrivi solo i valori che sono effettivamente "N/A" o non validi
    lcp: performanceMetrics.lcp && performanceMetrics.lcp !== "N/A" ? performanceMetrics.lcp : 0,
    fid: performanceMetrics.fid && performanceMetrics.fid !== "N/A" ? performanceMetrics.fid : 0,
    cls: performanceMetrics.cls && performanceMetrics.cls !== "N/A" ? performanceMetrics.cls : 0,
    fcp: performanceMetrics.fcp && performanceMetrics.fcp !== "N/A" ? performanceMetrics.fcp : 0,
    ttfb: performanceMetrics.ttfb && performanceMetrics.ttfb !== "N/A" ? performanceMetrics.ttfb : 0,
    speedIndex: performanceMetrics.speedIndex && performanceMetrics.speedIndex !== "N/A" ? performanceMetrics.speedIndex : 0,
    totalBlockingTime: performanceMetrics.totalBlockingTime && performanceMetrics.totalBlockingTime !== "N/A" ? performanceMetrics.totalBlockingTime : 0,
    nodes: performanceMetrics.nodes && performanceMetrics.nodes !== "N/A" ? performanceMetrics.nodes : 0,
    layoutCount: performanceMetrics.layoutCount && performanceMetrics.layoutCount !== "N/A" ? performanceMetrics.layoutCount : 0,
    recalcStyleCount: performanceMetrics.recalcStyleCount && performanceMetrics.recalcStyleCount !== "N/A" ? performanceMetrics.recalcStyleCount : 0,
    layoutDuration: performanceMetrics.layoutDuration && performanceMetrics.layoutDuration !== "N/A" ? performanceMetrics.layoutDuration : 0,
    recalcStyleDuration: performanceMetrics.recalcStyleDuration && performanceMetrics.recalcStyleDuration !== "N/A" ? performanceMetrics.recalcStyleDuration : 0,
    scriptDuration: performanceMetrics.scriptDuration && performanceMetrics.scriptDuration !== "N/A" ? performanceMetrics.scriptDuration : 0,
    taskDuration: performanceMetrics.taskDuration && performanceMetrics.taskDuration !== "N/A" ? performanceMetrics.taskDuration : 0,
    jsHeapUsedSize: performanceMetrics.jsHeapUsedSize && performanceMetrics.jsHeapUsedSize !== "N/A" ? performanceMetrics.jsHeapUsedSize : 0,
    jsHeapTotalSize: performanceMetrics.jsHeapTotalSize && performanceMetrics.jsHeapTotalSize !== "N/A" ? performanceMetrics.jsHeapTotalSize : 0,
    domContentLoaded: performanceMetrics.domContentLoaded && performanceMetrics.domContentLoaded !== "N/A" ? performanceMetrics.domContentLoaded : 0,
    loadComplete: performanceMetrics.loadComplete && performanceMetrics.loadComplete !== "N/A" ? performanceMetrics.loadComplete : 0,
  };

  // Aggiungi dati di fallback per i test interattivi
  const enhancedInteractiveTestResults = {
    acceptAllTest: {
      passed: false,
      consentUpdated: false,
      marketingTagsFired: false,
      dataLayerEvents: []
    },
    rejectAllTest: {
      passed: false,
      marketingTagsBlocked: false,
      consentDenied: false,
      dataLayerEvents: []
    },
    navigationTest: {
      passed: false,
      consentPersisted: false,
      gtmLoaded: false
    },
    ...interactiveTestResults
  };

  // Check booleani per la "griglia"
  const checks: WebsiteChecklistChecks = {
    "script gtm presente":
      /(googletagmanager\.com\/(gtm|gtag)\.js|GTM-[\w-]{6,10}|ns\.html\?id=GTM)/i.test(
        html
      ),
    "id gtm valido": gtmIds.length > 0,
    "dataLayer inizializzato": Array.isArray(dataLayer) && dataLayer.length > 0,
    "consent mode": consentModePresent === true,
    "csp blocca gtm":
      /content-security-policy/i.test(html) && !/googletagmanager/i.test(html),
    "cookie banner visibile": cookieBannerLibs.length > 0,
    "performance ottimale": performanceScore >= 80,
    "accessibility buona": accessibilityScore >= 80,
    "seo ottimizzato": seoScore >= 80,
    "consenso funzionante": interactiveTestResults?.acceptAllTest?.passed && interactiveTestResults?.rejectAllTest?.passed,
    "test interattivi passati": interactiveTestResults?.navigationTest?.passed,
  };

    onProgress?.('interactive_tests', 'completed', `Test completati: ${Object.keys(interactiveTestResults).length} test eseguiti`);
    onProgress?.('ai_analysis', 'running', 'Elaborando con intelligenza artificiale...');
    await new Promise(resolve => setTimeout(resolve, 500));

    // Tronchiamo per non esplodere i token
    const htmlExcerpt = html.slice(0, 3000);
    const dataLayerExcerpt = JSON.stringify(dataLayer.slice(0, 5), null, 2);

    // 🧠 Prompt AI migliorato per analisi più intelligente e completa
    const prompt = `
Analizza i seguenti dati raccolti dall'URL: ${url}

📌 GTM IDs: ${JSON.stringify(gtmIds)}
📌 Cookie Banner rilevati: ${JSON.stringify(cookieBannerLibs)}
📌 Consent mode presente: ${consentModePresent}
📌 Chiamate gtag('consent') nell'HTML: ${JSON.stringify(consentCallsFoundInHtml)}
📌 Chiamate consentMode viste a runtime: ${JSON.stringify(consentModeCalls, null, 2)}

📊 DataLayer (riassunto):
${JSON.stringify(dataLayerSummary, null, 2)}

📊 DataLayer (prime 5 entries grezze):
${dataLayerExcerpt}

📄 Estratto HTML (primi 3000 caratteri):
\`\`\`html
${htmlExcerpt}
\`\`\`

🚀 METRICHE PERFORMANCE:
${JSON.stringify(performanceMetrics, null, 2)}

♿ ACCESSIBILITY SCORE: ${accessibilityScore}/100
🔍 SEO SCORE: ${seoScore}/100

🧪 RISULTATI TEST INTERATTIVI:
${JSON.stringify(interactiveTestResults, null, 2)}

REGOLE FERREE (non infrangerle):
- Snapshot PRE-interazione: è NORMALE non vedere aggiornamenti di consenso. NON è una criticità.
- Segna una criticità SOLO se puoi incollare un ESTRATTO TESTUALE (≤150 caratteri) preso dai dati forniti che la prova.
- Se l'unica "prova" è che qualcosa NON si vede nello snapshot, NON è una criticità: spostala in "non_verificabile_snapshot_iniziale".
- Niente assunzioni o deduzioni per assenza: usa SOLO i dati forniti.

CRITERI AMMESSI DI VIOLAZIONE (servono prove dirette):
- Tracciamenti prima del consenso (es. cookie non essenziali impostati, chiamate di marketing, script che bypassano il consenso) — fornisci l'estratto.
- Meccanismi di consenso palesemente assenti **e contestualmente** tag di marketing attivi senza gating — fornisci gli estratti (es. nessuna CMP rilevata + tag marketing che partono).
- CSP che impedisce il rispetto del consenso (es. blocca gtag/gtm/consent) — fornisci l'estratto dell'header/HTML.
- Performance critiche (LCP >4s, FID >300ms, CLS >0.25) — fornisci i valori specifici.
- Problemi di accessibilità gravi (score <50) — fornisci dettagli specifici.
- Problemi SEO critici (score <50) — fornisci dettagli specifici.

NOTE NORMALI (non sono problemi nello snapshot iniziale):
- Consensi default "denied".
- Nessun evento CMP/consent nel dataLayer.
- Nessuna chiamata gtag('consent') successiva.
- Performance accettabili (LCP <2.5s, FID <100ms, CLS <0.1).
- Accessibilità buona (score >80).
- SEO ottimizzato (score >80).

OUTPUT OBBLIGATORIO — restituisci **solo** JSON valido:
{
  "criticita": [
    {
      "titolo": "string",
      "perche": "string",
      "prova": "estratto ≤150 char tratto dai dati forniti",
      "fix": "string",
      "categoria": "consenso|performance|accessibility|seo|sicurezza"
    }
  ],
  "non_verificabile_snapshot_iniziale": [
    "Aggiornamento consensi post-interazione",
    "Eventi CMP nel dataLayer dopo click"
  ],
  "note_normali": [
    "Consensi default 'denied' allo start",
    "Assenza di eventi di consenso allo start",
    "Nessuna chiamata gtag('consent') successiva allo start"
  ],
  "osservazioni_fattuali": [
    { "titolo": "string", "prova": "estratto ≤150 char dai dati" }
  ],
  "prossimi_test": [
    "step operativo breve (es. Click 'Accetta tutti' e verifica gtag('consent','update', ...))"
  ],
  "raccomandazioni": [
    {
      "categoria": "performance|accessibility|seo|consenso",
      "priorita": "alta|media|bassa",
      "titolo": "string",
      "descrizione": "string",
      "impatto": "string"
    }
  ]
}

IMPORTANTISSIMO:
- Se non trovi **prove dirette**, metti "criticita": [].
- Non aggiungere testo fuori dal JSON.
- Considera il contesto del sito per adattare l'analisi.
- Fornisci raccomandazioni specifiche e actionable.
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Sei un auditor tecnico GTM/CMP esperto. Analizza i dati forniti e produci solo JSON valido rispettando le regole ferree. Fornisci raccomandazioni specifiche e actionable.",
        },
        { role: "user", content: prompt },
      ],
    });

    onProgress?.('ai_analysis', 'completed', 'Analisi AI completata');
    await new Promise(resolve => setTimeout(resolve, 300));

  // Parse sicuro del JSON dell'AI
  const raw = completion.choices[0].message.content ?? "{}";
  let aiJson: any = {};
  let aiJsonPretty = "{}";
  try {
    aiJson = JSON.parse(raw);
    aiJsonPretty = JSON.stringify(aiJson, null, 2);
  } catch {
    // Se (raramente) non arriva JSON valido, usiamo il raw
    aiJson = {
      criticita: [],
      note_normali: [],
      non_verificabile_snapshot_iniziale: [],
      osservazioni_fattuali: [],
      prossimi_test: [],
      raw,
    };
    aiJsonPretty = raw;
  }

  // Fallback: arricchisci osservazioni e next steps se l'AI non li ha forniti
  if (
    !Array.isArray(aiJson.osservazioni_fattuali) ||
    aiJson.osservazioni_fattuali.length === 0
  ) {
    aiJson.osservazioni_fattuali = buildFallbackObservations({
      gtmIds,
      cookieBannerLibs,
      consentModePresent,
      dataLayerSummary,
      consentCallsFoundInHtml,
    });
    aiJsonPretty = JSON.stringify(aiJson, null, 2);
  }

  if (!Array.isArray(aiJson.prossimi_test) || aiJson.prossimi_test.length === 0) {
    aiJson.prossimi_test = buildFallbackNextSteps(cookieBannerLibs);
    aiJsonPretty = JSON.stringify(aiJson, null, 2);
  }

  // Render testuale leggibile dalla struttura
  const textReport = renderReportFromJson(aiJson);

  const result: WebsiteChecklistResult = {
    url,
    checks,
    aiSummary: textReport, // ✅ testo leggibile per l'UI
    performanceScore,
    accessibilityScore,
    seoScore,
    overallScore,
    extra: {
      aiJson, // struttura originale
      aiJsonPretty, // JSON formattato (se vuoi esporlo con "Mostra dati grezzi")
      gtmIds,
      cookieBannerLibs,
      consentModeCalls,
      consentCallsFoundInHtml,
      dataLayerSummary,
      performanceMetrics: enhancedPerformanceMetrics,
      interactiveTestResults: enhancedInteractiveTestResults,
      screenshots,
      timeline: [
        {
          timestamp: Date.now() - 10000,
          event: "Page Load",
          data: { gtmIds, cookieBannerLibs, consentModePresent }
        },
        {
          timestamp: Date.now() - 5000,
          event: "DataLayer Analysis",
          data: dataLayerSummary
        },
        {
          timestamp: Date.now(),
          event: "Analysis Complete",
          data: { performanceScore, accessibilityScore, seoScore, overallScore }
        }
      ]
    },
  };

    // Cache the result for 5 minutes
    cacheService.set(cacheKey, result, 5 * 60 * 1000);

    return result;
  } catch (error) {
    console.error('Website checklist failed:', error);
    toast.error(`Errore nell'analisi del sito: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`);
    
    // Return fallback result
    return {
      url,
      checks: {} as WebsiteChecklistChecks,
      aiSummary: 'Errore durante l\'analisi del sito web',
      performanceScore: 0,
      accessibilityScore: 0,
      seoScore: 0,
      overallScore: 0,
      extra: {
        gtmIds: [],
        cookieBannerLibs: [],
        consentModeCalls: [],
        consentCallsFoundInHtml: [],
        dataLayerSummary: { count: 0, uniqueEvents: [], cmpSignals: [], consentEntriesCount: 0, sampleConsentEntries: [] },
        performanceMetrics: {},
        interactiveTestResults: {},
        screenshots: [],
        timeline: []
      }
    };
  }
}
