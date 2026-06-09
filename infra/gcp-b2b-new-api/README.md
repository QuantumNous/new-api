# B2B dedicated new-api on Cloud Run

这套目录用于在本地一键给一个 B 端客户创建独立的 `new-api` 服务栈。默认资源：

- Cloud Run `web`：公网入口，直接使用 Cloud Run 预分配 URL，不创建 LB。
- Cloud Run `master`：内部入口，单实例，负责迁移和后台任务。
- Cloud SQL for PostgreSQL：私网访问，自动创建数据库、应用账号和密码。
- Memorystore Redis：私网访问，默认开启 Redis AUTH。
- Secret Manager：保存 `SQL_DSN`、`REDIS_CONN_STRING`、`SESSION_SECRET`、`CRYPTO_SECRET`。
- 专用 VPC/Subnet/Private Service Access：默认每个客户一套，避免资源互相影响。

## 前置条件

本地需要：

- `gcloud`
- `terraform >= 1.6`
- 已登录 GCP：`gcloud auth login`
- Terraform 可用的 ADC：`gcloud auth application-default login`
- 当前账号有创建 Cloud Run、Cloud SQL、Redis、Secret Manager、VPC、Artifact Registry、Cloud Build 和 IAM 的权限。

## 一键部署

在仓库根目录执行：

```bash
infra/gcp-b2b-new-api/deploy.sh acme --project rezonaai --region us-east1
```

`acme` 是客户前缀，必须是 3-21 位小写字母、数字或 `-`，并以字母开头、字母或数字结尾。

脚本会：

1. 启用必要 GCP API。
2. 如果 Artifact Registry 仓库不存在，则自动创建。
3. 用 Cloud Build 构建并推送当前仓库镜像。
4. 切换到同名 Terraform workspace。
5. 创建或更新该客户的整套托管资源。
6. 输出公网 Cloud Run URL。

## 常用定制

传额外 Terraform 变量：

```bash
infra/gcp-b2b-new-api/deploy.sh acme \
  --project rezonaai \
  --tf-var sql_tier=db-custom-2-7680 \
  --tf-var redis_memory_size_gb=2 \
  --tf-var web_max_instances=10
```

使用已有镜像，跳过 Cloud Build：

```bash
infra/gcp-b2b-new-api/deploy.sh acme \
  --project rezonaai \
  --image us-east1-docker.pkg.dev/rezonaai/new-api-b2b/new-api:acme-20260609
```

复用已有 VPC/Subnet：

```bash
infra/gcp-b2b-new-api/deploy.sh acme \
  --project rezonaai \
  --tf-var create_network=false \
  --tf-var network_name=rezona-default-vpc \
  --tf-var subnet_name=rz-df-us-east1-subnet \
  --tf-var create_private_service_connection=false
```

如果复用的 VPC 还没有 Private Service Access，把 `create_private_service_connection` 保持为 `true`。

## 状态和密钥

脚本按客户前缀使用 Terraform workspace，本地状态保存在 `infra/gcp-b2b-new-api/terraform.tfstate.d/`，已被 `.gitignore` 忽略。

注意：Terraform state 会包含数据库密码、Redis 连接串和 Secret Manager secret payload。不要提交 state；生产使用时建议配置加密的远端 backend。

## 下线客户

Cloud SQL 默认开启 `sql_deletion_protection=true`。如果确实要销毁某个客户环境，先关闭保护再 destroy：

```bash
cd infra/gcp-b2b-new-api
terraform workspace select acme
IMAGE="$(terraform output -raw deployed_image)"
terraform apply -target=google_sql_database_instance.postgres -var project_id=rezonaai -var region=us-east1 -var name_prefix=acme -var image="${IMAGE}" -var sql_deletion_protection=false
terraform destroy -var project_id=rezonaai -var region=us-east1 -var name_prefix=acme -var image="${IMAGE}"
```

## 首次登录

应用初始化流程仍由 `new-api` 自己完成。首次打开 Cloud Run URL 后，按页面引导完成初始化；如果系统自动创建默认 root 账号，请登录后立即修改默认密码。

## 故障处理

如果 Terraform 报 `oauth2: "invalid_grant" "reauth related error (invalid_rapt)"`，说明 Terraform 使用的 Application Default Credentials 已过期或需要重新认证。重新登录：

```bash
gcloud auth application-default login --project rezonaai
```

如果镜像已经构建成功，不需要重新构建，复用日志里的 image 继续：

```bash
infra/gcp-b2b-new-api/deploy.sh acme \
  --project rezonaai \
  --region us-east1 \
  --image us-east1-docker.pkg.dev/rezonaai/new-api-b2b/new-api:acme-20260609
```
