import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TriggerQualityResult, getTriggerMetricInfo } from '../services/triggerQualityService';
import { InfoTooltip } from './ui/InfoTooltip';

interface TriggerQualityCardProps {
  triggerResult: TriggerQualityResult;
  onAction?: () => void;
}

export const TriggerQualityCard: React.FC<TriggerQualityCardProps> = ({ 
  triggerResult, 
  onAction 
}) => {
  const { trigger_quality, message } = triggerResult;
  const metricInfo = getTriggerMetricInfo(message.status);
  const [isExpanded, setIsExpanded] = useState(false);
  const navigate = useNavigate();
  
  // Determina il colore e lo stile in base alla severità
  const getCardStyle = () => {
    switch (message.status) {
      case 'critical':
        return {
          bgColor: 'bg-fuchsia-50 dark:bg-fuchsia-900/20',
          borderColor: 'border-fuchsia-200 dark:border-fuchsia-800',
          textColor: 'text-fuchsia-700 dark:text-fuchsia-400',
          buttonColor: 'bg-purple-600 hover:bg-purple-700 text-white'
        };
      case 'major':
        return {
          bgColor: 'bg-purple-50 dark:bg-purple-900/20',
          borderColor: 'border-purple-200 dark:border-purple-800',
          textColor: 'text-purple-700 dark:text-purple-400',
          buttonColor: 'bg-purple-600 hover:bg-purple-700 text-white'
        };
      case 'minor':
        return {
          bgColor: 'bg-violet-50 dark:bg-violet-900/20',
          borderColor: 'border-violet-200 dark:border-violet-800',
          textColor: 'text-violet-700 dark:text-violet-400',
          buttonColor: 'bg-purple-600 hover:bg-purple-700 text-white'
        };
      default: // 'ok'
        return {
          bgColor: 'bg-indigo-50 dark:bg-indigo-900/20',
          borderColor: 'border-indigo-200 dark:border-indigo-800',
          textColor: 'text-indigo-700 dark:text-indigo-400',
          buttonColor: 'bg-indigo-600 hover:bg-indigo-700 text-white'
        };
    }
  };
  
  const cardStyle = getCardStyle();
  
  // Se non ci sono trigger, mostra una card informativa
  if (trigger_quality.stats.total_triggers === 0) {
    return (
      <div className={`${cardStyle.bgColor} ${cardStyle.borderColor} border-2 rounded-xl p-6 shadow-md hover:shadow-lg transition-all duration-200`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚡</span>
            <div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                Qualità Trigger
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Nessun trigger rilevato
              </p>
            </div>
          </div>
          <InfoTooltip content="Nessun trigger è stato rilevato nel container. I trigger sono necessari per attivare i tag.">
          </InfoTooltip>
        </div>
        
        <div className="text-center py-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Container senza trigger
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <div className={`${cardStyle.bgColor} ${cardStyle.borderColor} border-2 rounded-xl p-6 shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer`}
         onClick={() => setIsExpanded(!isExpanded)}>
      
      {/* Header con icona e titolo */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
              {message.title}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {message.summary}
            </p>
          </div>
        </div>
        
        {/* Badge severità */}
        <div className={`px-3 py-1 rounded-full text-xs font-medium ${metricInfo.priorityColor}`}>
          {metricInfo.priority}
        </div>
      </div>
      
      {/* Statistiche principali con colori semaforo */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">
            {trigger_quality.stats.total_triggers}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400">
            Trigger totali
          </div>
        </div>
        
        <div className="text-center">
          <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
            {trigger_quality.stats.total_triggers - trigger_quality.stats.unused_triggers}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400 flex items-center justify-center gap-1">
            <span>Utilizzati</span>
          </div>
        </div>
        
        <div className="text-center">
          <div className="text-2xl font-bold text-fuchsia-600 dark:text-fuchsia-400">
            {trigger_quality.stats.unused_triggers}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400 flex items-center justify-center gap-1">
            <span>Non usati</span>
          </div>
        </div>
      </div>
      
      {/* Breakdown dei punteggi - solo se espanso */}
      {isExpanded && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Analisi dettagliata:
          </h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Specificità:</span>
              <span className={`font-medium ${trigger_quality.breakdown.specificity >= 0.8 ? 'text-indigo-600' : trigger_quality.breakdown.specificity >= 0.6 ? 'text-purple-600' : 'text-fuchsia-600'}`}>
                {Math.round(trigger_quality.breakdown.specificity * 100)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Blocking:</span>
              <span className={`font-medium ${trigger_quality.breakdown.blocking >= 0.8 ? 'text-indigo-600' : trigger_quality.breakdown.blocking >= 0.6 ? 'text-purple-600' : 'text-fuchsia-600'}`}>
                {Math.round(trigger_quality.breakdown.blocking * 100)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Timing:</span>
              <span className={`font-medium ${trigger_quality.breakdown.timing >= 0.8 ? 'text-indigo-600' : trigger_quality.breakdown.timing >= 0.6 ? 'text-purple-600' : 'text-fuchsia-600'}`}>
                {Math.round(trigger_quality.breakdown.timing * 100)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">SPA:</span>
              <span className={`font-medium ${trigger_quality.breakdown.spa >= 0.8 ? 'text-indigo-600' : trigger_quality.breakdown.spa >= 0.6 ? 'text-purple-600' : 'text-fuchsia-600'}`}>
                {Math.round(trigger_quality.breakdown.spa * 100)}%
              </span>
            </div>
          </div>
        </div>
      )}
      
      {/* Problemi principali - solo se espanso */}
      {isExpanded && trigger_quality.issues.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Problemi principali:
          </h4>
          <div className="space-y-1">
            {trigger_quality.issues
              .slice(0, 3) // Mostra solo i primi 3
              .map((issue, index) => (
                <div key={issue.trigger_id} className="text-xs text-gray-600 dark:text-gray-400">
                  <span className="font-bold text-gray-800 dark:text-gray-200">{issue.name}</span>
                  <span className="ml-2">— {issue.reason}</span>
                  <div className="text-xs text-blue-600 dark:text-blue-400 mt-1 ml-4">
                    → {issue.suggestion}
                  </div>
                </div>
              ))}
            
            {trigger_quality.issues.length > 3 && (
              <div className="text-xs text-gray-500 dark:text-gray-500">
                ... e altri {trigger_quality.issues.length - 3} problemi
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Statistiche aggiuntive - solo se espanso */}
      {isExpanded && (
        <div className="mb-4 text-xs text-gray-600 dark:text-gray-400">
          <div className="flex justify-between">
            <span>All Pages senza filtri:</span>
            <span className="font-medium">{trigger_quality.stats.all_pages_unfiltered}</span>
          </div>
          <div className="flex justify-between">
            <span>Con blocking su marketing:</span>
            <span className="font-medium">{trigger_quality.stats.with_blocking_on_marketing}</span>
          </div>
          <div className="flex justify-between">
            <span>Supporto SPA:</span>
            <span className="font-medium">{trigger_quality.stats.history_change_present ? '✅' : '❌'}</span>
          </div>
          {trigger_quality.stats.duplicates.length > 0 && (
            <div className="flex justify-between">
              <span>Duplicati:</span>
              <span className="font-medium text-orange-600">{trigger_quality.stats.duplicates.length}</span>
            </div>
          )}
        </div>
      )}
      
      {/* CTA */}
      <div className="flex justify-end">
        <button 
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${cardStyle.buttonColor}`}
          onClick={(e) => {
            e.stopPropagation();
            // Naviga al Container Manager con filtro appropriato
            let filter = 'trg-allpages'; // default
            if (trigger_quality.stats.all_pages_unfiltered > 0) {
              filter = 'trg-allpages';
            } else if (trigger_quality.stats.unused_triggers > 0) {
              filter = 'trg-unused';
            } else if (trigger_quality.stats.duplicates.length > 0) {
              filter = 'trg-duplicate';
            }
            navigate('/container-manager', { 
              state: { 
                autoFilter: filter, 
                tab: 'triggers' 
              } 
            });
            onAction?.();
          }}
        >
          {message.cta}
        </button>
      </div>
      
      {/* Indicatore espansione */}
      <div className="flex justify-center mt-2">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {isExpanded ? 'Clicca per comprimere' : 'Clicca per espandere'}
        </span>
      </div>
      
      {/* Tooltip informativo */}
      <InfoTooltip content={metricInfo.impact}>
        <div className="absolute top-2 right-2 w-4 h-4"></div>
      </InfoTooltip>
    </div>
  );
};
