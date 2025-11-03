// Shared module definitions for vertical SSD Test support
// Each module provides metadata and configuration schema used by the UI and runner

export type ModuleId = 'fibra' | 'genertel';

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

export interface ModuleCMPConfig {
  vendor: string;
  actions: {
    acceptAllButton?: string;
    rejectAllButton?: string;
    preferencesButton?: string;
  };
  notes?: string;
}

export interface ModuleSelectorEntry {
  selector: string;
  description?: string;
  expectedEvent?: string;
  dataLayer?: Record<string, string>;
  notes?: string;
}

export interface ModuleSelectors {
  [key: string]: string | ModuleSelectorEntry[] | ModuleSelectorEntry | ModuleSelectors;
}

export interface ModuleUseCaseStepEvent {
  event: string;
  payload?: Record<string, unknown>;
}

export interface ModuleUseCaseStep {
  action: 'click' | 'input' | 'waitFor' | 'navigate' | 'assertEvent';
  description?: string;
  targetSelector?: string;
  value?: string;
  waitForSelector?: string;
  expectEvents?: ModuleUseCaseStepEvent[];
  expectUrlContains?: string;
  notes?: string;
}

export interface ModuleUseCase {
  id: string;
  label: string;
  description?: string;
  steps: ModuleUseCaseStep[];
  trackingEvents?: string[];
  artifacts?: {
    screenshot?: string;
  };
}

export interface ModuleManifest {
  cmp?: ModuleCMPConfig;
  selectors?: ModuleSelectors;
  useCases?: ModuleUseCase[];
  notes?: string;
}

export interface SSDModule {
  meta: ModuleMeta;
  supportedHosts: string[];
  configFields: ModuleConfigField[];
  defaultConfig?: Record<string, unknown>;
  manifest?: ModuleManifest;
  defaultUrls?: string[];
}
