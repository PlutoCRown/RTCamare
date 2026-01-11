# WebRTC 视频传输服务

一个基于 Node.js 的 WebRTC 视频传输服务，前端使用 HTTPS（通过 rsbuild 自动生成证书），后端使用 HTTP，支持二维码快速连接。

## 🚀 快速开始

```bash
# 安装依赖
npm install
# 或
bun install

# 构建项目（前端+后端）
npm run build:prod

# 启动服务
npm start
```

## 📱 使用方法

启动服务后，终端会显示：

```
============================================================
🚀 WebRTC 视频传输服务已启动
============================================================
📡 服务地址：https://192.168.1.100:8080
📱 成为接收方：https://localhost:8080/viewer/demo

📱 扫码成为发送方：
[二维码]
============================================================
🔧 STUN 服务器：udp://192.168.1.100:3478
============================================================
```

### 使用步骤

1. **发送方（本机）**：

   - 复制发送方链接到浏览器
   - 允许摄像头权限
   - 开始推流

2. **接收方（其他设备）**：
   - 扫描二维码或手动输入服务地址
   - 选择"成为接收方"
   - 点击播放按钮观看视频

## 🔧 配置选项

### 环境变量

- `HTTP_PORT`: 后端 HTTP 端口（默认：8080）
- `STUN_PORT`: STUN 端口（默认：3478）
- `FRONTEND_PORT`: 前端 HTTPS 端口（默认：3000，仅在开发模式下使用）
- `STUN_URL`: 外部 STUN 服务器
- `TURN_URL`: TURN 服务器地址
- `TURN_USERNAME`: TURN 用户名
- `TURN_PASSWORD`: TURN 密码

### 示例

```bash
# 使用自定义端口
HTTP_PORT=9000 ./start.sh

# 使用外部 TURN 服务器
TURN_URL=turn:your-turn-server.com:3478 \
TURN_USERNAME=user \
TURN_PASSWORD=pass \
./start.sh
```

## 🛠️ 开发模式

```bash
# 开发模式（同时启动前端和后端，支持热重载）
npm run dev

# 构建项目（前端+后端）
npm run build

```

### 开发说明

- **前端**：使用 Rsbuild 构建 React 应用，支持热模块替换（HMR）
- **后端**：使用 Rspack 打包 Node.js 服务器代码，开发模式下使用 Bun 的 watch 模式
- **一条命令**：`npm run dev` 使用 `concurrently` 同时运行前端和后端开发服务器

## 🔒 安全说明

- **开发模式**：前端通过 `@rsbuild/plugin-basic-ssl` 自动生成自签证书，浏览器会显示安全警告，选择"继续访问"即可
- **生产模式**：后端使用 HTTP，前端静态文件由后端服务器提供（如需 HTTPS，请使用反向代理如 Nginx）
- 仅用于内网或开发环境，不建议在生产环境直接使用
- 如需生产环境 HTTPS，建议使用 Nginx 等反向代理配置正式 SSL 证书

## 📋 系统要求

- Bun
- 支持 WebRTC 的现代浏览器
- 网络环境允许 UDP 通信（STUN/TURN）


