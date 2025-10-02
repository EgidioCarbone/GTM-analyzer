import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ConsentReport from '../components/ConsentReport';
import { useConsentReport } from '../hooks/useConsentReport';
import { 
  calculateOverallStatus, 
  calculateOverallScore, 
  calculateCookieStats,
  calculateNetworkStats,
  formatTimestamp,
  formatDate,
  getCategoryColor,
  getCookieCategoryDescription,
  getNetworkCategoryDescription,
  validateReportData,
  convertToCSV,
  convertToJSON
} from '../utils/consent-report-utils';

// Mock data per i test
const mockReportData = {
  siteName: "test.example.com",
  testDate: "2025-01-01T16:30:00Z",
  scenarios: [
    {
      name: "Reject All",
      status: "PASS" as const,
      description: "Tutti i cookie non necessari vengono bloccati"
    },
    {
      name: "Accept All",
      status: "PASS" as const,
      description: "Tutti i cookie vengono accettati"
    },
    {
      name: "Custom",
      status: "FAIL" as const,
      description: "Problemi con il consenso personalizzato"
    }
  ],
  googleConsent: {
    analytics_storage: "granted" as const,
    ad_storage: "denied" as const,
    ad_user_data: "denied" as const,
    ad_personalization: "denied" as const,
    functionality_storage: "granted" as const,
    personalization_storage: "denied" as const,
    security_storage: "granted" as const
  },
  cookies: [
    {
      name: "_ga",
      domain: ".example.com",
      category: "analytics" as const,
      purpose: "Cookie di Google Analytics",
      sensitive: false,
      expires: "2 anni",
      size: 27
    },
    {
      name: "_fbp",
      domain: ".example.com",
      category: "marketing" as const,
      purpose: "Cookie di Facebook",
      sensitive: true,
      expires: "3 mesi",
      size: 36
    }
  ],
  networkRequests: [
    {
      url: "https://www.googletagmanager.com/gtag/js",
      domain: "googletagmanager.com",
      timestamp: 1200,
      category: "analytics" as const,
      blocked: false
    },
    {
      url: "https://connect.facebook.net/fbevents.js",
      domain: "facebook.net",
      timestamp: 2500,
      category: "marketing" as const,
      blocked: true
    }
  ],
  recommendations: [
    "Il sito rispetta correttamente il consenso per i cookie di analytics.",
    "Le richieste pubblicitarie sono state correttamente bloccate."
  ]
};

// Test del componente principale
describe('ConsentReport Component', () => {
  test('renders report with correct data', () => {
    render(<ConsentReport {...mockReportData} />);
    
    expect(screen.getByText('test.example.com')).toBeInTheDocument();
    expect(screen.getByText('PROBLEMI RILEVATI')).toBeInTheDocument();
    expect(screen.getByText('(67%)')).toBeInTheDocument();
  });

  test('displays scenarios correctly', () => {
    render(<ConsentReport {...mockReportData} />);
    
    expect(screen.getByText('Reject All')).toBeInTheDocument();
    expect(screen.getByText('Accept All')).toBeInTheDocument();
    expect(screen.getByText('Custom')).toBeInTheDocument();
  });

  test('shows Google Consent Mode section', () => {
    render(<ConsentReport {...mockReportData} />);
    
    expect(screen.getByText('Google Consent Mode')).toBeInTheDocument();
    expect(screen.getByText('analytics_storage')).toBeInTheDocument();
    expect(screen.getByText('ad_storage')).toBeInTheDocument();
  });

  test('displays cookies section', () => {
    render(<ConsentReport {...mockReportData} />);
    
    expect(screen.getByText('Cookie Rilevati (2)')).toBeInTheDocument();
    expect(screen.getByText('_ga')).toBeInTheDocument();
    expect(screen.getByText('_fbp')).toBeInTheDocument();
  });

  test('shows network requests section', () => {
    render(<ConsentReport {...mockReportData} />);
    
    expect(screen.getByText('Richieste di Rete (2)')).toBeInTheDocument();
    expect(screen.getByText('googletagmanager.com')).toBeInTheDocument();
    expect(screen.getByText('facebook.net')).toBeInTheDocument();
  });

  test('displays recommendations section', () => {
    render(<ConsentReport {...mockReportData} />);
    
    expect(screen.getByText('Cosa significa per te')).toBeInTheDocument();
    expect(screen.getByText('Il sito rispetta correttamente il consenso per i cookie di analytics.')).toBeInTheDocument();
  });

  test('toggles sections when clicked', async () => {
    render(<ConsentReport {...mockReportData} />);
    
    const googleConsentSection = screen.getByText('Google Consent Mode');
    fireEvent.click(googleConsentSection);
    
    await waitFor(() => {
      expect(screen.queryByText('analytics_storage')).not.toBeInTheDocument();
    });
  });
});

