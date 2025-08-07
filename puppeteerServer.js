// puppeteerServer.js
import express from 'express';
import puppeteer from 'puppeteer';
import cors from 'cors';

const app = express();
const PORT = 4001;

app.use(cors());

app.get('/api/fetchHtmlPuppeteer', async (req, res) => {
    const targetUrl = req.query.url;

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
        await page.goto(targetUrl, {
            waitUntil: 'networkidle2',
            timeout: 30000,
        });

        // Attendi caricamenti asincroni (CMP, gtag, ecc.)
        await new Promise(resolve => setTimeout(resolve, 3000));

        const html = await page.content();

        const { dataLayer, consentModePresent, consentModeCalls } = await page.evaluate(() => {
            const calls = [];

            if (typeof window.gtag === 'function') {
                const original = window.gtag;
                window.gtag = function () {
                    const args = Array.from(arguments);
                    if (args[0] === 'consent') {
                        calls.push(args);
                    }
                    return original.apply(this, args);
                };
            }

            return {
                dataLayer: Array.isArray(window.dataLayer) ? window.dataLayer : [],
                consentModePresent: typeof window.gtag === 'function',
                consentModeCalls: calls,
            };
        });

        // Rileva ID GTM nell’HTML
        const gtmIds = [...new Set(html.match(/GTM-[\w-]{6,10}/g) || [])];

        // Rileva banner cookie usati
        const cookieBannerLibs = [];
        if (/onetrust/i.test(html)) cookieBannerLibs.push('Onetrust');
        if (/otSDKStub/i.test(html)) cookieBannerLibs.push('Onetrust Stub');
        if (/cookiebot/i.test(html)) cookieBannerLibs.push('Cookiebot');
        if (/iubenda/i.test(html)) cookieBannerLibs.push('Iubenda');
        if (/complianz/i.test(html)) cookieBannerLibs.push('Complianz');

        await browser.close();

        res.setHeader('Cache-Control', 's-maxage=300');
        return res.status(200).json({
            html,
            dataLayer,
            consentModePresent,
            consentModeCalls,
            gtmIds,
            cookieBannerLibs,
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () =>
    console.log(`🧠 Puppeteer server attivo su http://localhost:${PORT}`)
);