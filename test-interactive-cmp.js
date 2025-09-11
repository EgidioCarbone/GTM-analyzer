#!/usr/bin/env node

/**
 * Test script for Interactive Cookie Banner Tests
 * 
 * This script tests the new robust interactive CMP tests by calling
 * the /api/fetchHtmlPuppeteer endpoint with multiStep=true and
 * validating the interactive test results structure.
 */

import https from 'https';
import http from 'http';

// Test URLs with known CMP implementations
const TEST_URLS = [
  'https://www.genertel.it', // OneTrust
  'https://www.iubenda.com', // Iubenda
  'https://www.cookiebot.com', // Cookiebot
  'https://www.complianz.io', // Complianz
  'https://www.google.com', // No CMP (control)
];

const SERVER_URL = 'http://localhost:4001';

async function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const options = {
      method: 'GET',
      timeout: 120000, // 2 minutes timeout
    };
    
    const req = http.request(`${SERVER_URL}/api/fetchHtmlPuppeteer?url=${encodeURIComponent(url)}&multiStep=true`, options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch (error) {
          reject(new Error(`Failed to parse JSON: ${error.message}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.end();
  });
}

function validateInteractiveResults(results) {
  console.log('\n🔍 Validating Interactive Test Results...');
  
  if (!results.interactiveTestResults) {
    console.log('❌ Missing interactiveTestResults');
    return false;
  }
  
  if (!results.interactiveTestResults.interactive) {
    console.log('❌ Missing interactiveTestResults.interactive');
    return false;
  }
  
  const { interactive } = results.interactiveTestResults;
  
  // Validate Accept All test
  if (!interactive.acceptAll) {
    console.log('❌ Missing acceptAll test');
    return false;
  }
  
  const acceptAllValid = typeof interactive.acceptAll.clicked === 'boolean' &&
                       typeof interactive.acceptAll.consentUpdated === 'boolean' &&
                       typeof interactive.acceptAll.marketingActive === 'boolean' &&
                       interactive.acceptAll.evidence &&
                       typeof interactive.acceptAll.evidence.cmp === 'object' &&
                       Array.isArray(interactive.acceptAll.evidence.gtagCalls) &&
                       Array.isArray(interactive.acceptAll.evidence.marketingRequests);
  
  if (!acceptAllValid) {
    console.log('❌ Invalid acceptAll test structure');
    return false;
  }
  
  // Validate Reject All test
  if (!interactive.rejectAll) {
    console.log('❌ Missing rejectAll test');
    return false;
  }
  
  const rejectAllValid = typeof interactive.rejectAll.clicked === 'boolean' &&
                        typeof interactive.rejectAll.marketingBlocked === 'boolean' &&
                        typeof interactive.rejectAll.consentDenied === 'boolean' &&
                        interactive.rejectAll.evidence &&
                        typeof interactive.rejectAll.evidence.cmp === 'object' &&
                        Array.isArray(interactive.rejectAll.evidence.gtagCalls) &&
                        Array.isArray(interactive.rejectAll.evidence.marketingRequests);
  
  if (!rejectAllValid) {
    console.log('❌ Invalid rejectAll test structure');
    return false;
  }
  
  // Validate Navigation test
  if (!interactive.navigation) {
    console.log('❌ Missing navigation test');
    return false;
  }
  
  const navigationValid = typeof interactive.navigation.gtmLoaded === 'boolean' &&
                         typeof interactive.navigation.consentPersistent === 'boolean' &&
                         interactive.navigation.evidence &&
                         typeof interactive.navigation.evidence.cmp === 'object' &&
                         Array.isArray(interactive.navigation.evidence.gtagCalls) &&
                         Array.isArray(interactive.navigation.evidence.marketingRequests);
  
  if (!navigationValid) {
    console.log('❌ Invalid navigation test structure');
    return false;
  }
  
  console.log('✅ All interactive test structures are valid');
  return true;
}

function logTestResults(results) {
  const { interactive } = results.interactiveTestResults;
  
  console.log('\n📊 Test Results Summary:');
  console.log('========================');
  
  // Accept All Test
  console.log('\n✅ Accept All Test:');
  console.log(`   Clicked: ${interactive.acceptAll.clicked ? '✅' : '❌'}`);
  console.log(`   Consent Updated: ${interactive.acceptAll.consentUpdated ? '✅' : '❌'}`);
  console.log(`   Marketing Active: ${interactive.acceptAll.marketingActive ? '✅' : '❌'}`);
  console.log(`   CMP Vendor: ${interactive.acceptAll.evidence.cmp.vendor || 'Unknown'}`);
  console.log(`   Gtag Calls: ${interactive.acceptAll.evidence.gtagCalls.length}`);
  console.log(`   Marketing Requests: ${interactive.acceptAll.evidence.marketingRequests.length}`);
  
  // Reject All Test
  console.log('\n❌ Reject All Test:');
  console.log(`   Clicked: ${interactive.rejectAll.clicked ? '✅' : '❌'}`);
  console.log(`   Consent Denied: ${interactive.rejectAll.consentDenied ? '✅' : '❌'}`);
  console.log(`   Marketing Blocked: ${interactive.rejectAll.marketingBlocked ? '✅' : '❌'}`);
  console.log(`   CMP Vendor: ${interactive.rejectAll.evidence.cmp.vendor || 'Unknown'}`);
  console.log(`   Gtag Calls: ${interactive.rejectAll.evidence.gtagCalls.length}`);
  console.log(`   Marketing Requests: ${interactive.rejectAll.evidence.marketingRequests.length}`);
  
  // Navigation Test
  console.log('\n🔄 Navigation Test:');
  console.log(`   GTM Loaded: ${interactive.navigation.gtmLoaded ? '✅' : '❌'}`);
  console.log(`   Consent Persistent: ${interactive.navigation.consentPersistent ? '✅' : '❌'}`);
  console.log(`   CMP Vendor: ${interactive.navigation.evidence.cmp.vendor || 'Unknown'}`);
  console.log(`   Gtag Calls: ${interactive.navigation.evidence.gtagCalls.length}`);
  console.log(`   Marketing Requests: ${interactive.navigation.evidence.marketingRequests.length}`);
}

async function testUrl(url) {
  console.log(`\n🌐 Testing: ${url}`);
  console.log('='.repeat(50));
  
  try {
    const startTime = Date.now();
    const results = await makeRequest(url);
    const duration = Date.now() - startTime;
    
    console.log(`⏱️  Request completed in ${duration}ms`);
    
    if (results.error) {
      console.log(`❌ Error: ${results.error}`);
      return false;
    }
    
    const isValid = validateInteractiveResults(results);
    
    if (isValid) {
      logTestResults(results);
    }
    
    return isValid;
    
  } catch (error) {
    console.log(`❌ Request failed: ${error.message}`);
    return false;
  }
}

async function runTests() {
  console.log('🚀 Starting Interactive CMP Tests');
  console.log('==================================');
  console.log(`Server: ${SERVER_URL}`);
  console.log(`Test URLs: ${TEST_URLS.length}`);
  
  let passedTests = 0;
  let totalTests = TEST_URLS.length;
  
  for (const url of TEST_URLS) {
    const passed = await testUrl(url);
    if (passed) {
      passedTests++;
    }
    
    // Wait between tests to avoid overwhelming the server
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n📈 Final Results');
  console.log('================');
  console.log(`Passed: ${passedTests}/${totalTests}`);
  console.log(`Success Rate: ${Math.round((passedTests / totalTests) * 100)}%`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All tests passed!');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed');
    process.exit(1);
  }
}

// Check if server is running
async function checkServer() {
  try {
    const response = await fetch(`${SERVER_URL}/api/fetchHtmlPuppeteer?url=https://www.google.com&multiStep=true`);
    return response.ok;
  } catch (error) {
    console.log('❌ Server not running or not accessible');
    console.log('Please start the puppeteer server first:');
    console.log('   node puppeteerServer-fixed.js');
    return false;
  }
}

async function main() {
  const serverRunning = await checkServer();
  if (!serverRunning) {
    process.exit(1);
  }
  
  await runTests();
}

main().catch(console.error);
