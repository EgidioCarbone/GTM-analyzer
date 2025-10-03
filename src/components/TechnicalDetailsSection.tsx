import React, { useMemo, useState } from 'react';
import { Code, Camera, Database, Network, Eye, EyeOff } from 'lucide-react';
import { getApiBaseUrl, resolveScreenshotUrl } from '../utils/api-base';

interface TechnicalDetailsSectionProps {
  scenarios: {
    name: string;
      data: {
        cookies: Array<{ name: string; domain: string; expires: number }>;
        gaAdsRequests: Array<{ url: string; ts: number }>;
        gtagCalls: any[];
        dataLayer: any[];
        dataLayerSnapshot?: any[];
        latestConsent: any;
        artifacts?: {
          screenshotPath?: string;
          screenshotDataUrl?: string;
          tracePath?: string;
      };
    };
  }[];
}

const TechnicalDetailsSection: React.FC<TechnicalDetailsSectionProps> = ({ scenarios }) => {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [selectedScenario, setSelectedScenario] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

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

  const apiBaseUrl = useMemo(() => getApiBaseUrl(), []);
  const currentScenario = scenarios[selectedScenario];
  const screenshotArtifacts = useMemo(() => {
    const withScreenshot = scenarios.find(s => s.data.artifacts?.screenshotDataUrl || s.data.artifacts?.screenshotPath);
    return withScreenshot?.data.artifacts;
  }, [scenarios]);

  return (
    <div className="space-y-6">
      {/* Screenshot card */}
      {screenshotArtifacts && (() => {
        const rawImage = screenshotArtifacts.screenshotDataUrl || screenshotArtifacts.screenshotPath || '';
        const imageSource = resolveScreenshotUrl(rawImage, apiBaseUrl);

        return (
          <div className="bg-gray-100 rounded-xl p-4">
            <div className="flex items-center space-x-2 mb-3">
              <Camera className="w-5 h-5 text-gray-600" />
              <h4 className="font-medium text-gray-900">Screenshot Cookie Banner</h4>
            </div>
            <button
              type="button"
              onClick={() => setPreviewUrl(imageSource)}
              className="w-full max-w-2xl mx-auto block focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <img
                src={imageSource}
                alt="Screenshot del cookie banner"
                className="w-full rounded-lg border border-gray-200 shadow-sm hover:shadow-lg transition-shadow"
              />
            </button>
          </div>
        );
      })()}

      {/* Scenario Selector */}
        <div className="flex flex-wrap justify-center gap-2">
          {scenarios.map((scenario, index) => (
            <button
              key={index}
              onClick={() => setSelectedScenario(index)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              selectedScenario === index
                ? 'bg-blue-600 text-white shadow'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {scenario.name}
          </button>
        ))}
      </div>

      {/* Current Scenario Data */}
      <div className="space-y-4">
        {/* DataLayer Snapshot */}
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

        {/* DataLayer Snapshot */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <Code className="w-5 h-5 text-gray-600 mr-2" />
              <h4 className="font-medium text-gray-900">
                DataLayer Snapshot ({currentScenario.data.dataLayerSnapshot?.length ?? 0})
              </h4>
            </div>
            <button
              onClick={() => toggleSection('datalayerSnapshot')}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              {expandedSections.datalayerSnapshot ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {expandedSections.datalayerSnapshot && (
            <div className="mt-3">
              {currentScenario.data.dataLayerSnapshot && currentScenario.data.dataLayerSnapshot.length > 0 ? (
                <pre className="bg-white p-3 rounded border text-xs overflow-x-auto max-h-64">
                  {JSON.stringify(currentScenario.data.dataLayerSnapshot, null, 2)}
                </pre>
              ) : (
                <p className="text-sm text-gray-600">Nessun dato dataLayer disponibile</p>
              )}
            </div>
          )}
        </div>
      </div>

      {previewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setPreviewUrl(null)}
        >
          <div className="max-w-4xl w-full px-6" onClick={(e) => e.stopPropagation()}>
            <div className="bg-white rounded-xl shadow-xl overflow-hidden relative">
              <button
                type="button"
                className="absolute top-3 right-3 text-2xl leading-none text-gray-500 hover:text-gray-800"
                onClick={() => setPreviewUrl(null)}
                aria-label="Chiudi anteprima"
              >
                ×
              </button>
              <img src={previewUrl} alt="Anteprima cookie banner" className="w-full h-auto" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TechnicalDetailsSection;
