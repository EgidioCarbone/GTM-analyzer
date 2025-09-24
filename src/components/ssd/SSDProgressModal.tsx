import React, { useState, useEffect } from 'react';
import { CheckCircle, Clock, Loader2, Globe, Shield, Zap, BarChart3, Brain, FileText, Upload, Play, Tag, Code2, PackageSearch, Box, Eye } from 'lucide-react';

interface SSDStep {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  status: 'pending' | 'running' | 'completed' | 'error';
  duration?: number;
  details?: string;
}

interface SSDProgressModalProps {
  isVisible: boolean;
  loadingType: 'pdf' | 'test' | null;
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

// Step per il processamento PDF
const PDF_STEPS: SSDStep[] = [
  {
    id: 'html_fetch',
    title: 'Download HTML',
    description: 'Scaricamento della pagina web e estrazione cookie banner...',
    icon: Globe,
    status: 'pending'
  },
  {
    id: 'pdf_upload',
    title: 'Caricamento PDF',
    description: 'Upload e validazione del file PDF...',
    icon: Upload,
    status: 'pending'
  },
  {
    id: 'pdf_analysis',
    title: 'Analisi Documento',
    description: 'Estrazione testo e analisi del contenuto...',
    icon: FileText,
    status: 'pending'
  },
  {
    id: 'spec_extraction',
    title: 'Estrazione Specifiche',
    description: 'Identificazione di test e azioni da eseguire...',
    icon: Tag,
    status: 'pending'
  },
  {
    id: 'dsl_generation',
    title: 'Generazione DSL',
    description: 'Creazione della specifica di test strutturata...',
    icon: Code2,
    status: 'pending'
  },
  {
    id: 'test_preparation',
    title: 'Preparazione Test',
    description: 'Validazione e preparazione per l\'esecuzione...',
    icon: PackageSearch,
    status: 'pending'
  }
];

// Step per l'esecuzione dei test
const TEST_STEPS: SSDStep[] = [
  {
    id: 'browser_launch',
    title: 'Avvio Browser',
    description: 'Inizializzazione del browser Puppeteer...',
    icon: Play,
    status: 'pending'
  },
  {
    id: 'navigation',
    title: 'Navigazione',
    description: 'Caricamento della pagina web...',
    icon: Globe,
    status: 'pending'
  },
  {
    id: 'cookie_consent',
    title: 'Gestione Cookie',
    description: 'Accettazione cookie banner e configurazione consenso...',
    icon: Shield,
    status: 'pending'
  },
  {
    id: 'test_execution',
    title: 'Esecuzione Test',
    description: 'Esecuzione delle azioni e verifica delle aspettative...',
    icon: Zap,
    status: 'pending'
  },
  {
    id: 'data_collection',
    title: 'Raccolta Dati',
    description: 'Cattura di screenshot e eventi dataLayer...',
    icon: BarChart3,
    status: 'pending'
  },
  {
    id: 'report_generation',
    title: 'Generazione Report',
    description: 'Creazione del report finale con risultati...',
    icon: FileText,
    status: 'pending'
  }
];

export const SSDProgressModal: React.FC<SSDProgressModalProps> = ({
  isVisible,
  loadingType,
  currentStep,
  progress = 0,
  steps: propSteps = [],
  onComplete
}) => {
  const [steps, setSteps] = useState<SSDStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);

  // Seleziona gli step appropriati in base al tipo di loading
  const getStepsForType = (type: 'pdf' | 'test' | null): SSDStep[] => {
    switch (type) {
      case 'pdf':
        return PDF_STEPS;
      case 'test':
        return TEST_STEPS;
      default:
        return [];
    }
  };

  // Usa gli step passati come prop se disponibili, altrimenti usa quelli statici
  const displaySteps = propSteps.length > 0 ? propSteps : steps;

  // Aggiorna gli step quando cambia il tipo di loading
  useEffect(() => {
    if (loadingType) {
      setSteps(getStepsForType(loadingType));
    }
  }, [loadingType]);

