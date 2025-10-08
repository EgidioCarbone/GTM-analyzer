import { useCallback } from 'react';
import { useErrorHandler } from '../components/ErrorBoundary';

export const useAsyncError = () => {
  const { handleError } = useErrorHandler();

  const executeAsync = useCallback(async <T>(
    asyncFunction: () => Promise<T>,
    onError?: (error: Error) => void
  ): Promise<T | null> => {
    try {
      return await asyncFunction();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('Async operation failed:', err);
      
      if (onError) {
        onError(err);
      } else {
        handleError(err);
      }
      
      return null;
    }
  }, [handleError]);

  return { executeAsync };
};
