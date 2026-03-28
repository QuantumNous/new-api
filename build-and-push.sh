#!/bin/bash
# 本地构建并推送到 GitHub Container Registry
# 首次使用需要配置 GitHub 用户名和 Token

set -e

# 配置文件路径
CONFIG_FILE=".github-registry-config"

# 读取配置
if [ -f "$CONFIG_FILE" ]; then
  source "$CONFIG_FILE"
fi

# 如果没有配置，提示输入
if [ -z "$GITHUB_USERNAME" ]; then
  read -p "请输入你的 GitHub 用户名: " GITHUB_USERNAME
  echo "GITHUB_USERNAME=$GITHUB_USERNAME" > "$CONFIG_FILE"
fi

if [ -z "$GITHUB_TOKEN" ]; then
  read -sp "请输入你的 GitHub Token (输入不会显示): " GITHUB_TOKEN
  echo ""
  echo "GITHUB_TOKEN=$GITHUB_TOKEN" >> "$CONFIG_FILE"
  chmod 600 "$CONFIG_FILE"
  echo "配置已保存到 $CONFIG_FILE"
fi

# 镜像信息
IMAGE_NAME="ghcr.io/${GITHUB_USERNAME}/new-api"
VERSION=$(cat VERSION 2>/dev/null | tr -d '[:space:]')
if [ -z "$VERSION" ]; then
  VERSION=$(git describe --tags --always 2>/dev/null || echo "latest")
fi

echo "================================"
echo "构建镜像: ${IMAGE_NAME}:${VERSION}"
echo "================================"

# 登录 GitHub Container Registry
echo "$GITHUB_TOKEN" | docker login ghcr.io -u "$GITHUB_USERNAME" --password-stdin

# 创建并使用 buildx builder（支持多平台构建）
docker buildx create --use --name multiarch-builder 2>/dev/null || docker buildx use multiarch-builder

# 构建并推送多平台镜像（只构建 linux/amd64，适配大多数服务器）
docker buildx build \
  --platform linux/amd64 \
  -t "${IMAGE_NAME}:${VERSION}" \
  -t "${IMAGE_NAME}:latest" \
  --push \
  .

echo ""
echo "================================"
echo "✅ 推送成功!"
echo "================================"
echo "镜像地址: ${IMAGE_NAME}:latest"
echo ""
echo "在 Dokploy 中配置:"
echo "  镜像: ${IMAGE_NAME}:latest"
echo "  Registry 用户名: ${GITHUB_USERNAME}"
echo "  Registry 密码: (使用你的 GitHub Token)"
echo "================================"