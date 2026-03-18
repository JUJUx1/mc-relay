// Minimal test — connects AS Minecraft client to verify command format
// Run: node test.js
// Then in Minecraft: /wsserver localhost:19131

const WebSocket = require('ws');
const http = require('http');

const server = http.createServer();
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('Minecraft connected!');

  // Wait 1 second then send test commands in different formats
  setTimeout(() => {
    // Format A — most common
    const cmdA = JSON.stringify({
      header: {
        version: 1,
        requestId: '00000000-0000-0000-0000-000000000001',
        messagePurpose: 'commandRequest',
        messageType: 'commandRequest'
      },
      body: {
        version: 1,
        commandLine: 'setblock ~0 ~5 ~0 glowstone',
        origin: { type: 'player' }
      }
    });

    // Format B — no origin
    const cmdB = JSON.stringify({
      header: {
        version: 1,
        requestId: '00000000-0000-0000-0000-000000000002',
        messagePurpose: 'commandRequest',
        messageType: 'commandRequest'
      },
      body: {
        version: 1,
        commandLine: 'say HELLO FROM WEBSOCKET'
      }
    });

    // Format C — say command (visible in chat, proves commands work)
    const cmdC = JSON.stringify({
      header: {
        version: 1,
        requestId: '00000000-0000-0000-0000-000000000003',
        messagePurpose: 'commandRequest',
        messageType: 'commandRequest'
      },
      body: {
        version: 1,
        commandLine: 'say TEST123'
      }
    });

    console.log('Sending Format A: setblock ~0 ~5 ~0 glowstone');
    ws.send(cmdA);

    setTimeout(() => {
      console.log('Sending Format B: say HELLO FROM WEBSOCKET');
      ws.send(cmdB);
    }, 1000);

    setTimeout(() => {
      console.log('Sending Format C: say TEST123');
      ws.send(cmdC);
    }, 2000);
  }, 1000);

  ws.on('message', (data) => {
    console.log('\n=== MINECRAFT RESPONSE ===');
    try {
      const d = JSON.parse(data);
      console.log('Purpose:', d.header?.messagePurpose);
      console.log('Status:', d.body?.statusCode);
      console.log('Message:', d.body?.statusMessage);
    } catch(e) {
      console.log('Raw:', data.toString().slice(0, 200));
    }
    console.log('==========================\n');
  });

  ws.on('close', () => console.log('Minecraft disconnected'));
});

server.listen(19131, '0.0.0.0', () => {
  console.log('');
  console.log('Test server ready on port 19131');
  console.log('Now run in Minecraft chat:');
  console.log('  /wsserver localhost:19131');
  console.log('');
  console.log('Watch here for responses...');
});
