# 阿里云 ACK 环境初始化及 `new-api` 部署指南

## 1. 概述

本文档旨在指导您在阿里云上初始化 `new-api` 项目所需的各项基础设施，并分环境部署 `new-api` 应用。我们将利用阿里云的容器服务 ACK、云数据库 RDS、云数据库 Redis 等产品，并结合 CI/CD 流程，构建一个高可用、弹性伸缩、安全可靠的运行环境。

## 2. 阿里云资源准备

在部署 `new-api` 之前，请确保您已拥有阿里云账号，并完成实名认证。

### 2.1 专有网络 VPC 及交换机 VSwitch

**目的**：为您的云资源提供一个隔离、安全的网络环境，并实现跨可用区容灾。

1.  **登录阿里云控制台**：进入 [VPC 控制台](https://vpc.console.aliyun.com/vpc)。
2.  **创建 VPC**：
    *   **地域**：选择您的业务所在地域 (例如：华东1-杭州)。
    *   **VPC 名称**：`new-api-vpc` (建议)
    *   **IPv4 CIDR Block**：`10.0.0.0/8` (或根据您的网络规划自定义)
3.  **创建 VSwitch**：在 VPC 详情页中，至少在**两个不同的可用区**创建 VSwitch。这将确保即使一个可用区发生故障，您的服务也能继续运行。
    *   **可用区 A VSwitch**：`new-api-vsw-az-a`，CIDR Block：`10.0.1.0/24`
    *   **可用区 B VSwitch**：`new-api-vsw-az-b`，CIDR Block：`10.0.2.0/24`

### 2.2 容器服务 ACK (Kubernetes)

**目的**：托管 `new-api` 应用容器，提供高可用和弹性伸缩能力。

1.  **登录阿里云控制台**：进入 [ACK 控制台](https://cs.console.aliyun.com/)。
2.  **创建 Kubernetes 集群**：推荐选择**标准版托管集群**。
    *   **集群名称**：`new-api-ack-cluster`
    *   **地域**：与 VPC 相同
    *   **VPC**：选择 `new-api-vpc`
    *   **交换机**：选择您创建的两个 VSwitch (`new-api-vsw-az-a`, `new-api-vsw-az-b`)
    *   **工作节点配置**：
        *   **实例类型**：根据预算和性能需求选择，建议至少 `ecs.g7.large` (2核8G) 或更高。
        *   **数量**：测试环境至少 2 台，生产环境至少 3 台，分布在不同可用区。
        *   **操作系统**：Alibaba Cloud Linux 或 CentOS。
    *   **高级配置**：
        *   **开启网络策略 (Network Policy)**：增强网络安全。
        *   **开启日志服务 (SLS)**：自动采集集群和容器日志 (选择您创建的 Log Service Project 和 Logstore)。
        *   **开启 Prometheus 监控**：用于采集应用指标。
    *   **Ingress 组件**：选择安装 `Nginx Ingress Controller` 或 `阿里云 SLB Ingress Controller`。
3.  **配置 Kubectl**：根据 ACK 控制台的指引，配置本地 `kubectl` 工具，确保可以连接到您的 ACK 集群。

### 2.3 云数据库 RDS (MySQL / PostgreSQL)

**目的**：为 `new-api` 提供高可用、持久化的关系型数据库服务。

1.  **登录阿里云控制台**：进入 [RDS 控制台](https://rds.console.aliyun.com/)。
2.  **创建 RDS 实例**：
    *   **计费方式**：按量付费 (测试环境) / 包年包月 (生产环境)。
    *   **地域**：与 ACK 集群相同。
    *   **数据库类型**：MySQL (推荐) 或 PostgreSQL。
    *   **版本**：MySQL 8.0 或 PostgreSQL 14+。
    *   **部署方式**：**三节点企业版 (推荐)** 或 **高可用版 (主备)**，以确保高可用和数据可靠性。
    *   **存储类型**：ESSD 云盘。
    *   **实例规格**：根据环境和预期负载选择 (例如测试环境 `1核2G`，生产环境 `4核16G` 或更高)。
    *   **存储空间**：根据数据量选择。
    *   **VPC 网络**：选择 `new-api-vpc`。
    *   **交换机**：选择不同可用区的 VSwitch，例如 `new-api-vsw-az-a` 和 `new-api-vsw-az-b`。
    *   **高可用配置**：默认开启。
    *   **备份策略**：开启自动备份。
3.  **创建数据库和账号**：
    *   在 RDS 实例详情页中，创建 `new-api` 所需的数据库 (例如 `newapi_db`)。
    *   创建数据库账号 (例如 `newapi_user`) 并设置密码。
4.  **配置白名单**：在 RDS 实例详情页中，配置 IP 白名单，允许您的 ACK 集群所在的 VPC CIDR (例如 `10.0.0.0/8`) 访问。**不要设置为 `0.0.0.0/0`**。
5.  **获取连接信息**：记录 RDS 实例的内网连接地址和端口。

### 2.4 云数据库 Redis

**目的**：为 `new-api` 提供高可用、高性能的缓存服务。

1.  **登录阿里云控制台**：进入 [Redis 控制台](https://redis.console.aliyun.com/)。
2.  **创建 Redis 实例**：
    *   **计费方式**：按量付费 (测试环境) / 包年包月 (生产环境)。
    *   **地域**：与 ACK 集群相同。
    *   **版本**：Redis 5.0 或 6.0。
    *   **架构**：**主从版 (推荐)** 或 **集群版**。
    *   **实例规格**：根据缓存数据量和并发量选择 (例如测试环境 `256MB`，生产环境 `4GB` 或更高)。
    *   **VPC 网络**：选择 `new-api-vpc`。
    *   **交换机**：选择不同可用区的 VSwitch。
    *   **密码**：设置 Redis 访问密码。
3.  **配置白名单**：在 Redis 实例详情页中，配置 IP 白名单，允许您的 ACK 集群所在的 VPC CIDR 访问。**不要设置为 `0.0.0.0/0`**。
4.  **获取连接信息**：记录 Redis 实例的内网连接地址和端口。

### 2.5 容器镜像服务 ACR

**目的**：存储 `new-api` 的 Docker 镜像。

1.  **登录阿里云控制台**：进入 [ACR 控制台](https://cr.console.aliyun.com/)。
2.  **创建个人版实例**：如果尚未创建，请创建一个个人版实例。
3.  **创建命名空间**：创建命名空间 (例如 `new-api-repo`)。
4.  **创建镜像仓库**：在命名空间下创建镜像仓库 (例如 `new-api`)。
5.  **配置凭证**：记录您的 ACR 登录凭证，用于 CI/CD 流水线推送镜像。

### 2.6 日志服务 SLS (可选，但强烈推荐)

**目的**：集中采集、存储、查询和分析 `new-api` 应用日志。

1.  **登录阿里云控制台**：进入 [SLS 控制台](https://sls.console.aliyun.com/)。
2.  **创建 Project**：`new-api-log-project`。
3.  **创建 Logstore**：例如 `new-api-access-log`, `new-api-error-log`, `new-api-metrics` 等。
4.  **配置 ACK 关联**: 在 ACK 集群创建时通常会提示关联 SLS，确保已开启容器日志采集。

## 3. Kubernetes 资源配置 (YAML)

本章节提供 `new-api` 在 ACK 上部署所需的 Kubernetes YAML 文件模板。这些文件位于 `deploy/kubernetes` 目录下，并使用 `kustomize` 进行环境差异化管理。

### 3.1 `base` 目录 (通用配置)

`deploy/kubernetes/base` 目录存放所有环境通用的 Kubernetes 资源配置。

#### 3.1.1 `namespace.yaml`

```yaml
# deploy/kubernetes/base/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: new-api # 命名空间名称，将被 overlay 覆盖为 new-api-test 或 new-api-prod
```

#### 3.1.2 `configmap.yaml`

```yaml
# deploy/kubernetes/base/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: new-api-config
  namespace: new-api # 命名空间名称，将被 overlay 覆盖
data:
  STREAMING_TIMEOUT: "300"
  STREAM_SCANNER_MAX_BUFFER_MB: "64"
  MAX_REQUEST_BODY_MB: "32"
  # 其他非敏感环境变量
  # ERROR_LOG_ENABLED: "false"
```

#### 3.1.3 `service.yaml`

```yaml
# deploy/kubernetes/base/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: new-api-service
  namespace: new-api # 命名空间名称，将被 overlay 覆盖
spec:
  selector:
    app: new-api
  ports:
    - protocol: TCP
      port: 80 # Service 监听的端口
      targetPort: 3000 # Pod 实际监听的端口
  type: ClusterIP # ClusterIP 类型，仅在集群内部可访问，通过 Ingress 对外暴露
```

#### 3.1.4 `ingress.yaml`

**注意**：Ingress 配置需要根据您选择的 Ingress Controller (Nginx 或 SLB Ingress) 进行调整，并替换您的域名和 SSL 证书 ID。

```yaml
# deploy/kubernetes/base/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: new-api-ingress
  namespace: new-api # 命名空间名称，将被 overlay 覆盖
  annotations:
    # 如果使用阿里云 SLB Ingress Controller，可以添加以下注解来配置 SLB
    # service.beta.kubernetes.io/alicloud-loadbalancer-protocol-port: "https:443,http:80"
    # service.beta.kubernetes.io/alicloud-loadbalancer-cert-id: "<your_ssl_certificate_id>" # 替换为您的SSL证书ID
    # service.beta.kubernetes.io/alicloud-loadbalancer-force-override-listeners: "true"
    # service.beta.kubernetes.io/alicloud-loadbalancer-health-check-uri: "/api/status"
    # service.beta.kubernetes.io/alicloud-loadbalancer-health-check-connect-port: "3000"
    # service.beta.kubernetes.io/alicloud-loadbalancer-health-check-interval: "3"
    # service.beta.kubernetes.io/alicloud-loadbalancer-health-check-timeout: "5"
    # service.beta.kubernetes.io/alicloud-loadbalancer-health-check-unhealthy-threshold: "3"
    # service.beta.kubernetes.io/alicloud-loadbalancer-health-check-healthy-threshold: "3"
    # service.beta.kubernetes.io/alicloud-loadbalancer-spec: "slb.s1.small" # SLB实例规格
    # nginx.ingress.kubernetes.io/rewrite-target: / # 如果需要路径重写
spec:
  ingressClassName: nginx # 或者 alibaba-cloud，根据您的 Ingress Controller 类型配置
  rules:
  - host: <your_domain_for_new_api> # 替换为您的实际域名，例如 new-api.yourcompany.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: new-api-service
            port:
              number: 80
  tls:
  - hosts:
    - <your_domain_for_new_api>
    secretName: new-api-tls-secret # 存储TLS证书的Secret，需要手动创建或通过 Cert-manager 生成
```

#### 3.1.5 `hpa.yaml`

```yaml
# deploy/kubernetes/base/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: new-api-hpa
  namespace: new-api # 命名空间名称，将被 overlay 覆盖
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: new-api-deployment # Deployment 名称，将被 overlay 覆盖
  minReplicas: 2 # 最小副本数，确保高可用
  maxReplicas: 10 # 最大副本数
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70 # 当 CPU 平均使用率达到 70% 时扩容
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80 # 当内存平均使用率达到 80% 时扩容
```

### 3.2 `overlays` 目录 (环境差异化配置)

`deploy/kubernetes/overlays` 目录包含针对不同环境的特定配置，通过 `kustomize` 应用到 `base` 配置上。

#### 3.2.1 测试环境 (`test`)

`deploy/kubernetes/overlays/test/kustomization.yaml`

```yaml
# deploy/kubernetes/overlays/test/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: new-api-test # 定义测试环境的命名空间

resources:
  - ../../base # 引入基础配置

patches:
  - path: deployment.yaml # 覆盖 Deployment 配置
  - path: secret.yaml # 覆盖 Secret 配置
```

`deploy/kubernetes/overlays/test/deployment.yaml`

```yaml
# deploy/kubernetes/overlays/test/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: new-api-deployment # 对应 base 中的 Deployment 名称
  namespace: new-api-test # 覆盖 base 中的命名空间
spec:
  replicas: 1 # 测试环境通常一个副本即可
  template:
    spec:
      containers:
      - name: new-api
        image: <your-acr-registry>/new-api:test-<COMMIT_SHA> # 测试环境镜像，CI/CD 时替换
        resources:
          requests:
            cpu: "100m"
            memory: "256Mi"
          limits:
            cpu: "500m"
            memory: "512Mi"
```

`deploy/kubernetes/overlays/test/secret.yaml`

```yaml
# deploy/kubernetes/overlays/test/secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: new-api-secrets
  namespace: new-api-test # 覆盖 base 中的命名空间
type: Opaque
data:
  SESSION_SECRET: <base64_encoded_test_SESSION_SECRET>
  CRYPTO_SECRET: <base64_encoded_test_CRYPTO_SECRET>
  SQL_DSN: <base64_encoded_test_SQL_DSN> # 指向测试环境 RDS
  REDIS_CONN_STRING: <base64_encoded_test_REDIS_CONN_STRING> # 指向测试环境 Redis
```

#### 3.2.2 生产环境 (`prod`)

`deploy/kubernetes/overlays/prod/kustomization.yaml`

```yaml
# deploy/kubernetes/overlays/prod/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: new-api-prod # 定义生产环境的命名空间

resources:
  - ../../base # 引入基础配置

patches:
  - path: deployment.yaml # 覆盖 Deployment 配置
  - path: secret.yaml # 覆盖 Secret 配置
```

`deploy/kubernetes/overlays/prod/deployment.yaml`

```yaml
# deploy/kubernetes/overlays/prod/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: new-api-deployment
  namespace: new-api-prod # 覆盖 base 中的命名空间
spec:
  replicas: 2 # 生产环境至少 2 个副本
  template:
    spec:
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
            - weight: 100
              podAffinityTerm:
                labelSelector:
                  matchLabels:
                    app: new-api
                topologyKey: kubernetes.io/hostname # 将 Pod 分散到不同节点
      containers:
      - name: new-api
        image: <your-acr-registry>/new-api:vX.Y.Z # 生产环境镜像，CI/CD 时替换为版本号 Tag
        resources:
          requests:
            cpu: "250m"
            memory: "512Mi"
          limits:
            cpu: "1000m"
            memory: "1024Mi"
```

`deploy/kubernetes/overlays/prod/secret.yaml`

```yaml
# deploy/kubernetes/overlays/prod/secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: new-api-secrets
  namespace: new-api-prod # 覆盖 base 中的命名空间
type: Opaque
data:
  SESSION_SECRET: <base64_encoded_prod_SESSION_SECRET>
  CRYPTO_SECRET: <base64_encoded_prod_CRYPTO_SECRET>
  SQL_DSN: <base64_encoded_prod_SQL_DSN> # 指向生产环境 RDS
  REDIS_CONN_STRING: <base64_encoded_prod_REDIS_CONN_STRING> # 指向生产环境 Redis
```

## 4. 辅助脚本

这些脚本将帮助您自动化镜像构建、推送和应用部署的过程。

### 4.1 `scripts/build_and_push_image.sh`

```bash
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
```

### 4.2 `scripts/deploy_to_ack.sh`

```bash
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
}

ACR_REGISTRY="<your-acr-registry>" # 替换为您的 ACR 仓库地址
IMAGE_NAME="new-api"

FULL_IMAGE_NAME="${ACR_REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"

KUBE_CONFIG_PATH="~/.kube/config" # 您的 kubeconfig 路径，CI/CD 环境中可能不同

echo "Deploying new-api to ${ENV} environment with image: ${FULL_IMAGE_NAME}"

# 应用 kustomize 配置
# 替换 deployment.yaml 中的镜像
kustomize edit set image new-api-deployment=${FULL_IMAGE_NAME} --tag ${FULL_IMAGE_NAME} --base-dir deploy/kubernetes/overlays/${ENV}

# 替换 ingress.yaml 中的域名 (需要您手动修改 kustomization.yaml 或直接在 base/ingress.yaml 中替换)
# kustomize edit set field <path.to.field> <new-value> --base-dir deploy/kubernetes/overlays/${ENV}

# 部署到 Kubernetes
kustomize build deploy/kubernetes/overlays/${ENV} | kubectl apply --kubeconfig "${KUBE_CONFIG_PATH}" -f -

echo "Deployment to ${ENV} environment successful."

# 部署后，您可以选择运行一些 kubectl 命令进行验证
# kubectl --kubeconfig "${KUBE_CONFIG_PATH}" get pods -n new-api-${ENV}
# kubectl --kubeconfig "${KUBE_CONFIG_PATH}" get svc -n new-api-${ENV}
# kubectl --kubeconfig "${KUBE_CONFIG_PATH}" get ingress -n new-api-${ENV}
```

## 5. 后续配置

### 5.1 替换占位符

请务必替换以下文件中的占位符 (`<...>`) 为您的实际值：

*   **`deploy/docs/ACK_SETUP_GUIDE.md`**: 所有 `new-api-vpc`, `new-api-ack-cluster`, `new-api-db`, `new-api-user` 等名称，以及 RDS/Redis 的规格和连接信息。
*   **`deploy/kubernetes/base/ingress.yaml`**: `your_domain_for_new_api`, `your_ssl_certificate_id`。
*   **`deploy/kubernetes/overlays/<env>/deployment.yaml`**: `your-acr-registry`。
*   **`deploy/kubernetes/overlays/<env>/secret.yaml`**: 所有 base64 编码的敏感信息。您可以使用 `echo -n "your_value" | base64` 来生成。
*   **`deploy/scripts/build_and_push_image.sh`**: `ACR_REGISTRY`。
*   **`deploy/scripts/deploy_to_ack.sh`**: `ACR_REGISTRY`。

### 5.2 ACR 登录凭证 (针对脚本)

在使用 `build_and_push_image.sh` 脚本时，确保您的 Docker 环境已经登录到 ACR。在 CI/CD 流水线中，这通常通过配置云效的 ACR 插件或配置 Docker 凭证助手来完成。

### 5.3 Kubeconfig 配置 (针对脚本)

在使用 `deploy_to_ack.sh` 脚本时，确保您的 `kubectl` 已经配置了正确的 `kubeconfig` 文件，并且有权限操作目标 ACK 集群。

### 5.4 CI/CD 流水线集成

这些脚本和 Kubernetes YAML 文件将作为您云效 CI/CD 流水线中的核心步骤。您需要在云效流水线中配置相应的步骤来：

1.  **拉取代码**。
2.  **执行单元测试和代码扫描**。
3.  **构建并推送镜像** (调用 `build_and_push_image.sh`)。
4.  **部署到测试环境** (调用 `deploy_to_ack.sh`，传入 `test` 和 `test-<COMMIT_SHA>`)。
5.  **运行集成测试**。
6.  **审批** (生产环境部署前)。
7.  **部署到生产环境** (调用 `deploy_to_ack.sh`，传入 `prod` 和 `vX.Y.Z`)。

这份文档和脚本将为您提供一个坚实的基础，以便在阿里云 ACK 上高效、可靠地部署和管理 `new-api` 项目。
