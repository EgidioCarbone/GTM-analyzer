// Configurazione per il sistema di report consenso

import { ConsentReportConfig } from '../types/consent-report';

export const defaultConsentReportConfig: ConsentReportConfig = {
  theme: {
    colors: {
      success: '#10b981',
      error: '#ef4444',
      warning: '#f59e0b',
      info: '#3b82f6',
      primary: '#1f2937',
      secondary: '#6b7280'
    },
    fonts: {
      primary: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      secondary: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      mono: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace'
    },
    spacing: {
      xs: '0.25rem',
      sm: '0.5rem',
      md: '1rem',
      lg: '1.5rem',
      xl: '2rem'
    },
    borderRadius: {
      sm: '0.25rem',
      md: '0.5rem',
      lg: '0.75rem'
    }
  },
  responsive: {
    breakpoints: {
      mobile: 768,
      tablet: 1024,
      desktop: 1280
    },
    grid: {
      columns: {
        mobile: 1,
        tablet: 2,
        desktop: 2
      },
      gap: {
        mobile: '1rem',
        tablet: '1.5rem',
        desktop: '2rem'
      }
    }
  },
  accessibility: {
    ariaLabels: {
      expandSection: 'Espandi sezione',
      collapseSection: 'Collassa sezione',
      filterBy: 'Filtra per',
      sortBy: 'Ordina per',
      exportData: 'Esporta dati',
      printReport: 'Stampa report'
    },
    keyboardShortcuts: {
      toggleAllSections: 'Ctrl+Shift+A',
      exportJson: 'Ctrl+Shift+J',
      exportCsv: 'Ctrl+Shift+C',
      print: 'Ctrl+P'
    }
  },
  features: {
    autoRefresh: false,
    realTimeUpdates: false,
    exportEnabled: true,
    printEnabled: true,
    searchEnabled: true,
    filtersEnabled: true
  }
};

// Configurazione per i tooltip
export const tooltipConfig = {
  analytics_storage: {
    title: 'Analytics Storage',
    description: 'Consenso per cookie di analytics (es. _ga, _gid)',
    examples: ['Google Analytics', 'Adobe Analytics', 'Mixpanel'],
    related: ['ad_storage', 'ad_user_data']
  },
  ad_storage: {
    title: 'Ad Storage',
    description: 'Consenso per cookie pubblicitari',
    examples: ['Google Ads', 'Facebook Pixel', 'DoubleClick'],
    related: ['ad_user_data', 'ad_personalization']
  },
  ad_user_data: {
    title: 'Ad User Data',
    description: 'Consenso per dati utente per advertising',
    examples: ['Profilazione utente', 'Remarketing', 'Lookalike audiences'],
    related: ['ad_storage', 'ad_personalization']
  },
  ad_personalization: {
    title: 'Ad Personalization',
    description: 'Consenso per personalizzazione pubblicitaria',
    examples: ['Targeting comportamentale', 'Personalizzazione contenuti', 'A/B testing'],
    related: ['ad_storage', 'ad_user_data']
  },
  functionality_storage: {
    title: 'Functionality Storage',
    description: 'Consenso per cookie funzionali',
    examples: ['Preferenze utente', 'Impostazioni lingua', 'Carrello e-commerce'],
    related: ['personalization_storage']
  },
  personalization_storage: {
    title: 'Personalization Storage',
    description: 'Consenso per cookie di personalizzazione',
    examples: ['Tema scuro/chiaro', 'Layout personalizzato', 'Contenuti consigliati'],
    related: ['functionality_storage']
  },
  security_storage: {
    title: 'Security Storage',
    description: 'Consenso per cookie di sicurezza',
    examples: ['Autenticazione', 'Protezione CSRF', 'Rate limiting'],
    related: ['functionality_storage']
  }
};

// Configurazione per le categorie di cookie
export const cookieCategoryConfig = {
  necessary: {
    name: 'Necessari',
    description: 'Cookie essenziali per il funzionamento del sito',
    icon: 'Shield',
    color: 'gray',
    examples: ['Session ID', 'CSRF Token', 'Authentication'],
    required: true
  },
  analytics: {
    name: 'Analytics',
    description: 'Cookie per analisi e statistiche di utilizzo',
    icon: 'Globe',
    color: 'blue',
    examples: ['Google Analytics', 'Adobe Analytics', 'Mixpanel'],
    required: false
  },
  marketing: {
    name: 'Marketing',
    description: 'Cookie per pubblicità e marketing',
    icon: 'Network',
    color: 'purple',
    examples: ['Facebook Pixel', 'Google Ads', 'DoubleClick'],
    required: false
  },
  preferences: {
    name: 'Preferenze',
    description: 'Cookie per personalizzazione dell\'esperienza utente',
    icon: 'Cookie',
    color: 'green',
    examples: ['Tema scuro', 'Lingua preferita', 'Layout personalizzato'],
    required: false
  }
};

