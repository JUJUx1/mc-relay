const WebSocket = require('ws');
const http = require('http');

const PORT = process.env.PORT || 19131;

// HTTP server for Render health checks
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      sessions: Object.keys(sessions).length,
      uptime: Math.floor(process.uptime())
    }));
    return;
  }
  // Status page
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(`<!DOCTYPE html>
<html style="background:#0d0f0e;color:#d4e8c2;font-family:monospace;padding:40px">
<h2 style="color:#FFD700">⛏ MC Relay Server</h2>
<p>Active sessions: <b style="color:#5d9e3f">${Object.keys(sessions).length}</b></p>
<p>Uptime: <b style="color:#5d9e3f">${Math.floor(process.uptime())}s</b></p>
<p style="color:#7a9a6a;font-size:12px">WebSocket relay for Bedrock Auto Builder</p>
</html>`);
});

const wss = new WebSocket.Server({ server });

// Sessions: sessionId -> { browser, minecraft }
const sessions = {};

function getOrCreateSession(id) {
  if (!sessions[id]) sessions[id] = { browser: null, minecraft: null };
  return sessions[id];
}

function cleanSession(id) {
  const s = sessions[id];
  if (s && !s.browser && !s.minecraft) {
    delete sessions[id];
    console.log(`[${id}] Session cleaned up`);
  }
}

wss.on('connection', (sock, req) => {
  const url = new URL(req.url, `http://localhost`);
  const sessionId = url.searchParams.get('session') || 'default';
  const role = url.searchParams.get('role'); // 'browser' or 'minecraft'
  const ua = req.headers['user-agent'] || '';

  // Auto-detect role from User-Agent if not specified
  const isBrowser = role === 'browser' || (!role && ua.includes('Mozilla'));
  const roleName = isBrowser ? 'browser' : 'minecraft';

  const session = getOrCreateSession(sessionId);
  session[roleName] = sock;
  console.log(`[${sessionId}] ${roleName} connected (${isBrowser ? 'browser' : 'MC'})`);

  // Notify browser when Minecraft connects
  if (!isBrowser && session.browser && session.browser.readyState === WebSocket.OPEN) {
    session.browser.send(JSON.stringify({ __relay: 'minecraft_connected' }));
  }
  // Notify minecraft when browser connects
  if (isBrowser && session.minecraft && session.minecraft.readyState === WebSocket.OPEN) {
    sock.send(JSON.stringify({ __relay: 'minecraft_ready' }));
  }

  sock.on('message', (data) => {
    const peer = isBrowser ? session.minecraft : session.browser;
    if (peer && peer.readyState === WebSocket.OPEN) {
      peer.send(data);
    }
  });

  sock.on('close', () => {
    session[roleName] = null;
    console.log(`[${sessionId}] ${roleName} disconnected`);
    // Notify peer
    const peer = isBrowser ? session.minecraft : session.browser;
    if (peer && peer.readyState === WebSocket.OPEN) {
      peer.send(JSON.stringify({ __relay: roleName + '_disconnected' }));
    }
    setTimeout(() => cleanSession(sessionId), 5000);
  });

  sock.on('error', (err) => {
    console.error(`[${sessionId}] ${roleName} error:`, err.message);
    session[roleName] = null;
  });
});

server.listen(PORT, () => {
  console.log(`MC Relay server running on port ${PORT}`);
  console.log(`WebSocket: ws://localhost:${PORT}?session=SESSION_ID&role=browser`);
  console.log(`Health:    http://localhost:${PORT}/health`);
});

// Keep alive ping every 25s (prevents Render free tier sleep)
setInterval(() => {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.ping();
    }
  });
}, 25000);

process.on('uncaughtException', err => console.error('Uncaught:', err.message));
process.on('unhandledRejection', err => console.error('Unhandled:', err?.message));
