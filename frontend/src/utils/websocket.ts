// WebSocket 连接管理类
export class WebSocketManager {
  ws: WebSocket | null = null;
  reconnectAttempts = 0;
  maxReconnectAttempts = 5;
  reconnectDelay = 1000;

  connect(role: string, room: string) {
    return new Promise<void>((resolve, reject) => {
      const protocol = location.protocol === "https:" ? "wss" : "ws";
      this.ws = new WebSocket(`${protocol}://${location.host}/ws`);

      this.ws.addEventListener("open", () => {
        console.log("WebSocket connected");
        this.reconnectAttempts = 0;

        // 发送加入房间消息
        this.send({
          type: "join",
          role: role,
          room: room,
        });

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

  send(message: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn("WebSocket is not open, cannot send message:", message);
    }
  }

  onMessage(callback: (message: any) => void) {
    if (this.ws) {
      this.ws.addEventListener("message", (event) => {
        try {
          const message = JSON.parse(event.data);
          callback(message);
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      });
    }
  }

  close() {
    if (this.ws) {
      this.ws.close(1000, "Normal closure");
      this.ws = null;
    }
  }
}
