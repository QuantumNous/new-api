# deploy/scripts/build_and_push_image.sh
#!/bin/bash

set -euo pipefail

# 配置变量
ACR_REGISTRY="<your-acr-registry>" # 替换为您的 ACR 仓库地址，例如 registry.cn-hangzhou.aliyuncs.com/your-namespace
IMAGE_NAME="new-api"

# 获取 Git Commit SHA 作为默认的测试环境 Tag
COMMIT_SHA=$(git rev-parse --short HEAD)

# 接受参数：环境 (test/prod) 和版本号 (仅用于生产环境)
ENV="$1"
VERSION="$2"

# 根据环境设置镜像 Tag
IMAGE_TAG=""
if [[ "$ENV" == "test" ]]; then
  IMAGE_TAG="test-$COMMIT_SHA"
elif [[ "$ENV" == "prod" ]]; then
  if [[ -z "$VERSION" ]]; then
    echo "Error: For 'prod' environment, a version tag (e.g., v1.0.0) must be provided."
    exit 1
  fi
  IMAGE_TAG="$VERSION"
else
  echo "Usage: $0 <test|prod> [version_tag_for_prod]"
  echo "Example (test): $0 test"
  echo "Example (prod): $0 prod v1.0.0"
  exit 1
fi

FULL_IMAGE_NAME="${ACR_REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"

echo "Building Docker image: ${FULL_IMAGE_NAME}"
# 构建 Docker 镜像 (假设 Dockerfile 在项目根目录)
docker build -t "${FULL_IMAGE_NAME}" .

echo "Logging in to ACR registry: ${ACR_REGISTRY}"
# 登录 ACR (确保您的 Docker 客户端已配置 ACR 凭证，或在此处使用 docker login)
# 例如：echo "<your-acr-password>" | docker login --username=<your-acr-username> --password-stdin ${ACR_REGISTRY}
# 或者在 CI/CD 环境中使用云效凭证配置

echo "Pushing Docker image: ${FULL_IMAGE_NAME}"
docker push "${FULL_IMAGE_NAME}"

echo "Image ${FULL_IMAGE_NAME} pushed successfully."
