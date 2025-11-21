// @ts-nocheck
import React, { useState, useMemo } from 'react';
import { List } from 'react-window';
import { ChevronDown, ChevronRight, Copy, RotateCcw, GitCompare } from 'lucide-react';
import { JsonView } from 'react-json-view-lite';
import type { NormalizedEvent } from '../../types/live-debugger';
import type { FilterState } from '../../types/filters';

interface DataLayerListProps {
  events: NormalizedEvent[];
  filters: FilterState;
  onEventSelect: (event: NormalizedEvent) => void;
  onRepush: (payload: any) => void;
}

interface DataLayerRowProps {
  ariaAttributes: {
    "aria-posinset": number;
    "aria-setsize": number;
    role: "listitem";
  };
  index: number;
  style: React.CSSProperties;
  events: Array<Extract<NormalizedEvent, { kind: 'datalayer.push' }>>;
  expanded: Set<number>;
  onToggleExpand: (idx: number) => void;
  onEventSelect: (event: NormalizedEvent) => void;
  onRepush: (payload: any) => void;
}

function DataLayerRow({ index, style, events, expanded, onToggleExpand, onEventSelect, onRepush }: DataLayerRowProps) {
  const event = events[index];

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString('it-IT', { 
      hour12: false, 
      fractionalSecondDigits: 3 
    });
  };

  const getSourceColor = (source: string) => {
    return source === 'hook' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800';
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const isExpanded = expanded.has(index);
  const eventName = event.payload?.event || 'Unknown Event';

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
          
          <span className={`text-xs px-2 py-1 rounded flex-shrink-0 ${getSourceColor(event.source)}`}>
            {event.source.toUpperCase()}
          </span>
          
          <span className="text-xs text-gray-500 font-mono flex-shrink-0">
            #{index + 1}
          </span>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-gray-900 flex-shrink-0">
                {formatTime(event.ts)}
              </span>
              <span className="text-sm font-medium text-gray-700 truncate">
                {eventName}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => onRepush(event.payload)}
            className="p-1 text-gray-400 hover:text-green-600"
            title="Re-push Event"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          
          <button
            onClick={() => onEventSelect(event)}
            className="p-1 text-gray-400 hover:text-blue-600"
            title="Inspect Event"
          >
            <GitCompare className="w-4 h-4" />
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-3 pl-8 space-y-3">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-700">Payload JSON</h4>
              <button
                onClick={() => copyToClipboard(JSON.stringify(event.payload, null, 2))}
                className="p-1 text-gray-400 hover:text-gray-600"
                title="Copy JSON"
              >
                <Copy className="w-3 h-3" />
              </button>
            </div>
            <div className="bg-gray-50 p-3 rounded border max-h-64 overflow-y-auto">
              <JsonView
                data={event.payload}
                collapsed={1}
                style={{
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  lineHeight: '1.4'
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function DataLayerList({ events, filters, onEventSelect, onRepush }: DataLayerListProps) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const dlEvents = useMemo(() => {
    return (events
      .filter((e) => e.kind === 'datalayer.push') as Array<
      Extract<NormalizedEvent, { kind: 'datalayer.push' }>
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

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-full flex flex-col">
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex-shrink-0">
        <h3 className="font-semibold text-gray-700">DataLayer Events ({dlEvents.length})</h3>
      </div>

      <div className="flex-1 min-h-0">
        {dlEvents.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p>Nessun evento DataLayer</p>
            <p className="text-sm mt-1">I push al dataLayer appariranno qui</p>
          </div>
        ) : (
          <List
            defaultHeight={400}
            rowCount={dlEvents.length}
            rowHeight={60}
            rowProps={{
              events: dlEvents,
              expanded,
              onToggleExpand: toggleExpand,
              onEventSelect,
              onRepush
            }}
            rowComponent={DataLayerRow}
            className="scrollbar-thin scrollbar-thumb-gray-300"
          />
        )}
      </div>
    </div>
  );
}
// @ts-nocheck
