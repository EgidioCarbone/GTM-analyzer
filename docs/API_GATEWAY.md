# API Gateway (Unified Backend)

Questo gateway unifica i 3 backend (SSD, Puppeteer, Live Debugger) su una singola porta, con reverse proxy HTTP + WebSocket.

## Avvio rapido
- `npm run gateway` (porta di default 3000)
- `npm run dev` (include anche il gateway)

## Porte e routing
- **Gateway**: `http://localhost:3000`
- **SSD**: `http://localhost:3001`
- **Puppeteer**: `http://localhost:4004`
- **Live Debugger**: `http://localhost:5180`

### HTTP routing
- `GET /api/fetchHtmlPuppeteer` → Puppeteer (4004)
- `GET|POST /api/live/*` → Live Debugger (5180), con rewrite a `/api/*`
- `GET|POST /api/start|/api/stop|/api/status|/api/usecases|/api/cases|/api/ai/insight|/api/push` → Live Debugger
- Tutto il resto sotto `/api/*` → SSD server (4000)

### WebSocket routing
- `ws://localhost:3000/events` → Live Debugger `ws://localhost:5180/events`
- `ws://localhost:3000/api/live/events` → stesso comportamento

## Frontend opzionale (HTTP)
Il gateway può fare proxy HTTP anche verso il frontend (utile per avere **un solo dominio**).
Imposta `GATEWAY_WEB_TARGET` (es. `http://localhost:5173`).

Nota: il gateway **non** proxy i WebSocket del dev server Vite (HMR). In dev, continua a usare `localhost:5173` per la UI, oppure disattiva HMR.

## Variabili ambiente
- `GATEWAY_PORT` (default `3000`)
- `GATEWAY_SSD_TARGET` (default `http://localhost:3001`)
- `GATEWAY_PUPPETEER_TARGET` (default `http://localhost:4004`)
- `GATEWAY_LIVE_TARGET` (default `http://localhost:5180`)
- `GATEWAY_WEB_TARGET` (opzionale, es. `http://localhost:5173`)
- `CORS_ORIGIN` (default `*`)

## Deploy (note rapide)
- Esporre **solo** il gateway verso l'esterno.
- I 3 backend possono restare su rete interna / Docker network.
- Agganciare variabili `GATEWAY_*_TARGET` in base all'ambiente (staging/prod).

## Healthcheck
- `GET /api/gateway/health` → verifica gateway + targets configurati.
