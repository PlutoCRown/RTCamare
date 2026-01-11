import { WebSocketServer, WebSocket } from "ws";
import { Server } from "http";
import {
  SocketEventType,
  SocketRole,
  TypedSocketMessage,
  SocketEventPayloads,
  createSocketMessage,
  isSocketMessage,
} from "@shared/types/socket-events";

// WebSocket 连接管理器
class SocketManager {
  private ws: WebSocket;

  constructor(ws: WebSocket) {
    this.ws = ws;
  }

  // 发送消息
  send<T extends SocketEventType>(
    eventType: T,
    payload: SocketEventPayloads[T]
  ): void {
    if (this.ws.readyState !== WebSocket.OPEN) return;
    try {
      const message = createSocketMessage(eventType, payload);
      this.ws.send(JSON.stringify(message));
    } catch (_) {
      // 忽略发送错误
    }
  }

  // 检查连接是否在线
  isOnline(): boolean {
    return this.ws.readyState === WebSocket.OPEN;
  }

  // 获取原始 WebSocket 实例（用于状态检查）
  getWebSocket(): WebSocket {
    return this.ws;
  }

  // 检查是否是同一个 WebSocket 连接
  isSameSocket(ws: WebSocket): boolean {
    return this.ws === ws;
  }
}

interface RoomState {
  sender: SocketManager | null;
  viewer: SocketManager | null;
}

// 房间状态映射（导出供外部使用）
export const roomState = new Map<string, RoomState>(); // roomId -> { sender: ws|null, viewer: ws|null }

// 获取所有房间状态的函数
export function getRoomsStatus(): Array<{
  roomId: string;
  sender: {
    connected: boolean;
    online: boolean;
  };
  viewer: {
    connected: boolean;
    online: boolean;
  };
}> {
  const status: Array<{
    roomId: string;
    sender: { connected: boolean; online: boolean };
    viewer: { connected: boolean; online: boolean };
  }> = [];

  roomState.forEach((room, roomId) => {
    status.push({
      roomId,
      sender: {
        connected: room.sender !== null,
        online: room.sender?.isOnline() || false,
      },
      viewer: {
        connected: room.viewer !== null,
        online: room.viewer?.isOnline() || false,
      },
    });
  });

  return status;
}

// WebSocket 信令服务器（单房间，单观看者）
export function setupWebSocket(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: "/ws" });

  function getOrCreateRoom(roomId: string): RoomState {
    if (!roomState.has(roomId)) {
      roomState.set(roomId, { sender: null, viewer: null });
    }
    return roomState.get(roomId)!;
  }

  wss.on("connection", (ws: WebSocket) => {
    let role: SocketRole | null = null;
    let roomId: string | null = null;

    ws.on("message", (data: Buffer) => {
      let msg: any;
      try {
        msg = JSON.parse(data.toString());
      } catch (_) {
        return;
      }

      // 处理 join 消息
      if (
        isSocketMessage(msg, SocketEventType.JOIN) &&
        (msg.role === "sender" || msg.role === "viewer") &&
        msg.room
      ) {
        role = msg.role;
        roomId = String(msg.room);
        const room = getOrCreateRoom(roomId);

        if (role === "sender") {
          const senderManager = new SocketManager(ws);
          // 检查已有连接是否存活
          if (room.sender && !room.sender.isSameSocket(ws)) {
            if (room.sender.isOnline()) {
              // 连接存活，拒绝新连接
              senderManager.send(SocketEventType.ERROR, {
                reason: "sender-already-exists",
              });
              return;
            } else {
              // 连接不存活，允许新连接替换
              console.log(
                `[WebSocket] Replacing dead sender connection in room ${roomId}`
              );
              // 如果之前的连接已经关闭但还在记录中，先清理
              if (room.viewer) {
                room.viewer.send(SocketEventType.SENDER_LEFT, {});
              }
            }
          }
          room.sender = senderManager;
          senderManager.send(SocketEventType.JOINED, {
            role: "sender",
            room: roomId,
          });
          console.log("难道viewer不再吗", roomId, room.viewer !== null);
          if (room.viewer) {
            senderManager.send(SocketEventType.VIEWER_READY, {});
          }
        } else {
          const viewerManager = new SocketManager(ws);
          // 检查已有连接是否存活
          if (room.viewer && !room.viewer.isSameSocket(ws)) {
            if (room.viewer.isOnline()) {
              // 连接存活，拒绝新连接
              viewerManager.send(SocketEventType.ERROR, {
                reason: "viewer-already-exists",
              });
              return;
            } else {
              // 连接不存活，允许新连接替换
              console.log(
                `[WebSocket] Replacing dead viewer connection in room ${roomId}`
              );
              // 如果之前的连接已经关闭但还在记录中，先清理
              if (room.sender) {
                room.sender.send(SocketEventType.VIEWER_LEFT, {});
              }
            }
          }
          room.viewer = viewerManager;
          console.log("viewer进来了", roomId);
          viewerManager.send(SocketEventType.JOINED, {
            role: "viewer",
            room: roomId,
          });
          if (room.sender) {
            room.sender.send(SocketEventType.VIEWER_READY, {});
          }
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

      if (isSocketMessage(msg, SocketEventType.OFFER) && role === "sender") {
        if (room.viewer) {
          room.viewer.send(SocketEventType.OFFER, {
            sdp: msg.sdp,
          });
        }
      }

      if (isSocketMessage(msg, SocketEventType.ANSWER) && role === "viewer") {
        if (room.sender) {
          room.sender.send(SocketEventType.ANSWER, {
            sdp: msg.sdp,
          });
        }
      }

      if (isSocketMessage(msg, SocketEventType.ICE_CANDIDATE)) {
        const target = role === "sender" ? room.viewer : room.sender;
        if (target) {
          target.send(SocketEventType.ICE_CANDIDATE, {
            candidate: msg.candidate,
          });
        }
      }
    });

    ws.on("close", () => {
      if (!roomId) return;
      const room = getOrCreateRoom(roomId);
      if (role === "sender" && room.sender?.isSameSocket(ws)) {
        room.sender = null;
        if (room.viewer) {
          room.viewer.send(SocketEventType.SENDER_LEFT, {});
        }
      }
      if (role === "viewer" && room.viewer?.isSameSocket(ws)) {
        room.viewer = null;
        if (room.sender) {
          room.sender.send(SocketEventType.VIEWER_LEFT, {});
        }
      }
    });
  });

  return wss;
}
