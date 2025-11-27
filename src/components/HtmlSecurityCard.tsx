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

  const getCardStyle = () => {
    switch (message.status) {
      case 'critical':
        return {
          accentBorder: 'border-rose-200',
          accentText: 'text-rose-700',
        };
      case 'major':
        return {
          accentBorder: 'border-purple-200',
          accentText: 'text-purple-700',
        };
      case 'minor':
        return {
          accentBorder: 'border-amber-200',
          accentText: 'text-amber-700',
        };
      default:
        return {
          accentBorder: 'border-emerald-200',
          accentText: 'text-emerald-700',
        };
    }
  };

  const cardStyle = getCardStyle();

  if (html_security.checked === 0) {
    return (
      <div className={`ls-card h-full flex flex-col min-h-[260px] ${cardStyle.accentBorder}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Sicurezza Custom HTML</h3>
              <p className="text-sm text-slate-600">Nessun tag HTML custom rilevato</p>
            </div>
          </div>
          <InfoTooltip content="Nessun tag HTML custom è stato rilevato nel container. I tag HTML custom richiedono particolare attenzione per la sicurezza.">
          </InfoTooltip>
        </div>
        <div className="text-center py-4">
          <p className="text-sm text-slate-600">Container senza tag HTML custom</p>
        </div>
      </div>
    );
  }

  const scorePct = Number(((html_security.score ?? 0) * 100).toFixed(1));
  const pausedCount = html_security.details.filter((d: any) => d.paused).length;

  return (
    <div className={`ls-card h-full flex flex-col flex-1 min-h-[320px] ${cardStyle.accentBorder}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{message.title}</h3>
            <p className="text-sm text-slate-600">{message.summary}</p>
          </div>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-medium ${metricInfo.priorityColor}`}>
          {metricInfo.priority}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-slate-700">{html_security.checked}</div>
          <div className="text-xs text-slate-500">Tag HTML</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-rose-600">{html_security.critical}</div>
          <div className="text-xs text-slate-500 flex items-center justify-center gap-1">
           <span>Critici</span>
          </div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-purple-600">{html_security.major}</div>
          <div className="text-xs text-slate-500 flex items-center justify-center gap-1">
           <span>Maggiori</span>
          </div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-indigo-600">{html_security.minor}</div>
          <div className="text-xs text-slate-500 flex items-center justify-center gap-1">
            <span>Minori</span>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <div className="rounded-xl border border-purple-100 bg-purple-50/80 text-purple-900 px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">Score sicurezza:</span>
            <span className="text-sm font-bold">{scorePct}%</span>
          </div>
          <div className="hidden sm:block w-px h-4 bg-purple-200" />
          <div className="flex items-center gap-2">
            <span className="text-sm">Domini terzi:</span>
            <span className="text-sm font-semibold">{html_security.third_parties.length}</span>
          </div>
          <div className="hidden sm:block w-px h-4 bg-purple-200" />
          <div className="flex items-center gap-2">
            <span className="text-sm">Tag in pausa:</span>
            <span className="text-sm font-semibold">{pausedCount}</span>
          </div>
        </div>
      </div>

      {html_security.third_parties.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium text-slate-700">Domini terzi:</span>
            <span className="ls-pill ls-pill-soft text-purple-700 border-purple-200">
              {html_security.third_parties.length}
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {html_security.third_parties.slice(0, 5).map((domain: any, index: number) => (
              <span key={index} className="px-2 py-1 text-xs bg-slate-50 text-slate-700 rounded border border-slate-100">
                {domain}
              </span>
            ))}
            {html_security.third_parties.length > 5 && (
              <span className="px-2 py-1 text-xs bg-slate-50 text-slate-500 rounded border border-slate-100">
                +{html_security.third_parties.length - 5} altri
              </span>
            )}
          </div>
        </div>
      )}

      {html_security.details.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-slate-700 mb-2">Esempi di problemi:</h4>
          <div className="space-y-1">
            {html_security.details.slice(0, 3).map((detail: any, index: number) => (
              <div key={`examples-${detail.id}-${index}`} className="text-xs text-slate-600">
                <span className="font-bold text-slate-800">{detail.name}</span>
                <span className="ml-2">- {detail.issues.slice(0, 2).map((i: any) => i.message).join(', ')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap justify-between gap-2">
        <button
          className="ls-btn ls-btn-sm"
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
          className="ls-btn-ghost ls-btn-sm"
          onClick={() => setIsModalOpen(true)}
        >Anteprima</button>
      </div>

      <InfoTooltip content={metricInfo.impact}>
        <div className="absolute top-2 right-2 w-4 h-4" />
      </InfoTooltip>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" onClick={() => setIsModalOpen(false)}>
          <div className="w-full max-w-3xl rounded-xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-slate-900">
                  Anteprima ({html_security.checked})
                </h3>
              </div>
              <button
                className="ls-btn-ghost ls-btn-sm"
                onClick={() => setIsModalOpen(false)}
              >
                Chiudi
              </button>
            </div>

            <div className="p-4 max-h-[70vh] overflow-y-auto space-y-3">
              {html_security.details.map((detail: any, index: number) => (
                <div key={`modal-row-${detail.id}-${index}`} className="p-3 bg-white rounded-lg border border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-slate-800">{detail.name}</span>
                    </div>
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        detail.severity === 'critical'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : detail.severity === 'major'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-blue-50 text-blue-700 border border-blue-200'
                      }`}
                    >
                      {detail.severity}
                    </span>
                  </div>

                  <div className="space-y-1 mb-2">
                    {detail.issues.map((issue: any, idx: number) => (
                      <div key={idx} className="text-xs text-slate-600">
                        - {issue.message}
                        {issue.url && (
                          <a className="text-blue-600 ml-1 underline" href={issue.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                            (ref)
                          </a>
                        )}
                      </div>
                    ))}
                  </div>

                  {detail.suggestion && (
                    <div className="text-xs text-blue-600">{'->'} {detail.suggestion}</div>
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


