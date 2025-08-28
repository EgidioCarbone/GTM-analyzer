import React, { useState } from 'react';
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
  
  // Determina il colore e lo stile in base alla severità
  const getCardStyle = () => {
    switch (message.status) {
      case 'critical':
        return {
          bgColor: 'bg-red-50 dark:bg-red-900/20',
          borderColor: 'border-red-200 dark:border-red-800',
          textColor: 'text-red-600 dark:text-red-400',
          buttonColor: 'bg-red-100 hover:bg-red-200 text-red-800 dark:bg-red-800 dark:hover:bg-red-700 dark:text-red-100'
        };
      case 'major':
        return {
          bgColor: 'bg-orange-50 dark:bg-orange-900/20',
          borderColor: 'border-orange-200 dark:border-orange-800',
          textColor: 'text-orange-600 dark:text-orange-400',
          buttonColor: 'bg-orange-100 hover:bg-orange-200 text-orange-800 dark:bg-orange-800 dark:hover:bg-orange-700 dark:text-orange-100'
        };
      case 'minor':
        return {
          bgColor: 'bg-blue-50 dark:bg-blue-900/20',
          borderColor: 'border-blue-200 dark:border-blue-800',
          textColor: 'text-blue-600 dark:text-blue-400',
          buttonColor: 'bg-blue-100 hover:bg-blue-200 text-blue-800 dark:bg-blue-800 dark:hover:bg-blue-700 dark:text-blue-100'
        };
      default: // 'ok'
        return {
          bgColor: 'bg-green-50 dark:bg-green-900/20',
          borderColor: 'border-green-200 dark:border-green-800',
          textColor: 'text-green-600 dark:text-green-400',
          buttonColor: 'bg-green-100 hover:bg-green-200 text-green-800 dark:bg-green-800 dark:hover:bg-green-700 dark:text-green-100'
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
            <span className="text-gray-400 hover:text-gray-600 cursor-help">ℹ️</span>
          </InfoTooltip>
        </div>
        
        <div className="text-center py-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            ⚠️ Container senza trigger
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
          <span className="text-2xl">{metricInfo.icon}</span>
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
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {trigger_quality.stats.total_triggers - trigger_quality.stats.unused_triggers}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400 flex items-center justify-center gap-1">
            <span>✅</span>
            <span>Utilizzati</span>
          </div>
        </div>
        
        <div className="text-center">
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">
            {trigger_quality.stats.unused_triggers}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400 flex items-center justify-center gap-1">
            <span>⚠️</span>
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
              <span className={`font-medium ${trigger_quality.breakdown.specificity >= 0.8 ? 'text-green-600' : trigger_quality.breakdown.specificity >= 0.6 ? 'text-orange-600' : 'text-red-600'}`}>
                {Math.round(trigger_quality.breakdown.specificity * 100)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Blocking:</span>
              <span className={`font-medium ${trigger_quality.breakdown.blocking >= 0.8 ? 'text-green-600' : trigger_quality.breakdown.blocking >= 0.6 ? 'text-orange-600' : 'text-red-600'}`}>
                {Math.round(trigger_quality.breakdown.blocking * 100)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Timing:</span>
              <span className={`font-medium ${trigger_quality.breakdown.timing >= 0.8 ? 'text-green-600' : trigger_quality.breakdown.timing >= 0.6 ? 'text-orange-600' : 'text-red-600'}`}>
                {Math.round(trigger_quality.breakdown.timing * 100)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">SPA:</span>
              <span className={`font-medium ${trigger_quality.breakdown.spa >= 0.8 ? 'text-green-600' : trigger_quality.breakdown.spa >= 0.6 ? 'text-orange-600' : 'text-red-600'}`}>
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
            onAction?.();
          }}
        >
          🧭 {message.cta}
        </button>
      </div>
      
      {/* Indicatore espansione */}
      <div className="flex justify-center mt-2">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {isExpanded ? '🔼 Clicca per comprimere' : '🔽 Clicca per espandere'}
        </span>
      </div>
      
      {/* Tooltip informativo */}
      <InfoTooltip content={metricInfo.impact}>
        <div className="absolute top-2 right-2 w-4 h-4"></div>
      </InfoTooltip>
    </div>
  );
};
