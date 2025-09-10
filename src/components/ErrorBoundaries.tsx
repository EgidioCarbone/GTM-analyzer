import React from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { AlertTriangle, BarChart3, Settings, FileText } from 'lucide-react';

// Error boundary per la dashboard
export const DashboardErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ErrorBoundary
    fallback={
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
          <BarChart3 className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
            Errore nella Dashboard
          </h3>
          <p className="text-red-600 dark:text-red-300 text-sm">
            Non è stato possibile caricare la dashboard. Riprova o contatta il supporto.
          </p>
        </div>
      </div>
    }
  >
    {children}
  </ErrorBoundary>
);

// Error boundary per il container manager
export const ContainerManagerErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ErrorBoundary
    fallback={
      <div className="p-6">
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-6 text-center">
          <Settings className="w-12 h-12 text-orange-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-orange-800 dark:text-orange-200 mb-2">
            Errore nel Container Manager
          </h3>
          <p className="text-orange-600 dark:text-orange-300 text-sm">
            Si è verificato un problema con la gestione del container. I tuoi dati sono al sicuro.
          </p>
        </div>
      </div>
    }
  >
    {children}
  </ErrorBoundary>
);

// Error boundary per i report
export const ReportErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ErrorBoundary
    fallback={
      <div className="p-6">
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 text-center">
          <FileText className="w-12 h-12 text-blue-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-200 mb-2">
            Errore nella Generazione Report
          </h3>
          <p className="text-blue-600 dark:text-blue-300 text-sm">
            Non è stato possibile generare il report. Verifica i dati e riprova.
          </p>
        </div>
      </div>
    }
  >
    {children}
  </ErrorBoundary>
);
