// 页面状态枚举
export enum PageState {
  INIT = "init",
  LOADING = "loading",
  ACTIVE = "active",
  ERROR = "error",
  WAITING = "waiting",
}

// 错误类型枚举
export enum ErrorType {
  // WebRTC 错误
  NOT_ALLOWED = "NotAllowedError",
  NOT_FOUND = "NotFoundError",
  NOT_READABLE = "NotReadableError",
  OVER_CONSTRAINED = "OverconstrainedError",

  // WebSocket 错误
  WEBSOCKET_CONNECTION_FAILED = "WebSocketConnectionFailed",

  // 服务器错误
  SENDER_ALREADY_EXISTS = "sender-already-exists",
  VIEWER_ALREADY_EXISTS = "viewer-already-exists",
  SERVER_ERROR = "server-error",

  // 通用错误
  UNKNOWN = "unknown",
}
