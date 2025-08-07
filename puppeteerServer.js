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

    // ⏳ Aspetta eventuali push asincroni
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Estrai HTML e variabili JS visibili
    const html = await page.content();

    const { dataLayer, consentModePresent } = await page.evaluate(() => {
      return {
        dataLayer: typeof window.dataLayer !== 'undefined' ? window.dataLayer : [],
        consentModePresent: typeof window.gtag === 'function',
      };
    });

    await browser.close();

    res.setHeader('Cache-Control', 's-maxage=300');
    return res.status(200).json({
      html,
      dataLayer,
      consentModePresent,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () =>
  console.log(`🧠 Puppeteer server attivo su http://localhost:${PORT}`)
);