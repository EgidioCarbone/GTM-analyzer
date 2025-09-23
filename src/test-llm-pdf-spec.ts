// Test file for llmPdfSpec function
import { llmPdfSpec, LlmPdfSpecError } from './services/llmPdfSpecService';

async function testLlmPdfSpec() {
  console.log('🧪 Testing llmPdfSpec function...\n');

  // Test 1: Empty PDF text should return null
  console.log('Test 1: Empty PDF text');
  try {
    const result1 = await llmPdfSpec({ pdfText: '' });
    console.log('✅ Empty PDF text returned null:', result1 === null);
  } catch (error) {
    console.log('❌ Empty PDF text test failed:', error);
  }

  // Test 2: Valid PDF text with URL
  console.log('\nTest 2: Valid PDF text with URL');
  try {
    const samplePdfText = `
      Test Specification Document
      
      Step 1: Navigate to homepage
      - Click on the main navigation menu
      - Verify dataLayer event 'page_view' is fired
      
      Step 2: Search functionality
      - Enter search term in search box
      - Click search button
      - Verify search results page loads
      
      Assertions:
      - dataLayer should contain ecommerce events
      - Network requests should include analytics calls
    `;

    const result2 = await llmPdfSpec({ 
      pdfText: samplePdfText, 
      url: 'https://example.com' 
    });
    
    if (result2) {
      console.log('✅ Valid PDF text returned spec:', {
        version: result2.version,
        stepsCount: result2.spec.steps.length,
        assertionsCount: result2.spec.assertions.length,
        hasNotes: !!result2.notes
      });
    } else {
      console.log('❌ Valid PDF text returned null');
    }
  } catch (error) {
    console.log('❌ Valid PDF text test failed:', error);
  }

  // Test 3: PDF text with HTML context
  console.log('\nTest 3: PDF text with HTML context');
  try {
    const samplePdfText = `
      E-commerce Test Plan
      
      User Journey:
      1. Add product to cart
      2. Proceed to checkout
      3. Complete purchase
      
      Expected Events:
      - add_to_cart
      - begin_checkout
      - purchase
    `;

    const result3 = await llmPdfSpec({ 
      pdfText: samplePdfText, 
      url: 'https://shop.example.com',
      htmlPath: '/path/to/html/file.html'
    });
    
    if (result3) {
      console.log('✅ PDF with HTML context returned spec:', {
        version: result3.version,
        stepsCount: result3.spec.steps.length,
        assertionsCount: result3.spec.assertions.length
      });
    } else {
      console.log('❌ PDF with HTML context returned null');
    }
  } catch (error) {
    console.log('❌ PDF with HTML context test failed:', error);
  }

  // Test 4: Error handling for invalid API key
  console.log('\nTest 4: Error handling');
  try {
    // This should fail if API key is not set
    const result4 = await llmPdfSpec({ 
      pdfText: 'Test content' 
    });
    console.log('✅ API call succeeded:', !!result4);
  } catch (error) {
    if (error instanceof LlmPdfSpecError) {
      console.log('✅ Error handling works:', error.code, error.message);
    } else {
      console.log('❌ Unexpected error type:', error);
    }
  }

  console.log('\n🏁 Test completed');
}

// Run the test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testLlmPdfSpec().catch(console.error);
}

export { testLlmPdfSpec };
