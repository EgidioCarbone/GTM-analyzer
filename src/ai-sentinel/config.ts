// src/ai-sentinel/config.ts

export interface ConsentTestConfig {
  timeouts: {
    softMs: number;
    hardMs: number;
    graceMs: number;
  };
  cookies: {
    sensitive: string[];
  };
  endpoints: {
    gaAds: string[];
  };
  cmp: {
    selectors: {
      [key: string]: {
        accept: string[];
        reject: string[];
        personalize?: string[];
        confirmSelected?: string[];
        toggles?: {
          analytics?: RegExp[];
          marketing?: RegExp[];
          preferences?: RegExp[];
        };
      };
    };
    fallback: {
      accept: string[];
      reject: string[];
      personalize?: string[];
      confirmSelected?: string[];
      toggles?: {
        analytics?: RegExp[];
        marketing?: RegExp[];
        preferences?: RegExp[];
      };
    };
  };
  features: {
    captureScreens: boolean;
    trace: boolean;
  };
  region: "EU" | "US";
}

// AI Sentinel Enhanced Features Configuration
export const enhancedFeatures = {
  goCrossPlatform: false,        // A/B testing environments
  intelligence: { 
    cmpDetection: true,          
    showNetworkProblem: true  
  },
  aiOpti: {     
    suggestion: true         
  },
  protoTrackingFramework: {
    mobileDetection: true
  }
};

