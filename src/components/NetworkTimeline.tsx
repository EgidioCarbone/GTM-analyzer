import React, { useState } from 'react';
import { 
  Clock, 
  Eye, 
  EyeOff, 
  Globe, 
  Network, 
  Shield, 
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Filter,
  Search
} from 'lucide-react';

interface NetworkRequest {
  url: string;
  domain: string;
  timestamp: number;
  category: 'analytics' | 'ads' | 'marketing' | 'other';
  blocked: boolean;
}

interface NetworkTimelineProps {
  requests: NetworkRequest[];
  maxHeight?: string;
  showFilters?: boolean;
  showSearch?: boolean;
}

const NetworkTimeline: React.FC<NetworkTimelineProps> = ({
  requests,
  maxHeight = "400px",
  showFilters = true,
  showSearch = true
}) => {
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  // Filtra le richieste
  const filteredRequests = requests.filter(request => {
    const matchesCategory = filterCategory === 'all' || request.category === filterCategory;
    const matchesStatus = filterStatus === 'all' || 
      (filterStatus === 'blocked' && request.blocked) ||
      (filterStatus === 'allowed' && !request.blocked);
    const matchesSearch = !searchTerm || 
      request.url.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.domain.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesCategory && matchesStatus && matchesSearch;
  });

  // Ordina per timestamp
  const sortedRequests = [...filteredRequests].sort((a, b) => a.timestamp - b.timestamp);

  // Statistiche
  const stats = {
    total: requests.length,
    blocked: requests.filter(r => r.blocked).length,
    allowed: requests.filter(r => !r.blocked).length,
    byCategory: requests.reduce((acc, req) => {
      acc[req.category] = (acc[req.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  };

  const getCategoryIcon = (category: string) => {
    const icons = {
      analytics: <Globe className="w-4 h-4" />,
      ads: <Network className="w-4 h-4" />,
      marketing: <Shield className="w-4 h-4" />,
      other: <AlertTriangle className="w-4 h-4" />
    };
    return icons[category as keyof typeof icons] || <AlertTriangle className="w-4 h-4" />;
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      analytics: 'text-blue-600 bg-blue-100',
      ads: 'text-purple-600 bg-purple-100',
      marketing: 'text-orange-600 bg-orange-100',
      other: 'text-gray-600 bg-gray-100'
    };
    return colors[category as keyof typeof colors] || 'text-gray-600 bg-gray-100';
  };

  const formatTimestamp = (timestamp: number) => {
    if (timestamp < 1000) return `${timestamp}ms`;
    return `${(timestamp / 1000).toFixed(1)}s`;
  };

  const toggleExpanded = (index: number) => {
    setExpanded(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  return (
    <div className="space-y-4">
      {/* Header con statistiche */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Timeline Richieste di Rete
          </h3>
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <span className="flex items-center">
              <Eye className="w-4 h-4 mr-1 text-green-500" />
              {stats.allowed} permesse
            </span>
            <span className="flex items-center">
              <EyeOff className="w-4 h-4 mr-1 text-red-500" />
              {stats.blocked} bloccate
            </span>
          </div>
        </div>
        <div className="text-sm text-gray-500">
          Totale: {stats.total} richieste
        </div>
      </div>

      {/* Filtri e ricerca */}
      {(showFilters || showSearch) && (
        <div className="flex flex-wrap gap-4 p-4 bg-gray-50 rounded-lg">
          {showSearch && (
            <div className="flex-1 min-w-64">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Cerca per URL o dominio..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          )}
          
          {showFilters && (
            <div className="flex gap-2">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Tutte le categorie</option>
                <option value="analytics">Analytics</option>
                <option value="ads">Ads</option>
                <option value="marketing">Marketing</option>
                <option value="other">Altro</option>
              </select>
              
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Tutti gli stati</option>
                <option value="allowed">Permesse</option>
                <option value="blocked">Bloccate</option>
              </select>
            </div>
          )}
        </div>
      )}

      {/* Timeline */}
      <div 
        className="relative overflow-y-auto border border-gray-200 rounded-lg"
        style={{ maxHeight }}
      >
        {sortedRequests.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Filter className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>Nessuna richiesta trovata con i filtri attuali</p>
          </div>
        ) : (
          <div className="p-4">
            {/* Linea temporale */}
            <div className="relative">
              <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200"></div>
              
              {sortedRequests.map((request, index) => {
                const isExpanded = expanded[index];
                const isLast = index === sortedRequests.length - 1;
                
                return (
                  <div key={index} className="relative flex items-start mb-4">
                    {/* Punto temporale */}
                    <div className={`relative z-10 flex items-center justify-center w-12 h-12 rounded-full border-2 ${
                      request.blocked 
                        ? 'bg-red-50 border-red-200' 
                        : 'bg-green-50 border-green-200'
                    }`}>
                      {request.blocked ? 
                        <EyeOff className="w-5 h-5 text-red-500" /> : 
                        <Eye className="w-5 h-5 text-green-500" />
                      }
                    </div>
                    
                    {/* Contenuto */}
                    <div className="flex-1 ml-4">
                      <div className={`p-4 rounded-lg border ${
                        request.blocked 
                          ? 'bg-red-50 border-red-200' 
                          : 'bg-white border-gray-200'
                      }`}>
                        {/* Header della richiesta */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className={`p-1 rounded ${getCategoryColor(request.category)}`}>
                              {getCategoryIcon(request.category)}
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">
                                {request.domain}
                              </div>
                              <div className="text-sm text-gray-500">
                                {request.category}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <div className="flex items-center text-sm text-gray-500">
                              <Clock className="w-4 h-4 mr-1" />
                              {formatTimestamp(request.timestamp)}
                            </div>
                            
                            <button
                              onClick={() => toggleExpanded(index)}
                              className="p-1 hover:bg-gray-100 rounded"
                            >
                              {isExpanded ? 
                                <ChevronUp className="w-4 h-4 text-gray-400" /> : 
                                <ChevronDown className="w-4 h-4 text-gray-400" />
                              }
                            </button>
                          </div>
                        </div>
                        
                        {/* URL completo (espandibile) */}
                        {isExpanded && (
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <div className="text-sm">
                              <div className="font-medium text-gray-700 mb-1">URL completo:</div>
                              <div className="font-mono text-xs bg-gray-100 p-2 rounded break-all">
                                {request.url}
                              </div>
                            </div>
                            
                            {/* Dettagli aggiuntivi */}
                            <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <div className="font-medium text-gray-700">Stato:</div>
                                <div className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                                  request.blocked 
                                    ? 'bg-red-100 text-red-800' 
                                    : 'bg-green-100 text-green-800'
                                }`}>
                                  {request.blocked ? 'Bloccata' : 'Permessa'}
                                </div>
                              </div>
                              <div>
                                <div className="font-medium text-gray-700">Categoria:</div>
                                <div className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getCategoryColor(request.category)}`}>
                                  {request.category}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NetworkTimeline;
