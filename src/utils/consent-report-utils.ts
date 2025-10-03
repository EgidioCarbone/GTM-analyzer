// Utilità per il sistema di report consenso

import { 
  ConsentReportData, 
  ConsentReportStats, 
  CookieData, 
  NetworkRequest, 
  CookieCategory, 
  NetworkCategory,
  TestStatus 
} from '../types/consent-report';

/**
 * Calcola lo stato generale del report basato sui scenari
 */
export const calculateOverallStatus = (scenarios: Array<{ status: TestStatus }>): TestStatus => {
  return scenarios.every(s => s.status === 'PASS') ? 'PASS' : 'FAIL';
};

/**
 * Calcola il punteggio percentuale del report
 */
export const calculateOverallScore = (scenarios: Array<{ status: TestStatus; score?: number; weight?: number }>): number => {
  if (scenarios.length === 0) return 0;

  const totalWeightedScore = scenarios.reduce((sum, scenario) => {
    const weight = typeof scenario.weight === 'number' ? scenario.weight : 1;
    const score = typeof scenario.score === 'number'
      ? scenario.score
      : (scenario.status === 'PASS' ? 100 : 0);
    return sum + score * weight;
  }, 0);

  const totalWeight = scenarios.reduce((sum, scenario) => sum + (typeof scenario.weight === 'number' ? scenario.weight : 1), 0);
  if (totalWeight === 0) return 0;

  return Math.round(totalWeightedScore / totalWeight);
};

/**
 * Calcola le statistiche sui cookie
 */
export const calculateCookieStats = (cookies: CookieData[]) => {
  const byCategory = cookies.reduce((acc, cookie) => {
    acc[cookie.category] = (acc[cookie.category] || 0) + 1;
    return acc;
  }, {} as Record<CookieCategory, number>);

  return {
    total: cookies.length,
    byCategory,
    sensitive: cookies.filter(c => c.sensitive).length
  };
};

/**
 * Calcola le statistiche sulle richieste di rete
 */
export const calculateNetworkStats = (requests: NetworkRequest[]) => {
  const byCategory = requests.reduce((acc, req) => {
    acc[req.category] = (acc[req.category] || 0) + 1;
    return acc;
  }, {} as Record<NetworkCategory, number>);

  return {
    total: requests.length,
    blocked: requests.filter(r => r.blocked).length,
    byCategory
  };
};

/**
 * Filtra i cookie per categoria
 */
export const filterCookiesByCategory = (cookies: CookieData[], category: CookieCategory): CookieData[] => {
  return cookies.filter(cookie => cookie.category === category);
};

/**
 * Filtra le richieste di rete per categoria
 */
export const filterNetworkRequestsByCategory = (requests: NetworkRequest[], category: NetworkCategory): NetworkRequest[] => {
  return requests.filter(req => req.category === category);
};

/**
 * Filtra le richieste bloccate
 */
export const getBlockedRequests = (requests: NetworkRequest[]): NetworkRequest[] => {
  return requests.filter(req => req.blocked);
};

/**
 * Filtra le richieste permesse
 */
export const getAllowedRequests = (requests: NetworkRequest[]): NetworkRequest[] => {
  return requests.filter(req => !req.blocked);
};

/**
 * Ordina i cookie per un campo specifico
 */
export const sortCookies = (cookies: CookieData[], field: keyof CookieData, order: 'asc' | 'desc' = 'asc'): CookieData[] => {
  return [...cookies].sort((a, b) => {
    const aValue = a[field];
    const bValue = b[field];
    
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      const comparison = aValue.localeCompare(bValue);
      return order === 'asc' ? comparison : -comparison;
    }
    
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return order === 'asc' ? aValue - bValue : bValue - aValue;
    }
    
    return 0;
  });
};

/**
 * Ordina le richieste di rete per timestamp
 */
