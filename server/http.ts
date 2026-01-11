import * as http from "http";
import * as url from "url";
import * as os from "os";
import { getRoomsStatus } from "./websocket";

export const HTTP_HOST = "0.0.0.0";
export const HTTP_PORT = parseInt(process.env.HTTP_PORT || "8080", 10);
export const STUN_PORT = parseInt(process.env.STUN_PORT || "3478", 10);

// 获取本机IP地址
export function getLocalIP(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const ifaceList = interfaces[name];
    if (!ifaceList) continue;
    for (const iface of ifaceList) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "localhost";
}

// HTTP 请求处理
function handleRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse
): void {
  const parsedUrl = url.parse(req.url || "", true);
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
  if (pathname === "/api/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  if (pathname === "/api/status") {
    try {
      const roomsStatus = getRoomsStatus();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ rooms: roomsStatus }));
    } catch (error) {
      console.error("Error getting rooms status:", error);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Internal server error" }));
    }
    return;
  }

  if (pathname === "/api/config") {
    const iceServers: Array<{
      urls: string;
      username?: string;
      credential?: string;
    }> = [];

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

  // 对于未匹配的路由，返回 404
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not Found" }));
}

// 创建 HTTP 服务器（后端使用 HTTP，前端通过 rsbuild 使用 HTTPS）
export function createHttpServer(): http.Server {
  return http.createServer(handleRequest);
}
