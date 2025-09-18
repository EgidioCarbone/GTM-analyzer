# Universal SSD Test Implementation

## Overview

This implementation makes the SSD Test feature universal and reliable for any text-based PDF, following strict mode execution principles.

## Key Features

### 1. Universal PDF Processing
- **PDF Text Extraction**: `src/services/pdfTextExtraction.ts`
  - Extracts plain text from any PDF using `pdf-parse`
  - Validates PDF files and provides clear error messages
  - Handles image-only PDFs with appropriate error messages

### 2. OpenAI Integration (Server-Side Only)
- **OpenAI Spec Service**: `src/services/openaiSpecService.ts`
  - Uses universal prompt for any website/brand
  - Generates robust targets (text/aria/href priority)
  - Uses subset expectations with wildcards for variable values
  - Strict JSON output with `response_format: { type: "json_object" }`

### 3. DSL Validation
- **Spec Validation**: `src/services/specValidation.ts`
  - Zod schema validation for TestSpec structure
  - Detects and rejects placeholder patterns
  - Validates allowed_hosts against site domain
  - Enforces strict region and action types

### 4. Strict Execution Mode
- **Puppeteer Runner**: `src/services/ssdPuppeteerRunner.ts`
  - Executes exactly what the LLM returns
  - No hidden post-processing or modifications
  - Respects allowed_hosts exactly as provided
  - Handles relative URLs by resolving against page.url()

## API Endpoints

### POST /api/spec/generate
- **Input**: `multipart/form-data` with `url` (string) and `pdf` (file)
- **Process**:
  1. Extract text from PDF
  2. Call OpenAI with universal prompt
  3. Validate returned JSON against DSL schema
  4. Return validated DSL as-is
- **Output**: `{ dsl: TestSpec, meta: { model, tokens } }`

### POST /api/ssd/run
- **Input**: `{ dsl: TestSpec, runOptions: { headless, consent } }`
- **Process**: Execute exactly what's in the DSL
- **Output**: Standard test report with evidence

## Frontend Updates

### SSDTestPage.tsx
- Updated to use new `/api/spec/generate` endpoint
- Removed disambiguation UI (universal mode)
- Added meta information display (model, tokens)
- Advanced JSON editing with validation
- Clear messaging about strict execution mode

## Environment Variables

```bash
# Required
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-4o-mini
OPENAI_TIMEOUT_MS=60000

# Optional
MAX_UPLOAD_MB=10
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
RUNNER_STEP_TIMEOUT_MS=30000
RUNNER_NAV_TIMEOUT_MS=60000
```

## DSL Schema

```typescript
interface TestSpec {
  site: string;                    // required, absolute URL
  allowed_hosts?: string[];        // optional, derived from URL + PDF text
  consent?: ("accept"|"reject")[]; // optional, default ["accept"]
  tests: Test[];
  meta?: {                        // optional, from generation
    model: string;
    tokens: { input: number; output: number; };
  };
}

interface Test {
  section: string;
  steps: Step[];
}

interface Step {
  description?: string;
  action: "click"|"input"|"wait_for_selector"|"wait_for_text"|"navigate"|"custom";
  target?: Target;
  value?: string;
  expect?: Expectation[];
  severity?: "critical"|"major"|"minor";
  confidence?: number; // 0..1
}

interface Target {
  region?: "header"|"main"|"footer"|"any";
  kind: "text"|"aria"|"href"|"selector";
  value: string;
}

interface Expectation {
  type: "dataLayer"|"ga4"|"gtm"|"network"|"navigation"|"no_repeat_on_reload";
  event?: string;
  params_subset?: object; // subset match with "*" wildcards
  url_contains?: string;
  url_matches?: string;
  for_event?: string;
}
```

## Universal LLM Prompt

The system uses a carefully crafted prompt that:
- Generates universal, brand-agnostic test specifications
- Prioritizes robust targets (text > aria > href > selector)
- Uses wildcards for variable values
- Builds allowed_hosts only from URL + PDF text
- Avoids hardcoded assumptions or placeholders

## Testing

Comprehensive test suite covering:
- PDF text extraction with various scenarios
- OpenAI service with mocked responses
- DSL validation with edge cases
- Runner strict execution verification

## Security

- All OpenAI calls are server-side only
- No API keys exposed to frontend
- Rate limiting and file size limits
- Input sanitization and validation
- CORS configuration

## Non-Negotiables Met

✅ All OpenAI calls are server-side only  
✅ DSL is universal (no brand-specific assumptions)  
✅ Runner executes strictly what LLM returns  
✅ No hidden post-processing that changes semantics  
✅ Only non-semantic normalizations allowed (trim, resolve relative URLs)  
✅ Respects allowed_hosts exactly as provided  

## Usage

1. **Upload**: User provides target URL + PDF
2. **Generate**: Backend extracts text and calls OpenAI
3. **Review**: Frontend shows generated DSL (read-only by default)
4. **Run**: Backend executes exactly what's in the DSL
5. **Report**: Results with evidence and screenshots

The implementation is now universal, reliable, and follows strict execution principles for any text-based PDF.
