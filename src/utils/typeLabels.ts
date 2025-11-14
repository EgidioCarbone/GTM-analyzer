/**
 * Mappa dal codice interno di GTM (c, k, gas, )
 * alla label "umana" mostrata in interfaccia.
 */
export const typeLabels: Record<string, string> = {
  /* Variabili */
  c: "Constant",
  k: "First-Party Cookie",
  gas: "Google Analytics Settings",
  jsm: "JavaScript Variable",
  v: "Data Layer Variable",
  u: "URL Variable",
  e: "Auto-Event Variable",
  r: "Random Number",
  smm: "Custom JavaScript",
  remm: "Regex Table",
  gtcs: "GTM Configuration Selector",
  dbg: "Debug Mode",
  vis: "Element Visibility",
  awec: "Google Ads Remarketing",
  gtes: "Google Tag Manager Settings",
  
  /* Tag (solo per completezza) */
  ua: "Universal Analytics",
  googtag: "GA4 Tag",
  html: "Custom HTML",
  ga4: "GA4 Event",
  gaawe: "GA4 Event",
  awct: "Google Ads Conversion",
  gclidw: "Google Ads Click ID",

  /* Fallback */
  default: "",
};
