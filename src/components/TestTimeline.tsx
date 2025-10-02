import React from 'react';
import { 
  Shield, 
  Settings, 
  Users, 
  Cookie, 
  Activity,
  CheckCircle,
  Clock,
  AlertTriangle
} from 'lucide-react';

interface TimelineStep {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  status: 'completed' | 'in-progress' | 'pending' | 'error';
  duration?: number;
  details?: string;
}

interface TestTimelineProps {
  steps: TimelineStep[];
  totalDuration: number;
}

const TestTimeline: React.FC<TestTimelineProps> = ({ steps, totalDuration }) => {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'in-progress':
        return <Clock className="w-5 h-5 text-blue-600" />;
      case 'error':
        return <AlertTriangle className="w-5 h-5 text-red-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-600 border-green-200';
      case 'in-progress':
        return 'bg-blue-100 text-blue-600 border-blue-200';
      case 'error':
        return 'bg-red-100 text-red-600 border-red-200';
      default:
        return 'bg-gray-100 text-gray-400 border-gray-200';
    }
  };

  const formatDuration = (duration: number) => {
    if (duration < 1000) return `${duration}ms`;
    return `${(duration / 1000).toFixed(1)}s`;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Processo di Test</h3>
        <div className="text-right">
          <div className="text-sm font-medium text-gray-900">
            {formatDuration(totalDuration)}
          </div>
          <div className="text-xs text-gray-500">Durata totale</div>
        </div>
      </div>

      <div className="relative">
        {/* Linea verticale */}
        <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200"></div>
        
        <div className="space-y-6">
          {steps.map((step, index) => (
            <div key={step.id} className="relative flex items-start">
              {/* Icona del passo */}
              <div className={`relative z-10 w-10 h-10 rounded-full border-2 flex items-center justify-center ${getStatusColor(step.status)}`}>
                <step.icon className="w-5 h-5" />
              </div>
              
              {/* Contenuto del passo */}
              <div className="ml-4 flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium text-gray-900">{step.label}</h4>
                    {step.details && (
                      <p className="text-xs text-gray-500 mt-1">{step.details}</p>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    {step.duration && (
                      <span className="text-xs text-gray-500">
                        {formatDuration(step.duration)}
                      </span>
                    )}
                    {getStatusIcon(step.status)}
                  </div>
                </div>
                
                {/* Barra di progresso per il passo corrente */}
                {step.status === 'in-progress' && (
                  <div className="mt-2">
                    <div className="w-full bg-gray-200 rounded-full h-1">
                      <div className="bg-blue-600 h-1 rounded-full animate-pulse" style={{ width: '60%' }}></div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Statistiche riassuntive */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-lg font-semibold text-green-600">
              {steps.filter(s => s.status === 'completed').length}
            </div>
            <div className="text-xs text-gray-500">Completati</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-gray-900">
              {steps.filter(s => s.status === 'error').length}
            </div>
            <div className="text-xs text-gray-500">Errori</div>
          </div>
        </div>
      </div>

      {/* Indicatori di stato */}
      <div className="mt-4 flex items-center justify-between text-xs">
        <div className="flex items-center space-x-4">
          <div className="flex items-center">
            <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
            <span className="text-gray-600">Completato</span>
          </div>
          <div className="flex items-center">
            <div className="w-2 h-2 bg-blue-500 rounded-full mr-1"></div>
            <span className="text-gray-600">In corso</span>
          </div>
          <div className="flex items-center">
            <div className="w-2 h-2 bg-red-500 rounded-full mr-1"></div>
            <span className="text-gray-600">Errore</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestTimeline;
