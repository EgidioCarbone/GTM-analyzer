# SSD Test Pipeline Reliability Improvements

## Overview

This document summarizes the comprehensive reliability improvements made to the SSD Test pipeline to ensure it works reliably with any text-based PDF and real websites. All changes maintain backward compatibility and don't break existing features.

## ✅ A) Ingestion Fixes (PDF → DSL)

### 1. Exact URL Setting
- **Implementation**: `server-ssd.ts` - `postProcessDSL()` function
- **Feature**: Ensures `dsl.site` is set to the exact user URL (not just domain)
- **Code**: `dsl.site = targetUrl;`
- **Example**: `https://example.com/checkout?step=1&product=123` instead of `https://example.com`

### 2. Comprehensive Allowed Hosts
- **Implementation**: `buildAllowedHosts()` function with improved regex
- **Feature**: Builds unique array including:
  - Hostname and www.hostname
  - Detected subdomains from PDF text (e.g., museomondomilan.acmilan.com, tickets.acmilan.com)
  - ENV fallback list without duplicates
- **Code**: Enhanced regex pattern and domain validation logic
- **Example**: `['acmilan.com', 'www.acmilan.com', 'museomondomilan.acmilan.com', 'tickets.acmilan.com']`

### 3. Target Priority (Text/Aria First)
- **Implementation**: `improveTarget()` function with CTA pattern detection
- **Feature**: Adjusts target priority to: text → aria → href → selector
- **Code**: Suggests text/aria alternatives for generic CSS selectors
- **Example**: `button.btn-primary` → suggests `text` target for "Acquista il tuo biglietto"

### 4. Region Coercion
- **Implementation**: Enhanced `improveTarget()` function
- **Feature**: Coerces unknown regions (checkout, thank-you, etc.) to "any"
- **Code**: `const supportedRegions = ['header', 'main', 'footer', 'any'];`
- **Example**: `region: 'checkout'` → `region: 'any'`

### 5. Placeholder Removal
- **Implementation**: Enhanced `processExpectations()` function
- **Feature**: Removes various placeholder patterns and uses wildcards
- **Code**: Detects `[PRODUCT NAME]`, `{{variable}}`, `${variable}`, `N/A`, `TBD`, `TODO`
- **Example**: `item_name: '[PRODUCT NAME]'` → `item_name: '*'`

### 6. Auto-inject GA4 Ecommerce Reset
- **Implementation**: `injectEcommerceResets()` function
- **Feature**: For ecommerce events, always adds reset expectation
- **Code**: Adds `{ "type":"dataLayer", "contains": { "ecommerce": null }, "near_previous_n": 3 }`
- **Events**: add_to_cart, begin_checkout, add_payment_info, add_shipping_info, add_billing_info, purchase

### 7. Purchase No-Repeat
- **Implementation**: `addPurchaseNoRepeat()` function
- **Feature**: If step expects "purchase", appends no_repeat_on_reload
- **Code**: Adds `{ "type":"no_repeat_on_reload", "for_event":"purchase" }`

### 8. Enhanced Validation & Errors
- **Implementation**: Improved error handling in ingest endpoint
- **Feature**: Returns 422 with clear hints for invalid DSL or image-only PDF
- **Code**: Specific error messages for different validation failures

## ✅ B) Runner Fixes (DSL → Puppeteer → Report)

### 1. Relative Href Handling
- **Implementation**: `executeNavigateStep()` with URL resolution
- **Feature**: Handles relative URLs correctly without "Cannot navigate to invalid URL"
- **Code**: `new URL(href, page.url())` for relative path resolution
- **Examples**: 
  - `/checkout` → `https://example.com/checkout`
  - `./cart` → `https://example.com/cart`
  - `checkout` → `https://example.com/shop/checkout`

### 2. Network Allowlist (No Over-blocking)
- **Implementation**: Enhanced `isRequestAllowed()` method
- **Feature**: Allows essential domains without blocking critical resources
- **Code**: Comprehensive allowlist including:
  - Site host + dsl.allowed_hosts
  - Tracking: google-analytics.com, googletagmanager.com, g.doubleclick.net, facebook.com/tr
  - CDNs: fonts.googleapis.com, cdnjs.cloudflare.com, unpkg.com, jsdelivr.net
  - CMPs: consent.trustarc.com, consent.cookiebot.com, etc.
  - Common resource types: css, js, png, jpg, etc.

### 3. Target Resolver Order
- **Implementation**: Enhanced `resolveTarget()` with better logging
- **Feature**: Enforces resolution order: region scope → text → aria → href → selector
- **Code**: Detailed logging and candidate evaluation
- **Debugging**: Shows which method succeeded and alternative candidates

### 4. Expectation Matcher
- **Implementation**: Enhanced matching logic in `ssdExpectationMatcher.ts`
- **Feature**: 
  - Subset matching for params_subset (expected ⊆ actual)
  - Sequence checks for ecommerce reset (near_previous_n + contains)
  - No-repeat testing with actual page reload
- **Code**: Async implementation for no-repeat testing

### 5. Evidence & Privacy
- **Implementation**: Enhanced evidence collection
- **Feature**: 
  - Per-step screenshots
  - Filtered dataLayerEvents and trackingHits
  - Best-effort redaction for sensitive values
- **Code**: Configurable redaction patterns

### 6. Timeouts & Resilience
- **Implementation**: Configurable timeouts via ENV
- **Feature**: 
  - RUNNER_STEP_TIMEOUT_MS, RUNNER_NAV_TIMEOUT_MS
  - Jittered waits after clicks for SPA stability
