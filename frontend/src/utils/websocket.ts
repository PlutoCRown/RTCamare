import {
  SocketEventType,
  SocketRole,
  TypedSocketMessage,
  AnySocketMessage,
  SocketMessageHandlers,
  SocketMessageHandler,
  createSocketMessage,
} from "../../../shared/types/socket-events";

// WebSocket 连接管理类
export class WebSocketManager {
  ws: WebSocket | null = null;
  reconnectAttempts = 0;
  maxReconnectAttempts = 5;
  reconnectDelay = 1000;
  private handlers: SocketMessageHandlers = {};
  private _role: SocketRole | null = null;
  private _room: string | null = null;
  private beforeUnloadHandler: ((e: BeforeUnloadEvent) => void) | null = null;

  connect(role: SocketRole, room: string) {
    // 保存角色和房间信息（用于状态管理）
    this._role = role;
    this._room = room;

    // 添加 beforeunload 事件监听
    if (this.beforeUnloadHandler) {
      window.removeEventListener("beforeunload", this.beforeUnloadHandler);
    }
    this.beforeUnloadHandler = () => {
      // 在页面卸载前尝试关闭连接
      this.close();
    };
    window.addEventListener("beforeunload", this.beforeUnloadHandler);

    return new Promise<void>((resolve, reject) => {
      const protocol = location.protocol === "https:" ? "wss" : "ws";
      this.ws = new WebSocket(`${protocol}://${location.host}/ws`);

      this.ws.addEventListener("open", () => {
        console.log("WebSocket connected");
        this.reconnectAttempts = 0;

        // 发送加入房间消息（类型安全）
        this.send(
          createSocketMessage(SocketEventType.JOIN, {
            role,
            room,
          })
        );

        resolve();
      });

      this.ws.addEventListener("error", (error) => {
        console.error("WebSocket error:", error);
        reject(new Error("WebSocket 连接失败"));
      });

      this.ws.addEventListener("close", (event) => {
        console.log("WebSocket closed:", event.code, event.reason);

        // 如果不是正常关闭，尝试重连
        if (
          event.code !== 1000 &&
          this.reconnectAttempts < this.maxReconnectAttempts
        ) {
          this.reconnectAttempts++;
          console.log(
            `Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`
          );

          setTimeout(() => {
            this.connect(role, room).catch(console.error);
          }, this.reconnectDelay * this.reconnectAttempts);
        }
      });
    });
  }

  // 类型安全的消息发送方法
  send<T extends SocketEventType>(message: TypedSocketMessage<T>) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn("WebSocket is not open, cannot send message:", message);
    }
  }

  // 类型安全的消息监听方法（单个事件类型）
  on<T extends SocketEventType>(
    eventType: T,
    handler: SocketMessageHandler<T>
  ) {
    this.handlers[eventType] = handler as SocketMessageHandler<any>;
  }

  // 类型安全的消息监听方法（多个事件类型）
  onMessage(handlers: SocketMessageHandlers) {
    Object.assign(this.handlers, handlers);
  }

  // 启动消息监听
  startListening() {
    if (this.ws) {
      this.ws.addEventListener("message", (event) => {
        try {
          const message = JSON.parse(event.data) as AnySocketMessage;

          // 根据消息类型调用对应的处理器
          const handler = this.handlers[message.type];
          if (handler) {
            handler(message as any);
          } else {
            console.warn(
              `No handler registered for message type: ${message.type}`
            );
          }
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      });
    }
  }

  // 兼容旧版本的 onMessage 方法（保持向后兼容）
  onMessageLegacy(callback: (message: AnySocketMessage) => void) {
    if (this.ws) {
      this.ws.addEventListener("message", (event) => {
        try {
          const message = JSON.parse(event.data) as AnySocketMessage;
          callback(message);
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      });
    }
  }

  close() {
    // 移除 beforeunload 事件监听
    if (this.beforeUnloadHandler) {
      window.removeEventListener("beforeunload", this.beforeUnloadHandler);
      this.beforeUnloadHandler = null;
    }

    if (this.ws) {
      // 尝试正常关闭连接（会触发服务器端的 close 事件）
      try {
        if (this.ws.readyState === WebSocket.OPEN) {
          this.ws.close(1000, "Normal closure");
        } else if (this.ws.readyState === WebSocket.CONNECTING) {
          // 如果还在连接中，等待连接完成再关闭
          this.ws.addEventListener(
            "open",
            () => {
              this.ws?.close(1000, "Normal closure");
            },
            { once: true }
          );
        } else {
          this.ws.close();
        }
      } catch (error) {
        console.warn("Error closing WebSocket:", error);
        // 如果关闭失败，强制设置为 null
        this.ws = null;
      }
      this.ws = null;
      this.handlers = {};
    }
    this._role = null;
    this._room = null;
  }
}