// Configurazione per le categorie di richieste di rete
export const networkCategoryConfig = {
  analytics: {
    name: 'Analytics',
    description: 'Richieste per servizi di analisi e statistiche',
    icon: 'Globe',
    color: 'blue',
    examples: ['Google Analytics', 'Adobe Analytics', 'Mixpanel'],
    domains: ['google-analytics.com', 'googletagmanager.com', 'mixpanel.com']
  },
  ads: {
    name: 'Pubblicità',
    description: 'Richieste per servizi pubblicitari',
    icon: 'Network',
    color: 'orange',
    examples: ['Google Ads', 'DoubleClick', 'Amazon Ads'],
    domains: ['doubleclick.net', 'googleadservices.com', 'amazon-adsystem.com']
  },
  marketing: {
    name: 'Marketing',
    description: 'Richieste per servizi di marketing e remarketing',
    icon: 'Shield',
    color: 'purple',
    examples: ['Facebook Pixel', 'LinkedIn Insight', 'Twitter Analytics'],
    domains: ['facebook.net', 'linkedin.com', 'twitter.com']
  },
  other: {
    name: 'Altro',
    description: 'Altre richieste di rete',
    icon: 'AlertTriangle',
    color: 'gray',
    examples: ['CDN', 'Fonts', 'Images'],
    domains: ['cdnjs.cloudflare.com', 'fonts.googleapis.com', 'images.unsplash.com']
  }
};

// Configurazione per i domini noti
export const knownDomains = {
  analytics: [
    'google-analytics.com',
    'googletagmanager.com',
    'region1.google-analytics.com',
    'stats.g.doubleclick.net',
    'clarity.ms',
    'mixpanel.com',
    'segment.com',
    'hotjar.com',
    'fullstory.com',
    'logrocket.com'
  ],
  ads: [
    'doubleclick.net',
    'googleadservices.com',
    'googlesyndication.com',
    'adservice.google.com',
    'adservice.google.it',
    'amazon-adsystem.com',
    'adsystem.amazon.com',
    'criteo.com',
    'rubiconproject.com',
    'pubmatic.com',
    'adnxs.com',
    'taboola.com',
    'outbrain.com',
    'teads.tv'
  ],
  marketing: [
    'facebook.com',
    'connect.facebook.net',
    'linkedin.com',
    'snapchat.com',
    'tiktok.com',
    'analytics.tiktok.com',
    'twitter.com',
    'ads-twitter.com',
    'pinterest.com',
    'ads.pinterest.com',
    'instagram.com',
    'youtube.com',
    'youtube-nocookie.com'
  ],
  social: [
    'facebook.com',
    'twitter.com',
    'linkedin.com',
    'instagram.com',
    'youtube.com',
    'tiktok.com',
    'snapchat.com',
    'pinterest.com',
    'reddit.com',
    'discord.com'
  ],
  cdn: [
    'cdnjs.cloudflare.com',
    'unpkg.com',
    'jsdelivr.net',
    'cdn.jsdelivr.net',
    'ajax.googleapis.com',
    'fonts.googleapis.com',
    'fonts.gstatic.com',
    'maxcdn.bootstrapcdn.com',
    'stackpath.bootstrapcdn.com'
  ]
};

// Configurazione per i pattern di URL
export const urlPatterns = {
  analytics: [
    /google-analytics\.com\/g\/collect/,
    /googletagmanager\.com\/gtag\/js/,
    /stats\.g\.doubleclick\.net\/g\/collect/,
    /clarity\.ms\/collect/,
    /mixpanel\.com\/track/,
    /segment\.com\/v1\/t/
  ],
  ads: [
    /doubleclick\.net/,
    /googleadservices\.com/,
    /googlesyndication\.com/,
    /adservice\.google\./,
    /amazon-adsystem\.com/,
    /criteo\.com/,
    /rubiconproject\.com/,
    /pubmatic\.com/,
    /adnxs\.com/
  ],
  marketing: [
    /facebook\.com\/tr/,
    /connect\.facebook\.net/,
    /tiktok\.com\//,
    /analytics\.tiktok\.com/,
    /snapads\.com/,
    /ads-twitter\.com/,
    /linkedin\.com\/li\.lms/,
    /pinterest\.com\/ct/
  ]
};

