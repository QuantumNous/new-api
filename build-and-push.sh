#!/bin/bash
# =============================================
# 本地构建 new-api 并推送到 GitHub Container Registry (GHCR)
# 优化版：支持 macOS 构建 amd64 镜像，确保 Linux 服务器可用
# =============================================

set -e

# 配置文件路径（仅保存用户名，不保存 Token，提高安全性）
CONFIG_FILE=".github-registry-config"

# 读取已有配置
if [ -f "$CONFIG_FILE" ]; then
  source "$CONFIG_FILE"
fi

# 如果没有配置用户名，则提示输入
if [ -z "$GITHUB_USERNAME" ]; then
  read -p "请输入你的 GitHub 用户名: " GITHUB_USERNAME
  echo "GITHUB_USERNAME=$GITHUB_USERNAME" > "$CONFIG_FILE"
  echo "配置已保存到 $CONFIG_FILE（仅保存用户名）"
fi

# 提示输入 Token（每次都输入，不保存到文件）
if [ -z "$GITHUB_TOKEN" ]; then
  echo "请输入你的 GitHub Personal Access Token（需要 write:packages 权限）"
  read -sp "Token（输入不会显示）: " GITHUB_TOKEN
  echo ""
fi

# 镜像名称和版本
IMAGE_NAME="ghcr.io/${GITHUB_USERNAME}/new-api"

# 获取版本号
if [ -f "VERSION" ]; then
  VERSION=$(cat VERSION | tr -d '[:space:]')
else
  VERSION=$(git describe --tags --always 2>/dev/null || echo "latest")
fi

echo "================================"
echo "构建信息"
echo "镜像名称 : ${IMAGE_NAME}"
echo "版本标签 : ${VERSION}  和  latest"
echo "平台     : linux/amd64 （适配大多数 Linux 服务器）"
echo "================================"

# 检查 docker buildx 是否可用
if ! docker buildx version >/dev/null 2>&1; then
  echo "错误：docker buildx 未启用！"
  echo "请先执行以下命令启用："
  echo "  docker buildx create --use --name mybuilder"
  exit 1
fi

# 登录 GHCR
echo "正在登录 GitHub Container Registry..."
echo "$GITHUB_TOKEN" | docker login ghcr.io -u "$GITHUB_USERNAME" --password-stdin

# 构建并直接推送（推荐方式）
echo "正在构建并推送镜像（linux/amd64）..."
docker buildx build --platform linux/amd64 \
  -t "${IMAGE_NAME}:${VERSION}" \
  -t "${IMAGE_NAME}:latest" \
  --push .

echo ""
echo "================================"
echo "✅ 构建与推送成功！"
echo "================================"
echo "镜像地址："
echo "  • ${IMAGE_NAME}:${VERSION}"
echo "  • ${IMAGE_NAME}:latest"
echo ""
echo "在 Dokploy / Docker 等环境中使用时："
echo "  镜像名称：${IMAGE_NAME}:latest"
echo "  Registry 用户名：${GITHUB_USERNAME}"
echo "  Registry 密码：你的 GitHub Token"
echo ""
echo "提示：如果需要同时支持 arm64，可以把 --platform linux/amd64 改成 linux/amd64,linux/arm64"
echo "================================"