import React, { useState } from 'react';
import { getImpactTheme, ImpactTheme } from '../utils/impactTheme';
import { ChevronDown, ChevronUp } from 'lucide-react';

export interface IssueCardProps {
  title: string;
  count: number;
  icon: string;
  bullets?: React.ReactNode;
  ctaLabel?: string;
  onCta?: () => void;
  severityLabel?: string;
  subtitle?: string;
  breakdown?: React.ReactNode;
  details?: React.ReactNode;
  defaultExpanded?: boolean;
}

export const IssueCard: React.FC<IssueCardProps> = ({
  title,
  count,
  icon,
  bullets,
  ctaLabel,
  onCta,
  severityLabel,
  subtitle,
  breakdown,
  details,
  defaultExpanded = false
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const theme: ImpactTheme = getImpactTheme(count);
  const derivedSeverity = severityLabel || theme.severity;
  const isZeroCount = count === 0;
  
  // Generate aria-label for accessibility
  const ariaLabel = `${title} – severità ${derivedSeverity} – ${count} elementi`;

  // Se count = 0, usa un layout compatto
  if (isZeroCount) {
    return (
      <div 
        className={`${theme.bg} rounded-lg p-3 border-l-4 ${theme.border} border-l-current`}
        aria-label={ariaLabel}
        role="article"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={`text-xl ${theme.icon}`}>{icon}</span>
            <div>
              <div className={`text-lg font-bold ${theme.text}`}>{title}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                ✓ Controllo superato
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${theme.badge}`}>
              {derivedSeverity}
            </span>
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`${theme.bg} rounded-lg p-5 border-l-4 ${theme.border} border-l-current flex flex-col h-full`}
      aria-label={ariaLabel}
      role="article"
    >
      {/* Header cliccabile per expand/collapse */}
      <div 
        className="flex items-center justify-between mb-3 cursor-pointer hover:opacity-80 transition-opacity"
        onClick={() => setIsExpanded(!isExpanded)}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        aria-label={`${isExpanded ? 'Chiudi' : 'Espandi'} dettagli per ${title}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsExpanded(!isExpanded);
          }
        }}
      >
        <div className="flex items-center gap-3">
          {/* Pallino semaforo */}
          <div className={`w-4 h-4 rounded-full ${
            theme.type === 'critical' ? 'bg-red-500' :
            theme.type === 'high' ? 'bg-orange-500' :
            theme.type === 'warning' ? 'bg-yellow-500' :
            'bg-green-500'
          }`}></div>
          <span className={`text-2xl ${theme.icon}`}>{icon}</span>
                      <div>
              <div className={`text-3xl font-black ${theme.text}`}>{count}</div>
              <div className={`text-lg font-bold ${theme.text}`}>{title}</div>
            {/* Micro-incidenza */}
            {subtitle && (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {subtitle}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${
              theme.type === 'critical' ? 'bg-red-500' :
              theme.type === 'high' ? 'bg-orange-500' :
              theme.type === 'warning' ? 'bg-yellow-500' :
              'bg-green-500'
            }`}></div>
            <span className={`text-xs font-medium ${theme.text}`}>
              {derivedSeverity}
            </span>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          )}
        </div>
      </div>
      
      {/* Contenuto espandibile */}
      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${
        isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
      }`}>
        <div className="pt-2">
          {/* Breakdown per elementi non utilizzati */}
          {breakdown && (
            <div className="text-xs mb-2 p-2 bg-white/30 rounded">
              <div className="font-medium mb-1">Breakdown:</div>
              <div className="flex gap-2 text-xs">
                {breakdown}
              </div>
            </div>
          )}

          {/* Dettagli specifici */}
          {details && (
            <div className="text-xs mb-2 p-2 bg-white/30 rounded">
              <div className="font-medium mb-1">Dettagli:</div>
              {details}
            </div>
          )}
          
          {/* Bullets con descrizioni */}
          {bullets && (
            <div className="text-sm mb-4">
              {bullets}
            </div>
          )}
        </div>
      </div>
      
      
      {/* CTA condizionale - sempre visibile se count > 0 */}
      {count > 0 && ctaLabel && onCta && (
        <div className="mt-5 pt-4 border-t border-white/20">
          <button 
            className={`w-full text-sm px-4 py-2.5 rounded-lg transition-all duration-200 font-semibold shadow-md hover:shadow-lg transform hover:scale-[1.02] ${
              theme.type === 'critical' 
                ? 'bg-red-500 hover:bg-red-600 text-white border-2 border-red-600 shadow-lg hover:shadow-xl' 
                : theme.type === 'high'
                ? 'bg-orange-500 hover:bg-orange-600 text-white border-2 border-orange-600 shadow-md hover:shadow-lg'
                : theme.type === 'warning'
                ? 'bg-yellow-500 hover:bg-yellow-600 text-white border-2 border-yellow-600 shadow-md hover:shadow-lg'
                : 'bg-blue-500 hover:bg-blue-600 text-white border-2 border-blue-600 shadow-md hover:shadow-lg'
            }`}
            onClick={(e) => {
              e.stopPropagation();
              onCta();
            }}
            aria-label={`Azione per ${title}: ${ctaLabel}`}
          >
            <span className="flex items-center justify-center gap-2">
              {ctaLabel}
            </span>
          </button>
        </div>
      )}

    </div>
  );
};
