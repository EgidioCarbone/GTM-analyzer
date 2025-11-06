import type { ModuleId, ModuleScenario, ModuleEventDefinition, ScenarioStep } from '../modules/types';

// SDD Test Types
// ============================================================================

export interface TestSpec {
  site: string;                       // required, absolute URL
  allowed_hosts?: string[];           // for cross-domain navigation allowlist
  consent?: ('reject' | 'accept')[];  // optional; if absent, default to ["accept"]
  tests: Test[];
  meta?: {                            // optional metadata from generation
    model: string;
    moduleId?: ModuleId;
    scenarioId?: string;
    scenarioName?: string;
    tokens: {
      input: number;
      output: number;
    };
  };
}

export type ModuleConfig = Record<string, unknown>;
export type ModuleSource = 'manifest' | 'openai' | 'scenario';

export interface Test {
  section: string;                    // e.g., "Header", "Checkout"
  steps: Step[];
}

export interface Step {
  description?: string;
  action: "click" | "input" | "wait_for_selector" | "wait_for_text" | "navigate" | "maybe_set_quantity" | "choose_payment" | "complete_order" | "custom";
  target?: Target;                    // optional for some waits
  value?: string;                     // for "input" or similar
  expect?: Expectation[];             // what should happen after the action
  severity?: "critical" | "major" | "minor";
  confidence?: number;                // 0..1 from LLM
  delayAfterMs?: number;              // optional pause after action (manual builder)
}

export interface Target {
  region?: "header" | "main" | "footer" | "any";
  kind: "text" | "selector" | "aria" | "href";
  value: string;
}

export interface Expectation {
  type: "dataLayer" | "ga4" | "gtm" | "network" | "navigation" | "no_repeat_on_reload";
  // For dataLayer:
  event?: string;
  params_subset?: object;             // must be subset of actual payload
  // For sequence/reset checks:
  near_previous_n?: number;           // e.g., verify {ecommerce:null} within last N pushes
  contains?: object;                  // generic subset for prior pushes
  // For ga4/gtm/network:
  url_contains?: string;              // e.g., "collect?v=2" or domain pattern
  // For navigation:
  url_matches?: string;               // regex string or simple "contains"
  // For no_repeat_on_reload:
  for_event?: string;
}

// API Request/Response Types
// ============================================================================

export interface SSDIngestRequest {
  moduleId: ModuleId;
  moduleConfig: ModuleConfig;
  url: string;
  pdf: File;
}

export interface SSDIngestResponse {
  dsl: TestSpec;
  pdfContent: string;
  pdfBufferPath: string;
  moduleId?: ModuleId;
  moduleSource?: ModuleSource;
  meta: {
    model: string;
    tokens: {
      input: number;
      output: number;
    };
  };
}

export interface Ambiguity {
  stepPath: string;                   // e.g., "tests[0].steps[2]"
  reason: string;
  candidates?: Target[];
}

export interface SSDRunRequest {
  moduleId: ModuleId;
  moduleConfig: ModuleConfig;
  moduleSource?: ModuleSource;
  dsl: TestSpec;
  runOptions?: {
    headless?: boolean;
    consent?: "accept" | "reject" | "both";
  };
}

export interface AntiBotChallenge {
  detected: boolean;
  reason?: string;
  provider?: string;
  title?: string;
  url?: string;
  message?: string;
}

export interface SSDRunResponse {
  report: TestReport;
}

export interface TestReport {
  // NEW STRUCTURE: Direct cookie and pdf results
  cookie?: {
    status: 'PASS' | 'FAIL' | 'ERROR' | 'BLOCKED';
    consentStatus?: string;
    dataLayerEvents?: any[];
    steps?: any[];
    error?: string | null;
    duration?: number;
    cookieBtnSelector?: string;
    cookieBtnOuterHTML?: string;
    challenge?: AntiBotChallenge | null;
  };
  pdf?: {
    status: 'PASS' | 'FAIL' | 'ERROR';
    source?: ModuleSource | 'llm';
    spec?: any;
    result?: {
      summary?: {
        steps: number;
        passed: number;
        failed: number;
        duration: number;
      };
    };
    steps?: any[];
    duration?: number;
    details?: string;
    llm?: {
      overallStatus: 'PASS' | 'FAIL';
      reasoning: string;
      stepFindings: Array<{
        description: string;
        status: 'PASS' | 'FAIL';
        message: string;
      }>;
      suggestedFixes?: string[];
    };
    llmError?: string;
  };
  scenario?: ScenarioRunReport | null;
  artifacts?: {
    htmlFile?: string;
    pdfTextFile?: string;
    screenshotsFolder?: string;
    rawLogsPath?: string;
  };
  
  // METADATA
  requestId?: string;
  url?: string;
  overallStatus?: 'PASS' | 'FAIL' | 'ERROR' | 'BLOCKED';
  summary?: {
    steps: number;
    totalTests?: number;
    passed: number;
    failed: number;
    blocked?: number;
    duration: number;                 // milliseconds
    consentProfiles: string[];
  };
  timestamp?: string;
  challenge?: AntiBotChallenge | null;
  
