// 发送方页面逻辑
import { WebRTCManager } from "../utils/webrtc.js";
import { WebSocketManager } from "../utils/websocket.js";
import { StateManager, ErrorHandler } from "../utils/state-manager.js";

class SenderPage {
  constructor() {
    this.webrtc = new WebRTCManager();
    this.wsManager = new WebSocketManager();
    this.stateManager = new StateManager();

    this.currentRoom = this.getRoomFromURL();
    this.currentRole = "sender";

    // DOM 元素
    this.initState = document.getElementById("initState");
    this.errorState = document.getElementById("errorState");
    this.activeState = document.getElementById("activeState");
    this.statusDetail = document.getElementById("statusDetail");
    this.errorDetail = document.getElementById("errorDetail");
    this.cameraSelect = document.getElementById("cameraSelect");
    this.resolution = document.getElementById("resolution");
    this.framerate = document.getElementById("framerate");
    this.bitrate = document.getElementById("bitrate");
    this.retryBtn = document.getElementById("retryBtn");
    this.backBtn = document.getElementById("backBtn");
    this.stopBtn = document.getElementById("stopBtn");

    this.init();
  }

  getRoomFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get("room") || "demo";
  }

  async init() {
    this.bindEvents();
    this.setupStateHandlers();
    await this.startSender();
  }

  bindEvents() {
    this.retryBtn.addEventListener("click", () => {
      this.retry();
    });

    this.backBtn.addEventListener("click", () => {
      this.goBack();
    });

    this.stopBtn.addEventListener("click", () => {
      this.stopStreaming();
    });

    this.cameraSelect.addEventListener("change", (e) => {
      this.switchCamera(e.target.value);
    });
  }

  setupStateHandlers() {
    this.stateManager.onState(StateManager.STATES.INIT, () => {
      this.showState("init");
      this.updateStatus("📹", "正在申请摄像头权限...", "");
    });

    this.stateManager.onState(StateManager.STATES.ERROR, (data) => {
      this.showState("error");
      this.errorDetail.textContent = data.message;
    });

    this.stateManager.onState(StateManager.STATES.ACTIVE, (data) => {
      this.showState("active");
      this.updateStatus("📡", "正在推流", `房间: ${this.currentRoom}`);
    });

    this.stateManager.onState(StateManager.STATES.WAITING, (data) => {
      this.showState("active");
      this.updateStatus("📡", "等待接收方", `房间: ${this.currentRoom}`);
    });
  }

  async startSender() {
    try {
      this.stateManager.setState(StateManager.STATES.INIT);

      // 获取摄像头权限
      await this.webrtc.getUserMedia();

      // 创建 PeerConnection
      const pc = await this.webrtc.createPeerConnection();

      // 添加本地流到 PeerConnection
      this.webrtc.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.webrtc.localStream);
      });

      // 设置 ICE 候选处理
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          this.wsManager.send({
            type: "ice-candidate",
            candidate: event.candidate,
          });
        }
      };

      // 连接 WebSocket
      await this.wsManager.connect(this.currentRole, this.currentRoom);

      // 设置消息处理
      this.wsManager.onMessage((msg) => {
        this.handleWebSocketMessage(msg);
      });

      // 加载摄像头列表
      await this.loadCameras();

      // 开始统计监控
      this.webrtc.startStatsMonitoring((stats) => {
        this.updateStats(stats);
      });

      this.stateManager.setState(StateManager.STATES.WAITING);
    } catch (error) {
      console.error("Sender initialization failed:", error);
      this.stateManager.setState(StateManager.STATES.ERROR, {
        message: ErrorHandler.handleWebRTCError(error),
      });
    }
  }

  async loadCameras() {
    try {
      const cameras = await this.webrtc.getAvailableCameras();
      this.cameraSelect.innerHTML = "";

      cameras.forEach((camera, index) => {
        const option = document.createElement("option");
        option.value = camera.deviceId;
        option.textContent = camera.label || `摄像头 ${index + 1}`;
        this.cameraSelect.appendChild(option);
      });

      if (cameras.length > 0) {
        this.cameraSelect.value = cameras[0].deviceId;
      }
    } catch (error) {
      console.error("Failed to load cameras:", error);
    }
  }

  async switchCamera(deviceId) {
    if (!deviceId) return;

    try {
      await this.webrtc.switchCamera(deviceId);
      console.log("Camera switched successfully");
    } catch (error) {
      console.error("Failed to switch camera:", error);
      this.showError("切换摄像头失败: " + error.message);
    }
  }

  handleWebSocketMessage(msg) {
    console.log("WebSocket message:", msg);

    switch (msg.type) {
      case "joined":
        console.log("Joined room as sender");
        break;

      case "viewer-ready":
        this.makeAndSendOffer();
        break;

      case "answer":
        this.handleAnswer(msg.sdp);
        break;

      case "ice-candidate":
        this.handleIceCandidate(msg.candidate);
        break;

      case "viewer-left":
        this.stateManager.setState(StateManager.STATES.WAITING);
        break;

      case "error":
        this.stateManager.setState(StateManager.STATES.ERROR, {
          message: ErrorHandler.handleServerError(msg.reason),
        });
        break;
    }
  }

  async makeAndSendOffer() {
    try {
      const offer = await this.webrtc.pc.createOffer();
      await this.webrtc.pc.setLocalDescription(offer);

      this.wsManager.send({
        type: "offer",
        sdp: offer,
      });

      this.stateManager.setState(StateManager.STATES.ACTIVE);
    } catch (error) {
      console.error("Failed to create offer:", error);
      this.showError("创建连接失败: " + error.message);
    }
  }

  async handleAnswer(sdp) {
    try {
      await this.webrtc.pc.setRemoteDescription(new RTCSessionDescription(sdp));
    } catch (error) {
      console.error("Failed to handle answer:", error);
    }
  }

  async handleIceCandidate(candidate) {
    try {
      await this.webrtc.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error("Failed to add ICE candidate:", error);
    }
  }

  updateStats(stats) {
    this.resolution.textContent = stats.resolution;
    this.framerate.textContent = stats.framerate;
    this.bitrate.textContent = stats.bitrate;
  }

  showState(state) {
    this.initState.style.display = state === "init" ? "flex" : "none";
    this.errorState.style.display = state === "error" ? "flex" : "none";
    this.activeState.style.display = state === "active" ? "flex" : "none";
  }

  updateStatus(icon, text, detail) {
    const statusIcon = document.querySelector(".status-icon");
    const statusText = document.querySelector(".status-text");

    if (statusIcon) statusIcon.textContent = icon;
    if (statusText) statusText.textContent = text;
    if (this.statusDetail) this.statusDetail.textContent = detail;
  }

  showError(message) {
    // 可以添加错误提示逻辑
    console.error(message);
  }

  retry() {
    this.cleanup();
    this.startSender();
  }

  stopStreaming() {
    this.cleanup();
    this.goBack();
  }

  goBack() {
    window.location.href = "../index.html";
  }

  cleanup() {
    this.webrtc.cleanup();
    this.wsManager.close();
  }
}

// 页面加载完成后初始化
document.addEventListener("DOMContentLoaded", () => {
  new SenderPage();
});

// 页面卸载时清理资源
window.addEventListener("beforeunload", () => {
  if (window.senderPage) {
    window.senderPage.cleanup();
  }
});
