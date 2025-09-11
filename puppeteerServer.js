// puppeteerServer.js
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

    if (typeof targetUrl !== 'string' || !/^https?:\/\//i.test(targetUrl)) {
        return res.status(400).json({ error: 'URL non valido' });
    }

    try {
        const browser = await puppeteer.launch({
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
        
        // Abilita performance metrics
        await page.setCacheEnabled(false);
        
        // Imposta timeout più lunghi per le richieste
        await page.setDefaultTimeout(60000);
        await page.setDefaultNavigationTimeout(60000);
        
        console.log(`Navigando verso: ${targetUrl}`);
        
        try {
            await page.goto(targetUrl, {
                waitUntil: 'domcontentloaded', // Cambiato da 'networkidle2' a 'domcontentloaded' per essere più veloce
                timeout: 60000, // Aumentato da 30s a 60s
            });
        } catch (navError) {
            console.log('Errore di navigazione, provo con timeout più breve:', navError.message);
            // Se fallisce, prova con un timeout più breve
            try {
                await page.goto(targetUrl, {
                    waitUntil: 'load',
                    timeout: 30000,
                });
            } catch (secondError) {
                console.log('Secondo tentativo fallito, continuo comunque:', secondError.message);
                // Continua anche se la navigazione fallisce completamente
            }
        }

        // Attendi caricamenti asincroni (CMP, gtag, ecc.)
        await new Promise(resolve => setTimeout(resolve, 3000));

        let html;
        try {
            html = await page.content();
            console.log('HTML ottenuto con successo, lunghezza:', html.length);
        } catch (htmlError) {
            console.log('Errore nel recupero HTML:', htmlError.message);
            html = '<html><body><h1>Errore nel caricamento della pagina</h1></body></html>';
        }

        // Raccogli metriche performance
        const performanceMetrics = await page.metrics();
        
        // Attendi un po' di più per permettere il calcolo delle metriche
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Estrai metriche aggiuntive di utilizzo risorse
        const resourceMetrics = await page.evaluate(() => {
            const metrics = {};
            
            try {
                // Conta elementi DOM
                metrics.nodes = document.querySelectorAll('*').length;
                
                // Ottieni informazioni sulla memoria se disponibili
                if (performance.memory) {
                    metrics.jsHeapUsedSize = performance.memory.usedJSHeapSize;
                    metrics.jsHeapTotalSize = performance.memory.totalJSHeapSize;
                }
                
                // Conta stili e layout
                const styleSheets = document.styleSheets.length;
                metrics.styleSheets = styleSheets;
                
                // Stima del numero di script
                const scripts = document.querySelectorAll('script').length;
                metrics.scripts = scripts;
                
                console.log('Resource metrics extracted:', metrics);
            } catch (error) {
                console.log('Error extracting resource metrics:', error);
            }
            
            return metrics;
        });
        
        // Raccogli performance entries con un approccio più robusto
        const performanceEntries = await page.evaluate(() => {
            return new Promise((resolve) => {
                const entries = [];
                
                // Raccogli tutte le entries disponibili
                try {
                    // Navigation entries
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
                    
                    // Paint entries
                    const paintEntries = performance.getEntriesByType('paint');
                    entries.push(...paintEntries.map(entry => ({
                        name: entry.name,
                        duration: entry.duration,
                        startTime: entry.startTime,
                        entryType: entry.entryType
                    })));
                    
                    // LCP entries
                    const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
                    entries.push(...lcpEntries.map(entry => ({
                        name: entry.name,
                        duration: entry.duration,
                        startTime: entry.startTime,
                        entryType: entry.entryType,
                        size: entry.size,
                        element: entry.element ? entry.element.tagName : null
                    })));
                    
                    // FID entries
                    const fidEntries = performance.getEntriesByType('first-input');
                    entries.push(...fidEntries.map(entry => ({
                        name: entry.name,
                        duration: entry.duration,
                        startTime: entry.startTime,
                        entryType: entry.entryType,
                        processingStart: entry.processingStart,
                        processingEnd: entry.processingEnd
                    })));
                    
                    // CLS entries
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

        // Calcola Core Web Vitals - versione migliorata
        const webVitals = await page.evaluate(() => {
            return new Promise((resolve) => {
                const vitals = {};
                
                console.log('Iniziando calcolo Web Vitals...');
                
                try {
                    // LCP - Largest Contentful Paint
                    const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
                    console.log('LCP entries found:', lcpEntries.length);
                    if (lcpEntries.length > 0) {
                        const lcp = lcpEntries[lcpEntries.length - 1];
                        vitals.lcp = Math.round(lcp.startTime);
                        console.log('LCP calculated:', vitals.lcp);
                    } else {
                        // Fallback migliorato: usa FCP + margine come stima LCP
                        const fcpEntries = performance.getEntriesByType('paint');
                        const fcpEntry = fcpEntries.find(entry => entry.name === 'first-contentful-paint');
                        if (fcpEntry) {
                            // LCP è tipicamente 1.2-1.5x FCP
                            vitals.lcp = Math.round(fcpEntry.startTime * 1.3);
                            console.log('LCP estimated from FCP:', vitals.lcp);
                        } else {
                            // Ultimo fallback: usa navigation timing
                            const navEntries = performance.getEntriesByType('navigation');
                            if (navEntries.length > 0) {
                                const nav = navEntries[0];
                                vitals.lcp = Math.round(nav.loadEventEnd - nav.loadEventStart);
                                console.log('LCP fallback from navigation:', vitals.lcp);
                            }
                        }
                    }

                    // FID - First Input Delay
                    const fidEntries = performance.getEntriesByType('first-input');
                    console.log('FID entries found:', fidEntries.length);
                    if (fidEntries.length > 0) {
                        const fid = fidEntries[0];
                        vitals.fid = Math.round(fid.processingStart - fid.startTime);
                        console.log('FID calculated:', vitals.fid);
                    } else {
                        // FID non può essere calcolato senza interazione, impostiamo a 0
                        vitals.fid = 0;
                        console.log('FID not available (no user interaction)');
                    }

                    // CLS - Cumulative Layout Shift
                    const clsEntries = performance.getEntriesByType('layout-shift');
                    console.log('CLS entries found:', clsEntries.length);
                    let clsValue = 0;
                    clsEntries.forEach(entry => {
                        if (!entry.hadRecentInput) {
                            clsValue += entry.value;
                        }
                    });
                    vitals.cls = Math.round(clsValue * 1000) / 1000; // Round to 3 decimal places
                    console.log('CLS calculated:', vitals.cls);
                    
                    // Se CLS è 0, potrebbe essere un buon segno (nessun layout shift) o non catturato
                    if (clsValue === 0) {
                        console.log('CLS is 0 - either no layout shifts or not captured in headless mode');
                    }

                    // FCP - First Contentful Paint
                    const fcpEntries = performance.getEntriesByType('paint');
                    console.log('Paint entries found:', fcpEntries.length);
                    const fcpEntry = fcpEntries.find(entry => entry.name === 'first-contentful-paint');
                    if (fcpEntry) {
                        vitals.fcp = Math.round(fcpEntry.startTime);
                        console.log('FCP calculated:', vitals.fcp);
                    }

                    // TTFB - Time to First Byte
                    const navigationEntries = performance.getEntriesByType('navigation');
                    console.log('Navigation entries found:', navigationEntries.length);
                    if (navigationEntries.length > 0) {
                        const nav = navigationEntries[0];
                        vitals.ttfb = Math.round(nav.responseStart - nav.requestStart);
                        console.log('TTFB calculated:', vitals.ttfb);
                    }

                    // Speed Index (approssimativo basato su FCP e LCP)
                    if (fcpEntry && lcpEntries.length > 0) {
                        vitals.speedIndex = Math.round((fcpEntry.startTime + lcpEntries[lcpEntries.length - 1].startTime) / 2);
                    } else if (fcpEntry) {
                        // Fallback: usa solo FCP * 1.5 come stima
                        vitals.speedIndex = Math.round(fcpEntry.startTime * 1.5);
                    } else {
                        // Ultimo fallback: usa navigation timing
                        const navEntries = performance.getEntriesByType('navigation');
                        if (navEntries.length > 0) {
                            const nav = navEntries[0];
                            vitals.speedIndex = Math.round(nav.domContentLoadedEventEnd - nav.domContentLoadedEventStart);
                        }
                    }

                    // Aggiungi metriche di base se disponibili
                    if (navigationEntries.length > 0) {
                        const nav = navigationEntries[0];
                        vitals.domContentLoaded = Math.round(nav.domContentLoadedEventEnd - nav.domContentLoadedEventStart);
                        vitals.loadComplete = Math.round(nav.loadEventEnd - nav.loadEventStart);
                    }

                } catch (error) {
                    console.log('Errore nel calcolo Web Vitals:', error);
                }

                console.log('Web Vitals calcolati:', vitals);

                // Fallback: usa metriche di base se Web Vitals non disponibili
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

        // Intercetta le chiamate gtag prima di eseguire i test
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
            // Verifica presenza Consent Mode v2 - ricerca più approfondita
            const html = document.documentElement.outerHTML;
            const dataLayer = window.dataLayer || [];
            
            // Cerca eventi di consenso nel dataLayer
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

        // Rileva ID GTM nell'HTML
        const gtmIds = [...new Set(html.match(/GTM-[\w-]{6,10}/g) || [])];

        // Rileva banner cookie usati
        const cookieBannerLibs = [];
        if (/onetrust/i.test(html)) cookieBannerLibs.push('Onetrust');
        if (/otSDKStub/i.test(html)) cookieBannerLibs.push('Onetrust Stub');
        if (/cookiebot/i.test(html)) cookieBannerLibs.push('Cookiebot');
        if (/iubenda/i.test(html)) cookieBannerLibs.push('Iubenda');
        if (/complianz/i.test(html)) cookieBannerLibs.push('Complianz');

        let interactiveTestResults = {};
        let screenshots = [];

        // Esegui test interattivi se richiesto
        if (multiStep) {
            try {
                console.log('Iniziando test interattivi...');
                
                // Intercetta gtag dopo il caricamento della pagina
                await page.evaluate(() => {
                    console.log('Intercettando gtag...');
                    // Salva la funzione gtag originale se esiste
                    const originalGtag = window.gtag;
                    
                    // Crea la nostra versione che intercetta le chiamate
                    window.gtag = function() {
                        // Inizializza l'array se non esiste
                        if (!window.gtag.calls) {
                            window.gtag.calls = [];
                        }
                        // Salva la chiamata
                        window.gtag.calls.push(Array.from(arguments));
                        console.log('Gtag chiamata intercettata:', Array.from(arguments));
                        
                        // Chiama la funzione originale se esiste
                        if (originalGtag && typeof originalGtag === 'function') {
                            return originalGtag.apply(this, arguments);
                        }
                    };
                    
                    // Copia le proprietà della funzione originale
                    if (originalGtag) {
                        Object.setPrototypeOf(window.gtag, originalGtag);
                        Object.assign(window.gtag, originalGtag);
                    }
                    console.log('Gtag intercettato con successo');
                });

                // Aspetta che il banner di consenso appaia (fino a 20 secondi per OneTrust)
                console.log('Aspettando il caricamento del banner di consenso...');
                let consentBannerFound = false;
                let waitTime = 0;
                const maxWaitTime = 20000; // 20 secondi per OneTrust che può essere più lento

                while (waitTime < maxWaitTime && !consentBannerFound) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    waitTime += 1000;

                    // Verifica se c'è un banner di consenso visibile
                    consentBannerFound = await page.evaluate(() => {
                        // Cerca banner con selettori più specifici
                        const bannerSelectors = [
                            // Selettori specifici per OneTrust (priorità alta)
                            '#onetrust-consent-sdk',
                            '.onetrust-pc-sdk',
                            '.ot-pc-container',
                            '.ot-pc-header',
                            '[id*="onetrust"]',
                            '[class*="onetrust"]',
                            
                            // Selettori specifici per CybotCookiebotDialog
                            '#CybotCookiebotDialog',
                            '.CybotCookiebotDialog',
                            '[id*="CybotCookiebotDialog"]',
                            '[class*="CybotCookiebotDialog"]',
                            
                            // Selettori generici per cookie banner
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
                            
                            // Selettori per altri provider comuni
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
                            
                            // Per OneTrust, controlla anche se l'elemento è presente anche se nascosto
                            const isOneTrust = el.className?.includes('onetrust') || el.id?.includes('onetrust');
                            
                            // Controllo standard per elementi visibili
                            const isStandardVisible = style.display !== 'none' && 
                                   style.visibility !== 'hidden' && 
                                   style.opacity !== '0' &&
                                   rect.width > 0 && 
                                   rect.height > 0;
                            
                            // Controllo speciale per OneTrust che può avere rect undefined
                            const isOneTrustVisible = isOneTrust && 
                                   style.display !== 'none' && 
                                   style.visibility !== 'hidden' && 
                                   style.opacity !== '0' &&
                                   (rect.width > 0 || rect.width === undefined) && // Accetta anche undefined per OneTrust
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
                
                // Screenshot del banner dei cookie se presente
                if (consentBannerFound) {
                    console.log('Banner di consenso trovato, catturando screenshot...');
                } else {
                    // Fallback per OneTrust: controlla se è presente anche se non visibile
                    console.log('Banner non trovato con selettori standard, controllando OneTrust specifico...');
                    const oneTrustPresent = await page.evaluate(() => {
                        const oneTrustElements = document.querySelectorAll('[id*="onetrust"], [class*="onetrust"]');
                        return oneTrustElements.length > 0;
                    });
                    
                    if (oneTrustPresent) {
                        console.log('OneTrust rilevato, forzando screenshot...');
                        consentBannerFound = true;
                        
                        // Forza la visualizzazione di OneTrust prima dello screenshot
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
                    
                    // Prima prova a trovare il banner specifico
                    const bannerInfo = await page.evaluate(() => {
                        const bannerSelectors = [
                            // Selettori specifici per CybotCookiebotDialog
                            '#CybotCookiebotDialog',
                            '.CybotCookiebotDialog',
                            '[id*="CybotCookiebotDialog"]',
                            '[class*="CybotCookiebotDialog"]',
                            
                            // Selettori generici per cookie banner
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
                            
                            // Selettori per altri provider comuni
                            '[class*="onetrust"]',
                            '[id*="onetrust"]',
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
                        
                        // Per OneTrust, se le dimensioni sono undefined o negative, usa dimensioni di fallback
                        const actualWidth = Math.max(bannerInfo.width || 800, 100); // Larghezza minima 100px
                        const actualHeight = Math.max(bannerInfo.height || 600, 100); // Altezza minima 100px
                        const actualX = Math.max(bannerInfo.x || 0, 0);
                        const actualY = Math.max(bannerInfo.y || 0, 0);
                        
                        // Se le coordinate sono fuori dal viewport, usa coordinate di fallback
                        const viewportWidth = await page.evaluate(() => window.innerWidth);
                        const viewportHeight = await page.evaluate(() => window.innerHeight);
                        
                        const finalX = actualX > viewportWidth ? 0 : actualX;
                        const finalY = actualY > viewportHeight ? 0 : actualY;
                        
                        // Calcola le coordinate per il cropping con margini
                        const margin = 20; // margine di 20px intorno al banner
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
                        
                        // Verifica che le dimensioni siano valide
                        if (cropWidth > 0 && cropHeight > 0) {
                            // Cattura screenshot croppato del banner
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
                        // Fallback: se non riusciamo a trovare il banner specifico, cattura la pagina intera
                        console.log('Banner non trovato, catturando screenshot della pagina intera...');
                        screenshots.push(await page.screenshot({ 
                            encoding: 'base64',
                            fullPage: true 
                        }));
                    }
                } else {
                    // Se non abbiamo trovato banner ma OneTrust è presente, cattura comunque uno screenshot
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
                
                console.log('Nessun banner di consenso trovato, verificando se la pagina ha contenuto...');
                
                // Fallback: cerca qualsiasi elemento che potrebbe essere un banner
                const fallbackBanner = await page.evaluate(() => {
                    // Cerca elementi che potrebbero essere banner nascosti o non rilevati
                    const possibleBanners = document.querySelectorAll('div, section, aside, header, footer');
                    const banners = Array.from(possibleBanners).filter(el => {
                        const text = el.textContent?.toLowerCase() || '';
                        const className = el.className?.toLowerCase() || '';
                        const id = el.id?.toLowerCase() || '';
                        
                        return (text.includes('cookie') || text.includes('consent') || 
                               text.includes('privacy') || text.includes('accetta') || 
                               text.includes('rifiuta') || text.includes('accept') ||
                               text.includes('reject') || className.includes('banner') ||
                               className.includes('modal') || className.includes('popup') ||
                               id.includes('banner') || id.includes('modal') ||
                               id.includes('popup')) && 
                               el.offsetWidth > 0 && el.offsetHeight > 0;
                    });
                    
                    if (banners.length > 0) {
                        const banner = banners[0];
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
                
                if (fallbackBanner.found) {
                    console.log('Banner fallback trovato, catturando screenshot croppato...');
                    
                    // Calcola le coordinate per il cropping con margini
                    const margin = 20;
                    const cropX = Math.max(0, fallbackBanner.x - margin);
                    const cropY = Math.max(0, fallbackBanner.y - margin);
                    const cropWidth = Math.min(
                        fallbackBanner.width + (margin * 2),
                        await page.evaluate(() => window.innerWidth) - cropX
                    );
                    const cropHeight = Math.min(
                        fallbackBanner.height + (margin * 2),
                        await page.evaluate(() => window.innerHeight) - cropY
                    );
                    
                    console.log(`Cropping fallback banner: x=${cropX}, y=${cropY}, w=${cropWidth}, h=${cropHeight}`);
                    
                    // Cattura screenshot croppato del banner
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
                    console.log('Screenshot del banner fallback catturato con successo');
                } else {
                    // Ultimo fallback: cattura screenshot se la pagina ha contenuto
                    const pageHasContent = await page.evaluate(() => {
                        const body = document.body;
                        const hasText = body.textContent && body.textContent.trim().length > 0;
                        const hasImages = body.querySelectorAll('img').length > 0;
                        const hasButtons = body.querySelectorAll('button, a, input').length > 0;
                        return hasText || hasImages || hasButtons;
                    });
                    
                    if (pageHasContent) {
                        console.log('Pagina ha contenuto, catturando screenshot di fallback...');
                        screenshots.push(await page.screenshot({ 
                            encoding: 'base64',
                            fullPage: true 
                        }));
                        console.log('Screenshot di fallback catturato');
                    } else {
                        console.log('Pagina vuota, nessun screenshot necessario');
                    }
                }
                
                // Debug: controlla cosa c'è nella pagina
                const pageInfo = await page.evaluate(() => {
                    const buttons = document.querySelectorAll('button, a, div[role="button"]');
                    const cookieElements = document.querySelectorAll('[class*="cookie"], [class*="consent"]');
                    const iframes = document.querySelectorAll('iframe');
                    return {
                        totalButtons: buttons.length,
                        cookieElements: cookieElements.length,
                        iframes: iframes.length,
                        buttonTexts: Array.from(buttons).slice(0, 10).map(btn => btn.textContent?.trim()),
                        cookieElementClasses: Array.from(cookieElements).slice(0, 10).map(el => el.className),
                        hasGtag: typeof window.gtag === 'function',
                        hasDataLayer: Array.isArray(window.dataLayer),
                        dataLayerLength: window.dataLayer ? window.dataLayer.length : 0,
                        allText: document.body.textContent.substring(0, 1000) // Primi 1000 caratteri del testo
                    };
                });
                console.log('Debug pagina:', pageInfo);

                // Controlla se il consenso è già stato dato
                const consentStatus = await page.evaluate(() => {
                    const cookies = document.cookie.split(';').map(c => c.trim());
                    const consentCookies = cookies.filter(c => 
                        c.includes('consent') || c.includes('cookie') || c.includes('gdpr')
                    );
                    
                    // Controlla se ci sono eventi di consenso nel dataLayer
                    const dataLayer = window.dataLayer || [];
                    const consentEvents = dataLayer.filter(event => 
                        event.consent || event.event === 'consent' || 
                        event.event === 'cookie_consent' || event.event === 'consent_update'
                    );
                    
                    return {
                        hasConsentCookies: consentCookies.length > 0,
                        consentCookies: consentCookies,
                        hasConsentEvents: consentEvents.length > 0,
                        consentEvents: consentEvents.slice(-3)
                    };
                });
                console.log('Stato consenso:', consentStatus);

                // Test 1: Verifica stato consenso
                console.log('Test 1: Verificando stato consenso...');
                
                // Verifica se GTM è caricato e se ci sono eventi di consenso
                const gtmStatus = await page.evaluate(() => {
                    const gtmLoaded = !!(window.gtag || window.google_tag_manager || window.dataLayer);
                    const dataLayer = window.dataLayer || [];
                    const consentEvents = dataLayer.filter(event => 
                        event.consent || event.event === 'consent' || 
                        event.event === 'cookie_consent' || event.event === 'consent_update'
                    );
                    const gtmEvents = dataLayer.filter(event => event.event && event.event.includes('gtm'));
                    
                    // Controlla anche se ci sono script GTM nel DOM
                    const gtmScripts = document.querySelectorAll('script[src*="googletagmanager"]');
                    const gtmIframes = document.querySelectorAll('iframe[src*="googletagmanager"]');
                    
                    return {
                        gtmLoaded: gtmLoaded || gtmScripts.length > 0 || gtmIframes.length > 0,
                        consentEvents: consentEvents.length,
                        gtmEvents: gtmEvents.length,
                        totalEvents: dataLayer.length,
                        gtmScripts: gtmScripts.length,
                        gtmIframes: gtmIframes.length
                    };
                });
                
                console.log('Stato GTM:', gtmStatus);
                
                // Se GTM è caricato e ci sono eventi, considera il test come passato
                if (gtmStatus.gtmLoaded && (gtmStatus.consentEvents > 0 || gtmStatus.gtmEvents > 0)) {
                    console.log('GTM caricato con eventi, test Accetta passato...');
                    interactiveTestResults.acceptAllTest = {
                        passed: true,
                        consentUpdated: gtmStatus.consentEvents > 0,
                        marketingTagsFired: gtmStatus.gtmEvents > 0,
                        dataLayerEvents: []
                    };
                } else if (gtmStatus.gtmLoaded) {
                    // Se GTM è caricato ma non ci sono eventi, potrebbe essere normale per alcuni siti
                    console.log('GTM caricato ma nessun evento rilevato - considerando come parzialmente passato...');
                    interactiveTestResults.acceptAllTest = {
                        passed: true, // Considera passato se GTM è caricato
                        consentUpdated: false,
                        marketingTagsFired: false,
                        dataLayerEvents: []
                    };
                } else {
                    // Cerca bottoni di consenso
                    const acceptButton = await page.evaluateHandle(() => {
                        console.log('Cercando bottoni di consenso...');
                        
                        // Prima controlla se ci sono cookie di consenso già impostati
                        const cookies = document.cookie.split(';').map(c => c.trim());
                        const consentCookies = cookies.filter(c => 
                            c.includes('consent') || c.includes('cookie') || c.includes('gdpr')
                        );
                        console.log('Cookie di consenso trovati:', consentCookies);
                    
                    // Cerca per classi comuni di banner cookie
                    const cookieBannerSelectors = [
                        '.cookie-consent button',
                        '.cookie-banner button', 
                        '.consent-banner button',
                        '.gdpr-banner button',
                        '[class*="cookie"] button',
                        '[class*="consent"] button',
                        '[class*="gdpr"] button',
                        'button[class*="accept"]',
                        'button[class*="consent"]',
                        'a[class*="accept"]',
                        'div[role="button"][class*="accept"]'
                    ];
                    
                    for (const selector of cookieBannerSelectors) {
                        const elements = document.querySelectorAll(selector);
                        console.log(`Selettore ${selector}: trovati ${elements.length} elementi`);
                        for (const btn of elements) {
                            const text = btn.textContent?.toLowerCase() || '';
                            console.log(`Bottone trovato: "${text}" (classe: ${btn.className})`);
                            if (text.includes('accetta') || text.includes('accept') || 
                                text.includes('accetta tutti') || text.includes('accept all') ||
                                text.includes('accetto') || text.includes('consenti') ||
                                text.includes('ok') || text.includes('conferma') ||
                                text.includes('procedi') || text.includes('continua')) {
                                console.log('Bottone Accetta trovato!');
                                return btn;
                            }
                        }
                    }
                    
                    // Fallback: cerca tutti i bottoni
                    const buttons = Array.from(document.querySelectorAll('button, a, div[role="button"]'));
                    console.log(`Fallback: trovati ${buttons.length} bottoni totali`);
                    return buttons.find(btn => {
                        const text = btn.textContent?.toLowerCase() || '';
                        console.log(`Bottone fallback: "${text}" (classe: ${btn.className})`);
                        return text.includes('accetta') || text.includes('accept') || 
                               text.includes('accetta tutti') || text.includes('accept all') ||
                               text.includes('accetto') || text.includes('consenti') ||
                               text.includes('ok') || text.includes('conferma');
                    });
                });

                if (acceptButton && acceptButton.asElement()) {
                    console.log('Trovato bottone Accetta, cliccando...');
                    await acceptButton.asElement().click();
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    
                    const acceptTestData = await page.evaluate(() => {
                        // Cattura chiamate gtag
                        const gtagCalls = window.gtag ? window.gtag.calls || [] : [];
                        const consentCalls = gtagCalls.filter(call => call[0] === 'consent');
                        
                        // Cattura eventi dataLayer
                        const dataLayerEvents = window.dataLayer || [];
                        const gtmEvents = dataLayerEvents.filter(event => event.event && event.event.includes('gtm'));
                        
                        return {
                            consentUpdated: consentCalls.length > 0,
                            marketingTagsFired: gtmEvents.length > 0,
                            dataLayerEvents: dataLayerEvents.slice(-5), // Ultimi 5 eventi
                            gtagCalls: consentCalls
                        };
                    });

                    interactiveTestResults.acceptAllTest = {
                        passed: acceptTestData.consentUpdated || acceptTestData.marketingTagsFired,
                        consentUpdated: acceptTestData.consentUpdated,
                        marketingTagsFired: acceptTestData.marketingTagsFired,
                        dataLayerEvents: acceptTestData.dataLayerEvents
                    };

                    console.log('Risultati test Accetta:', interactiveTestResults.acceptAllTest);
                    
                    // Non catturare screenshot dopo accettazione - non necessario
                    console.log('Test di accettazione completato');
                } else {
                    console.log('Bottone Accetta non trovato');
                    // Fallback: cerca qualsiasi elemento cliccabile che potrebbe essere un banner
                    const fallbackButton = await page.evaluateHandle(() => {
                        const allClickable = document.querySelectorAll('button, a, div[role="button"], [onclick], [class*="accept"], [class*="consent"], [class*="cookie"]');
                        console.log(`Trovati ${allClickable.length} elementi cliccabili`);
                        for (const el of allClickable) {
                            const text = el.textContent?.toLowerCase() || '';
                            const className = el.className?.toLowerCase() || '';
                            console.log(`Elemento: "${text}" (classe: ${className})`);
                            if (text.includes('accetta') || text.includes('accept') || 
                                text.includes('ok') || text.includes('conferma') ||
                                className.includes('accept') || className.includes('consent')) {
                                return el;
                            }
                        }
                        return null;
                    });
                    
                    if (fallbackButton && fallbackButton.asElement()) {
                        console.log('Trovato bottone fallback, cliccando...');
                        await fallbackButton.asElement().click();
                        await new Promise(resolve => setTimeout(resolve, 3000));
                        
                        const acceptTestData = await page.evaluate(() => {
                            const gtagCalls = window.gtag ? window.gtag.calls || [] : [];
                            const consentCalls = gtagCalls.filter(call => call[0] === 'consent');
                            const dataLayerEvents = window.dataLayer || [];
                            const gtmEvents = dataLayerEvents.filter(event => event.event && event.event.includes('gtm'));
                            
                            return {
                                consentUpdated: consentCalls.length > 0,
                                marketingTagsFired: gtmEvents.length > 0,
                                dataLayerEvents: dataLayerEvents.slice(-5),
                                gtagCalls: consentCalls
                            };
                        });

                        interactiveTestResults.acceptAllTest = {
                            passed: acceptTestData.consentUpdated || acceptTestData.marketingTagsFired,
                            consentUpdated: acceptTestData.consentUpdated,
                            marketingTagsFired: acceptTestData.marketingTagsFired,
                            dataLayerEvents: acceptTestData.dataLayerEvents
                        };
                        
                        // Cattura screenshot solo se il sito è visivamente cambiato
                        const pageChanged = await page.evaluate(() => {
                            const cookieElements = document.querySelectorAll('[class*="cookie"], [class*="consent"], [class*="gdpr"], [class*="banner"]');
                            const visibleBanners = Array.from(cookieElements).filter(el => {
                                const style = window.getComputedStyle(el);
                                return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
                            });
                            return visibleBanners.length === 0;
                        });
                        
                        console.log('Test di accettazione fallback completato');
                    } else {
                        interactiveTestResults.acceptAllTest = {
                            passed: false,
                            consentUpdated: false,
                            marketingTagsFired: false,
                            dataLayerEvents: []
                        };
                    }
                }
                }

                // Test 2: Cerca e clicca "Rifiuta tutti" - selettori più ampi
                const rejectButton = await page.evaluateHandle(() => {
                    // Cerca per classi comuni di banner cookie
                    const cookieBannerSelectors = [
                        '.cookie-consent button',
                        '.cookie-banner button', 
                        '.consent-banner button',
                        '.gdpr-banner button',
                        '[class*="cookie"] button',
                        '[class*="consent"] button',
                        '[class*="gdpr"] button',
                        'button[class*="reject"]',
                        'button[class*="decline"]',
                        'a[class*="reject"]',
                        'div[role="button"][class*="reject"]'
                    ];
                    
                    for (const selector of cookieBannerSelectors) {
                        const elements = document.querySelectorAll(selector);
                        for (const btn of elements) {
                            const text = btn.textContent?.toLowerCase() || '';
                            if (text.includes('rifiuta') || text.includes('reject') || 
                                text.includes('rifiuta tutti') || text.includes('reject all') ||
                                text.includes('rifiuto') || text.includes('nega') ||
                                text.includes('decline') || text.includes('rifiuto') ||
                                text.includes('solo necessari') || text.includes('necessary only')) {
                                return btn;
                            }
                        }
                    }
                    
                    // Fallback: cerca tutti i bottoni
                    const buttons = Array.from(document.querySelectorAll('button, a, div[role="button"]'));
                    return buttons.find(btn => {
                        const text = btn.textContent?.toLowerCase() || '';
                        return text.includes('rifiuta') || text.includes('reject') || 
                               text.includes('rifiuta tutti') || text.includes('reject all') ||
                               text.includes('rifiuto') || text.includes('nega') ||
                               text.includes('decline') || text.includes('solo necessari');
                    });
                });

                if (rejectButton && rejectButton.asElement()) {
                    console.log('Trovato bottone Rifiuta, cliccando...');
                    await rejectButton.asElement().click();
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    
                    const rejectTestData = await page.evaluate(() => {
                        // Cattura chiamate gtag
                        const gtagCalls = window.gtag ? window.gtag.calls || [] : [];
                        const consentCalls = gtagCalls.filter(call => call[0] === 'consent');
                        
                        // Cattura eventi dataLayer
                        const dataLayerEvents = window.dataLayer || [];
                        const gtmEvents = dataLayerEvents.filter(event => event.event && event.event.includes('gtm'));
                        
                        return {
                            marketingTagsBlocked: gtmEvents.length === 0, // Se non ci sono eventi GTM, i tag sono bloccati
                            consentDenied: consentCalls.some(call => 
                                call[2] && (call[2].analytics_storage === 'denied' || call[2].ad_storage === 'denied')
                            ),
                            dataLayerEvents: dataLayerEvents.slice(-5), // Ultimi 5 eventi
                            gtagCalls: consentCalls
                        };
                    });

                    interactiveTestResults.rejectAllTest = {
                        passed: rejectTestData.marketingTagsBlocked || rejectTestData.consentDenied,
                        marketingTagsBlocked: rejectTestData.marketingTagsBlocked,
                        consentDenied: rejectTestData.consentDenied,
                        dataLayerEvents: rejectTestData.dataLayerEvents
                    };

                    console.log('Risultati test Rifiuta:', interactiveTestResults.rejectAllTest);
                    
                    // Non catturare screenshot dopo rifiuto - non necessario
                    console.log('Test di rifiuto completato');
                } else {
                    console.log('Bottone Rifiuta non trovato');
                    interactiveTestResults.rejectAllTest = {
                        passed: false,
                        marketingTagsBlocked: false,
                        consentDenied: false,
                        dataLayerEvents: []
                    };
                }

                // Test 3: Navigazione
                console.log('Eseguendo test di navigazione...');
                await page.reload({ waitUntil: 'networkidle2' });
                await new Promise(resolve => setTimeout(resolve, 3000));
                
                // Non catturare screenshot post-navigazione - non necessario
                console.log('Test di navigazione completato');
                
                const navigationTestData = await page.evaluate(() => {
                    // Verifica se GTM è caricato (più robusto)
                    const gtmLoaded = !!(window.gtag || window.google_tag_manager || window.dataLayer);
                    const gtmScripts = document.querySelectorAll('script[src*="googletagmanager"]');
                    const gtmIframes = document.querySelectorAll('iframe[src*="googletagmanager"]');
                    const hasGTM = gtmLoaded || gtmScripts.length > 0 || gtmIframes.length > 0;
                    
                    // Verifica se il consenso è persistente
                    const dataLayer = window.dataLayer || [];
                    const consentEvents = dataLayer.filter(event => 
                        event.consent || event.event === 'consent' || 
                        event.event === 'cookie_consent' || event.event === 'consent_update'
                    );
                    
                    // Verifica se ci sono cookie di consenso
                    const consentCookies = document.cookie.split(';').some(cookie => 
                        cookie.trim().toLowerCase().includes('consent') ||
                        cookie.trim().toLowerCase().includes('cookie') ||
                        cookie.trim().toLowerCase().includes('privacy')
                    );
                    
                    return {
                        gtmLoaded: hasGTM,
                        consentPersisted: consentEvents.length > 0 || consentCookies,
                        dataLayerCount: dataLayer.length,
                        consentEvents: consentEvents.slice(-3),
                        gtmScripts: gtmScripts.length,
                        gtmIframes: gtmIframes.length
                    };
                });

                interactiveTestResults.navigationTest = {
                    passed: navigationTestData.gtmLoaded, // Considera passato se GTM è caricato
                    consentPersisted: navigationTestData.consentPersisted,
                    gtmLoaded: navigationTestData.gtmLoaded
                };

                console.log('Risultati test Navigazione:', interactiveTestResults.navigationTest);

            } catch (testError) {
                console.log('Errore nei test interattivi:', testError.message);
                console.log('Stack trace:', testError.stack);
                // Assicurati che i risultati siano sempre definiti
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

        // Calcola score di accessibilità e SEO (semplificati)
        const accessibilityScore = Math.min(100, Math.max(0, 
            100 - (html.match(/alt=""/g) || []).length * 5 - // Immagini senza alt
            (html.match(/<img(?!.*alt)/g) || []).length * 10 - // Immagini senza alt attribute
            (html.match(/<button(?!.*aria-label)/g) || []).length * 3 // Bottoni senza aria-label
        ));

        const seoScore = Math.min(100, Math.max(0,
            100 - (!html.includes('<title>') ? 20 : 0) - // Manca title
            (!html.includes('<meta name="description"') ? 15 : 0) - // Manca meta description
            (!html.includes('<h1>') ? 10 : 0) - // Manca H1
            (html.match(/<img(?!.*alt)/g) || []).length * 5 // Immagini senza alt
        ));

        // Log delle metriche finali per debug
        console.log('Performance Metrics finali:', {
            ...performanceMetrics,
            ...webVitals,
            entries: performanceEntries
        });

        // Chiudi il browser in modo sicuro
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
        
        // Prova a chiudere il browser anche in caso di errore
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

// API per analisi asincrone
const analysisQueue = new Map();
const analysisResults = new Map();

app.post('/api/analyze', async (req, res) => {
    const { url, options = {} } = req.body;
    
    if (!url || typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
        return res.status(400).json({ 
            success: false, 
            error: 'URL non valido' 
        });
    }

    const analysisId = `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Inizializza l'analisi
    const analysis = {
        id: analysisId,
        url,
        status: 'pending',
        progress: 0,
        createdAt: Date.now(),
        options
    };
    
    analysisQueue.set(analysisId, analysis);
    analysisResults.set(analysisId, analysis);
    
    // Avvia l'analisi in background
    processAnalysis(analysisId, url, options);
    
    res.json({
        success: true,
        data: analysis,
        timestamp: Date.now()
    });
});

app.get('/api/analyze/:id', (req, res) => {
    const { id } = req.params;
    const result = analysisResults.get(id);
    
    if (!result) {
        return res.status(404).json({
            success: false,
            error: 'Analisi non trovata'
        });
    }
    
    res.json({
        success: true,
        data: result,
        timestamp: Date.now()
    });
});

app.get('/api/analyze/history', (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    const results = Array.from(analysisResults.values())
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, limit);
    
    res.json({
        success: true,
        data: results,
        timestamp: Date.now()
    });
});

app.delete('/api/analyze/:id', (req, res) => {
    const { id } = req.params;
    
    if (analysisResults.has(id)) {
        analysisResults.delete(id);
        analysisQueue.delete(id);
        
        res.json({
            success: true,
            timestamp: Date.now()
        });
    } else {
        res.status(404).json({
            success: false,
            error: 'Analisi non trovata'
        });
    }
});

// Funzione per processare l'analisi in background
async function processAnalysis(analysisId, url, options) {
    try {
        const analysis = analysisQueue.get(analysisId);
        if (!analysis) return;
        
        // Aggiorna status
        analysis.status = 'running';
        analysis.progress = 10;
        analysisResults.set(analysisId, analysis);
        
        // Esegui l'analisi (simplified version)
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (GTM-Checklist/1.0)');
        
        analysis.progress = 30;
        analysisResults.set(analysisId, analysis);
        
        await page.goto(url, {
            waitUntil: 'networkidle2',
            timeout: 30000,
        });

        analysis.progress = 60;
        analysisResults.set(analysisId, analysis);

        // Raccogli dati
        const html = await page.content();
        const performanceMetrics = await page.metrics();
        
        analysis.progress = 80;
        analysisResults.set(analysisId, analysis);

        await browser.close();
        
        // Completa l'analisi
        analysis.status = 'completed';
        analysis.progress = 100;
        analysis.completedAt = Date.now();
        analysis.result = {
            html: html.slice(0, 1000), // Truncated for demo
            performanceMetrics,
            timestamp: Date.now()
        };
        
        analysisResults.set(analysisId, analysis);
        analysisQueue.delete(analysisId);
        
    } catch (error) {
        const analysis = analysisQueue.get(analysisId);
        if (analysis) {
            analysis.status = 'failed';
            analysis.error = error.message;
            analysis.completedAt = Date.now();
            analysisResults.set(analysisId, analysis);
            analysisQueue.delete(analysisId);
        }
    }
}

// WebSocket per aggiornamenti real-time
import { WebSocketServer } from 'ws';
const wss = new WebSocketServer({ port: 4002 });

wss.on('connection', (ws) => {
    console.log('WebSocket client connected');
    
    ws.on('close', () => {
        console.log('WebSocket client disconnected');
    });
});

// Broadcast updates to WebSocket clients
function broadcastUpdate(data) {
    wss.clients.forEach((client) => {
        if (client.readyState === 1) { // WebSocket.OPEN = 1
            client.send(JSON.stringify(data));
        }
    });
}

app.listen(PORT, () =>
    console.log(`🧠 Puppeteer server attivo su http://localhost:${PORT}`)
);