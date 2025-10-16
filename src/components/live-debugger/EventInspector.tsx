import React, { useState } from 'react';
import { X, Copy, Search, Download, Eye, EyeOff } from 'lucide-react';
import { JsonView } from 'react-json-view-lite';
import type { NormalizedEvent } from '../../types/live-debugger';

interface EventInspectorProps {
  event: NormalizedEvent | null;
  isOpen: boolean;
  onClose: () => void;
}

export function EventInspector({ event, isOpen, onClose }: EventInspectorProps) {
  const [activeTab, setActiveTab] = useState<'tree' | 'params' | 'raw' | 'diff'>('tree');
  const [searchTerm, setSearchTerm] = useState('');
  const [expanded, setExpanded] = useState(true);

  if (!isOpen || !event) return null;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleString('it-IT', { 
      hour12: false, 
      fractionalSecondDigits: 3 
    });
  };

  const getEventTypeInfo = (event: NormalizedEvent) => {
    switch (event.kind) {
      case 'ga4.hit':
        return {
          type: 'GA4 Hit',
          color: 'bg-blue-100 text-blue-800',
          icon: '📊'
        };
      case 'ua.hit':
        return {
          type: 'UA Hit',
          color: 'bg-green-100 text-green-800',
          icon: '📈'
        };
      case 'datalayer.push':
        return {
          type: 'DataLayer Push',
          color: 'bg-purple-100 text-purple-800',
          icon: '📦'
        };
      case 'console':
        return {
          type: 'Console',
          color: 'bg-yellow-100 text-yellow-800',
          icon: '💬'
        };
      case 'env':
        return {
          type: 'Environment',
          color: 'bg-gray-100 text-gray-800',
          icon: '🌍'
        };
      default:
        return {
          type: 'Unknown',
          color: 'bg-gray-100 text-gray-800',
          icon: '❓'
        };
    }
  };

  const getEventData = (event: NormalizedEvent) => {
    switch (event.kind) {
      case 'ga4.hit':
        return {
          url: event.url,
          status: event.status,
          event: event.event,
          mi: event.mi,
          cid: event.cid,
          timestamp: event.ts
        };
      case 'ua.hit':
        return {
          url: event.url,
          status: event.status,
          params: event.params,
          timestamp: event.ts
        };
      case 'datalayer.push':
        return {
          source: event.source,
          payload: event.payload,
          timestamp: event.ts
        };
      case 'console':
        return {
          level: event.level,
          text: event.text,
          timestamp: event.ts
        };
      case 'env':
        return {
          env: event.env,
          timestamp: event.ts
        };
      default:
        return event;
    }
  };

  const eventInfo = getEventTypeInfo(event);
  const eventData = getEventData(event);

  const tabs = [
    { id: 'tree', label: 'Tree', icon: '🌳' },
    { id: 'params', label: 'Params', icon: '📋' },
    { id: 'raw', label: 'Raw', icon: '📄' },
    { id: 'diff', label: 'Diff', icon: '🔄' }
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'tree':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cerca nelle chiavi..."
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div className="bg-gray-50 p-4 rounded border max-h-96 overflow-y-auto">
              <JsonView
                data={eventData}
                collapsed={expanded ? 1 : 0}
                style={{
                  fontSize: '13px',
                  fontFamily: 'monospace',
                  lineHeight: '1.5'
                }}
              />
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                {expanded ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                {expanded ? 'Collapse All' : 'Expand All'}
              </button>
              
              <button
                onClick={() => copyToClipboard(JSON.stringify(eventData, null, 2))}
                className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
              >
                <Copy className="w-4 h-4" />
                Copy JSON
              </button>
            </div>
          </div>
        );

      case 'params':
        const params = event.kind === 'ga4.hit' ? event.event : 
                      event.kind === 'ua.hit' ? event.params : 
                      event.kind === 'datalayer.push' ? event.payload : {};
        
        return (
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded border max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 font-medium text-gray-700">Key</th>
                    <th className="text-left py-2 font-medium text-gray-700">Value</th>
                    <th className="text-left py-2 font-medium text-gray-700">Type</th>
                    <th className="text-left py-2 font-medium text-gray-700"></th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(params).map(([key, value]) => (
                    <tr key={key} className="border-b border-gray-100">
                      <td className="py-2 pr-2 font-medium text-gray-600">{key}</td>
                      <td className="py-2 pr-2 text-gray-900 font-mono text-xs">
                        {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                      </td>
                      <td className="py-2 pr-2 text-gray-500 text-xs">
                        {typeof value}
                      </td>
                      <td className="py-2">
                        <button
                          onClick={() => copyToClipboard(String(value))}
                          className="p-1 text-gray-400 hover:text-gray-600"
                          title="Copy Value"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <button
              onClick={() => copyToClipboard(JSON.stringify(params, null, 2))}
              className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
            >
              <Copy className="w-4 h-4" />
              Copy All Params
            </button>
          </div>
        );

      case 'raw':
        return (
          <div className="space-y-4">
            <div className="bg-gray-900 text-green-400 p-4 rounded font-mono text-sm max-h-96 overflow-y-auto">
              <pre>{JSON.stringify(event, null, 2)}</pre>
            </div>
            
            <button
              onClick={() => copyToClipboard(JSON.stringify(event, null, 2))}
              className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
            >
              <Copy className="w-4 h-4" />
              Copy Raw JSON
            </button>
          </div>
        );

      case 'diff':
        return (
          <div className="space-y-4">
            <div className="text-center text-gray-500 py-8">
              <p>Diff functionality coming soon</p>
              <p className="text-sm">Compare events side by side</p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose} />
      
      <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-xl">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{eventInfo.icon}</span>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{eventInfo.type}</h3>
                <p className="text-sm text-gray-500">{formatTime(event.ts)}</p>
              </div>
            </div>
            
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 bg-blue-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 p-4 overflow-y-auto">
            {renderTabContent()}
          </div>
        </div>
      </div>
    </div>
  );
}
