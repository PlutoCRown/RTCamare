const path = require("path");
const fs = require("fs");
const selfsigned = require("selfsigned");
const fastify = require("fastify")({
  logger: true,
  https: getHttpsOptions(),
});
const fastifyStatic = require("@fastify/static");
const stun = require("stun");
const { WebSocketServer } = require("ws");

const HTTP_HOST = "0.0.0.0";
const HTTP_PORT = parseInt(process.env.HTTP_PORT || "8080", 10);
const STUN_PORT = parseInt(process.env.STUN_PORT || "3478", 10);

function getHttpsOptions() {
  // 允许通过环境变量提供证书路径；若无则生成自签证书
  const keyPath = process.env.TLS_KEY_PATH;
  const certPath = process.env.TLS_CERT_PATH;
  try {
    if (
      keyPath &&
      certPath &&
      fs.existsSync(keyPath) &&
      fs.existsSync(certPath)
    ) {
      return {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath),
        allowHTTP1: true,
      };
    }
  } catch (_) {}

  // 生成 365 天有效期的自签证书（开发用途）
  const pems = selfsigned.generate(
    [{ name: "commonName", value: process.env.TLS_COMMON_NAME || "localhost" }],
    {
      days: 365,
      keySize: 2048,
      algorithm: "sha256",
      extensions: [
        { name: "basicConstraints", cA: true },
        {
          name: "keyUsage",
          keyCertSign: true,
          digitalSignature: true,
          nonRepudiation: true,
          keyEncipherment: true,
          dataEncipherment: true,
        },
        { name: "extKeyUsage", serverAuth: true, clientAuth: true },
        {
          name: "subjectAltName",
          altNames: [
            { type: 2, value: "localhost" }, // DNS
            { type: 7, ip: "127.0.0.1" }, // IP
          ],
        },
      ],
    }
  );
  return { key: pems.private, cert: pems.cert, allowHTTP1: true };
}

// ----- Fastify HTTP + static -----
async function setupHttp() {
  await fastify.register(fastifyStatic, {
    root: path.join(__dirname, "public"),
    prefix: "/",
    index: ["index.html"],
  });

  fastify.get("/health", async () => ({ status: "ok" }));

  await fastify.listen({ port: HTTP_PORT, host: HTTP_HOST });
  console.info(`HTTPS server listening on https://${HTTP_HOST}:${HTTP_PORT}`);
}

// ----- WebSocket signaling (single-room, single-viewer) -----
function setupWebSocket() {
  const wss = new WebSocketServer({ server: fastify.server, path: "/ws" });

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
    try {
      ws.send(JSON.stringify(obj));
    } catch (_) {}
  }

  wss.on("connection", (ws) => {
    let role = null; // 'sender' | 'viewer'
    let roomId = null;

    ws.on("message", (data) => {
      let msg;
      try {
        msg = JSON.parse(data.toString());
      } catch (_) {
        return;
      }

      if (
        msg.type === "join" &&
        (msg.role === "sender" || msg.role === "viewer") &&
        msg.room
      ) {
        role = msg.role;
        roomId = String(msg.room);
        const room = getOrCreateRoom(roomId);
        if (role === "sender") {
          if (room.sender && room.sender !== ws) {
            safeSend(ws, { type: "error", reason: "sender-already-exists" });
            return;
          }
          room.sender = ws;
          safeSend(ws, { type: "joined", role: "sender", room: roomId });
          if (room.viewer) safeSend(ws, { type: "viewer-ready" });
        } else {
          if (room.viewer && room.viewer !== ws) {
            safeSend(ws, { type: "error", reason: "viewer-already-exists" });
            return;
          }
          room.viewer = ws;
          safeSend(ws, { type: "joined", role: "viewer", room: roomId });
          if (room.sender) safeSend(room.sender, { type: "viewer-ready" });
        }
        return;
      }

      // Forward SDP/ICE between sender and viewer only within the same room
      if (!roomId) return;
      const room = getOrCreateRoom(roomId);

      if (msg.type === "offer" && role === "sender") {
        safeSend(room.viewer, { type: "offer", sdp: msg.sdp });
      }
      if (msg.type === "answer" && role === "viewer") {
        safeSend(room.sender, { type: "answer", sdp: msg.sdp });
      }
      if (msg.type === "ice-candidate") {
        const target = role === "sender" ? room.viewer : room.sender;
        safeSend(target, { type: "ice-candidate", candidate: msg.candidate });
      }
    });

    ws.on("close", () => {
      if (!roomId) return;
      const room = getOrCreateRoom(roomId);
      if (role === "sender" && room.sender === ws) {
        room.sender = null;
        safeSend(room.viewer, { type: "sender-left" });
      }
      if (role === "viewer" && room.viewer === ws) {
        room.viewer = null;
        safeSend(room.sender, { type: "viewer-left" });
      }
    });
  });
}

// ----- STUN server (UDP 3478) -----
function setupStun() {
  const server = stun.createServer({ type: "udp4" });

  server.on("bindingRequest", (req, rinfo) => {
    const res = stun.createMessage(
      stun.constants.STUN_BINDING_RESPONSE,
      req.transactionId
    );
    res.addXorAddress(rinfo.address, rinfo.port);
    try {
      server.send(res, rinfo.port, rinfo.address);
    } catch (err) {
      console.error({ err }, "STUN send error");
    }
  });

  server.listen(STUN_PORT, () => {
    console.info(`STUN server listening on udp://0.0.0.0:${STUN_PORT}`);
  });
}

(async () => {
  try {
    await setupHttp();
    setupWebSocket();
    setupStun();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
