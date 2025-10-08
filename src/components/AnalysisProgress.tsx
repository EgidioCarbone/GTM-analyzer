import React, { useState, useEffect } from 'react';
import { CheckCircle, Clock, Loader2, Globe, Shield, Zap, BarChart3, Brain, FileText } from 'lucide-react';

interface AnalysisStep {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  status: 'pending' | 'running' | 'completed' | 'error';
  duration?: number;
  details?: string;
}

interface AnalysisProgressProps {
  isVisible: boolean;
  currentStep?: string;
  progress?: number;
  steps?: Array<{
    id: string;
    title: string;
    status: 'pending' | 'running' | 'completed' | 'error';
    startTime?: number;
    duration?: number;
    details?: string;
  }>;
  onComplete?: () => void;
}

const ANALYSIS_STEPS: AnalysisStep[] = [
  {
    id: 'navigation',
    title: 'Navigazione al sito',
    description: 'Caricamento della pagina web...',
    icon: Globe,
    status: 'pending'
  },
  {
    id: 'html_extraction',
    title: 'Estrazione HTML',
    description: 'Analisi del codice sorgente...',
    icon: FileText,
    status: 'pending'
  },
  {
    id: 'gtm_detection',
    title: 'Rilevamento GTM',
    description: 'Ricerca Google Tag Manager...',
    icon: Zap,
    status: 'pending'
  },
  {
    id: 'consent_analysis',
    title: 'Analisi Consenso',
    description: 'Verifica Consent Mode e banner cookie...',
    icon: Shield,
    status: 'pending'
  },
  {
    id: 'performance_metrics',
    title: 'Metriche Performance',
    description: 'Calcolo Core Web Vitals...',
    icon: BarChart3,
    status: 'pending'
  },
  {
    id: 'interactive_tests',
    title: 'Test Interattivi',
    description: 'Simulazione click e navigazione...',
    icon: Clock,
    status: 'pending'
  },
  {
    id: 'ai_analysis',
    title: 'Analisi AI',
    description: 'Elaborazione con intelligenza artificiale...',
    icon: Brain,
    status: 'pending'
  }
];

export const AnalysisProgress: React.FC<AnalysisProgressProps> = ({
  isVisible,
  currentStep,
  progress = 0,
  steps: propSteps = [],
  onComplete
}) => {
  const [steps, setSteps] = useState<AnalysisStep[]>(ANALYSIS_STEPS);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);

  // Usa gli step passati come prop se disponibili, altrimenti usa quelli statici
  const displaySteps = propSteps.length > 0 ? propSteps : steps;

  // Gestisce la chiusura automatica quando tutti gli step sono completati
  useEffect(() => {
    if (!isVisible) {
      setSteps(ANALYSIS_STEPS.map(step => ({ ...step, status: 'pending' })));
      setCurrentStepIndex(0);
      setStartTime(null);
      return;
    }

    if (!startTime) {
      setStartTime(Date.now());
    }
  }, [isVisible, startTime]);

  // Gestisce la chiusura quando tutti gli step sono completati
  useEffect(() => {
    if (isVisible && displaySteps.length > 0) {
      const allCompleted = displaySteps.every(step => step.status === 'completed');
      if (allCompleted) {
        setTimeout(() => {
          onComplete?.();
        }, 1500); // Aspetta 1.5 secondi prima di chiudere
      }
    }
  }, [displaySteps, isVisible, onComplete]);

  // Aggiorna step specifico se fornito
  useEffect(() => {
    if (currentStep) {
      const stepIndex = displaySteps.findIndex(step => step.id === currentStep);
      if (stepIndex !== -1) {
        setCurrentStepIndex(stepIndex);
      }
    }
  }, [currentStep, displaySteps]);

  if (!isVisible) return null;

  // Usa il progresso passato come prop invece di calcolarlo localmente
  const progressPercentage = progress;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Analisi in Corso
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Stiamo analizzando il tuo sito web passo per passo...
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
            <span>Progresso</span>
            <span>{Math.round(progressPercentage)}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
            <div 
              className="bg-gradient-to-r from-purple-500 to-pink-500 h-3 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>

        {/* Steps List */}
        <div className="space-y-4">
          {displaySteps.map((step, index) => {
            // Mappa gli step del hook agli step statici per ottenere l'icona
            const staticStep = ANALYSIS_STEPS.find(s => s.id === step.id);
            const Icon = staticStep?.icon || Globe; // Fallback a Globe se non trovato
            const isActive = index === currentStepIndex && step.status === 'running';
            const isCompleted = step.status === 'completed';
            const isPending = step.status === 'pending';

            return (
              <div
                key={step.id}
                className={`flex items-center gap-4 p-4 rounded-lg transition-all duration-300 ${
                  isActive
                    ? 'bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800'
                    : isCompleted
                    ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                    : 'bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600'
                }`}
              >
                {/* Icon */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  isActive
                    ? 'bg-purple-100 dark:bg-purple-900/30'
                    : isCompleted
                    ? 'bg-green-100 dark:bg-green-900/30'
                    : 'bg-gray-100 dark:bg-gray-600'
                }`}>
                  {isActive ? (
                    <Loader2 className="w-5 h-5 text-purple-600 dark:text-purple-400 animate-spin" />
                  ) : isCompleted ? (
                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                  ) : (
                    <Icon className={`w-5 h-5 ${
                      isPending 
                        ? 'text-gray-400 dark:text-gray-500' 
                        : 'text-gray-600 dark:text-gray-400'
                    }`} />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1">
                  <h3 className={`font-semibold ${
                    isActive
                      ? 'text-purple-900 dark:text-purple-100'
                      : isCompleted
                      ? 'text-green-900 dark:text-green-100'
                      : 'text-gray-700 dark:text-gray-300'
                  }`}>
                    {staticStep?.title || step.title}
                  </h3>
                  <p className={`text-sm ${
                    isActive
                      ? 'text-purple-700 dark:text-purple-300'
                      : isCompleted
                      ? 'text-green-700 dark:text-green-300'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}>
                    {staticStep?.description || step.details || 'Elaborazione in corso...'}
                  </p>
                  {step.duration && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Completato in {(step.duration / 1000).toFixed(1)}s
                    </p>
                  )}
                </div>

                {/* Status Indicator */}
                <div className="flex items-center gap-2">
                  {isActive && (
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {startTime && (
              <>
                Tempo trascorso: {Math.round((Date.now() - startTime) / 1000)}s
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
};
