# SSD Test Implementation

## Overview

The SSD Test feature provides end-to-end automation for converting PDF slide decks into executable test specifications and running them with Puppeteer. This implementation includes real PDF processing, OpenAI integration, and comprehensive test execution with evidence collection.

## Architecture

### Backend Services

1. **PDF Extraction Service** (`ssdPdfExtractionService.ts`)
   - Extracts text content from PDF files using `pdf-parse`
   - Validates PDF files and handles extraction errors
   - Cleans and normalizes extracted text

2. **OpenAI Service** (`ssdOpenAIService.ts`)
   - Converts PDF text to structured TestSpec DSL
   - Validates DSL structure using Zod schemas
   - Extracts ambiguities from low-confidence steps

3. **Target Resolver** (`ssdTargetResolver.ts`)
   - Resolves UI targets with multiple strategies
   - Supports region scoping (header, main, footer)
   - Handles text, selector, ARIA, and href targets

4. **Expectation Matcher** (`ssdExpectationMatcher.ts`)
   - Matches test expectations against actual results
   - Supports dataLayer, GA4, GTM, network, and navigation expectations
   - Handles sequence checks and subset matching

5. **Consent Handler** (`ssdConsentHandler.ts`)
   - Manages consent profiles (accept/reject)
   - Supports common CMP platforms (OneTrust, Cookiebot, etc.)
   - Handles iframe-based consent dialogs

6. **Puppeteer Runner** (`ssdPuppeteerRunner.ts`)
   - Main test execution engine
   - Tracks dataLayer events and network requests
   - Detects SPA route changes
   - Captures screenshots and evidence

### Frontend Components

- **SSDTestPage.tsx**: Complete UI for the 3-step process (Upload → Review → Run)
- Enhanced evidence display with expandable dataLayer events and tracking hits
- Screenshot viewing with click-to-expand functionality
- Real-time error handling and loading states

## API Endpoints

### POST /api/ssd/ingest
Converts PDF to TestSpec DSL using OpenAI.

**Input:**
- `url` (string): Target website URL
- `pdf` (file): PDF file upload

**Output:**
```json
{
  "dsl": { /* TestSpec object */ },
  "ambiguities": [
    {
      "stepPath": "tests[0].steps[1]",
      "reason": "Ambiguous target",
      "candidates": ["text:Button", "selector:.btn"]
    }
  ],
  "meta": {
    "tokens": { "input": 1000, "output": 500 },
    "model": "gpt-4o-mini",
    "ingestionWarnings": ["PDF contains very little text"]
  }
}
```

### POST /api/ssd/run
Executes TestSpec with Puppeteer.

**Input:**
```json
{
  "dsl": { /* TestSpec object */ },
  "runOptions": {
    "headless": true,
    "consent": "both"
  }
}
```

**Output:**
```json
{
  "report": {
    "summary": {
      "steps": 10,
      "passed": 8,
      "failed": 2,
      "duration": 15000,
      "consentProfiles": ["accept", "reject"]
    },
    "results": [
      {
        "section": "Header",
        "stepIndex": 0,
        "description": "Click logo",
        "status": "PASS",
        "reasons": [],
        "evidence": {
          "screenshotPathOrB64": "base64...",
          "dataLayerEvents": [
            {
              "timestamp": 1234567890,
              "payload": { "event": "navigation", "page": "/" }
            }
          ],
          "trackingHits": [
            {
              "timestamp": 1234567890,
              "url": "https://www.google-analytics.com/collect",
              "method": "GET",
              "domain": "google-analytics.com",
              "status": 200
            }
          ]
        },
        "timings": {
          "startTime": 1234567890,
          "endTime": 1234567891,
          "duration": 1000
        }
      }
    ],
    "artifacts": {
      "screenshotsFolder": "screenshots",
      "rawLogsPath": "screenshots/raw-logs.json"
    }
  }
}
```

### GET /api/ssd/config
Returns configuration information.

## TestSpec DSL Schema

