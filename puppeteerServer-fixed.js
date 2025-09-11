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

        if (multiStep) {
            try {
                console.log('Iniziando test interattivi...');
                
                await page.evaluate(() => {
                    console.log('Intercettando gtag...');
                    const originalGtag = window.gtag;
                    
                    window.gtag = function() {
                        if (!window.gtag.calls) {
                            window.gtag.calls = [];
                        }
                        window.gtag.calls.push(Array.from(arguments));
                        console.log('Gtag chiamata intercettata:', Array.from(arguments));
                        
                        if (originalGtag && typeof originalGtag === 'function') {
                            return originalGtag.apply(this, arguments);
                        }
                    };
                    
                    if (originalGtag) {
                        Object.setPrototypeOf(window.gtag, originalGtag);
                        Object.assign(window.gtag, originalGtag);
                    }
                    console.log('Gtag intercettato con successo');
                });

                console.log('Aspettando il caricamento del banner di consenso...');
                let consentBannerFound = false;
                let waitTime = 0;
                const maxWaitTime = 20000;

                while (waitTime < maxWaitTime && !consentBannerFound) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    waitTime += 1000;

                    consentBannerFound = await page.evaluate(() => {
                        const bannerSelectors = [
                            '#onetrust-consent-sdk',
                            '.onetrust-pc-sdk',
                            '.ot-pc-container',
                            '.ot-pc-header',
                            '[id*="onetrust"]',
                            '[class*="onetrust"]',
                            '#CybotCookiebotDialog',
                            '.CybotCookiebotDialog',
                            '[id*="CybotCookiebotDialog"]',
                            '[class*="CybotCookiebotDialog"]',
                            '[class*="cookie"]',
                            '[class*="consent"]',
                            '[class*="gdpr"]',
                            '[class*="banner"]',
                            '[id*="cookie"]',
                            '[id*="consent"]',
                            '[id*="gdpr"]',
                            '[id*="banner"]',
                            '.cookie-consent',
                            '.cookie-banner',
                            '.consent-banner',
                            '.gdpr-banner',
                            '[class*="iubenda"]',
                            '[id*="iubenda"]',
                            '[class*="complianz"]',
                            '[id*="complianz"]'
                        ];
                        
                        let allElements = [];
                        for (const selector of bannerSelectors) {
                            const elements = document.querySelectorAll(selector);
                            allElements = allElements.concat(Array.from(elements));
                        }
                        
                        const visibleBanners = allElements.filter(el => {
                            const style = window.getComputedStyle(el);
                            const rect = el.getBoundingClientRect();
                            const isOneTrust = el.className?.includes('onetrust') || el.id?.includes('onetrust');
                            
                            const isStandardVisible = style.display !== 'none' && 
                                   style.visibility !== 'hidden' && 
                                   style.opacity !== '0' &&
                                   rect.width > 0 && 
                                   rect.height > 0;
                            
                            const isOneTrustVisible = isOneTrust && 
                                   style.display !== 'none' && 
                                   style.visibility !== 'hidden' && 
                                   style.opacity !== '0' &&
                                   (rect.width > 0 || rect.width === undefined) &&
                                   (rect.height > 0 || rect.height === undefined);
                            
                            return isStandardVisible || isOneTrustVisible;
                        });
                        
                        const cookieTexts = visibleBanners.some(el => {
                            const text = el.textContent?.toLowerCase() || '';
                            return text.includes('cookie') || text.includes('consent') || 
                                   text.includes('accetta') || text.includes('rifiuta') ||
                                   text.includes('accept') || text.includes('reject') ||
                                   text.includes('accetto') || text.includes('rifiuto');
                        });
                        
                        console.log(`Trovati ${visibleBanners.length} banner visibili, testi cookie: ${cookieTexts}`);
                        return visibleBanners.length > 0 && cookieTexts;
                    });
                    
                    console.log(`Attesa: ${waitTime}ms, Banner trovato: ${consentBannerFound}`);
                }
                
                if (consentBannerFound) {
                    console.log('Banner di consenso trovato, catturando screenshot...');
                } else {
                    console.log('Banner non trovato con selettori standard, controllando OneTrust specifico...');
                    const oneTrustPresent = await page.evaluate(() => {
                        const oneTrustElements = document.querySelectorAll('[id*="onetrust"], [class*="onetrust"]');
                        return oneTrustElements.length > 0;
                    });
                    
                    if (oneTrustPresent) {
                        console.log('OneTrust rilevato, forzando screenshot...');
                        consentBannerFound = true;
                        
                        await page.evaluate(() => {
                            const oneTrustElements = document.querySelectorAll('[id*="onetrust"], [class*="onetrust"]');
                            oneTrustElements.forEach(el => {
                                if (el.style) {
                                    el.style.display = 'block';
                                    el.style.visibility = 'visible';
                                    el.style.opacity = '1';
                                    el.style.zIndex = '999999';
                                    el.style.position = 'fixed';
                                    el.style.top = '0';
                                    el.style.left = '0';
                                    el.style.width = '100%';
                                    el.style.height = '100%';
                                }
                            });
                        });
                    }
                }
                
                if (consentBannerFound) {
                    const bannerInfo = await page.evaluate(() => {
                        const bannerSelectors = [
                            '#onetrust-consent-sdk',
                            '.onetrust-pc-sdk',
                            '.ot-pc-container',
                            '.ot-pc-header',
                            '[id*="onetrust"]',
                            '[class*="onetrust"]',
                            '#CybotCookiebotDialog',
                            '.CybotCookiebotDialog',
                            '[id*="CybotCookiebotDialog"]',
                            '[class*="CybotCookiebotDialog"]',
                            '[class*="cookie"]',
                            '[class*="consent"]',
                            '[class*="gdpr"]',
                            '[class*="banner"]',
                            '[id*="cookie"]',
                            '[id*="consent"]',
                            '[id*="gdpr"]',
                            '[id*="banner"]',
                            '.cookie-consent',
                            '.cookie-banner',
                            '.consent-banner',
                            '.gdpr-banner',
                            '[class*="iubenda"]',
                            '[id*="iubenda"]',
                            '[class*="complianz"]',
                            '[id*="complianz"]'
                        ];
                        
                        let allElements = [];
                        for (const selector of bannerSelectors) {
                            const elements = document.querySelectorAll(selector);
                            allElements = allElements.concat(Array.from(elements));
                        }
                        
                        const visibleBanners = allElements.filter(el => {
                            const style = window.getComputedStyle(el);
                            const rect = el.getBoundingClientRect();
                            return style.display !== 'none' && 
                                   style.visibility !== 'hidden' && 
                                   style.opacity !== '0' &&
                                   rect.width > 0 && 
                                   rect.height > 0;
                        });
                        
                        if (visibleBanners.length > 0) {
                            const banner = visibleBanners[0];
                            const rect = banner.getBoundingClientRect();
                            return {
                                found: true,
                                x: rect.x,
                                y: rect.y,
                                width: rect.width,
                                height: rect.height,
                                text: banner.textContent?.substring(0, 100) || 'No text',
                                tagName: banner.tagName,
                                className: banner.className,
                                id: banner.id
                            };
                        }
                        return { found: false };
                    });
                    
                    console.log('Info banner:', bannerInfo);
                    
                    if (bannerInfo.found) {
                        console.log('Banner trovato, catturando screenshot croppato...');
                        
                        const actualWidth = Math.max(bannerInfo.width || 800, 100);
                        const actualHeight = Math.max(bannerInfo.height || 600, 100);
                        const actualX = Math.max(bannerInfo.x || 0, 0);
                        const actualY = Math.max(bannerInfo.y || 0, 0);
                        
                        const viewportWidth = await page.evaluate(() => window.innerWidth);
                        const viewportHeight = await page.evaluate(() => window.innerHeight);
                        
                        const finalX = actualX > viewportWidth ? 0 : actualX;
                        const finalY = actualY > viewportHeight ? 0 : actualY;
                        
                        const margin = 20;
                        const cropX = Math.max(0, finalX - margin);
                        const cropY = Math.max(0, finalY - margin);
                        const cropWidth = Math.min(
                            actualWidth + (margin * 2),
                            viewportWidth - cropX
                        );
                        const cropHeight = Math.min(
                            actualHeight + (margin * 2),
                            viewportHeight - cropY
                        );
                        
                        console.log(`Cropping banner: x=${cropX}, y=${cropY}, w=${cropWidth}, h=${cropHeight}`);
                        
                        if (cropWidth > 0 && cropHeight > 0) {
                            const bannerScreenshot = await page.screenshot({
                                encoding: 'base64',
                                clip: {
                                    x: cropX,
                                    y: cropY,
                                    width: cropWidth,
                                    height: cropHeight
                                }
                            });
                            
                            screenshots.push(bannerScreenshot);
                            console.log('Screenshot del banner catturato con successo');
                        } else {
                            console.log('Dimensioni non valide per il cropping, catturando screenshot della pagina intera...');
                            screenshots.push(await page.screenshot({ 
                                encoding: 'base64',
                                fullPage: true 
                            }));
                        }
                    } else {
                        console.log('Banner non trovato, catturando screenshot della pagina intera...');
                        screenshots.push(await page.screenshot({ 
                            encoding: 'base64',
                            fullPage: true 
                        }));
                    }
                } else {
                    console.log('Nessun banner di consenso trovato, verificando se la pagina ha contenuto...');
                    const oneTrustPresent = await page.evaluate(() => {
                        const oneTrustElements = document.querySelectorAll('[id*="onetrust"], [class*="onetrust"]');
                        return oneTrustElements.length > 0;
                    });
                    
                    if (oneTrustPresent) {
                        console.log('OneTrust presente ma non visibile, catturando screenshot di fallback...');
                        screenshots.push(await page.screenshot({ 
                            encoding: 'base64',
                            fullPage: true 
                        }));
                    }
                    console.log('Screenshot catturato');
                }

            } catch (testError) {
                console.log('Errore nei test interattivi:', testError.message);
                interactiveTestResults = {
                    acceptAllTest: {
                        passed: false,
                        consentUpdated: false,
                        marketingTagsFired: false,
                        dataLayerEvents: []
                    },
                    rejectAllTest: {
                        passed: false,
                        marketingTagsBlocked: false,
                        consentDenied: false,
                        dataLayerEvents: []
                    },
                    navigationTest: {
                        passed: false,
                        consentPersisted: false,
                        gtmLoaded: false
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

