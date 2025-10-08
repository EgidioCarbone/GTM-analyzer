import React from 'react';
import { 
  Download, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Clock,
  Shield,
  Activity
} from 'lucide-react';

interface SummaryBoxProps {
  siteName: string;
  testDate: string;
  overallStatus: 'PASS' | 'FAIL';
  overallScore: number;
  totalScenarios: number;
  passedScenarios: number;
  totalCookies: number;
  sensitiveCookies: number;
  totalRequests: number;
  blockedRequests: number;
  testDuration: number;
  onDownloadPDF: () => void;
}

const SummaryBox: React.FC<SummaryBoxProps> = ({
  siteName,
  testDate,
  overallStatus,
  overallScore,
  totalScenarios,
  passedScenarios,
  totalCookies,
  sensitiveCookies,
  totalRequests,
  blockedRequests,
  testDuration,
  onDownloadPDF
}) => {
  const getStatusIcon = (status: 'PASS' | 'FAIL') => {
    return status === 'PASS' ? 
      <CheckCircle className="w-8 h-8 text-green-600" /> : 
      <XCircle className="w-8 h-8 text-red-600" />;
  };

  const getStatusColor = (status: 'PASS' | 'FAIL') => {
    return status === 'PASS' ? 'text-green-600' : 'text-red-600';
  };

  const getStatusBg = (status: 'PASS' | 'FAIL') => {
    return status === 'PASS' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200';
  };

  const formatDuration = (duration: number) => {
    if (duration < 1000) return `${duration}ms`;
    return `${(duration / 1000).toFixed(1)}s`;
  };

  const complianceRate = Math.round((passedScenarios / totalScenarios) * 100);
  const cookieCompliance = Math.round(((totalCookies - sensitiveCookies) / totalCookies) * 100);
  const requestCompliance = Math.round(((totalRequests - blockedRequests) / totalRequests) * 100);

  return (
    <div className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header principale */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{siteName}</h1>
            <p className="text-gray-600 mt-1">
              Test eseguito il {new Date(testDate).toLocaleDateString('it-IT', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          </div>
          <button 
            onClick={onDownloadPDF}
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Download className="w-5 h-5 mr-2" />
            Scarica Report PDF
          </button>
        </div>

        {/* Box di risultato principale */}
        <div className={`rounded-xl border-2 p-6 ${getStatusBg(overallStatus)}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              {getStatusIcon(overallStatus)}
              <div className="ml-4">
                <h2 className={`text-2xl font-bold ${getStatusColor(overallStatus)}`}>
                  {overallStatus === 'PASS' ? 'CONSENSO CONFORME' : 'PROBLEMI RILEVATI'}
                </h2>
                <p className="text-gray-600 mt-1">
                  {overallStatus === 'PASS' 
                    ? 'Il sito rispetta correttamente le preferenze di consenso dell\'utente'
                    : 'Sono stati rilevati problemi nella gestione del consenso'
                  }
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className={`text-4xl font-bold ${getStatusColor(overallStatus)}`}>
                {overallScore}%
              </div>
              <div className="text-sm text-gray-500">Punteggio Complessivo</div>
            </div>
          </div>
        </div>

        {/* Metriche dettagliate */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-8">
          {/* Scenari */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <BarChart3 className="w-5 h-5 text-blue-600" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-gray-900">Scenari</h3>
                  <p className="text-xs text-gray-500">Test completati</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-900">{totalScenarios}</div>
                <div className="text-xs text-gray-500">totali</div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                <span className="text-sm text-gray-600">{passedScenarios} passati</span>
              </div>
              <div className="flex items-center">
                {complianceRate > 50 ? (
                  <TrendingUp className="w-4 h-4 text-green-600 mr-1" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-600 mr-1" />
                )}
                <span className={`text-sm font-medium ${
                  complianceRate > 50 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {complianceRate}%
                </span>
              </div>
            </div>
          </div>

          {/* Cookie */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <Shield className="w-5 h-5 text-amber-600" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-gray-900">Cookie</h3>
                  <p className="text-xs text-gray-500">Rilevati</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-900">{totalCookies}</div>
                <div className="text-xs text-gray-500">totali</div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
                <span className="text-sm text-gray-600">{sensitiveCookies} sensibili</span>
              </div>
              <div className="flex items-center">
                {cookieCompliance > 80 ? (
                  <TrendingUp className="w-4 h-4 text-green-600 mr-1" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-600 mr-1" />
                )}
                <span className={`text-sm font-medium ${
                  cookieCompliance > 80 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {cookieCompliance}%
                </span>
              </div>
            </div>
          </div>

          {/* Richieste di rete */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Activity className="w-5 h-5 text-purple-600" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-gray-900">Richieste</h3>
                  <p className="text-xs text-gray-500">Di rete</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-900">{totalRequests}</div>
                <div className="text-xs text-gray-500">totali</div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
                <span className="text-sm text-gray-600">{blockedRequests} bloccate</span>
              </div>
              <div className="flex items-center">
                {requestCompliance > 70 ? (
                  <TrendingUp className="w-4 h-4 text-green-600 mr-1" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-600 mr-1" />
                )}
                <span className={`text-sm font-medium ${
                  requestCompliance > 70 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {requestCompliance}%
                </span>
              </div>
            </div>
          </div>

          {/* Durata test */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Clock className="w-5 h-5 text-gray-600" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-gray-900">Durata</h3>
                  <p className="text-xs text-gray-500">Test</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-900">
                  {formatDuration(testDuration)}
                </div>
                <div className="text-xs text-gray-500">totale</div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                <span className="text-sm text-gray-600">Tempo medio</span>
              </div>
              <div className="flex items-center">
                <TrendingUp className="w-4 h-4 text-green-600 mr-1" />
                <span className="text-sm font-medium text-green-600">
                  {formatDuration(testDuration / totalScenarios)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SummaryBox;