export const defaultConfig: ConsentTestConfig = {
  timeouts: {
    softMs: 10000,
    hardMs: 25000,
    graceMs: 2000,
  },
  cookies: {
    sensitive: [
      "_ga",
      "_gid", 
      "_gcl_au",
      "IDE",
      "_fbp",
      "_fbc",
      "_gclid",
      "_gcl_gb",
      "_gcl_aw",
      "_gcl_dc",
      "_gcl_gf",
      "_gcl_ha"
    ],
  },
  endpoints: {
    gaAds: [
      "www.google-analytics.com/*collect",
      "stats.g.doubleclick.net/*",
      "googleads.g.doubleclick.net/pagead/1p-conversion",
      "td.doubleclick.net/*",
      "www.googletagmanager.com/gtag/js",
      "www.googleadservices.com/*",
      "googleads.g.doubleclick.net/*",
      "doubleclick.net/*"
    ],
  },
  cmp: {
    selectors: {
      onetrust: {
        accept: ["#onetrust-accept-btn-handler", ".accept-btn", "[data-optanongroupid='C0001']", "button[id*='accept']"],
        reject: ["#onetrust-reject-all-handler", ".reject-btn", "[data-optanongroupid='C0002']", "button[id*='reject']"],
        personalize: ["#onetrust-pc-btn-handler", ".settings-btn", "[data-optanongroupid='C0003']", "button[id*='settings']", "button:has-text('Impostazioni')"],
        confirmSelected: ["button#save-preference-btn-handler", ".save-preference-btn", "button[id*='save-preference']", "button:has-text('Conferma le mie scelte')", "button:has-text('Salva preferenze')"],
        toggles: {
          analytics: [
            /\b(Statistiche|Analytics|Performance|Measuring|Analitiche|Tracking|Visits|Dati|Monitoraggio)\b/i,
            /\b(Tracciamento|Metrics|Reports|Reporting|Statis|Web|Measuring)\b/i
          ],
          marketing: [
            /\b(Marketing|Ads|Pubblicità|Advertising|Targeting|Promozionali|Conversion|Campaign)\b/i,
            /\b(Sponsored|Ads|Adsense|Targeted|AdvertisingPromo|Commercial)\b/i
          ],
          preferences: [
            /\b(Preferenze|Preferences|Functional|Funzionali|Technical|Required|Essential|Core|Necessari)\b/i,
            /\b(Needed|Strict|Basic|Sessione|Function|Workflow)\b/i
          ]
        }
      },
      cookiebot: {
        accept: ["#CybotCookiebotDialogBodyButtonAccept", ".CookiebotDialogBodyButtonAccept", "button[id*='accept']"],
        reject: ["#CybotCookiebotDialogBodyButtonDecline", ".CookiebotDialogBodyButtonDecline", "button[id*='decline']"],
        personalize: ["#CybotCookiebotDialogBodyButtonDetails", ".CookiebotDialogBodyButtonDetails", "button[id*='details']", "button:has-text('Personalizza')", "button:has-text('Impostazioni')"],
        confirmSelected: ["#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowallSelection", ".allowallselection", "button[id*='allowallselection']", "button:has-text('Accetta selezionati')", "button:has-text('Salva scelte')"],
        toggles: {
          analytics: [
            /\b(Statistiche|Analytics|Analisi|Performance|Measuring|Misurazione|Visits|Risultati|Dati|Monitoraggio)\b/i,
            /\b(Tracking|Tracciamento|Traces|Pluganalytics|Web|Stats)\b/i,
            /\b(Reporting|Rapporti|Reports|Metriche|Measuring|Statistiche\.|Analytics|Google.*Analytics)\b/i,
            /\b(Performance.*\b|Cookie.*\bAnalytics|Analytics.*\bCookie|Statistica|Dati.*Analytics)\b/i
          ],
          marketing: [
            /\b(Marketing|Pubblicità|Advertising|Ads|Targeted|Promozionali|Commerciali|Targeting|Marketing)\b/i,
            /\b(Campaign|Pubblicitare|Pubblicitario|Conversion|Convert|Advertising)\b/i,
            /\b(Ads|Adsense|Sponsorized|Sponsored|Promo)\b/i
          ],
          preferences: [
            /\b(Preferenze|Preferences|Functional|Funzioni|Tecnici|Essenziali|Necessarie|Necessari)\b/i,
            /\b(Technical|Required|Funzionali|Core|Basic|Essential|Strict|Needed)\b/i,
            /\b(Sessione|Sessioni|Workflow|Sorting|Processing|CoreServices)\b/i
          ]
        }
      },
      iubenda: {
        accept: [".iubenda-cs-accept-btn", "#iubenda-cs-accept-btn", "button[class*='accept']"],
        reject: [".iubenda-cs-reject-btn", "#iubenda-cs-reject-btn", "button[class*='reject']"],
        personalize: [".iubenda-cs-customize-btn", "#iubenda-cs-customize-btn", "button[class*='customize']", "button:has-text('Personalizza')"],
        confirmSelected: [".iubenda-cs-save-btn", "#iubenda-cs-save-btn", "button[class*='save']", "button:has-text('Salva le mie preferenze')"],
        toggles: {
          analytics: [/\b(Statistiche|Analytics|Analisi|Statistics)\b/i],
          marketing: [/\b(Marketing|Advertising|Pubblicità|Ads)\b/i],
          preferences: [/\b(Preferenze|Preferences|Functional)\b/i]
        }
      },
      didomi: {
        accept: [".didomi-continue-without-agree", "#didomi-continue-without-agree", "button[class*='accept']"],
        reject: [".didomi-disagree-high", "#didomi-disagree-high", "button[class*='disagree']"],
        personalize: [".didomi-continue-with-agree", "#didomi-continue-with-agree", "button[class*='more-options']", "button:has-text('Mostra più opzioni')"],
        confirmSelected: ["#save-preference-btn", ".save-preference-btn", "button[id*='save-preference']", "button:has-text('Salva scelte')"],
        toggles: {
          analytics: [/\b(Analytics|Statistiche|Measuring)\b/i],
          marketing: [/\b(Marketing|Advertising|Pubblicità)\b/i],
          preferences: [/\b(Preferenze|Functional|Framework)\b/i]
        }
      },
      usercentrics: {
        accept: [".uc-btn-accept-all", "#uc-btn-accept-all", "button[class*='accept']"],
        reject: [".uc-btn-deny-all", "#uc-btn-deny-all", "button[class*='deny']"],
        personalize: [".uc-btn-customize", "#uc-btn-customize", "button[class*='customize']", "button:has-text('Personalizza')"],
        confirmSelected: ["#uc-btn-save", ".uc-btn-save", "button[id*='save']", "button:has-text('Salva le mie preferenze')"],
        toggles: {
          analytics: [/\b(Analytics|Statistics|Measuring)\b/i],
          marketing: [/\b(Marketing|Advertising|Targeting)\b/i],
          preferences: [/\b(Functional|Technically Necessary|Preferenze)\b/i]
        }
      },
      generic: {
        accept: ["button[id*='accept']", "button[class*='accept']", "[data-accept]", "button:has-text('Accept')", "button:has-text('Accetta')"],
        reject: ["button[id*='reject']", "button[class*='reject']", "[data-reject]", "button:has-text('Reject')", "button:has-text('Rifiuta')"],
        personalize: ["button:has-text('Personalizza')", "button:has-text('Settings')", "button:has-text('Details')", "button:has-text('Impostazioni')", "[data-customize]"],
        confirmSelected: ["button:has-text('Accetta selezionati')", "button:has-text('Conferma scelte')", "button:has-text('Save choices')", "button:has-text('Salva preferenze')"],
        toggles: {
          analytics: [/\b(Statistiche|Analytics|Analisi|Statistics|Performance)\b/i],
          marketing: [/\b(Marketing|Ads|Pubblicità|Advertising|Targeting|Marketing cookies)\b/i],
          preferences: [/\b(Preferenze|Preferences|Functional|Funzionali|Functional cookies)\b/i]
        }
      }
    },
    fallback: {
      accept: [
        "accetta",
        "accept",
        "accetto",
        "conferma",
        "confirm",
        "ok",
        "consenti",
        "consent",
        "tutti",
        "all",
        "tutto",
        "everything",
        "ho capito",
        "capisco",
        "continuare",
        "continue",
        "procedere",
        "proceed"
      ],
      reject: [
        "rifiuta",
        "reject",
        "decline",
        "rifiuto",
        "nega",
        "deny",
        "solo necessari",
        "necessary only",
        "solo essenziali",
        "essential only",
        "necessari",
        "necessary",
        "rifiuto tutti",
        "reject all"
      ],
      personalize: [
        "personalizza",
        "personalize",
        "impostazioni",
        "settings",
        "details",
        "dettagli",
        "opzioni",
        "options",
        "preferenze",
        "preferences"
      ],
      confirmSelected: [
        "accetta selezionati",
        "save selections",
        "conferma scelte",
        "confermare",
        "conferma mio scelta",
        "salva",
        "save",
        "salva le mie preferenze",
        "save my preferences",
        "conferma preferenze"
      ],
      toggles: {
        analytics: [
          /\b(Statistiche|Analytics|Analisi|Statistics|Performance|Tracking|Visits|Dati|Monitoraggio)\b/i,
          /\b(Measuring|Analytique|Tracciamento|Reports|Reporting|MarketingAnalytics|Analyticos)\b/i,
          /\b(Risultati|Measurement|Stats|Webanalytics|Userbehavior)\b/i,
          /\b(Омулитичный|Измерителни|Analyses|Measuring)\b/i
        ],
        marketing: [
          /\b(Marketing|Ads|Pubblicità|Advertising|Targeting|Marketing cookies|Promozionali|Conversion|Campaign)\b/i,
          /\b(Targeted|Promotional|Sponsored|Ads|Commercialization|Promos)\b/i,
          /\b(Pubblicitario|AdvertisingMedia|DisplayAds|Remarketing|Marketing Кеке|Commerci)\b/i
        ],
        preferences: [
          /\b(Preferenze|Preferences|Functional|Funzionali|Functional cookies|Technical|Core|Essential|Required)\b/i,
          /\b(Basic|Needed|Strict|Necessary|Support|Session|Cookies funzionali)\b/i,
          /\b(Кеке функциональны|Cookie funzionali|Funcionales|Essentials|Technical|Workflow)\b/i
        ]
      }
    }
  },
  features: {
    captureScreens: true,
    trace: false,
  },
  region: "EU",
};
