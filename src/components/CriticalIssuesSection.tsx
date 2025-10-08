import React from 'react';
import { AlertTriangle, CheckCircle, ExternalLink, Settings } from 'lucide-react';

interface CriticalIssue {
  id: string;
  severity: 'critical' | 'warning';
  title: string;
  businessImpact: string;
  technicalCause: string;
  solution: {
    immediate: string;
    verification: string;
    monitoring: string;
  };
  affectedElements: string[];
}

interface CriticalIssuesSectionProps {
  issues: CriticalIssue[];
}

const CriticalIssuesSection: React.FC<CriticalIssuesSectionProps> = ({ issues }) => {
  if (issues.length === 0) {
    return (
      <div className="bg-green-50/80 backdrop-blur-sm border border-green-200 rounded-lg p-6">
        <div className="flex items-center">
          <CheckCircle className="w-6 h-6 text-green-600 mr-3" />
          <div>
            <h2 className="text-lg font-semibold text-green-800">✅ CONFORMITÀ GDPR: COMPLETA</h2>
            <p className="text-green-700 mt-1">
              Il sito rispetta correttamente tutte le preferenze di consenso dell'utente. Nessuna violazione GDPR rilevata.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center mb-4">
        <AlertTriangle className="w-6 h-6 text-red-600 mr-2" />
        <h2 className="text-xl font-bold text-red-800">🚨 VIOLAZIONI GDPR RILEVATE</h2>
      </div>
      
      {issues.map((issue, index) => (
        <div 
          key={issue.id}
          className={`border rounded-lg p-6 backdrop-blur-sm ${
            issue.severity === 'critical' 
              ? 'bg-red-50/80 border-red-200' 
              : 'bg-yellow-50/80 border-yellow-200'
          }`}
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center mb-2">
                <span className="text-sm font-medium text-gray-500 mr-2">#{index + 1}</span>
                <h3 className="text-lg font-semibold text-gray-900">{issue.title}</h3>
                <span className={`ml-3 px-2 py-1 rounded-full text-xs font-medium ${
                  issue.severity === 'critical' 
                    ? 'bg-red-100 text-red-800' 
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {issue.severity === 'critical' ? 'CRITICO' : 'WARNING'}
                </span>
              </div>
              
              <div className="mb-4">
                <p className="text-sm text-gray-700 mb-2">
                  <span className="font-medium">Impatto Business:</span> {issue.businessImpact}
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Causa Tecnica:</span> {issue.technicalCause}
                </p>
              </div>
            </div>
          </div>

          {/* Elementi Coinvolti */}
          {issue.affectedElements.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Elementi Coinvolti:</h4>
              <div className="flex flex-wrap gap-2">
                {issue.affectedElements.map((element, idx) => (
                  <span 
                    key={idx}
                    className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-mono"
                  >
                    {element}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Soluzioni */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-700">Azioni Richieste:</h4>
            
            <div className="bg-white rounded border p-3">
              <div className="flex items-start">
                <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center mr-3 mt-0.5">
                  <span className="text-xs font-bold text-red-600">1</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Azione Immediata</p>
                  <p className="text-sm text-gray-600">{issue.solution.immediate}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded border p-3">
              <div className="flex items-start">
                <div className="w-6 h-6 bg-yellow-100 rounded-full flex items-center justify-center mr-3 mt-0.5">
                  <span className="text-xs font-bold text-yellow-600">2</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Verifica</p>
                  <p className="text-sm text-gray-600">{issue.solution.verification}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded border p-3">
              <div className="flex items-start">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center mr-3 mt-0.5">
                  <span className="text-xs font-bold text-blue-600">3</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Monitoraggio</p>
                  <p className="text-sm text-gray-600">{issue.solution.monitoring}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default CriticalIssuesSection;
