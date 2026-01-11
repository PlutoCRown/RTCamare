import {
  createHttpServer,
  getLocalIP,
  HTTP_HOST,
  HTTP_PORT,
  STUN_PORT,
} from "./http";
import { setupWebSocket } from "./websocket";
import { setupStun } from "./stun";
import * as QRCode from "qrcode";

// 启动服务器
export function startServer(): void {
  const server = createHttpServer();

  setupWebSocket(server);
  setupStun();

  server.listen(HTTP_PORT, HTTP_HOST, () => {
    const localIP = getLocalIP();
    // 前端端口：如果设置了FRONTEND_PORT环境变量则使用，否则默认3000
    const FRONTEND_PORT = parseInt(process.env.FRONTEND_PORT || "3000", 10);

    console.log("\n" + "=".repeat(60));
    console.log("🚀 WebRTC 视频传输服务已启动");
    console.log("=".repeat(60));
    console.log(`📡 服务地址：https://${localIP}:${FRONTEND_PORT}`);
    console.log(
      `📱 成为接收方：https://localhost:${FRONTEND_PORT}/viewer/demo`
    );
    console.log("\n📱 扫码成为发送方：");

    // 生成接收方二维码
    const receiverUrl = `https://${localIP}:${FRONTEND_PORT}/sender/demo`;
    QRCode.toString(
      receiverUrl,
      { type: "terminal", small: true, errorCorrectionLevel: "L" },
      function (err?: Error | null, url?: string) {
        if (err) {
          console.error("生成二维码失败:", err);
          return;
        }
        console.log(url);
        console.log(`🔧 STUN 服务器：udp://${localIP}:${STUN_PORT}`);
      }
    );
  });

  server.on("error", (err: Error) => {
    console.error("Server error:", err);
    process.exit(1);
  });
}

// 如果直接运行此文件，则启动服务器
if (require.main === module) {
  startServer();
}
