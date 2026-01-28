import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { WebSocket, WebSocketServer } from 'ws';

type TargetId = 'ssd' | 'puppeteer' | 'live';

type TargetConfig = {
  id: TargetId;
  httpBase: string;
};

type WebTargetConfig = {
  httpBase: string;
};

const PORT = Number(process.env.GATEWAY_PORT || 3000);
const WEB_TARGET = process.env.GATEWAY_WEB_TARGET
  ? ({ httpBase: process.env.GATEWAY_WEB_TARGET } as WebTargetConfig)
  : null;

const TARGETS: Record<TargetId, TargetConfig> = {
  ssd: {
    id: 'ssd',
    httpBase: process.env.GATEWAY_SSD_TARGET || 'http://localhost:3001',
  },
  puppeteer: {
    id: 'puppeteer',
    httpBase: process.env.GATEWAY_PUPPETEER_TARGET || 'http://localhost:4004',
  },
  live: {
    id: 'live',
    httpBase: process.env.GATEWAY_LIVE_TARGET || 'http://localhost:5180',
  },
};

const LIVE_PATHS = new Set([
  '/api/start',
  '/api/stop',
  '/api/status',
  '/api/push',
  '/api/usecases',
  '/api/cases',
  '/api/ai/insight',
]);

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
  'host',
]);

const app = express();

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.get('/api/gateway/health', (_req, res) => {
  res.json({ ok: true, targets: TARGETS, webTarget: WEB_TARGET });
});

function resolveTarget(pathname: string): { target: TargetConfig; rewrittenPathname: string } {
  if (pathname === '/api/fetchHtmlPuppeteer') {
    return { target: TARGETS.puppeteer, rewrittenPathname: pathname };
  }

  if (pathname.startsWith('/api/live/')) {
    const rewrittenPathname = pathname.replace('/api/live', '/api');
    return { target: TARGETS.live, rewrittenPathname };
  }

  if (LIVE_PATHS.has(pathname)) {
    return { target: TARGETS.live, rewrittenPathname: pathname };
  }

  return { target: TARGETS.ssd, rewrittenPathname: pathname };
}

function buildTargetUrl(req: express.Request, rewrittenPathname: string, target: TargetConfig): string {
  const originalUrl = req.originalUrl || req.url;
  const queryIndex = originalUrl.indexOf('?');
  const search = queryIndex >= 0 ? originalUrl.slice(queryIndex) : '';
  return new URL(`${rewrittenPathname}${search}`, target.httpBase).toString();
}

function buildForwardHeaders(req: express.Request): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (!value || HOP_BY_HOP_HEADERS.has(key.toLowerCase())) continue;
    if (Array.isArray(value)) {
      headers.set(key, value.join(','));
    } else {
      headers.set(key, value);
    }
  }

  const remoteAddr = req.socket.remoteAddress;
  if (remoteAddr) {
    headers.set('x-forwarded-for', remoteAddr);
  }
  headers.set('x-forwarded-host', req.headers.host || '');
  headers.set('x-forwarded-proto', req.protocol);
  return headers;
}

async function proxyRequest(req: express.Request, res: express.Response) {
  const originalUrl = req.originalUrl || req.url;
  const queryIndex = originalUrl.indexOf('?');
  const pathname = queryIndex >= 0 ? originalUrl.slice(0, queryIndex) : originalUrl;
  const { target, rewrittenPathname } = resolveTarget(pathname);
  const targetUrl = buildTargetUrl(req, rewrittenPathname, target);

  const method = req.method.toUpperCase();
  const headers = buildForwardHeaders(req);

  const fetchOptions: RequestInit = {
    method,
    headers,
  };

  if (!['GET', 'HEAD'].includes(method)) {
    fetchOptions.body = req as any;
    (fetchOptions as any).duplex = 'half';
  }

  try {
    const response = await fetch(targetUrl, fetchOptions);

    res.status(response.status);

    response.headers.forEach((value, key) => {
      if (HOP_BY_HOP_HEADERS.has(key.toLowerCase())) return;
      if (key.toLowerCase() === 'set-cookie') return; // handled below
      res.setHeader(key, value);
    });

    const setCookies = (response.headers as any).getSetCookie?.() as string[] | undefined;
    if (setCookies && setCookies.length > 0) {
      res.setHeader('set-cookie', setCookies);
    } else {
      const singleCookie = response.headers.get('set-cookie');
      if (singleCookie) {
        res.setHeader('set-cookie', singleCookie);
      }
    }

    if (!response.body) {
      res.end();
      return;
    }

    Readable.fromWeb(response.body as any).pipe(res);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Proxy error';
    res.status(502).json({ error: 'BAD_GATEWAY', message, target: target.id });
  }
}

app.use('/api', (req, res) => {
  proxyRequest(req, res);
});

app.use((req, res) => {
  if (WEB_TARGET) {
    const targetUrl = new URL(req.originalUrl || req.url, WEB_TARGET.httpBase).toString();
    const method = req.method.toUpperCase();
    const headers = buildForwardHeaders(req);
    const fetchOptions: RequestInit = {
      method,
      headers,
    };
    if (!['GET', 'HEAD'].includes(method)) {
      fetchOptions.body = req as any;
      (fetchOptions as any).duplex = 'half';
    }
    fetch(targetUrl, fetchOptions)
      .then((response) => {
        res.status(response.status);
        response.headers.forEach((value, key) => {
          if (HOP_BY_HOP_HEADERS.has(key.toLowerCase())) return;
          res.setHeader(key, value);
        });
        if (!response.body) {
          res.end();
          return;
        }
        Readable.fromWeb(response.body as any).pipe(res);
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : 'Proxy error';
        res.status(502).json({ error: 'BAD_GATEWAY', message, target: 'web' });
      });
    return;
  }

  res.status(404).json({ error: 'NOT_FOUND', path: req.path });
});

const server = createServer(app);

const wsServer = new WebSocketServer({ noServer: true });

wsServer.on('connection', (client, request) => {
  const targetUrl = new URL('/events', TARGETS.live.httpBase.replace('http', 'ws')).toString();
  const upstream = new WebSocket(targetUrl, {
    headers: {
      origin: request.headers.origin || '',
    },
  });

  const closeAll = () => {
    try { client.close(); } catch {}
    try { upstream.close(); } catch {}
  };

  upstream.on('open', () => {
    client.on('message', (data) => {
      if (upstream.readyState === WebSocket.OPEN) {
        upstream.send(data);
      }
    });

    upstream.on('message', (data) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  });

  upstream.on('close', closeAll);
  upstream.on('error', closeAll);
  client.on('close', closeAll);
  client.on('error', closeAll);
});

server.on('upgrade', (req, socket, head) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    if (url.pathname === '/events' || url.pathname === '/api/live/events') {
      wsServer.handleUpgrade(req, socket, head, (ws) => {
        wsServer.emit('connection', ws, req);
      });
      return;
    }

  } catch {
    // ignore parsing errors
  }

  socket.destroy();
});

server.listen(PORT, () => {
  console.log(`API Gateway listening on http://localhost:${PORT}`);
  console.log('Targets:', TARGETS);
  console.log('WS proxy path: /events → live debugger');
});
