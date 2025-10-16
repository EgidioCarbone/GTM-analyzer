import React, { useState, useMemo } from 'react';
import { List } from 'react-window';
import { ExternalLink, ChevronDown, ChevronRight, Copy, Eye } from 'lucide-react';
import type { NormalizedEvent } from '../../types/live-debugger';
import type { FilterState } from '../../types/filters';

interface NetworkTableProps {
  events: NormalizedEvent[];
  filters: FilterState;
  onEventSelect: (event: NormalizedEvent) => void;
}

interface NetworkRowProps {
  index: number;
  style: React.CSSProperties;
  data: {
    events: Array<Extract<NormalizedEvent, { kind: 'ga4.hit' | 'ua.hit' }>>;
    expanded: Set<number>;
    onToggleExpand: (idx: number) => void;
    onEventSelect: (event: NormalizedEvent) => void;
  };
}

function NetworkRow({ index, style, data }: NetworkRowProps) {
  const { events, expanded, onToggleExpand, onEventSelect } = data;
  const event = events[index];

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString('it-IT', { 
      hour12: false, 
      fractionalSecondDigits: 3 
    });
  };

  const getStatusColor = (status?: number) => {
    if (!status) return 'text-gray-500';
    if (status >= 200 && status < 300) return 'text-green-600';
    if (status >= 300 && status < 400) return 'text-blue-600';
    if (status >= 400 && status < 500) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getEventTypeColor = (kind: string) => {
    return kind === 'ga4.hit' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800';
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const isExpanded = expanded.has(index);

  return (
    <div style={style} className="px-4 py-2 border-b border-gray-100 hover:bg-gray-50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button
            onClick={() => onToggleExpand(index)}
            className="p-1 hover:bg-gray-200 rounded flex-shrink-0"
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-500" />
            )}
          </button>
          
          <span className={`text-xs px-2 py-1 rounded flex-shrink-0 ${getEventTypeColor(event.kind)}`}>
            {event.kind === 'ga4.hit' ? 'GA4' : 'UA'}
          </span>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-gray-900 flex-shrink-0">
                {formatTime(event.ts)}
              </span>
              <span className={`text-sm font-medium ${getStatusColor(event.status)} flex-shrink-0`}>
                {event.status || '—'}
              </span>
            </div>
            
            <div className="text-sm text-gray-600 truncate">
              {event.kind === 'ga4.hit' ? event.event?.name || 'Unknown Event' : 'Universal Analytics'}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2 flex-shrink-0">
          {event.mi && (
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
              {event.mi}
            </span>
          )}
          {event.cid && (
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
              {event.cid.slice(0, 8)}...
            </span>
          )}
          
          <button
            onClick={() => onEventSelect(event)}
            className="p-1 text-gray-400 hover:text-blue-600"
            title="Inspect Event"
          >
            <Eye className="w-4 h-4" />
          </button>
          
          <a
            href={event.url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 text-gray-400 hover:text-gray-600"
            title="Open URL"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-3 pl-8 space-y-3">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-700">URL Completo</h4>
              <button
                onClick={() => copyToClipboard(event.url)}
                className="p-1 text-gray-400 hover:text-gray-600"
                title="Copy URL"
              >
                <Copy className="w-3 h-3" />
              </button>
            </div>
            <div className="bg-gray-50 p-2 rounded text-sm font-mono break-all">
              {event.url}
            </div>
          </div>
          
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Parametri</h4>
            <div className="bg-gray-50 p-2 rounded max-h-48 overflow-y-auto">
              <table className="w-full text-sm">
                <tbody>
                  {event.kind === 'ga4.hit' && event.event ? (
                    Object.entries(event.event).map(([key, value]) => (
                      <tr key={key} className="border-b border-gray-200 last:border-b-0">
                        <td className="py-1 pr-2 font-medium text-gray-600">{key}</td>
                        <td className="py-1 text-gray-900 font-mono">{String(value)}</td>
                      </tr>
                    ))
                  ) : (
                    Object.entries(event.params).map(([key, value]) => (
                      <tr key={key} className="border-b border-gray-200 last:border-b-0">
                        <td className="py-1 pr-2 font-medium text-gray-600">{key}</td>
                        <td className="py-1 text-gray-900 font-mono">{String(value)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function NetworkTable({ events, filters, onEventSelect }: NetworkTableProps) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const gaEvents = useMemo(() => {
    return (events
      .filter((e) => e.kind === 'ga4.hit' || e.kind === 'ua.hit') as Array<
      Extract<NormalizedEvent, { kind: 'ga4.hit' | 'ua.hit' }>
    >)
      .sort((a, b) => b.ts - a.ts); // Ordine cronologico decrescente
  }, [events]);

  const toggleExpand = (idx: number) => {
    const newExpanded = new Set(expanded);
    if (newExpanded.has(idx)) {
      newExpanded.delete(idx);
    } else {
      newExpanded.add(idx);
    }
    setExpanded(newExpanded);
  };

  const listData = {
    events: gaEvents,
    expanded,
    onToggleExpand: toggleExpand,
    onEventSelect
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-full flex flex-col">
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex-shrink-0">
        <h3 className="font-semibold text-gray-700">GA Network Hits ({gaEvents.length})</h3>
      </div>

      <div className="flex-1 min-h-0">
        {gaEvents.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p>Nessun hit GA rilevato</p>
            <p className="text-sm mt-1">I dati appariranno qui quando verranno intercettate richieste GA</p>
          </div>
        ) : (
          <List
            height={400}
            itemCount={gaEvents.length}
            itemSize={80}
            itemData={listData}
            className="scrollbar-thin scrollbar-thumb-gray-300"
          >
            {NetworkRow}
          </List>
        )}
      </div>
    </div>
  );
}
