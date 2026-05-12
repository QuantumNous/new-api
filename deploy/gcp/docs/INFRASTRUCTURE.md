# new-api 生产环境基础设施清单

> 这是 `vocai-gemini-prod` 项目内 new-api 生产环境的资源参考手册。所有资源都由 Terraform 管理（代码位于 `deploy/gcp/`），state 存放在 GCS bucket。

## 项目上下文

| 字段 | 值 |
|---|---|
| GCP 项目名 / ID | `vocai-gemini-prod` |
| 项目编号 (project number) | `528088078482` |
| 结算账户 | `017771-4E540B-88F75B` |
| 区域 | `us-west1`（Oregon） |
| 可用区 | `us-west1-a` |
| 应用代码仓库 | https://github.com/SolveaCX/new-api |
| Cloudflare zone | `flatkey.ai` |

## 拓扑总览

```
                 Internet
                    │
        ┌───────────┴───────────┐
        │  Cloudflare DNS only  │   (new-api.app / new-api.api)
        └───────────┬───────────┘
                    │ A 记录 → 34.54.128.101
                    ▼
        ┌───────────────────────┐
        │  GCP HTTPS LB (443)   │   托管 SSL 证书（newapi-cert）
        │  HTTP→HTTPS 301 (80)  │
        └───────────┬───────────┘
                    │ Serverless NEG
                    ▼
        ┌───────────────────────┐
        │  Cloud Run "newapi"   │   us-west1, min=2 max=10
        │  ingress = ALL        │   timeout 3600s, concurrency 80
        └────────┬──────┬───────┘
                 │      │ Direct VPC Egress (private-ranges-only)
                 │      ▼
                 │   ┌──────────────────────┐
                 │   │  VPC: newapi-vpc     │
                 │   │  Subnet 10.20.0.0/24 │
                 │   └──────┬───────────────┘
                 │          │
                 │          ▼
                 │   ┌──────────────────────┐
                 │   │  Memorystore Redis   │   Basic 1GB
                 │   │  newapi-redis        │
                 │   └──────────────────────┘
                 │
                 │ Unix socket /cloudsql/...
                 ▼
        ┌───────────────────────┐
        │  Cloud SQL MySQL 8.0  │   db-custom-2-4096
        │  newapi-mysql         │   ZONAL, 100GB SSD, PITR 7d
        └───────────────────────┘
```

## 计算

### Cloud Run service `newapi`

| 字段 | 值 |
|---|---|
| Region | `us-west1` |
| URL（直连） | `https://newapi-5qjldqffdq-uw.a.run.app` |
| CPU / Memory | 1 vCPU / 1 GiB |
| Min / Max instances | 2 / 10 |
| Concurrency | 80 |
| Request timeout | 3600 s（兼容长流式响应） |
| CPU 调度 | `cpu_idle=false`、`startup_cpu_boost=true` |
| Ingress | `INGRESS_TRAFFIC_ALL`（计划后续锁到 `INTERNAL_LOAD_BALANCER`） |
| Container port | 3000 |
| Runtime SA | `newapi-runtime@vocai-gemini-prod.iam.gserviceaccount.com` |
| Cloud SQL 挂载 | `volumes.cloud_sql_instance = vocai-gemini-prod:us-west1:newapi-mysql` |
| VPC 接入 | Direct VPC Egress（子网 `newapi-subnet-us-west1`，egress=`PRIVATE_RANGES_ONLY`） |
| Health probe | `tcp_socket :3000` + `http_get /api/status :3000` |

容器环境变量见 `deploy/gcp/modules/cloud-run/main.tf`。敏感值（`SQL_DSN`、`REDIS_CONN_STRING`、`SESSION_SECRET`、`CRYPTO_SECRET`）通过 `value_source.secret_key_ref` 从 Secret Manager 注入，**Terraform state 里看不到明文**。

镜像由 CI/CD 滚动更新；Terraform 的 `lifecycle.ignore_changes` 包含 `template[0].containers[0].image`，所以 `terraform apply` 不会回滚到 placeholder。

## 数据

### Cloud SQL `newapi-mysql`

| 字段 | 值 |
|---|---|
| Connection name | `vocai-gemini-prod:us-west1:newapi-mysql` |
| MySQL 版本 | 8.0 |
| 机型 | `db-custom-2-4096`（2 vCPU / 4 GiB） |
| 存储 | 100 GB SSD，自动扩容启用 |
| Availability | `ZONAL`（单 zone，无 HA） |
| 公网 IP | 启用（仅 Auth Proxy 使用，无 authorized networks） |
| SSL 模式 | `ENCRYPTED_ONLY` |
| 备份 | 每天 11:00 UTC（= 04:00 PT），保留 7 份 |
| Binlog / PITR | 启用，7 天 |
| 维护窗口 | 周日 11:00 UTC，`update_track=stable` |
| Deletion protection | 开启 |

