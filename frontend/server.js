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

const isDocker = process.env.DOCKER_ENV === 'true';
const dev = process.env.NODE_ENV !== 'production' && !isDocker;
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
  } catch (_) { }
});

app.prepare().then(() => {
  const handleUpgrade = typeof app.getUpgradeHandler === 'function'
    ? app.getUpgradeHandler()
    : null;

  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  // Intercept WebSocket upgrade requests on /_s/* path
  server.on('upgrade', (req, socket, head) => {
    const parsed = parse(req.url || '');
    const pathname = parsed.pathname || '';

    if (pathname.startsWith('/_s/')) {
      // Rewrite path: /_s/online-count → /ws/online-count
      const targetPath = pathname.replace(/^\/_s\//, '/ws/');
      const targetUrl = `${BACKEND_WS_URL}${targetPath}`;
      const query = parsed.search || '';
      req.url = `${targetPath}${query}`;

      console.log(`[WS Proxy] Upgrading: ${pathname} → ${targetUrl}`);
      proxy.ws(req, socket, head, { target: BACKEND_WS_URL });
      return;
    }

    // Allow Next.js internal upgrades (e.g. HMR in development) when available.
    if (handleUpgrade) {
      handleUpgrade(req, socket, head);
      return;
    }

    socket.destroy();
  });

  const PORT = parseInt(process.env.PORT || '3000', 10);
  server.listen(PORT, () => {
    console.log(`> Custom Next.js server ready on http://localhost:${PORT}`);
    console.log(`> WebSocket proxy: /_s/* → ${BACKEND_WS_URL}/ws/*`);
  });
});
