const {
  createHttpServer,
  getLocalIP,
  HTTP_HOST,
  HTTP_PORT,
  STUN_PORT,
} = require("./http");
const { setupWebSocket } = require("./websocket");
const { setupStun } = require("./stun");
const QRCode = require("qrcode");

// 启动服务器
function startServer() {
  const server = createHttpServer();

  setupWebSocket(server);
  setupStun();

  server.listen(HTTP_PORT, HTTP_HOST, () => {
    const localIP = getLocalIP();

    console.log("\n" + "=".repeat(60));
    console.log("🚀 WebRTC 视频传输服务已启动");
    console.log("=".repeat(60));
    console.log(`📡 服务地址：https://${localIP}:${HTTP_PORT}`);
    console.log(
      `📱 成为接收方：https://localhost:${HTTP_PORT}?role=viewer&room=demo`
    );
    console.log("\n📱 扫码成为发送方：");

    // 生成接收方二维码
    const receiverUrl = `https://${localIP}:${HTTP_PORT}?role=sender&room=demo`;
    QRCode.toString(
      receiverUrl,
      { type: "terminal", small: true, errorCorrectionLevel: "L" },
      function (err, url) {
        console.log(url);
        console.log(`🔧 STUN 服务器：udp://${localIP}:${STUN_PORT}`);
      }
    );
  });

  server.on("error", (err) => {
    console.error("Server error:", err);
    process.exit(1);
  });
}

// 如果直接运行此文件，则启动服务器
if (require.main === module) {
  startServer();
}

module.exports = {
  startServer,
};
