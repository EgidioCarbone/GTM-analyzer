// server.js
// ---------------------------------------------------------------------------
// Backend Express che funge da proxy HTML. Riceve GET /api/fetchHtml?url=…
// Scarica l’HTML grezzo e lo restituisce al frontend per l’analisi.
// ---------------------------------------------------------------------------

import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 4000;

// Abilita CORS per evitare problemi con frontend su altre porte
app.use(cors());

// Endpoint principale
app.get('/api/fetchHtml', async (req, res) => {
  const targetUrl = req.query.url;

  // ✅ Validazione veloce dell’URL
  if (typeof targetUrl !== 'string' || !/^https?:\/\//i.test(targetUrl)) {
    return res.status(400).json({ error: 'URL non valido' });
  }

  try {
    // ✅ Scarica l’HTML remoto
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (GTM-Checklist/1.0)',
      },
      redirect: 'follow',
    });

    const html = await response.text();

    // ✅ Cache lato edge (5 minuti)
    res.setHeader('Cache-Control', 's-maxage=300');
    return res.status(200).send(html);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Avvio server
app.listen(PORT, () => {
  console.log(`🔌 Proxy HTML attivo su http://localhost:${PORT}`);
});