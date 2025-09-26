// src/consent-test-b/config.ts

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
      };
    };
    fallback: {
      accept: string[];
      reject: string[];
    };
  };
  features: {
    captureScreens: boolean;
    trace: boolean;
  };
  region: "EU" | "US";
}

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
        reject: ["#onetrust-reject-all-handler", ".reject-btn", "[data-optanongroupid='C0002']", "button[id*='reject']"]
      },
      cookiebot: {
        accept: ["#CybotCookiebotDialogBodyButtonAccept", ".CookiebotDialogBodyButtonAccept", "button[id*='accept']"],
        reject: ["#CybotCookiebotDialogBodyButtonDecline", ".CookiebotDialogBodyButtonDecline", "button[id*='decline']"]
      },
      iubenda: {
        accept: [".iubenda-cs-accept-btn", "#iubenda-cs-accept-btn", "button[class*='accept']"],
        reject: [".iubenda-cs-reject-btn", "#iubenda-cs-reject-btn", "button[class*='reject']"]
      },
      didomi: {
        accept: [".didomi-continue-without-agree", "#didomi-continue-without-agree", "button[class*='accept']"],
        reject: [".didomi-disagree-high", "#didomi-disagree-high", "button[class*='disagree']"]
      },
      usercentrics: {
        accept: [".uc-btn-accept-all", "#uc-btn-accept-all", "button[class*='accept']"],
        reject: [".uc-btn-deny-all", "#uc-btn-deny-all", "button[class*='deny']"]
      },
      generic: {
        accept: ["button[id*='accept']", "button[class*='accept']", "[data-accept]", "button:has-text('Accept')", "button:has-text('Accetta')"],
        reject: ["button[id*='reject']", "button[class*='reject']", "[data-reject]", "button:has-text('Reject')", "button:has-text('Rifiuta')"]
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
      ]
    }
  },
  features: {
    captureScreens: true,
    trace: false,
  },
  region: "EU",
};
