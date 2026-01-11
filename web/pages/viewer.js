// 接收方页面逻辑
import { WebRTCManager } from "../utils/webrtc.js";
import { WebSocketManager } from "../utils/websocket.js";
import { StateManager, ErrorHandler } from "../utils/state-manager.js";

class ViewerPage {
  constructor() {
    this.webrtc = new WebRTCManager();
    this.wsManager = new WebSocketManager();
    this.stateManager = new StateManager();

    this.currentRoom = this.getRoomFromURL();
    this.currentRole = "viewer";
    this.isWaitingForNewSender = false;

    // DOM 元素
    this.videoContainer = document.getElementById("videoContainer");
    this.remoteVideo = document.getElementById("remoteVideo");
    this.initState = document.getElementById("initState");
    this.errorState = document.getElementById("errorState");
    this.controlPanel = document.getElementById("controlPanel");
    this.togglePanel = document.getElementById("togglePanel");
    this.panelContent = document.getElementById("panelContent");
    this.closePanel = document.getElementById("closePanel");
    this.waitingDialog = document.getElementById("waitingDialog");
    this.cancelWaiting = document.getElementById("cancelWaiting");
    this.statusDetail = document.getElementById("statusDetail");
    this.errorDetail = document.getElementById("errorDetail");
    this.resolution = document.getElementById("resolution");
    this.framerate = document.getElementById("framerate");
    this.bitrate = document.getElementById("bitrate");
    this.latency = document.getElementById("latency");
    this.fullscreenBtn = document.getElementById("fullscreenBtn");
    this.muteBtn = document.getElementById("muteBtn");
    this.stopBtn = document.getElementById("stopBtn");
    this.retryBtn = document.getElementById("retryBtn");
    this.backBtn = document.getElementById("backBtn");

    this.init();
  }

  getRoomFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get("room") || "demo";
  }

  async init() {
    this.bindEvents();
    this.setupStateHandlers();
    await this.startViewer();
  }

  bindEvents() {
    // 视频容器点击播放（用户交互后播放）
    this.videoContainer.addEventListener("click", () => {
      if (this.remoteVideo.srcObject && this.remoteVideo.paused) {
        this.remoteVideo.play().catch((err) => {
          console.error("Failed to play video on click:", err);
        });
      }
    });

    // 控制面板
    this.togglePanel.addEventListener("click", () => {
      this.toggleControlPanel();
    });

    this.closePanel.addEventListener("click", () => {
      this.hideControlPanel();
    });

    // 等待对话框
    this.cancelWaiting.addEventListener("click", () => {
      this.cancelWaitingForSender();
    });

    // 控制按钮
    this.fullscreenBtn.addEventListener("click", () => {
      this.toggleFullscreen();
    });

    this.muteBtn.addEventListener("click", () => {
      this.toggleMute();
    });

    this.stopBtn.addEventListener("click", () => {
      this.stopViewing();
    });

    this.retryBtn.addEventListener("click", () => {
      this.retry();
    });

    this.backBtn.addEventListener("click", () => {
      this.goBack();
    });

    // 全屏变化监听
    document.addEventListener("fullscreenchange", () => {
      this.updateFullscreenButton();
    });

    // 键盘快捷键
    document.addEventListener("keydown", (e) => {
      this.handleKeyboard(e);
    });
  }

  setupStateHandlers() {
    this.stateManager.onState(StateManager.STATES.INIT, () => {
      this.showState("init");
      this.updateStatus("⏳", "等待发送方", `房间: ${this.currentRoom}`);
    });

    this.stateManager.onState(StateManager.STATES.ERROR, (data) => {
      this.showState("error");
      this.errorDetail.textContent = data.message;
    });

    this.stateManager.onState(StateManager.STATES.ACTIVE, (data) => {
      this.showState("active");
      this.showVideo();
    });

    this.stateManager.onState(StateManager.STATES.WAITING, () => {
      this.showWaitingDialog();
    });
  }

  async startViewer() {
    try {
      this.stateManager.setState(StateManager.STATES.INIT);

      // 创建 PeerConnection
      const pc = await this.webrtc.createPeerConnection();

      // 设置远程流处理
      pc.ontrack = (event) => {
        console.log("Received remote stream", event);
        if (!this.remoteVideo.srcObject) {
          this.remoteVideo.srcObject = event.streams[0];
          // 先切换状态显示视频元素，不强制自动播放
          // 视频元素有 autoplay 属性，会在用户交互后自动播放
          this.stateManager.setState(StateManager.STATES.ACTIVE);
          // 尝试播放，但不阻塞（失败也没关系，用户交互后会播放）
          this.autoPlayVideo().catch(() => {
            // 自动播放失败是正常的，用户交互后会播放
            console.log("Auto-play blocked, waiting for user interaction");
          });
        }
      };

      // 设置连接状态监听
      pc.oniceconnectionstatechange = () => {
        console.log("ICE connection state:", pc.iceConnectionState);
        if (
          pc.iceConnectionState === "connected" ||
          pc.iceConnectionState === "completed"
        ) {
          // 如果已经有流，确保状态是 ACTIVE
          if (this.remoteVideo.srcObject) {
            this.stateManager.setState(StateManager.STATES.ACTIVE);
          }
        }
      };

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

      // 开始统计监控
      this.webrtc.startStatsMonitoring((stats) => {
        this.updateStats(stats);
      });

      // 发送准备就绪消息
      this.wsManager.send({ type: "ready" });
    } catch (error) {
      console.error("Viewer initialization failed:", error);
      this.stateManager.setState(StateManager.STATES.ERROR, {
        message: ErrorHandler.handleWebRTCError(error),
      });
    }
  }

  handleWebSocketMessage(msg) {
    console.log("WebSocket message:", msg);

    switch (msg.type) {
      case "joined":
        console.log("Joined room as viewer");
        break;

      case "offer":
        this.handleOffer(msg.sdp);
        break;

      case "ice-candidate":
        this.handleIceCandidate(msg.candidate);
        break;

      case "sender-left":
        this.handleSenderLeft();
        break;

      case "error":
        this.stateManager.setState(StateManager.STATES.ERROR, {
          message: ErrorHandler.handleServerError(msg.reason),
        });
        break;
    }
  }

  async handleOffer(sdp) {
    try {
      await this.webrtc.pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await this.webrtc.pc.createAnswer();
      await this.webrtc.pc.setLocalDescription(answer);

      this.wsManager.send({
        type: "answer",
        sdp: answer,
      });

      // 检查是否已经有接收器（表示媒体轨道已被添加）
      // 如果 ontrack 事件在 setRemoteDescription 时已经触发，这里会设置状态
      // 如果还没触发，ontrack 事件稍后会触发并设置状态
      const hasReceivers = this.webrtc.pc.getReceivers().length > 0;
      if (hasReceivers && this.remoteVideo.srcObject) {
        this.stateManager.setState(StateManager.STATES.ACTIVE);
      }
    } catch (error) {
      console.error("Failed to handle offer:", error);
      this.showError("处理连接失败: " + error.message);
    }
  }

  async handleIceCandidate(candidate) {
    try {
      await this.webrtc.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error("Failed to add ICE candidate:", error);
    }
  }

  handleSenderLeft() {
    this.isWaitingForNewSender = true;
    this.stateManager.setState(StateManager.STATES.WAITING);
  }

  async autoPlayVideo() {
    try {
      await this.remoteVideo.play();
      console.log("Video started playing");
    } catch (error) {
      console.error("Failed to auto-play video:", error);
    }
  }

  showVideo() {
    this.videoContainer.style.display = "flex";
    this.hideAllStates();
  }

  showState(state) {
    this.hideAllStates();

    switch (state) {
      case "init":
        this.initState.style.display = "flex";
        break;
      case "error":
        this.errorState.style.display = "flex";
        break;
      case "active":
        this.showVideo();
        break;
    }
  }

  hideAllStates() {
    this.initState.style.display = "none";
    this.errorState.style.display = "none";
  }

  showWaitingDialog() {
    this.waitingDialog.showModal();
  }

  cancelWaitingForSender() {
    this.waitingDialog.close();
    this.isWaitingForNewSender = false;
    this.goBack();
  }

  toggleControlPanel() {
    this.controlPanel.classList.toggle("expanded");
  }

  hideControlPanel() {
    this.controlPanel.classList.remove("expanded");
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      this.videoContainer.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }

  updateFullscreenButton() {
    this.fullscreenBtn.textContent = document.fullscreenElement
      ? "退出全屏"
      : "全屏";
  }

  toggleMute() {
    if (this.remoteVideo.muted) {
      this.remoteVideo.muted = false;
      this.muteBtn.textContent = "静音";
    } else {
      this.remoteVideo.muted = true;
      this.muteBtn.textContent = "取消静音";
    }
  }

  updateStats(stats) {
    this.resolution.textContent = stats.resolution;
    this.framerate.textContent = stats.framerate;
    this.bitrate.textContent = stats.bitrate;
    this.latency.textContent = stats.latency;
  }

  updateStatus(icon, text, detail) {
    const statusIcon = document.querySelector(".status-icon");
    const statusText = document.querySelector(".status-text");

    if (statusIcon) statusIcon.textContent = icon;
    if (statusText) statusText.textContent = text;
    if (this.statusDetail) this.statusDetail.textContent = detail;
  }

  showError(message) {
    console.error(message);
  }

  handleKeyboard(e) {
    switch (e.key) {
      case "f":
      case "F":
        this.toggleFullscreen();
        break;
      case "m":
      case "M":
        this.toggleMute();
        break;
      case "Escape":
        if (this.controlPanel.classList.contains("expanded")) {
          this.hideControlPanel();
        } else if (this.waitingDialog.open) {
          this.cancelWaitingForSender();
        }
        break;
    }
  }

  retry() {
    this.cleanup();
    this.startViewer();
  }

  stopViewing() {
    this.cleanup();
    this.goBack();
  }

  goBack() {
    window.location.href = "../index.html";
  }

  cleanup() {
    this.webrtc.cleanup();
    this.wsManager.close();
    this.waitingDialog.close();
  }
}

// 页面加载完成后初始化
document.addEventListener("DOMContentLoaded", () => {
  window.viewerPage = new ViewerPage();
});

// 页面卸载时清理资源
window.addEventListener("beforeunload", () => {
  if (window.viewerPage) {
    window.viewerPage.cleanup();
  }
});
