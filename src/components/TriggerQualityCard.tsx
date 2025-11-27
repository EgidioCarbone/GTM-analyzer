import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TriggerQualityResult, getTriggerMetricInfo } from '../services/triggerQualityService';
import { InfoTooltip } from './ui/InfoTooltip';

interface TriggerQualityCardProps {
  triggerResult: TriggerQualityResult;
  onAction?: () => void;
  className?: string;
}

export const TriggerQualityCard: React.FC<TriggerQualityCardProps> = ({ 
  triggerResult, 
  onAction,
  className
}) => {
  const { trigger_quality, message } = triggerResult;
  const metricInfo = getTriggerMetricInfo(message.status);
  const [isExpanded, setIsExpanded] = useState(false);
  const navigate = useNavigate();
  
  const getCardStyle = () => {
    switch (message.status) {
      case 'critical':
        return { accentBorder: 'border-rose-200', accentText: 'text-rose-700' };
      case 'major':
        return { accentBorder: 'border-purple-200', accentText: 'text-purple-700' };
      case 'minor':
        return { accentBorder: 'border-amber-200', accentText: 'text-amber-700' };
      default:
        return { accentBorder: 'border-emerald-200', accentText: 'text-emerald-700' };
    }
  };
  
  const cardStyle = getCardStyle();
  
  if (trigger_quality.stats.total_triggers === 0) {
    return (
      <div
        className={`ls-card h-full flex flex-col min-h-[260px] ${cardStyle.accentBorder} ${className ?? ''}`}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                Qualità Trigger
              </h3>
              <p className="text-sm text-slate-600">
                Nessun trigger rilevato
              </p>
            </div>
          </div>
          <InfoTooltip content="Nessun trigger è stato rilevato nel container. I trigger sono necessari per attivare i tag.">
          </InfoTooltip>
        </div>
        
        <div className="text-center py-4">
          <p className="text-sm text-slate-600">
            Container senza trigger
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
            {trigger_quality.stats.total_triggers}
          </div>
          <div className="text-xs text-slate-500">
            Trigger totali
          </div>
        </div>
        
        <div className="text-center">
          <div className="text-2xl font-bold text-indigo-600">
            {trigger_quality.stats.total_triggers - trigger_quality.stats.unused_triggers}
          </div>
          <div className="text-xs text-slate-500 flex items-center justify-center gap-1">
            <span>Utilizzati</span>
          </div>
        </div>
        
        <div className="text-center">
          <div className="text-2xl font-bold text-rose-600">
            {trigger_quality.stats.unused_triggers}
          </div>
          <div className="text-xs text-slate-500 flex items-center justify-center gap-1">
            <span>Non usati</span>
          </div>
        </div>
      </div>
      
      {isExpanded && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-slate-700 mb-2">
            Analisi dettagliata:
          </h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-600">SpecificitÃ :</span>
              <span className={`font-medium ${trigger_quality.breakdown.specificity >= 0.8 ? 'text-emerald-600' : trigger_quality.breakdown.specificity >= 0.6 ? 'text-amber-600' : 'text-rose-600'}`}>
                {Math.round(trigger_quality.breakdown.specificity * 100)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Blocking:</span>
              <span className={`font-medium ${trigger_quality.breakdown.blocking >= 0.8 ? 'text-emerald-600' : trigger_quality.breakdown.blocking >= 0.6 ? 'text-amber-600' : 'text-rose-600'}`}>
                {Math.round(trigger_quality.breakdown.blocking * 100)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Timing:</span>
              <span className={`font-medium ${trigger_quality.breakdown.timing >= 0.8 ? 'text-emerald-600' : trigger_quality.breakdown.timing >= 0.6 ? 'text-amber-600' : 'text-rose-600'}`}>
                {Math.round(trigger_quality.breakdown.timing * 100)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">SPA:</span>
              <span className={`font-medium ${trigger_quality.breakdown.spa >= 0.8 ? 'text-emerald-600' : trigger_quality.breakdown.spa >= 0.6 ? 'text-amber-600' : 'text-rose-600'}`}>
                {Math.round(trigger_quality.breakdown.spa * 100)}%
              </span>
            </div>
          </div>
        </div>
      )}
      
      {isExpanded && trigger_quality.issues.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-slate-700 mb-2">
            Problemi principali:
          </h4>
          <div className="space-y-1">
            {trigger_quality.issues
              .slice(0, 3)
              .map((issue) => (
                <div key={issue.trigger_id} className="text-xs text-slate-600">
                  <span className="font-bold text-slate-800">{issue.name}</span>
                  <span className="ml-2">- {issue.reason}</span>
                  <div className="text-xs text-blue-600 mt-1 ml-4">
                    â†’ {issue.suggestion}
                  </div>
                </div>
              ))}
            
            {trigger_quality.issues.length > 3 && (
              <div className="text-xs text-slate-500">
                ... e altri {trigger_quality.issues.length - 3} problemi
              </div>
            )}
          </div>
        </div>
      )}
      
      {isExpanded && (
        <div className="mb-4 text-xs text-slate-600 space-y-1">
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
            <span className="font-medium">{trigger_quality.stats.history_change_present ? 'Sì' : 'No'}</span>
          </div>
          {trigger_quality.stats.duplicates.length > 0 && (
            <div className="flex justify-between">
              <span>Duplicati:</span>
              <span className="font-medium text-amber-600">{trigger_quality.stats.duplicates.length}</span>
            </div>
          )}
        </div>
      )}
      
      <div className="flex justify-end">
        <button 
          className="ls-btn ls-btn-sm"
          onClick={(e) => {
            e.stopPropagation();
            let filter = 'trg-allpages';
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



