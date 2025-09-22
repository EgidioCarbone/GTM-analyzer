// Test script per verificare l'estrazione del cookie banner
// Esegui con: node test-cookie-banner-extraction.js

import fetch from 'node-fetch';

async function testCookieBannerExtraction() {
  console.log('🧪 Testing Cookie Banner Extraction...\n');
  
  const testUrls = [
    'https://www.google.com',
    'https://www.facebook.com',
    'https://www.github.com',
    'https://www.stackoverflow.com'
  ];
  
  const apiBaseUrl = 'http://localhost:4000';
  
  for (const url of testUrls) {
    try {
      console.log(`Testing: ${url}`);
      
      const response = await fetch(`${apiBaseUrl}/api/ssd/fetch-html?url=${encodeURIComponent(url)}`, {
        method: 'GET',
        timeout: 30000
      });
      
      if (!response.ok) {
        console.log(`❌ Error: ${response.status} - ${response.statusText}`);
        continue;
      }
      
      const data = await response.json();
      
      console.log(`✅ Success!`);
      console.log(`   - URL: ${data.url}`);
      console.log(`   - Cookie Banner Found: ${data.cookieBanner.found}`);
      
      if (data.cookieBanner.found) {
        console.log(`   - Type: ${data.cookieBanner.type}`);
        console.log(`   - Position: ${data.cookieBanner.position}`);
        console.log(`   - Selectors: ${data.cookieBanner.selectors.join(', ')}`);
        console.log(`   - Text Preview: ${data.cookieBanner.text.substring(0, 100)}...`);
      } else {
        console.log(`   - No cookie banner detected`);
      }
      
      console.log(`   - HTML Length: ${data.html.length} characters`);
      console.log(`   - Timestamp: ${data.timestamp}\n`);
      
    } catch (error) {
      console.log(`❌ Error testing ${url}: ${error.message}\n`);
    }
  }
  
  console.log('✅ Cookie banner extraction test completed!');
}

// Esegui il test se questo file viene eseguito direttamente
testCookieBannerExtraction().catch(console.error);

export { testCookieBannerExtraction };
