# MC Relay Server

WebSocket relay for Minecraft Bedrock Auto Builder.

## Deploy to Render (free)

1. Push this folder to a GitHub repo
2. Go to render.com → New → Web Service
3. Connect your GitHub repo
4. Settings auto-detected from render.yaml
5. Deploy! You'll get a URL like: `https://mc-relay-xxxx.onrender.com`

## How it works

```
Browser App ──ws://relay?role=browser──► Relay ◄──/wsserver──── Minecraft
```

Minecraft connects to the relay via `/wsserver wss://your-relay.onrender.com?session=abc123`
Browser connects to the relay via `wss://your-relay.onrender.com?session=abc123&role=browser`

Both are bridged together by session ID.
