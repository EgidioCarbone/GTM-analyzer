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