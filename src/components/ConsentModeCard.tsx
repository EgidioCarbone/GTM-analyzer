import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ConsentModeResult, getConsentMetricInfo } from '../services/consentModeService';
import { InfoTooltip } from './ui/InfoTooltip';

interface ConsentModeCardProps {
  consentResult: ConsentModeResult;
  onAction?: () => void;
}

export const ConsentModeCard: React.FC<ConsentModeCardProps> = ({ 
  consentResult, 
  onAction 
}) => {
  const { consent_coverage, message } = consentResult;
  const metricInfo = getConsentMetricInfo(message.status);
  const [isExpanded, setIsExpanded] = useState(false);
  const navigate = useNavigate();
  
  // Calcola il numero totale di problemi
  const totalIssues = consent_coverage.missing + consent_coverage.not_configured;
  
  // Determina il colore e lo stile in base alla severità
  const getCardStyle = () => {
    switch (message.status) {
      case 'critical':
        return {
          bgColor: 'bg-red-50 dark:bg-red-900/20',
          borderColor: 'border-red-200 dark:border-red-800',
          textColor: 'text-red-600 dark:text-red-400',
          buttonColor: 'bg-pink-100 hover:bg-pink-200 text-pink-800 dark:bg-pink-800 dark:hover:bg-pink-700 dark:text-pink-100'
        };
      case 'major':
        return {
          bgColor: 'bg-orange-50 dark:bg-orange-900/20',
          borderColor: 'border-orange-200 dark:border-orange-800',
          textColor: 'text-orange-600 dark:text-orange-400',
          buttonColor: 'bg-pink-100 hover:bg-pink-200 text-pink-800 dark:bg-pink-800 dark:hover:bg-pink-700 dark:text-pink-100'
        };
      case 'minor':
        return {
          bgColor: 'bg-blue-50 dark:bg-blue-900/20',
          borderColor: 'border-blue-200 dark:border-blue-800',
          textColor: 'text-blue-600 dark:text-blue-400',
          buttonColor: 'bg-pink-100 hover:bg-pink-200 text-pink-800 dark:bg-pink-800 dark:hover:bg-pink-700 dark:text-pink-100'
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
  
  // Se non ci sono tag marketing, mostra una card informativa
  if (consent_coverage.checked === 0) {
    return (
      <div className={`${cardStyle.bgColor} ${cardStyle.borderColor} border-2 rounded-xl p-6 shadow-md hover:shadow-lg transition-all duration-200`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔒</span>
            <div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                Consent Mode
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Nessun tag marketing rilevato
              </p>
            </div>
          </div>
          <InfoTooltip content="Nessun tag marketing è stato rilevato nel container. Il Consent Mode non è necessario per questo container.">
            <span className="text-gray-400 hover:text-gray-600 cursor-help">ℹ️</span>
          </InfoTooltip>
        </div>
        
        <div className="text-center py-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            ✅ Nessun controllo necessario
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
      
      {/* Statistiche principali */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">
            {consent_coverage.checked}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400">
            Tag controllati
          </div>
        </div>
        
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {consent_coverage.ok}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400 flex items-center justify-center gap-1">
            <span>✅</span>
            <span>Configurati</span>
          </div>
        </div>
        
        <div className="text-center">
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">
            {totalIssues}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400 flex items-center justify-center gap-1">
            <span>⚠️</span>
            <span>Con problemi</span>
          </div>
        </div>
      </div>
      
      {/* Dettagli dei problemi - solo se espanso */}
      {isExpanded && totalIssues > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Problemi rilevati:
          </h4>
          <div className="space-y-1">
            {consent_coverage.details
              .filter(detail => detail.severity !== 'ok')
              .slice(0, 3) // Mostra solo i primi 3
              .map((detail, index) => (
                <div key={detail.id} className="text-xs text-gray-600 dark:text-gray-400">
                  <span className="font-bold text-gray-800 dark:text-gray-200">{detail.name}</span>
                  {detail.missing.length > 0 && (
                    <span className="ml-2">
                      — manca: {detail.missing.join(', ')}
                    </span>
                  )}
                  {detail.paused && (
                    <span className="ml-2 text-orange-500">(in pausa)</span>
                  )}
                </div>
              ))}
            
            {consent_coverage.details.filter(detail => detail.severity !== 'ok').length > 3 && (
              <div className="text-xs text-gray-500 dark:text-gray-500">
                ... e altri {consent_coverage.details.filter(detail => detail.severity !== 'ok').length - 3} problemi
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* CTA */}
      <div className="flex justify-end">
        <button 
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${cardStyle.buttonColor}`}
          onClick={(e) => {
            e.stopPropagation();
            // Naviga al Container Manager con filtro per consent
            navigate('/container-manager', { 
              state: { 
                autoFilter: 'consent', 
                tab: 'tags' 
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
