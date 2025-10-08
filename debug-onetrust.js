// debug-onetrust.js
// Debug specifico per OneTrust su Genertel

import puppeteer from 'puppeteer';

async function debugOneTrust() {
  console.log('🔍 Debug OneTrust su Genertel.it');
  console.log('=' .repeat(50));
  
  const browser = await puppeteer.launch({
    headless: false, // Modalità visibile per debug
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor'
    ],
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (GTM-Checklist/1.0)');
  
  // Abilita logging della console
  page.on('console', msg => {
    console.log('BROWSER LOG:', msg.text());
  });

  try {
    console.log('📡 Navigando verso Genertel...');
    await page.goto('https://www.genertel.it/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    console.log('⏳ Aspettando caricamento completo...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Controlla OneTrust step by step
    console.log('\n🔍 Analisi OneTrust step by step:');
    
    // 1. Controlla se OneTrust è presente nel DOM
    const oneTrustElements = await page.evaluate(() => {
      const elements = document.querySelectorAll('[id*="onetrust"], [class*="onetrust"]');
      return Array.from(elements).map(el => ({
        tagName: el.tagName,
        id: el.id,
        className: el.className,
        textContent: el.textContent?.substring(0, 100) || '',
        style: el.style.cssText,
        computedStyle: {
          display: window.getComputedStyle(el).display,
          visibility: window.getComputedStyle(el).visibility,
          opacity: window.getComputedStyle(el).opacity,
          zIndex: window.getComputedStyle(el).zIndex
        },
        rect: el.getBoundingClientRect()
      }));
    });
    
    console.log(`- Elementi OneTrust trovati: ${oneTrustElements.length}`);
    oneTrustElements.forEach((el, i) => {
      console.log(`  ${i + 1}. ${el.tagName}#${el.id}.${el.className}`);
      console.log(`     Display: ${el.computedStyle.display}, Visibility: ${el.computedStyle.visibility}, Opacity: ${el.computedStyle.opacity}`);
      console.log(`     Z-Index: ${el.computedStyle.zIndex}, Rect: ${el.rect.width}x${el.rect.height}`);
      console.log(`     Text: ${el.textContent.substring(0, 50)}...`);
    });

    // 2. Controlla se OneTrust è caricato via script
    const oneTrustScripts = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script'));
      return scripts
        .filter(script => script.src && script.src.includes('onetrust'))
        .map(script => ({
          src: script.src,
          loaded: script.readyState === 'complete' || script.readyState === 'loaded'
        }));
    });
    
    console.log(`\n- Script OneTrust trovati: ${oneTrustScripts.length}`);
    oneTrustScripts.forEach((script, i) => {
      console.log(`  ${i + 1}. ${script.src} (loaded: ${script.loaded})`);
    });

    // 3. Controlla se OneTrust è inizializzato
    const oneTrustInitialized = await page.evaluate(() => {
      return {
        windowOneTrust: typeof window.OneTrust !== 'undefined',
        windowOptanon: typeof window.Optanon !== 'undefined',
        windowOptanonConsent: typeof window.OptanonConsent !== 'undefined',
        oneTrustFunctions: Object.keys(window).filter(key => key.includes('OneTrust') || key.includes('Optanon'))
      };
    });
    
    console.log('\n- OneTrust inizializzato:');
    console.log(`  window.OneTrust: ${oneTrustInitialized.windowOneTrust}`);
    console.log(`  window.Optanon: ${oneTrustInitialized.windowOptanon}`);
    console.log(`  window.OptanonConsent: ${oneTrustInitialized.windowOptanonConsent}`);
    console.log(`  Funzioni OneTrust: ${oneTrustInitialized.oneTrustFunctions.join(', ')}`);

    // 4. Aspetta più tempo e controlla di nuovo
    console.log('\n⏳ Aspettando 10 secondi aggiuntivi...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    const oneTrustElementsAfter = await page.evaluate(() => {
      const elements = document.querySelectorAll('[id*="onetrust"], [class*="onetrust"]');
      return Array.from(elements).map(el => ({
        tagName: el.tagName,
        id: el.id,
        className: el.className,
        textContent: el.textContent?.substring(0, 100) || '',
        computedStyle: {
          display: window.getComputedStyle(el).display,
          visibility: window.getComputedStyle(el).visibility,
          opacity: window.getComputedStyle(el).opacity,
          zIndex: window.getComputedStyle(el).zIndex
        },
        rect: el.getBoundingClientRect()
      }));
    });
    
    console.log(`\n- Elementi OneTrust dopo attesa: ${oneTrustElementsAfter.length}`);
    oneTrustElementsAfter.forEach((el, i) => {
      console.log(`  ${i + 1}. ${el.tagName}#${el.id}.${el.className}`);
      console.log(`     Display: ${el.computedStyle.display}, Visibility: ${el.computedStyle.visibility}, Opacity: ${el.computedStyle.opacity}`);
      console.log(`     Z-Index: ${el.computedStyle.zIndex}, Rect: ${el.rect.width}x${el.rect.height}`);
    });

    // 5. Prova a forzare la visualizzazione di OneTrust
    console.log('\n🔧 Tentativo di forzare visualizzazione OneTrust...');
    const forceShowResult = await page.evaluate(() => {
      const oneTrustElements = document.querySelectorAll('[id*="onetrust"], [class*="onetrust"]');
      let forced = false;
      
      oneTrustElements.forEach(el => {
        if (el.style) {
          el.style.display = 'block';
          el.style.visibility = 'visible';
          el.style.opacity = '1';
          el.style.zIndex = '999999';
          forced = true;
        }
      });
      
      return {
        elementsFound: oneTrustElements.length,
        forced: forced,
        elementsAfter: Array.from(oneTrustElements).map(el => ({
          display: el.style.display,
          visibility: el.style.visibility,
          opacity: el.style.opacity,
          zIndex: el.style.zIndex,
          rect: el.getBoundingClientRect()
        }))
      };
    });
    
    console.log(`- Elementi trovati: ${forceShowResult.elementsFound}`);
    console.log(`- Forzatura applicata: ${forceShowResult.forced}`);
    forceShowResult.elementsAfter.forEach((el, i) => {
      console.log(`  ${i + 1}. Display: ${el.display}, Visibility: ${el.visibility}, Opacity: ${el.opacity}, Rect: ${el.rect.width}x${el.rect.height}`);
    });

    // 6. Cattura screenshot finale
    console.log('\n📸 Catturando screenshot finale...');
    const screenshot = await page.screenshot({ 
      encoding: 'base64',
      fullPage: true 
    });
    
    console.log(`- Screenshot catturato: ${screenshot.length} caratteri base64`);
    
    // 7. Salva screenshot per ispezione
    const fs = await import('fs');
    fs.writeFileSync('genertel-debug.png', screenshot, 'base64');
    console.log('- Screenshot salvato come genertel-debug.png');

    console.log('\n✅ Debug completato');
    
  } catch (error) {
    console.error('❌ Errore durante il debug:', error.message);
  } finally {
    await browser.close();
  }
}

// Esegui il debug
debugOneTrust();
