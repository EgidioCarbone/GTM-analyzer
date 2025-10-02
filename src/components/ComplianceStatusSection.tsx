import React from 'react';
import { CheckCircle, XCircle, AlertTriangle, Shield, Globe, Network, Cookie } from 'lucide-react';

interface ComplianceCategory {
  name: 'analytics' | 'marketing' | 'preferences' | 'necessary';
  status: 'compliant' | 'non-compliant' | 'warning';
  description: string;
  details: {
    cookiesDetected: number;
    consentRespected: boolean;
    blockingWorking: boolean;
  };
}

interface ComplianceStatusSectionProps {
  categories: ComplianceCategory[];
  overallScore: number;
}

const ComplianceStatusSection: React.FC<ComplianceStatusSectionProps> = ({ 
  categories, 
  overallScore 
}) => {
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'analytics': return <Globe className="w-5 h-5" />;
      case 'marketing': return <Network className="w-5 h-5" />;
      case 'preferences': return <Shield className="w-5 h-5" />;
      case 'necessary': return <Cookie className="w-5 h-5" />;
      default: return <Cookie className="w-5 h-5" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'compliant': return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'non-compliant': return <XCircle className="w-5 h-5 text-red-600" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      default: return <CheckCircle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'compliant': return 'text-green-600 bg-green-50 border-green-200';
      case 'non-compliant': return 'text-red-600 bg-red-50 border-red-200';
      case 'warning': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getCategoryDisplayName = (category: string) => {
    switch (category) {
      case 'analytics': return 'Analytics';
      case 'marketing': return 'Marketing';
      case 'preferences': return 'Preferenze';
      case 'necessary': return 'Necessari';
      default: return category;
    }
  };

  const getOverallStatus = () => {
    const nonCompliant = categories.filter(c => c.status === 'non-compliant').length;
    const warnings = categories.filter(c => c.status === 'warning').length;
    
    if (nonCompliant > 0) return { status: 'non-compliant', text: 'NON CONFORME' };
    if (warnings > 0) return { status: 'warning', text: 'PARZIALMENTE CONFORME' };
    return { status: 'compliant', text: 'CONFORME' };
  };

  const overallStatus = getOverallStatus();

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Shield className="w-6 h-6 text-blue-600 mr-3" />
          <h2 className="text-xl font-semibold text-gray-900">Stato Conformità GDPR</h2>
        </div>
        <div className={`px-4 py-2 rounded-lg border ${getStatusColor(overallStatus.status)}`}>
          <div className="flex items-center">
            {getStatusIcon(overallStatus.status)}
            <span className="ml-2 font-medium">{overallStatus.text}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {categories.map((category) => (
          <div 
            key={category.name}
            className={`border rounded-lg p-4 ${getStatusColor(category.status)}`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center">
                {getCategoryIcon(category.name)}
                <h3 className="ml-2 font-medium text-gray-900">
                  {getCategoryDisplayName(category.name)}
                </h3>
              </div>
              {getStatusIcon(category.status)}
            </div>
            
            <p className="text-sm text-gray-700 mb-3">{category.description}</p>
            
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Cookie rilevati:</span>
                <span className="font-medium">{category.details.cookiesDetected}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Consenso rispettato:</span>
                <span className={`font-medium ${
                  category.details.consentRespected ? 'text-green-600' : 'text-red-600'
                }`}>
                  {category.details.consentRespected ? 'Sì' : 'No'}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Blocco funzionante:</span>
                <span className={`font-medium ${
                  category.details.blockingWorking ? 'text-green-600' : 'text-red-600'
                }`}>
                  {category.details.blockingWorking ? 'Sì' : 'No'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Score complessivo */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Punteggio Complessivo</span>
          <div className="flex items-center">
            <div className="w-32 bg-gray-200 rounded-full h-2 mr-3">
              <div 
                className={`h-2 rounded-full transition-all duration-300 ${
                  overallScore >= 80 ? 'bg-green-500' : 
                  overallScore >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${overallScore}%` }}
              />
            </div>
            <span className="text-lg font-bold text-gray-900">{overallScore}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComplianceStatusSection;
