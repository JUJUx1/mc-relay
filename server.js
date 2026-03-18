const WebSocket = require('ws');
const http = require('http');

const PORT = 19131;

const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end('MC Relay OK. Sessions: ' + Object.keys(sessions).length);
});

const wss = new WebSocket.Server({ server });
const sessions = {};

wss.on('connection', (sock, req) => {
  // Minecraft sends URL as "//" or "/" with no params — always lands in 'default'
  // Browser sends "/?session=xxx&role=browser"
  let sessionId = 'default';
  let role = null;
  try {
    const raw = req.url || '/';
    const urlStr = raw.startsWith('/') ? 'http://x' + raw : 'http://x/' + raw;
    const url = new URL(urlStr);
    const s = url.searchParams.get('session');
    role = url.searchParams.get('role');
    // If browser sends a session ID, ignore it — always use 'default'
    // because Minecraft ALWAYS connects to 'default'
    sessionId = 'default';
  } catch(e) {}

  const ua = req.headers['user-agent'] || '';
  const isBrowser = role === 'browser' || (!role && ua.toLowerCase().includes('mozilla'));
  const roleName = isBrowser ? 'browser' : 'minecraft';

  if (!sessions[sessionId]) sessions[sessionId] = { browser: null, minecraft: null };
  const session = sessions[sessionId];

  if (session[roleName]?.readyState === WebSocket.OPEN) {
    session[roleName].close();
  }
  session[roleName] = sock;

  console.log('[' + sessionId + '] ' + roleName + ' connected  url=' + req.url + '  ua=' + ua.slice(0,30));

  // Notify peer
  if (!isBrowser && session.browser?.readyState === WebSocket.OPEN) {
    session.browser.send(JSON.stringify({ __relay: 'minecraft_connected' }));
    console.log('✅ Minecraft + Browser both connected — BRIDGED!');
  }
  if (isBrowser && session.minecraft?.readyState === WebSocket.OPEN) {
    sock.send(JSON.stringify({ __relay: 'minecraft_ready' }));
    console.log('✅ Browser joined — Minecraft already here — BRIDGED!');
  }

  sock.on('message', data => {
    const peer = isBrowser ? session.minecraft : session.browser;
    if (peer?.readyState === WebSocket.OPEN) {
      peer.send(data);
    }
  });

  sock.on('close', () => {
    session[roleName] = null;
    console.log('[' + sessionId + '] ' + roleName + ' disconnected');
    const peer = isBrowser ? session.minecraft : session.browser;
    if (peer?.readyState === WebSocket.OPEN) {
      peer.send(JSON.stringify({ __relay: roleName + '_disconnected' }));
    }
    setTimeout(() => {
      if (!session.browser && !session.minecraft) delete sessions[sessionId];
    }, 5000);
  });

  sock.on('error', e => {
    session[roleName] = null;
  });
});

setInterval(() => {
  wss.clients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.ping(); });
}, 20000);

server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('╔══════════════════════════════════════╗');
  console.log('║   ⛏  MC Relay  READY  port ' + PORT + '     ║');
  console.log('╚══════════════════════════════════════╝');
  console.log('');
  console.log('Step 1 — Minecraft chat:');
  console.log('  /wsserver localhost:19131');
  console.log('');
  console.log('Step 2 — App: LIVE BUILD → CONNECT');
  console.log('  (session ID does not matter anymore)');
  console.log('');
  console.log('Waiting...');
});

process.on('uncaughtException', e => console.error('ERR: ' + e.message));
