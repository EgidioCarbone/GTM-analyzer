// Tipi TypeScript per il sistema di report consenso

export type ConsentStatus = 'granted' | 'denied';
export type TestStatus = 'PASS' | 'FAIL';
export type CookieCategory = 'necessary' | 'analytics' | 'marketing' | 'preferences';
export type NetworkCategory = 'analytics' | 'ads' | 'marketing' | 'other';

export interface Scenario {
  name: string;
  status: TestStatus;
  description: string;
  weight?: number;
  score?: number;
  issues?: string[];
}

export interface GoogleConsentMode {
  analytics_storage: ConsentStatus;
  ad_storage: ConsentStatus;
  ad_user_data: ConsentStatus;
  ad_personalization: ConsentStatus;
  functionality_storage: ConsentStatus;
  personalization_storage: ConsentStatus;
  security_storage: ConsentStatus;
}

export interface CookieData {
  name: string;
  domain: string;
  category: CookieCategory;
  purpose: string;
  sensitive: boolean;
  expires?: string;
  size?: number;
}

export interface NetworkRequest {
  url: string;
  domain: string;
  timestamp: number;
  category: NetworkCategory;
  blocked: boolean;
  frameUrl?: string;
  resourceType?: string;
  method?: string;
}

export interface ConsentReportData {
  siteName: string;
  testDate: string;
  scenarios: Scenario[];
  googleConsent: GoogleConsentMode;
  cookies: CookieData[];
  networkRequests: NetworkRequest[];
  recommendations: string[];
}

export interface ConsentReportStats {
  overallStatus: TestStatus;
  overallScore: number;
  cookieStats: {
    total: number;
    byCategory: Record<CookieCategory, number>;
    sensitive: number;
  };
  networkStats: {
    total: number;
    blocked: number;
    byCategory: Record<NetworkCategory, number>;
  };
}

export interface ConsentReportOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
  onDataChange?: (data: ConsentReportData) => void;
}

export interface ConsentReportState {
  data: ConsentReportData | null;
  loading: boolean;
  error: string | null;
  expandedSections: Record<string, boolean>;
}

export interface ConsentReportActions {
  updateData: (data: ConsentReportData) => void;
  loadData: (url: string) => Promise<void>;
  exportData: (format: 'json' | 'csv') => void;
  toggleSection: (section: string) => void;
  toggleAllSections: (expand: boolean) => void;
}

export interface ConsentReportComputed {
  overallStatus: TestStatus;
  overallScore: number;
  cookieStats: ConsentReportStats['cookieStats'];
  networkStats: ConsentReportStats['networkStats'];
  cookiesByCategory: (category: CookieCategory) => CookieData[];
  networkRequestsByCategory: (category: NetworkCategory) => NetworkRequest[];
  blockedRequests: NetworkRequest[];
  allowedRequests: NetworkRequest[];
}

export interface ConsentReportHook extends ConsentReportState, ConsentReportActions, ConsentReportComputed {
  setData: (data: ConsentReportData | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

// Tipi per i componenti
export interface ConsentReportProps {
  siteName: string;
  testDate: string;
  scenarios: Scenario[];
  googleConsent: GoogleConsentMode;
  cookies: CookieData[];
  networkRequests: NetworkRequest[];
  recommendations: string[];
}

export interface NetworkTimelineProps {
  requests: NetworkRequest[];
  maxHeight?: string;
  showFilters?: boolean;
  showSearch?: boolean;
}

export interface CookieListProps {
  cookies: CookieData[];
  maxHeight?: string;
  showFilters?: boolean;
  showSearch?: boolean;
  showDetails?: boolean;
}

// Tipi per i filtri
export interface FilterOptions {
  category?: string;
  status?: string;
  search?: string;
  sensitive?: string;
}

export interface SortOptions {
  field: 'name' | 'category' | 'domain' | 'timestamp';
  order: 'asc' | 'desc';
}

// Tipi per l'esportazione
export interface ExportOptions {
  format: 'json' | 'csv' | 'pdf';
  includeDetails?: boolean;
  dateRange?: {
    from: string;
    to: string;
  };
}

// Tipi per le notifiche
export interface NotificationOptions {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

// Tipi per i tooltip
export interface TooltipContent {
  title: string;
  description: string;
  examples?: string[];
  related?: string[];
}

// Tipi per le raccomandazioni
export interface Recommendation {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  description: string;
  action?: {
    label: string;
    url?: string;
    onClick?: () => void;
  };
  priority: 'high' | 'medium' | 'low';
}

// Tipi per la configurazione del tema
export interface ThemeConfig {
  colors: {
    success: string;
    error: string;
    warning: string;
    info: string;
    primary: string;
    secondary: string;
  };
  fonts: {
    primary: string;
    secondary: string;
    mono: string;
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  borderRadius: {
    sm: string;
    md: string;
    lg: string;
  };
}

// Tipi per la configurazione responsive
export interface ResponsiveConfig {
  breakpoints: {
    mobile: number;
    tablet: number;
    desktop: number;
  };
  grid: {
    columns: {
      mobile: number;
      tablet: number;
      desktop: number;
    };
    gap: {
      mobile: string;
      tablet: string;
      desktop: string;
    };
  };
}

// Tipi per l'accessibilità
export interface AccessibilityConfig {
  ariaLabels: {
    expandSection: string;
    collapseSection: string;
    filterBy: string;
    sortBy: string;
    exportData: string;
    printReport: string;
  };
  keyboardShortcuts: {
    toggleAllSections: string;
    exportJson: string;
    exportCsv: string;
    print: string;
  };
}

// Tipi per la configurazione completa
export interface ConsentReportConfig {
  theme: ThemeConfig;
  responsive: ResponsiveConfig;
  accessibility: AccessibilityConfig;
  features: {
    autoRefresh: boolean;
    realTimeUpdates: boolean;
    exportEnabled: boolean;
    printEnabled: boolean;
    searchEnabled: boolean;
    filtersEnabled: boolean;
  };
}
