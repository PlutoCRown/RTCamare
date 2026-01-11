import { PageState } from "../types/enums";

// 状态管理工具类
export class StateManager {
  currentState: PageState = PageState.INIT;
  callbacks: Map<string, (data?: any) => void> = new Map();

  setState(newState: PageState, data: any = {}) {
    const oldState = this.currentState;
    this.currentState = newState;

    // 触发状态变化回调
    if (this.callbacks.has("stateChange")) {
      const callback = this.callbacks.get("stateChange")!;
      (
        callback as (
          newState: PageState,
          oldState: PageState,
          data: any
        ) => void
      )(newState, oldState, data);
    }

    // 触发特定状态回调
    if (this.callbacks.has(newState)) {
      this.callbacks.get(newState)!(data);
    }
  }

  getState() {
    return this.currentState;
  }

  onStateChange(
    callback: (newState: PageState, oldState: PageState, data: any) => void
  ) {
    this.callbacks.set("stateChange", callback as (data?: any) => void);
  }

  onState(state: PageState, callback: (data?: any) => void) {
    this.callbacks.set(state, callback);
  }

  // 页面状态常量（保持向后兼容）
  static STATES = {
    INIT: PageState.INIT,
    LOADING: PageState.LOADING,
    ACTIVE: PageState.ACTIVE,
    ERROR: PageState.ERROR,
    WAITING: PageState.WAITING,
  };
}

import { ErrorType } from "../types/enums";

// 错误处理工具类
export class ErrorHandler {
  static handleWebRTCError(error: any): string {
    console.error("WebRTC Error:", error);

    const errorName = error.name || ErrorType.UNKNOWN;

    switch (errorName) {
      case ErrorType.NOT_ALLOWED:
        return "摄像头权限被拒绝，请允许访问摄像头后重试";
      case ErrorType.NOT_FOUND:
        return "未找到摄像头设备，请检查设备连接";
      case ErrorType.NOT_READABLE:
        return "摄像头被其他应用占用，请关闭其他应用后重试";
      case ErrorType.OVER_CONSTRAINED:
        return "摄像头不支持所需的分辨率或帧率";
      default:
        return `连接失败: ${error.message || "未知错误"}`;
    }
  }

  static handleWebSocketError(error: any): string {
    console.error("WebSocket Error:", error);
    return "网络连接失败，请检查网络连接后重试";
  }

  static handleServerError(errorCode: string): string {
    switch (errorCode) {
      case ErrorType.SENDER_ALREADY_EXISTS:
        return "房间中已有发送方，请选择其他房间或等待";
      case ErrorType.VIEWER_ALREADY_EXISTS:
        return "房间中已有接收方，请选择其他房间或等待";
      case ErrorType.SERVER_ERROR:
        return "服务器错误，请稍后重试";
      default:
        return "服务器错误，请稍后重试";
    }
  }
}
