// src/services/websiteChecklist.ts
// ---------------------------------------------------------------------------
// Servizio front-end: chiama il backend Express per ottenere l’HTML grezzo,
// esegue i check regex, poi chiede a GPT una diagnosi.
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

// 2. Recupera l’HTML originale tramite il backend (porta 4000)
async function fetchHtmlFromServer(url: string): Promise<string> {
  const res = await fetch(
    `http://localhost:4000/api/fetchHtml?url=${encodeURIComponent(url)}`
  );

  if (!res.ok) {
    throw new Error(`Errore proxy HTML: ${res.status}`);
  }

  return await res.text();
}

// 3. Funzione principale richiamata dalla ChecklistPage
export async function runWebsiteChecklist(
  url: string
): Promise<WebsiteChecklistResult> {
  // 3.1 Ottieni HTML
  const html = await fetchHtmlFromServer(url);

  // 3.2 Check statici (regex)
  const checks: WebsiteChecklistChecks = {
    'script gtm presente':
      /(googletagmanager\.com\/(gtm|gtag)\.js|GTM-[\w-]{6,10}|ns\.html\?id=GTM)/i.test(html),

    'id gtm valido': /GTM-[\w-]{6,10}/.test(html),

    'dataLayer inizializzato': /\bdataLayer\s*=\s*\[/i.test(html),

    'consent mode': /gtag\(['"]consent/i.test(html),

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