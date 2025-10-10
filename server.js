const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const url = require("url");
const selfsigned = require("selfsigned");
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

// MIME 类型映射
const mimeTypes = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return mimeTypes[ext] || "application/octet-stream";
}

function serveStaticFile(req, res, filePath) {
  const fullPath = path.join(__dirname, "public", filePath);

  // 安全检查：确保文件在 public 目录内
  if (!fullPath.startsWith(path.join(__dirname, "public"))) {
    res.writeHead(403, { "Content-Type": "text/plain" });
    res.end("Forbidden");
    return;
  }

  fs.readFile(fullPath, (err, data) => {
    if (err) {
      if (err.code === "ENOENT") {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not Found");
      } else {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Internal Server Error");
      }
      return;
    }

    const mimeType = getMimeType(filePath);
    res.writeHead(200, { "Content-Type": mimeType });
    res.end(data);
  });
}

function handleRequest(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // 设置 CORS 头
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  // API 路由
  if (pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  if (pathname === "/config") {
    const iceServers = [];

    // 可选：来自环境变量的 STUN
    if (process.env.STUN_URL) {
      iceServers.push({ urls: process.env.STUN_URL });
    }

    // 本服务内置的 STUN
    const reqHostHeader =
      req.headers["x-forwarded-host"] || req.headers.host || "";
    const hostname = (
      req.headers.host ||
      String(reqHostHeader).split(":")[0] ||
      ""
    ).trim();
    if (hostname) {
      iceServers.push({ urls: `stun:${hostname}:${STUN_PORT}` });
    }

    // 可选：来自环境变量的 TURN
    if (
      process.env.TURN_URL &&
      process.env.TURN_USERNAME &&
      process.env.TURN_PASSWORD
    ) {
      iceServers.push({
        urls: process.env.TURN_URL,
        username: process.env.TURN_USERNAME,
        credential: process.env.TURN_PASSWORD,
      });
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ iceServers }));
    return;
  }

  // 静态文件服务
  let filePath = pathname === "/" ? "/index.html" : pathname;
  serveStaticFile(req, res, filePath);
}

// ----- WebSocket signaling (single-room, single-viewer) -----
function setupWebSocket(server) {
  const wss = new WebSocketServer({ server, path: "/ws" });

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
      console.error("STUN send error:", err);
    }
  });

  server.listen(STUN_PORT, () => {
    console.info(`STUN server listening on udp://0.0.0.0:${STUN_PORT}`);
  });
}

// 启动服务器
function startServer() {
  const httpsOptions = getHttpsOptions();
  const server = https.createServer(httpsOptions, handleRequest);

  setupWebSocket(server);
  setupStun();

  server.listen(HTTP_PORT, HTTP_HOST, () => {
    console.info(`HTTPS server listening on https://${HTTP_HOST}:${HTTP_PORT}`);
  });

  server.on("error", (err) => {
    console.error("Server error:", err);
    process.exit(1);
  });
}

startServer();
