import React, { useState } from 'react';
import type { NormalizedEvent } from '../../types/live-debugger';

interface DataLayerPanelProps {
  events: NormalizedEvent[];
}

export function DataLayerPanel({ events }: DataLayerPanelProps) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const dlEvents = (events
    .filter((e) => e.kind === 'datalayer.push') as Array<
    Extract<NormalizedEvent, { kind: 'datalayer.push' }>
  >)
    .sort((a, b) => b.ts - a.ts); // Ordine cronologico decrescente (più recenti in alto)

  const toggleExpand = (idx: number) => {
    const newExpanded = new Set(expanded);
    if (newExpanded.has(idx)) {
      newExpanded.delete(idx);
    } else {
      newExpanded.add(idx);
    }
    setExpanded(newExpanded);
  };

  const formatTime = (ts: number) => {
    const date = new Date(ts);
    return date.toLocaleTimeString('it-IT', { hour12: false, fractionalSecondDigits: 3 });
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden flex flex-col h-full">
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
        <h3 className="font-semibold text-gray-700">
          DataLayer ({dlEvents.length})
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto">
        {dlEvents.length === 0 ? (
          <div className="p-4 text-gray-500 text-sm text-center">
            Nessun evento dataLayer ancora
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {dlEvents.map((evt, idx) => {
              const isExpanded = expanded.has(idx);
              const source = evt.source === 'snapshot' ? 'SNAP' : 'HOOK';
              const sourceColor = evt.source === 'snapshot' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800';

              return (
                <div key={idx} className="p-3 hover:bg-gray-50 transition-colors">
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => toggleExpand(idx)}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-mono px-2 py-0.5 rounded ${sourceColor}`}>
                        {source}
                      </span>
                      <span className="text-xs text-gray-500 font-mono">
                        {formatTime(evt.ts)}
                      </span>
                    </div>
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>

                  {isExpanded && (
                    <pre className="mt-2 text-xs bg-gray-900 text-green-400 p-2 rounded overflow-x-auto">
                      {JSON.stringify(evt.payload, null, 2)}
                    </pre>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
