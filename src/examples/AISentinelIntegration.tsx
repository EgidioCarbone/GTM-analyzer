import React, { useState, useEffect } from 'react';
import ConsentReport from '../components/ConsentReport';
import { useConsentReport } from '../hooks/useConsentReport';
import { 
  ConsentReportData, 
  CookieData, 
  NetworkRequest, 
  Scenario 
} from '../types/consent-report';
import { 
  calculateOverallStatus, 
  calculateOverallScore,
  convertToCSV,
  convertToJSON 
} from '../utils/consent-report-utils';

// Interfaccia per i dati di AI Sentinel
interface AISentinelTestResult {
  siteName: string;
  testDate: string;
  scenarios: Array<{
    name: string;
    status: 'PASS' | 'FAIL';
    description: string;
    details?: any;
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
    expires?: string;
    size?: number;
  }>;
  networkRequests: Array<{
    url: string;
    domain: string;
    timestamp: number;
    category: 'analytics' | 'ads' | 'marketing' | 'other';
    blocked: boolean;
  }>;
  recommendations: string[];
  metadata?: {
    testDuration: number;
    browser: string;
    userAgent: string;
    viewport: { width: number; height: number };
    performance: {
      loadTime: number;
      domContentLoaded: number;
      firstContentfulPaint: number;
    };
  };
}

// Componente per l'integrazione con AI Sentinel
const AISentinelIntegration: React.FC = () => {
  const [testResults, setTestResults] = useState<AISentinelTestResult[]>([]);
  const [selectedTest, setSelectedTest] = useState<AISentinelTestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    data: reportData,
    updateData,
    exportData,
    overallStatus,
    overallScore
  } = useConsentReport();

  // Carica i risultati dei test da AI Sentinel
  const loadTestResults = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Simula chiamata API a AI Sentinel
      const response = await fetch('/api/ai-sentinel/test-results');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const results = await response.json();
      setTestResults(results);
      
      // Seleziona automaticamente l'ultimo test
      if (results.length > 0) {
        setSelectedTest(results[results.length - 1]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore nel caricamento dei dati');
    } finally {
      setLoading(false);
    }
  };

  // Converte i dati di AI Sentinel nel formato del report
  const convertAISentinelToReport = (aiData: AISentinelTestResult): ConsentReportData => {
    return {
      siteName: aiData.siteName,
      testDate: aiData.testDate,
      scenarios: aiData.scenarios.map(scenario => ({
        name: scenario.name,
        status: scenario.status,
        description: scenario.description
      })),
      googleConsent: aiData.googleConsent,
      cookies: aiData.cookies.map(cookie => ({
        name: cookie.name,
        domain: cookie.domain,
        category: cookie.category,
        purpose: cookie.purpose,
        sensitive: cookie.sensitive,
        expires: cookie.expires,
        size: cookie.size
      })),
      networkRequests: aiData.networkRequests.map(req => ({
        url: req.url,
        domain: req.domain,
        timestamp: req.timestamp,
        category: req.category,
        blocked: req.blocked
      })),
      recommendations: aiData.recommendations
    };
  };

  // Aggiorna il report quando cambia il test selezionato
  useEffect(() => {
    if (selectedTest) {
      const reportData = convertAISentinelToReport(selectedTest);
      updateData(reportData);
    }
  }, [selectedTest, updateData]);

  // Carica i risultati all'avvio
  useEffect(() => {
    loadTestResults();
  }, []);

  // Gestisce l'esportazione dei dati
  const handleExport = (format: 'json' | 'csv') => {
    if (!selectedTest) return;
    
    const reportData = convertAISentinelToReport(selectedTest);
    
    if (format === 'json') {
      const jsonData = convertToJSON(reportData);
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ai-sentinel-report-${selectedTest.siteName}-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (format === 'csv') {
      const csvData = convertToCSV(reportData);
      const blob = new Blob([csvData], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ai-sentinel-report-${selectedTest.siteName}-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  // Gestisce l'invio dei risultati a AI Sentinel
  const handleSendToAISentinel = async () => {
    if (!selectedTest) return;
    
    try {
      const response = await fetch('/api/ai-sentinel/send-results', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(selectedTest)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      alert('Risultati inviati con successo a AI Sentinel!');
    } catch (err) {
      alert(`Errore nell'invio: ${err instanceof Error ? err.message : 'Errore sconosciuto'}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Caricamento risultati AI Sentinel...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 mb-4">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Errore nel caricamento</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={loadTestResults}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Riprova
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header con controlli */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">AI Sentinel - Report Consenso</h1>
              <p className="text-sm text-gray-500 mt-1">
                Integrazione con il sistema di test automatici
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <select
                value={selectedTest?.siteName || ''}
                onChange={(e) => {
                  const test = testResults.find(t => t.siteName === e.target.value);
                  setSelectedTest(test || null);
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Seleziona un test...</option>
                {testResults.map((test, index) => (
                  <option key={index} value={test.siteName}>
                    {test.siteName} - {new Date(test.testDate).toLocaleDateString()}
                  </option>
                ))}
              </select>
              
              <button
                onClick={() => handleExport('json')}
                disabled={!selectedTest}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Esporta JSON
              </button>
              
              <button
                onClick={() => handleExport('csv')}
                disabled={!selectedTest}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Esporta CSV
              </button>
              
              <button
                onClick={handleSendToAISentinel}
                disabled={!selectedTest}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Invia a AI Sentinel
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Report principale */}
      {selectedTest && reportData ? (
        <ConsentReport {...reportData} />
      ) : (
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="text-center">
            <div className="text-gray-400 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Nessun test selezionato</h2>
            <p className="text-gray-600">Seleziona un test dalla lista per visualizzare il report dettagliato.</p>
          </div>
        </div>
      )}

      {/* Footer con statistiche */}
      {selectedTest && (
        <div className="bg-white border-t border-gray-200">
          <div className="max-w-6xl mx-auto px-6 py-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{overallScore}%</div>
                <div className="text-sm text-gray-500">Punteggio Complessivo</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{selectedTest.cookies.length}</div>
                <div className="text-sm text-gray-500">Cookie Rilevati</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{selectedTest.networkRequests.length}</div>
                <div className="text-sm text-gray-500">Richieste di Rete</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">
                  {selectedTest.metadata?.testDuration ? `${(selectedTest.metadata.testDuration / 1000).toFixed(1)}s` : 'N/A'}
                </div>
                <div className="text-sm text-gray-500">Durata Test</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AISentinelIntegration;
