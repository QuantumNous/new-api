# Terraform — new-api 腾讯云生产部署


使用 Terraform 声明式管理 new-api 在腾讯云上的全部基础设施和应用部署。

## 架构

```
GitHub (tag push)
    │
    ├─ Build Docker Image → 腾讯云 TCR
    │
    └─ terraform apply -var="app_image_tag=v0.2.0"
          │
          └─► TKE Serverless 集群
                ├── new-api Deployment (滚动更新)
                ├── new-api Service (CLB LoadBalancer)
                └── Secret (DB/Redis 连接信息)

腾讯云资源 (全部由 Terraform 管理)
    ├── VPC + 子网 + 安全组
    ├── TKE Serverless (EKS) 集群
    ├── 云数据库 PostgreSQL
    ├── 云数据库 Redis
    └── CLB (自动创建)
```

## 前置准备

1. **腾讯云账号** — 获取 SecretId / SecretKey
2. **TCR 个人版** — 在控制台创建命名空间
3. **COS Bucket** — 存储 Terraform state
   ```bash
   # 在控制台创建 bucket，名称如: new-api-tfstate-xxxxxx
   # 地域和部署保持一致
   ```
4. 修改 `versions.tf` 中的 `bucket` 名称

## 使用方法

### 首次部署

```bash
cd infra/terraform

# 1. 复制配置文件并填入实际值
cp terraform.tfvars.example terraform.tfvars
# 编辑 terraform.tfvars

# 2. 初始化
terraform init

# 3. 预览变更
terraform plan

# 4. 创建所有资源
terraform apply
```

### 日常发版（自动）

```bash
git tag v0.2.0
git push origin v0.2.0
# GitHub Actions 自动: build → push TCR → terraform apply
```

### 手动部署

```bash
# 方式1: GitHub Actions 手动触发，填入 image_tag
# 方式2: 本地执行
terraform apply -var="app_image_tag=v0.2.0"
```

### 回滚

```bash
# 声明式回滚 — 指定旧版本号
terraform apply -var="app_image_tag=v0.1.9"
```

## GitHub Secrets

在仓库 Settings → Secrets and variables → Actions 中配置：

| Secret | 说明 |
|--------|------|
| `TENCENTCLOUD_SECRET_ID` | 腾讯云 API SecretId |
| `TENCENTCLOUD_SECRET_KEY` | 腾讯云 API SecretKey |
| `TCR_NAMESPACE` | TCR 个人版命名空间名 |
| `DB_PASSWORD` | PostgreSQL 密码 |
| `SESSION_SECRET` | new-api SESSION_SECRET |

## 文件结构

```
infra/terraform/
├── versions.tf              # Terraform/Provider 版本 + COS backend
├── provider.tf              # 腾讯云 + K8s Provider 配置
├── variables.tf             # 变量定义
├── terraform.tfvars.example # 变量值示例
├── network.tf               # VPC、子网、安全组
├── database.tf              # 云数据库 PostgreSQL + Redis
├── app.tf                   # TKE Serverless 集群 + K8s Deployment/Service
├── outputs.tf               # 输出值
└── README.md                # 本文件
```

## 成本估算（按量付费）

| 资源 | 规格 | 预估月费 |
|------|------|---------|
| TKE Serverless Pod | 1C2G × 1 副本 | ~¥80-120 |
| 云数据库 PostgreSQL | 2GB 内存, 20GB 存储 | ~¥60-100 |
| 云数据库 Redis | 256MB | ~¥30-50 |
| CLB | 按流量 | ~¥10-30 |
| **合计** | | **~¥180-300/月** |

## 注意事项

- `terraform.tfvars` 包含敏感信息，**不要提交到 Git**
- 首次 `terraform apply` 创建集群约需 5-10 分钟
- 后续更新镜像版本通常 1-2 分钟完成
- TKE Serverless Pod 资源规格影响计费，按需调整 `app.tf` 中的 resources
- 如需 HTTPS，在 CLB 控制台配置证书，或使用 cert-manager
