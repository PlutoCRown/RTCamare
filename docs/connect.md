# 连接与通信协议文档

本文档描述 WebRTC 视频传输服务的运行方式和客户端与服务端的通信协议。

## 系统架构

该系统采用前后端分离的架构：

- **后端服务器**：Node.js + TypeScript，提供 HTTP API 和 WebSocket 信令服务
- **前端应用**：React + TypeScript，运行在浏览器中
- **通信方式**：
  - **HTTP/HTTPS**：用于 API 请求和静态文件服务
  - **WebSocket (WS/WSS)**：用于 WebRTC 信令交换
  - **UDP**：用于 STUN 服务和 WebRTC 媒体传输

## 服务器端运行

### 服务器组件

服务器启动时会初始化以下组件：

1. **HTTP 服务器**：监听 HTTP 请求（默认端口 8080）
2. **WebSocket 服务器**：提供信令服务（路径 `/ws`）
3. **STUN 服务器**：提供 NAT 穿透服务（默认 UDP 端口 3478）

### 启动流程

```typescript
// server/index.ts
startServer() {
  const server = createHttpServer();  // 创建 HTTP 服务器
  setupWebSocket(server);             // 设置 WebSocket 服务
  setupStun();                        // 启动 STUN 服务器
  server.listen(HTTP_PORT, HTTP_HOST);
}
```

### 服务器地址

- **HTTP 服务器**：`http://0.0.0.0:8080`（可通过 `HTTP_PORT` 环境变量配置）
- **WebSocket 服务器**：`ws://host:8080/ws`（与 HTTP 服务器共用端口）
- **STUN 服务器**：`udp://host:3478`（可通过 `STUN_PORT` 环境变量配置）

## 客户端连接流程

### 1. 初始连接

客户端通过 HTTPS/HTTP 访问前端应用，前端应用会：

1. 加载 React 应用
2. 根据路由进入对应页面（Sender 或 Viewer）
3. 初始化 WebRTC 和 WebSocket 管理器

### 2. WebSocket 连接

#### 连接建立

客户端通过 WebSocket 连接到服务器：

```
ws://host:8080/ws  (HTTP 环境)
wss://host:8080/ws (HTTPS 环境)
```


#### 房间管理

- 每个房间最多包含 **1 个 sender** 和 **1 个 viewer**
- 如果房间中已有相同角色的连接，新连接会被拒绝
- 如果已有连接但已断开，新连接可以替换旧连接
- 每个客户端都有唯一的 `clientId`，用于标识和管理

### 3. WebRTC 连接建立流程

#### Sender 端流程

1. **获取本地媒体流**
   ```typescript
   await webrtc.getUserMedia(); // 获取摄像头视频流
   ```

2. **创建 PeerConnection**
   ```typescript
   const pc = await webrtc.createPeerConnection(); // 从 /api/config 获取 ICE 服务器配置
   pc.addTrack(track, stream); // 添加视频轨道
   ```

3. **等待 Viewer 准备**
   - Sender 加入房间后，如果已有 Viewer，服务器会发送 `VIEWER_READY` 事件
   - 收到 `VIEWER_READY` 后，Sender 创建 Offer

4. **创建并发送 Offer**
   ```typescript
   const offer = await pc.createOffer();
   await pc.setLocalDescription(offer);
   // 通过 WebSocket 发送 OFFER
   wsManager.send({ type: "offer", sdp: offer });
   ```

5. **接收 Answer 和 ICE Candidates**
   - 收到 `ANSWER` 消息：设置远程描述
   - 收到 `ICE_CANDIDATE` 消息：添加 ICE 候选

#### Viewer 端流程

1. **创建 PeerConnection**
   ```typescript
   const pc = await webrtc.createPeerConnection(); // 从 /api/config 获取 ICE 服务器配置
   ```

2. **加入房间**
   ```typescript
   await wsManager.connect("viewer", room);
   ```
   - Viewer 加入房间后，服务器会自动发送 `VIEWER_READY` 给 Sender（如果 Sender 已存在）

