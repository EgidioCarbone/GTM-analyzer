# SSD Test – Quick Reference

## Goal
Convert PDF test specifications into executable DSL, run both cookie-consent and DSL-derived checks against a target site, and return a structured report consumable by the frontend.

## Components
- **Frontend (Vite/React)**: page `src/pages/SSDTestPage.tsx` with 3-step wizard and detailed results view (`src/components/ssd/*`).
- **Backend Express server**: `server.js` (simplified) and `server-ssd.ts` (full stack with consent runner + Puppeteer + LLM helpers).
- **Runner services**: `src/services/ssdPuppeteerRunner.ts`, `ssdConsentHandler.ts`, `ssdExpectationMatcher.ts`, etc.
- **Types and validators**: `src/types/ssd.ts`, `src/services/ssdValidation.ts`.

## API Endpoints (server-ssd.ts)
- `GET /api/ssd/config` – returns upload limits and supported formats.
- `GET /api/ssd/fetch-html?url=...` – pulls remote HTML, detects cookie banner.
- `POST /api/spec/generate` – accepts `multipart/form-data` with `url` & `pdf`, extracts text, runs LLM to build DSL.
- `POST /api/ssd/run` – executes consent + DSL tests. Responds with `{ report: TestReport }`.

## Frontend Flow
1. Upload PDF & URL.
2. Automatically invokes `/api/ssd/fetch-html` then `/api/spec/generate`.
3. Immediately calls `/api/ssd/run` with DSL, raw PDF text, optional buffer path, and run options.
4. Progress modal uses `useAnalysisProgress`; results page renders the returned `report` directly (no mock data).

## Report Payload (what `/api/ssd/run` should return)
```json
{
  "report": {
    "summary": {
      "steps": 4,
      "passed": 3,
      "failed": 1,
      "duration": 48000,
      "consentProfiles": ["accept", "reject"]
    },
    "results": [
      {
        "section": "Header Navigation",
        "stepIndex": 0,
        "description": "Click header menu link",
        "status": "FAIL",
        "reasons": ["Expected dataLayer event 'header_menu_click' not found"],
        "evidence": {
          "screenshotPathOrB64": "screenshots/step-0.png",
          "dataLayerEvents": [{ "timestamp": 1700000000000, "payload": { "event": "cookie_consent_update" } }],
          "trackingHits": []
        },
        "timings": {
          "startTime": 1700000000000,
          "endTime": 1700000008000,
          "duration": 8000
        }
      }
    ],
    "cookieConsentTest": {
      "status": "PASS",
      "description": "Banner handled correctly",
      "details": "...",
      "events": ["cookie_consent_update", "cookie_consent_marketing"]
    },
    "pdfTests": {
      "status": "FAIL",
      "description": "Generated DSL execution",
      "details": "Missing header_menu_click",
      "expectedEvent": "header_menu_click",
      "error": "Expected dataLayer event not found"
    },
    "artifacts": {
      "screenshotsFolder": "screenshots/req_123",
      "rawLogsPath": "logs/req_123.json"
    }
  }
}
```
`summary` and `results` are mandatory; other blocks are optional.

## dataLayer & GTM Hooking
- `ssdPuppeteerRunner` injects a script that patches `window.dataLayer` **and** every `google_tag_manager[...].dataLayer`.
- Every `push` is forwarded immediately to `__ssdCaptureDataLayerEvent` (even if GTM consumes it), so events like `header_menu_click` are captured in real time.
- Runner waits ~15s after clicks; screenshot filenames are returned in `evidence.screenshotPathOrB64` (base64 if capture fails).

## Typical Execution (example log excerpt)
1. `/api/ssd/fetch-html` detects cookie banner, enumerates CTA selectors.
2. `/api/spec/generate` parses PDF and LLM returns DSL.
3. `/api/ssd/run` request body contains DSL + `pdfContent` + `pdfBufferPath` + `runOptions` (`{ headless: true, consent: "both" }`).
4. Cookie test runs first (accept + reject depending on options) → PASS.
5. PDF test executes header click, dataLayer hook inspects pushes. If event absent, result FAIL with detailed reason.
6. Response 200 with structured `report`.

## Running Locally
```bash
npm run dev            # concurrently launches backend (server-ssd.ts via tsx), puppeteer server, and frontend
# or individually:
npx tsx server-ssd.ts  # backend
node puppeteerServer.js
npm run frontend
```
`vitest` unit example: `npx vitest run src/utils/__tests__/report.test.ts`

## Known Caveats
- Global `npx tsc --noEmit` currently fails because of legacy AI-Sentinel typing issues (unrelated to SSD). Focus on `vitest` or targeted builds for SSD work.
- Ensure `OPENAI_API_KEY` is set; otherwise spec generation falls back or errors.
- Temporary files are written to `temp-html/` and `temp-pdf/` with request IDs for debugging.

## Useful Paths
- Frontend page & components: `src/pages/SSDTestPage.tsx`, `src/components/ssd/*`
- Runner & helpers: `src/services/ssdPuppeteerRunner.ts`, `ssdConsentHandler.ts`, `ssdExpectationMatcher.ts`
- Docs/status: `SSD_TEST_STATUS.md`, `docs/SSD_TEST_OVERVIEW.md`