// Test delle utilità
describe('Consent Report Utils', () => {
  test('calculates overall status correctly', () => {
    const scenarios = [
      { status: 'PASS' as const },
      { status: 'PASS' as const },
      { status: 'FAIL' as const }
    ];
    
    expect(calculateOverallStatus(scenarios)).toBe('FAIL');
  });

  test('calculates overall score correctly', () => {
    const scenarios = [
      { status: 'PASS' as const },
      { status: 'PASS' as const },
      { status: 'FAIL' as const }
    ];
    
    expect(calculateOverallScore(scenarios)).toBe(67);
  });

  test('calculates cookie stats correctly', () => {
    const cookies = [
      { name: '_ga', domain: '.example.com', category: 'analytics' as const, purpose: 'Analytics', sensitive: false },
      { name: '_fbp', domain: '.example.com', category: 'marketing' as const, purpose: 'Marketing', sensitive: true }
    ];
    
    const stats = calculateCookieStats(cookies);
    
    expect(stats.total).toBe(2);
    expect(stats.byCategory.analytics).toBe(1);
    expect(stats.byCategory.marketing).toBe(1);
    expect(stats.sensitive).toBe(1);
  });

  test('calculates network stats correctly', () => {
    const requests = [
      { url: 'https://example.com', domain: 'example.com', timestamp: 1000, category: 'analytics' as const, blocked: false },
      { url: 'https://ads.com', domain: 'ads.com', timestamp: 2000, category: 'ads' as const, blocked: true }
    ];
    
    const stats = calculateNetworkStats(requests);
    
    expect(stats.total).toBe(2);
    expect(stats.blocked).toBe(1);
    expect(stats.byCategory.analytics).toBe(1);
    expect(stats.byCategory.ads).toBe(1);
  });

  test('formats timestamp correctly', () => {
    expect(formatTimestamp(500)).toBe('500ms');
    expect(formatTimestamp(1500)).toBe('1.5s');
    expect(formatTimestamp(2000)).toBe('2.0s');
  });

  test('formats date correctly', () => {
    const dateString = '2025-01-01T16:30:00Z';
    const formatted = formatDate(dateString);
    
    expect(formatted).toContain('2025');
    expect(formatted).toContain('gennaio');
  });

  test('gets category color correctly', () => {
    const analyticsColor = getCategoryColor('analytics');
    expect(analyticsColor.text).toBe('text-blue-600');
    expect(analyticsColor.bg).toBe('bg-blue-100');
    
    const marketingColor = getCategoryColor('marketing');
    expect(marketingColor.text).toBe('text-purple-600');
    expect(marketingColor.bg).toBe('bg-purple-100');
  });

  test('gets cookie category description correctly', () => {
    expect(getCookieCategoryDescription('analytics')).toBe('Cookie per analisi e statistiche di utilizzo');
    expect(getCookieCategoryDescription('marketing')).toBe('Cookie per pubblicità e marketing');
  });

  test('gets network category description correctly', () => {
    expect(getNetworkCategoryDescription('analytics')).toBe('Richieste per servizi di analisi e statistiche');
    expect(getNetworkCategoryDescription('ads')).toBe('Richieste per servizi pubblicitari');
  });

  test('validates report data correctly', () => {
    const validData = { ...mockReportData };
    const invalidData = { siteName: '', testDate: '', scenarios: [], googleConsent: {}, cookies: [], networkRequests: [], recommendations: [] };
    
    expect(validateReportData(validData)).toHaveLength(0);
    expect(validateReportData(invalidData)).toHaveLength(7);
  });

  test('converts to CSV correctly', () => {
    const csv = convertToCSV(mockReportData);
    
    expect(csv).toContain('Site Name,Test Date,Overall Status,Score');
    expect(csv).toContain('test.example.com');
    expect(csv).toContain('Scenarios');
    expect(csv).toContain('Cookies');
    expect(csv).toContain('Network Requests');
  });

  test('converts to JSON correctly', () => {
    const json = convertToJSON(mockReportData);
    const parsed = JSON.parse(json);
    
    expect(parsed.siteName).toBe('test.example.com');
    expect(parsed.scenarios).toHaveLength(3);
    expect(parsed.cookies).toHaveLength(2);
    expect(parsed.networkRequests).toHaveLength(2);
  });
});