export const sortNetworkRequestsByTime = (requests: NetworkRequest[], order: 'asc' | 'desc' = 'asc'): NetworkRequest[] => {
  return [...requests].sort((a, b) => {
    return order === 'asc' ? a.timestamp - b.timestamp : b.timestamp - a.timestamp;
  });
};

/**
 * Formatta il timestamp in formato leggibile
 */
export const formatTimestamp = (timestamp: number): string => {
  if (timestamp < 1000) return `${timestamp}ms`;
  return `${(timestamp / 1000).toFixed(1)}s`;
};

/**
 * Formatta la data in formato locale
 */
export const formatDate = (dateString: string, locale: string = 'it-IT'): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * Genera un colore per una categoria
 */
export const getCategoryColor = (category: string): { text: string; bg: string } => {
  const colors = {
    necessary: { text: 'text-gray-600', bg: 'bg-gray-100' },
    analytics: { text: 'text-blue-600', bg: 'bg-blue-100' },
    marketing: { text: 'text-purple-600', bg: 'bg-purple-100' },
    preferences: { text: 'text-green-600', bg: 'bg-green-100' },
    ads: { text: 'text-orange-600', bg: 'bg-orange-100' },
    other: { text: 'text-gray-600', bg: 'bg-gray-100' }
  };
  
  return colors[category as keyof typeof colors] || colors.other;
};

/**
 * Genera una descrizione per una categoria di cookie
 */
export const getCookieCategoryDescription = (category: CookieCategory): string => {
  const descriptions = {
    necessary: 'Cookie essenziali per il funzionamento del sito',
    analytics: 'Cookie per analisi e statistiche di utilizzo',
    marketing: 'Cookie per pubblicità e marketing',
    preferences: 'Cookie per personalizzazione dell\'esperienza utente'
  };
  
  return descriptions[category];
};

/**
 * Genera una descrizione per una categoria di richieste di rete
 */
export const getNetworkCategoryDescription = (category: NetworkCategory): string => {
  const descriptions = {
    analytics: 'Richieste per servizi di analisi e statistiche',
    ads: 'Richieste per servizi pubblicitari',
    marketing: 'Richieste per servizi di marketing e remarketing',
    other: 'Altre richieste di rete'
  };
  
  return descriptions[category];
};

/**
 * Valida i dati del report
 */
export const validateReportData = (data: Partial<ConsentReportData>): string[] => {
  const errors: string[] = [];
  
  if (!data.siteName) errors.push('Nome del sito mancante');
  if (!data.testDate) errors.push('Data del test mancante');
  if (!data.scenarios || data.scenarios.length === 0) errors.push('Scenari mancanti');
  if (!data.googleConsent) errors.push('Dati Google Consent Mode mancanti');
  if (!data.cookies) errors.push('Dati cookie mancanti');
  if (!data.networkRequests) errors.push('Dati richieste di rete mancanti');
  if (!data.recommendations) errors.push('Raccomandazioni mancanti');
  
  return errors;
};

/**
 * Genera un ID univoco per un elemento
 */
