// SSD Test Types
// ============================================================================

export interface TestSpec {
  site: string;                       // required, absolute URL
  allowed_hosts?: string[];           // for cross-domain navigation allowlist
  consent?: ("reject" | "accept")[];  // optional; if absent, default to ["accept"]
  tests: Test[];
  meta?: {                           // optional metadata from generation
    model: string;
    tokens: {
      input: number;
      output: number;
    };
  };
}

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
  url: string;
  pdf: File;
}

export interface SSDIngestResponse {
  dsl: TestSpec;
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
  dsl: TestSpec;
  runOptions?: {
    headless?: boolean;
    consent?: "accept" | "reject" | "both";
  };
}

export interface SSDRunResponse {
  report: TestReport;
}

export interface TestReport {
  summary: {
    steps: number;
    passed: number;
    failed: number;
    duration: number;                 // milliseconds
    consentProfiles: string[];
  };
  results: TestResult[];
  artifacts: {
    screenshotsFolder: string;
    rawLogsPath: string;
  };
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

// Frontend State Types
// ============================================================================

export interface SSDTestState {
  currentStep: 'upload' | 'review' | 'run';
  url: string;
  pdfFile: File | null;
  dsl: TestSpec | null;
  pdfContent: string | null;
  report: TestReport | null;
  isLoading: boolean;
  error: string | null;
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
}

export interface ResultsStepProps {
  state: SSDTestState;
  originalDsl: TestSpec | null;
  onReset: () => void;
  onExportReport: () => void;
  onRunTestsWithData: (dsl: any, pdfContent: string, pdfBufferPath?: string) => void;
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
