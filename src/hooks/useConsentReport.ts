import { useState, useEffect } from 'react';

export interface ConsentReportData {
  siteName: string;
  testDate: string;
  scenarios: Array<{
    name: string;
    status: 'PASS' | 'FAIL';
    description: string;
  }>;
  googleConsent: {
    analytics_storage: 'granted' | 'denied';
    ad_storage: 'granted' | 'denied';
    ad_user_data: 'granted' | 'denied';
    ad_personalization: 'granted' | 'denied';
    functionality_storage: 'granted' | 'denied';
    personalization_storage: 'granted' | 'denied';
    security_storage: 'granted' | 'denied';
  };
  cookies: Array<{
    name: string;
    domain: string;
    category: 'necessary' | 'analytics' | 'marketing' | 'preferences';
    purpose: string;
    sensitive: boolean;
  }>;
  networkRequests: Array<{
    url: string;
    domain: string;
    timestamp: number;
    category: 'analytics' | 'ads' | 'marketing' | 'other';
    blocked: boolean;
  }>;
  recommendations: string[];
}

export interface UseConsentReportOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
  onDataChange?: (data: ConsentReportData) => void;
}

export const useConsentReport = (
  initialData?: ConsentReportData,
  options: UseConsentReportOptions = {}
) => {
  const [data, setData] = useState<ConsentReportData | null>(initialData || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    googleConsent: true,
    cookies: true,
    networkRequests: false,
    recommendations: true
  });

  const { autoRefresh = false, refreshInterval = 30000, onDataChange } = options;

  // Funzione per calcolare lo stato generale
  const getOverallStatus = (): 'PASS' | 'FAIL' => {
    if (!data) return 'FAIL';
    return data.scenarios.every(s => s.status === 'PASS') ? 'PASS' : 'FAIL';
  };

  // Funzione per calcolare il punteggio percentuale
  const getOverallScore = (): number => {
    if (!data) return 0;
    return Math.round((data.scenarios.filter(s => s.status === 'PASS').length / data.scenarios.length) * 100);
  };

  // Funzione per ottenere statistiche sui cookie
  const getCookieStats = () => {
    if (!data) return { total: 0, byCategory: {}, sensitive: 0 };
    
    const byCategory = data.cookies.reduce((acc, cookie) => {
      acc[cookie.category] = (acc[cookie.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total: data.cookies.length,
      byCategory,
      sensitive: data.cookies.filter(c => c.sensitive).length
    };
  };

  // Funzione per ottenere statistiche sulle richieste di rete
  const getNetworkStats = () => {
    if (!data) return { total: 0, blocked: 0, byCategory: {} };
    
    const byCategory = data.networkRequests.reduce((acc, req) => {
      acc[req.category] = (acc[req.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total: data.networkRequests.length,
      blocked: data.networkRequests.filter(r => r.blocked).length,
      byCategory
    };
  };

  // Funzione per filtrare i cookie per categoria
  const getCookiesByCategory = (category: string) => {
    if (!data) return [];
    return data.cookies.filter(cookie => cookie.category === category);
  };

  // Funzione per filtrare le richieste di rete per categoria
  const getNetworkRequestsByCategory = (category: string) => {
    if (!data) return [];
    return data.networkRequests.filter(req => req.category === category);
  };

  // Funzione per ottenere le richieste bloccate
  const getBlockedRequests = () => {
    if (!data) return [];
    return data.networkRequests.filter(req => req.blocked);
  };

  // Funzione per ottenere le richieste permesse
  const getAllowedRequests = () => {
    if (!data) return [];
    return data.networkRequests.filter(req => !req.blocked);
  };

  // Funzione per aggiornare i dati
  const updateData = (newData: ConsentReportData) => {
    setData(newData);
    setError(null);
    onDataChange?.(newData);
  };

  // Funzione per caricare i dati da un'API
  const loadData = async (url: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const newData = await response.json();
      updateData(newData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nel caricamento dei dati');
    } finally {
      setLoading(false);
    }
  };

  // Funzione per esportare i dati
  const exportData = (format: 'json' | 'csv' = 'json') => {
    if (!data) return;

    if (format === 'json') {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `consent-report-${data.siteName}-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (format === 'csv') {
      // Implementazione CSV semplificata
      const csvContent = [
        ['Site Name', 'Test Date', 'Overall Status', 'Score'],
        [data.siteName, data.testDate, getOverallStatus(), getOverallScore().toString()],
        [],
        ['Scenarios'],
        ['Name', 'Status', 'Description'],
        ...data.scenarios.map(s => [s.name, s.status, s.description]),
        [],
        ['Google Consent'],
        ['Category', 'Status'],
        ...Object.entries(data.googleConsent).map(([key, value]) => [key, value]),
        [],
        ['Cookies'],
        ['Name', 'Domain', 'Category', 'Purpose', 'Sensitive'],
        ...data.cookies.map(c => [c.name, c.domain, c.category, c.purpose, c.sensitive.toString()])
      ].map(row => row.join(',')).join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `consent-report-${data.siteName}-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  // Funzione per toggle delle sezioni
  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Funzione per espandere/collassare tutte le sezioni
  const toggleAllSections = (expand: boolean) => {
    const newState = Object.keys(expandedSections).reduce((acc, key) => {
      acc[key] = expand;
      return acc;
    }, {} as Record<string, boolean>);
    setExpandedSections(newState);
  };

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefresh || !data) return;

    const interval = setInterval(() => {
      // Qui potresti implementare un refresh automatico dei dati
      // loadData('/api/consent-report');
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, data]);

  return {
    // Data
    data,
    loading,
    error,
    
    // State
    expandedSections,
    
    // Computed values
    overallStatus: getOverallStatus(),
    overallScore: getOverallScore(),
    cookieStats: getCookieStats(),
    networkStats: getNetworkStats(),
    
    // Filtered data
    cookiesByCategory: getCookiesByCategory,
    networkRequestsByCategory: getNetworkRequestsByCategory,
    blockedRequests: getBlockedRequests(),
    allowedRequests: getAllowedRequests(),
    
    // Actions
    updateData,
    loadData,
    exportData,
    toggleSection,
    toggleAllSections,
    
    // Utilities
    setData,
    setLoading,
    setError
  };
};
