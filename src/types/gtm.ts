// Tipo per i TAG
export interface GTMTag {
  name: string;
  type: string;
  parameter?: { key: string; value: string }[];
}

// Tipo per i TRIGGER
export interface GTMTrigger {
  name: string;
  type: string;
}

// Tipo per le VARIABILI
export interface GTMVariable {
  name: string;
  type: string;
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