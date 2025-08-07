// src/services/websiteChecklist.ts

import OpenAI from 'openai';
import type {
  WebsiteChecklistResult,
  WebsiteChecklistChecks,
} from '../types/websiteChecklist';

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
});

async function fetchWebsiteData(url: string): Promise<{
  html: string;
  dataLayer: any[];
  consentModePresent: boolean;
  consentModeCalls: any[];
  gtmIds: string[];
  cookieBannerLibs: string[];
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
    consentModeCalls: json.consentModeCalls || [],
    gtmIds: json.gtmIds || [],
    cookieBannerLibs: json.cookieBannerLibs || [],
  };
}

export async function runWebsiteChecklist(
  url: string
): Promise<WebsiteChecklistResult> {
  const {
    html,
    dataLayer,
    consentModePresent,
    consentModeCalls,
    gtmIds,
    cookieBannerLibs,
  } = await fetchWebsiteData(url);

  const checks: WebsiteChecklistChecks = {
    'script gtm presente':
      /(googletagmanager\.com\/(gtm|gtag)\.js|GTM-[\w-]{6,10}|ns\.html\?id=GTM)/i.test(html),
    'id gtm valido': gtmIds.length > 0,
    'dataLayer inizializzato': Array.isArray(dataLayer) && dataLayer.length > 0,
    'consent mode': consentModePresent === true,
    'csp blocca gtm':
      /content-security-policy/i.test(html) &&
      !/googletagmanager/i.test(html),
    'cookie banner visibile': cookieBannerLibs.length > 0,
  };

  const prompt = `
Analizza i seguenti dati raccolti dall'URL: ${url}

📌 ID GTM trovati: ${gtmIds.join(', ') || 'Nessuno'}
📌 Cookie Banner rilevati: ${cookieBannerLibs.join(', ') || 'Nessuno'}
📌 Chiamate gtag('consent'): ${consentModeCalls.length > 0 ? JSON.stringify(consentModeCalls, null, 2) : 'Nessuna'}

✅ Risultati booleani:
${JSON.stringify(checks, null, 2)}

📄 Estratto HTML (primi 4000 caratteri):
\`\`\`html
${html.slice(0, 4000)}
\`\`\`

Scrivi una diagnosi tecnica in italiano:
- Elenca fino a 6 criticità principali trovate.
- Per ognuna, spiega chiaramente perché è un problema.
- Aggiungi una lista di suggerimenti tecnici e pratici per correggere i problemi.
`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
  });

  return {
    url,
    checks,
    aiSummary: completion.choices[0].message.content ?? '',
    extra: {
      gtmIds,
      cookieBannerLibs,
      consentModeCalls,
    },
  };
}