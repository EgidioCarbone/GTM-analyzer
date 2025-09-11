// puppeteerServer.js - VERSIONE CORRETTA
import express from 'express';
import puppeteer from 'puppeteer';
import cors from 'cors';

const app = express();
const PORT = 4001;

app.use(cors());
app.use(express.json());

app.get('/api/fetchHtmlPuppeteer', async (req, res) => {
    const targetUrl = req.query.url;
    const multiStep = req.query.multiStep === 'true';

    if (typeof targetUrl !== 'string' || !/^https:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i.test(targetUrl)) {
        return res.status(400).json({ error: 'URL non valido. Deve iniziare con https:// e contenere un dominio valido.' });
    }

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding'
            ],
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (GTM-Checklist/1.0)');
        
        await page.setCacheEnabled(false);
        await page.setDefaultTimeout(60000);
        await page.setDefaultNavigationTimeout(60000);
        
        console.log(`Navigando verso: ${targetUrl}`);
        
        try {
            await page.goto(targetUrl, {
                waitUntil: 'domcontentloaded',
                timeout: 60000,
            });
        } catch (navError) {
            console.log('Errore di navigazione, provo con timeout più breve:', navError.message);
            try {
                await page.goto(targetUrl, {
                    waitUntil: 'load',
                    timeout: 30000,
                });
            } catch (secondError) {
                console.log('Secondo tentativo fallito, continuo comunque:', secondError.message);
            }
        }

        await new Promise(resolve => setTimeout(resolve, 3000));

        let html;
        try {
            html = await page.content();
            console.log('HTML ottenuto con successo, lunghezza:', html.length);
        } catch (htmlError) {
            console.log('Errore nel recupero HTML:', htmlError.message);
            html = '<html><body><h1>Errore nel caricamento della pagina</h1></body></html>';
        }

        const performanceMetrics = await page.metrics();
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const resourceMetrics = await page.evaluate(() => {
            const metrics = {};
            try {
                metrics.nodes = document.querySelectorAll('*').length;
                if (performance.memory) {
                    metrics.jsHeapUsedSize = performance.memory.usedJSHeapSize;
                    metrics.jsHeapTotalSize = performance.memory.totalJSHeapSize;
                }
                const styleSheets = document.styleSheets.length;
                metrics.styleSheets = styleSheets;
                const scripts = document.querySelectorAll('script').length;
                metrics.scripts = scripts;
                console.log('Resource metrics extracted:', metrics);
            } catch (error) {
                console.log('Error extracting resource metrics:', error);
            }
            return metrics;
        });
        
        const performanceEntries = await page.evaluate(() => {
            return new Promise((resolve) => {
                const entries = [];
                try {
                    const navEntries = performance.getEntriesByType('navigation');
                    entries.push(...navEntries.map(entry => ({
                        name: entry.name,
                        duration: entry.duration,
                        startTime: entry.startTime,
                        entryType: entry.entryType,
                        loadEventEnd: entry.loadEventEnd,
                        loadEventStart: entry.loadEventStart,
                        domContentLoadedEventEnd: entry.domContentLoadedEventEnd,
                        domContentLoadedEventStart: entry.domContentLoadedEventStart,
                        responseStart: entry.responseStart,
                        requestStart: entry.requestStart
                    })));
                    
                    const paintEntries = performance.getEntriesByType('paint');
                    entries.push(...paintEntries.map(entry => ({
                        name: entry.name,
                        duration: entry.duration,
                        startTime: entry.startTime,
                        entryType: entry.entryType
                    })));
                    
                    const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
                    entries.push(...lcpEntries.map(entry => ({
                        name: entry.name,
                        duration: entry.duration,
                        startTime: entry.startTime,
                        entryType: entry.entryType,
                        size: entry.size,
                        element: entry.element ? entry.element.tagName : null
                    })));
                    
                    const fidEntries = performance.getEntriesByType('first-input');
                    entries.push(...fidEntries.map(entry => ({
                        name: entry.name,
                        duration: entry.duration,
                        startTime: entry.startTime,
                        entryType: entry.entryType,
                        processingStart: entry.processingStart,
                        processingEnd: entry.processingEnd
                    })));
                    
                    const clsEntries = performance.getEntriesByType('layout-shift');
                    entries.push(...clsEntries.map(entry => ({
                        name: entry.name,
                        duration: entry.duration,
                        startTime: entry.startTime,
                        entryType: entry.entryType,
                        value: entry.value,
                        hadRecentInput: entry.hadRecentInput
                    })));
                    
                } catch (error) {
                    console.log('Errore nel raccogliere performance entries:', error);
                }
                resolve(entries);
            });
        });

        const webVitals = await page.evaluate(() => {
            return new Promise((resolve) => {
                const vitals = {};
                console.log('Iniziando calcolo Web Vitals...');
                try {
                    const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
                    console.log('LCP entries found:', lcpEntries.length);
                    if (lcpEntries.length > 0) {
                        const lcp = lcpEntries[lcpEntries.length - 1];
                        vitals.lcp = Math.round(lcp.startTime);
                        console.log('LCP calculated:', vitals.lcp);
                    } else {
                        const fcpEntries = performance.getEntriesByType('paint');
                        const fcpEntry = fcpEntries.find(entry => entry.name === 'first-contentful-paint');
                        if (fcpEntry) {
                            vitals.lcp = Math.round(fcpEntry.startTime * 1.3);
                            console.log('LCP estimated from FCP:', vitals.lcp);
                        } else {
                            const navEntries = performance.getEntriesByType('navigation');
                            if (navEntries.length > 0) {
                                const nav = navEntries[0];
                                vitals.lcp = Math.round(nav.loadEventEnd - nav.loadEventStart);
                                console.log('LCP fallback from navigation:', vitals.lcp);
                            }
                        }
                    }

                    const fidEntries = performance.getEntriesByType('first-input');
                    console.log('FID entries found:', fidEntries.length);
                    if (fidEntries.length > 0) {
                        const fid = fidEntries[0];
                        vitals.fid = Math.round(fid.processingStart - fid.startTime);
                        console.log('FID calculated:', vitals.fid);
                    } else {
                        vitals.fid = 0;
                        console.log('FID not available (no user interaction)');
                    }

                    const clsEntries = performance.getEntriesByType('layout-shift');
                    console.log('CLS entries found:', clsEntries.length);
                    let clsValue = 0;
                    clsEntries.forEach(entry => {
                        if (!entry.hadRecentInput) {
                            clsValue += entry.value;
                        }
                    });
                    vitals.cls = Math.round(clsValue * 1000) / 1000;
                    console.log('CLS calculated:', vitals.cls);

                    const fcpEntries = performance.getEntriesByType('paint');
                    console.log('Paint entries found:', fcpEntries.length);
                    const fcpEntry = fcpEntries.find(entry => entry.name === 'first-contentful-paint');
                    if (fcpEntry) {
                        vitals.fcp = Math.round(fcpEntry.startTime);
                        console.log('FCP calculated:', vitals.fcp);
                    }

                    const navigationEntries = performance.getEntriesByType('navigation');
                    console.log('Navigation entries found:', navigationEntries.length);
                    if (navigationEntries.length > 0) {
                        const nav = navigationEntries[0];
                        vitals.ttfb = Math.round(nav.responseStart - nav.requestStart);
                        console.log('TTFB calculated:', vitals.ttfb);
                    }

                    if (fcpEntry && lcpEntries.length > 0) {
                        vitals.speedIndex = Math.round((fcpEntry.startTime + lcpEntries[lcpEntries.length - 1].startTime) / 2);
                    } else if (fcpEntry) {
                        vitals.speedIndex = Math.round(fcpEntry.startTime * 1.5);
                    } else {
                        const navEntries = performance.getEntriesByType('navigation');
                        if (navEntries.length > 0) {
                            const nav = navEntries[0];
                            vitals.speedIndex = Math.round(nav.domContentLoadedEventEnd - nav.domContentLoadedEventStart);
                        }
                    }

                    if (navigationEntries.length > 0) {
                        const nav = navigationEntries[0];
                        vitals.domContentLoaded = Math.round(nav.domContentLoadedEventEnd - nav.domContentLoadedEventStart);
                        vitals.loadComplete = Math.round(nav.loadEventEnd - nav.loadEventStart);
                    }

                } catch (error) {
                    console.log('Errore nel calcolo Web Vitals:', error);
                }

                console.log('Web Vitals calcolati:', vitals);

                if (Object.keys(vitals).length === 0) {
                    console.log('Usando fallback per Web Vitals...');
                    const navigation = performance.getEntriesByType('navigation')[0];
                    if (navigation) {
                        vitals.lcp = Math.round(navigation.loadEventEnd - navigation.loadEventStart);
                        vitals.fcp = Math.round(navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart);
                        vitals.ttfb = Math.round(navigation.responseStart - navigation.requestStart);
                        vitals.speedIndex = Math.round(navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart);
                        console.log('Fallback Web Vitals:', vitals);
                    }
                }

                setTimeout(() => resolve(vitals), 500);
            });
        });

        await page.evaluate(() => {
            if (typeof window.gtag === 'function') {
                const original = window.gtag;
                window.gtag.calls = window.gtag.calls || [];
                window.gtag = function () {
                    const args = Array.from(arguments);
                    window.gtag.calls.push(args);
                    if (args[0] === 'consent') {
                        console.log('Chiamata consent rilevata:', args);
                    }
                    return original.apply(this, args);
                };
            }
        });

        const { dataLayer, consentModePresent, consentModeCalls } = await page.evaluate(() => {
            const html = document.documentElement.outerHTML;
            const dataLayer = window.dataLayer || [];
            
            const consentEvents = dataLayer.filter(event => 
                event.consent || event.event === 'consent' || 
                event.event === 'cookie_consent' || event.event === 'consent_update' ||
                (Array.isArray(event) && event[0] === 'consent')
            );
            
            const hasConsentMode = /gtag\s*\(\s*['"]consent['"]/i.test(html) || 
                                 /gtag\s*\(\s*['"]config['"]/i.test(html) ||
                                 /dataLayer.*consent/i.test(html) ||
                                 /consent\s*:\s*['"]granted['"]/i.test(html) ||
                                 /consent\s*:\s*['"]denied['"]/i.test(html) ||
                                 /analytics_storage/i.test(html) ||
                                 /ad_storage/i.test(html) ||
                                 /functionality_storage/i.test(html) ||
                                 /personalization_storage/i.test(html) ||
                                 /security_storage/i.test(html) ||
                                 consentEvents.length > 0 ||
                                 typeof window.gtag === 'function';
            
            return {
                dataLayer: dataLayer,
                consentModePresent: hasConsentMode,
                consentModeCalls: window.gtag && window.gtag.calls ? window.gtag.calls : [],
            };
        });

        const gtmIds = [...new Set(html.match(/GTM-[\w-]{6,10}/g) || [])];

        const cookieBannerLibs = [];
        if (/onetrust/i.test(html)) cookieBannerLibs.push('Onetrust');
        if (/otSDKStub/i.test(html)) cookieBannerLibs.push('Onetrust Stub');
        if (/cookiebot/i.test(html)) cookieBannerLibs.push('Cookiebot');
        if (/iubenda/i.test(html)) cookieBannerLibs.push('Iubenda');
        if (/complianz/i.test(html)) cookieBannerLibs.push('Complianz');

        let interactiveTestResults = {};
        let screenshots = [];

        // Helper functions for interactive tests
        async function instrumentPage(page) {
            await page.evaluateOnNewDocument(() => {
                const w = window;
                w.dataLayer = w.dataLayer || [];
                const origPush = w.dataLayer.push.bind(w.dataLayer);
                w.__dlEvents = [];
                w.dataLayer.push = function(...args){ try{w.__dlEvents.push(args[0]);}catch{}; return origPush(...args); };

                const origGtag = (w).gtag && typeof (w).gtag === 'function' ? (w).gtag : null;
                w.__gtagCalls = [];
                w.gtag = function(...args){ try{w.__gtagCalls.push(args);}catch{}; if (origGtag) return origGtag(...args); };

                w.__perf = { lcp: 0, cls: 0 };
                try {
                    new PerformanceObserver(list => { for (const e of list.getEntries()) if (e.entryType === 'largest-contentful-paint') w.__perf.lcp = e.startTime; })
                        .observe({ type: 'largest-contentful-paint', buffered: true });
                    let cls = 0;
                    new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) cls += e.value || 0; w.__perf.cls = cls; })
                        .observe({ type: 'layout-shift', buffered: true });
                } catch {}
            });
        }

        const MARKETING_HOSTS = [
            /doubleclick\.net/i, /googleads\.g\.doubleclick\.net/i, /googletagservices\.com/i,
            /connect\.facebook\.net/i, /analytics\.tiktok\.com/i, /bat\.bing\.com/i, /snap\.sc/i, /hotjar\.com/i
        ];
        
        function trackMarketing(page){
            const seen = [];
            const listener = r => { if (MARKETING_HOSTS.some(rx => rx.test(r.url()))) seen.push(r.url()); };
            page.on('request', listener);
            return {
                get: () => seen.slice(),
                cleanup: () => page.removeListener('request', listener)
            };
        }

        async function findAndClickConsent(page, action /* 'accept' | 'reject' */) {
            const X_ACCEPT = "//button[.//text()[contains(translate(., 'ACEILNOPRSTUV', 'aceilnoprstuv'),'accept') or contains(.,'Accetta') or contains(.,'Consenti') or contains(.,'Agree')]]";
            const X_REJECT = "//button[.//text()[contains(translate(., 'CDEHILNQRSTUV', 'cdehilnqrstuv'),'rifiuta') or contains(.,'reject') or contains(.,'decline') or contains(.,'deny')]]";
            const x = action === 'accept' ? X_ACCEPT : X_REJECT;

            let clicked = false;

            // try in known vendor iframes
            const f = page.frames().find(fr => /onetrust|iubenda|cookiebot|complianz/i.test(fr.url()));
            if (f) {
                const btns = await f.$x(x);
                for (const btn of btns) {
                    const isVisible = await btn.isIntersectingViewport();
                    const isEnabled = await btn.evaluate(el => !el.hasAttribute('disabled'));
                    if (isVisible && isEnabled) {
                        await btn.click();
                        clicked = true;
                        break;
                    }
                }
            }

            if (!clicked) {
                // try in main document via XPath
                const nodes = await page.$x(x);
                for (const node of nodes) {
                    const isVisible = await node.isIntersectingViewport();
                    const isEnabled = await node.evaluate(el => !el.hasAttribute('disabled'));
                    if (isVisible && isEnabled) {
                        await node.click();
                        clicked = true;
                        break;
                    }
                }
            }

            if (!clicked) {
                // deep traversal across shadow roots
                clicked = await page.evaluate((intent) => {
                    const matches = [];
                    const visit = (root) => {
                        for (const el of root.querySelectorAll('button,[role=button],a,input[type=button]')) {
                            const t = (el.textContent || '').toLowerCase();
                            const isVisible = el.offsetWidth > 0 && el.offsetHeight > 0;
                            const isEnabled = !el.hasAttribute('disabled');
                            if (isVisible && isEnabled && (intent==='accept' ? /accett|accept|consent|agree/.test(t) : /rifiut|reject|declin|deny/.test(t))) {
                                matches.push(el);
                            }
                        }
                        root.querySelectorAll('*').forEach(e => e.shadowRoot && visit(e.shadowRoot));
                    };
                    visit(document);
                    if (matches[0]) {
                        matches[0].click();
                        return true;
                    }
                    return false;
                }, action);
            }

            if (clicked) {
                // Wait up to 6s for consent propagation
                const startTime = Date.now();
                const maxWait = 6000;
                
                while (Date.now() - startTime < maxWait) {
                    await new Promise(resolve => setTimeout(resolve, 300));
                    
                    // Check for new gtag consent calls
                    const gtagCalls = await page.evaluate(() => window.__gtagCalls || []);
                    const hasConsentUpdate = gtagCalls.some(call => 
                        call[0] === 'consent' && call[1] === 'update'
                    );
                    
                    if (hasConsentUpdate) break;
                    
                    // Check for CMP cookie changes
                    const currentState = await readConsentState(page);
                    if (currentState.cmp.vendor !== 'unknown') break;
                    
                    // Check for banner disappearance
                    const bannerGone = await page.evaluate(() => {
                        const bannerSelectors = [
                            '#onetrust-consent-sdk', '.onetrust-pc-sdk', '.ot-pc-container',
                            '#CybotCookiebotDialog', '.CybotCookiebotDialog',
                            '[class*="cookie"]', '[class*="consent"]', '[class*="gdpr"]', '[class*="banner"]'
                        ];
                        const elements = bannerSelectors.flatMap(sel => Array.from(document.querySelectorAll(sel)));
                        return elements.every(el => {
                            const style = window.getComputedStyle(el);
                            return style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0';
                        });
                    });
                    
                    if (bannerGone) break;
                }
            }

            return clicked;
        }

        async function readConsentState(page){
            const cookies = await page.cookies();
            const local = await page.evaluate(() => {
                const out = {};
                try { for (let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); out[k] = localStorage.getItem(k); } } catch {}
                return out;
            });

            function parseCMP(){
                const byName = Object.fromEntries(cookies.map(c => [c.name, c.value]));
                // OneTrust
                if (byName.OptanonConsent) {
                    const v = decodeURIComponent(byName.OptanonConsent);
                    const groups = (v.match(/groups=([^;]+)/) || [])[1] || '';
                    const mkOn = /C0004:1|marketing:1|adv:1/i.test(groups);
                    return { vendor: 'OneTrust', marketingOn: mkOn, raw: { cookie: v } };
                }
                // Iubenda
                const iubKey = Object.keys(byName).find(k => /^_iub_cs-/.test(k));
                if (iubKey) {
                    try {
                        const obj = JSON.parse(decodeURIComponent(byName[iubKey]));
                        const mkOn = !!(obj.purposesConsent && (obj.purposesConsent['4'] || obj.purposesConsent['5']));
                        return { vendor: 'Iubenda', marketingOn: mkOn, raw: { cookie: obj } };
                    } catch {}
                }
                // Cookiebot
                if (byName.CookieConsent) {
                    try {
                        const obj = JSON.parse(decodeURIComponent(byName.CookieConsent));
                        const mkOn = !!obj.marketing;
                        return { vendor: 'Cookiebot', marketingOn: mkOn, raw: { cookie: obj } };
                    } catch {}
                }
                // Complianz
                const cmplz = Object.keys(byName).filter(k => /^cmplz_/.test(k));
                if (cmplz.length) {
                    const mkOn = byName.cmplz_marketing === 'allow' || byName.cmplz_marketing === '1';
                    return { vendor: 'Complianz', marketingOn: mkOn, raw: { cookie: byName } };
                }
                return { vendor: 'unknown', marketingOn: null, raw: { cookies } };
            }

            const cmp = parseCMP();
            const gtag = await page.evaluate(() => window.__gtagCalls || []);
            
            // Extract Consent Mode v2 keys from gtag calls
            const consentMode = {
                ad_storage: null,
                analytics_storage: null,
                ad_user_data: null,
                ad_personalization: null
            };
            
            gtag.forEach(call => {
                if (call[0] === 'consent' && call[1] === 'update' && call[2]) {
                    const params = call[2];
                    if (params.ad_storage) consentMode.ad_storage = params.ad_storage;
                    if (params.analytics_storage) consentMode.analytics_storage = params.analytics_storage;
                    if (params.ad_user_data) consentMode.ad_user_data = params.ad_user_data;
                    if (params.ad_personalization) consentMode.ad_personalization = params.ad_personalization;
                }
            });
            
            return { cmp, gtag, consentMode };
        }

        function normalizeEvidence(evidence) {
            return {
                cmp: evidence.cmp || {},
                gtagCalls: (evidence.gtagCalls || []).slice(0, 50),
                marketingRequests: (evidence.marketingRequests || []).slice(0, 50)
            };
        }

        if (multiStep) {
            try {
                console.log('Iniziando test interattivi...');
                
                // Instrument page before navigation
                await instrumentPage(page);

                // Start marketing tracking
                const marketingTracker = trackMarketing(page);
                
                // Navigate to the page
                await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
                
                // Wait up to 8s for a banner to appear
                let bannerFound = false;
                let waitTime = 0;
                const maxWaitTime = 8000;
                
                while (waitTime < maxWaitTime && !bannerFound) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    waitTime += 1000;
                    
                    bannerFound = await page.evaluate(() => {
                        // Check for known vendor frames
                        const frames = document.querySelectorAll('iframe');
                        const vendorFrames = Array.from(frames).some(frame => 
                            /onetrust|iubenda|cookiebot|complianz/i.test(frame.src || '')
                        );
                        
                        // Check for banner elements
                        const bannerSelectors = [
                            '#onetrust-consent-sdk', '.onetrust-pc-sdk', '.ot-pc-container',
                            '#CybotCookiebotDialog', '.CybotCookiebotDialog',
                            '[class*="cookie"]', '[class*="consent"]', '[class*="gdpr"]', '[class*="banner"]',
                            '[id*="cookie"]', '[id*="consent"]', '[id*="gdpr"]', '[id*="banner"]',
                            '.cookie-consent', '.cookie-banner', '.consent-banner', '.gdpr-banner',
                            '[class*="iubenda"]', '[id*="iubenda"]', '[class*="complianz"]', '[id*="complianz"]'
                        ];
                        
                        const elements = bannerSelectors.flatMap(sel => Array.from(document.querySelectorAll(sel)));
                        const visibleBanners = elements.filter(el => {
                            const style = window.getComputedStyle(el);
                            const rect = el.getBoundingClientRect();
                            return style.display !== 'none' && style.visibility !== 'hidden' && 
                                   style.opacity !== '0' && rect.width > 0 && rect.height > 0;
                        });
                        
                        const hasConsentText = visibleBanners.some(el => {
                            const text = el.textContent?.toLowerCase() || '';
                            return text.includes('cookie') || text.includes('consent') || 
                                   text.includes('privacy') || text.includes('accetta') || 
                                   text.includes('rifiuta') || text.includes('accept') ||
                                   text.includes('reject');
                        });
                        
                        return vendorFrames || (visibleBanners.length > 0 && hasConsentText);
                    });
                    
                    console.log(`Attesa banner: ${waitTime}ms, Trovato: ${bannerFound}`);
                }
                
                // Capture screenshot if banner found
                if (bannerFound) {
                    console.log('Banner trovato, catturando screenshot...');
                    screenshots.push(await page.screenshot({ 
                        encoding: 'base64',
                        fullPage: true 
                    }));
                }
                
                // Test 1: Accept All
                console.log('Eseguendo test Accept All...');
                const acceptClicked = await findAndClickConsent(page, 'accept');
                await page.waitForTimeout(1500);
                await page.reload({ waitUntil: 'networkidle0' });
                const stateA = await readConsentState(page);
                
                const consentUpdated = stateA.cmp.marketingOn === true || 
                    (stateA.consentMode.ad_storage === 'granted' || 
                     stateA.consentMode.analytics_storage === 'granted' ||
                     stateA.consentMode.ad_user_data === 'granted' ||
                     stateA.consentMode.ad_personalization === 'granted');
                const marketingActive = consentUpdated || marketingTracker.get().length > 0;
                
                interactiveTestResults.acceptAll = {
                    clicked: acceptClicked,
                    consentUpdated,
                    marketingActive,
                    evidence: normalizeEvidence({
                        cmp: stateA.cmp,
                        gtagCalls: stateA.gtag,
                        marketingRequests: marketingTracker.get()
                    })
                };
                
                // Clean up marketing tracker
                marketingTracker.cleanup();
                
                // Test 2: Reject All
                console.log('Eseguendo test Reject All...');
                const rejectClicked = await findAndClickConsent(page, 'reject');
                await page.waitForTimeout(1500);
                await page.reload({ waitUntil: 'networkidle0' });
                const stateR = await readConsentState(page);
                
                const consentDenied = (stateR.consentMode.ad_storage === 'denied' || 
                                      stateR.consentMode.analytics_storage === 'denied' ||
                                      stateR.consentMode.ad_user_data === 'denied' ||
                                      stateR.consentMode.ad_personalization === 'denied') &&
                                     (stateR.cmp.vendor === 'unknown' || stateR.cmp.marketingOn === false);
                const marketingBlocked = consentDenied && marketingTracker.get().length === 0;
                
                interactiveTestResults.rejectAll = {
                    clicked: rejectClicked,
                    marketingBlocked,
                    consentDenied,
                    evidence: normalizeEvidence({
                        cmp: stateR.cmp,
                        gtagCalls: stateR.gtag,
                        marketingRequests: marketingTracker.get()
                    })
                };
                
                // Clean up marketing tracker
                marketingTracker.cleanup();
                
                // Test 3: Navigation persistence
                console.log('Eseguendo test Navigation...');
                
                // Reload to ensure consent state is persisted
                await page.reload({ waitUntil: 'networkidle0' });
                
                // Navigate to another path on same domain
                const currentUrl = new URL(targetUrl);
                const testPath = currentUrl.pathname === '/' ? '/?cmp-check=1' : currentUrl.pathname + '/?cmp-check=1';
                const testUrl = currentUrl.origin + testPath;
                
                // Instrument page before navigation
                await instrumentPage(page);
                
                try {
                    await page.goto(testUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
                } catch (navError) {
                    // If navigation fails, just reload the current page
                    await page.reload({ waitUntil: 'domcontentloaded' });
                }
                
                const gtmLoaded = await page.evaluate(() => 
                    !!(window.gtag || window.google_tag_manager || window.dataLayer?.length));
                const stateN = await readConsentState(page);
                
                // Compare with accept/reject outcome to determine persistence
                const acceptOutcome = interactiveTestResults.acceptAll.consentUpdated;
                const rejectOutcome = interactiveTestResults.rejectAll.consentDenied;
                
                let consentPersistent = false;
                if (acceptOutcome) {
                    // If accept worked, check if consent is still granted
                    consentPersistent = stateN.cmp.marketingOn === true || 
                        (stateN.consentMode.ad_storage === 'granted' || 
                         stateN.consentMode.analytics_storage === 'granted' ||
                         stateN.consentMode.ad_user_data === 'granted' ||
                         stateN.consentMode.ad_personalization === 'granted');
                } else if (rejectOutcome) {
                    // If reject worked, check if consent is still denied
                    consentPersistent = (stateN.consentMode.ad_storage === 'denied' || 
                                        stateN.consentMode.analytics_storage === 'denied' ||
                                        stateN.consentMode.ad_user_data === 'denied' ||
                                        stateN.consentMode.ad_personalization === 'denied') &&
                                       (stateN.cmp.vendor === 'unknown' || stateN.cmp.marketingOn === false);
                } else {
                    // If neither worked, check if there's any consent state at all
                    consentPersistent = stateN.cmp.vendor !== 'unknown' || stateN.gtag.length > 0;
                }
                
                interactiveTestResults.navigation = {
                    gtmLoaded,
                    consentPersistent,
                    evidence: normalizeEvidence({
                        cmp: stateN.cmp,
                        gtagCalls: stateN.gtag,
                        marketingRequests: marketingTracker.get()
                    })
                };
                
                // Clean up marketing tracker
                marketingTracker.cleanup();
                
                // Update the main interactiveTestResults structure
                interactiveTestResults = {
                    interactive: {
                        acceptAll: interactiveTestResults.acceptAll,
                        rejectAll: interactiveTestResults.rejectAll,
                        navigation: interactiveTestResults.navigation
                    }
                };

            } catch (testError) {
                console.log('Errore nei test interattivi:', testError.message);
                interactiveTestResults = {
                    interactive: {
                        acceptAll: {
                            clicked: false,
                            consentUpdated: false,
                            marketingActive: false,
                            evidence: normalizeEvidence({ cmp: {}, gtagCalls: [], marketingRequests: [] })
                        },
                        rejectAll: {
                            clicked: false,
                            marketingBlocked: false,
                            consentDenied: false,
                            evidence: normalizeEvidence({ cmp: {}, gtagCalls: [], marketingRequests: [] })
                        },
                        navigation: {
                            gtmLoaded: false,
                            consentPersistent: false,
                            evidence: normalizeEvidence({ cmp: {}, gtagCalls: [], marketingRequests: [] })
                        }
                    }
                };
            }
        }

        const accessibilityScore = Math.min(100, Math.max(0, 
            100 - (html.match(/alt=""/g) || []).length * 5 -
            (html.match(/<img(?!.*alt)/g) || []).length * 10 -
            (html.match(/<button(?!.*aria-label)/g) || []).length * 3
        ));

        const seoScore = Math.min(100, Math.max(0,
            100 - (!html.includes('<title>') ? 20 : 0) -
            (!html.includes('<meta name="description"') ? 15 : 0) -
            (!html.includes('<h1>') ? 10 : 0) -
            (html.match(/<img(?!.*alt)/g) || []).length * 5
        ));

        console.log('Performance Metrics finali:', {
            ...performanceMetrics,
            ...webVitals,
            entries: performanceEntries
        });

        try {
            await browser.close();
        } catch (closeError) {
            console.log('Errore nella chiusura del browser:', closeError.message);
        }

        res.setHeader('Cache-Control', 's-maxage=300');
        return res.status(200).json({
            html,
            dataLayer,
            consentModePresent,
            consentModeCalls,
            gtmIds,
            cookieBannerLibs,
            performanceMetrics: {
                ...performanceMetrics,
                ...webVitals,
                ...resourceMetrics,
                entries: performanceEntries
            },
            accessibilityScore,
            seoScore,
            interactiveTestResults,
            screenshots
        });
    } catch (err) {
        console.log('Errore generale nel Puppeteer:', err.message);
        console.log('Stack trace:', err.stack);
        
        try {
            if (browser) {
                await browser.close();
            }
        } catch (closeError) {
            console.log('Errore nella chiusura del browser dopo errore:', closeError.message);
        }
        
        return res.status(500).json({
            error: `Errore nel caricamento della pagina: ${err.message}`,
            details: err.message.includes('timeout') ? 'Il sito impiega troppo tempo a caricare. Prova con un sito più veloce.' : err.message
        });
    }
});

app.listen(PORT, () =>
    console.log(`🧠 Puppeteer server attivo su http://localhost:${PORT}`)
);

