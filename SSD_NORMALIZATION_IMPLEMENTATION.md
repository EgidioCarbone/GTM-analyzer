# SSD Test - Site Normalization Implementation

## Overview
Implemented comprehensive site URL normalization to eliminate SCHEMA_VALIDATION errors by ensuring any input (hostname, URL without protocol, etc.) is normalized to `https://host.tld` format before validation.

## Changes Made

### 1. URL Normalization Utility (Already Existed)
**File:** `src/utils/url.ts`
- ✅ `normalizeOrigin()` function already implemented
- Converts any input to valid origin format (protocol + host + port)
- Adds `https://` if no protocol provided
- Removes path, query, and fragment
- Handles edge cases and validation

### 2. Schema Normalization
**Files Updated:**
- `src/services/ssdValidation.ts`
- `src/services/specValidation.ts` 
- `src/services/ssdOpenAIService.ts`

**Changes:**
```typescript
const SiteSchema = z.preprocess((v) => {
  // accetta undefined/string, normalizza in origin
  if (v == null) return v;
  try { 
    return normalizeOrigin(String(v)); 
  } catch { 
    return v; // lascia che Zod gestisca l'errore
  }
}, z.string().url("Site must be a valid URL"));
```

### 3. Server-Side Override and Validation
**File:** `server-ssd.ts` - POST `/api/spec/generate`

**Implementation:**
```typescript
// 1) leggi l'URL della form (accetta sia 'url' che 'site')
const rawInputUrl = String(req.body?.url ?? req.body?.site ?? "").trim();
if (!rawInputUrl) {
  return res.status(400).json({ 
    error: "Missing target URL", 
    code: "INVALID_URL" 
  });
}

// 2) ottieni il DSL dall'LLM (stringa o oggetto)
const dslFromLLM = openaiResponse.dsl ?? {};

// 3) forzatura/merge: il site del DSL è sempre l'origin scelto dall'utente
const mergedDsl = { ...dslFromLLM, site: targetOrigin };

// 4) LOG mirato: cosa stiamo per validare?
console.info("[SSD] validating DSL with site:", mergedDsl?.site);

// 5) valida con lo schema che normalizza internamente
const validatedDSL = validateTestSpec(mergedDsl);

// 6) usa **sempre** 'validatedDSL' per tutto il resto
```

### 4. Enhanced Error Handling
**Added Zod-specific error handling:**
```typescript
// Handle Zod validation errors specifically
if (error instanceof z.ZodError) {
  console.warn("[SSD] Zod fail on site with value:", mergedDsl?.site);
  return res.status(422).json({ 
    error: "DSL schema validation failed", 
    code: "SCHEMA_VALIDATION", 
    fieldErrors: error.flatten().fieldErrors 
  });
}
```

### 5. Comprehensive Logging
**Added logging at key points:**
- `[SSD] validating DSL with site:` - Shows what's being validated
- `[SSD] Zod fail on site with value:` - Shows failed validation values
- `[SSD] validating DSL for run with site:` - Shows run-time validation

### 6. Unit Tests
**Created test files:**
- `src/utils/__tests__/url.test.ts` - Tests URL normalization utility
- `src/services/__tests__/schemaNormalization.test.ts` - Tests schema normalization

## Test Results
✅ All normalization tests pass:
- `fibra.aruba.it` → `https://fibra.aruba.it`
- `https://fibra.aruba.it` → `https://fibra.aruba.it` (preserved)
- `https://fibra.aruba.it/qualcosa` → `https://fibra.aruba.it` (path removed)
- `http://example.com:8080` → `http://example.com:8080` (port preserved)

## Acceptance Criteria Met

✅ **Any PDF with input `fibra.aruba.it` or `https://fibra.aruba.it/` will not return SCHEMA_VALIDATION error on site**

✅ **Single validation log line appears with `site: https://fibra.aruba.it`**

✅ **No other call-sites validate DSL different from `validatedDsl`**

✅ **Comprehensive error logging shows exactly what values are being validated**

## Key Benefits

1. **Eliminates SCHEMA_VALIDATION errors** - Any valid domain/URL input is normalized before validation
2. **Consistent normalization** - All validation points use the same normalized format
3. **Better debugging** - Clear logging shows exactly what's being validated
4. **Maintains existing functionality** - No breaking changes to existing API
5. **Comprehensive error handling** - Distinguishes between request and DSL validation errors

## Files Modified

- `src/services/ssdValidation.ts` - Added site normalization to schema
- `src/services/specValidation.ts` - Added site normalization to schema  
- `src/services/ssdOpenAIService.ts` - Added site normalization to schema
- `server-ssd.ts` - Enhanced override logic and error handling
- `src/utils/__tests__/url.test.ts` - Unit tests for URL normalization
- `src/services/__tests__/schemaNormalization.test.ts` - Unit tests for schema normalization

The implementation ensures that any input like `fibra.aruba.it` will be automatically normalized to `https://fibra.aruba.it` and pass validation, eliminating the SCHEMA_VALIDATION error completely.
