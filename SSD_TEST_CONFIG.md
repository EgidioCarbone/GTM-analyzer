# SSD Test Configuration

## Environment Variables

Create a `.env` file in the project root with the following variables:

```bash
# OpenAI Configuration (Required for SSD Test)
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4o-mini

# Server Configuration
PORT=4000
CORS_ORIGIN=http://localhost:5173

# File Upload Configuration
MAX_FILE_SIZE=10485760
# 10MB in bytes

# Rate Limiting Configuration
RATE_LIMIT_WINDOW_MS=900000
# 15 minutes in milliseconds
RATE_LIMIT_MAX=100
# Maximum requests per window

# Puppeteer Configuration
PUPPETEER_ORIGIN_ALLOWLIST=example.com,test.com
# Comma-separated list of allowed domains for navigation
RUNNER_STEP_TIMEOUT_MS=30000
# 30 seconds timeout for individual test steps
RUNNER_NAV_TIMEOUT_MS=60000
# 60 seconds timeout for navigation

# Security Configuration
NODE_ENV=development
# Set to 'production' for production deployment
```

## Required Dependencies

The following packages are required for the SSD Test feature:

```bash
npm install pdf-parse zod multer express-rate-limit helmet
```

## API Endpoints

### POST /api/ssd/ingest
Converts a PDF slide deck into a structured test specification (DSL).

**Request:**
- Content-Type: multipart/form-data
- Fields:
  - `url` (string): Target website URL
  - `pdf` (file): PDF file containing test specifications

**Response:**
```json
{
  "dsl": {
    "site": "https://example.com",
    "allowed_hosts": ["example.com"],
    "consent": ["accept", "reject"],
    "tests": [...]
  },
  "ambiguities": [...],
  "meta": {
    "tokens": 1500,
    "model": "gpt-4o-mini",
    "ingestionWarnings": [...]
  }
}
```

### POST /api/ssd/run
Executes the DSL test specification using Puppeteer.

**Request:**
```json
{
  "dsl": { /* TestSpec object */ },
  "runOptions": {
    "headless": true,
    "consent": "both"
  }
}
```

**Response:**
```json
{
  "report": {
    "summary": {
      "steps": 10,
      "passed": 8,
      "failed": 2,
      "duration": 45000,
      "consentProfiles": ["accept", "reject"]
    },
    "results": [...],
    "artifacts": {
      "screenshotsFolder": "screenshots",
      "rawLogsPath": "screenshots/raw-logs.json"
    }
  }
}
```

### GET /api/ssd/config
Returns configuration information for the frontend.

## Usage

1. **Upload Phase**: Upload a PDF slide deck and provide the target website URL
2. **Review Phase**: Review the generated DSL and fix any ambiguous targets
3. **Run Phase**: Execute the tests and view results with evidence

## Security Features

- Rate limiting on all API endpoints
- File type validation (PDF only)
- File size limits
- Host allowlist for navigation
- Input validation with Zod schemas
- Error handling and logging

## Troubleshooting

### Common Issues

1. **OpenAI API Key Missing**
   - Ensure `OPENAI_API_KEY` is set in your environment
   - Check that the API key is valid and has sufficient credits

2. **PDF Processing Errors**
   - Ensure the PDF is not password-protected
   - Check that the PDF contains readable text (not just images)
   - Verify file size is under the limit

3. **Puppeteer Navigation Errors**
   - Check that the target URL is accessible
   - Verify the domain is in the allowlist
   - Ensure the website doesn't block automated browsers

4. **Test Execution Failures**
   - Check that selectors are still valid
   - Verify the website hasn't changed since DSL generation
   - Review screenshots for visual changes

### Debug Mode

Set `NODE_ENV=development` to enable detailed logging and error messages.
