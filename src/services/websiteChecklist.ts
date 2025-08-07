// src/services/websiteChecklist.ts
// ---------------------------------------------------------------------------
// Servizio front-end: chiama il backend Puppeteer per ottenere l’HTML,
// il dataLayer e lo stato del consent mode, poi chiama GPT.
// ---------------------------------------------------------------------------

import OpenAI from 'openai';
import type {
  WebsiteChecklistResult,
  WebsiteChecklistChecks,
} from '../types/websiteChecklist';

// 1. Inizializza client OpenAI
const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
});

// 2. Recupera HTML + dati JS dal backend Puppeteer
async function fetchWebsiteData(url: string): Promise<{
  html: string;
  dataLayer: any[];
  consentModePresent: boolean;
}> {
  const res = await fetch(
    `http://localhost:4001/api/fetchHtmlPuppeteer?url=${encodeURIComponent(url)}`
  );

  if (!res.ok) {
    throw new Error(`Errore da Puppeteer: ${res.status}`);
  }

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error("Risposta non valida dal backend: atteso JSON.");
  }

  const json = await res.json();
  return {
    html: json.html || '',
    dataLayer: json.dataLayer || [],
    consentModePresent: json.consentModePresent || false,
  };
}

// 3. Funzione principale richiamata dalla ChecklistPage
export async function runWebsiteChecklist(
  url: string
): Promise<WebsiteChecklistResult> {
  // 3.1 Ottieni HTML e variabili JS
  const { html, dataLayer, consentModePresent } = await fetchWebsiteData(url);

  // 3.2 Check combinati (regex + JS context)
  const checks: WebsiteChecklistChecks = {
    'script gtm presente':
      /(googletagmanager\.com\/(gtm|gtag)\.js|GTM-[\w-]{6,10}|ns\.html\?id=GTM)/i.test(html),

    'id gtm valido': /GTM-[\w-]{6,10}/.test(html),

    'dataLayer inizializzato': Array.isArray(dataLayer) && dataLayer.length > 0,

    'consent mode': consentModePresent === true,

    'csp blocca gtm':
      /content-security-policy/i.test(html) &&
      !/googletagmanager/i.test(html),

    'cookie banner visibile':
      /(onetrust|otSDKStub|cookiebot|iubenda|complianz)/i.test(html),
  };

  // 3.3 Prompt per OpenAI
  const prompt = `
Analizza i seguenti dati raccolti dall'URL: ${url}

Risultati booleani:
${JSON.stringify(checks, null, 2)}

Estratto HTML (primi 4000 caratteri):
\`\`\`html
${html.slice(0, 4000)}
\`\`\`

- Riassumi le criticità reali (massimo 6 punti).
- Suggerisci le correzioni prioritarie in modo pratico.
`;

  // 3.4 Richiesta a OpenAI
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
  });

  // 3.5 Risultato finale
  return {
    url,
    checks,
    aiSummary: completion.choices[0].message.content ?? '',
  };
}