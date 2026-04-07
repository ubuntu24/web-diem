/**
 * Custom Next.js server with WebSocket proxy support.
 *
 * Next.js `rewrites()` in next.config.js only handle HTTP — they cannot proxy
 * the WebSocket Upgrade handshake. This custom server intercepts HTTP Upgrade
 * requests on the /_s/* path and forwards them directly to the backend,
 * bypassing Next.js routing entirely.
 *
 * Architecture (production via Cloudflare Tunnel):
 *   Browser ──wss://domain/_s/online-count──▶ This server (port 3000)
 *   This server ──ws://backend:8000/ws/online-count──▶ FastAPI backend
 */

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const httpProxy = require('http-proxy');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

// Backend URL — same as API_URL used by Next.js rewrites
const BACKEND_URL = process.env.API_URL || 'http://backend:8000';
const BACKEND_WS_URL = BACKEND_URL
  .replace(/^https:\/\//, 'ws://')
  .replace(/^http:\/\//, 'ws://');

const proxy = httpProxy.createProxyServer({ 
  ws: true, 
  changeOrigin: true,
  xfwd: true // Propagate X-Forwarded-For, X-Forwarded-Proto, etc.
});

proxy.on('error', (err, req, res) => {
  console.error('[WS Proxy] Error:', err.message);
  try {
    if (res && typeof res.end === 'function') res.end();
  } catch (_) {}
});

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  // Intercept WebSocket upgrade requests on /_s/* path
  server.on('upgrade', (req, socket, head) => {
    const { pathname } = parse(req.url);

    if (pathname && pathname.startsWith('/_s/')) {
      // Rewrite path: /_s/online-count → /ws/online-count
      const targetPath = pathname.replace(/^\/_s\//, '/ws/');
      const targetUrl = `${BACKEND_WS_URL}${targetPath}`;

      console.log(`[WS Proxy] Upgrading: ${pathname} → ${targetUrl}`);
      proxy.ws(req, socket, head, { target: targetUrl });
    } else {
      socket.destroy();
    }
  });

  const PORT = parseInt(process.env.PORT || '3000', 10);
  server.listen(PORT, () => {
    console.log(`> Custom Next.js server ready on http://localhost:${PORT}`);
    console.log(`> WebSocket proxy: /_s/* → ${BACKEND_WS_URL}/ws/*`);
  });
});
