# new-api 生产环境基础设施清单

> 这是 `vocai-gemini-prod` 项目内 new-api 生产环境的资源参考手册。所有 GCP 基础设施由 Terraform 管理（代码位于 `deploy/gcp/`），state 存放在 GCS bucket。操作前先读 `OPERATIONS.md`，发布和回滚步骤见 `DEPLOYMENT.md`。

## 项目上下文

| 字段 | 值 |
|---|---|
| GCP 项目名 / ID | `vocai-gemini-prod` |
| 项目编号 | `528088078482` |
| 区域 | `us-west1`（Oregon） |
| 可用区 | `us-west1-a` |
| 应用代码仓库 | `https://github.com/SolveaCX/new-api` |
| Cloudflare zone | `flatkey.ai` |
| LB 静态 IP | `34.54.128.101` |

## 当前生产拓扑

```text
Internet
  |
  +-- Cloudflare DNS/Proxy
        |
        | flatkey.ai / www.flatkey.ai       Proxied
        | console.flatkey.ai                Proxied
        | router.flatkey.ai                 DNS only
        v
  GCP global HTTPS LB newapi-https-fwd (34.54.128.101)
        |
        +-- host flatkey.ai,www.flatkey.ai -> backend newapi-web-backend
        |      -> Cloud Run newapi-web (Next.js website, port 4000)
        |
        +-- host console.flatkey.ai -> backend newapi-console-backend
        |      -> Cloud Run newapi-console (Go app, NODE_TYPE=master, APP_ROLE=console)
        |
        +-- host router.flatkey.ai -> backend newapi-router-backend
        |      -> Cloud Run newapi-router (Go app, NODE_TYPE=slave, APP_ROLE=router)
        |
        +-- default -> backend newapi-console-backend
               -> Cloud Run newapi-console (fallback for unmatched hosts)

All Go services share Cloud SQL, Redis, Secret Manager, runtime SA, and VPC egress.
```

当前 URL map 应满足：

```yaml
defaultService: .../backendServices/newapi-console-backend
hostRules:
- hosts: [flatkey.ai, www.flatkey.ai]
  pathMatcher: website
- hosts: [console.flatkey.ai]
  pathMatcher: console
- hosts: [router.flatkey.ai]
  pathMatcher: router
pathMatchers:
- name: website
  defaultService: .../backendServices/newapi-web-backend
- name: console
  defaultService: .../backendServices/newapi-console-backend
- name: router
  defaultService: .../backendServices/newapi-router-backend
```

验证命令：

```bash
gcloud compute url-maps describe newapi-urlmap \
  --project=vocai-gemini-prod --global \
  --format='yaml(hostRules,pathMatchers,defaultService)'
```

## 计算

### Cloud Run services

| Service | 角色 | 入口 | NODE_TYPE / APP_ROLE | Min / Max | Concurrency | 端口 |
|---|---|---|---|---|---|---|
| `newapi-web` | 独立 Next.js 官网 | `flatkey.ai`, `www.flatkey.ai` | n/a | Terraform 管理 | 80 | 4000 |
| `newapi-console` | 控制台、后台 API、高频发布目标 | `console.flatkey.ai` | `master` / `console` | 1 / 5 | 80 | 3000 |
| `newapi-router` | 模型调用、relay、长流式请求 | `router.flatkey.ai` | `slave` / `router` | 4 / 20 | 60 | 3000 |

Go 服务共同配置：

| 字段 | 值 |
|---|---|
| Region | `us-west1` |
| CPU / Memory | console: 1 vCPU / 1 GiB；router: 1 vCPU / 2 GiB |
| Request timeout | 3600s（兼容长流式响应） |
| Runtime SA | `newapi-runtime@vocai-gemini-prod.iam.gserviceaccount.com` |
| Cloud SQL 挂载 | `vocai-gemini-prod:us-west1:newapi-mysql` |
| VPC 接入 | Direct VPC Egress，子网 `newapi-subnet-us-west1` |
| Health probe | TCP `:3000` + HTTP `/api/status`（Go）；website 由容器端口 4000 服务 |

CI/CD 拥有镜像、revision、traffic 和运行时 env；Terraform 对这些字段做 `lifecycle.ignore_changes`。不要用 Terraform 去回滚应用镜像。

