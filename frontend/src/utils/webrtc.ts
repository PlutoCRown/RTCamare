// WebRTC 工具类
export class WebRTCManager {
  pc: RTCPeerConnection | null = null;
  localStream: MediaStream | null = null;
  iceServers: RTCIceServer[] = [];
  statsInterval: ReturnType<typeof setInterval> | null = null;

  async createPeerConnection() {
    try {
      // 获取 ICE 服务器配置
      const res = await fetch("/api/config", { credentials: "same-origin" });
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

  async getUserMedia(constraints: MediaStreamConstraints = { video: true, audio: false }) {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      return this.localStream;
    } catch (error) {
      throw new Error(`无法访问摄像头: ${(error as Error).message}`);
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

  async switchCamera(deviceId: string) {
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
        if (sender && newStream.getVideoTracks()[0]) {
          await sender.replaceTrack(newStream.getVideoTracks()[0]);
        }
      }

      return newStream;
    } catch (error) {
      throw new Error(`切换摄像头失败: ${(error as Error).message}`);
    }
  }

  startStatsMonitoring(callback: (stats: {
    resolution: string;
    framerate: string;
    bitrate: string;
    latency: string;
  }) => void) {
    if (!this.pc) return;

    this.statsInterval = setInterval(async () => {
      try {
        const stats = await this.pc!.getStats();
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

  parseStats(stats: RTCStatsReport) {
    const result = {
      resolution: "-",
      framerate: "-",
      bitrate: "-",
      latency: "-",
    };

    stats.forEach((report) => {
      if (report.type === "outbound-rtp" && "mediaType" in report && report.mediaType === "video") {
        const rtpReport = report as any;
        result.resolution = `${rtpReport.frameWidth || 0}x${rtpReport.frameHeight || 0}`;
        result.framerate = `${Math.round(rtpReport.framesPerSecond || 0)} fps`;
        result.bitrate = `${Math.round(((rtpReport.bytesSent || 0) * 8) / 1000)} kbps`;
      }

      if (report.type === "inbound-rtp" && "mediaType" in report && report.mediaType === "video") {
        const rtpReport = report as any;
        result.resolution = `${rtpReport.frameWidth || 0}x${rtpReport.frameHeight || 0}`;
        result.framerate = `${Math.round(rtpReport.framesPerSecond || 0)} fps`;
        result.bitrate = `${Math.round(((rtpReport.bytesReceived || 0) * 8) / 1000)} kbps`;
      }

      if (report.type === "candidate-pair" && "state" in report && report.state === "succeeded") {
        const pairReport = report as any;
        result.latency = `${Math.round((pairReport.currentRoundTripTime * 1000) || 0)} ms`;
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
