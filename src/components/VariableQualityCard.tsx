import React, { useState } from 'react';
import { VariableQualityResult, getVariableMetricInfo } from '../services/variableQualityService';
import { InfoTooltip } from './ui/InfoTooltip';

interface VariableQualityCardProps {
  variableResult: VariableQualityResult;
  onAction?: () => void;
}

export const VariableQualityCard: React.FC<VariableQualityCardProps> = ({ 
  variableResult, 
  onAction 
}) => {
  const { variable_quality, message } = variableResult;
  const metricInfo = getVariableMetricInfo(message.status);
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
  
  // Se non ci sono variabili, mostra una card informativa
  if (variable_quality.stats.total === 0) {
    return (
      <div className={`${cardStyle.bgColor} ${cardStyle.borderColor} border-2 rounded-xl p-6 shadow-md hover:shadow-lg transition-all duration-200`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🧩</span>
            <div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                Qualità Variabili
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Nessuna variabile rilevata
              </p>
            </div>
          </div>
          <InfoTooltip content="Nessuna variabile è stata rilevata nel container. Le variabili sono necessarie per gestire i dati dinamici.">
            <span className="text-gray-400 hover:text-gray-600 cursor-help">ℹ️</span>
          </InfoTooltip>
        </div>
        
        <div className="text-center py-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            ⚠️ Container senza variabili
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
            {variable_quality.stats.total}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400">
            Variabili totali
          </div>
        </div>
        
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {variable_quality.stats.total - variable_quality.stats.unused}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400 flex items-center justify-center gap-1">
            <span>✅</span>
            <span>Utilizzate</span>
          </div>
        </div>
        
        <div className="text-center">
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">
            {variable_quality.stats.unused}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400 flex items-center justify-center gap-1">
            <span>⚠️</span>
            <span>Non usate</span>
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
              <span className="text-gray-600 dark:text-gray-400">DLV:</span>
              <span className={`font-medium ${variable_quality.breakdown.dlv >= 0.8 ? 'text-green-600' : variable_quality.breakdown.dlv >= 0.6 ? 'text-orange-600' : 'text-red-600'}`}>
                {Math.round(variable_quality.breakdown.dlv * 100)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Selettori:</span>
              <span className={`font-medium ${variable_quality.breakdown.selectors >= 0.8 ? 'text-green-600' : variable_quality.breakdown.selectors >= 0.6 ? 'text-orange-600' : 'text-red-600'}`}>
                {Math.round(variable_quality.breakdown.selectors * 100)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">JavaScript:</span>
              <span className={`font-medium ${variable_quality.breakdown.js >= 0.8 ? 'text-green-600' : variable_quality.breakdown.js >= 0.6 ? 'text-orange-600' : 'text-red-600'}`}>
                {Math.round(variable_quality.breakdown.js * 100)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Lookup:</span>
              <span className={`font-medium ${variable_quality.breakdown.lookup >= 0.8 ? 'text-green-600' : variable_quality.breakdown.lookup >= 0.6 ? 'text-orange-600' : 'text-red-600'}`}>
                {Math.round(variable_quality.breakdown.lookup * 100)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Regex:</span>
              <span className={`font-medium ${variable_quality.breakdown.regex >= 0.8 ? 'text-green-600' : variable_quality.breakdown.regex >= 0.6 ? 'text-orange-600' : 'text-red-600'}`}>
                {Math.round(variable_quality.breakdown.regex * 100)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Igiene:</span>
              <span className={`font-medium ${variable_quality.breakdown.hygiene >= 0.8 ? 'text-green-600' : variable_quality.breakdown.hygiene >= 0.6 ? 'text-orange-600' : 'text-red-600'}`}>
                {Math.round(variable_quality.breakdown.hygiene * 100)}%
              </span>
            </div>
          </div>
        </div>
      )}
      
      {/* Problemi principali - solo se espanso */}
      {isExpanded && variable_quality.issues.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Problemi principali:
          </h4>
          <div className="space-y-1">
            {variable_quality.issues
              .slice(0, 3) // Mostra solo i primi 3
              .map((issue, index) => (
                <div key={issue.variable_id || index} className="text-xs text-gray-600 dark:text-gray-400">
                  <span className="font-bold text-gray-800 dark:text-gray-200">{issue.name}</span>
                  <span className="ml-2">— {issue.reason}</span>
                  <div className="text-xs text-blue-600 dark:text-blue-400 mt-1 ml-4">
                    → {issue.suggestion}
                  </div>
                </div>
              ))}
            
            {variable_quality.issues.length > 3 && (
              <div className="text-xs text-gray-500 dark:text-gray-500">
                ... e altri {variable_quality.issues.length - 3} problemi
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Statistiche aggiuntive - solo se espanso */}
      {isExpanded && (
        <div className="mb-4 text-xs text-gray-600 dark:text-gray-400">
          <div className="flex justify-between">
            <span>DLV senza fallback:</span>
            <span className="font-medium">{variable_quality.stats.dlv_missing_fallback}</span>
          </div>
          <div className="flex justify-between">
            <span>Lookup senza default:</span>
            <span className="font-medium">{variable_quality.stats.lookup_without_default}</span>
          </div>
          <div className="flex justify-between">
            <span>Regex malformate:</span>
            <span className="font-medium">{variable_quality.stats.regex_malformed}</span>
          </div>
          <div className="flex justify-between">
            <span>Selettori fragili:</span>
            <span className="font-medium">{variable_quality.stats.css_fragile_selectors}</span>
          </div>
          <div className="flex justify-between">
            <span>JS non sicuro:</span>
            <span className="font-medium">{variable_quality.stats.js_unsafe_code}</span>
          </div>
          {variable_quality.stats.duplicates > 0 && (
            <div className="flex justify-between">
              <span>Duplicati:</span>
              <span className="font-medium text-orange-600">{variable_quality.stats.duplicates}</span>
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
          🧩 {message.cta}
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
