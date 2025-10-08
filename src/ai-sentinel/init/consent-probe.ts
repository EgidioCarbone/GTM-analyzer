// Hook resiliente 'a prova di riassegnazione' per dataLayer + Cookiebot + TCF fallbacks
export function consentProbe() {
  const w = window as any;
  try {
    const g = typeof globalThis !== 'undefined' ? globalThis : window;
    if (typeof (g as any).__name !== 'function') {
      Object.defineProperty(g, '__name', {
        value: (fn: any) => fn,
        configurable: true,
        writable: true
      });
    }
  } catch {}
  try {
    console.log('[consent-probe] init script running');
  } catch {}

  if (w.__consent_probe_loaded) {
    return;
  }
  w.__consent_probe_loaded = true;

  const PROBE_SOURCE = (() => {
    try {
      const cached = w.__consent_probe_source;
      if (typeof cached === 'string' && cached.length > 0) {
        return cached;
      }
    } catch {}
    const source = `(${consentProbe.toString()})();`;
    try { w.__consent_probe_source = source; } catch {}
    return source;
  })();

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
      ad_user_data: string; ad_personalization: string; ad_storage: string; analytics_storage: string; functionality_storage: string; security_storage: string;
    },
    gIds: new Set<string>(),
  };

  const normalize = (obj: any) => {
    const def = {
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      ad_storage: 'denied',
      analytics_storage: 'denied',
      functionality_storage: 'granted',
      security_storage: 'granted'
    };
    if (!obj || typeof obj !== 'object') return def;
    return {
      ad_user_data: (obj.ad_user_data ?? obj.ad_storage ?? 'denied'),
      ad_personalization: (obj.ad_personalization ?? 'denied'),
      ad_storage: (obj.ad_storage ?? 'denied'),
      analytics_storage: (obj.analytics_storage ?? 'denied'),
      functionality_storage: (obj.functionality_storage ?? 'granted'),
      security_storage: (obj.security_storage ?? 'granted')
    };
  };

  // --- dataLayer safe hook (resiste a riassegnazioni) ---
  let _dl: any[] = [];
  const wrapDL = (arr: any[]) => {
    if ((arr as any).__wrapped_push) return arr; // già wrappato
    const origPush = arr.push.bind(arr);
    Object.defineProperty(arr, '__wrapped_push', { value: true, enumerable: false });

    // Registra eventuali elementi già presenti (ad es. gtm.js, config iniziali)
    try {
      if (Array.isArray(arr) && arr.length > 0) {
        const existing = arr.map(item => ({ ts: Date.now(), args: [item] }));
        state.dataLayerEvents.push(...existing);
        (w as any).__dl_events = state.dataLayerEvents;
        try {
          if (window.top && window.top !== window) {
            existing.forEach(payload => window.top.postMessage({ source: 'consent-probe', eventName: 'dataLayer', value: payload }, '*'));
          }
        } catch {}
      }
    } catch {}

    arr.push = function (...args: any[]) {
      try {
        const eventPayload = { ts: Date.now(), args };
        state.dataLayerEvents.push(eventPayload);
        (w as any).__dl_events = state.dataLayerEvents;
        try {
          console.log('[consent-probe] dataLayer push', JSON.stringify(args));
        } catch {}
        try {
          if (window.top && window.top !== window) {
            window.top.postMessage({ source: 'consent-probe', eventName: 'dataLayer', value: eventPayload }, '*');
          }
        } catch {}
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
      try {
        console.log('[consent-probe] dataLayer setter invoked with', Array.isArray(v) ? `array(len=${v.length})` : typeof v);
      } catch {}
      if (Array.isArray(v)) {
        _dl = wrapDL(v);
      } else {
        _dl = v as any;
      }
    }
  });
  // inizializza se già esisteva
  if (Array.isArray(w.dataLayer)) w.dataLayer = w.dataLayer; else w.dataLayer = [];
  try {
    console.log('[consent-probe] after initialization dataLayer length', Array.isArray(w.dataLayer) ? w.dataLayer.length : 'n/a');
  } catch {}

  // --- gtag wrapper "passivo" (solo logging, non altera la logica) ---
  const wrapGtag = () => {
    if (typeof w.gtag === 'function' && !w.__gtag_wrapped) {
      try {
        console.log('[consent-probe] wrapGtag hooking existing gtag');
      } catch {}
      const orig = w.gtag.bind(w);
      w.gtag = (...args: any[]) => {
        try {
          const eventPayload = { ts: Date.now(), args };
          state.gtagCalls.push(eventPayload);
          (w as any).__gtag_calls = state.gtagCalls;
          try {
            console.log('[consent-probe] gtag call', JSON.stringify(args));
          } catch {}
          try {
            if (window.top && window.top !== window) {
              window.top.postMessage({ source: 'consent-probe', eventName: 'gtag', value: eventPayload }, '*');
            }
          } catch {}
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
      try {
        console.log('[consent-probe] gtag setter invoked');
      } catch {}
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

  (w as any).__dl_events = state.dataLayerEvents;
  (w as any).__gtag_calls = state.gtagCalls;
  (w as any).__consent_events = state.events;
  try {
    console.log('[consent-probe] probe ready');
  } catch {}

  const crossOriginIframes: Set<string> = (() => {
    try {
      if (w.__consent_probe_cross_origin instanceof Set) return w.__consent_probe_cross_origin;
    } catch {}
    const set = new Set<string>();
    try { (w as any).__consent_probe_cross_origin = set; } catch {}
    return set;
  })();

  const markCrossOriginSkip = (frame: HTMLIFrameElement, reason: unknown) => {
    const label = frame.src || frame.id || 'anonymous';
    if (crossOriginIframes.has(label)) return;
    crossOriginIframes.add(label);
    try {
      console.warn('[consent-probe] iframe injection skipped', label, reason instanceof Error ? reason.message : reason);
    } catch {}
  };

  const attachToFrame = (frame: HTMLIFrameElement) => {
    let frameWindow: Window | null = null;
    try {
      frameWindow = frame.contentWindow;
    } catch (err) {
      markCrossOriginSkip(frame, err);
      return;
    }
    if (!frameWindow) return;

    try {
      if ((frameWindow as any).__consent_probe_attached) return;
    } catch (err) {
      markCrossOriginSkip(frame, err);
      return;
    }

    let frameDocument: Document | null = null;
    try {
      frameDocument = frameWindow.document;
    } catch (err) {
      markCrossOriginSkip(frame, err);
      return;
    }
    if (!frameDocument?.head) return;

    try {
      (frameWindow as any).__consent_probe_attached = true;
      const script = frameDocument.createElement('script');
      if (!script) return;
      script.type = 'text/javascript';
      script.textContent = PROBE_SOURCE;
      frameDocument.head.appendChild(script);
      console.log('[consent-probe] injected into iframe', frame.src || frame.id || 'anonymous');

      const forward = (eventName: string, value: any) => {
        const payload = { source: 'consent-probe-frame', frameSrc: frame.src, eventName, value };
        window.postMessage(payload, '*');
      };

      frameWindow.addEventListener('message', (event: MessageEvent) => {
        const { data } = event;
        if (data && data.source === 'consent-probe' && data.eventName) {
          forward(data.eventName, data.value);
        }
      });
    } catch (err) {
      markCrossOriginSkip(frame, err);
    }
  };

  const scanIframes = () => {
    document.querySelectorAll('iframe').forEach(attachToFrame);
  };

  let iframeObserverStarted = false;
  const startIframeObserver = () => {
    if (iframeObserverStarted) return;
    const body = document.body;
    if (!body) return;
    iframeObserverStarted = true;
    const observer = new MutationObserver(() => scanIframes());
    observer.observe(body, { childList: true, subtree: true });
    scanIframes();
  };

  if (document.readyState === 'loading' && !document.body) {
    const onReady = () => {
      document.removeEventListener('DOMContentLoaded', onReady);
      startIframeObserver();
    };
    document.addEventListener('DOMContentLoaded', onReady);
    const bodyPoll = setInterval(() => {
      if (document.body) {
        clearInterval(bodyPoll);
        startIframeObserver();
      }
    }, 50);
    setTimeout(() => clearInterval(bodyPoll), 5000);
  } else {
    startIframeObserver();
  }

  window.addEventListener('message', (event) => {
    const { data } = event;
    if (data && data.source === 'consent-probe-frame' && data.eventName) {
      console.log(`[consent-probe] event from frame ${data.frameSrc || 'unknown'}: ${data.eventName}`);
      if (data.eventName === 'dataLayer') {
        state.dataLayerEvents.push(data.value);
        (w as any).__dl_events = state.dataLayerEvents;
      }
      if (data.eventName === 'gtag') {
        state.gtagCalls.push(data.value);
        (w as any).__gtag_calls = state.gtagCalls;
      }
    }
  });
}
