// WebRTC 工具类
export class WebRTCManager {
  constructor() {
    this.pc = null;
    this.localStream = null;
    this.iceServers = [];
    this.statsInterval = null;
  }

  async createPeerConnection() {
    try {
      // 获取 ICE 服务器配置
      const res = await fetch("/config", { credentials: "same-origin" });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.iceServers)) {
          this.iceServers = data.iceServers;
        }
      }
    } catch (error) {
      console.warn("Failed to fetch ICE servers:", error);
    }

    this.pc = new RTCPeerConnection({ iceServers: this.iceServers });
    return this.pc;
  }

  async getUserMedia(constraints = { video: true, audio: false }) {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      return this.localStream;
    } catch (error) {
      throw new Error(`无法访问摄像头: ${error.message}`);
    }
  }

  async getAvailableCameras() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter((device) => device.kind === "videoinput");
    } catch (error) {
      console.error("Failed to get cameras:", error);
      return [];
    }
  }

  async switchCamera(deviceId) {
    if (!this.localStream) return;

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } },
        audio: false,
      });

      // 停止旧流
      this.localStream.getTracks().forEach((track) => track.stop());

      // 替换流
      this.localStream = newStream;

      // 更新 PeerConnection
      if (this.pc) {
        const sender = this.pc
          .getSenders()
          .find((s) => s.track && s.track.kind === "video");
        if (sender) {
          await sender.replaceTrack(newStream.getVideoTracks()[0]);
        }
      }

      return newStream;
    } catch (error) {
      throw new Error(`切换摄像头失败: ${error.message}`);
    }
  }

  startStatsMonitoring(callback) {
    if (!this.pc) return;

    this.statsInterval = setInterval(async () => {
      try {
        const stats = await this.pc.getStats();
        const statsData = this.parseStats(stats);
        callback(statsData);
      } catch (error) {
        console.error("Failed to get stats:", error);
      }
    }, 1000);
  }

  stopStatsMonitoring() {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
  }

  parseStats(stats) {
    const result = {
      resolution: "-",
      framerate: "-",
      bitrate: "-",
      latency: "-",
    };

    stats.forEach((report) => {
      if (report.type === "outbound-rtp" && report.mediaType === "video") {
        result.resolution = `${report.frameWidth || 0}x${
          report.frameHeight || 0
        }`;
        result.framerate = `${Math.round(report.framesPerSecond || 0)} fps`;
        result.bitrate = `${Math.round(
          ((report.bytesSent || 0) * 8) / 1000
        )} kbps`;
      }

      if (report.type === "inbound-rtp" && report.mediaType === "video") {
        result.resolution = `${report.frameWidth || 0}x${
          report.frameHeight || 0
        }`;
        result.framerate = `${Math.round(report.framesPerSecond || 0)} fps`;
        result.bitrate = `${Math.round(
          ((report.bytesReceived || 0) * 8) / 1000
        )} kbps`;
      }

      if (report.type === "candidate-pair" && report.state === "succeeded") {
        result.latency = `${Math.round(
          report.currentRoundTripTime * 1000 || 0
        )} ms`;
      }
    });

    return result;
  }

  cleanup() {
    this.stopStatsMonitoring();

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
  }
}
