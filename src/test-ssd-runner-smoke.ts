// Test smoke per SSD Runner
// ========================
// Esegue un test di base per verificare che Puppeteer funzioni correttamente

import puppeteer from 'puppeteer';
import { promises as fs } from 'fs';
import path from 'path';

interface SmokeTestResult {
  success: boolean;
  duration: number;
  userAgent: string;
  error?: string;
  screenshotPath?: string;
}

async function ensureScreenshotsDir(): Promise<void> {
  const screenshotsDir = path.join(process.cwd(), 'screenshots');
  try {
    await fs.access(screenshotsDir);
  } catch {
    await fs.mkdir(screenshotsDir, { recursive: true });
  }
}

async function runSmokeTest(): Promise<SmokeTestResult> {
  const startTime = Date.now();
  let browser: puppeteer.Browser | null = null;
  let page: puppeteer.Page | null = null;
  
  try {
    console.log('🚀 Starting SSD Runner Smoke Test...');
    
    // Assicurati che la directory screenshots esista
    await ensureScreenshotsDir();
    
    // Lancia browser
    console.log('📱 Launching browser...');
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });
    
    page = await browser.newPage();
    
    // Configura viewport
    await page.setViewport({ width: 1280, height: 720 });
    
    // Ottieni user agent
    const userAgent = await page.evaluate(() => navigator.userAgent);
    console.log(`🌐 User Agent: ${userAgent}`);
    
    // Naviga a example.com
    console.log('🌍 Navigating to https://example.com/...');
    const navigationStart = Date.now();
    
    await page.goto('https://example.com/', {
      waitUntil: 'networkidle2',
      timeout: 10000
    });
    
    const navigationDuration = Date.now() - navigationStart;
    console.log(`⏱️  Navigation completed in ${navigationDuration}ms`);
    
    // Attendi un po' per assicurarsi che la pagina sia completamente caricata
    console.log('⏳ Waiting for page to stabilize...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Cattura screenshot
    const screenshotPath = path.join(process.cwd(), 'screenshots', 'smoke_example.png');
    console.log('📸 Capturing screenshot...');
    
    await page.screenshot({
      path: screenshotPath,
      fullPage: true
    });
    
    console.log(`💾 Screenshot saved to: ${screenshotPath}`);
    
    // Verifica che la pagina sia caricata correttamente
    const pageTitle = await page.title();
    const pageUrl = page.url();
    
    console.log(`📄 Page Title: ${pageTitle}`);
    console.log(`🔗 Page URL: ${pageUrl}`);
    
    // Verifica che il contenuto sia presente
    const hasContent = await page.evaluate(() => {
      const body = document.body;
      return body && body.textContent && body.textContent.trim().length > 0;
    });
    
    if (!hasContent) {
      throw new Error('Page appears to be empty or failed to load content');
    }
    
    const totalDuration = Date.now() - startTime;
    
    return {
      success: true,
      duration: totalDuration,
      userAgent,
      screenshotPath
    };
    
  } catch (error) {
    const totalDuration = Date.now() - startTime;
    
    console.error('❌ Smoke test failed:', error);
    
    return {
      success: false,
      duration: totalDuration,
      userAgent: page ? await page.evaluate(() => navigator.userAgent) : 'Unknown',
      error: error instanceof Error ? error.message : String(error)
    };
    
  } finally {
    // Cleanup
    if (page) {
      await page.close();
    }
    if (browser) {
      await browser.close();
    }
  }
}

function printCompactReport(result: SmokeTestResult): void {
  console.log('\n' + '='.repeat(50));
  console.log('📊 SSD RUNNER SMOKE TEST REPORT');
  console.log('='.repeat(50));
  
  // Status
  const status = result.success ? '✅ OK' : '❌ FAIL';
  console.log(`Status: ${status}`);
  
  // Duration
  console.log(`Duration: ${result.duration}ms`);
  
  // User Agent (truncated)
  const shortUserAgent = result.userAgent.length > 60 
    ? result.userAgent.substring(0, 60) + '...' 
    : result.userAgent;
  console.log(`User Agent: ${shortUserAgent}`);
  
  // Screenshot path
  if (result.screenshotPath) {
    console.log(`Screenshot: ${result.screenshotPath}`);
  }
  
  // Error details
  if (result.error) {
    console.log(`Error: ${result.error}`);
  }
  
  console.log('='.repeat(50));
  
  // Exit code
  if (result.success) {
    console.log('🎉 Smoke test completed successfully!');
    process.exit(0);
  } else {
    console.log('💥 Smoke test failed!');
    process.exit(1);
  }
}

// Esegui il test
async function main(): Promise<void> {
  try {
    const result = await runSmokeTest();
    printCompactReport(result);
  } catch (error) {
    console.error('💥 Unexpected error during smoke test:', error);
    process.exit(1);
  }
}

// Esegui solo se chiamato direttamente
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}