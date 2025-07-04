/**
 * Mappa dal codice interno di GTM (c, k, gas, …)
 * alla label “umana” mostrata in interfaccia.
 */
export const typeLabels: Record<string, string> = {
    /* Variabili */
    c: "Constant",
    k: "First-Party Cookie",
    gas: "GA Settings Variable",
    jsm: "JavaScript Macro",
    v: "Data Layer Variable",
  
    /* Tag (solo per completezza) */
    ua: "Universal Analytics Tag",
    googtag: "GA4 Tag",
    html: "Custom HTML",
    ga4: "GA4 Event",
  
    /* Fallback */
    default: "",
  };