  // LEGACY STRUCTURE (for backward compatibility)
  results?: TestResult[];
  cookieConsentTest?: any;           // Results of cookie consent test
  pdfTests?: any;                    // Results of PDF tests
  pdfTestSpec?: any;                 // PDF test specification
}

export interface TestResult {
  section: string;
  stepIndex: number;
  description?: string;
  status: "PASS" | "FAIL";
  reasons?: string[];
  action?: string;
  target?: any;
  value?: string;
  evidence: {
    screenshotPathOrB64: string;
    dataLayerEvents: DataLayerEvent[];
    trackingHits: TrackingHit[];
  };
  timings: {
    startTime: number;
    endTime: number;
    duration: number;
  };
}

export interface DataLayerEvent {
  timestamp: number;
  payload: any;
}

export interface TrackingHit {
  timestamp: number;
  url: string;
  method: string;
  status?: number;
  domain: string;
}

export interface ScenarioValidationOutcome {
  status: 'PASS' | 'FAIL' | 'WARNING' | 'SKIPPED' | 'ERROR';
  eventName?: string | null;
  expectedPayload?: any;
  normalizedExpectedPayload?: any;
  matchedEventIndex?: number | null;
  matchedEvent?: any;
  reasoning?: string;
  differences?: string[];
  matchedEventSource?: 'deterministic' | 'llm';
  llm?: {
    status: 'MATCH' | 'NO_MATCH' | 'ERROR';
    reasoning: string;
    matchedEventIndex?: number | null;
    matchedEvent?: any;
    confidence?: number | null;
  };
  error?: string;
}

export interface ScenarioRunReport {
  status: 'PASS' | 'FAIL' | 'WARNING' | 'ERROR' | 'SKIPPED';
  steps?: TestResult[];
  summary?: {
    steps: number;
    passed: number;
    failed: number;
    duration: number;
    consentProfiles?: string[];
  };
  duration?: number;
  spec?: TestSpec | null;
  source?: ModuleSource | string;
  events?: DataLayerEvent[];
  validation?: ScenarioValidationOutcome | null;
  expectedPayload?: any;
  details?: string;
}

// Frontend State Types
// ============================================================================

export interface SSDTestState {
  currentStep: 'module' | 'scenario' | 'review' | 'run';
  moduleId: ModuleId | null;
  moduleConfig: ModuleConfig;
  moduleSource: ModuleSource | null;
  url: string;
  pdfFile: File | null;
  dsl: TestSpec | null;
  pdfContent: string | null;
  report: TestReport | null;
  isLoading: boolean;
  error: string | null;
  scenarios: ModuleScenario[];
  eventDefinitions: ModuleEventDefinition[];
  scenarioId: string | null;
  scenarioName: string;
  scenarioEventId: string | null;
  scenarioUrl: string;
  scenarioConfig: Record<string, unknown>;
  scenarioSteps: ScenarioStep[];
  scenarioExpectedPayload: string;
  scenarioExpectedPayloadError: string | null;
}

export interface DisambiguationItem {
  stepPath: string;
  step: Step;
  ambiguity: Ambiguity;
  suggestedTargets: Target[];
}

// Component Props Types
// ============================================================================

export interface UploadStepProps {
  state: SSDTestState;
  ssdConfig: any;
  configLoading: boolean;
  configError: string | null;
  moduleUrls?: string[];
  onFileUpload: (file: File) => void;
  onUrlChange: (url: string) => void;
  onIngest: () => void;
}

export interface ReviewStepProps {
  state: SSDTestState;
  editableDsl: string;
  isEditingDsl: boolean;
  dslValidationError: string | null;
  ambiguityMinConfidence: number;
  onDslEdit: (value: string) => void;
  onSaveDsl: () => void;
  onResetDsl: () => void;
  onReset: () => void;
  onRunTests: () => void;
}

export interface ResultsStepProps {
  state: SSDTestState;
  originalDsl: TestSpec | null;
  onReset: () => void;
  onExportReport: () => void;
  onRunTestsWithData: (dsl: any, pdfContent: string, pdfBufferPath?: string, moduleSource?: ModuleSource | null) => void;
}

export interface LoadingOverlayProps {
  isLoading: boolean;
  loadingType: 'pdf' | 'test' | null;
  typing: string;
  CurrentIcon: React.ComponentType<any>;
}

// Environment Configuration
// ============================================================================

export interface SSDConfig {
  openaiApiKey: string;
  openaiModel: string;
  puppeteerOriginAllowlist: string[];
  runnerStepTimeoutMs: number;
  runnerNavTimeoutMs: number;
  maxFileSize: number;
  rateLimitWindowMs: number;
  rateLimitMax: number;
  ambiguityMinConfidence: number;
}
