# SSD Test Configuration Guide

This document describes the environment variables and configuration options for the SSD Test pipeline.

## Required Environment Variables

### OpenAI Configuration
- `OPENAI_API_KEY`: Your OpenAI API key (required for PDF processing)
- `OPENAI_MODEL`: OpenAI model to use (default: `gpt-4o-mini`)

### Server Configuration
- `PORT`: Server port (default: `4000`)
- `VITE_API_BASE`: Frontend API base URL (default: `http://localhost:4000`)

### File Upload Configuration
- `MAX_UPLOAD_MB`: Maximum PDF file size in MB (default: `10`)

### Rate Limiting
- `RATE_LIMIT_WINDOW_MS`: Rate limit window in milliseconds (default: `900000` = 15 minutes)
- `RATE_LIMIT_MAX`: Maximum requests per window (default: `100`)

### Puppeteer Configuration
- `RUNNER_STEP_TIMEOUT_MS`: Step execution timeout in milliseconds (default: `30000`)
- `RUNNER_NAV_TIMEOUT_MS`: Navigation timeout in milliseconds (default: `60000`)

### Network Allowlist Configuration
- `PUPPETEER_ALLOWED_TRACKING`: Comma-separated list of tracking domains to allow
  - Default: `google-analytics.com,googletagmanager.com,g.doubleclick.net,facebook.com/tr,connect.facebook.net,analytics.google.com,www.google-analytics.com`
- `PUPPETEER_ALLOWED_CDNS`: Comma-separated list of CDN domains to allow
  - Default: `cdnjs.cloudflare.com,unpkg.com,jsdelivr.net,fonts.googleapis.com,fonts.gstatic.com`
- `PUPPETEER_ORIGIN_ALLOWLIST`: Additional allowed origins (comma-separated)

### CORS Configuration
- `CORS_ORIGIN`: CORS origin for frontend (default: `http://localhost:5173`)

## Example .env File

```bash
# OpenAI Configuration
OPENAI_API_KEY=sk-your-openai-api-key-here
OPENAI_MODEL=gpt-4o-mini

# Server Configuration
PORT=4000
VITE_API_BASE=http://localhost:4000

# File Upload Configuration
MAX_UPLOAD_MB=10

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100

# Puppeteer Configuration
RUNNER_STEP_TIMEOUT_MS=30000
RUNNER_NAV_TIMEOUT_MS=60000

# Network Allowlist Configuration
PUPPETEER_ALLOWED_TRACKING=google-analytics.com,googletagmanager.com,g.doubleclick.net,facebook.com/tr
PUPPETEER_ALLOWED_CDNS=cdnjs.cloudflare.com,unpkg.com,jsdelivr.net,fonts.googleapis.com,fonts.gstatic.com
PUPPETEER_ORIGIN_ALLOWLIST=example.com,www.example.com

# CORS Configuration
CORS_ORIGIN=http://localhost:5173
```

## Configuration Features

### 1. Ingestion Improvements
- **Exact Site URL**: The DSL site field is set to the exact URL provided by the user
- **Broadened Allowlist**: Automatically includes www and subdomains found in PDF text
- **Target Priority**: text → aria → href → selector resolution order
- **Placeholder Removal**: Replaces `[PRODUCT NAME]` with `*` wildcards
- **Ecommerce Reset**: Auto-injects `{ecommerce: null}` checks for GA4 events
- **Purchase No-Repeat**: Adds `no_repeat_on_reload` for purchase events

### 2. Runner Improvements
- **Smart Allowlist**: Allows tracking domains, CDNs, and common resource types
- **Target Resolution**: Improved resolution with region scoping and logging
- **Expectation Matching**: Enhanced subset matching and sequence checks
- **No-Repeat Testing**: Actual page reload testing for purchase events

### 3. Frontend Improvements
- **Editable DSL**: JSON editor with real-time validation
- **API Base URL**: Configurable API endpoint via environment variables
- **Better UX**: Clear error messages and validation feedback

### 4. Validation & Testing
- **Zod Schemas**: Strict validation for all DSL structures
- **Comprehensive Tests**: Unit tests for all major components
- **Smoke Tests**: End-to-end validation of the pipeline

## Security Considerations

1. **API Keys**: Never commit OpenAI API keys to version control
2. **CORS**: Configure appropriate CORS origins for production
3. **Rate Limiting**: Adjust rate limits based on expected usage
4. **File Uploads**: Set appropriate file size limits
5. **Network Allowlist**: Only allow necessary domains for your use case

## Production Deployment

For production deployment:

1. Set `NODE_ENV=production`
2. Configure proper CORS origins
3. Set up proper rate limiting
4. Use environment-specific API keys
5. Configure monitoring and logging
6. Set up proper error handling and alerting

## Troubleshooting

### Common Issues

1. **PDF Processing Fails**: Ensure PDF contains selectable text, not just images
2. **Target Resolution Fails**: Check if selectors are too generic or elements are not visible
3. **Network Requests Blocked**: Verify allowlist configuration includes necessary domains
4. **Validation Errors**: Check DSL structure against the schema requirements

### Debug Mode

Enable debug logging by setting `DEBUG=ssd:*` in your environment variables.