// Configurazione per le raccomandazioni
export const recommendationTemplates = {
  success: {
    analytics: 'Il sito rispetta correttamente il consenso per i cookie di analytics, permettendo il tracciamento delle visite quando autorizzato.',
    marketing: 'Le richieste pubblicitarie sono state correttamente bloccate quando l\'utente ha rifiutato il consenso marketing.',
    necessary: 'I cookie necessari sono correttamente classificati e non richiedono consenso esplicito.',
    compliance: 'Il sito dimostra una buona compliance con le normative GDPR/CCPA.'
  },
  warning: {
    mixed: 'Alcuni cookie potrebbero non rispettare completamente le preferenze di consenso dell\'utente.',
    performance: 'Il numero elevato di richieste di rete potrebbe impattare le performance del sito.',
    thirdParty: 'Si consiglia di verificare la configurazione dei cookie di terze parti.'
  },
  error: {
    marketing: 'Cookie di marketing ancora attivi nonostante il rifiuto esplicito del consenso.',
    analytics: 'Cookie di analytics bloccati nonostante il consenso esplicito.',
    compliance: 'Il sito non rispetta le normative di consenso cookie.',
    security: 'Cookie sensibili non protetti o gestiti inappropriatamente.'
  }
};

// Configurazione per l'esportazione
export const exportConfig = {
  csv: {
    delimiter: ',',
    encoding: 'utf-8',
    includeHeaders: true,
    dateFormat: 'YYYY-MM-DD HH:mm:ss'
  },
  json: {
    indent: 2,
    includeMetadata: true,
    compress: false
  },
  pdf: {
    pageSize: 'A4',
    orientation: 'portrait',
    margins: {
      top: '1in',
      right: '1in',
      bottom: '1in',
      left: '1in'
    },
    header: {
      enabled: true,
      text: 'AI Sentinel - Report Consenso',
      fontSize: 12
    },
    footer: {
      enabled: true,
      text: 'Generato il {date}',
      fontSize: 10
    }
  }
};

// Configurazione per le notifiche
export const notificationConfig = {
  duration: {
    success: 3000,
    error: 5000,
    warning: 4000,
    info: 3000
  },
  position: 'top-right',
  maxVisible: 3,
  animation: {
    enter: 'slideInRight',
    exit: 'slideOutRight'
  }
};

// Configurazione per il caching
export const cacheConfig = {
  enabled: true,
  ttl: 300000, // 5 minuti
  maxSize: 50, // 50 report
  storage: 'localStorage'
};

// Configurazione per il logging
export const loggingConfig = {
  enabled: true,
  level: 'info', // debug, info, warn, error
  console: true,
  remote: false,
  maxEntries: 1000
};

// Funzione per ottenere la configurazione personalizzata
export const getConsentReportConfig = (overrides?: Partial<ConsentReportConfig>): ConsentReportConfig => {
  return {
    ...defaultConsentReportConfig,
    ...overrides
  };
};

// Funzione per validare la configurazione
export const validateConfig = (config: ConsentReportConfig): string[] => {
  const errors: string[] = [];
  
  if (!config.theme.colors.success) errors.push('Colore success mancante');
  if (!config.theme.colors.error) errors.push('Colore error mancante');
  if (!config.theme.colors.warning) errors.push('Colore warning mancante');
  if (!config.theme.colors.info) errors.push('Colore info mancante');
  
  if (config.responsive.breakpoints.mobile >= config.responsive.breakpoints.tablet) {
    errors.push('Breakpoint mobile deve essere minore di tablet');
  }
  
  if (config.responsive.breakpoints.tablet >= config.responsive.breakpoints.desktop) {
    errors.push('Breakpoint tablet deve essere minore di desktop');
  }
  
  return errors;
};

// Esporta tutte le configurazioni
export {
  defaultConsentReportConfig as defaultConfig,
  tooltipConfig,
  cookieCategoryConfig,
  networkCategoryConfig,
  knownDomains,
  urlPatterns,
  recommendationTemplates,
  exportConfig,
  notificationConfig,
  cacheConfig,
  loggingConfig
};
