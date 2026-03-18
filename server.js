const WebSocket = require('ws');
const http = require('http');
const net = require('net');

const PORT = 19131;

// ── RAW TCP LOGGER to see EXACTLY what Minecraft sends ────────
const tcpServer = net.createServer((socket) => {
  const addr = socket.remoteAddress + ':' + socket.remotePort;
  console.log('\n[TCP] New raw connection from: ' + addr);
  
  socket.once('data', (buf) => {
    console.log('[TCP] Raw data (' + buf.length + ' bytes):');
    console.log('[TCP] ASCII: ' + buf.toString('ascii').slice(0, 200).replace(/\r\n/g,'↵'));
    console.log('[TCP] HEX:   ' + buf.slice(0,16).toString('hex'));
    
    // Check if it looks like a WebSocket upgrade request
    const str = buf.toString();
    if (str.includes('Upgrade: websocket') || str.includes('upgrade: websocket')) {
      console.log('[TCP] ✅ This IS a WebSocket upgrade — passing to WS server');
    } else if (str.includes('HTTP')) {
      console.log('[TCP] ⚠ This is plain HTTP, not WebSocket');
    } else {
      console.log('[TCP] ❓ Unknown protocol');
    }
    socket.destroy();
  });
  
  socket.on('error', e => console.log('[TCP] socket error: ' + e.message));
});

// ── HTTP + WS server ──────────────────────────────────────────
const server = http.createServer((req, res) => {
  console.log('[HTTP] ' + req.method + ' ' + req.url + ' ua=' + (req.headers['user-agent']||'').slice(0,50));
  res.writeHead(200);
  res.end('MC Relay running');
});

const wss = new WebSocket.Server({ server });
const sessions = {};

wss.on('connection', (sock, req) => {
  let sessionId = 'default';
  let role = null;
  try {
    const raw = req.url || '/';
    const urlStr = raw.startsWith('/') ? 'http://x' + raw : 'http://x/' + raw;
    const url = new URL(urlStr);
    sessionId = url.searchParams.get('session') || 'default';
    role = url.searchParams.get('role');
  } catch(e) {}

  const ua = req.headers['user-agent'] || '';
  const isBrowser = role === 'browser' || (!role && ua.toLowerCase().includes('mozilla'));
  const roleName = isBrowser ? 'browser' : 'minecraft';

  if (!sessions[sessionId]) sessions[sessionId] = { browser: null, minecraft: null };
  const session = sessions[sessionId];
  if (session[roleName]?.readyState === WebSocket.OPEN) session[roleName].close();
  session[roleName] = sock;

  console.log('\n[WS] ' + roleName + ' connected  session=' + sessionId);
  console.log('[WS] User-Agent: ' + ua.slice(0,80));
  console.log('[WS] URL: ' + req.url);

  if (!isBrowser && session.browser?.readyState === WebSocket.OPEN) {
    session.browser.send(JSON.stringify({ __relay: 'minecraft_connected' }));
    console.log('[WS] ✅ Told browser: minecraft connected!');
  }
  if (isBrowser && session.minecraft?.readyState === WebSocket.OPEN) {
    sock.send(JSON.stringify({ __relay: 'minecraft_ready' }));
  }

  sock.on('message', data => {
    const peer = isBrowser ? session.minecraft : session.browser;
    if (peer?.readyState === WebSocket.OPEN) {
      peer.send(data);
    } else {
      try { console.log('[WS] ' + roleName + ' msg (no peer): ' + data.toString().slice(0,100)); } catch(_){}
    }
  });

  sock.on('close', () => {
    session[roleName] = null;
    const peer = isBrowser ? session.minecraft : session.browser;
    if (peer?.readyState === WebSocket.OPEN) peer.send(JSON.stringify({ __relay: roleName + '_disconnected' }));
    console.log('[WS] ' + roleName + ' disconnected session=' + sessionId);
    setTimeout(() => { if (!session.browser && !session.minecraft) delete sessions[sessionId]; }, 5000);
  });

  sock.on('error', e => { session[roleName] = null; });
});

// ── Start BOTH servers ────────────────────────────────────────
// TCP raw logger on 19132 to capture Minecraft's raw bytes
tcpServer.listen(19132, '0.0.0.0', () => {
  console.log('[TCP] Raw logger on port 19132');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('╔══════════════════════════════════════╗');
  console.log('║  ⛏  MC Relay + Debugger  READY       ║');
  console.log('╠══════════════════════════════════════╣');
  console.log('║  WS server:  port ' + PORT + '              ║');
  console.log('║  TCP logger: port 19132              ║');
  console.log('╚══════════════════════════════════════╝');
  console.log('');
  console.log('Try in Minecraft chat:');
  console.log('  /wsserver localhost:19131?session=build1');
  console.log('  /wsserver localhost:19131');
  console.log('  /wsserver 127.0.0.1:19131');
  console.log('');
});

process.on('uncaughtException', e => console.error('ERR: ' + e.message));
