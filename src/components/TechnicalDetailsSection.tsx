import React, { useState } from 'react';
import { Code, Camera, Database, Network, Eye, EyeOff } from 'lucide-react';

interface TechnicalDetailsSectionProps {
  scenarios: {
    name: string;
    data: {
      cookies: Array<{ name: string; domain: string; expires: number }>;
      gaAdsRequests: Array<{ url: string; ts: number }>;
      gtagCalls: any[];
      dataLayer: any[];
      latestConsent: any;
      artifacts?: {
        screenshotPath?: string;
        tracePath?: string;
      };
    };
  }[];
}

const TechnicalDetailsSection: React.FC<TechnicalDetailsSectionProps> = ({ scenarios }) => {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [selectedScenario, setSelectedScenario] = useState(0);

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const formatJson = (data: any) => {
    return JSON.stringify(data, null, 2);
  };

  const formatTimestamp = (ts: number) => {
    return new Date(ts).toLocaleTimeString('it-IT');
  };

  const currentScenario = scenarios[selectedScenario];

  return (
    <div className="space-y-6">
      {/* Scenario Selector */}
      <div className="flex space-x-2">
        {scenarios.map((scenario, index) => (
          <button
            key={index}
            onClick={() => setSelectedScenario(index)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedScenario === index
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {scenario.name}
          </button>
        ))}
      </div>

      {/* Current Scenario Data */}
      <div className="space-y-4">
        {/* Screenshots */}
        {currentScenario.data.artifacts?.screenshotPath && (
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center">
                <Camera className="w-5 h-5 text-gray-600 mr-2" />
                <h4 className="font-medium text-gray-900">Screenshot</h4>
              </div>
              <button
                onClick={() => toggleSection('screenshot')}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                {expandedSections.screenshot ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {expandedSections.screenshot && (
              <div className="mt-3">
                <img 
                  src={currentScenario.data.artifacts?.screenshotPath} 
                  alt="Screenshot del test"
                  className="max-w-full h-auto rounded border"
                />
              </div>
            )}
          </div>
        )}

        {/* Consent Mode State */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <Database className="w-5 h-5 text-gray-600 mr-2" />
              <h4 className="font-medium text-gray-900">Consent Mode State</h4>
            </div>
            <button
              onClick={() => toggleSection('consent')}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              {expandedSections.consent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {expandedSections.consent && (
            <div className="mt-3">
              <pre className="bg-white p-3 rounded border text-xs overflow-x-auto">
                {formatJson(currentScenario.data.latestConsent)}
              </pre>
            </div>
          )}
        </div>

        {/* Cookies */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <Code className="w-5 h-5 text-gray-600 mr-2" />
              <h4 className="font-medium text-gray-900">
                Cookie Rilevati ({currentScenario.data.cookies.length})
              </h4>
            </div>
            <button
              onClick={() => toggleSection('cookies')}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              {expandedSections.cookies ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {expandedSections.cookies && (
            <div className="mt-3">
              <div className="bg-white rounded border overflow-hidden">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Nome</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Dominio</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Scadenza</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {currentScenario.data.cookies.map((cookie, index) => (
                      <tr key={index}>
                        <td className="px-3 py-2 font-mono text-gray-900">{cookie.name}</td>
                        <td className="px-3 py-2 text-gray-700">{cookie.domain}</td>
                        <td className="px-3 py-2 text-gray-700">
                          {cookie.expires ? new Date(cookie.expires * 1000).toLocaleDateString('it-IT') : 'Session'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Network Requests */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <Network className="w-5 h-5 text-gray-600 mr-2" />
              <h4 className="font-medium text-gray-900">
                Richieste di Rete ({currentScenario.data.gaAdsRequests.length})
              </h4>
            </div>
            <button
              onClick={() => toggleSection('requests')}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              {expandedSections.requests ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {expandedSections.requests && (
            <div className="mt-3">
              <div className="bg-white rounded border overflow-hidden">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">URL</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {currentScenario.data.gaAdsRequests.map((request, index) => (
                      <tr key={index}>
                        <td className="px-3 py-2 font-mono text-gray-900 break-all">{request.url}</td>
                        <td className="px-3 py-2 text-gray-700">{formatTimestamp(request.ts)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* DataLayer Events */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <Database className="w-5 h-5 text-gray-600 mr-2" />
              <h4 className="font-medium text-gray-900">
                DataLayer Events ({currentScenario.data.dataLayer.length})
              </h4>
            </div>
            <button
              onClick={() => toggleSection('datalayer')}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              {expandedSections.datalayer ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {expandedSections.datalayer && (
            <div className="mt-3">
              <pre className="bg-white p-3 rounded border text-xs overflow-x-auto max-h-96">
                {formatJson(currentScenario.data.dataLayer)}
              </pre>
            </div>
          )}
        </div>

        {/* Gtag Calls */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <Code className="w-5 h-5 text-gray-600 mr-2" />
              <h4 className="font-medium text-gray-900">
                Gtag Calls ({currentScenario.data.gtagCalls.length})
              </h4>
            </div>
            <button
              onClick={() => toggleSection('gtag')}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              {expandedSections.gtag ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {expandedSections.gtag && (
            <div className="mt-3">
              <pre className="bg-white p-3 rounded border text-xs overflow-x-auto max-h-96">
                {formatJson(currentScenario.data.gtagCalls)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TechnicalDetailsSection;
