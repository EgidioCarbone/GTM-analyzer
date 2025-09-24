import { useState, useCallback } from 'react';

export interface AnalysisProgressState {
  isVisible: boolean;
  currentStep: string;
  progress: number;
  steps: Array<{
    id: string;
    title: string;
    status: 'pending' | 'running' | 'completed' | 'error';
    startTime?: number;
    duration?: number;
  }>;
}

export const useAnalysisProgress = () => {
  const [state, setState] = useState<AnalysisProgressState>({
    isVisible: false,
    currentStep: '',
    progress: 0,
    steps: []
  });

  const startAnalysis = useCallback((steps: Array<{ id: string; title: string }>) => {
    setState({
      isVisible: true,
      currentStep: steps[0]?.id || '',
      progress: 0,
      steps: steps.map(step => ({
        ...step,
        status: 'pending' as const
      }))
    });
  }, []);

  const updateStep = useCallback((stepId: string, status: 'running' | 'completed' | 'error', details?: string) => {
    setState(prev => {
      const newSteps = prev.steps.map(step => {
        if (step.id === stepId) {
          const now = Date.now();
          return {
            ...step,
            status,
            startTime: status === 'running' ? now : step.startTime,
            duration: status === 'completed' && step.startTime ? now - step.startTime : step.duration,
            details: details || step.details || undefined
          };
        }
        return step;
      });

      const completedSteps = newSteps.filter(step => step.status === 'completed').length;
      const totalSteps = newSteps.length;
      const progress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

      return {
        ...prev,
        currentStep: stepId,
        progress,
        steps: newSteps
      };
    });
  }, []);

  const completeAnalysis = useCallback(() => {
    setState(prev => ({
      ...prev,
      progress: 100
    }));
    // Non nascondere immediatamente, lascia che il componente AnalysisProgress gestisca la chiusura
  }, []);

  const hideAnalysis = useCallback(() => {
    setState(prev => ({
      ...prev,
      isVisible: false
    }));
  }, []);

  return {
    ...state,
    startAnalysis,
    updateStep,
    completeAnalysis,
    hideAnalysis
  };
};