```typescript
interface TestSpec {
  site: string;                       // Required absolute URL
  allowed_hosts?: string[];           // Cross-domain navigation allowlist
  consent?: ("reject" | "accept")[];  // Consent profiles to test
  tests: Test[];
}

interface Test {
  section: string;                    // Test section name
  steps: Step[];
}

interface Step {
  description?: string;
  action: "click" | "input" | "wait_for_selector" | "wait_for_text" | 
          "navigate" | "maybe_set_quantity" | "choose_payment" | 
          "complete_order" | "custom";
  target?: Target;
  value?: string;                     // For input actions
  expect?: Expectation[];
  severity?: "critical" | "major" | "minor";
  confidence?: number;                // 0-1 confidence score
}

interface Target {
  region?: "header" | "main" | "footer" | "any";
  kind: "text" | "selector" | "aria" | "href";
  value: string;
}

interface Expectation {
  type: "dataLayer" | "ga4" | "gtm" | "network" | "navigation" | "no_repeat_on_reload";
  event?: string;                     // For dataLayer events
  params_subset?: object;             // Subset matching for payloads
  near_previous_n?: number;           // Sequence check window
  contains?: object;                  // Sequence check pattern
  url_contains?: string;              // URL pattern matching
  url_matches?: string;               // Regex URL matching
  for_event?: string;                 // For no-repeat checks
}
```

## Environment Configuration

Create a `.env` file with the following variables:

```bash
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4o-mini

# Puppeteer Configuration
PUPPETEER_ORIGIN_ALLOWLIST=example.com,subdomain.example.com
RUNNER_STEP_TIMEOUT_MS=30000
RUNNER_NAV_TIMEOUT_MS=60000

# File Upload Configuration
MAX_UPLOAD_MB=10

# Rate Limiting Configuration
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100

# CORS Configuration
CORS_ORIGIN=http://localhost:5173

# Server Configuration
PORT=4000
```

## Security Features

- **Rate Limiting**: Configurable rate limits per IP
- **File Validation**: PDF type and size validation
- **Input Sanitization**: Request body sanitization for SSD endpoints
- **Timeout Protection**: Request timeouts for OpenAI and Puppeteer operations
- **Error Handling**: Comprehensive error handling with sanitized responses
- **Request Logging**: Sanitized request/response logging

## Usage

### 1. Start the Development Server

```bash
npm run dev
```

This starts:
- Backend server on port 4000
- Puppeteer server on port 3001
- Frontend on port 5173

### 2. Access SSD Test

Navigate to `http://localhost:5173` and go to the SSD Test page.

### 3. Upload and Process PDF

1. Enter target website URL
2. Upload PDF slide deck
3. Click "Process PDF" to generate TestSpec

### 4. Review Generated Tests

- Review the generated TestSpec in the JSON preview
- Address any ambiguities by selecting from suggested targets
- Edit targets manually if needed

### 5. Execute Tests

1. Click "Run Tests" to execute with Puppeteer
2. Tests will run for both consent profiles (accept/reject)
3. Review results with evidence including:
   - Screenshots for each step
   - DataLayer events captured
   - Network tracking hits
   - Pass/fail status with reasons

## Testing

Run the test suite:

```bash
npm test
```

Tests cover:
- DSL validation and schema compliance
- Expectation matching logic
- Error handling scenarios
- Edge cases and validation

## Troubleshooting

### Common Issues

1. **OpenAI API Key Missing**
   - Ensure `OPENAI_API_KEY` is set in environment variables
   - Check API key has sufficient credits

2. **PDF Processing Fails**
   - Ensure PDF contains extractable text (not just images)
   - Check file size is within limits (default 10MB)
   - Verify PDF is not password protected

3. **Test Execution Fails**
   - Check target website is accessible
   - Verify selectors in generated DSL are correct
   - Review browser console for JavaScript errors

4. **Rate Limiting**
   - Increase `RATE_LIMIT_MAX` if needed
   - Reduce `RATE_LIMIT_WINDOW_MS` for stricter limits

### Debug Mode

Enable debug logging by setting:
```bash
DEBUG=ssd:*
```

## Performance Considerations

- **PDF Size**: Larger PDFs take longer to process
- **Test Complexity**: More steps = longer execution time
- **Network Latency**: External API calls (OpenAI) add latency
- **Browser Resources**: Puppeteer execution is resource-intensive

## Future Enhancements

- Export reports to PDF/Markdown
- Target picker for resolving ambiguities
- Custom expectation types
- Parallel test execution
- CI/CD integration
- Advanced screenshot comparison
- Performance metrics collection

## Dependencies

- **Backend**: Express, Puppeteer, OpenAI, pdf-parse, Zod
- **Frontend**: React, TypeScript, Tailwind CSS
- **Testing**: Jest, testing utilities

## License

This implementation is part of the GTM Analyzer project.
