import React, { useState } from 'react';
import { 
  Cookie, 
  Globe, 
  Shield, 
  Network, 
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
  Info,
  Eye,
  EyeOff
} from 'lucide-react';

interface CookieData {
  name: string;
  domain: string;
  category: 'necessary' | 'analytics' | 'marketing' | 'preferences';
  purpose: string;
  sensitive: boolean;
  expires?: string;
  size?: number;
}

interface CookieListProps {
  cookies: CookieData[];
  maxHeight?: string;
  showFilters?: boolean;
  showSearch?: boolean;
  showDetails?: boolean;
}

const CookieList: React.FC<CookieListProps> = ({
  cookies,
  maxHeight = "400px",
  showFilters = true,
  showSearch = true,
  showDetails = true
}) => {
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterSensitive, setFilterSensitive] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [sortBy, setSortBy] = useState<'name' | 'category' | 'domain'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Filtra i cookie
  const filteredCookies = cookies.filter(cookie => {
    const matchesCategory = filterCategory === 'all' || cookie.category === filterCategory;
    const matchesSensitive = filterSensitive === 'all' || 
      (filterSensitive === 'sensitive' && cookie.sensitive) ||
      (filterSensitive === 'normal' && !cookie.sensitive);
    const matchesSearch = !searchTerm || 
      cookie.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cookie.domain.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cookie.purpose.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesCategory && matchesSensitive && matchesSearch;
  });

  // Ordina i cookie
  const sortedCookies = [...filteredCookies].sort((a, b) => {
    let aValue: string;
    let bValue: string;
    
    switch (sortBy) {
      case 'name':
        aValue = a.name;
        bValue = b.name;
        break;
      case 'category':
        aValue = a.category;
        bValue = b.category;
        break;
      case 'domain':
        aValue = a.domain;
        bValue = b.domain;
        break;
      default:
        aValue = a.name;
        bValue = b.name;
    }
    
    const comparison = aValue.localeCompare(bValue);
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  // Statistiche
  const stats = {
    total: cookies.length,
    sensitive: cookies.filter(c => c.sensitive).length,
    byCategory: cookies.reduce((acc, cookie) => {
      acc[cookie.category] = (acc[cookie.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  };

  const getCategoryIcon = (category: string) => {
    const icons = {
      necessary: <Shield className="w-4 h-4" />,
      analytics: <Globe className="w-4 h-4" />,
      marketing: <Network className="w-4 h-4" />,
      preferences: <Cookie className="w-4 h-4" />
    };
    return icons[category as keyof typeof icons] || <Cookie className="w-4 h-4" />;
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      necessary: 'text-gray-600 bg-gray-100',
      analytics: 'text-blue-600 bg-blue-100',
      marketing: 'text-purple-600 bg-purple-100',
      preferences: 'text-green-600 bg-green-100'
    };
    return colors[category as keyof typeof colors] || 'text-gray-600 bg-gray-100';
  };

  const getCategoryDescription = (category: string) => {
    const descriptions = {
      necessary: 'Cookie essenziali per il funzionamento del sito',
      analytics: 'Cookie per analisi e statistiche di utilizzo',
      marketing: 'Cookie per pubblicità e marketing',
      preferences: 'Cookie per personalizzazione dell\'esperienza utente'
    };
    return descriptions[category as keyof typeof descriptions] || 'Cookie di categoria sconosciuta';
  };

  const toggleExpanded = (index: number) => {
    setExpanded(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const toggleSort = (newSortBy: 'name' | 'category' | 'domain') => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('asc');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header con statistiche */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Cookie Rilevati ({stats.total})
          </h3>
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            {Object.entries(stats.byCategory).map(([category, count]) => (
              <span key={category} className="flex items-center">
                <div className={`p-1 rounded mr-1 ${getCategoryColor(category)}`}>
                  {getCategoryIcon(category)}
                </div>
                {count} {category}
              </span>
            ))}
          </div>
        </div>
        {stats.sensitive > 0 && (
          <div className="flex items-center text-sm text-amber-600">
            <AlertTriangle className="w-4 h-4 mr-1" />
            {stats.sensitive} sensibili
          </div>
        )}
      </div>

      {/* Filtri, ricerca e ordinamento */}
      {(showFilters || showSearch) && (
        <div className="flex flex-wrap gap-4 p-4 bg-gray-50 rounded-lg">
          {showSearch && (
            <div className="flex-1 min-w-64">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Cerca per nome, dominio o scopo..."
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
                <option value="necessary">Necessari</option>
                <option value="analytics">Analytics</option>
                <option value="marketing">Marketing</option>
                <option value="preferences">Preferenze</option>
              </select>
              
              <select
                value={filterSensitive}
                onChange={(e) => setFilterSensitive(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Tutti i cookie</option>
                <option value="sensitive">Solo sensibili</option>
                <option value="normal">Solo normali</option>
              </select>
            </div>
          )}
        </div>
      )}

      {/* Ordinamento */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-500">Ordina per:</span>
          <div className="flex space-x-1">
            {(['name', 'category', 'domain'] as const).map((field) => (
              <button
                key={field}
                onClick={() => toggleSort(field)}
                className={`px-3 py-1 text-sm rounded ${
                  sortBy === field
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {field === 'name' ? 'Nome' : field === 'category' ? 'Categoria' : 'Dominio'}
                {sortBy === field && (
                  <span className="ml-1">
                    {sortOrder === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Lista cookie */}
      <div 
        className="border border-gray-200 rounded-lg overflow-hidden"
        style={{ maxHeight }}
      >
        {sortedCookies.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Filter className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>Nessun cookie trovato con i filtri attuali</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {sortedCookies.map((cookie, index) => {
              const isExpanded = expanded[index];
              
              return (
                <div key={index} className="p-4 hover:bg-gray-50 transition-colors">
                  {/* Header del cookie */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded ${getCategoryColor(cookie.category)}`}>
                        {getCategoryIcon(cookie.category)}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <div className="font-medium text-gray-900">
                            {cookie.name}
                          </div>
                          {cookie.sensitive && (
                            <div className="flex items-center text-amber-600">
                              <AlertTriangle className="w-4 h-4" />
                            </div>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">
                          {cookie.domain}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <div className={`px-2 py-1 rounded text-xs font-medium ${getCategoryColor(cookie.category)}`}>
                        {cookie.category}
                      </div>
                      
                      {showDetails && (
                        <button
                          onClick={() => toggleExpanded(index)}
                          className="p-1 hover:bg-gray-100 rounded"
                        >
                          {isExpanded ? 
                            <ChevronUp className="w-4 h-4 text-gray-400" /> : 
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          }
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {/* Dettagli espandibili */}
                  {showDetails && isExpanded && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <div className="text-sm font-medium text-gray-700 mb-2">Scopo:</div>
                          <div className="text-sm text-gray-600">{cookie.purpose}</div>
                        </div>
                        
                        <div>
                          <div className="text-sm font-medium text-gray-700 mb-2">Categoria:</div>
                          <div className="flex items-center space-x-2">
                            <div className={`px-2 py-1 rounded text-xs font-medium ${getCategoryColor(cookie.category)}`}>
                              {cookie.category}
                            </div>
                            <div className="group relative">
                              <Info className="w-4 h-4 text-gray-400 cursor-help" />
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                {getCategoryDescription(cookie.category)}
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {cookie.expires && (
                          <div>
                            <div className="text-sm font-medium text-gray-700 mb-2">Scadenza:</div>
                            <div className="text-sm text-gray-600">{cookie.expires}</div>
                          </div>
                        )}
                        
                        {cookie.size && (
                          <div>
                            <div className="text-sm font-medium text-gray-700 mb-2">Dimensione:</div>
                            <div className="text-sm text-gray-600">{cookie.size} bytes</div>
                          </div>
                        )}
                      </div>
                      
                      {cookie.sensitive && (
                        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                          <div className="flex items-center text-amber-800">
                            <AlertTriangle className="w-4 h-4 mr-2" />
                            <span className="text-sm font-medium">Cookie Sensibile</span>
                          </div>
                          <p className="text-sm text-amber-700 mt-1">
                            Questo cookie contiene informazioni sensibili e richiede particolare attenzione nella gestione del consenso.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default CookieList;
