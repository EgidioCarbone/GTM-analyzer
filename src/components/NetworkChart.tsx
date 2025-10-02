import React from 'react';
import { BarChart3, TrendingUp, TrendingDown, Activity } from 'lucide-react';

interface NetworkRequest {
  url: string;
  domain: string;
  timestamp: number;
  category: 'analytics' | 'ads' | 'marketing' | 'other';
  blocked: boolean;
}

interface NetworkChartProps {
  requests: NetworkRequest[];
  title: string;
  category: 'analytics' | 'ads' | 'marketing' | 'other';
  color: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NetworkChart: React.FC<NetworkChartProps> = ({
  requests,
  title,
  category,
  color,
  icon: Icon
}) => {
  // Raggruppa le richieste per dominio
  const domainStats = requests.reduce((acc, req) => {
    if (!acc[req.domain]) {
      acc[req.domain] = {
        domain: req.domain,
        total: 0,
        blocked: 0,
        allowed: 0,
        avgTime: 0,
        times: []
      };
    }
    acc[req.domain].total++;
    acc[req.domain].times.push(req.timestamp);
    if (req.blocked) {
      acc[req.domain].blocked++;
    } else {
      acc[req.domain].allowed++;
    }
    return acc;
  }, {} as Record<string, {
    domain: string;
    total: number;
    blocked: number;
    allowed: number;
    avgTime: number;
    times: number[];
  }>);

  // Calcola il tempo medio per dominio
  Object.values(domainStats).forEach(stat => {
    stat.avgTime = stat.times.reduce((sum, time) => sum + time, 0) / stat.times.length;
  });

  // Ordina per numero di richieste
  const sortedStats = Object.values(domainStats).sort((a, b) => b.total - a.total);

  // Trova il massimo per la scala
  const maxRequests = Math.max(...sortedStats.map(s => s.total));

  const formatTimestamp = (timestamp: number) => {
    if (timestamp < 1000) return `${timestamp}ms`;
    return `${(timestamp / 1000).toFixed(1)}s`;
  };

  const getBlockedPercentage = (stat: typeof sortedStats[0]) => {
    return Math.round((stat.blocked / stat.total) * 100);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <div className={`p-2 rounded-lg ${color}`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div className="ml-3">
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-500">{requests.length} richieste totali</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-gray-900">{requests.length}</div>
          <div className="text-sm text-gray-500">richieste</div>
        </div>
      </div>

      {/* Grafico a barre */}
      <div className="space-y-3">
        {sortedStats.slice(0, 5).map((stat, index) => {
          const blockedPercentage = getBlockedPercentage(stat);
          const barWidth = (stat.total / maxRequests) * 100;
          
          return (
            <div key={stat.domain} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-900 truncate max-w-32">
                    {stat.domain}
                  </span>
                  <span className="text-xs text-gray-500">({stat.total})</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-gray-500">
                    {formatTimestamp(stat.avgTime)}
                  </span>
                  {blockedPercentage > 0 && (
                    <span className="text-xs text-red-600">
                      {blockedPercentage}% bloccate
                    </span>
                  )}
                </div>
              </div>
              
              {/* Barra del grafico */}
              <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-300"
                  style={{ width: `${barWidth}%` }}
                />
                {blockedPercentage > 0 && (
                  <div 
                    className="absolute top-0 left-0 h-full bg-gradient-to-r from-red-500 to-red-600 rounded-full transition-all duration-300"
                    style={{ width: `${(blockedPercentage / 100) * barWidth}%` }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Statistiche riassuntive */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-lg font-semibold text-gray-900">
              {requests.filter(r => !r.blocked).length}
            </div>
            <div className="text-xs text-gray-500">Permesse</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-red-600">
              {requests.filter(r => r.blocked).length}
            </div>
            <div className="text-xs text-gray-500">Bloccate</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-gray-900">
              {formatTimestamp(requests.reduce((sum, r) => sum + r.timestamp, 0) / requests.length)}
            </div>
            <div className="text-xs text-gray-500">Tempo medio</div>
          </div>
        </div>
      </div>

      {/* Indicatori di trend */}
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center text-sm text-gray-600">
            <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
            <span>Permesse</span>
          </div>
          <div className="flex items-center text-sm text-gray-600">
            <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
            <span>Bloccate</span>
          </div>
        </div>
        
        {requests.length > 0 && (
          <div className="flex items-center text-sm text-gray-500">
            <Activity className="w-4 h-4 mr-1" />
            <span>
              {requests.filter(r => !r.blocked).length > requests.filter(r => r.blocked).length ? (
                <>
                  <TrendingUp className="w-4 h-4 inline mr-1 text-green-600" />
                  Maggioranza permesse
                </>
              ) : (
                <>
                  <TrendingDown className="w-4 h-4 inline mr-1 text-red-600" />
                  Maggioranza bloccate
                </>
              )}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default NetworkChart;