  // Gestisce la chiusura automatica quando tutti gli step sono completati
  useEffect(() => {
    if (!isVisible) {
      setSteps([]);
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
        }, 3000); // Aumentiamo a 3 secondi per dare tempo all'utente di vedere i risultati
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

  if (!isVisible || !loadingType) return null;

  // Usa il progresso passato come prop invece di calcolarlo localmente
  const progressPercentage = progress;

  // Determina il titolo e la descrizione in base al tipo di loading e fase corrente
  const getModalTitle = () => {
    if (loadingType === 'pdf') {
      return 'Processamento PDF';
    } else if (loadingType === 'test') {
      return 'Esecuzione Test';
    } else {
      // Determina la fase in base agli step completati
      const pdfStepsCompleted = displaySteps.filter(step => 
        step.id.startsWith('html_fetch') || step.id.startsWith('pdf_') || step.id.startsWith('spec_') || step.id.startsWith('dsl_') || step.id.startsWith('test_preparation')
      ).filter(step => step.status === 'completed').length;
      
      const testStepsCompleted = displaySteps.filter(step => 
        step.id.startsWith('browser_') || step.id.startsWith('navigation') || step.id.startsWith('cookie_') || step.id.startsWith('test_execution') || step.id.startsWith('data_') || step.id.startsWith('report_')
      ).filter(step => step.status === 'completed').length;
      
      if (pdfStepsCompleted > 0 && testStepsCompleted === 0) {
        return 'Processamento PDF';
      } else if (testStepsCompleted > 0) {
        return 'Esecuzione Test';
      } else {
        return 'Elaborazione';
      }
    }
  };

  const getModalDescription = () => {
    if (loadingType === 'pdf') {
      return 'Stiamo elaborando il tuo PDF e generando le specifiche di test...';
    } else if (loadingType === 'test') {
      return 'Stiamo eseguendo i test automatici sul sito web...';
    } else {
      // Determina la fase in base agli step completati
      const pdfStepsCompleted = displaySteps.filter(step => 
        step.id.startsWith('html_fetch') || step.id.startsWith('pdf_') || step.id.startsWith('spec_') || step.id.startsWith('dsl_') || step.id.startsWith('test_preparation')
      ).filter(step => step.status === 'completed').length;
      
      const testStepsCompleted = displaySteps.filter(step => 
        step.id.startsWith('browser_') || step.id.startsWith('navigation') || step.id.startsWith('cookie_') || step.id.startsWith('test_execution') || step.id.startsWith('data_') || step.id.startsWith('report_')
      ).filter(step => step.status === 'completed').length;
      
      if (pdfStepsCompleted > 0 && testStepsCompleted === 0) {
        return 'Stiamo elaborando il tuo PDF e generando le specifiche di test...';
      } else if (testStepsCompleted > 0) {
        return 'Stiamo eseguendo i test automatici sul sito web...';
      } else {
        return 'Elaborazione in corso...';
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {getModalTitle()}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {getModalDescription()}
          </p>
          
          {/* Phase Indicator */}
          <div className="flex items-center justify-center space-x-4 text-sm">
            <div className={`flex items-center space-x-2 px-3 py-1 rounded-full ${
              displaySteps.some(step => step.id.startsWith('html_fetch') || step.id.startsWith('pdf_') || step.id.startsWith('spec_') || step.id.startsWith('dsl_') || step.id.startsWith('test_preparation'))
                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                displaySteps.some(step => step.id.startsWith('html_fetch') || step.id.startsWith('pdf_') || step.id.startsWith('spec_') || step.id.startsWith('dsl_') || step.id.startsWith('test_preparation'))
                  ? 'bg-blue-500'
                  : 'bg-gray-400'
              }`} />
              <span>Processamento PDF</span>
            </div>
            <div className={`flex items-center space-x-2 px-3 py-1 rounded-full ${
              displaySteps.some(step => step.id.startsWith('browser_') || step.id.startsWith('navigation') || step.id.startsWith('cookie_') || step.id.startsWith('test_execution') || step.id.startsWith('data_') || step.id.startsWith('report_'))
                ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                displaySteps.some(step => step.id.startsWith('browser_') || step.id.startsWith('navigation') || step.id.startsWith('cookie_') || step.id.startsWith('test_execution') || step.id.startsWith('data_') || step.id.startsWith('report_'))
                  ? 'bg-green-500'
                  : 'bg-gray-400'
              }`} />
              <span>Esecuzione Test</span>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
            <span>Progresso</span>
            <span>{Math.round(progressPercentage)}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
            <div 
              className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>

        {/* Steps List */}
        <div className="space-y-4">
          {displaySteps.map((step, index) => {
            // Mappa gli step del hook agli step statici per ottenere l'icona
            const staticStep = steps.find(s => s.id === step.id);
            const Icon = staticStep?.icon || Globe; // Fallback a Globe se non trovato
            const isActive = index === currentStepIndex && step.status === 'running';
            const isCompleted = step.status === 'completed';
            const isPending = step.status === 'pending';
            
            // Debug: log dei dati dello step per capire da dove viene il "0"
            if (step.id === 'pdf_upload') {
              console.log('PDF Upload Step Debug:', {
                id: step.id,
                status: step.status,
                details: step.details,
                duration: step.duration,
                staticDescription: staticStep?.description
              });
            }

            return (
              <div
                key={step.id}
                className={`flex items-center gap-4 p-4 rounded-lg transition-all duration-300 ${
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                    : isCompleted
                    ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                    : 'bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600'
                }`}
              >
                {/* Icon */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  isActive
                    ? 'bg-blue-100 dark:bg-blue-900/30'
                    : isCompleted
                    ? 'bg-green-100 dark:bg-green-900/30'
                    : 'bg-gray-100 dark:bg-gray-600'
                }`}>
                  {isActive ? (
                    <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin" />
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
                      ? 'text-blue-900 dark:text-blue-100'
                      : isCompleted
                      ? 'text-green-900 dark:text-green-100'
                      : 'text-gray-700 dark:text-gray-300'
                  }`}>
                    {staticStep?.title || step.title}
                  </h3>
                  <p className={`text-sm ${
                    isActive
                      ? 'text-blue-700 dark:text-blue-300'
                      : isCompleted
                      ? 'text-green-700 dark:text-green-300'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}>
                    {staticStep?.description || step.details || 'Elaborazione in corso...'}
                  </p>
                  {step.duration && typeof step.duration === 'number' && step.duration > 100 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Completato in {(step.duration / 1000).toFixed(1)}s
                    </p>
                  )}
                </div>

                {/* Status Indicator */}
                <div className="flex items-center gap-2">
                  {isActive && (
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
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
