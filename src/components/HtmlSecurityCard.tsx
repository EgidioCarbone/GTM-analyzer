import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getHtmlSecurityMetricInfo } from '../services/htmlSecurityService';
import { HtmlSecurityResult } from '../types/gtm';
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
          bgColor: 'bg-fuchsia-50 dark:bg-fuchsia-900/20',
          borderColor: 'border-fuchsia-200 dark:border-fuchsia-800',
          textColor: 'text-fuchsia-700 dark:text-fuchsia-400',
          buttonColor: 'bg-purple-600 hover:bg-purple-700 text-white',
        };
      case 'major':
        return {
          bgColor: 'bg-purple-50 dark:bg-purple-900/20',
          borderColor: 'border-purple-200 dark:border-purple-800',
          textColor: 'text-purple-700 dark:text-purple-400',
          buttonColor: 'bg-purple-600 hover:bg-purple-700 text-white',
        };
      case 'minor':
        return {
          bgColor: 'bg-violet-50 dark:bg-violet-900/20',
          borderColor: 'border-violet-200 dark:border-violet-800',
          textColor: 'text-violet-700 dark:text-violet-400',
          buttonColor: 'bg-purple-600 hover:bg-purple-700 text-white',
        };
      default:
        return {
          bgColor: 'bg-indigo-50 dark:bg-indigo-900/20',
          borderColor: 'border-indigo-200 dark:border-indigo-800',
          textColor: 'text-indigo-700 dark:text-indigo-400',
          buttonColor: 'bg-indigo-600 hover:bg-indigo-700 text-white',
        };
    }
  };

  const cardStyle = getCardStyle();

  if (html_security.checked === 0) {
    return (
      <div className={`${cardStyle.bgColor} ${cardStyle.borderColor} border-2 rounded-xl p-6 shadow-md hover:shadow-lg transition-all duration-200`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Sicurezza Custom HTML</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Nessun tag HTML custom rilevato</p>
            </div>
          </div>
          <InfoTooltip content="Nessun tag HTML custom è stato rilevato nel container. I tag HTML custom richiedono particolare attenzione per la sicurezza.">
          </InfoTooltip>
        </div>
        <div className="text-center py-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">Container senza tag HTML custom</p>
        </div>
      </div>
    );
  }

  const scorePct = Number(((html_security.score ?? 0) * 100).toFixed(1));
  const pausedCount = html_security.details.filter((d: any) => d.paused).length;

  return (
    <div className={`${cardStyle.bgColor} ${cardStyle.borderColor} border-2 rounded-xl p-6 shadow-md hover:shadow-lg transition-all duration-200`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white">{message.title}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">{message.summary}</p>
          </div>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-medium ${metricInfo.priorityColor}`}>
          {metricInfo.priority}
        </div>
      </div>

      {/* Griglia conteggi */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">{html_security.checked}</div>
          <div className="text-xs text-gray-600 dark:text-gray-400">Tag HTML</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-fuchsia-600 dark:text-fuchsia-400">{html_security.critical}</div>
          <div className="text-xs text-gray-600 dark:text-gray-400 flex items-center justify-center gap-1">
           <span>Critici</span>
          </div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{html_security.major}</div>
          <div className="text-xs text-gray-600 dark:text-gray-400 flex items-center justify-center gap-1">
           <span>Maggiori</span>
          </div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{html_security.minor}</div>
          <div className="text-xs text-gray-600 dark:text-gray-400 flex items-center justify-center gap-1">
            <span>Minori</span>
          </div>
        </div>
      </div>

      {/* ⬇️ Riquadro blu con Score / Domini / Pausa */}
      <div className="mb-4">
        <div className="rounded-xl border border-purple-200 bg-purple-100/70 text-purple-900 px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">Score sicurezza:</span>
            <span className="text-sm font-bold">{scorePct}%</span>
          </div>
          <div className="hidden sm:block w-px h-4 bg-purple-300" />
          <div className="flex items-center gap-2">
            <span className="text-sm">Domini terzi:</span>
            <span className="text-sm font-semibold">{html_security.third_parties.length}</span>
          </div>
          <div className="hidden sm:block w-px h-4 bg-purple-300" />
          <div className="flex items-center gap-2">
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
            {html_security.third_parties.slice(0, 5).map((domain: any, index: number) => (
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
            {html_security.details.slice(0, 3).map((detail: any, index: number) => (
              <div key={`examples-${detail.id}-${index}`} className="text-xs text-gray-600 dark:text-gray-400">
                <span className="font-bold text-gray-800 dark:text-gray-200">{detail.name}</span>
                <span className="ml-2">— {detail.issues.slice(0, 2).map((i: any) => i.message).join(', ')}</span>
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
              {html_security.details.map((detail: any, index: number) => (
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
                    {detail.issues.map((issue: any, idx: number) => (
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