export const generateId = (prefix: string = 'id'): string => {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Debounce function per ottimizzare le ricerche
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

/**
 * Throttle function per limitare la frequenza delle chiamate
 */
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

/**
 * Copia il testo negli appunti
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    // Fallback per browser più vecchi
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textArea);
    return success;
  }
};

/**
 * Scarica un file
 */
export const downloadFile = (content: string, filename: string, mimeType: string = 'text/plain'): void => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Converte i dati del report in formato CSV
 */
export const convertToCSV = (data: ConsentReportData): string => {
  const rows: string[] = [];
  
  // Header principale
  rows.push('Site Name,Test Date,Overall Status,Score');
  rows.push(`${data.siteName},${data.testDate},${calculateOverallStatus(data.scenarios)},${calculateOverallScore(data.scenarios)}`);
  rows.push('');
  
  // Scenari
  rows.push('Scenarios');
  rows.push('Name,Status,Description');
  data.scenarios.forEach(scenario => {
    rows.push(`"${scenario.name}","${scenario.status}","${scenario.description}"`);
  });
  rows.push('');
  
  // Google Consent
  rows.push('Google Consent');
  rows.push('Category,Status');
  Object.entries(data.googleConsent).forEach(([key, value]) => {
    rows.push(`"${key}","${value}"`);
  });
  rows.push('');
  
  // Cookie
  rows.push('Cookies');
  rows.push('Name,Domain,Category,Purpose,Sensitive,Expires,Size');
  data.cookies.forEach(cookie => {
    rows.push(`"${cookie.name}","${cookie.domain}","${cookie.category}","${cookie.purpose}","${cookie.sensitive}","${cookie.expires || ''}","${cookie.size || ''}"`);
  });
  rows.push('');
  
  // Network Requests
  rows.push('Network Requests');
  rows.push('URL,Domain,Timestamp,Category,Blocked');
  data.networkRequests.forEach(req => {
    rows.push(`"${req.url}","${req.domain}","${req.timestamp}","${req.category}","${req.blocked}"`);
  });
  
  return rows.join('\n');
};

/**
 * Converte i dati del report in formato JSON
 */
export const convertToJSON = (data: ConsentReportData): string => {
  return JSON.stringify(data, null, 2);
};

/**
 * Calcola la dimensione approssimativa dei dati
 */
export const calculateDataSize = (data: ConsentReportData): string => {
  const jsonString = JSON.stringify(data);
  const bytes = new Blob([jsonString]).size;
  
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/**
 * Genera un hash semplice per i dati
 */
export const generateDataHash = (data: ConsentReportData): string => {
  const jsonString = JSON.stringify(data);
  let hash = 0;
  
  for (let i = 0; i < jsonString.length; i++) {
    const char = jsonString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return Math.abs(hash).toString(36);
};

/**
 * Confronta due report per trovare le differenze
 */
export const compareReports = (report1: ConsentReportData, report2: ConsentReportData): {
  scenarios: Array<{ field: string; old: any; new: any }>;
  cookies: Array<{ field: string; old: any; new: any }>;
  networkRequests: Array<{ field: string; old: any; new: any }>;
} => {
  const differences = {
    scenarios: [] as Array<{ field: string; old: any; new: any }>,
    cookies: [] as Array<{ field: string; old: any; new: any }>,
    networkRequests: [] as Array<{ field: string; old: any; new: any }>
  };
  
  // Confronta scenari
  report1.scenarios.forEach((scenario1, index) => {
    const scenario2 = report2.scenarios[index];
    if (scenario2) {
      if (scenario1.status !== scenario2.status) {
        differences.scenarios.push({
          field: `scenario_${index}_status`,
          old: scenario1.status,
          new: scenario2.status
        });
      }
    }
  });
  
  // Confronta cookie
  const cookies1Map = new Map(report1.cookies.map(c => [c.name, c]));
  const cookies2Map = new Map(report2.cookies.map(c => [c.name, c]));
  
  [...cookies1Map.keys(), ...cookies2Map.keys()].forEach(name => {
    const cookie1 = cookies1Map.get(name);
    const cookie2 = cookies2Map.get(name);
    
    if (!cookie1) {
      differences.cookies.push({
        field: `cookie_${name}_added`,
        old: null,
        new: cookie2
      });
    } else if (!cookie2) {
      differences.cookies.push({
        field: `cookie_${name}_removed`,
        old: cookie1,
        new: null
      });
    } else {
      // Confronta proprietà del cookie
      Object.keys(cookie1).forEach(key => {
        if (cookie1[key as keyof CookieData] !== cookie2[key as keyof CookieData]) {
          differences.cookies.push({
            field: `cookie_${name}_${key}`,
            old: cookie1[key as keyof CookieData],
            new: cookie2[key as keyof CookieData]
          });
        }
      });
    }
  });
  
  return differences;
};
