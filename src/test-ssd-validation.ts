// Test file for SSD validation schemas
// Run with: npx tsx src/test-ssd-validation.ts

import { validateTestSpec, detectAmbiguities } from './services/ssdValidation';

// Test valid DSL
const validDSL = {
  site: "https://example.com",
  allowed_hosts: ["example.com"],
  consent: ["accept", "reject"],
  tests: [
    {
      section: "Header Navigation",
      steps: [
        {
          description: "Click on logo",
          action: "click",
          target: {
            kind: "text",
            value: "Logo"
          },
          expect: [
            {
              type: "navigation",
              url_matches: "https://example.com"
            }
          ],
          confidence: 0.9
        }
      ]
    }
  ]
};

// Test invalid DSL
const invalidDSL = {
  site: "not-a-url",
  tests: []
};

console.log("Testing valid DSL...");
const validResult = validateTestSpec(validDSL);
console.log("Valid DSL result:", validResult);

console.log("\nTesting invalid DSL...");
const invalidResult = validateTestSpec(invalidDSL);
console.log("Invalid DSL result:", invalidResult);

console.log("\nTesting ambiguity detection...");
const ambiguities = detectAmbiguities(validDSL);
console.log("Ambiguities found:", ambiguities);

console.log("\nAll tests completed!");
