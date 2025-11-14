// Clean GTM types used across the app
export interface GTMTag {
  name: string;
  type: string;
  parameter?: { key: string; value: any; type?: string }[];
  paused?: boolean;
  unused?: boolean;
  description?: string;
  namingConvention?: boolean;
  lastModified?: string;
  createdBy?: string;
  tagId?: string;
  firingTriggerId?: string | string[];
  blockingTriggerId?: string[];
  templateId?: string;
  html?: string;
  enableBuiltInVariable?: boolean;
  priority?: any;
  // permissive extension used by some services
  consentSettings?: any;
  // optional arbitrary metadata (used by analyzers)
  meta?: Record<string, any>;
}

export interface GTMTrigger {
  name: string;
  type: string;
  paused?: boolean;
  unused?: boolean;
  description?: string;
  namingConvention?: boolean;
  lastModified?: string;
  createdBy?: string;
  triggerId?: string;
  parameter?: { key: string; value: any; type?: string }[];
  eventName?: string;
  waitForTags?: boolean;
  checkValidation?: boolean;
  autoEventFilter?: any[];
  customEventFilter?: any[];
  // optional filter array used in several services
  filter?: any[];
}

export interface GTMVariable {
  name: string;
  type: string;
  paused?: boolean;
  unused?: boolean;
  description?: string;
  namingConvention?: boolean;
  lastModified?: string;
  createdBy?: string;
  variableId?: string;
  parameter?: { key: string; value: any }[];
  notes?: string;
  enableBuiltInVariable?: boolean;
  // optional additional fields used by some services/tests
  defaultValue?: any;
  lookupTable?: any[];
}

export interface GenerateDocInput {
  containerId: string;
  tag: GTMTag[];
  trigger: GTMTrigger[];
  variable: GTMVariable[];
  clientName: string;
  publicId: string;
  now: string;
  language: 'it' | 'en';
}

export interface AIContent {
  intro: string;
  tagDescriptions: Record<string, string>;
}

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
  byCategory: Partial<Record<IssueCategory, string[]>>;
  counters: Partial<Record<IssueCategory, number>>;
}

// Compatibility / placeholder exports for services that reference richer result types
// These are intentionally permissive (any) to reduce upstream type friction while
// we iteratively migrate services to share stricter types.
export type HtmlSecurityResult = any;
export type HtmlSecurityDetail = any;
export type HtmlSecurityIssue = any;

export type VariableQualityResult = any;
export type VariableQualityBreakdown = any;
export type VariableQualityStats = any;
export type VariableQualityIssue = any;

export type WebsiteChecklistResult = any;

export interface GTMContainer {
  tag?: GTMTag[];
  trigger?: GTMTrigger[];
  variable?: GTMVariable[];
  publicId?: string;
}

export type GTMContainerVersion = any;

 
