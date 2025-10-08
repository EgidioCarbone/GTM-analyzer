// test-genertel.js
// Test specifico per il sito Genertel per identificare problemi con il cookie banner

import fetch from 'node-fetch';

const PUPPETEER_URL = 'http://localhost:4001/api/fetchHtmlPuppeteer';
const TEST_URL = 'https://www.genertel.it/';

async function testGenertel() {
  console.log('🧪 Test specifico per Genertel.it');
  console.log('=' .repeat(50));
  
  try {
    console.log('📡 Chiamando Puppeteer per Genertel...');
    const response = await fetch(`${PUPPETEER_URL}?url=${encodeURIComponent(TEST_URL)}&multiStep=true`);
    
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }
    
    const data = await response.json();
    
    console.log('\n📊 Dati ricevuti da Puppeteer:');
    console.log('- HTML length:', data.html?.length || 0);
    console.log('- GTM IDs:', data.gtmIds || []);
    console.log('- Cookie Banner Libs:', data.cookieBannerLibs || []);
    console.log('- Consent Mode Present:', data.consentModePresent);
    console.log('- DataLayer entries:', data.dataLayer?.length || 0);
    console.log('- Screenshots count:', data.screenshots?.length || 0);
    
    // Analisi dettagliata del cookie banner
    console.log('\n🍪 Analisi Cookie Banner:');
    if (data.cookieBannerLibs && data.cookieBannerLibs.length > 0) {
      console.log('✅ Cookie banner rilevato:', data.cookieBannerLibs.join(', '));
    } else {
      console.log('❌ Nessun cookie banner rilevato');
    }
    
    // Controlla se ci sono screenshot
    if (data.screenshots && data.screenshots.length > 0) {
      console.log('✅ Screenshots catturati:', data.screenshots.length);
      console.log('- Dimensione primo screenshot:', data.screenshots[0]?.length || 0, 'caratteri base64');
    } else {
      console.log('❌ Nessuno screenshot catturato');
    }
    
    // Analizza l'HTML per cookie banner
    console.log('\n🔍 Analisi HTML per cookie banner:');
    const html = data.html || '';
    
    // Cerca pattern comuni di cookie banner
    const cookiePatterns = [
      /cookie/i,
      /consent/i,
      /gdpr/i,
      /privacy/i,
      /onetrust/i,
      /cookiebot/i,
      /iubenda/i,
      /complianz/i,
      /accetta/i,
      /rifiuta/i,
      /accept/i,
      /reject/i
    ];
    
    const foundPatterns = cookiePatterns.filter(pattern => pattern.test(html));
    console.log('- Pattern cookie trovati:', foundPatterns.length);
    foundPatterns.forEach(pattern => {
      const matches = html.match(new RegExp(pattern.source, 'gi'));
      console.log(`  - ${pattern.source}: ${matches ? matches.length : 0} occorrenze`);
    });
    
    // Cerca elementi specifici nel DOM
    const domElements = [
      'cookie-consent',
      'cookie-banner',
      'consent-banner',
      'gdpr-banner',
      'onetrust',
      'cookiebot',
      'iubenda',
      'complianz'
    ];
    
    console.log('\n🏗️ Elementi DOM cookie banner:');
    domElements.forEach(element => {
      const regex = new RegExp(`<[^>]*class[^>]*${element}[^>]*>`, 'gi');
      const matches = html.match(regex);
      if (matches) {
        console.log(`  - ${element}: ${matches.length} elementi trovati`);
        console.log(`    Esempio: ${matches[0].substring(0, 100)}...`);
      }
    });
    
    // Controlla se ci sono script di cookie banner
    console.log('\n📜 Script cookie banner:');
    const scriptPatterns = [
      /googletagmanager/i,
      /gtag/i,
      /onetrust/i,
      /cookiebot/i,
      /iubenda/i,
      /complianz/i
    ];
    
    scriptPatterns.forEach(pattern => {
      const matches = html.match(new RegExp(`<script[^>]*${pattern.source}[^>]*>`, 'gi'));
      if (matches) {
        console.log(`  - ${pattern.source}: ${matches.length} script trovati`);
      }
    });
    
    // Test interattivi
    console.log('\n🧪 Test Interattivi:');
    const interactive = data.interactiveTestResults || {};
    console.log('- Accept All Test:', interactive.acceptAllTest?.passed ? '✅' : '❌');
    console.log('- Reject All Test:', interactive.rejectAllTest?.passed ? '✅' : '❌');
    console.log('- Navigation Test:', interactive.navigationTest?.passed ? '✅' : '❌');
    
    // Performance metrics
    console.log('\n🚀 Performance Metrics:');
    const perf = data.performanceMetrics || {};
    console.log('- LCP:', perf.lcp || 'N/A', 'ms');
    console.log('- FCP:', perf.fcp || 'N/A', 'ms');
    console.log('- TTFB:', perf.ttfb || 'N/A', 'ms');
    console.log('- Speed Index:', perf.speedIndex || 'N/A', 'ms');
    console.log('- Nodes:', perf.nodes || 'N/A');
    
    // Diagnosi del problema
    console.log('\n🔍 Diagnosi del problema:');
    
    if (data.screenshots && data.screenshots.length > 0) {
      console.log('✅ Screenshots sono stati catturati');
    } else {
      console.log('❌ PROBLEMA: Nessuno screenshot catturato');
      console.log('   Possibili cause:');
      console.log('   - Banner cookie non visibile al momento del test');
      console.log('   - Banner cookie caricato in modo asincrono');
      console.log('   - Selettori di rilevamento non corretti');
      console.log('   - Timeout troppo brevi per il caricamento');
    }
    
    if (data.cookieBannerLibs && data.cookieBannerLibs.length > 0) {
      console.log('✅ Cookie banner rilevato nel codice');
    } else {
      console.log('❌ PROBLEMA: Nessun cookie banner rilevato nel codice');
      console.log('   Possibili cause:');
      console.log('   - Banner cookie non presente su questo sito');
      console.log('   - Banner cookie caricato dinamicamente via JavaScript');
      console.log('   - Pattern di rilevamento non corretti');
    }
    
    console.log('\n💡 Suggerimenti per il debug:');
    console.log('1. Verifica se il sito ha effettivamente un banner cookie');
    console.log('2. Controlla i log del server Puppeteer per errori');
    console.log('3. Aumenta i timeout per il caricamento asincrono');
    console.log('4. Verifica i selettori di rilevamento del banner');
    console.log('5. Controlla se il banner appare solo dopo interazione utente');
    
    return data;
    
  } catch (error) {
    console.error('❌ Errore durante il test:', error.message);
    console.error('Stack trace:', error.stack);
    return null;
  }
}

// Esegui il test
testGenertel();
