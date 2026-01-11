// 状态管理工具类
export class StateManager {
  currentState: string = "init";
  callbacks: Map<string, (data?: any) => void> = new Map();

  setState(newState: string, data: any = {}) {
    const oldState = this.currentState;
    this.currentState = newState;

    // 触发状态变化回调
    if (this.callbacks.has("stateChange")) {
      const callback = this.callbacks.get("stateChange")!;
      (callback as (newState: string, oldState: string, data: any) => void)(newState, oldState, data);
    }

    // 触发特定状态回调
    if (this.callbacks.has(newState)) {
      this.callbacks.get(newState)!(data);
    }
  }

  getState() {
    return this.currentState;
  }

  onStateChange(callback: (newState: string, oldState: string, data: any) => void) {
    this.callbacks.set("stateChange", callback as (data?: any) => void);
  }

  onState(state: string, callback: (data?: any) => void) {
    this.callbacks.set(state, callback);
  }

  // 页面状态常量
  static STATES = {
    INIT: "init",
    LOADING: "loading",
    ACTIVE: "active",
    ERROR: "error",
    WAITING: "waiting",
  };
}

// 错误处理工具类
export class ErrorHandler {
  static handleWebRTCError(error: any) {
    console.error("WebRTC Error:", error);

    if (error.name === "NotAllowedError") {
      return "摄像头权限被拒绝，请允许访问摄像头后重试";
    } else if (error.name === "NotFoundError") {
      return "未找到摄像头设备，请检查设备连接";
    } else if (error.name === "NotReadableError") {
      return "摄像头被其他应用占用，请关闭其他应用后重试";
    } else if (error.name === "OverconstrainedError") {
      return "摄像头不支持所需的分辨率或帧率";
    } else {
      return `连接失败: ${error.message}`;
    }
  }

  static handleWebSocketError(error: any) {
    console.error("WebSocket Error:", error);
    return "网络连接失败，请检查网络连接后重试";
  }

  static handleServerError(errorCode: string) {
    switch (errorCode) {
      case "sender-already-exists":
        return "房间中已有发送方，请选择其他房间或等待";
      case "viewer-already-exists":
        return "房间中已有接收方，请选择其他房间或等待";
      default:
        return "服务器错误，请稍后重试";
    }
  }
}
