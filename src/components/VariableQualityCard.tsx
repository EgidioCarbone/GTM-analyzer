import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getVariableMetricInfo } from '../services/variableQualityService';
import { VariableQualityResult } from '../types/gtm';
import { InfoTooltip } from './ui/InfoTooltip';

interface VariableQualityCardProps {
  variableResult: VariableQualityResult;
  onAction?: () => void;
  className?: string;
}

export const VariableQualityCard: React.FC<VariableQualityCardProps> = ({ 
  variableResult, 
  onAction,
  className
}) => {
  const { variable_quality, message } = variableResult;
  const metricInfo = getVariableMetricInfo(message.status);
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
  
  if (variable_quality.stats.total === 0) {
    return (
      <div className={`ls-card h-full flex flex-col min-h-[260px] ${cardStyle.accentBorder} ${className ?? ''}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                Qualità Variabili
              </h3>
              <p className="text-sm text-slate-600">
                Nessuna variabile rilevata
              </p>
            </div>
          </div>
          <InfoTooltip content="Nessuna variabile è stata rilevata nel container. Le variabili sono necessarie per gestire i dati dinamici.">
          </InfoTooltip>
        </div>
        
        <div className="text-center py-4">
          <p className="text-sm text-slate-600">
            Container senza variabili
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <div className={`ls-card h-full flex flex-col flex-1 min-h-[260px] ${cardStyle.accentBorder} ${className ?? ''}`}
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
            {variable_quality.stats.total}
          </div>
          <div className="text-xs text-slate-500">
            Variabili totali
          </div>
        </div>
        
        <div className="text-center">
          <div className="text-2xl font-bold text-indigo-600">
            {variable_quality.stats.total - variable_quality.stats.unused}
          </div>
          <div className="text-xs text-slate-500 flex items-center justify-center gap-1">
            <span>Utilizzate</span>
          </div>
        </div>
        
        <div className="text-center">
          <div className="text-2xl font-bold text-rose-600">
            {variable_quality.stats.unused}
          </div>
          <div className="text-xs text-slate-500 flex items-center justify-center gap-1">
            <span>Non usate</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {variable_quality.stats.dlv_missing_fallback > 0 && (
          <span className="px-2 py-1 text-xs bg-amber-50 text-amber-800 rounded-full border border-amber-200">
            DLV senza fallback ({variable_quality.stats.dlv_missing_fallback})
          </span>
        )}
        {variable_quality.stats.lookup_without_default > 0 && (
          <span className="px-2 py-1 text-xs bg-rose-50 text-rose-800 rounded-full border border-rose-200">
            Lookup senza default ({variable_quality.stats.lookup_without_default})
          </span>
        )}
        {variable_quality.stats.duplicates > 0 && (
          <span className="px-2 py-1 text-xs bg-amber-50 text-amber-800 rounded-full border border-amber-200">
            Duplicati ({variable_quality.stats.duplicates})
          </span>
        )}
        {variable_quality.stats.regex_malformed > 0 && (
          <span className="px-2 py-1 text-xs bg-rose-50 text-rose-800 rounded-full border border-rose-200">
            Regex malformate ({variable_quality.stats.regex_malformed})
          </span>
        )}
        {variable_quality.stats.css_fragile_selectors > 0 && (
          <span className="px-2 py-1 text-xs bg-amber-50 text-amber-800 rounded-full border border-amber-200">
            Selettori fragili ({variable_quality.stats.css_fragile_selectors})
          </span>
        )}
        {variable_quality.stats.js_unsafe_code > 0 && (
          <span className="px-2 py-1 text-xs bg-rose-50 text-rose-800 rounded-full border border-rose-200">
            JS non sicuro ({variable_quality.stats.js_unsafe_code})
          </span>
        )}
      </div>

      <div className="mb-4">
        <h4 className="text-sm font-medium text-slate-700 mb-2">
          Score per categoria:
        </h4>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-600">DLV:</span>
            <div className="flex items-center gap-2">
              <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-300 ${
                    variable_quality.breakdown.dlv >= 0.8 ? 'bg-emerald-500' : 
                    variable_quality.breakdown.dlv >= 0.6 ? 'bg-amber-500' : 'bg-rose-500'
                  }`}
                  style={{ width: `${variable_quality.breakdown.dlv * 100}%` }}
                />
              </div>
              <span className="font-medium w-8 text-right">
                {Math.round(variable_quality.breakdown.dlv * 100)}%
              </span>
            </div>
          </div>
          
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-600">Lookup:</span>
            <div className="flex items-center gap-2">
              <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-300 ${
                    variable_quality.breakdown.lookup >= 0.8 ? 'bg-emerald-500' : 
                    variable_quality.breakdown.lookup >= 0.6 ? 'bg-amber-500' : 'bg-rose-500'
                  }`}
                  style={{ width: `${variable_quality.breakdown.lookup * 100}%` }}
                />
              </div>
              <span className="font-medium w-8 text-right">
                {Math.round(variable_quality.breakdown.lookup * 100)}%
              </span>
            </div>
          </div>
          
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-600">Igiene:</span>
            <div className="flex items-center gap-2">
              <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-300 ${
                    variable_quality.breakdown.hygiene >= 0.8 ? 'bg-emerald-500' : 
                    variable_quality.breakdown.hygiene >= 0.6 ? 'bg-amber-500' : 'bg-rose-500'
                  }`}
                  style={{ width: `${variable_quality.breakdown.hygiene * 100}%` }}
                />
              </div>
              <span className="font-medium w-8 text-right">
                {Math.round(variable_quality.breakdown.hygiene * 100)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {variable_quality.issues.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-slate-700 mb-2">
            Esempi di problemi:
          </h4>
          <div className="space-y-1">
            {variable_quality.issues
              .slice(0, 3)
                .map((issue: any, index: number) => (
                <div key={`examples-${issue.variable_id || 'unknown'}-${index}`} className="text-xs text-slate-600">
                  <span className="font-bold text-slate-800">{issue.name}</span>
                  <span className="ml-2">- {issue.reason}</span>
                </div>
              ))}
          </div>
        </div>
      )}
      
      {isExpanded && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-slate-700 mb-2">
            Analisi dettagliata completa:
          </h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-600">Selettori:</span>
              <span className={`font-medium ${variable_quality.breakdown.selectors >= 0.8 ? 'text-emerald-600' : variable_quality.breakdown.selectors >= 0.6 ? 'text-amber-600' : 'text-rose-600'}`}>
                {Math.round(variable_quality.breakdown.selectors * 100)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">JavaScript:</span>
              <span className={`font-medium ${variable_quality.breakdown.js >= 0.8 ? 'text-emerald-600' : variable_quality.breakdown.js >= 0.6 ? 'text-amber-600' : 'text-rose-600'}`}>
                {Math.round(variable_quality.breakdown.js * 100)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Regex:</span>
              <span className={`font-medium ${variable_quality.breakdown.regex >= 0.8 ? 'text-emerald-600' : variable_quality.breakdown.regex >= 0.6 ? 'text-amber-600' : 'text-rose-600'}`}>
                {Math.round(variable_quality.breakdown.regex * 100)}%
              </span>
            </div>
          </div>
        </div>
      )}
      
      {isExpanded && variable_quality.issues.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-slate-700 mb-2">
            Problemi principali:
          </h4>
          <div className="space-y-1">
            {variable_quality.issues
              .slice(0, 3)
              .map((issue: any, index: number) => (
                <div key={`detailed-${issue.variable_id || 'unknown'}-${index}`} className="text-xs text-slate-600">
                  <span className="font-bold text-slate-800">{issue.name}</span>
                  <span className="ml-2">- {issue.reason}</span>
                  <div className="text-xs text-blue-600 mt-1 ml-4">
                    → {issue.suggestion}
                  </div>
                </div>
              ))}
            
            {variable_quality.issues.length > 3 && (
              <div className="text-xs text-slate-500">
                ... e altri {variable_quality.issues.length - 3} problemi
              </div>
            )}
          </div>
        </div>
      )}
      
      {isExpanded && (
        <div className="mb-4 text-xs text-slate-600 space-y-1">
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
              <span className="font-medium text-amber-600">{variable_quality.stats.duplicates}</span>
            </div>
          )}
        </div>
      )}
      
      <div className="flex justify-end">
        <button 
          className="ls-btn ls-btn-sm"
          onClick={(e) => {
            e.stopPropagation();
            let filter = 'var-dlv';
            if (variable_quality.stats.lookup_without_default > 0) {
              filter = 'var-lookup';
            } else if (variable_quality.stats.dlv_missing_fallback > 0) {
              filter = 'var-dlv';
            } else if (variable_quality.stats.js_unsafe_code > 0) {
              filter = 'var-js';
            } else if (variable_quality.stats.regex_malformed > 0) {
              filter = 'var-regex';
            } else if (variable_quality.stats.duplicates > 0) {
              filter = 'var-duplicate';
            } else if (variable_quality.stats.unused > 0) {
              filter = 'var-unused';
            }
            navigate('/container-manager', { 
              state: { 
                autoFilter: filter, 
                tab: 'variables' 
              } 
            });
            onAction?.();
          }}
        >
          {(() => {
            if (variable_quality.stats.lookup_without_default > 0) {
              return 'Esamina Lookup senza default';
            }
            if (variable_quality.stats.dlv_missing_fallback > 0) {
              return 'Esamina DLV senza fallback';
            }
            if (variable_quality.stats.js_unsafe_code > 0) {
              return 'Esamina JS non sicuro';
            }
            if (variable_quality.stats.regex_malformed > 0) {
              return 'Esamina Regex malformate';
            }
            if (variable_quality.stats.duplicates > 0) {
              return 'Esamina Duplicati';
            }
            if (variable_quality.stats.unused > 0) {
              return 'Esamina Variabili non usate';
            }
            return 'Rivedi variabili';
          })()}
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



