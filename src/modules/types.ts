import type { TestSpec } from '../types/ssd';

// Shared module definitions for vertical SDD Test support
// Each module provides metadata and configuration schema used by the UI and runner

export type ModuleId = string;

export interface ModuleMeta {
  id: ModuleId;
  title: string;
  description: string;
  tags?: string[];
  accentColor?: string;
  icon?: string;
}

export type ModuleConfigFieldType = 'select' | 'text' | 'textarea' | 'checkbox' | 'multi-select';

export interface ModuleConfigOption {
  value: string;
  label: string;
  description?: string;
}

export interface ModuleConfigField {
  id: string;
  label: string;
  type: ModuleConfigFieldType;
  helperText?: string;
  placeholder?: string;
  required?: boolean;
  defaultValue?: string | string[] | boolean;
  options?: ModuleConfigOption[];
}

export interface SSDModule {
  meta: ModuleMeta;
  supportedHosts: string[];
  configFields: ModuleConfigField[];
  defaultConfig?: Record<string, unknown>;
  defaultUrls?: string[];
}

export interface ScenarioInputDefinition {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'selector' | 'url';
  helperText?: string;
  required?: boolean;
  placeholder?: string;
}

export type EventStepType = 'navigate' | 'click' | 'custom';

export interface EventStepDefinition {
  id: string;
  label: string;
  type: EventStepType;
  description?: string;
  input?: {
    id: string;
    label: string;
    placeholder?: string;
    required?: boolean;
    helperText?: string;
    type?: 'text' | 'selector' | 'url';
  };
}

export interface ModuleEventDefinition {
  id: string;
  label: string;
  description: string;
  inputs: ScenarioInputDefinition[];
  steps: EventStepDefinition[];
  expectationTemplate?: {
    type: 'dataLayer';
    event: string;
    payloadTemplate: any;
  };
  buildTestSpec: (args: {
    moduleId: ModuleId;
    url: string;
    config: Record<string, unknown>;
    steps: ScenarioStep[];
  }) => import('../types/ssd').TestSpec;
}

export interface ModuleScenario {
  id: string;
  moduleId: ModuleId;
  name: string;
  eventId: string;
  url: string;
  config: Record<string, unknown>;
  steps: ScenarioStep[];
  expectedPayload: any | null;
  testSpec?: TestSpec | null;
  testSpecMeta?: {
    generatedAt: string;
    model?: string;
    tokens?: {
      input: number;
      output: number;
    };
    source: 'scenario-llm' | 'manual' | 'module';
    error?: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface ScenarioStep {
  id: string;
  type: EventStepType;
  label: string;
  selector?: string;
  description?: string;
  value?: string;
  delayAfterMs?: number;
}

export type CMPValidationStatus = 'ACCEPTED' | 'REJECTED' | 'UNKNOWN' | 'ERROR';

export interface ModuleCMPValidation {
  status: CMPValidationStatus;
  reasoning: string;
  executedAt: string;
  evidence?: string[];
  eventsCaptured?: number;
  sampleEvents?: any[];
}

export interface ModuleCMPSettings {
  selector: string;
  vendor?: string;
  testUrl?: string;
  validatedAt: string;
  lastValidation: ModuleCMPValidation;
}

export interface ModuleSettings {
  moduleId: ModuleId;
  updatedAt: string;
  cmp?: ModuleCMPSettings;
}
