// Utility per gestire la persistenza delle scelte di disambiguazione
// =================================================================

import CryptoJS from 'crypto-js';

export interface DisambiguationChoice {
  stepPath: string;
  originalTarget: any;
  chosenTarget: any;
  timestamp: number;
  reason: string;
}

export interface DisambiguationState {
  dslHash: string;
  choices: DisambiguationChoice[];
  lastModified: number;
}

/**
 * Genera un hash del DSL per identificare univocamente la versione
 */
export function generateDslHash(dsl: any): string {
  const dslString = JSON.stringify(dsl, null, 0);
  return CryptoJS.MD5(dslString).toString().substring(0, 16);
}

/**
 * Chiave per localStorage basata su hash del DSL
 */
export function getStorageKey(dslHash: string): string {
  return `ssd.disambiguation.${dslHash}`;
}

/**
 * Carica le scelte di disambiguazione dal localStorage
 */
export function loadDisambiguationState(dslHash: string): DisambiguationState | null {
  try {
    const key = getStorageKey(dslHash);
    const stored = localStorage.getItem(key);
    
    if (!stored) return null;
    
    const state: DisambiguationState = JSON.parse(stored);
    
    // Verifica che l'hash corrisponda
    if (state.dslHash !== dslHash) {
      console.warn('DSL hash mismatch, clearing stored disambiguation state');
      localStorage.removeItem(key);
      return null;
    }
    
    return state;
  } catch (error) {
    console.error('Error loading disambiguation state:', error);
    return null;
  }
}

/**
 * Salva le scelte di disambiguazione nel localStorage
 */
export function saveDisambiguationState(state: DisambiguationState): void {
  try {
    const key = getStorageKey(state.dslHash);
    localStorage.setItem(key, JSON.stringify(state));
  } catch (error) {
    console.error('Error saving disambiguation state:', error);
  }
}

/**
 * Aggiunge una nuova scelta di disambiguazione
 */
export function addDisambiguationChoice(
  dslHash: string,
  stepPath: string,
  originalTarget: any,
  chosenTarget: any,
  reason: string
): DisambiguationState {
  const existingState = loadDisambiguationState(dslHash) || {
    dslHash,
    choices: [],
    lastModified: Date.now()
  };
  
  const newChoice: DisambiguationChoice = {
    stepPath,
    originalTarget,
    chosenTarget,
    timestamp: Date.now(),
    reason
  };
  
  const updatedState: DisambiguationState = {
    ...existingState,
    choices: [...existingState.choices, newChoice],
    lastModified: Date.now()
  };
  
  saveDisambiguationState(updatedState);
  return updatedState;
}

/**
 * Annulla l'ultima modifica (undo singolo livello)
 */
export function undoLastDisambiguationChoice(dslHash: string): DisambiguationState | null {
  const existingState = loadDisambiguationState(dslHash);
  
  if (!existingState || existingState.choices.length === 0) {
    return null;
  }
  
  const updatedState: DisambiguationState = {
    ...existingState,
    choices: existingState.choices.slice(0, -1),
    lastModified: Date.now()
  };
  
  if (updatedState.choices.length === 0) {
    // Se non ci sono più scelte, rimuovi completamente dal localStorage
    const key = getStorageKey(dslHash);
    localStorage.removeItem(key);
    return null;
  }
  
  saveDisambiguationState(updatedState);
  return updatedState;
}

/**
 * Resetta tutte le scelte di disambiguazione per un DSL
 */
export function resetDisambiguationState(dslHash: string): void {
  const key = getStorageKey(dslHash);
  localStorage.removeItem(key);
}

/**
 * Applica le scelte di disambiguazione salvate a un DSL
 */
export function applyDisambiguationChoices(dsl: any, state: DisambiguationState): any {
  if (!state || state.choices.length === 0) {
    return dsl;
  }
  
  const dslCopy = JSON.parse(JSON.stringify(dsl));
  
  state.choices.forEach(choice => {
    const pathParts = choice.stepPath.split('.');
    let current = dslCopy;
    
    // Naviga fino al penultimo livello
    for (let i = 0; i < pathParts.length - 1; i++) {
      const part = pathParts[i];
      if (part.includes('[') && part.includes(']')) {
        // Array access like "tests[0]"
        const [key, indexStr] = part.split('[');
        const index = parseInt(indexStr.replace(']', ''));
        current = current[key][index];
      } else {
        current = current[part];
      }
    }
    
    // Applica la scelta all'ultimo livello
    const lastPart = pathParts[pathParts.length - 1];
    if (lastPart.includes('[') && lastPart.includes(']')) {
      const [key, indexStr] = lastPart.split('[');
      const index = parseInt(indexStr.replace(']', ''));
      current[key][index] = choice.chosenTarget;
    } else {
      current[lastPart] = choice.chosenTarget;
    }
  });
  
  return dslCopy;
}

/**
 * Ottiene le statistiche delle scelte di disambiguazione
 */
export function getDisambiguationStats(state: DisambiguationState | null): {
  totalChoices: number;
  lastModified: string;
  stepPaths: string[];
} {
  if (!state) {
    return {
      totalChoices: 0,
      lastModified: 'Never',
      stepPaths: []
    };
  }
  
  return {
    totalChoices: state.choices.length,
    lastModified: new Date(state.lastModified).toLocaleString(),
    stepPaths: state.choices.map(c => c.stepPath)
  };
}
