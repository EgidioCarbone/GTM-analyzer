import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Target } from 'lucide-react';
import { InfoTooltip } from './ui/InfoTooltip';

// Lilac chart palette to ensure homogeneous charts across this section
export const LILAC_CHART_PALETTE = [
  '#a78bfa', // violet-400
  '#8b5cf6', // violet-500
  '#7c3aed', // violet-600
  '#6d28d9', // violet-700
  '#5b21b6', // violet-800
  '#4c1d95', // violet-900
];


export interface QualityAccordionProps {
  children: React.ReactNode;
  score: number;
  qualityStatus: {
    status: string;
    color: string;
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
    <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm" data-chart-palette="lilac">
      {/* Header dell'accordion */}
      <div className="flex items-center justify-between mb-4">
        <InfoTooltip content="Calcolato su pulizia tag, qualità trigger e qualit?à variabili con pesi diversi. Clicca per i dettagli.">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Target className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            Qualità del Container
          </h2>
        </InfoTooltip>
        
        <div className="flex items-center gap-4">
          
          
          {/* Toggle button */}
          <button
            onClick={toggleAccordion}
            className="p-2 rounded-lg border border-transparent hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            aria-expanded={isOpen}
            aria-controls="quality-content"
            aria-label={`${isOpen ? 'Chiudi' : 'Apri'} sezione qualit? del container`}
            role="button"
          >
            {isOpen ? (
              <ChevronUp className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            )}
          </button>
        </div>
      </div>
      
      {/* Barra di progresso */}
      <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-3 mb-4">
        <div 
          className="bg-gradient-to-r from-violet-300 via-violet-500 to-violet-700 h-3 rounded-full transition-all duration-1000 ease-out"
          style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
        />
      </div>
      
      {/* Potenziale miglioramento */}
      {score < 100 && (
        <div className="text-center mb-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
             Potenziale miglioramento: <span className="font-semibold text-violet-700">{Math.max(0, 100 - score)}%</span>
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
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
