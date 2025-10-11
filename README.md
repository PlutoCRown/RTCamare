# WebRTC 视频传输服务

一个基于 Node.js 的 WebRTC 视频传输服务，支持自签 HTTPS 证书和二维码快速连接。

## 🚀 快速开始

### 方法一：使用启动脚本（推荐）

1. 确保已安装 Node.js (版本 16+)
2. 双击 `start.sh` 或在终端执行：
   ```bash
   ./start.sh
   ```

启动脚本会自动：

- 检查 Node.js 环境
- 安装依赖（首次运行）
- 构建项目
- 启动服务

### 方法二：手动构建

```bash
# 安装依赖
pnpm install

# 构建项目
pnpm run build:prod

# 启动服务
pnpm start
```

## 📱 使用方法

启动服务后，终端会显示：

```
============================================================
🚀 WebRTC 视频传输服务已启动
============================================================
📡 服务地址：https://192.168.1.100:8080
📱 成为发送方：https://localhost:8080?role=sender&room=demo

📱 扫码成为接收方：
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

- `HTTP_PORT`: HTTP 端口（默认：8080）
- `STUN_PORT`: STUN 端口（默认：3478）
- `TLS_KEY_PATH`: 自定义 TLS 私钥路径
- `TLS_CERT_PATH`: 自定义 TLS 证书路径
- `TLS_COMMON_NAME`: 证书通用名称（默认：localhost）
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

## 📁 项目结构

```
├── dist/                 # 构建输出目录
│   ├── server.js        # 打包后的服务器
│   └── public/          # 静态文件
├── public/              # 前端文件
│   ├── index.html       # 主页面
│   ├── styles.css       # 样式文件
│   └── app.js          # 前端逻辑
├── server.js            # 服务器源码
├── rspack.config.js     # 打包配置
├── start.sh            # 启动脚本
└── package.json        # 项目配置
```

## 🛠️ 开发模式

```bash
# 开发模式（热重载）
pnpm run dev

# 构建开发版本
pnpm run build

# 构建生产版本
pnpm run build:prod
```

## 🔒 安全说明

- 使用自签证书，浏览器会显示安全警告，选择"继续访问"即可
- 仅用于内网或开发环境，不建议在生产环境使用
- 如需生产环境，请使用正式的 SSL 证书

## 📋 系统要求

- Node.js 16.0+
- 支持 WebRTC 的现代浏览器
- 网络环境允许 UDP 通信（STUN/TURN）

## 🐛 故障排除

### 常见问题

1. **端口被占用**

   ```bash
   # 使用其他端口
   HTTP_PORT=9000 ./start.sh
   ```

2. **摄像头权限被拒绝**

   - 确保浏览器允许摄像头访问
   - 检查系统摄像头权限设置

3. **无法连接其他设备**

   - 检查防火墙设置
   - 确保设备在同一网络
   - 考虑配置 TURN 服务器

4. **重新构建**
   ```bash
   rm -rf dist
   ./start.sh
   ```

## 📄 许可证

MIT License

