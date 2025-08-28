import React, { useState } from 'react';
import { HtmlSecurityResult, getHtmlSecurityMetricInfo } from '../services/htmlSecurityService';
import { InfoTooltip } from './ui/InfoTooltip';

interface HtmlSecurityCardProps {
  htmlSecurityResult: HtmlSecurityResult;
  onAction?: () => void;
}

export const HtmlSecurityCard: React.FC<HtmlSecurityCardProps> = ({ 
  htmlSecurityResult, 
  onAction 
}) => {
  const { html_security, message } = htmlSecurityResult;
  const metricInfo = getHtmlSecurityMetricInfo(message.status);
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
  
  // Se non ci sono tag HTML, mostra una card informativa
  if (html_security.checked === 0) {
    return (
      <div className={`${cardStyle.bgColor} ${cardStyle.borderColor} border-2 rounded-xl p-6 shadow-md hover:shadow-lg transition-all duration-200`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔒</span>
            <div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                Sicurezza Custom HTML
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Nessun tag HTML custom rilevato
              </p>
            </div>
          </div>
          <InfoTooltip content="Nessun tag HTML custom è stato rilevato nel container. I tag HTML custom richiedono particolare attenzione per la sicurezza.">
            <span className="text-gray-400 hover:text-gray-600 cursor-help">ℹ️</span>
          </InfoTooltip>
        </div>
        
        <div className="text-center py-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            ✅ Container senza tag HTML custom
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
      <div className="grid grid-cols-4 gap-4 mb-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">
            {html_security.checked}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400">
            Tag HTML
          </div>
        </div>
        
        <div className="text-center">
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">
            {html_security.critical}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400 flex items-center justify-center gap-1">
            <span>🚨</span>
            <span>Critici</span>
          </div>
        </div>
        
        <div className="text-center">
          <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
            {html_security.major}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400 flex items-center justify-center gap-1">
            <span>⚠️</span>
            <span>Maggiori</span>
          </div>
        </div>
        
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {html_security.minor}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400 flex items-center justify-center gap-1">
            <span>ℹ️</span>
            <span>Minori</span>
          </div>
        </div>
      </div>

      {/* Badge per domini terzi */}
      {html_security.third_parties.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Domini terzi:
            </span>
            <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded-full">
              {html_security.third_parties.length}
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {html_security.third_parties.slice(0, 5).map((domain, index) => (
              <span key={index} className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
                {domain}
              </span>
            ))}
            {html_security.third_parties.length > 5 && (
              <span className="px-2 py-1 text-xs bg-gray-100 text-gray-500 rounded">
                +{html_security.third_parties.length - 5} altri
              </span>
            )}
          </div>
        </div>
      )}

      {/* Esempi di problemi principali */}
      {html_security.details.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Esempi di problemi:
          </h4>
          <div className="space-y-1">
            {html_security.details
              .slice(0, 3) // Mostra solo i primi 3
              .map((detail, index) => (
                <div key={detail.id} className="text-xs text-gray-600 dark:text-gray-400">
                  <span className="font-bold text-gray-800 dark:text-gray-200">{detail.name}</span>
                  <span className="ml-2">— {detail.issues.slice(0, 2).map(i => i.message).join(', ')}</span>
                </div>
              ))}
          </div>
        </div>
      )}
      
      {/* Analisi dettagliata - solo se espanso */}
      {isExpanded && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Analisi dettagliata:
          </h4>
          <div className="space-y-3">
            {html_security.details.map((detail) => (
              <div key={detail.id} className="p-3 bg-white dark:bg-gray-700 rounded-lg border-l-4 border-l-current">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm text-gray-800 dark:text-gray-200">
                    {detail.name}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      detail.severity === 'critical' ? 'bg-red-100 text-red-800' :
                      detail.severity === 'major' ? 'bg-orange-100 text-orange-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {detail.severity}
                    </span>
                    <span className="text-xs text-gray-500">
                      {detail.fires_on}
                    </span>
                  </div>
                </div>
                
                <div className="space-y-1 mb-2">
                  {detail.issues.map((issue, idx) => (
                    <div key={idx} className="text-xs text-gray-600 dark:text-gray-400">
                      • {issue.message}
                      {issue.url && <span className="text-blue-600 ml-1">({issue.url})</span>}
                    </div>
                  ))}
                </div>
                
                <div className="text-xs text-blue-600 dark:text-blue-400">
                  💡 {detail.suggestion}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Statistiche aggiuntive - solo se espanso */}
      {isExpanded && (
        <div className="mb-4 text-xs text-gray-600 dark:text-gray-400">
          <div className="flex justify-between">
            <span>Score sicurezza:</span>
            <span className="font-medium">{Math.round(html_security.score * 100)}%</span>
          </div>
          <div className="flex justify-between">
            <span>Domini terzi totali:</span>
            <span className="font-medium">{html_security.third_parties.length}</span>
          </div>
          <div className="flex justify-between">
            <span>Tag in pausa:</span>
            <span className="font-medium">{html_security.details.filter(d => d.paused).length}</span>
          </div>
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
          🔒 {message.cta}
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
