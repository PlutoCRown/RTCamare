#!/bin/bash

# WebRTC 视频传输服务启动脚本
# 使用方法: ./start.sh 或 bash start.sh

echo "🚀 启动 WebRTC 视频传输服务..."

# 检查 Bun 是否安装
if ! command -v bun &> /dev/null; then
    echo "❌ 错误: 未找到 Bun，请先安装 Bun"
    echo "   安装命令: curl -fsSL https://bun.sh/install | bash"
    exit 1
fi

# 检查是否已构建
if [ ! -f "dist/server/index.js" ]; then
    echo "📦 首次运行，正在构建项目..."
    
    # 检查是否有 package.json
    if [ ! -f "package.json" ]; then
        echo "❌ 错误: 未找到 package.json 文件"
        exit 1
    fi
    
    # 安装依赖
    echo "📥 安装依赖..."
    bun install
    
    # 构建项目
    echo "🔨 构建项目..."
    bun run build:prod
    
    if [ $? -ne 0 ]; then
        echo "❌ 构建失败"
        exit 1
    fi
    
    echo "✅ 构建完成"
fi

# 启动服务
echo "🎯 启动服务..."
bun dist/server/index.js

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
