// Hook per gestire AbortController per cancellare richieste pendenti
// =================================================================

import { useRef, useCallback, useEffect } from 'react';

export interface UseAbortControllerResult {
  abortController: AbortController | null;
  createNewController: () => AbortController;
  abortCurrentRequest: () => void;
  isAborted: boolean;
}

/**
 * Hook per gestire AbortController e cancellare richieste pendenti
 * Utile per evitare race conditions e "state update on unmounted"
 */
export function useAbortController(): UseAbortControllerResult {
  const abortControllerRef = useRef<AbortController | null>(null);
  const isAbortedRef = useRef<boolean>(false);

  // Crea un nuovo AbortController
  const createNewController = useCallback((): AbortController => {
    // Aborta la richiesta precedente se esiste
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Crea un nuovo controller
    const newController = new AbortController();
    abortControllerRef.current = newController;
    isAbortedRef.current = false;

    // Aggiungi listener per tracciare quando viene abortato
    newController.signal.addEventListener('abort', () => {
      isAbortedRef.current = true;
    });

    return newController;
  }, []);

  // Aborta la richiesta corrente
  const abortCurrentRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      isAbortedRef.current = true;
    }
  }, []);

  // Cleanup al dismount del componente
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    abortController: abortControllerRef.current,
    createNewController,
    abortCurrentRequest,
    isAborted: isAbortedRef.current
  };
}

/**
 * Hook per gestire AbortController con reset automatico su dipendenze
 * Utile quando si vuole resettare il controller quando cambiano certe dipendenze
 */
export function useAbortControllerWithReset(dependencies: any[] = []): UseAbortControllerResult {
  const abortControllerRef = useRef<AbortController | null>(null);
  const isAbortedRef = useRef<boolean>(false);

  // Crea un nuovo AbortController
  const createNewController = useCallback((): AbortController => {
    // Aborta la richiesta precedente se esiste
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Crea un nuovo controller
    const newController = new AbortController();
    abortControllerRef.current = newController;
    isAbortedRef.current = false;

    // Aggiungi listener per tracciare quando viene abortato
    newController.signal.addEventListener('abort', () => {
      isAbortedRef.current = true;
    });

    return newController;
  }, []);

  // Aborta la richiesta corrente
  const abortCurrentRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      isAbortedRef.current = true;
    }
  }, []);

  // Reset automatico quando cambiano le dipendenze
  useEffect(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    isAbortedRef.current = false;
  }, dependencies);

  // Cleanup al dismount del componente
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    abortController: abortControllerRef.current,
    createNewController,
    abortCurrentRequest,
    isAborted: isAbortedRef.current
  };
}

/**
 * Utility per creare una fetch con AbortController
 */
export function createAbortableFetch(
  url: string, 
  options: RequestInit = {}, 
  abortController: AbortController
): Promise<Response> {
  return fetch(url, {
    ...options,
    signal: abortController.signal
  });
}

/**
 * Utility per gestire errori di fetch con AbortController
 */
export function handleFetchError(error: any): boolean {
  if (error.name === 'AbortError') {
    console.log('Request was aborted');
    return true; // Indica che l'errore è stato gestito
  }
  return false; // Indica che l'errore non è stato gestito
}
