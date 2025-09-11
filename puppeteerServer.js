// puppeteerServer.js - VERSIONE CORRETTA SENZA DUPLICATI
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
            const memory = performance.memory;
            const navigation = performance.getEntriesByType('navigation')[0];
            const paint = performance.getEntriesByType('paint');
            
            return {
                jsHeapUsedSize: memory ? memory.usedJSHeapSize : 0,
                jsHeapTotalSize: memory ? memory.totalJSHeapSize : 0,
                nodes: document.querySelectorAll('*').length,
                layoutCount: performance.getEntriesByType('layout-shift').length,
                fcp: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0,
                lcp: 0, // Non disponibile in headless
                fid: 0, // Non disponibile in headless
                cls: 0, // Non disponibile in headless
                ttfb: navigation ? navigation.responseStart - navigation.requestStart : 0,
                speedIndex: 0 // Richiede calcolo complesso
            };
        });

        // Estrai dataLayer
        const dataLayer = await page.evaluate(() => {
            return window.dataLayer || [];
        });

        // Verifica presenza GTM
        const gtmIds = await page.evaluate(() => {
            const scripts = document.querySelectorAll('script');
            const gtmIds = [];
            scripts.forEach(script => {
                const src = script.src || '';
                const content = script.textContent || '';
                
                // Cerca GTM ID nel src
                const srcMatch = src.match(/gtm\.js\?id=(GTM-[A-Z0-9]+)/);
                if (srcMatch) {
                    gtmIds.push(srcMatch[1]);
                }
                
                // Cerca GTM ID nel contenuto
                const contentMatch = content.match(/GTM-[A-Z0-9]+/g);
                if (contentMatch) {
                    gtmIds.push(...contentMatch);
                }
            });
            return [...new Set(gtmIds)];
        });

        // Verifica presenza cookie banner
        const cookieBannerLibs = await page.evaluate(() => {
            const libs = [];
            const scripts = document.querySelectorAll('script');
            const links = document.querySelectorAll('link');
            
            [...scripts, ...links].forEach(el => {
                const src = el.src || el.href || '';
                const content = el.textContent || '';
                
                if (src.includes('onetrust') || content.includes('OneTrust')) libs.push('OneTrust');
                if (src.includes('iubenda') || content.includes('iubenda')) libs.push('Iubenda');
                if (src.includes('complianz') || content.includes('complianz')) libs.push('Complianz');
                if (src.includes('cookiebot') || content.includes('cookiebot')) libs.push('Cookiebot');
                if (src.includes('cookiepro') || content.includes('cookiepro')) libs.push('CookiePro');
            });
            
            return [...new Set(libs)];
        });

        // Verifica consent mode
        const consentModePresent = await page.evaluate(() => {
            return typeof window.gtag === 'function' && 
                   window.gtag.toString().includes('consent');
        });

        // Estrai chiamate consent mode
        const consentModeCalls = await page.evaluate(() => {
            const calls = [];
            if (typeof window.gtag === 'function') {
                const originalGtag = window.gtag;
                window.gtag = function(...args) {
                    if (args[0] === 'consent') {
                        calls.push({
                            mode: args[1],
                            payload: args[2],
                            timestamp: Date.now()
                        });
                    }
                    return originalGtag.apply(this, args);
                };
            }
            return calls;
        });

        // CATTURA UN SOLO SCREENSHOT - LOGICA CORRETTA
        const screenshots = [];
        let screenshotCaptured = false;

        // Cerca banner di consenso cookie
        const bannerInfo = await page.evaluate(() => {
            const bannerSelectors = [
                // OneTrust
                '[id*="onetrust"]',
                '[class*="onetrust"]',
                // Cookie banner generici
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
                // Altri provider
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
        
        if (bannerInfo.found && !screenshotCaptured) {
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
                screenshotCaptured = true;
                console.log('Screenshot del banner catturato con successo');
            }
        }
        
        // Se non abbiamo ancora catturato uno screenshot, cerca banner fallback
        if (!screenshotCaptured) {
            const fallbackBanner = await page.evaluate(() => {
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
                screenshotCaptured = true;
                console.log('Screenshot del banner fallback catturato con successo');
            }
        }
        
        // Ultimo fallback: cattura screenshot della pagina intera solo se non abbiamo ancora nulla
        if (!screenshotCaptured) {
            const pageHasContent = await page.evaluate(() => {
                const body = document.body;
                const hasText = body.textContent && body.textContent.trim().length > 0;
                const hasImages = body.querySelectorAll('img').length > 0;
                const hasButtons = body.querySelectorAll('button, a, input').length > 0;
                return hasText || hasImages || hasButtons;
            });
            
            if (pageHasContent) {
                console.log('Nessun banner trovato, catturando screenshot della pagina intera...');
                screenshots.push(await page.screenshot({ 
                    encoding: 'base64',
                    fullPage: true 
                }));
                screenshotCaptured = true;
                console.log('Screenshot di fallback catturato');
            } else {
                console.log('Pagina vuota, nessun screenshot necessario');
            }
        }

        // Test interattivi (se multiStep è true)
        let interactiveTestResults = {};
        if (multiStep) {
            console.log('Eseguendo test interattivi...');
            
            // Test 1: Accetta tutti
            try {
                const acceptButton = await page.$('button:contains("Accetta"), button:contains("Accept"), [class*="accept"], [id*="accept"]');
                if (acceptButton) {
                    await acceptButton.click();
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    
                    const consentUpdated = await page.evaluate(() => {
                        return window.dataLayer && window.dataLayer.some(event => 
                            event.event === 'consent_update' || 
                            event.consent_mode || 
                            event.gtag_consent
                        );
                    });
                    
                    interactiveTestResults.acceptAllTest = {
                        passed: consentUpdated,
                        consentUpdated,
                        marketingTagsFired: false, // Da implementare
                        dataLayerEvents: []
                    };
                }
            } catch (error) {
                console.log('Errore nel test accetta tutti:', error.message);
            }
            
            // Test 2: Rifiuta tutti
            try {
                const rejectButton = await page.$('button:contains("Rifiuta"), button:contains("Reject"), [class*="reject"], [id*="reject"]');
                if (rejectButton) {
                    await rejectButton.click();
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    
                    const consentDenied = await page.evaluate(() => {
                        return window.dataLayer && window.dataLayer.some(event => 
                            event.event === 'consent_denied' || 
                            (event.consent_mode && event.consent_mode.marketing === false)
                        );
                    });
                    
                    interactiveTestResults.rejectAllTest = {
                        passed: consentDenied,
                        marketingTagsBlocked: false, // Da implementare
                        consentDenied,
                        dataLayerEvents: []
                    };
                }
            } catch (error) {
                console.log('Errore nel test rifiuta tutti:', error.message);
            }
        }

        // Calcola punteggi
        const performanceScore = Math.max(0, 100 - (resourceMetrics.jsHeapUsedSize / 1024 / 1024) * 10);
        const accessibilityScore = 85; // Placeholder
        const seoScore = 80; // Placeholder

        await browser.close();

        const result = {
            html,
            dataLayer,
            consentModePresent,
            consentModeCalls,
            gtmIds,
            cookieBannerLibs,
            performanceMetrics: {
                ...performanceMetrics,
                ...resourceMetrics
            },
            accessibilityScore,
            seoScore,
            interactiveTestResults,
            screenshots
        };

        console.log(`Screenshot catturati: ${screenshots.length}`);
        res.json(result);

    } catch (error) {
        console.error('Errore:', error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Puppeteer server running on port ${PORT}`);
});
