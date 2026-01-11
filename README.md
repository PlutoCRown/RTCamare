# WebRTC 视频传输服务

一个基于 Node.js 的 WebRTC 视频传输服务，前端使用 HTTPS（通过 rsbuild 自动生成证书），后端使用 HTTP，支持二维码快速连接。

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

## 📁 项目结构

```
├── dist/                    # 构建输出目录
│   ├── server/              # 打包后的服务器代码
│   │   └── index.js
│   └── public/              # 前端构建产物（React应用）
├── frontend/                # React前端应用
│   ├── src/
│   │   ├── components/      # React组件
│   │   │   ├── Home/        # 首页组件
│   │   │   ├── Sender/      # 发送方组件
│   │   │   └── Viewer/      # 接收方组件
│   │   ├── utils/           # 工具类
│   │   ├── main.tsx         # 入口文件
│   │   └── index.html       # HTML模板
│   ├── rsbuild.config.ts    # Rsbuild配置（前端打包）
│   └── tsconfig.json        # TypeScript配置
├── server/                  # 后端服务器代码
│   ├── index.js             # 服务器入口
│   ├── http.js              # HTTP服务器
│   ├── websocket.js         # WebSocket服务器
│   └── stun.js              # STUN服务器
├── rspack.config.js         # Rspack配置（后端打包）
├── start.sh                 # 启动脚本
└── package.json             # 项目配置
```

### 技术栈

- **后端**：Node.js + Rspack（打包工具）
- **前端**：React + TypeScript + Rsbuild（构建工具）+ TanStack Router（路由）
- **样式**：CSS Modules（每个组件使用 `index.module.css` 隔离样式）

## 🛠️ 开发模式

```bash
# 开发模式（同时启动前端和后端，支持热重载）
npm run dev

# 单独启动前端开发服务器（Rsbuild）
npm run dev:frontend

# 单独启动后端开发服务器（Bun watch）
npm run dev:backend

# 构建项目（前端+后端）
npm run build

# 单独构建前端
npm run build:frontend

# 单独构建后端
npm run build:backend

# 构建生产版本
npm run build:prod
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

- Node.js 18.0+ 或 Bun（推荐使用 Bun）
- 支持 WebRTC 的现代浏览器
- 网络环境允许 UDP 通信（STUN/TURN）

## 🎨 前端技术说明

- **框架**：React 18 + TypeScript
- **路由**：TanStack Router（类型安全的路由管理）
- **构建工具**：Rsbuild（基于 Rspack 的高性能构建工具）
- **样式隔离**：CSS Modules（每个组件使用 `index.module.css`）
- **状态管理**：React Hooks + 自定义状态管理类

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

