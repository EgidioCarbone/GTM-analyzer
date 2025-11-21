import React, { useState } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Info, 
  ChevronDown, 
  ChevronUp,
  Globe,
  Shield,
  Clock,
  Network,
  Cookie,
  Eye,
  EyeOff,
  Download,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Activity,
  FileText,
  Settings,
  Users
} from 'lucide-react';
import SummaryBox from './SummaryBox';
import TestTimeline from './TestTimeline';
import ScenarioCard from './ScenarioCard';
import NetworkChart from './NetworkChart';

interface ConsentDashboardProps {
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

const ConsentDashboard: React.FC<ConsentDashboardProps> = ({
  siteName,
  testDate,
  scenarios,
  googleConsent,
  cookies,
  networkRequests,
  recommendations
}) => {
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({});
  const [expandedUrls, setExpandedUrls] = useState<Record<string, boolean>>({});

  const toggleDetails = (key: string) => {
    setExpandedDetails(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleUrls = (key: string) => {
    setExpandedUrls(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Calcoli per la dashboard
  const overallStatus = scenarios.every(s => s.status === 'PASS') ? 'PASS' : 'FAIL';
  const overallScore = Math.round((scenarios.filter(s => s.status === 'PASS').length / scenarios.length) * 100);
  
  const sensitiveCookies = cookies.filter(c => c.sensitive);
  const analyticsRequests = networkRequests.filter(r => r.category === 'analytics');
  const adsRequests = networkRequests.filter(r => r.category === 'ads');
  const blockedRequests = networkRequests.filter(r => r.blocked);

  // Timeline steps
  const timelineSteps = [
    { id: 'banner', label: 'Banner', icon: Shield, status: 'completed' },
    { id: 'scenario', label: 'Scenario', icon: Settings, status: 'completed' },
    { id: 'consent', label: 'Consent', icon: Users, status: 'completed' },
    { id: 'cookie', label: 'Cookie', icon: Cookie, status: 'completed' },
    { id: 'tracking', label: 'Tracking', icon: Activity, status: 'completed' }
  ];

  const getStatusIcon = (status: 'PASS' | 'FAIL') => {
    return status === 'PASS' ? 
      <CheckCircle className="w-5 h-5 text-green-600" /> : 
      <XCircle className="w-5 h-5 text-red-600" />;
  };

  const getConsentBadge = (value: 'granted' | 'denied') => {
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        value === 'granted' 
          ? 'bg-green-100 text-green-800 border border-green-200' 
          : 'bg-red-100 text-red-800 border border-red-200'
      }`}>
        {value === 'granted' ? <CheckCircle className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
        {value}
      </span>
    );
  };

  const getCategoryIcon = (category: string) => {
    const icons = {
      analytics: <Globe className="w-4 h-4" />,
      marketing: <Network className="w-4 h-4" />,
      preferences: <Shield className="w-4 h-4" />,
      necessary: <Cookie className="w-4 h-4" />
    };
    return icons[category as keyof typeof icons] || <Cookie className="w-4 h-4" />;
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      analytics: 'text-blue-600 bg-blue-50 border-blue-200',
      marketing: 'text-purple-600 bg-purple-50 border-purple-200',
      preferences: 'text-green-600 bg-green-50 border-green-200',
      necessary: 'text-gray-600 bg-gray-50 border-gray-200'
    };
    return colors[category as keyof typeof colors] || 'text-gray-600 bg-gray-50 border-gray-200';
  };

  const formatTimestamp = (timestamp: number) => {
    if (timestamp < 1000) return `${timestamp}ms`;
    return `${(timestamp / 1000).toFixed(1)}s`;
  };

  // Timeline steps per il componente TestTimeline
  const timelineSteps = [
    { id: 'banner', label: 'Banner', icon: Shield, status: 'completed' as const, duration: 1200, details: 'Banner di consenso rilevato' },
    { id: 'scenario', label: 'Scenario', icon: Settings, status: 'completed' as const, duration: 800, details: 'Scenario di test eseguito' },
    { id: 'consent', label: 'Consent', icon: Users, status: 'completed' as const, duration: 1500, details: 'Consenso configurato' },
    { id: 'cookie', label: 'Cookie', icon: Cookie, status: 'completed' as const, duration: 600, details: 'Cookie analizzati' },
    { id: 'tracking', label: 'Tracking', icon: Activity, status: 'completed' as const, duration: 2000, details: 'Richieste di rete monitorate' }
  ];

  const totalDuration = timelineSteps.reduce((sum, step) => sum + (step.duration || 0), 0);

  const handleDownloadPDF = () => {
    // Implementazione download PDF
    console.log('Download PDF triggered');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Box di sintesi in alto */}
      <SummaryBox
        siteName={siteName}
        testDate={testDate}
        overallStatus={overallStatus}
        overallScore={overallScore}
        totalScenarios={scenarios.length}
        passedScenarios={scenarios.filter(s => s.status === 'PASS').length}
        totalCookies={cookies.length}
        sensitiveCookies={sensitiveCookies.length}
        totalRequests={networkRequests.length}
        blockedRequests={blockedRequests.length}
        testDuration={totalDuration}
        onDownloadPDF={handleDownloadPDF}
      />

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Timeline laterale */}
          <div className="lg:col-span-1">
            <TestTimeline steps={timelineSteps} totalDuration={totalDuration} />
          </div>

          {/* Contenuto principale */}
          <div className="lg:col-span-3 space-y-8">
            {/* Cards degli scenari */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Scenari di Test</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {scenarios.map((scenario, index) => (
                  <ScenarioCard
                    key={index}
                    scenario={scenario}
                    index={index}
                    totalCookies={cookies.length}
                    totalRequests={networkRequests.length}
                    duration={2.3}
                    blockedRequests={blockedRequests.length}
                  />
                ))}
              </div>
            </div>

            {/* Google Consent Mode */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Google Consent Mode</h2>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                  <div className="flex items-center">
                    <Globe className="w-5 h-5 text-blue-600 mr-2" />
                    <span className="font-medium text-gray-900">Stato delle Categorie di Consenso</span>
                  </div>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(googleConsent).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center">
                          <span className="text-sm font-medium text-gray-700 capitalize">
                            {key.replace(/_/g, ' ')}
                          </span>
                          <div className="ml-2 group relative">
                            <Info className="w-3 h-3 text-gray-400 cursor-help" />
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                              {key === 'analytics_storage' && 'Consenso per cookie di analytics (es. _ga)'}
                              {key === 'ad_storage' && 'Consenso per cookie pubblicitari'}
                              {key === 'ad_user_data' && 'Consenso per dati utente per advertising'}
                              {key === 'ad_personalization' && 'Consenso per personalizzazione pubblicitaria'}
                              {key === 'functionality_storage' && 'Consenso per cookie funzionali'}
                              {key === 'personalization_storage' && 'Consenso per cookie di personalizzazione'}
                              {key === 'security_storage' && 'Consenso per cookie di sicurezza'}
                            </div>
                          </div>
                        </div>
                        {getConsentBadge(value)}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Cookie Sensibili */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Cookie Sensibili</h2>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Cookie className="w-5 h-5 text-amber-600 mr-2" />
                      <span className="font-medium text-gray-900">Cookie che Richiedono Attenzione</span>
                    </div>
                    <span className="text-sm text-gray-500">{sensitiveCookies.length} cookie sensibili</span>
                  </div>
                </div>
                <div className="p-6">
                  {sensitiveCookies.length > 0 ? (
                    <div className="space-y-3">
                      {sensitiveCookies.map((cookie, index) => (
                        <div key={index} className="flex items-center justify-between py-3 px-4 bg-red-50 border border-red-200 rounded-lg">
                          <div className="flex items-center">
                            <AlertTriangle className="w-4 h-4 text-red-600 mr-3" />
                            <div>
                              <div className="font-medium text-gray-900">{cookie.name}</div>
                              <div className="text-sm text-gray-600">{cookie.domain}</div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${getCategoryColor(cookie.category)}`}>
                              {cookie.category}
                            </span>
                            <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-medium">
                              Sensibile
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
                      <p className="text-gray-600">Nessun cookie sensibile rilevato</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Richieste GA/Ads con grafici */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Richieste di Rete</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <NetworkChart
                  requests={analyticsRequests}
                  title="Google Analytics"
                  category="analytics"
                  color="bg-blue-100"
                  icon={Globe}
                />
                <NetworkChart
                  requests={adsRequests}
                  title="Pubblicità"
                  category="ads"
                  color="bg-purple-100"
                  icon={Network}
                />
              </div>
            </div>

            {/* Raccomandazioni */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Raccomandazioni</h2>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="space-y-4">
                  {recommendations.map((recommendation, index) => (
                    <div key={index} className="flex items-start p-4 bg-gray-50 rounded-lg">
                      <div className="flex-shrink-0">
                        {overallStatus === 'PASS' ? 
                          <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" /> : 
                          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                        }
                      </div>
                      <div className="ml-3">
                        <p className="text-sm text-gray-700 leading-relaxed">{recommendation}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConsentDashboard;
// @ts-nocheck
