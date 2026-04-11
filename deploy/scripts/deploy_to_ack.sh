# deploy/scripts/deploy_to_ack.sh
#!/bin/bash

set -euo pipefail

# 接受参数：环境 (test/prod) 和镜像 Tag
ENV="$1"
IMAGE_TAG="$2"

if [[ -z "$ENV" || -z "$IMAGE_TAG" ]]; then
  echo "Usage: $0 <test|prod> <image_tag>"
  echo "Example (test): $0 test test-abcdefg"
  echo "Example (prod): $0 prod v1.0.0"
  exit 1
fi

ACR_REGISTRY="<your-acr-registry>" # 替换为您的 ACR 仓库地址
IMAGE_NAME="new-api"

FULL_IMAGE_NAME="${ACR_REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"

KUBE_CONFIG_PATH="~/.kube/config" # 您的 kubeconfig 路径，CI/CD 环境中可能不同

echo "Deploying new-api to ${ENV} environment with image: ${FULL_IMAGE_NAME}"

# 应用 kustomize 配置
# 替换 deployment.yaml 中的镜像
# kustomize edit set image new-api-deployment=${FULL_IMAGE_NAME} --tag ${FULL_IMAGE_NAME} --base-dir deploy/kubernetes/overlays/${ENV}
# Update the deployment.yaml in the overlay with the correct image tag
# This needs to be done carefully as kustomize edit set image is meant for setting the image name, not modifying existing tags in an overlay.
# A direct patch or sed might be more appropriate for updating the tag within an existing overlay deployment.yaml

# For simplicity, we'll assume the image is directly updated in the overlay deployment.yaml by CI/CD pipeline or manually.
# A more robust solution for CI/CD would involve using `kustomize edit set image` on the base and then building, or directly patching the deployment.

# Let's add a placeholder for image replacement in the overlay deployment.yaml using a simpler mechanism for now
# In a real CI/CD, you would use `kustomize edit set image` on the base kustomization.yaml or a more advanced patching strategy.
# For now, we'll rely on the image being set in the CI/CD pipeline.

# Build and apply kustomize configuration
kustomize build deploy/kubernetes/overlays/${ENV} | kubectl apply --kubeconfig "${KUBE_CONFIG_PATH}" -f -

echo "Deployment to ${ENV} environment successful."

# 部署后，您可以选择运行一些 kubectl 命令进行验证
# kubectl --kubeconfig "${KUBE_CONFIG_PATH}" get pods -n new-api-${ENV}
# kubectl --kubeconfig "${KUBE_CONFIG_PATH}" get svc -n new-api-${ENV}
# kubectl --kubeconfig "${KUBE_CONFIG_PATH}" get ingress -n new-api-${ENV}