直连 URL 示例：

```bash
gcloud run services describe newapi-console --project=vocai-gemini-prod --region=us-west1 --format='value(status.url)'
gcloud run services describe newapi-router  --project=vocai-gemini-prod --region=us-west1 --format='value(status.url)'
gcloud run services describe newapi-web     --project=vocai-gemini-prod --region=us-west1 --format='value(status.url)'
```

## 数据层

### Cloud SQL `newapi-mysql`

| 字段 | 值 |
|---|---|
| Connection name | `vocai-gemini-prod:us-west1:newapi-mysql` |
| MySQL 版本 | 8.0 |
| 机型 | `db-custom-4-16384`（4 vCPU / 16 GiB） |
| 存储 | 100 GB SSD，自动扩容启用 |
| Availability | `ZONAL`（单 zone，无 HA） |
| SSL 模式 | `ENCRYPTED_ONLY` |
| 备份 | 每天 11:00 UTC，保留 7 份 |
| Binlog / PITR | 启用，7 天 |
| Deletion protection | 开启 |

Database flags:

```text
max_connections=300
character_set_server=utf8mb4
collation_server=utf8mb4_unicode_ci
transaction_isolation=READ-COMMITTED
slow_query_log=on
long_query_time=1
default_time_zone=+00:00
```

所有 Go 节点共享同一个 DB。生产是多节点：涉及初始化、缓存、任务、计费、quota、token/key 写入的代码必须跨实例安全。

### Memorystore Redis `newapi-redis`

| 字段 | 值 |
|---|---|
| Tier | `BASIC`（单实例，无 HA） |
| 容量 | 1 GB |
| Redis 版本 | 7.0 |
| Authorized network | `newapi-vpc` |
| Connect mode | `DIRECT_PEERING` |

## 网络与负载均衡

### VPC

| 字段 | 值 |
|---|---|
| VPC | `newapi-vpc` |
| Subnet | `newapi-subnet-us-west1`, CIDR `10.20.0.0/24` |
| Private Google access | 开启 |

### HTTPS Load Balancer

| 资源 | 名称 | 说明 |
|---|---|---|
| 全局静态 IPv4 | `newapi-lb-ip` | `34.54.128.101` |
| URL map (HTTPS) | `newapi-urlmap` | host-based routing |
| URL map (HTTP) | `newapi-http-redirect` | HTTP 301 到 HTTPS |
| Target HTTPS proxy | `newapi-https-proxy` | 绑定 Google-managed cert |
| Backend service | `newapi-web-backend` | `newapi-web` |
| Backend service | `newapi-console-backend` | `newapi-console` |
| Backend service | `newapi-router-backend` | `newapi-router` |
| Serverless NEG | `newapi-web-cr-neg` | Cloud Run `newapi-web` |
| Serverless NEG | `newapi-console-cr-neg` | Cloud Run `newapi-console` |
| Serverless NEG | `newapi-router-cr-neg` | Cloud Run `newapi-router` |

## TLS 与域名

### GCP managed certificate

`lb_domains` 当前包含：

- `new-api.app.flatkey.ai`
- `new-api.api.flatkey.ai`
- `one.flatkey.ai`
- `router.flatkey.ai`

`router.flatkey.ai` 由 GCP managed cert 覆盖，因此 Cloudflare 可以保持 DNS only，由 Google LB 终结 TLS。

`console.flatkey.ai` 和 `flatkey.ai` / `www.flatkey.ai` 不在 `lb_domains`，依赖 Cloudflare Proxied 的边缘证书，再回源到 GCP LB。这样避免修改 `lb_domains` 触发 managed cert rotation 的 HTTPS 窗口。

查询状态：

```bash
gcloud compute ssl-certificates describe newapi-cert-4dc684 \
  --project=vocai-gemini-prod --global \
  --format='yaml(name,managed.status,managed.domainStatus)'
```

> 注意：`lb_domains` 任意变更都会重建 managed cert。新证书从 `PROVISIONING` 到 `ACTIVE` 前，相关 HTTPS 流量可能出现 TLS 握手失败。详见 `OPERATIONS.md`。

