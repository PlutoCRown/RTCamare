const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");
const os = require("os");

const HTTP_HOST = "0.0.0.0";
const HTTP_PORT = parseInt(process.env.HTTP_PORT || "8080", 10);
const STUN_PORT = parseInt(process.env.STUN_PORT || "3478", 10);

// 获取本机IP地址
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "localhost";
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

// 静态文件服务
function serveStaticFile(req, res, filePath) {
  // 从 dist/public 目录提供服务（React应用构建产物）
  const publicDir = path.join(__dirname, "..", "dist", "public");
  let fullPath = path.join(publicDir, filePath);

  // 安全检查：确保文件在允许的目录内
  if (!fullPath.startsWith(publicDir)) {
    res.writeHead(403, { "Content-Type": "text/plain" });
    res.end("Forbidden");
    return;
  }

  fs.readFile(fullPath, (err, data) => {
    if (err) {
      if (err.code === "ENOENT") {
        // 文件不存在，对于SPA应用，返回index.html
        const indexPath = path.join(publicDir, "index.html");
        fs.readFile(indexPath, (err, data) => {
          if (err) {
            res.writeHead(404, { "Content-Type": "text/plain" });
            res.end("Not Found");
            return;
          }
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(data);
        });
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

// HTTP 请求处理
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
      String(req.headers.host || reqHostHeader).split(":")[0] || ""
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

  // 静态文件服务（支持SPA路由）
  // 如果是API路由或WebSocket路径，不处理
  if (
    pathname.startsWith("/ws") ||
    pathname.startsWith("/config") ||
    pathname.startsWith("/health")
  ) {
    // API路由已在上面处理
    return;
  }

  // 对于所有其他路径，尝试服务静态文件
  // 如果文件不存在，serveStaticFile会返回index.html（SPA支持）
  let filePath = pathname === "/" ? "/index.html" : pathname;
  serveStaticFile(req, res, filePath);
}

// 创建 HTTP 服务器（后端使用 HTTP，前端通过 rsbuild 使用 HTTPS）
function createHttpServer() {
  return http.createServer(handleRequest);
}

module.exports = {
  createHttpServer,
  getLocalIP,
  HTTP_HOST,
  HTTP_PORT,
  STUN_PORT,
};