Database flags：
```
max_connections=300
character_set_server=utf8mb4
collation_server=utf8mb4_unicode_ci
transaction_isolation=READ-COMMITTED
slow_query_log=on
long_query_time=1
default_time_zone=+00:00
```

应用 DB：`newapi`；应用用户：`newapi_app`（密码来自 Secret Manager）。

### Memorystore Redis `newapi-redis`

| 字段 | 值 |
|---|---|
| 名称 | `newapi-redis` |
| Tier | `BASIC`（单实例，无 HA） |
| 容量 | 1 GB |
| Redis 版本 | 7.0 |
| Authorized network | `newapi-vpc` |
| Connect mode | `DIRECT_PEERING` |
| 维护窗口 | 周日 11:00 UTC |

Host/port 通过 Terraform output 注入到 `newapi-redis-url` secret，再由 Cloud Run 读取。

## 网络

### VPC `newapi-vpc`

| 字段 | 值 |
|---|---|
| Routing mode | `REGIONAL` |
| 自动子网 | 关 |
| 子网 | `newapi-subnet-us-west1`，CIDR `10.20.0.0/24` |
| Private Google access | 开启 |

### HTTPS Load Balancer

| 资源 | 名称 | 备注 |
|---|---|---|
| 全局静态 IPv4 | `newapi-lb-ip` | **34.54.128.101**（Cloudflare A 记录指向这里） |
| Serverless NEG | `newapi-cr-neg` | us-west1 区域，cloud_run.service=`newapi` |
| Backend service | `newapi-backend` | 协议 HTTPS，无 health check（Serverless NEG 自管） |
| URL map (HTTPS) | `newapi-urlmap` | 默认全部路由到 `newapi-backend` |
| URL map (HTTP) | `newapi-http-redirect` | 301 重定向到 HTTPS |
| Target HTTPS proxy | `newapi-https-proxy` | 绑定 `newapi-cert` |
| Target HTTP proxy | `newapi-http-proxy` | 绑定 `newapi-http-redirect` |
| Global forwarding rule (443) | `newapi-https-fwd` | `EXTERNAL_MANAGED` |
| Global forwarding rule (80) | `newapi-http-fwd` | 触发重定向 |

### SSL 证书

| 字段 | 值 |
|---|---|
| 名称 | `newapi-cert` |
| 类型 | Google-managed |
| 覆盖域名 | `new-api.app.flatkey.ai`、`new-api.api.flatkey.ai` |
| 自动续期 | 是 |

查询状态：
```bash
gcloud compute ssl-certificates describe newapi-cert --global \
  --format="value(managed.status,managed.domainStatus)"
```

## 镜像仓库

| 字段 | 值 |
|---|---|
| 仓库 ID | `newapi` |
| 仓库 URL | `us-west1-docker.pkg.dev/vocai-gemini-prod/newapi` |
| 格式 | Docker |
| 清理策略 | 保留最近 50 个版本；untagged 7 天后删除 |

CI/CD 推到的镜像 tag：
- `:sha-<short_sha>`（每次 push 都打）
- `:main-latest`（main 分支最新）
- `:v<x.y.z>`（仅在打 tag 触发时）

## 密钥

### Secret Manager

| Secret ID | 类型 | 由谁写入 |
|---|---|---|
| `newapi-db-app-password` | 32 字节随机 | Terraform `random_password` |
| `newapi-session-secret` | 48 字节随机 | Terraform `random_password` |
| `newapi-crypto-secret` | 48 字节随机 | Terraform `random_password` |
| `newapi-initial-token` | 48 字节随机 | Terraform `random_password` |
| `newapi-sql-dsn` | 完整 DSN 字符串 | Terraform 拼装后写入 |
| `newapi-redis-url` | `redis://host:port/0` | Terraform 拼装后写入 |
| `newapi-github-client-id` | 空占位 | 运维手动 `gcloud secrets versions add` |
| `newapi-github-client-secret` | 空占位 | 运维手动 |
| `newapi-stripe-secret-key` | 空占位 | 运维手动 |

`replication = auto`（Google 多区域副本）。Cloud Run 运行时 SA 持有这些 secret 的 `roles/secretmanager.secretAccessor`。

## 身份与权限

### Service Accounts

| 邮箱 | 用途 | 关键权限 |
|---|---|---|
| `newapi-runtime@vocai-gemini-prod.iam.gserviceaccount.com` | Cloud Run revision 运行时身份 | `cloudsql.client`、`logging.logWriter`、`monitoring.metricWriter`、`cloudtrace.agent`、6 个 secret 的 `secretAccessor` |
| `newapi-ci-deployer@vocai-gemini-prod.iam.gserviceaccount.com` | GitHub Actions 通过 WIF 假装为它 | `run.developer`、`artifactregistry.writer`、`iam.serviceAccountUser`（给 runtime SA） |

