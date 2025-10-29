export interface FilterState {
  // Time range
  timeRange: '30s' | '1m' | '5m' | '15m' | 'all';
  customTimeRange?: { start: number; end: number };
  
  // Event types
  types: {
    datalayer: boolean;
    ga4: boolean;
    ua: boolean;
    meta: boolean;
    linkedin: boolean;
    adobe: boolean;
    pageview: boolean;
    console: boolean;
    env: boolean;
  };
  
  // GA specific
  gaOnly: boolean;
  eventNames: string[];
  measurementIds: string[];
  cid: string;
  statusCodes: (200 | 204 | 400 | 401 | 403 | 404 | 500 | 502 | 503)[];
  
  // URL/Endpoint
  hostFilter: 'all' | 'google-analytics.com' | 'region' | 'custom';
  customHostRegex: string;
  
  // Search
  searchText: string;
  
  // UI state
  isPaused: boolean;
  showInspector: boolean;
  selectedEventId?: string;
}

export interface ChartData {
  hits: Array<{ time: number; count: number; ga4: number; ua: number }>;
  statusDistribution: Array<{ status: string; count: number; color: string }>;
  topEvents: Array<{ event: string; count: number }>;
}

export interface EventSummary {
  total: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  byEvent: Record<string, number>;
  timeRange: { start: number; end: number };
}

export interface VirtualizedItem {
  id: string;
  index: number;
  event: any;
  height: number;
}
