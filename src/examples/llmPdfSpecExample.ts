// Example usage of llmPdfSpec function
import { llmPdfSpec, LlmPdfSpecError } from '../services/llmPdfSpecService';

/**
 * Example: Basic usage with PDF text only
 */
export async function basicExample() {
  const pdfText = `
    Test Specification for E-commerce Website
    
    Test Case 1: Product Search
    - Navigate to search page
    - Enter product name in search field
    - Click search button
    - Verify search results are displayed
    - Check that dataLayer event 'search' is fired
    
    Test Case 2: Add to Cart
    - Click on a product
    - Select quantity
    - Click "Add to Cart" button
    - Verify cart icon shows updated count
    - Verify dataLayer event 'add_to_cart' is fired
  `;

  try {
    const result = await llmPdfSpec({ pdfText });
    
    if (result) {
      console.log('Generated PDF Spec:', {
        version: result.version,
        steps: result.spec.steps.length,
        assertions: result.spec.assertions.length,
        notes: result.notes
      });
      return result;
    } else {
      console.log('PDF text was empty, returned null');
      return null;
    }
  } catch (error) {
    if (error instanceof LlmPdfSpecError) {
      console.error('PDF Spec Error:', error.code, error.message);
    } else {
      console.error('Unexpected error:', error);
    }
    throw error;
  }
}

/**
 * Example: Usage with URL and HTML context
 */
export async function advancedExample() {
  const pdfText = `
    Advanced Test Plan for Marketing Website
    
    User Flow:
    1. Landing page load
    2. Newsletter signup
    3. Contact form submission
    4. Download whitepaper
    
    Technical Requirements:
    - All forms should trigger GTM events
    - Page loads should fire page_view events
    - Downloads should be tracked via enhanced ecommerce
  `;

  const url = 'https://marketing.example.com';
  const htmlPath = '/path/to/website.html';

  try {
    const result = await llmPdfSpec({ 
      pdfText, 
      url, 
      htmlPath 
    });
    
    if (result) {
      console.log('Advanced PDF Spec generated:', {
        version: result.version,
        totalSteps: result.spec.steps.length,
        totalAssertions: result.spec.assertions.length,
        hasUrlContext: !!url,
        hasHtmlContext: !!htmlPath
      });
      
      // Log some example steps
      result.spec.steps.forEach((step, index) => {
        console.log(`Step ${index + 1}:`, {
          description: step.description,
          action: step.action,
          target: step.target?.selector || step.target?.text || 'N/A'
        });
      });
      
      return result;
    }
  } catch (error) {
    console.error('Advanced example failed:', error);
    throw error;
  }
}

/**
 * Example: Error handling patterns
 */
export async function errorHandlingExample() {
  // Test empty PDF text
  try {
    const result1 = await llmPdfSpec({ pdfText: '' });
    console.log('Empty PDF result:', result1); // Should be null
  } catch (error) {
    console.log('Empty PDF error:', error);
  }

  // Test with invalid JSON response (this would require mocking)
  try {
    const result2 = await llmPdfSpec({ 
      pdfText: 'Some test content that might cause JSON parsing issues' 
    });
    console.log('Valid PDF result:', !!result2);
  } catch (error) {
    if (error instanceof LlmPdfSpecError) {
      console.log('Handled PDF Spec Error:', {
        code: error.code,
        message: error.message
      });
    } else {
      console.log('Unhandled error:', error);
    }
  }
}

// Export all examples for easy testing
export const examples = {
  basic: basicExample,
  advanced: advancedExample,
  errorHandling: errorHandlingExample
};
