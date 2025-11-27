import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ConsentModeResult, getConsentMetricInfo } from '../services/consentModeService';
import { InfoTooltip } from './ui/InfoTooltip';

interface ConsentModeCardProps {
  consentResult: ConsentModeResult;
  onAction?: () => void;
  className?: string;
}

export const ConsentModeCard: React.FC<ConsentModeCardProps> = ({ 
  consentResult, 
  onAction,
  className
}) => {
  const { consent_coverage, message } = consentResult;
  const metricInfo = getConsentMetricInfo(message.status);
  const [isExpanded, setIsExpanded] = useState(false);
  const navigate = useNavigate();
  
  const totalIssues = consent_coverage.missing + consent_coverage.not_configured;
  
  const getCardStyle = () => {
    switch (message.status) {
      case 'critical':
        return {
          accentBorder: 'border-rose-200',
          accentText: 'text-rose-700'
        };
      case 'major':
        return {
          accentBorder: 'border-purple-200',
          accentText: 'text-purple-700'
        };
      case 'ok':
        return {
          accentBorder: 'border-emerald-200',
          accentText: 'text-emerald-700'
        };
      default:
        return {
          accentBorder: 'border-indigo-200',
          accentText: 'text-indigo-700'
        };
    }
  };
  
  const cardStyle = getCardStyle();
  
  if (consent_coverage.checked === 0) {
    return (
      <div
        className={`ls-card h-full flex flex-col min-h-[260px] ${cardStyle.accentBorder} ${className ?? ''}`}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Consent Mode</h3>
              <p className="text-sm text-slate-600">
                Nessun tag marketing rilevato
              </p>
            </div>
          </div>
          <InfoTooltip content="Nessun tag marketing è stato rilevato nel container. Il Consent Mode non è necessario per questo container.">
            <span className="text-slate-400 hover:text-slate-600 cursor-help"></span>
          </InfoTooltip>
        </div>
        
        <div className="text-center py-4">
          <p className="text-sm text-slate-600">
            Nessun controllo necessario
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <div
      className={`ls-card h-full flex flex-col flex-1 min-h-[260px] ${cardStyle.accentBorder} ${className ?? ''}`}
         onClick={() => setIsExpanded(!isExpanded)}>
      
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              {message.title}
            </h3>
            <p className="text-sm text-slate-600">
              {message.summary}
            </p>
          </div>
        </div>
        
        <div className={`px-3 py-1 rounded-full text-xs font-medium ${metricInfo.priorityColor}`}>
          {metricInfo.priority}
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-slate-700">
            {consent_coverage.checked}
          </div>
          <div className="text-xs text-slate-500">
            Tag controllati
          </div>
        </div>
        
        <div className="text-center">
          <div className="text-2xl font-bold text-indigo-600">
            {consent_coverage.ok}
          </div>
          <div className="text-xs text-slate-500 flex items-center justify-center gap-1">
            <span>Configurati</span>
          </div>
        </div>
        
        <div className="text-center">
          <div className="text-2xl font-bold text-rose-600">
            {totalIssues}
          </div>
          <div className="text-xs text-slate-500 flex items-center justify-center gap-1">
            <span>Con problemi</span>
          </div>
        </div>
      </div>
      
      {isExpanded && totalIssues > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-slate-700 mb-2">
            Problemi rilevati:
          </h4>
          <div className="space-y-1">
            {consent_coverage.details
              .filter(detail => detail.severity !== 'ok')
              .slice(0, 3)
              .map((detail, index) => (
                <div key={detail.id} className="text-xs text-slate-600">
                  <span className="font-bold text-slate-800">{detail.name}</span>
                  {detail.missing.length > 0 && (
                    <span className="ml-2">- manca: {detail.missing.join(', ')}</span>
                  )}
                  {detail.paused && (
                    <span className="ml-2 text-orange-500">(in pausa)</span>
                  )}
                </div>
              ))}
            
            {consent_coverage.details.filter(detail => detail.severity !== 'ok').length > 3 && (
              <div className="text-xs text-slate-500">
                ... e altri {consent_coverage.details.filter(detail => detail.severity !== 'ok').length - 3} problemi
              </div>
            )}
          </div>
        </div>
      )}
      
      <div className="flex justify-end">
        <button 
          className="ls-btn ls-btn-sm"
          onClick={(e) => {
            e.stopPropagation();
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
      
      <div className="flex justify-center mt-2">
        <span className="text-xs text-slate-500">
          {isExpanded ? 'Clicca per comprimere' : 'Clicca per espandere'}
        </span>
      </div>
      
      <InfoTooltip content={metricInfo.impact}>
        <div className="absolute top-2 right-2 w-4 h-4"></div>
      </InfoTooltip>
    </div>
  );
};

