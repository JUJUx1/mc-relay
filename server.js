const WebSocket = require('ws');
const http = require('http');

const PORT = 19131;

const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end('MC Relay OK');
});

const wss = new WebSocket.Server({ server });
let browserSock = null;
let mcSock = null;

wss.on('connection', (sock, req) => {
  const ua = req.headers['user-agent'] || '';
  const role = req.url?.includes('role=browser') || ua.includes('Mozilla') ? 'browser' : 'minecraft';

  if (role === 'browser') {
    browserSock = sock;
    console.log('✅ BROWSER connected');
    if (mcSock && mcSock.readyState === 1) {
      browserSock.send(JSON.stringify({ __relay: 'minecraft_connected' }));
      console.log('✅ BRIDGED immediately');
    }
  } else {
    mcSock = sock;
    console.log('✅ MINECRAFT connected  url=' + req.url);
    if (browserSock && browserSock.readyState === 1) {
      browserSock.send(JSON.stringify({ __relay: 'minecraft_connected' }));
      console.log('✅ BRIDGED immediately');
    }
  }

  sock.on('message', data => {
    const str = data.toString();
    if (role === 'browser') {
      // Log exactly what we send to Minecraft
      try {
        const parsed = JSON.parse(str);
        console.log('→ MC CMD: ' + parsed.body.commandLine);
      } catch(e) {
        console.log('→ MC RAW: ' + str.slice(0, 100));
      }
      if (mcSock && mcSock.readyState === 1) mcSock.send(data);
      else console.log('❌ MC not connected, cannot send');
    } else {
      // Log everything Minecraft sends back
      try {
        const parsed = JSON.parse(str);
        const status = parsed.body?.statusCode;
        const msg = parsed.body?.statusMessage || '';
        if (status !== 0) {
          console.log('❌ MC ERROR code=' + status + ' msg=' + msg);
        } else {
          console.log('✓ MC OK: ' + msg.slice(0,60));
        }
      } catch(e) {
        console.log('← MC RAW: ' + str.slice(0, 100));
      }
      if (browserSock && browserSock.readyState === 1) browserSock.send(data);
    }
  });

  sock.on('close', () => {
    if (role === 'browser') { browserSock = null; console.log('browser disconnected'); }
    else { mcSock = null; console.log('minecraft disconnected'); }
  });

  sock.on('error', e => console.error(role + ' error: ' + e.message));
});

setInterval(() => {
  if (browserSock?.readyState === 1) browserSock.ping();
  if (mcSock?.readyState === 1) mcSock.ping();
}, 20000);

server.listen(PORT, '0.0.0.0', () => {
  console.log('MC Relay READY on port ' + PORT);
  console.log('Minecraft chat: /wsserver localhost:19131');
});

process.on('uncaughtException', e => console.error('ERR: ' + e.message));
