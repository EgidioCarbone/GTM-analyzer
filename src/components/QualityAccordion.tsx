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
    <div className="ls-card" data-chart-palette="lilac">
      <div className="flex items-start justify-between mb-3">
        <InfoTooltip content="Calcolato su pulizia tag, qualità trigger e qualità variabili con pesi diversi. Clicca per i dettagli.">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center">
              <Target className="w-5 h-5" />
            </span>
            <div>
              <p className="ls-overline text-purple-600">Quality score</p>
              <h2 className="text-2xl font-semibold text-slate-900">Qualità del Container</h2>
            </div>
          </div>
        </InfoTooltip>

        <button
          onClick={toggleAccordion}
          className="ls-btn-icon"
          aria-expanded={isOpen}
          aria-controls="quality-content"
          aria-label={`${isOpen ? 'Chiudi' : 'Apri'} sezione qualità del container`}
          role="button"
        >
          {isOpen ? (
            <ChevronUp className="w-5 h-5 text-slate-600" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-600" />
          )}
        </button>
      </div>

      <div className="w-full bg-slate-100 rounded-full h-3 mb-4">
        <div 
          className="bg-gradient-to-r from-violet-300 via-violet-500 to-violet-700 h-3 rounded-full transition-all duration-1000 ease-out"
          style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
        />
      </div>

      {score < 100 && (
        <div className="text-center mb-3">
          <p className="text-sm text-slate-600">
             Potenziale miglioramento: <span className="font-semibold text-violet-700">{Math.max(0, 100 - score).toFixed(1)}%</span>
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Ottimizza il container per raggiungere il 100% di qualità
          </p>
        </div>
      )}

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
