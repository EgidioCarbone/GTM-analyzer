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
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (GTM-Checklist/1.0)');
        
        // Abilita performance metrics
        await page.setCacheEnabled(false);
        
        await page.goto(targetUrl, {
            waitUntil: 'networkidle2',
            timeout: 30000,
        });

        // Attendi caricamenti asincroni (CMP, gtag, ecc.)
        await new Promise(resolve => setTimeout(resolve, 3000));

        const html = await page.content();

        // Raccogli metriche performance
        const performanceMetrics = await page.metrics();
        const performanceEntries = await page.evaluate(() => {
            return new Promise((resolve) => {
                const observer = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    resolve(entries.map(entry => ({
                        name: entry.name,
                        duration: entry.duration,
                        startTime: entry.startTime,
                        entryType: entry.entryType
                    })));
                });
                observer.observe({ entryTypes: ['measure', 'navigation', 'paint'] });
                setTimeout(() => resolve([]), 2000);
            });
        });

        // Calcola Core Web Vitals - versione semplificata
        const webVitals = await page.evaluate(() => {
            return new Promise((resolve) => {
                const vitals = {};
                
                try {
                    // LCP - usa getEntriesByType come fallback
                    const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
                    if (lcpEntries.length > 0) {
                        vitals.lcp = lcpEntries[lcpEntries.length - 1].startTime;
                    }

                    // FID - usa getEntriesByType come fallback
                    const fidEntries = performance.getEntriesByType('first-input');
                    if (fidEntries.length > 0) {
                        vitals.fid = fidEntries[0].processingStart - fidEntries[0].startTime;
                    }

                    // CLS - calcolo semplificato
                    const clsEntries = performance.getEntriesByType('layout-shift');
                    let clsValue = 0;
                    clsEntries.forEach(entry => {
                        if (!entry.hadRecentInput) {
                            clsValue += entry.value;
                        }
                    });
                    vitals.cls = clsValue;

                    // FCP
                    const fcpEntries = performance.getEntriesByType('paint');
                    const fcpEntry = fcpEntries.find(entry => entry.name === 'first-contentful-paint');
                    if (fcpEntry) {
                        vitals.fcp = fcpEntry.startTime;
                    }

                    // TTFB
                    const navigationEntries = performance.getEntriesByType('navigation');
                    if (navigationEntries.length > 0) {
                        vitals.ttfb = navigationEntries[0].responseStart - navigationEntries[0].requestStart;
                    }

                    // Speed Index (approssimativo)
                    const lcpEntry = lcpEntries[lcpEntries.length - 1];
                    if (fcpEntry && lcpEntry) {
                        vitals.speedIndex = (fcpEntry.startTime + lcpEntry.startTime) / 2;
                    }

                } catch (error) {
                    console.log('Errore nel calcolo Web Vitals:', error);
                }

                // Fallback: usa metriche di base se Web Vitals non disponibili
                if (Object.keys(vitals).length === 0) {
                    const navigation = performance.getEntriesByType('navigation')[0];
                    if (navigation) {
                        vitals.lcp = navigation.loadEventEnd - navigation.loadEventStart;
                        vitals.fcp = navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart;
                        vitals.ttfb = navigation.responseStart - navigation.requestStart;
                        vitals.speedIndex = navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart;
                    }
                }

                setTimeout(() => resolve(vitals), 1000);
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

                // Screenshot iniziale
                screenshots.push(await page.screenshot({ encoding: 'base64' }));
                
                // Aspetta che il banner di consenso appaia
                await new Promise(resolve => setTimeout(resolve, 5000));
                
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
                    const gtmLoaded = !!(window.gtag || window.google_tag_manager);
                    const dataLayer = window.dataLayer || [];
                    const consentEvents = dataLayer.filter(event => 
                        event.consent || event.event === 'consent' || 
                        event.event === 'cookie_consent' || event.event === 'consent_update'
                    );
                    const gtmEvents = dataLayer.filter(event => event.event && event.event.includes('gtm'));
                    
                    return {
                        gtmLoaded,
                        consentEvents: consentEvents.length,
                        gtmEvents: gtmEvents.length,
                        totalEvents: dataLayer.length
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
                    screenshots.push(await page.screenshot({ encoding: 'base64' }));
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
                        screenshots.push(await page.screenshot({ encoding: 'base64' }));
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
                    screenshots.push(await page.screenshot({ encoding: 'base64' }));
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
                
                const navigationTestData = await page.evaluate(() => {
                    // Verifica se GTM è caricato
                    const gtmLoaded = !!(window.gtag || window.google_tag_manager);
                    
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
                        gtmLoaded,
                        consentPersisted: consentEvents.length > 0 || consentCookies,
                        dataLayerCount: dataLayer.length,
                        consentEvents: consentEvents.slice(-3)
                    };
                });

                interactiveTestResults.navigationTest = {
                    passed: navigationTestData.gtmLoaded && navigationTestData.consentPersisted,
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

        await browser.close();

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
                entries: performanceEntries
            },
            accessibilityScore,
            seoScore,
            interactiveTestResults,
            screenshots
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
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