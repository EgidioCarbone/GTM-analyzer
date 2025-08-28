// Tipo per i TAG
export interface GTMTag {
  name: string;
  type: string;
  parameter?: { key: string; value: string }[];
  paused?: boolean;
  unused?: boolean;
  description?: string;
  namingConvention?: boolean;
  lastModified?: string;
  createdBy?: string;
  tagId?: string; // ID univoco del tag
  firingTriggerId?: string | string[]; // ID dei trigger che attivano questo tag
}

// Tipo per i TRIGGER
export interface GTMTrigger {
  name: string;
  type: string;
  paused?: boolean;
  unused?: boolean;
  description?: string;
  namingConvention?: boolean;
  lastModified?: string;
  createdBy?: string;
  triggerId?: string; // ID univoco del trigger
  firingTriggerId?: string | string[]; // ID dei tag che questo trigger può attivare
}

// Tipo per le VARIABILI
export interface GTMVariable {
  name: string;
  type: string;
  paused?: boolean;
  unused?: boolean;
  description?: string;
  namingConvention?: boolean;
  lastModified?: string;
  createdBy?: string;
  variableId?: string; // ID univoco della variabile
  parameter?: { key: string; value: any }[]; // Parametri della variabile
  notes?: string; // Note aggiuntive
}

// Input della funzione generateMeasurementDoc
export interface GenerateDocInput {
  containerId: string;
  tag: GTMTag[];
  trigger: GTMTrigger[];
  variable: GTMVariable[];
  clientName: string;
  publicId: string;
  now: string;
  language: "it" | "en";
}

export interface AIContent {
  intro: string;
  tagDescriptions: Record<string, string>;
}

// Estensioni per il sistema di qualità
export interface QualityIndicator {
  score: number;
  issues: string[];
  recommendations: string[];
}

export interface ContainerHealth {
  overall: QualityIndicator;
  tags: QualityIndicator;
  triggers: QualityIndicator;
  variables: QualityIndicator;
  lastUpdated: string;
}

// ============================================================================
// VARIABLE QUALITY TYPES
// ============================================================================

export interface VariableQualityBreakdown {
  dlv: number;        // 0-1: Data Layer Variable quality
  regex: number;      // 0-1: Regex pattern quality
  selectors: number;  // 0-1: CSS/DOM selector quality
  js: number;         // 0-1: JavaScript variable quality
  lookup: number;     // 0-1: Lookup table quality
  hygiene: number;    // 0-1: Variable hygiene (unused, duplicates)
}

export interface VariableQualityStats {
  total: number;
  unused: number;
  duplicates: number;
  dlv_missing_fallback: number;
  lookup_without_default: number;
  regex_malformed: number;
  css_fragile_selectors: number;
  js_unsafe_code: number;
}

export interface VariableQualityIssue {
  severity: 'critical' | 'major' | 'minor';
  name: string;
  reason: string;
  suggestion: string;
  variable_id?: string;
}

export interface VariableQualityResult {
  variable_quality: {
    score: number;                    // 0-1
    breakdown: VariableQualityBreakdown;
    stats: VariableQualityStats;
    issues: VariableQualityIssue[];
  };
  message: {
    title: string;
    status: 'critical' | 'major' | 'minor' | 'ok';
    summary: string;
    cta: string;
  };
  impact: {
    weight: number;
    contribution: number;
  };
}

// ============================================================================
// HTML SECURITY TYPES
// ============================================================================

export interface HtmlSecurityIssue {
  type: string;
  message: string;
  url?: string; // For insecure requests
}

export interface HtmlSecurityDetail {
  id: string;
  name: string;
  severity: 'critical' | 'major' | 'minor';
  issues: HtmlSecurityIssue[];
  suggestion: string;
  fires_on: string;
  paused: boolean;
}

export interface HtmlSecurityResult {
  html_security: {
    checked: number;
    critical: number;
    major: number;
    minor: number;
    third_parties: string[];
    details: HtmlSecurityDetail[];
    score: number; // 0-1
  };
  message: {
    title: string;
    status: 'critical' | 'major' | 'minor' | 'ok';
    summary: string;
    cta: string;
  };
  impact: {
    weight: number;
    contribution: number;
  };
}

// ============================================================================
// ISSUES INDEX TYPES
// ============================================================================

export type IssueSeverity = 'critical' | 'major' | 'minor';
export type IssueCategory =
  | 'naming'
  | 'consent_missing'
  | 'trigger_all_pages'
  | 'trigger_timing'
  | 'trigger_unused'
  | 'trigger_duplicate'
  | 'trigger_blocking'
  | 'variable_dlv_fallback'
  | 'variable_lookup_default'
  | 'variable_regex_bad'
  | 'variable_css_fragile'
  | 'variable_js_unsafe'
  | 'variable_unused'
  | 'variable_duplicate'
  | 'html_security_critical'
  | 'html_security_major'
  | 'html_security_minor'
  | 'ua_obsolete'
  | 'paused'
  | 'no_trigger';

export interface IssueEntry {
  id: string;
  itemType: 'tag' | 'trigger' | 'variable';
  name: string;
  categories: IssueCategory[];
  severity: IssueSeverity;
  reason: string;
  suggestion?: string;
  meta?: Record<string, any>;
}

export interface IssuesIndex {
  byId: Record<string, IssueEntry[]>;
  byCategory: Record<IssueCategory, string[]>; // category -> ids
  counters: Partial<Record<IssueCategory, number>>;
}