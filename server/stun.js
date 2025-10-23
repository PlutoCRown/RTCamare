const stun = require("stun");

const STUN_PORT = parseInt(process.env.STUN_PORT || "3478", 10);

// STUN 服务器 (UDP 3478)
function setupStun() {
  const server = stun.createServer({ type: "udp4" });

  server.on("bindingRequest", (req, rinfo) => {
    console.log("[STUN] bindingRequest", req, rinfo);
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

  return server;
}

module.exports = {
  setupStun,
  STUN_PORT,
};