### Cloudflare DNS

| FQDN | 记录 | Proxy 模式 | 后端 |
|---|---|---|---|
| `flatkey.ai` | A -> `34.54.128.101` | Proxied | `newapi-web` |
| `www.flatkey.ai` | A/CNAME -> LB | Proxied | `newapi-web` |
| `console.flatkey.ai` | A -> `34.54.128.101` | Proxied | `newapi-console` |
| `router.flatkey.ai` | A -> `34.54.128.101` | DNS only | `newapi-router` |
| `new-api.app.flatkey.ai` | A -> `34.54.128.101` | DNS only | default -> `newapi-console` |
| `new-api.api.flatkey.ai` | A -> `34.54.128.101` | DNS only | default -> `newapi-console` |
| `one.flatkey.ai` | A -> `34.54.128.101` | DNS only | default -> `newapi-console` |

Cloudflare 显示 “origin IP partially exposed” 是当前混合模式的预期现象：同一个 LB IP 同时有 Proxied 和 DNS-only 记录。

## 镜像仓库

| 字段 | 值 |
|---|---|
| 仓库 ID | `newapi` |
| 仓库 URL | `us-west1-docker.pkg.dev/vocai-gemini-prod/newapi` |
| 格式 | Docker |
| 清理策略 | 保留最近 50 个版本；untagged 7 天后删除 |

Go app 和 website 使用不同 workflow / image target：

- Go app：`.github/workflows/gcp-deploy.yml`
- Website：`.github/workflows/gcp-deploy-website.yml`

## 密钥

### Secret Manager

| Secret ID | 类型 | 由谁写入 |
|---|---|---|
| `newapi-db-app-password` | DB 用户密码 | Terraform `random_password` |
| `newapi-session-secret` | session secret | Terraform `random_password` |
| `newapi-crypto-secret` | crypto secret | Terraform `random_password` |
| `newapi-initial-token` | 初始 token | Terraform `random_password` |
| `newapi-sql-dsn` | 完整 DSN | Terraform 拼装后写入 |
| `newapi-redis-url` | Redis URL | Terraform 拼装后写入 |
| `newapi-blockrun-usage-summary-token` | 用量对账 Bearer token | 运维写入值，Terraform 管理 secret |
| `newapi-github-client-id` | 占位 | 运维手动 |
| `newapi-github-client-secret` | 占位 | 运维手动 |
| `newapi-stripe-secret-key` | 占位 | 运维手动 |

Cloud Run 运行时 SA 持有这些 secret 的 `roles/secretmanager.secretAccessor`。密钥值不应进入仓库或 Terraform state 明文。

## 身份与权限

| 邮箱 | 用途 | 关键权限 |
|---|---|---|
| `newapi-runtime@vocai-gemini-prod.iam.gserviceaccount.com` | Cloud Run revision 运行时身份 | `cloudsql.client`、`logging.logWriter`、`monitoring.metricWriter`、`cloudtrace.agent`、secret accessor |
| `newapi-ci-deployer@vocai-gemini-prod.iam.gserviceaccount.com` | GitHub Actions WIF deployer | `run.developer`、`artifactregistry.writer`、`iam.serviceAccountUser` |

WIF provider：

```text
projects/528088078482/locations/global/workloadIdentityPools/github-actions/providers/github
```

Attribute condition 必须限定：

```text
assertion.repository == 'SolveaCX/new-api'
```

## 监控

| 类型 | 资源 |
|---|---|
| Uptime check | `new-api-api-status-*` |
| Cloud Run logs | `resource.type="cloud_run_revision"` |
| LB logs | `resource.type="http_load_balancer"` |
| Cloud SQL logs | `resource.type="cloudsql_database"` |

Terraform creates the uptime check and alert policies only when `alert_emails`
or legacy `alert_email` is set in `deploy/gcp/envs/prod/terraform.tfvars`.
Covered alert families:
uptime failure, router instances near maxScale, router pending queue, router
5xx spikes, and Redis CPU.

Alert thresholds in Terraform:

