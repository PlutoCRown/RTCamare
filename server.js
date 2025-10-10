const path = require('path');
const fastify = require('fastify')({ logger: true });
const fastifyStatic = require('@fastify/static');
const stun = require('stun');
const { WebSocketServer } = require('ws');

const HTTP_HOST = '0.0.0.0';
const HTTP_PORT = parseInt(process.env.HTTP_PORT || '8080', 10);
const STUN_PORT = parseInt(process.env.STUN_PORT || '3478', 10);

// ----- Fastify HTTP + static -----
async function setupHttp() {
  await fastify.register(fastifyStatic, {
    root: path.join(__dirname, 'public'),
    prefix: '/',
    index: ['index.html']
  });

  fastify.get('/health', async () => ({ status: 'ok' }));

  await fastify.listen({ port: HTTP_PORT, host: HTTP_HOST });
  fastify.log.info(`HTTP server listening on http://${HTTP_HOST}:${HTTP_PORT}`);
}

// ----- WebSocket signaling (single-room, single-viewer) -----
function setupWebSocket() {
  const wss = new WebSocketServer({ server: fastify.server, path: '/ws' });

  // room state: one sender and one viewer
  const roomState = new Map(); // roomId -> { sender: ws|null, viewer: ws|null }

  function getOrCreateRoom(roomId) {
    if (!roomState.has(roomId)) {
      roomState.set(roomId, { sender: null, viewer: null });
    }
    return roomState.get(roomId);
  }

  function safeSend(ws, obj) {
    if (!ws || ws.readyState !== ws.OPEN) return;
    try { ws.send(JSON.stringify(obj)); } catch (_) {}
  }

  wss.on('connection', (ws) => {
    let role = null; // 'sender' | 'viewer'
    let roomId = null;

    ws.on('message', (data) => {
      let msg;
      try { msg = JSON.parse(data.toString()); } catch (_) { return; }

      if (msg.type === 'join' && (msg.role === 'sender' || msg.role === 'viewer') && msg.room) {
        role = msg.role;
        roomId = String(msg.room);
        const room = getOrCreateRoom(roomId);
        if (role === 'sender') {
          if (room.sender && room.sender !== ws) {
            safeSend(ws, { type: 'error', reason: 'sender-already-exists' });
            return;
          }
          room.sender = ws;
          safeSend(ws, { type: 'joined', role: 'sender', room: roomId });
          if (room.viewer) safeSend(ws, { type: 'viewer-ready' });
        } else {
          if (room.viewer && room.viewer !== ws) {
            safeSend(ws, { type: 'error', reason: 'viewer-already-exists' });
            return;
          }
          room.viewer = ws;
          safeSend(ws, { type: 'joined', role: 'viewer', room: roomId });
          if (room.sender) safeSend(room.sender, { type: 'viewer-ready' });
        }
        return;
      }

      // Forward SDP/ICE between sender and viewer only within the same room
      if (!roomId) return;
      const room = getOrCreateRoom(roomId);

      if (msg.type === 'offer' && role === 'sender') {
        safeSend(room.viewer, { type: 'offer', sdp: msg.sdp });
      }
      if (msg.type === 'answer' && role === 'viewer') {
        safeSend(room.sender, { type: 'answer', sdp: msg.sdp });
      }
      if (msg.type === 'ice-candidate') {
        const target = role === 'sender' ? room.viewer : room.sender;
        safeSend(target, { type: 'ice-candidate', candidate: msg.candidate });
      }
    });

    ws.on('close', () => {
      if (!roomId) return;
      const room = getOrCreateRoom(roomId);
      if (role === 'sender' && room.sender === ws) {
        room.sender = null;
        safeSend(room.viewer, { type: 'sender-left' });
      }
      if (role === 'viewer' && room.viewer === ws) {
        room.viewer = null;
        safeSend(room.sender, { type: 'viewer-left' });
      }
    });
  });
}

// ----- STUN server (UDP 3478) -----
function setupStun() {
  const server = stun.createServer({ type: 'udp4' });

  server.on('bindingRequest', (req, rinfo) => {
    const res = stun.createMessage(stun.constants.STUN_BINDING_RESPONSE, req.transactionId);
    res.addXorAddress(rinfo.address, rinfo.port);
    try {
      server.send(res, rinfo.port, rinfo.address);
    } catch (err) {
      fastify.log.error({ err }, 'STUN send error');
    }
  });

  server.listen(STUN_PORT, () => {
    fastify.log.info(`STUN server listening on udp://0.0.0.0:${STUN_PORT}`);
  });
}

(async () => {
  try {
    await setupHttp();
    setupWebSocket();
    setupStun();
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
})();
