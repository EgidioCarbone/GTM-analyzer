// Hook per gestire la disambiguazione con persistenza
// =================================================

import { useState, useEffect, useCallback } from 'react';
import {
  DisambiguationState,
  DisambiguationChoice,
  generateDslHash,
  loadDisambiguationState,
  saveDisambiguationState,
  addDisambiguationChoice,
  undoLastDisambiguationChoice,
  resetDisambiguationState,
  applyDisambiguationChoices,
  getDisambiguationStats
} from '../utils/disambiguationStorage';

export interface UseDisambiguationResult {
  // Stato
  disambiguationState: DisambiguationState | null;
  disambiguatedDsl: any;
  stats: ReturnType<typeof getDisambiguationStats>;
  
  // Azioni
  addChoice: (stepPath: string, originalTarget: any, chosenTarget: any, reason: string) => void;
  undoLastChoice: () => void;
  resetAllChoices: () => void;
  
  // Utilità
  hasChoices: boolean;
  canUndo: boolean;
}

export function useDisambiguation(dsl: any): UseDisambiguationResult {
  const [disambiguationState, setDisambiguationState] = useState<DisambiguationState | null>(null);
  const [disambiguatedDsl, setDisambiguatedDsl] = useState<any>(dsl);
  const [currentDslHash, setCurrentDslHash] = useState<string>('');

  // Genera hash del DSL e carica stato esistente
  useEffect(() => {
    if (!dsl) {
      setDisambiguationState(null);
      setDisambiguatedDsl(null);
      setCurrentDslHash('');
      return;
    }

    const dslHash = generateDslHash(dsl);
    
    // Se l'hash è cambiato, resetta lo stato
    if (currentDslHash && currentDslHash !== dslHash) {
      console.log('DSL hash changed, resetting disambiguation state');
      setDisambiguationState(null);
      setDisambiguatedDsl(dsl);
    } else {
      // Carica stato esistente
      const existingState = loadDisambiguationState(dslHash);
      setDisambiguationState(existingState);
      
      if (existingState) {
        const appliedDsl = applyDisambiguationChoices(dsl, existingState);
        setDisambiguatedDsl(appliedDsl);
      } else {
        setDisambiguatedDsl(dsl);
      }
    }
    
    setCurrentDslHash(dslHash);
  }, [dsl, currentDslHash]);

  // Aggiunge una nuova scelta di disambiguazione
  const addChoice = useCallback((
    stepPath: string,
    originalTarget: any,
    chosenTarget: any,
    reason: string
  ) => {
    if (!currentDslHash) return;

    const newState = addDisambiguationChoice(
      currentDslHash,
      stepPath,
      originalTarget,
      chosenTarget,
      reason
    );

    setDisambiguationState(newState);
    
    // Applica la scelta al DSL
    const appliedDsl = applyDisambiguationChoices(dsl, newState);
    setDisambiguatedDsl(appliedDsl);
  }, [currentDslHash, dsl]);

  // Annulla l'ultima scelta
  const undoLastChoice = useCallback(() => {
    if (!currentDslHash) return;

    const newState = undoLastDisambiguationChoice(currentDslHash);
    setDisambiguationState(newState);
    
    if (newState) {
      const appliedDsl = applyDisambiguationChoices(dsl, newState);
      setDisambiguatedDsl(appliedDsl);
    } else {
      setDisambiguatedDsl(dsl);
    }
  }, [currentDslHash, dsl]);

  // Resetta tutte le scelte
  const resetAllChoices = useCallback(() => {
    if (!currentDslHash) return;

    resetDisambiguationState(currentDslHash);
    setDisambiguationState(null);
    setDisambiguatedDsl(dsl);
  }, [currentDslHash, dsl]);

  // Calcola statistiche
  const stats = getDisambiguationStats(disambiguationState);

  return {
    disambiguationState,
    disambiguatedDsl,
    stats,
    addChoice,
    undoLastChoice,
    resetAllChoices,
    hasChoices: disambiguationState?.choices.length > 0,
    canUndo: disambiguationState?.choices.length > 0
  };
}