| Alert | Metric | Default threshold |
|---|---|---|
| `new-api uptime failed` | `monitoring.googleapis.com/uptime_check/check_passed` | failed for 5 minutes |
| `new-api router instances near max` | `run.googleapis.com/container/instance_count` | > 90% of `router_max_instances` for 5 minutes |
| `new-api router pending requests` | `run.googleapis.com/pending_queue/pending_requests` | > 5 pending requests for 5 minutes |
| `new-api router 5xx spike` | `run.googleapis.com/request_count` (`5xx`) | > 100 5xx responses per 5 minutes |
| `new-api Redis CPU high` | `redis.googleapis.com/stats/cpu_utilization` | > 80% for 5 minutes |

To enable email alerts, set:

```hcl
alert_emails = [
  "ops@example.com",
  "dev@example.com",
]
```

Then run a local Owner-credentialed `terraform plan` and apply only after
reviewing the Monitoring resources. The CI infra plan/apply workflow is not a
trusted source of truth yet; see `OPERATIONS.md`.

生产分流验证常用日志：

```bash
gcloud logging read \
  'resource.type="http_load_balancer" AND resource.labels.backend_service_name="newapi-console-backend"' \
  --project=vocai-gemini-prod --freshness=10m --limit=100 --format=json

gcloud logging read \
  'resource.type="http_load_balancer" AND resource.labels.backend_service_name="newapi-router-backend"' \
  --project=vocai-gemini-prod --freshness=10m --limit=100 --format=json
```

## Terraform state

| 字段 | 值 |
|---|---|
| Bucket | `gs://vocai-gemini-prod-newapi-tfstate` |
| Prefix | `envs/prod` |
| Working directory | `deploy/gcp/envs/prod/` |

## 月度成本估算

| 项 | 月费用 |
|---|---|
| Cloud Run Go services（router 4 min / 20 max, 2 GiB + console 1 min + 流量） | 随流量浮动，通常高于旧 1 GiB/10 max 配置 |
| Cloud Run website | 按流量，低基线 |
| Cloud SQL `db-custom-4-16384` + 100GB SSD | 高于旧 2 vCPU / 4 GiB 配置，按 GCP 实时报价核算 |
| Memorystore Redis Basic 1GB | ~$35 |
| HTTPS LB 转发规则 + 静态 IP | ~$22 |
| Artifact Registry + 日志 + 监控 | ~$10+ |

实际费用会随请求量、日志量、egress 和 min instance 调整变化。

## 已知限制 & 未完成事项

1. **CI Terraform plan/apply IAM 不完整**：`gcp-infra.yml` 的 plan/apply 不能作为唯一依据；本地 Owner ADC 的 `terraform plan` 才是当前生产 infra 变更的可信来源。详见 `OPERATIONS.md`。
2. **Cloud SQL 单区域**：节省成本但不是 HA。升级为 `REGIONAL` 需要单独规划。
3. **Memorystore Basic 单实例**：Redis 不是 HA。
4. **Cloud Run ingress 暂为 ALL**：`*.run.app` 直连仍可达。锁到 `INTERNAL_LOAD_BALANCER` 前要确认 CI/CD 健康检查路径和回滚路径。
5. **legacy `newapi` 已关闭**：`enable_legacy_runtime=false`，URL map default backend 当前指向 `newapi-console-backend`。回滚 host_rule 不再等价于回到 legacy 服务。
6. **Cloudflare 混合模式**：`console`/website Proxied，`router` DNS-only。不要为了消除 Cloudflare warning 直接切换 proxy 模式；先评估 TLS 与证书覆盖。

## 升级路径

| 想做的事 | 改什么 | 是否停机 / 风险 |
|---|---|---|
| Cloud SQL 加 HA | `availability_type=REGIONAL` | 通常在线，仍需维护窗口 |
| Redis 加 HA | tier 改 `STANDARD_HA` | 需要规划重建/迁移 |
| 开启 Cloud Armor WAF | 新 `google_compute_security_policy`，绑 backend service | 通常不停机，规则误伤风险 |
| 锁 Cloud Run ingress 到 LB only | `cloud_run_ingress = "INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER"` | 通常不停机，但会影响 `*.run.app` 直连 |
| 恢复 legacy `newapi` | `enable_legacy_runtime=true` 并重新规划 default backend | 高风险，必须先看 LB 日志和镜像/env 一致性 |
