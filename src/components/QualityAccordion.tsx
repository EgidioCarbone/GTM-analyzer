import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Target, Info } from 'lucide-react';
import { InfoTooltip } from './ui/InfoTooltip';

export interface QualityAccordionProps {
  children: React.ReactNode;
  score: number;
  qualityStatus: {
    status: string;
    color: string;
    icon: string;
  };
  scoreBreakdown?: Array<{
    label: string;
    value: string;
    weight: string;
  }>;
}

export const QualityAccordion: React.FC<QualityAccordionProps> = ({
  children,
  score,
  qualityStatus,
  scoreBreakdown
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Check if we're on mobile and set initial state accordingly
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768; // md breakpoint
      setIsMobile(mobile);
      // Default: closed on mobile, open on desktop
      setIsOpen(!mobile);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const toggleAccordion = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
      {/* Header dell'accordion */}
      <div className="flex items-center justify-between mb-4">
        <InfoTooltip content="Calcolato su pulizia tag, qualità trigger e qualità variabili con pesi diversi. Clicca per i dettagli.">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Target className="w-6 h-6" />
            Qualità del Container
          </h2>
        </InfoTooltip>
        
        <div className="flex items-center gap-4">
          <div className="text-right">
            <InfoTooltip
              content={
                <div className="text-left">
                  <div className="font-semibold mb-2">Calcolo Score:</div>
                  {scoreBreakdown?.map((item, index) => (
                    <div key={index} className="mb-1">
                      {item.label}: {item.value}% × {item.weight}
                    </div>
                  ))}
                  <div className="border-t border-gray-600 pt-1 mt-2 font-bold">
                    = Score {score}%
                  </div>
                </div>
              }
            >
              <div className="text-4xl font-bold text-indigo-600 dark:text-indigo-400">
                {score}%
              </div>
            </InfoTooltip>
            <div className={`inline-flex items-center gap-2 px-3 py-1 font-medium rounded-full ${qualityStatus.color}`}>
              <span>{qualityStatus.icon}</span>
              {qualityStatus.status}
            </div>
          </div>
          
          {/* Toggle button */}
          <button
            onClick={toggleAccordion}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-expanded={isOpen}
            aria-controls="quality-content"
            aria-label={`${isOpen ? 'Chiudi' : 'Apri'} sezione qualità del container`}
            role="button"
          >
            {isOpen ? (
              <ChevronUp className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            )}
          </button>
        </div>
      </div>
      
      {/* Barra di progresso */}
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 mb-4">
        <div 
          className="bg-gradient-to-r from-green-500 via-blue-500 to-purple-500 h-4 rounded-full transition-all duration-1000 ease-out"
          style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
        />
      </div>
      
      {/* Potenziale miglioramento */}
      {score < 100 && (
        <div className="text-center mb-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            🚀 Potenziale miglioramento: <span className="font-semibold text-green-600">{Math.max(0, 100 - score)}%</span>
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
            Ottimizza il container per raggiungere il 100% di qualità
          </p>
        </div>
      )}

      {/* Contenuto dell'accordion con transizione */}
      <div
        id="quality-content"
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
        }`}
        aria-hidden={!isOpen}
      >
        <div className="pt-4">
          {children}
        </div>
      </div>
    </div>
  );
};
