// Hook resiliente 'a prova di riassegnazione' per dataLayer + Cookiebot + TCF fallbacks
export const consentProbe = () => {
  const w = window as any;

  const log = (type: string, data?: any) => {
    try {
      // console.debug('[consent-probe]', type, data || '');
    } catch {}
  };

  const state = {
    events: [] as any[],
    gtagCalls: [] as any[],
    dataLayerEvents: [] as any[],
    last: null as null | {
      ad_user_data: string; ad_personalization: string; ad_storage: string; analytics_storage: string;
    },
    gIds: new Set<string>(),
  };

  const normalize = (obj: any) => {
    const def = { ad_user_data: 'denied', ad_personalization: 'denied', ad_storage: 'denied', analytics_storage: 'denied' };
    if (!obj || typeof obj !== 'object') return def;
    return {
      ad_user_data: (obj.ad_user_data ?? obj.ad_storage ?? 'denied'),
      ad_personalization: (obj.ad_personalization ?? 'denied'),
      ad_storage: (obj.ad_storage ?? 'denied'),
      analytics_storage: (obj.analytics_storage ?? 'denied'),
    };
  };

  // --- dataLayer safe hook (resiste a riassegnazioni) ---
  let _dl: any[] = [];
  const wrapDL = (arr: any[]) => {
    if ((arr as any).__wrapped_push) return arr; // già wrappato
    const origPush = arr.push.bind(arr);
    Object.defineProperty(arr, '__wrapped_push', { value: true, enumerable: false });
    arr.push = function (...args: any[]) {
      try {
        state.dataLayerEvents.push({ ts: Date.now(), args });
        const a = args[0];
        if (Array.isArray(a)) {
          // gtag('consent', 'default'|'update', {...})
          if (a[0] === 'consent' && (a[1] === 'default' || a[1] === 'update')) {
            const payload = a[2] || {};
            state.events.push({ ts: Date.now(), type: 'gtag.consent', mode: a[1], payload });
            state.last = normalize(payload);
            log('gtag.consent', state.last);
          }
          // GTM consent
          if (a[0] === 'event' && a[1] === 'gtm.consentUpdate') {
            const payload = a[2] || {};
            state.events.push({ ts: Date.now(), type: 'gtm.consentUpdate', payload });
            state.last = normalize(payload);
            log('gtm.consentUpdate', state.last);
          }
          // gtag('config','G-XXXX', {...}) → prova a raccogliere ID
          if (a[0] === 'config' && typeof a[1] === 'string' && /^G-[A-Z0-9]+/.test(a[1])) {
            state.gIds.add(a[1]);
          }
        }
      } catch {}
      return origPush(...args);
    };
    return arr;
  };

  Object.defineProperty(w, 'dataLayer', {
    configurable: true,
    enumerable: true,
    get() { return _dl; },
    set(v) {
      if (Array.isArray(v)) {
        _dl = wrapDL(v);
      } else {
        _dl = v as any;
      }
    }
  });
  // inizializza se già esisteva
  if (Array.isArray(w.dataLayer)) w.dataLayer = w.dataLayer; else w.dataLayer = [];

  // --- gtag wrapper "passivo" (solo logging, non altera la logica) ---
  const wrapGtag = () => {
    if (typeof w.gtag === 'function' && !w.__gtag_wrapped) {
      const orig = w.gtag.bind(w);
      w.gtag = (...args: any[]) => {
        try {
          state.gtagCalls.push({ ts: Date.now(), args });
          if (args[0] === 'config' && typeof args[1] === 'string' && /^G-[A-Z0-9]+/.test(args[1])) {
            state.gIds.add(args[1]);
          }
        } catch {}
        return orig(...args);
      };
      w.__gtag_wrapped = true;
    }
  };
  wrapGtag();
  // se gtag viene definito dopo:
  Object.defineProperty(w, 'gtag', {
    configurable: true,
    set(fn) {
      delete w.gtag; // evita ricorsione
      (w as any).gtag = fn;
      wrapGtag();
    },
    get() { return (w as any).__gtag_wrapped ? (w as any).gtag : undefined; }
  });

  // --- Autodiscovery G-IDs dai <script> ---
  const scanScripts = () => {
    try {
      document.querySelectorAll('script[src*="gtag/js?id="]').forEach(s => {
        const u = new URL((s as HTMLScriptElement).src, location.href);
        const id = u.searchParams.get('id');
        if (id && /^G-[A-Z0-9]+/.test(id)) state.gIds.add(id);
      });
    } catch {}
  };
  scanScripts();
  const scanInt = setInterval(scanScripts, 500);
  setTimeout(() => clearInterval(scanInt), 8000);

  // --- Fallback Cookiebot → mappa verso Consent Mode v2 ---
  const cookiebotFallback = () => {
    try {
      const cb = w.Cookiebot;
      if (!cb || !cb.consent) return false;
      const m = !!cb.consent.marketing;
      const s = !!cb.consent.statistics;
      const mapped = {
        ad_user_data: m ? 'granted' : 'denied',
        ad_personalization: m ? 'granted' : 'denied',
        ad_storage: m ? 'granted' : 'denied',
        analytics_storage: s ? 'granted' : 'denied'
      };
      state.last = mapped;
      state.events.push({ ts: Date.now(), type: 'cookiebot.snapshot', payload: mapped });
      log('cookiebot.snapshot', mapped);
      return true;
    } catch { return false; }
  };

  // Cookiebot callbacks (se presenti)
  (w as any).CookiebotOnConsentReady = function() { cookiebotFallback(); };
  (w as any).CookiebotOnAccept = function() { cookiebotFallback(); };
  (w as any).CookiebotOnDecline = function() { cookiebotFallback(); };

  // --- Fallback gtag('get', <G-ID>, 'consent') ---
  const tryGtagGet = () => {
    if (typeof w.gtag !== 'function' || state.gIds.size === 0) return false;
    let resolved = false;
    state.gIds.forEach(id => {
      try {
        w.gtag('get', id, 'consent', (st: any) => {
          const n = normalize(st);
          state.last = n;
          state.events.push({ ts: Date.now(), type: 'gtag.get', id, payload: n });
          log('gtag.get', { id, n });
          resolved = true;
        });
      } catch {}
    });
    return resolved;
  };

  // TCF fallback (best-effort; solo log, non normalizza)
  const tryTCF = () => {
    try {
      if (typeof w.__tcfapi === 'function') {
        w.__tcfapi('getTCData', 2, (tcData: any, ok: boolean) => {
          if (ok) {
            state.events.push({ ts: Date.now(), type: 'tcf.getTCData', purposes: tcData?.purpose?.consents });
            log('tcf.getTCData', Object.keys(tcData?.purpose?.consents || {}).filter(k => tcData.purpose.consents[k]));
          }
        });
      }
    } catch {}
  };

  // Poll "morbido" finché non abbiamo uno stato
  const tick = () => {
    if (!state.last) {
      // prova gtag.get prima
      if (!tryGtagGet()) {
        // prova Cookiebot
        cookiebotFallback();
      }
    }
  };
  const poll = setInterval(tick, 400);
  setTimeout(() => { clearInterval(poll); tryTCF(); }, 12000); // smetti dopo 12s

  // API pubblica
  (w as any).__getConsentSnapshot = () => ({
    last: state.last,
    counts: { events: state.events.length, gtag: state.gtagCalls.length, dl: state.dataLayerEvents.length },
  });
};