### Workload Identity Federation

| 字段 | 值 |
|---|---|
| Pool ID | `github-actions` |
| Provider | `github` |
| Provider resource name | `projects/528088078482/locations/global/workloadIdentityPools/github-actions/providers/github` |
| Issuer | `https://token.actions.githubusercontent.com` |
| Attribute condition | `assertion.repository == 'SolveaCX/new-api'` |
| 绑定 | deployer SA 上挂 `principalSet://.../attribute.repository/SolveaCX/new-api` 的 `roles/iam.workloadIdentityUser` |

**没有任何 service account JSON 密钥被创建或下载**。

## 域名

| FQDN | DNS 记录 | Cloudflare Proxy |
|---|---|---|
| `new-api.app.flatkey.ai` | A → `34.54.128.101` | DNS only（灰云，证书签发期间） |
| `new-api.api.flatkey.ai` | A → `34.54.128.101` | DNS only |

证书签好后可考虑翻成 Proxied（橙云）拿 Cloudflare WAF/缓存，配合 GCP LB Cloud Armor 白名单 Cloudflare IP 段进一步收紧。

## 监控

| 资源 | 名称 |
|---|---|
| Uptime check | `new-api-api-status-PpeCuNMssAs`（探测 `https://new-api.app.flatkey.ai/api/status`） |
| 通知通道 | 暂无（`alert_email` 为空，不创建邮件告警策略） |

Cloud Logging 自动收集 Cloud Run / Cloud SQL / LB 全部日志；slow query log 来自 Cloud SQL flag，自动收。

## 状态文件

| 字段 | 值 |
|---|---|
| Bucket | `gs://vocai-gemini-prod-newapi-tfstate` |
| Location | `us-west1` |
| Public access | `enforced`（禁止公网访问） |
| Uniform bucket-level access | 启用 |
| Soft delete | 7 天（GCS 默认，足够防误删） |
| Versioning / Lifecycle | 未启用（`partner@solvea.cx` 缺 `storage.buckets.update` 权限；后续可由组织管理员开启） |
| 加密 | Google-managed key（默认） |

state prefix：`envs/prod`，所以完整路径是 `gs://vocai-gemini-prod-newapi-tfstate/envs/prod/default.tfstate`。

## 月度成本估算

| 项 | 月费用 |
|---|---|
| Cloud Run（min=2 + 流量） | $50–80 |
| Cloud SQL `db-custom-2-4096` + 100GB SSD | ~$99 |
| Memorystore Redis Basic 1GB | ~$35 |
| HTTPS LB 转发规则 + 静态 IP | ~$22 |
| Artifact Registry + 日志 + 监控 | ~$10 |
| **合计** | **~$215–245** |

跨 region 流量、Egress 到客户端等按量项目额外。

## 已知限制 & 未完成事项

1. **缺 `roles/run.admin`**：`partner@solvea.cx` 没有 `run.domainmappings.create`，所以走 LB 不走域名映射；后续拿到权限可以切回域名映射，省 ~$22/月 LB 费用。
2. **缺 `roles/storage.admin` 在 state bucket 上**：deployer SA 暂时没法用 `gcp-infra.yml` workflow 跑 `terraform plan`。基础设施变更目前由运维本地 `terraform apply` 执行。组织管理员可以在 state bucket 加 `roles/storage.objectUser` 给 deployer SA 解决。
3. **Cloud SQL 单区域**：节省成本但是单点故障。要 HA 改 `availability_type = "REGIONAL"`，在线升级，不停机。
4. **Memorystore Basic 单实例**：同理，要 HA 升级到 Standard tier（多 ~$35/月）。
5. **静态出口 IP 未开**：如果某个上游 AI 服务要白名单出口 IP，需要加 Cloud NAT + 保留 IP（~$15/月）。
6. **Cloud Run ingress 暂为 ALL**：意味着 `*.run.app` 直连可达（虽然不曝光）。证书签好且 LB 稳定后可锁到 `INTERNAL_LOAD_BALANCER`。

## 升级路径

| 想做的事 | 改什么 | 是否停机 |
|---|---|---|
| Cloud SQL 加 HA | `availability_type=REGIONAL` | 否 |
| Redis 加 HA | tier 改 `STANDARD_HA` | 否（自动重建？需要规划） |
| Cloud SQL 扩容 CPU/RAM | 改 `tier` | 是（1-2 分钟重启） |
| 加只读 DB 副本 | 新 `google_sql_database_instance.replica` 资源 | 否 |
| 加多 region 容灾 | 启用 `staging` 环境到 us-central1 + Cloud Run multi-region | 否 |
| 开启 Cloud Armor WAF | 新 `google_compute_security_policy` 资源，绑 backend service | 否 |
| 锁 ingress 到 LB only | tfvars 改 `cloud_run_ingress = "INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER"` | 否 |
