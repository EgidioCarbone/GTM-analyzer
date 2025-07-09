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

// Contenitore completo
export interface ContainerData {
  containerId: string;
  tag: GTMTag[];
  trigger: GTMTrigger[];
  variable: GTMVariable[];
}

// Input della funzione generateMeasurementDoc
export interface GenerateDocInput {
  container: ContainerData;
  clientName: string;
  publicId: string;
  now: string;
  language: "it" | "en";
}