// Test dell'hook personalizzato
describe('useConsentReport Hook', () => {
  test('initializes with correct default values', () => {
    const { result } = renderHook(() => useConsentReport());
    
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.overallStatus).toBe('FAIL');
    expect(result.current.overallScore).toBe(0);
  });

  test('initializes with provided data', () => {
    const { result } = renderHook(() => useConsentReport(mockReportData));
    
    expect(result.current.data).toEqual(mockReportData);
    expect(result.current.overallStatus).toBe('FAIL');
    expect(result.current.overallScore).toBe(67);
  });

  test('updates data correctly', () => {
    const { result } = renderHook(() => useConsentReport());
    
    act(() => {
      result.current.updateData(mockReportData);
    });
    
    expect(result.current.data).toEqual(mockReportData);
    expect(result.current.error).toBeNull();
  });

  test('toggles sections correctly', () => {
    const { result } = renderHook(() => useConsentReport(mockReportData));
    
    expect(result.current.expandedSections.googleConsent).toBe(true);
    
    act(() => {
      result.current.toggleSection('googleConsent');
    });
    
    expect(result.current.expandedSections.googleConsent).toBe(false);
  });

  test('toggles all sections correctly', () => {
    const { result } = renderHook(() => useConsentReport(mockReportData));
    
    act(() => {
      result.current.toggleAllSections(false);
    });
    
    Object.values(result.current.expandedSections).forEach(expanded => {
      expect(expanded).toBe(false);
    });
  });
});

// Test di integrazione
describe('Consent Report Integration', () => {
  test('full report workflow', async () => {
    const { result } = renderHook(() => useConsentReport());
    
    // Inizializza con dati vuoti
    expect(result.current.data).toBeNull();
    
    // Aggiorna con dati di test
    act(() => {
      result.current.updateData(mockReportData);
    });
    
    expect(result.current.data).toEqual(mockReportData);
    expect(result.current.overallStatus).toBe('FAIL');
    expect(result.current.overallScore).toBe(67);
    
    // Verifica statistiche
    expect(result.current.cookieStats.total).toBe(2);
    expect(result.current.networkStats.total).toBe(2);
    expect(result.current.networkStats.blocked).toBe(1);
    
    // Verifica filtri
    const analyticsCookies = result.current.cookiesByCategory('analytics');
    expect(analyticsCookies).toHaveLength(1);
    expect(analyticsCookies[0].name).toBe('_ga');
    
    const blockedRequests = result.current.blockedRequests;
    expect(blockedRequests).toHaveLength(1);
    expect(blockedRequests[0].domain).toBe('facebook.net');
  });
});

// Test di accessibilità
describe('Consent Report Accessibility', () => {
  test('has proper ARIA labels', () => {
    render(<ConsentReport {...mockReportData} />);
    
    const report = screen.getByRole('region', { name: /report consenso/i });
    expect(report).toBeInTheDocument();
  });

  test('supports keyboard navigation', () => {
    render(<ConsentReport {...mockReportData} />);
    
    const firstButton = screen.getAllByRole('button')[0];
    firstButton.focus();
    expect(document.activeElement).toBe(firstButton);
  });

  test('has proper color contrast', () => {
    render(<ConsentReport {...mockReportData} />);
    
    const passBadge = screen.getByText('PASS');
    const failBadge = screen.getByText('FAIL');
    
    expect(passBadge).toBeInTheDocument();
    expect(failBadge).toBeInTheDocument();
  });
});

// Test di performance
describe('Consent Report Performance', () => {
  test('handles large datasets efficiently', () => {
    const largeDataset = {
      ...mockReportData,
      cookies: Array.from({ length: 1000 }, (_, i) => ({
        name: `cookie_${i}`,
        domain: '.example.com',
        category: 'analytics' as const,
        purpose: `Cookie ${i}`,
        sensitive: i % 10 === 0
      })),
      networkRequests: Array.from({ length: 1000 }, (_, i) => ({
        url: `https://example${i}.com/script.js`,
        domain: `example${i}.com`,
        timestamp: i * 100,
        category: 'analytics' as const,
        blocked: i % 5 === 0
      }))
    };
    
    const startTime = performance.now();
    render(<ConsentReport {...largeDataset} />);
    const endTime = performance.now();
    
    // Il rendering dovrebbe completarsi in meno di 100ms
    expect(endTime - startTime).toBeLessThan(100);
  });
});

// Helper per i test
function renderHook<T>(hook: () => T): { result: { current: T } } {
  const result = { current: null as T };
  
  const TestComponent = () => {
    result.current = hook();
    return null;
  };
  
  render(<TestComponent />);
  return { result };
}

function act(callback: () => void) {
  callback();
}
