const { WebSocketServer } = require("ws");

// WebSocket 信令服务器（单房间，单观看者）
function setupWebSocket(server) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  // 房间状态：一个发送者和一个观看者
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
          console.log("难道viewer不再吗", roomId, room.viewer !== null);
          if (room.viewer) safeSend(ws, { type: "viewer-ready" });
        } else {
          if (room.viewer && room.viewer !== ws) {
            safeSend(ws, { type: "error", reason: "viewer-already-exists" });
            return;
          }
          room.viewer = ws;
          console.log("viewer进来了", roomId);
          safeSend(ws, { type: "joined", role: "viewer", room: roomId });
          if (room.sender) safeSend(room.sender, { type: "viewer-ready" });
        }
        return;
      }

      // 在同一房间内的发送者和观看者之间转发 SDP/ICE
      if (!roomId) return;
      const room = getOrCreateRoom(roomId);
      console.log(
        "[WebSocket]",
        msg.type,
        { sender: room.sender !== null, viewer: room.viewer !== null },
        role
      );
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

  return wss;
}

module.exports = {
  setupWebSocket,
};
