import React from 'react';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  Download,
  RefreshCw,
  Eye,
  Clock,
  Activity,
  FolderOpen
} from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/Badge';
import { TestReport, TestResult } from '../../types/ssd';
import { buildReportSummary } from '../../utils/report';

interface DetailedResultsStepProps {
  state: {
    currentStep: string;
    report: TestReport | null;
    dsl: any;
    url: string;
    pdfContent?: string | null;
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
      </Card>
    );
  }

  const report = state.report;
  const summaryView = buildReportSummary(report);
  const results = report.results || [];
  const groupedResults = results.reduce<Record<string, TestResult[]>>((acc, result) => {
    const key = result.section || 'Sezione';
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(result);
    return acc;
  }, {});

  const cookieConsentTest = report.cookieConsentTest;
  const pdfTests = report.pdfTests;
  const artifacts = report.artifacts;
  const durationSeconds = summaryView.durationMs != null ? Math.round(summaryView.durationMs / 1000) : null;

  const canReRun = Boolean(state.dsl && state.pdfContent);

  const handleReRun = () => {
    if (!canReRun || !state.dsl || !state.pdfContent) return;
    onRunTestsWithData(state.dsl, state.pdfContent, undefined);
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              summaryView.overallStatus === 'SUCCESS' ? 'bg-green-100' :
              summaryView.overallStatus === 'FAILURE' ? 'bg-red-100' : 'bg-yellow-100'
            }`}>
              {summaryView.overallStatus === 'SUCCESS' ? (
                <CheckCircle className="w-6 h-6 text-green-600" />
              ) : summaryView.overallStatus === 'FAILURE' ? (
                <XCircle className="w-6 h-6 text-red-600" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-yellow-600" />
              )}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {summaryView.overallStatus === 'SUCCESS' ? 'Tutti i test sono passati' :
                 summaryView.overallStatus === 'FAILURE' ? 'I test sono falliti' : 'Risultati parziali'}
              </h2>
              <p className="text-gray-600">
                {state.url} • {new Date().toLocaleString()}
              </p>
            </div>
          </div>
          <Badge
            variant={summaryView.overallStatus === 'SUCCESS' ? 'success' : summaryView.overallStatus === 'FAILURE' ? 'error' : 'warning'}
            className="text-lg px-4 py-2"
          >
            {summaryView.passed}/{summaryView.totalTests || results.length || 0} Superati
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">{summaryView.totalTests || results.length || 0}</div>
            <div className="text-sm text-gray-600">Test Totali</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{summaryView.passed}</div>
            <div className="text-sm text-green-800">Superati</div>
          </div>
          <div className="text-center p-4 bg-red-50 rounded-lg">
            <div className="text-2xl font-bold text-red-600">{summaryView.failed}</div>
            <div className="text-sm text-red-800">Falliti</div>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{durationSeconds != null ? `${durationSeconds}s` : '–'}</div>
            <div className="text-sm text-blue-800">Durata</div>
          </div>
        </div>

        {summaryView.consentProfiles.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-gray-600">
            <Info className="w-4 h-4 text-gray-500" />
            <span>Profili consenso testati:</span>
            {summaryView.consentProfiles.map(profile => (
              <Badge key={profile} variant="outline" className="text-xs uppercase tracking-wide">
                {profile}
              </Badge>
            ))}
          </div>
        )}
      </Card>

      {cookieConsentTest && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold flex items-center gap-2">
              {cookieConsentTest.status === 'PASS' ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <XCircle className="w-5 h-5 text-red-600" />
              )}
              Cookie Banner
            </h3>
            <Badge variant={cookieConsentTest.status === 'PASS' ? 'success' : 'error'}>
              {cookieConsentTest.status}
            </Badge>
          </div>
          <div className="space-y-3 text-sm text-gray-700">
            {cookieConsentTest.description && <p>{cookieConsentTest.description}</p>}
            {cookieConsentTest.details && <p>{cookieConsentTest.details}</p>}
            {Array.isArray(cookieConsentTest.events) && cookieConsentTest.events.length > 0 && (
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="font-medium text-gray-700 mb-2">Eventi dataLayer generati</p>
                <div className="flex flex-wrap gap-2">
                  {cookieConsentTest.events.map((event: string, index: number) => (
                    <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                      {event}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {pdfTests && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold flex items-center gap-2">
              {pdfTests.status === 'PASS' ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <XCircle className="w-5 h-5 text-red-600" />
              )}
              Test da Specifica PDF
            </h3>
            <Badge variant={pdfTests.status === 'PASS' ? 'success' : 'error'}>
              {pdfTests.status}
            </Badge>
          </div>
          <div className="space-y-3 text-sm text-gray-700">
            {pdfTests.description && <p>{pdfTests.description}</p>}
            {pdfTests.details && <p>{pdfTests.details}</p>}
            {pdfTests.error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="font-medium text-red-700">Errore</p>
                <p className="text-red-700 mt-1 text-sm">{pdfTests.error}</p>
              </div>
            )}
            {pdfTests.expectedEvent && (
              <p className="text-sm text-gray-600">
                Evento atteso: <code className="bg-gray-100 px-1 rounded">{pdfTests.expectedEvent}</code>
              </p>
            )}
          </div>
        </Card>
      )}

      {artifacts && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-3 text-gray-700">
            <FolderOpen className="w-5 h-5" />
            <h3 className="text-lg font-semibold">Artifact generati</h3>
          </div>
          <div className="space-y-3">
            {/* HTML File */}
            {artifacts.htmlFile && (
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
                    <span className="text-blue-600 font-mono text-xs">HTML</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">HTML Snapshot</p>
                    <p className="text-sm text-gray-500">Pagina catturata durante il test</p>
                  </div>
                </div>
                <button 
                  onClick={async () => {
                    try {
                      const response = await fetch(`/api/ssd/artifact?file=${encodeURIComponent(artifacts.htmlFile)}`);
                      if (response.ok) {
                        const blob = await response.blob();
                        const url = window.URL.createObjectURL(blob);
                        window.open(url, '_blank');
                      } else {
                        alert('File non trovato o non accessibile');
                      }
                    } catch (error) {
                      alert('Errore nel caricamento del file');
                    }
                  }}
                  className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                >
                  Visualizza
                </button>
              </div>
            )}
            
            {/* PDF Text File */}
            {artifacts.pdfTextFile && (
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-red-100 rounded flex items-center justify-center">
                    <span className="text-red-600 font-mono text-xs">PDF</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">PDF Text Extract</p>
                    <p className="text-sm text-gray-500">Testo estratto dal PDF originale</p>
                  </div>
                </div>
                <button 
                  onClick={async () => {
                    try {
                      const response = await fetch(`/api/ssd/artifact?file=${encodeURIComponent(artifacts.pdfTextFile)}`);
                      if (response.ok) {
                        const text = await response.text();
                        const blob = new Blob([text], { type: 'text/plain' });
                        const url = window.URL.createObjectURL(blob);
                        window.open(url, '_blank');
                      } else {
                        alert('File non trovato o non accessibile');
                      }
                    } catch (error) {
                      alert('Errore nel caricamento del file');
                    }
                  }}
                  className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                >
                  Visualizza
                </button>
              </div>
            )}
            
            {/* Screenshots */}
            {artifacts.screenshotsFolder && (
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-green-100 rounded flex items-center justify-center">
                    <span className="text-green-600 font-mono text-xs">IMG</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Screenshots</p>
                    <p className="text-sm text-gray-500">Immagini catturate durante i test</p>
                  </div>
                </div>
                <button 
                  onClick={() => window.open(`/api/ssd/artifact?folder=${encodeURIComponent(artifacts.screenshotsFolder)}`, '_blank')}
                  className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                >
                  Visualizza
                </button>
              </div>
            )}
            
            {/* Raw Logs */}
            {artifacts.rawLogsPath && (
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-yellow-100 rounded flex items-center justify-center">
                    <span className="text-yellow-600 font-mono text-xs">LOG</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Log Grezzi</p>
                    <p className="text-sm text-gray-500">Log dettagliati dell'esecuzione</p>
                  </div>
                </div>
                <button 
                  onClick={() => window.open(`/api/ssd/artifact?file=${encodeURIComponent(artifacts.rawLogsPath)}`, '_blank')}
                  className="px-3 py-1 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700"
                >
                  Visualizza
                </button>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Test Details Section */}
      {report && (report.cookie || report.pdf) && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4 text-gray-700">
            <CheckCircle className="w-5 h-5" />
            <h3 className="text-lg font-semibold">Dettagli Test</h3>
          </div>
          <div className="space-y-4">
            {/* Cookie Test Details */}
            {report.cookie && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900">🍪 Cookie Consent Test</h4>
                  <span className={`px-2 py-1 rounded text-sm font-medium ${
                    report.cookie.status === 'PASS' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {report.cookie.status}
                  </span>
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                  <p><strong>Consent Status:</strong> {report.cookie.consentStatus || 'N/A'}</p>
                  <p><strong>DataLayer Events:</strong> {report.cookie.dataLayerEvents?.length || 0} eventi</p>
                  <p><strong>Steps:</strong> {report.cookie.steps?.length || 0} step</p>
                  <p><strong>Durata:</strong> {report.cookie.duration || 0}ms</p>
                  {report.cookie.cookieBtnSelector && (
                    <p><strong>Button Selector:</strong> <code className="bg-gray-200 px-1 rounded">{report.cookie.cookieBtnSelector}</code></p>
                  )}
                </div>
              </div>
            )}
            
            {/* PDF Test Details */}
            {report.pdf && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900">📄 PDF Test</h4>
                  <span className={`px-2 py-1 rounded text-sm font-medium ${
                    report.pdf.status === 'PASS' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {report.pdf.status}
                  </span>
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                  <p><strong>Steps:</strong> {report.pdf.steps?.length || 0} step</p>
                  <p><strong>Durata:</strong> {report.pdf.duration || 0}ms</p>
                  {report.pdf.spec && (
                    <p><strong>Spec:</strong> {report.pdf.spec.tests?.length || 0} test generati</p>
                  )}
                  {/* CORRECTED: Extract data from the correct structure */}
                  {report.pdf.result && (
                    <div>
                      <p><strong>Risultato:</strong> {report.pdf.result.summary?.passed || 0} passati, {report.pdf.result.summary?.failed || 0} falliti</p>
                      {/* Add execution details if available */}
                      {report.pdf.result.summary && (
                        <div className="mt-2 p-2 bg-white rounded border text-xs">
                          <p><strong>Esecuzione:</strong> {report.pdf.result.summary.steps || 0} steps, {report.pdf.result.summary.passed || 0} passati, {report.pdf.result.summary.failed || 0} falliti</p>
                          <p><strong>Durata reale:</strong> {report.pdf.result.summary.duration || 0}ms</p>
                        </div>
                      )}
                    </div>
                  )}
                  {/* FALLBACK: If no result.summary, try to extract from steps */}
                  {!report.pdf.result && report.pdf.steps && (
                    <div>
                      <p><strong>Risultato:</strong> {report.pdf.steps.filter((s: any) => s.status === 'PASS').length} passati, {report.pdf.steps.filter((s: any) => s.status === 'FAIL').length} falliti</p>
                    </div>
                  )}
                  
                  {/* EXECUTION DETAILS: Show what was actually tested - DYNAMIC DATA ONLY */}
                  {report.pdf.status === 'PASS' && report.pdf.steps && (
                    <div className="mt-3 p-3 bg-green-50 rounded border border-green-200">
                      <h5 className="font-medium text-green-800 mb-2">✅ Test Eseguito con Successo</h5>
                      <div className="text-sm text-green-700 space-y-1">
                        {report.pdf.steps.map((step: any, index: number) => (
                          <div key={index} className="p-2 bg-white rounded border">
                            <p><strong>📝 Step {index + 1}:</strong> {step.description || 'Click su elemento header'}</p>
                            <p><strong>🎯 Azione:</strong> {step.action}</p>
                            {step.error && (
                              <p><strong>❌ Errore:</strong> {step.error}</p>
                            )}
                            {step.status && (
                              <p><strong>📊 Status:</strong> {step.status}</p>
                            )}
                            {/* DYNAMIC EVENT DETAILS */}
                            {step.eventDetails && (
                              <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-200">
                                <p><strong>🎯 Link Cliccato:</strong> "{step.eventDetails.clickedElement?.text}" → {step.eventDetails.clickedElement?.href}</p>
                                <p><strong>📊 Evento Catturato:</strong> {step.eventDetails.event}</p>
                                <p><strong>🔍 Dettagli Evento:</strong> link_text="{step.eventDetails.link_text}", link_url="{step.eventDetails.link_url}", index="{step.eventDetails.index}"</p>
                              </div>
                            )}
                          </div>
                        ))}
                        <p><strong>🎉 Risultato:</strong> Test completato con successo</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {Object.keys(groupedResults).length > 0 && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600" />
              Dettaglio per sezione
            </h3>
            <Button onClick={onExportReport} variant="outline" className="flex items-center gap-2 text-sm">
              <Download className="w-4 h-4" />
              Esporta Report JSON
            </Button>
          </div>

          <div className="space-y-6">
            {Object.entries(groupedResults).map(([section, sectionResults]) => (
              <div key={section}>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-lg font-semibold text-gray-900">{section}</h4>
                  <span className="text-sm text-gray-500">{sectionResults.length} step</span>
                </div>
                <div className="space-y-3">
                  {sectionResults.map(result => (
                    <Card key={`${section}-${result.stepIndex}`} className="p-4 bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            {result.status === 'PASS' ? (
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-600" />
                            )}
                            <span className="font-medium text-gray-900">Step {result.stepIndex + 1}</span>
                          </div>
                          {result.description && (
                            <p className="mt-1 text-sm text-gray-700">{result.description}</p>
                          )}
                          {result.reasons && result.reasons.length > 0 && (
                            <ul className="mt-2 text-sm text-red-700 list-disc list-inside space-y-1">
                              {result.reasons.map((reason, idx) => (
                                <li key={idx}>{reason}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                        <Badge variant={result.status === 'PASS' ? 'success' : 'error'}>{result.status}</Badge>
                      </div>

                      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          <span>{Math.round((result.timings?.duration ?? 0) / 1000)}s</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {result.evidence?.dataLayerEvents?.length ?? 0} eventi dataLayer
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {result.evidence?.trackingHits?.length ?? 0} hit tracking
                          </Badge>
                        </div>
                      </div>

                      {result.evidence?.dataLayerEvents && result.evidence.dataLayerEvents.length > 0 && (
                        <details className="mt-3 text-sm">
                          <summary className="cursor-pointer text-blue-600">Mostra eventi dataLayer</summary>
                          <pre className="mt-2 max-h-48 overflow-auto rounded bg-white p-3 text-xs text-gray-800 border border-gray-200">
                            {JSON.stringify(result.evidence.dataLayerEvents, null, 2)}
                          </pre>
                        </details>
                      )}
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

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
              onClick={handleReRun}
              disabled={!canReRun}
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
