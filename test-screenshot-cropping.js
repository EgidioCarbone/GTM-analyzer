#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testScreenshotCropping() {
    console.log('🧪 Testando il cropping degli screenshot...\n');
    
    const testUrls = [
        { name: 'PEC.it (CybotCookiebotDialog)', url: 'https://pec.it' },
        { name: 'Google.com', url: 'https://www.google.com' },
        { name: 'CNN.com (Onetrust)', url: 'https://www.cnn.com' }
    ];
    
    for (const test of testUrls) {
        console.log(`📸 Testando ${test.name}...`);
        
        try {
            const response = await fetch(`http://localhost:4001/api/fetchHtmlPuppeteer?url=${encodeURIComponent(test.url)}&multiStep=true`);
            const data = await response.json();
            
            if (data.screenshots && data.screenshots.length > 0) {
                // Salva lo screenshot per ispezione visiva
                const screenshot = data.screenshots[0];
                const filename = `screenshot-${test.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}.png`;
                const filepath = path.join(__dirname, filename);
                
                fs.writeFileSync(filepath, screenshot, 'base64');
                
                console.log(`✅ Screenshot salvato: ${filename}`);
                console.log(`   Dimensione: ${Math.round(screenshot.length / 1024)}KB`);
                
                // Verifica se ci sono informazioni sul banner
                if (data.cookieBannerLibs && data.cookieBannerLibs.length > 0) {
                    console.log(`   Cookie banner rilevato: ${data.cookieBannerLibs.join(', ')}`);
                }
                
                if (data.interactiveTestResults && data.interactiveTestResults.acceptAllTest) {
                    console.log(`   Test interattivo: ${data.interactiveTestResults.acceptAllTest.passed ? 'PASSED' : 'FAILED'}`);
                }
                
            } else {
                console.log(`❌ Nessuno screenshot generato per ${test.name}`);
            }
            
        } catch (error) {
            console.log(`❌ Errore per ${test.name}: ${error.message}`);
        }
        
        console.log(''); // Riga vuota
    }
    
    console.log('🎉 Test completato! Controlla i file PNG generati per verificare il cropping.');
}

// Verifica che il server sia in esecuzione
fetch('http://localhost:4001/api/fetchHtmlPuppeteer?url=https://example.com&multiStep=false')
    .then(() => {
        testScreenshotCropping();
    })
    .catch(() => {
        console.log('❌ Server Puppeteer non in esecuzione. Avvia prima: node puppeteerServer.js');
        process.exit(1);
    });
