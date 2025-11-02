import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HtmlSecurityResult, getHtmlSecurityMetricInfo } from '../services/htmlSecurityService';
import { InfoTooltip } from './ui/InfoTooltip';

interface HtmlSecurityCardProps {
  htmlSecurityResult: HtmlSecurityResult;
  onAction?: () => void;
}

export const HtmlSecurityCard: React.FC<HtmlSecurityCardProps> = ({
  htmlSecurityResult,
  onAction
}) => {
  const { html_security, message } = htmlSecurityResult;
  const metricInfo = getHtmlSecurityMetricInfo(message.status);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const navigate = useNavigate();

  // stile per severità
  const getCardStyle = () => {
    switch (message.status) {
      case 'critical':
        return {
          bgColor: 'bg-red-50 dark:bg-red-900/20',
          borderColor: 'border-red-200 dark:border-red-800',
          textColor: 'text-red-600 dark:text-red-400',
          buttonColor:
            'bg-red-100 hover:bg-red-200 text-red-800 dark:bg-red-800 dark:hover:bg-red-700 dark:text-red-100',
        };
      case 'major':
        return {
          bgColor: 'bg-orange-50 dark:bg-orange-900/20',
          borderColor: 'border-orange-200 dark:border-orange-800',
          textColor: 'text-orange-600 dark:text-orange-400',
          buttonColor:
            'bg-orange-100 hover:bg-orange-200 text-orange-800 dark:bg-orange-800 dark:hover:bg-orange-700 dark:text-orange-100',
        };
      case 'minor':
        return {
          bgColor: 'bg-blue-50 dark:bg-blue-900/20',
          borderColor: 'border-blue-200 dark:border-blue-800',
          textColor: 'text-blue-600 dark:text-blue-400',
          buttonColor:
            'bg-blue-100 hover:bg-blue-200 text-blue-800 dark:bg-blue-800 dark:hover:bg-blue-700 dark:text-blue-100',
        };
      default:
        return {
          bgColor: 'bg-green-50 dark:bg-green-900/20',
          borderColor: 'border-green-200 dark:border-green-800',
          textColor: 'text-green-600 dark:text-green-400',
          buttonColor:
            'bg-green-100 hover:bg-green-200 text-green-800 dark:bg-green-800 dark:hover:bg-green-700 dark:text-green-100',
        };
    }
  };

  const cardStyle = getCardStyle();

  if (html_security.checked === 0) {
    return (
      <div className={`${cardStyle.bgColor} ${cardStyle.borderColor} border-2 rounded-xl p-6 shadow-md hover:shadow-lg transition-all duration-200`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔒</span>
            <div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Sicurezza Custom HTML</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Nessun tag HTML custom rilevato</p>
            </div>
          </div>
          <InfoTooltip content="Nessun tag HTML custom è stato rilevato nel container. I tag HTML custom richiedono particolare attenzione per la sicurezza.">
            <span className="text-gray-400 hover:text-gray-600 cursor-help">ℹ️</span>
          </InfoTooltip>
        </div>
        <div className="text-center py-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">Container senza tag HTML custom</p>
        </div>
      </div>
    );
  }

  const scorePct = Number(((html_security.score ?? 0) * 100).toFixed(1));
  const pausedCount = html_security.details.filter(d => d.paused).length;

  return (
    <div className={`${cardStyle.bgColor} ${cardStyle.borderColor} border-2 rounded-xl p-6 shadow-md hover:shadow-lg transition-all duration-200`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{metricInfo.icon}</span>
          <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white">{message.title}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">{message.summary}</p>
          </div>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-medium ${metricInfo.priorityColor}`}>
          Priorità: {metricInfo.priority}
        </div>
      </div>

      {/* Griglia conteggi */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">{html_security.checked}</div>
          <div className="text-xs text-gray-600 dark:text-gray-400">Tag HTML</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">{html_security.critical}</div>
          <div className="text-xs text-gray-600 dark:text-gray-400 flex items-center justify-center gap-1">
           <span>Critici</span>
          </div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{html_security.major}</div>
          <div className="text-xs text-gray-600 dark:text-gray-400 flex items-center justify-center gap-1">
           <span>Maggiori</span>
          </div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{html_security.minor}</div>
          <div className="text-xs text-gray-600 dark:text-gray-400 flex items-center justify-center gap-1">
            <span>Minori</span>
          </div>
        </div>
      </div>

      {/* ⬇️ Riquadro blu con Score / Domini / Pausa */}
      <div className="mb-4">
        <div className="rounded-xl border border-blue-200 bg-blue-100/70 text-blue-900 px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-2">
            <span className="text-blue-700">🛡️</span>
            <span className="text-sm font-semibold">Score sicurezza:</span>
            <span className="text-sm font-bold">{scorePct}%</span>
          </div>
          <div className="hidden sm:block w-px h-4 bg-blue-300" />
          <div className="flex items-center gap-2">
            <span className="text-blue-700">🌐</span>
            <span className="text-sm">Domini terzi:</span>
            <span className="text-sm font-semibold">{html_security.third_parties.length}</span>
          </div>
          <div className="hidden sm:block w-px h-4 bg-blue-300" />
          <div className="flex items-center gap-2">
            <span className="text-blue-700">⏸️</span>
            <span className="text-sm">Tag in pausa:</span>
            <span className="text-sm font-semibold">{pausedCount}</span>
          </div>
        </div>
      </div>

      {/* Domini terzi */}
      {html_security.third_parties.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Domini terzi:</span>
            <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded-full">
              {html_security.third_parties.length}
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {html_security.third_parties.slice(0, 5).map((domain, index) => (
              <span key={index} className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
                {domain}
              </span>
            ))}
            {html_security.third_parties.length > 5 && (
              <span className="px-2 py-1 text-xs bg-gray-100 text-gray-500 rounded">
                +{html_security.third_parties.length - 5} altri
              </span>
            )}
          </div>
        </div>
      )}

      {/* Esempi */}
      {html_security.details.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Esempi di problemi:</h4>
          <div className="space-y-1">
            {html_security.details.slice(0, 3).map((detail, index) => (
              <div key={`examples-${detail.id}-${index}`} className="text-xs text-gray-600 dark:text-gray-400">
                <span className="font-bold text-gray-800 dark:text-gray-200">{detail.name}</span>
                <span className="ml-2">— {detail.issues.slice(0, 2).map(i => i.message).join(', ')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CTA + Elenco tag (modale) */}
      <div className="flex flex-wrap justify-between gap-2">
        <button
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${cardStyle.buttonColor}`}
          onClick={(e) => {
            e.stopPropagation();
            const filter =
              message.status === 'critical'
                ? 'html-security-critical'
                : message.status === 'major'
                ? 'html-security-major'
                : 'html-security-minor';
            navigate('/container-manager', { state: { autoFilter: filter, tab: 'tags' } });
            onAction?.();
          }}
        >{message.cta}
        </button>

        <button
          className="px-4 py-2 rounded-lg text-sm font-medium bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600 dark:hover:bg-gray-600"
          onClick={() => setIsModalOpen(true)}
        >Anteprima</button>
      </div>

      {/* Tooltip */}
      <InfoTooltip content={metricInfo.impact}>
        <div className="absolute top-2 right-2 w-4 h-4" />
      </InfoTooltip>

      {/* MODAL elenco tag (scroll) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" onClick={() => setIsModalOpen(false)}>
          <div className="w-full max-w-3xl rounded-xl bg-white dark:bg-gray-800 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100">
                  Anteprima ({html_security.checked})
                </h3>
              </div>
              <button
                className="px-3 py-1 text-sm rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600"
                onClick={() => setIsModalOpen(false)}
              >
                ✕ Chiudi
              </button>
            </div>

            <div className="p-4 max-h-[70vh] overflow-y-auto space-y-3">
              {html_security.details.map((detail, index) => (
                <div key={`modal-row-${detail.id}-${index}`} className="p-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-gray-800 dark:text-gray-100">{detail.name}</span>
                    </div>
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        detail.severity === 'critical'
                          ? 'bg-red-100 text-red-800'
                          : detail.severity === 'major'
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {detail.severity}
                    </span>
                  </div>

                  <div className="space-y-1 mb-2">
                    {detail.issues.map((issue, idx) => (
                      <div key={idx} className="text-xs text-gray-600 dark:text-gray-300">
                        • {issue.message}
                        {issue.url && (
                          <a className="text-blue-600 ml-1 underline" href={issue.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                            (ref)
                          </a>
                        )}
                      </div>
                    ))}
                  </div>

                  {detail.suggestion && (
                    <div className="text-xs text-blue-600 dark:text-blue-400">💡 {detail.suggestion}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
