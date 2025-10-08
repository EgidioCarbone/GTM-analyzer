import React from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, ExternalLink, Download, RefreshCw, Eye } from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/Badge';
import { TestReport, TestResult } from '../../types/ssd';

interface DetailedResultsStepProps {
  state: {
    currentStep: string;
    report: TestReport | null;
    dsl: any;
    url: string;
  };
  onReset: () => void;
  onExportReport: () => void;
  onRunTestsWithData: (dsl: any, pdfContent: string, pdfBufferPath?: string) => void;
}

export default function DetailedResultsStep({
  state,
  onReset,
  onExportReport,
  onRunTestsWithData
}: DetailedResultsStepProps) {
  if (!state.report) {
    // Fallback per quando non c'è report
    return (
      <Card className="p-8 text-center">
        <div className="mb-6">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-yellow-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Test Completati</h2>
          <p className="text-gray-600 mb-6">
            I test sono stati eseguiti ma i risultati dettagliati non sono disponibili.
          </p>
        </div>
        
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">✓</div>
              <div className="text-sm text-blue-800">PDF Processato</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">✓</div>
              <div className="text-sm text-green-800">Test Eseguiti</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">⚠</div>
              <div className="text-sm text-purple-800">Report Parziale</div>
            </div>
          </div>
          
          <div className="flex justify-center space-x-4">
            <Button 
              onClick={onReset}
              variant="outline"
              className="px-6 py-3"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Esegui Nuovo Test
            </Button>
            <Button 
              onClick={() => {
                if (state.dsl) {
                  const dslWindow = window.open();
                  if (dslWindow) {
                    dslWindow.document.write(`
                      <html>
                        <head><title>DSL Generato - SSD Test</title></head>
                        <body style="font-family: monospace; padding: 20px; background: #f5f5f5;">
                          <h1>DSL Generato</h1>
                          <pre style="background: white; padding: 20px; border-radius: 8px; overflow: auto;">${JSON.stringify(state.dsl, null, 2)}</pre>
                        </body>
                      </html>
                    `);
                  }
                }
              }}
              className="px-6 py-3"
            >
              <Eye className="w-4 h-4 mr-2" />
              Visualizza DSL
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  const { summary, results, cookieConsentTest, pdfTests } = state.report;
  
  // Calcola statistiche generali
  const totalTests = (cookieConsentTest ? 1 : 0) + (pdfTests ? 1 : 0);
  const passedTests = (cookieConsentTest?.status === 'PASS' ? 1 : 0) + (pdfTests?.status === 'PASS' ? 1 : 0);
  const failedTests = totalTests - passedTests;
  
  // Determina lo stato generale
  const overallStatus = failedTests === 0 ? 'SUCCESS' : failedTests === totalTests ? 'FAILURE' : 'PARTIAL';

  return (
    <div className="space-y-6">
      {/* Header con stato generale */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              overallStatus === 'SUCCESS' ? 'bg-green-100' : 
              overallStatus === 'FAILURE' ? 'bg-red-100' : 'bg-yellow-100'
            }`}>
              {overallStatus === 'SUCCESS' ? (
                <CheckCircle className="w-6 h-6 text-green-600" />
              ) : overallStatus === 'FAILURE' ? (
                <XCircle className="w-6 h-6 text-red-600" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-yellow-600" />
              )}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {overallStatus === 'SUCCESS' ? 'Tutti i Test Superati!' :
                 overallStatus === 'FAILURE' ? 'Test Falliti' : 'Test Parzialmente Superati'}
              </h2>
              <p className="text-gray-600">
                {state.url} • {new Date().toLocaleString()}
              </p>
            </div>
          </div>
          <Badge 
            variant={overallStatus === 'SUCCESS' ? 'success' : 
                    overallStatus === 'FAILURE' ? 'error' : 'warning'}
            className="text-lg px-4 py-2"
          >
            {passedTests}/{totalTests} Superati
          </Badge>
        </div>

        {/* Statistiche generali */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">{totalTests}</div>
            <div className="text-sm text-gray-600">Test Totali</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{passedTests}</div>
            <div className="text-sm text-green-800">Superati</div>
          </div>
          <div className="text-center p-4 bg-red-50 rounded-lg">
            <div className="text-2xl font-bold text-red-600">{failedTests}</div>
            <div className="text-sm text-red-800">Falliti</div>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">
              {Math.round(summary.duration / 1000)}s
            </div>
            <div className="text-sm text-blue-800">Durata</div>
          </div>
        </div>
      </Card>

      {/* Risultati Cookie Consent Test */}
      {cookieConsentTest && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold flex items-center">
              {cookieConsentTest.status === 'PASS' ? (
                <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
              ) : (
                <XCircle className="w-5 h-5 text-red-600 mr-2" />
              )}
              Cookie Consent Test
            </h3>
            <Badge 
              variant={cookieConsentTest.status === 'PASS' ? 'success' : 'error'}
            >
              {cookieConsentTest.status}
            </Badge>
          </div>
          
          <div className="space-y-3">
            <p className="text-gray-700">
              <strong>Descrizione:</strong> Test di accettazione del banner cookie
            </p>
            <p className="text-gray-700">
              <strong>Risultato:</strong> {cookieConsentTest.status === 'PASS' ? 
                'Banner cookie accettato correttamente e eventi dataLayer generati' :
                'Banner cookie non accettato o eventi dataLayer mancanti'
              }
            </p>
            {cookieConsentTest.events && (
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-sm font-medium text-gray-700 mb-2">Eventi DataLayer Generati:</p>
                <div className="flex flex-wrap gap-2">
                  {cookieConsentTest.events.map((event: string, index: number) => (
                    <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                      {event}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Dettagli tecnici del test cookie */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm font-medium text-gray-700 mb-2">Dettagli Tecnici:</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600"><strong>Selettore utilizzato:</strong></p>
                  <code className="text-xs bg-white p-2 rounded border block mt-1 break-all">
                    {cookieConsentTest.selector}
                  </code>
                </div>
                <div>
                  <p className="text-gray-600"><strong>Testo pulsante:</strong> "{cookieConsentTest.buttonText}"</p>
                  <p className="text-gray-600"><strong>Eventi generati:</strong> {cookieConsentTest.events?.length || 0}</p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Risultati PDF Tests */}
      {pdfTests && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold flex items-center">
              {pdfTests.status === 'PASS' ? (
                <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
              ) : (
                <XCircle className="w-5 h-5 text-red-600 mr-2" />
              )}
              PDF Test - Header Menu Click
            </h3>
            <Badge 
              variant={pdfTests.status === 'PASS' ? 'success' : 'error'}
            >
              {pdfTests.status}
            </Badge>
          </div>
          
          <div className="space-y-3">
            <p className="text-gray-700">
              <strong>Descrizione:</strong> Test di click su menu header per generare evento dataLayer
            </p>
            
            {pdfTests.status === 'FAIL' ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start">
                  <AlertTriangle className="w-5 h-5 text-red-600 mr-2 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-800 mb-2">Test Fallito</p>
                    <p className="text-red-700 text-sm mb-3">
                      L'evento <code className="bg-red-100 px-1 rounded">header_menu_click</code> non è stato trovato nel dataLayer dopo il click.
                    </p>
                    <div className="bg-white p-3 rounded border">
                      <p className="text-sm font-medium text-gray-700 mb-2">Eventi DataLayer Disponibili:</p>
                      <div className="flex flex-wrap gap-2">
                        {pdfTests.availableEvents?.map((event: string, index: number) => (
                          <span key={index} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                            {event}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-600 mr-2 mt-0.5" />
                  <div>
                    <p className="font-medium text-green-800 mb-2">Test Superato</p>
                    <p className="text-green-700 text-sm">
                      L'evento <code className="bg-green-100 px-1 rounded">header_menu_click</code> è stato generato correttamente nel dataLayer.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Dettagli tecnici del test */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm font-medium text-gray-700 mb-2">Dettagli Tecnici:</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600"><strong>Selettore utilizzato:</strong></p>
                  <code className="text-xs bg-white p-2 rounded border block mt-1 break-all">
                    {pdfTests.selector}
                  </code>
                </div>
                <div>
                  <p className="text-gray-600"><strong>Click eseguito:</strong> {pdfTests.clickSuccessful ? '✅ Sì' : '❌ No'}</p>
                  <p className="text-gray-600"><strong>Durata test:</strong> {Math.round((pdfTests.duration || 0) / 1000)}s</p>
                </div>
              </div>
            </div>

            {/* Raccomandazioni per test fallito */}
            {pdfTests.status === 'FAIL' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start">
                  <Info className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
                  <div>
                    <p className="font-medium text-blue-800 mb-2">Raccomandazioni per Risolvere il Problema</p>
                    <ul className="text-blue-700 text-sm space-y-2">
                      <li className="flex items-start">
                        <span className="mr-2">1.</span>
                        <div>
                          <strong>Implementare l'evento dataLayer:</strong> Aggiungere il codice per generare l'evento <code className="bg-blue-100 px-1 rounded">header_menu_click</code> quando si clicca sui link del menu header
                        </div>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-2">2.</span>
                        <div>
                          <strong>Configurare GTM:</strong> Verificare che Google Tag Manager sia configurato per catturare l'evento <code className="bg-blue-100 px-1 rounded">header_menu_click</code>
                        </div>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-2">3.</span>
                        <div>
                          <strong>Verificare selettori:</strong> Controllare che i selettori CSS del menu siano corretti e che i link siano cliccabili
                        </div>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-2">4.</span>
                        <div>
                          <strong>Test manuale:</strong> Verificare manualmente che l'evento venga generato aprendo la console del browser e controllando il dataLayer
                        </div>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Azioni */}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <Button 
            onClick={onReset} 
            variant="outline"
            className="flex items-center gap-2 px-6 py-3"
          >
            <RefreshCw className="w-4 h-4" />
            Esegui Nuovo Test
          </Button>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <Button 
              onClick={onExportReport} 
              variant="outline"
              className="flex items-center gap-2 px-6 py-3"
            >
              <Download className="w-4 h-4" />
              Esporta Report
            </Button>
            <Button 
              onClick={() => onRunTestsWithData(state.dsl, '', undefined)} 
              className="flex items-center gap-2 px-6 py-3"
            >
              <RefreshCw className="w-4 h-4" />
              Riavvia Test
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
