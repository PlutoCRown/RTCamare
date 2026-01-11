// Socket 事件名枚举
export enum SocketEventType {
  // 客户端发送的事件
  JOIN = "join",
  OFFER = "offer",
  ANSWER = "answer",
  ICE_CANDIDATE = "ice-candidate",
  READY = "ready",

  // 服务器发送的事件
  JOINED = "joined",
  VIEWER_READY = "viewer-ready",
  SENDER_READY = "sender-ready",
  SENDER_LEFT = "sender-left",
  VIEWER_LEFT = "viewer-left",
  ERROR = "error",
}

// 角色类型
export type SocketRole = "sender" | "viewer";

// 事件参数类型定义
export interface SocketEventPayloads {
  // 客户端发送的事件
  [SocketEventType.JOIN]: {
    role: SocketRole;
    room: string;
  };
  [SocketEventType.OFFER]: {
    sdp: RTCSessionDescriptionInit;
  };
  [SocketEventType.ANSWER]: {
    sdp: RTCSessionDescriptionInit;
  };
  [SocketEventType.ICE_CANDIDATE]: {
    candidate: RTCIceCandidateInit;
  };
  [SocketEventType.READY]: Record<string, never>; // 空对象

  // 服务器发送的事件
  [SocketEventType.JOINED]: {
    role: SocketRole;
    room: string;
  };
  [SocketEventType.VIEWER_READY]: Record<string, never>;
  [SocketEventType.SENDER_READY]: Record<string, never>;
  [SocketEventType.SENDER_LEFT]: Record<string, never>;
  [SocketEventType.VIEWER_LEFT]: Record<string, never>;
  [SocketEventType.ERROR]: {
    reason: string;
  };
}

// Socket 消息基础接口
export interface SocketMessage<T extends SocketEventType = SocketEventType> {
  type: T;
}

// 类型安全的 Socket 消息类型
export type TypedSocketMessage<T extends SocketEventType> = SocketMessage<T> &
  SocketEventPayloads[T];

// 所有可能的 Socket 消息联合类型
export type AnySocketMessage = {
  [K in SocketEventType]: TypedSocketMessage<K>;
}[SocketEventType];

// 类型守卫：检查消息是否为特定类型
export function isSocketMessage<T extends SocketEventType>(
  message: any,
  eventType: T
): message is TypedSocketMessage<T> {
  return message && message.type === eventType;
}

// 类型安全的消息处理函数类型
export type SocketMessageHandler<T extends SocketEventType> = (
  message: TypedSocketMessage<T>
) => void;

// 消息处理器映射类型
export type SocketMessageHandlers = {
  [K in SocketEventType]?: SocketMessageHandler<K>;
};

// 类型安全的消息发送函数
export function createSocketMessage<T extends SocketEventType>(
  type: T,
  payload: SocketEventPayloads[T]
): TypedSocketMessage<T> {
  return {
    type,
    ...payload,
  } as TypedSocketMessage<T>;
}
