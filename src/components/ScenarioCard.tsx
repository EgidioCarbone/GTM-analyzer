import React from 'react';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Cookie, 
  Activity,
  TrendingUp,
  TrendingDown,
  BarChart3
} from 'lucide-react';

interface ScenarioCardProps {
  scenario: {
    name: string;
    status: 'PASS' | 'FAIL';
    description: string;
  };
  index: number;
  totalCookies: number;
  totalRequests: number;
  duration: number;
  blockedRequests: number;
}

const ScenarioCard: React.FC<ScenarioCardProps> = ({
  scenario,
  index,
  totalCookies,
  totalRequests,
  duration,
  blockedRequests
}) => {
  const getStatusIcon = (status: 'PASS' | 'FAIL') => {
    return status === 'PASS' ? 
      <CheckCircle className="w-6 h-6 text-green-600" /> : 
      <XCircle className="w-6 h-6 text-red-600" />;
  };

  const getStatusColor = (status: 'PASS' | 'FAIL') => {
    return status === 'PASS' ? 'green' : 'red';
  };

  const getStatusGradient = (status: 'PASS' | 'FAIL') => {
    return status === 'PASS' 
      ? 'from-green-500 to-green-600' 
      : 'from-red-500 to-red-600';
  };

  // Calcola le metriche per il mini grafico
  const successRate = Math.round(((totalRequests - blockedRequests) / totalRequests) * 100);
  const cookieRate = Math.round((totalCookies / 10) * 100); // Normalizza su 10 cookie max

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all duration-200 group">
      {/* Header con icona e stato */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            scenario.status === 'PASS' 
              ? 'bg-green-100 text-green-600' 
              : 'bg-red-100 text-red-600'
          }`}>
            {getStatusIcon(scenario.status)}
          </div>
          <div className="ml-3">
            <h3 className="text-lg font-semibold text-gray-900">{scenario.name}</h3>
            <p className="text-sm text-gray-500">Scenario {index + 1}</p>
          </div>
        </div>
        <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
          scenario.status === 'PASS' 
            ? 'bg-green-100 text-green-800 border border-green-200' 
            : 'bg-red-100 text-red-800 border border-red-200'
        }`}>
          {scenario.status === 'PASS' ? 'PASS' : 'FAIL'}
        </div>
      </div>

      {/* Mini grafico a barre */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-600">Performance</span>
          <span className="text-xs text-gray-500">{successRate}% successo</span>
        </div>
        <div className="flex space-x-1">
          {/* Barra per richieste permesse */}
          <div 
            className={`h-2 bg-gradient-to-r ${getStatusGradient(scenario.status)} rounded-l-full transition-all duration-300`}
            style={{ width: `${successRate}%` }}
          />
          {/* Barra per richieste bloccate */}
          <div 
            className="h-2 bg-gray-300 rounded-r-full transition-all duration-300"
            style={{ width: `${100 - successRate}%` }}
          />
        </div>
      </div>

      {/* Descrizione */}
      <p className="text-sm text-gray-600 leading-relaxed mb-4">{scenario.description}</p>

      {/* Metriche */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="flex items-center space-x-2">
          <Clock className="w-4 h-4 text-gray-400" />
          <div>
            <div className="text-sm font-medium text-gray-900">{duration}s</div>
            <div className="text-xs text-gray-500">Durata</div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Cookie className="w-4 h-4 text-gray-400" />
          <div>
            <div className="text-sm font-medium text-gray-900">{totalCookies}</div>
            <div className="text-xs text-gray-500">Cookie</div>
          </div>
        </div>
      </div>

      {/* Statistiche dettagliate */}
      <div className="pt-4 border-t border-gray-100">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
          <span>Richieste di rete</span>
          <span>{totalRequests} totali</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
              <span className="text-xs text-gray-600">
                {totalRequests - blockedRequests} permesse
              </span>
            </div>
            <div className="flex items-center">
              <div className="w-2 h-2 bg-red-500 rounded-full mr-1"></div>
              <span className="text-xs text-gray-600">
                {blockedRequests} bloccate
              </span>
            </div>
          </div>
          <div className="flex items-center">
            {successRate > 50 ? (
              <TrendingUp className="w-3 h-3 text-green-600 mr-1" />
            ) : (
              <TrendingDown className="w-3 h-3 text-red-600 mr-1" />
            )}
            <span className={`text-xs font-medium ${
              successRate > 50 ? 'text-green-600' : 'text-red-600'
            }`}>
              {successRate}%
            </span>
          </div>
        </div>
      </div>

      {/* Indicatore di trend */}
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <BarChart3 className="w-4 h-4 text-gray-400" />
          <span className="text-xs text-gray-500">Analisi dettagliata</span>
        </div>
        <div className={`text-xs font-medium ${
          scenario.status === 'PASS' ? 'text-green-600' : 'text-red-600'
        }`}>
          {scenario.status === 'PASS' ? 'Conforme' : 'Non conforme'}
        </div>
      </div>
    </div>
  );
};

export default ScenarioCard;
