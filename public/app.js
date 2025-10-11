let ws;
let pc;
let localStream;
let currentRole = null;
let currentRoom = null;
let viewerReady = false;

const setupSection = document.getElementById("setupSection");
const statusSection = document.getElementById("statusSection");
const videoContainer = document.getElementById("videoContainer");
const roomInput = document.getElementById("roomInput");
const senderBtn = document.getElementById("senderBtn");
const receiverBtn = document.getElementById("receiverBtn");
const statusIcon = document.getElementById("statusIcon");
const statusText = document.getElementById("statusText");
const statusDetail = document.getElementById("statusDetail");
const playBtn = document.getElementById("playBtn");
const errorMsg = document.getElementById("errorMsg");
const remoteVideo = document.getElementById("remoteVideo");

function showError(message) {
  errorMsg.textContent = message;
  errorMsg.style.display = "block";
}

function hideError() {
  errorMsg.style.display = "none";
}

function updateStatus(icon, text, detail = "") {
  statusIcon.textContent = icon;
  statusText.textContent = text;
  statusDetail.textContent = detail;
}

function showStatus() {
  setupSection.style.display = "none";
  statusSection.style.display = "block";
}

function showVideo() {
  videoContainer.style.display = "block";
  playBtn.style.display = "none";
}

async function createPeerConnection() {
  let iceServers = [];
  try {
    const res = await fetch("/config", { credentials: "same-origin" });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.iceServers)) iceServers = data.iceServers;
    }
  } catch (_) {}

  const _pc = new RTCPeerConnection({ iceServers });

  _pc.onicecandidate = (e) => {
    if (e.candidate) {
      ws.send(
        JSON.stringify({ type: "ice-candidate", candidate: e.candidate })
      );
    }
  };

  _pc.ontrack = (e) => {
    console.log("🈶了有了");
    if (!remoteVideo.srcObject) {
      remoteVideo.srcObject = e.streams[0];
      playBtn.style.display = "inline-block";
      updateStatus("🎥", "视频已就绪", "点击下方按钮开始播放");
    }
  };

  _pc.oniceconnectionstatechange = () => {
    if (_pc.iceConnectionState === "connected") {
      if (currentRole === "sender") {
        updateStatus("📡", "正在推流", `房间: ${currentRoom}`);
      }
    }
  };

  return _pc;
}

async function startSender() {
  try {
    updateStatus("📹", "正在申请摄像头权限...", "");
    localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    });

    pc = await createPeerConnection();
    localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));
    // 当viewerReady的时候，直接开推
    if (viewerReady) makeAndSendOffer();
    updateStatus("📡", "正在向房间推流", `房间: ${currentRoom}`);
  } catch (err) {
    showError("无法访问摄像头: " + err.message);
  }
}

async function startReceiver() {
  pc = await createPeerConnection();
  updateStatus("⏳", "等待发送方", `房间: ${currentRoom}`);
}

async function makeAndSendOffer() {
  if (!pc) {
    viewerReady = true;
    return;
  }
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  console.log("viewer已经在了呀");
  ws.send(JSON.stringify({ type: "offer", sdp: offer }));
}

function connectWebSocket() {
  const httpProto = location.protocol === "https:" ? "wss" : "ws";
  ws = new WebSocket(`${httpProto}://${location.host}/ws`);

  ws.addEventListener("open", async () => {
    ws.send(
      JSON.stringify({
        type: "join",
        role: currentRole,
        room: currentRoom,
      })
    );

    if (currentRole === "sender") {
      await startSender();
    } else {
      await startReceiver();
      ws.send(JSON.stringify({ type: "ready" }));
    }
  });

  ws.addEventListener("message", async (ev) => {
    const msg = JSON.parse(ev.data);

    if (msg.type === "viewer-ready" && currentRole === "sender") {
      await makeAndSendOffer();
    }

    if (msg.type === "offer" && currentRole === "viewer") {
      await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      ws.send(JSON.stringify({ type: "answer", sdp: answer }));
    }

    if (msg.type === "answer" && currentRole === "sender") {
      await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
    }

    if (msg.type === "ice-candidate") {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
      } catch (e) {
        console.error("addIceCandidate error", e);
      }
    }

    if (msg.type === "sender-left" && currentRole === "viewer") {
      updateStatus("❌", "发送方已离开", "请等待新的发送方加入");
      playBtn.style.display = "none";
      videoContainer.style.display = "none";
    }

    if (msg.type === "viewer-left" && currentRole === "sender") {
      updateStatus("📡", "等待接收方", `房间: ${currentRoom}`);
    }

    if (msg.type === "error") {
      showError("连接错误: " + msg.reason);
    }
  });

  ws.addEventListener("error", () => {
    showError("WebSocket 连接失败");
  });
}

// 事件监听器
playBtn.addEventListener("click", async () => {
  try {
    await remoteVideo.play();
    showVideo();
    updateStatus("🎥", "正在播放", `房间: ${currentRoom}`);
  } catch (err) {
    showError("播放失败: " + err.message);
  }
});

senderBtn.addEventListener("click", () => {
  currentRole = "sender";
  currentRoom = roomInput.value.trim() || "demo";
  showStatus();
  hideError();
  connectWebSocket();
});

receiverBtn.addEventListener("click", () => {
  currentRole = "viewer";
  currentRoom = roomInput.value.trim() || "demo";
  showStatus();
  hideError();
  connectWebSocket();
});
