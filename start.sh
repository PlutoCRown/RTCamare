#!/bin/bash

# WebRTC 视频传输服务启动脚本
# 使用方法: ./start.sh 或 bash start.sh

echo "🚀 启动 WebRTC 视频传输服务..."

# 检查 Node.js 是否安装
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未找到 Node.js，请先安装 Node.js"
    echo "   下载地址: https://nodejs.org/"
    exit 1
fi

# 检查是否已构建
if [ ! -f "dist/server.js" ]; then
    echo "📦 首次运行，正在构建项目..."
    
    # 检查是否有 package.json
    if [ ! -f "package.json" ]; then
        echo "❌ 错误: 未找到 package.json 文件"
        exit 1
    fi
    
    # 安装依赖
    echo "📥 安装依赖..."
    if command -v pnpm &> /dev/null; then
        pnpm install
    elif command -v yarn &> /dev/null; then
        yarn install
    else
        npm install
    fi
    
    # 构建项目
    echo "🔨 构建项目..."
    if command -v pnpm &> /dev/null; then
        pnpm run build:prod
    elif command -v yarn &> /dev/null; then
        yarn build:prod
    else
        npm run build:prod
    fi
    
    if [ $? -ne 0 ]; then
        echo "❌ 构建失败"
        exit 1
    fi
    
    echo "✅ 构建完成"
fi

# 启动服务
echo "🎯 启动服务..."
node dist/server.js

# 如果服务异常退出，显示错误信息
if [ $? -ne 0 ]; then
    echo ""
    echo "❌ 服务启动失败"
    echo "💡 可能的解决方案:"
    echo "   1. 检查端口是否被占用"
    echo "   2. 检查防火墙设置"
    echo "   3. 重新构建: rm -rf dist && ./start.sh"
    exit 1
fi