3. **接收 Offer**
   - 收到 `OFFER` 消息后，创建 Answer
   ```typescript
   await pc.setRemoteDescription(offer);
   const answer = await pc.createAnswer();
   await pc.setLocalDescription(answer);
   // 通过 WebSocket 发送 ANSWER
   wsManager.send({ type: "answer", sdp: answer });
   ```

4. **接收和处理远程媒体流**
   ```typescript
   pc.ontrack = (event) => {
     videoElement.srcObject = event.streams[0];
   };
   ```

5. **接收 ICE Candidates**
   - 收到 `ICE_CANDIDATE` 消息：添加到 PeerConnection

### 4. ICE Candidate 交换

WebRTC 需要通过 ICE (Interactive Connectivity Establishment) 来建立连接：

1. **ICE Candidate 生成**
   - 浏览器自动生成 ICE candidates
   - 通过 `onicecandidate` 事件获取

2. **ICE Candidate 交换**
   - Sender/Viewer 通过 WebSocket 发送 `ICE_CANDIDATE` 消息
   - 服务器转发到对端
   - 对端接收到后添加到 PeerConnection

3. **ICE 连接建立**
   - 浏览器尝试多个 ICE candidates
   - 成功建立连接后，WebRTC 连接完成
   - 视频数据开始通过 UDP 传输


## 连接断开处理

### 客户端断开

当客户端断开 WebSocket 连接时：

1. **Sender 断开**
   - 服务器发送 `SENDER_LEFT` 给 Viewer
   - Viewer 进入等待状态

2. **Viewer 断开**
   - 服务器发送 `VIEWER_LEFT` 给 Sender
   - Sender 进入等待状态

### 自动重连

客户端在以下情况下会自动尝试重连：

- WebSocket 连接异常断开（非正常关闭）
- 重连次数未超过最大限制（默认 5 次）
- 重连延迟递增（1s, 2s, 3s, 4s, 5s）

### 连接状态检查

服务器会检查现有连接是否存活：

- 如果新连接与现有连接是同一个 WebSocket 实例，允许连接
- 如果现有连接已断开（`readyState !== OPEN`），允许新连接替换
- 如果现有连接仍然活跃，拒绝新连接并返回错误

## 数据流向

### 信令数据流（WebSocket）

```
Sender                Server              Viewer
  |                     |                    |
  |---- JOIN ---------->|                    |
  |<--- JOINED ---------|                    |
  |                     |<---- JOIN ---------|
  |                     |---- JOINED ------->|
  |<--- VIEWER_READY ---|                    |
  |---- OFFER --------->|---- OFFER -------->|
  |                     |<--- ANSWER --------|
  |<--- ANSWER ---------|                    |
  |---- ICE ----------->|---- ICE ---------->|
  |<--- ICE ------------|---- ICE ---------->|
  |                     |                    |
```

### 媒体数据流（WebRTC/UDP）

```
Sender                                         Viewer
  |                                              |
  |<============ WebRTC PeerConnection =========>|
  |                                              |
  |<---------- Video Stream (UDP) -------------->|
  |                                              |
```

## 状态管理

### Sender 状态

- **INIT**：初始化中，获取摄像头权限
- **WAITING**：等待 Viewer 加入
- **ACTIVE**：正在推流，有 Viewer 连接
- **ERROR**：发生错误

### Viewer 状态

- **INIT**：初始化中，等待 Sender
- **ACTIVE**：正在接收视频流
- **WAITING**：Sender 离开，等待新的 Sender
- **ERROR**：发生错误

## 安全说明

1. **开发环境**：
   - 前端使用 HTTPS（自签证书）
   - 后端使用 HTTP
   - 仅用于内网测试

2. **生产环境**：
   - 建议使用 Nginx 等反向代理配置 HTTPS
   - 使用正式的 SSL 证书
   - 考虑添加身份验证机制

3. **CORS**：
   - 服务器设置了 `Access-Control-Allow-Origin: *`
   - 允许跨域请求（开发环境）

4. **WebSocket 安全**：
   - 建议在生产环境使用 WSS（WebSocket Secure）
   - 通过反向代理（如 Nginx）处理 SSL/TLS


