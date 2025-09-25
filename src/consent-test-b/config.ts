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
        accept: ["#onetrust-accept-btn-handler", ".accept-btn", "[data-optanongroupid='C0001']"],
        reject: ["#onetrust-reject-all-handler", ".reject-btn", "[data-optanongroupid='C0002']"]
      },
      cookiebot: {
        accept: ["#CybotCookiebotDialogBodyButtonAccept", ".CookiebotDialogBodyButtonAccept"],
        reject: ["#CybotCookiebotDialogBodyButtonDecline", ".CookiebotDialogBodyButtonDecline"]
      },
      iubenda: {
        accept: [".iubenda-cs-accept-btn", "#iubenda-cs-accept-btn"],
        reject: [".iubenda-cs-reject-btn", "#iubenda-cs-reject-btn"]
      },
      didomi: {
        accept: [".didomi-continue-without-agree", "#didomi-continue-without-agree"],
        reject: [".didomi-disagree-high", "#didomi-disagree-high"]
      },
      usercentrics: {
        accept: [".uc-btn-accept-all", "#uc-btn-accept-all"],
        reject: [".uc-btn-deny-all", "#uc-btn-deny-all"]
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
        "everything"
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
        "essential only"
      ]
    }
  },
  features: {
    captureScreens: true,
    trace: false,
  },
  region: "EU",
};