- **Code**: `Math.random() * 500 + 500` ms jitter

## ✅ C) Frontend Improvements (SSDTestPage.tsx)

### 1. Editable Review
- **Implementation**: JSON editor with real-time validation
- **Feature**: 
  - Editable DSL with inline error highlighting
  - "Reset to generated" button
  - "Run Tests" disabled when JSON is invalid
- **Code**: `validateDsl()`, `handleDslEdit()`, `handleSaveDsl()` functions

### 2. API Base URL
- **Implementation**: Environment variable configuration
- **Feature**: Uses VITE_API_BASE with fallback to same-origin
- **Code**: `const apiBaseUrl = import.meta.env.VITE_API_BASE || fallback;`

### 3. Enhanced UX
- **Implementation**: Better error handling and display
- **Feature**: 
  - Shows ambiguities[] with candidate targets
  - Renders 422 messages in human-readable form
  - Evidence viewer with screenshots and payload excerpts

## ✅ D) Environment Configuration

### New Environment Variables
- `VITE_API_BASE`: Frontend API base URL
- `PUPPETEER_ALLOWED_TRACKING`: Comma-separated tracking domains
- `PUPPETEER_ALLOWED_CDNS`: Comma-separated CDN domains
- `PUPPETEER_ORIGIN_ALLOWLIST`: Additional allowed origins
- `RUNNER_STEP_TIMEOUT_MS`: Step execution timeout
- `RUNNER_NAV_TIMEOUT_MS`: Navigation timeout

### Configuration Features
- All LLM calls remain server-side
- Secrets never exposed to frontend
- Comprehensive error handling
- Configurable timeouts and limits

## ✅ E) Comprehensive Testing

### 1. Reliability Tests
- **File**: `src/test-ssd-reliability.ts`
- **Coverage**: 
  - DSL post-processing validation
  - Target priority and region coercion
  - Placeholder removal and wildcard usage
  - Ecommerce reset and no-repeat injection
  - Relative URL resolution
  - Network allowlist functionality
  - Expectation matching logic
  - Frontend validation

### 2. Runner Smoke Tests
- **File**: `src/test-ssd-runner-smoke.ts`
- **Coverage**: 
  - End-to-end pipeline validation
  - Mock data generation
  - URL resolution testing
  - Network allowlist testing
  - Expectation matching testing
  - Target resolution priority testing

### 3. Integration Tests
- **Coverage**: Complete DSL processing pipeline
- **Validation**: All improvements working together
- **Error Handling**: Comprehensive error scenarios

## ✅ Acceptance Criteria - All Met

### /api/ssd/ingest Returns Validated DSL With:
- ✅ Exact site URL (not just domain)
- ✅ Expanded allowed_hosts with subdomains
- ✅ Text/aria-first targets with CSS selector suggestions
- ✅ Ecommerce resets for GA4 events
- ✅ No placeholders, wildcards for variable fields
- ✅ Purchase no-repeat on reload
- ✅ Useful ambiguities when applicable
- ✅ Clear 422 errors for validation failures

### Review Step:
- ✅ Allows safe edits with real-time validation
- ✅ "Reset to generated" restores original
- ✅ "Run Tests" disabled when JSON invalid

### Runner:
- ✅ Resolves targets reliably with detailed logging
- ✅ Relative href no longer causes "invalid URL"
- ✅ Network interception doesn't break tracking/CDNs
- ✅ Reports contain PASS/FAIL per step with evidence
- ✅ No LLM calls from frontend
- ✅ Secrets never exposed

## 🚀 Production Readiness Features

1. **Reliability**: Handles any text-based PDF and real websites
2. **Robustness**: Comprehensive error handling and recovery
3. **Performance**: Configurable timeouts and resource management
4. **Security**: All LLM calls server-side, proper API key handling
5. **Maintainability**: Comprehensive tests and documentation
6. **User Experience**: Intuitive interface with real-time feedback
7. **Flexibility**: Configurable via environment variables
8. **Debugging**: Detailed logging and candidate evaluation

## 📁 Files Modified

### Core Implementation
- `server-ssd.ts` - Enhanced post-processing and error handling
- `src/services/ssdPuppeteerRunner.ts` - Improved runner with better allowlist
- `src/services/ssdTargetResolver.ts` - Enhanced target resolution with logging
- `src/services/ssdExpectationMatcher.ts` - Improved expectation matching
- `src/pages/SSDTestPage.tsx` - Enhanced frontend with editable DSL

### Testing & Documentation
- `src/test-ssd-reliability.ts` - Comprehensive reliability tests
- `src/test-ssd-runner-smoke.ts` - Runner smoke tests
- `SSD_RELIABILITY_IMPROVEMENTS.md` - This summary

## 🎯 Key Improvements Summary

1. **Exact URL Handling**: DSL site field uses exact user URL
2. **Smart Allowlist**: Comprehensive domain allowlist with subdomain detection
3. **Target Priority**: Text/aria first with CSS selector suggestions
4. **Placeholder Removal**: Comprehensive placeholder detection and wildcard replacement
5. **Ecommerce Integration**: Auto-injected reset checks and no-repeat testing
6. **Relative URL Support**: Proper handling of relative navigation
7. **Network Intelligence**: Smart allowlist preventing over-blocking
8. **Enhanced Debugging**: Detailed logging and candidate evaluation
9. **Editable DSL**: Real-time validation and editing capabilities
10. **Comprehensive Testing**: Full test coverage for all improvements

The SSD Test pipeline is now highly reliable for any text-based PDF and real websites, with comprehensive error handling, detailed logging, and robust testing coverage.
