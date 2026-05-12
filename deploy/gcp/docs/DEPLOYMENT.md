# new-api 发布与部署手册

> 这份文档是 SolveaCX/new-api 应用发布到 `vocai-gemini-prod` 项目的操作指南。基础设施清单见 `INFRASTRUCTURE.md`。

## 系统总览

```
push main ──► Build (GitHub Actions)
                │
                ▼
            构建 Docker 镜像
                │
                ▼
            推 Artifact Registry
                │
                ▼
         Deploy job 卡审批 ◄──┐
                │             │
       slZhong 在 GitHub      │
       网页点 Approve         │
                │             │
                ▼             │
       新 revision 创建        │
       （不接流量）           │
                │             │
                ▼             │
       健康检查 /api/status   │
                │             │
                ▼             │
       金丝雀 10%（3 分钟）   │
                │             │
                ▼             │
       切 100% 流量            │
                │             │
                ▼             │
       老 revision drain      │
       并最终回收             │
                │             │
                └─►  完成 ────┘
```

## 日常发布

### 触发方式

1. **自动**：push 到 `main` 分支
2. **手动**：GitHub → Actions → `GCP Deploy` → Run workflow（可选 `image_tag` 指定已有镜像 tag，跳过构建直接部署）

### 完整步骤

1. **本地开发**：在 feature 分支改代码 → 开 PR → CI 跑 `PR Check` 等 → 合并到 `main`
2. **Build job 自动跑**（5–10 分钟）：
   - WIF auth → 短期 token
   - `docker buildx build --platform=linux/amd64`（Cloud Run 仅支持 x86）
   - push 三个 tag：`:sha-<commit>`、`:main-latest`，tag 触发时还多打 `:v<x.y.z>`
3. **Deploy job 卡在审批**：
   - GitHub 在 `production` Environment 下挂起，邮件通知 reviewer（仅 `slZhong`）
   - Reviewer 打开 run page → Review deployments → Approve
4. **Deploy job 执行**（2–4 分钟）：
   - 创建新 revision，flag `--no-traffic`，加 tag `canary`
   - 通过 tag URL（`canary---newapi-xxxxx.run.app`）健康检查 `/api/status`，最多 30 次每次 5 秒
   - 切 10% 流量给新 revision，sleep 180 秒
   - 切 100% 给新 revision
   - 输出 Step Summary 显示新 revision 名 + 镜像 URI

期间老 revision 持续服务，**用户无感**。

### 验证发布成功

```bash
# 1. 当前活跃 revision
gcloud run services describe newapi --region=us-west1 \
  --format="value(status.latestReadyRevisionName,status.url)"

# 2. 当前镜像
gcloud run revisions describe <revision-name> --region=us-west1 \
  --format="value(spec.containers[0].image)"

# 3. 实时流量分配
gcloud run services describe newapi --region=us-west1 \
  --format="value(status.traffic[].percent,status.traffic[].revisionName)"

# 4. 直连健康检查
curl -sS https://newapi-5qjldqffdq-uw.a.run.app/api/status

# 5. 走 LB 健康检查（证书 ACTIVE 后）
curl -sS https://new-api.api.flatkey.ai/api/status
```

## 回滚

### 紧急回滚到上一个 revision

```bash
# 列最近 5 个 revision
gcloud run revisions list --service=newapi --region=us-west1 --limit=5

# 切 100% 流量
gcloud run services update-traffic newapi --region=us-west1 \
  --to-revisions=<old-revision-name>=100
```

切流量耗时约 10 秒。

### 通过 GitHub Actions 回滚（推荐，留痕迹）

1. GitHub → Actions → `GCP Rollback` → Run workflow
2. 输入要回滚到的 revision 名（从 `gcloud run revisions list` 拿）
3. 同样卡审批 → Approve → 切流量

Cloud Run 无限期保留历史 revision，**永远可以回到任意旧版**。

## 基础设施变更

### 改 Cloud Run 配置 / 加 secret / 改 DB flag / 等

1. 在 `deploy/gcp/` 目录改 Terraform 代码
2. 本地：
   ```bash
   cd deploy/gcp/envs/prod
   terraform plan -out=tfplan       # review 输出
   terraform apply tfplan
   ```
3. PR 合并后 `gcp-infra` workflow 会自动跑 plan（如果 deployer SA 已被授予 state bucket 读权限），把 plan diff 评论到 PR 上方便 review

### 升级 Cloud SQL 到 HA

```hcl
# modules/cloud-sql/main.tf
availability_type = "REGIONAL"  // 原 ZONAL
```

`terraform apply` 在线升级，GCP 自动起 standby，不停机。月成本约 +$100。

### 添加新的 Secret（OAuth 配置之类）

1. 在 `modules/secrets/main.tf` 的 `placeholder_secrets` 输入里加新条目，或者直接在根模块加
2. `terraform apply` 创建空 secret
3. 手动写入值：
   ```bash
   echo -n "<value>" | gcloud secrets versions add <secret-id> --data-file=-
   ```
4. 在 `modules/cloud-run/main.tf` 加 `env { value_source.secret_key_ref }`
5. `terraform apply` 让 Cloud Run revision 注入新 env
6. 在 `service_accounts.runtime_secret_ids` 列表里加上新 secret（让 runtime SA 有读权限）

## DNS 与 TLS

### 证书自动续期

`google_compute_managed_ssl_certificate` 由 GCP 自动续期，60 天到期前自动签新证书。**不需要手动操作**。

### 添加新域名（如 `new-api-cn.flatkey.ai`）

1. 在 `terraform.tfvars` 的 `lb_domains` 加新条目
2. `terraform apply` 会**重建证书**（lifecycle.create_before_destroy 保证不停机）
3. 在 Cloudflare 加 A 记录指向 `34.54.128.101`，先 DNS only
4. 等证书 `ACTIVE`（10-60 分钟）
5. 测试通过后可翻成 Cloudflare Proxied

### 删除域名

1. 从 `lb_domains` 移除
2. `terraform apply`
3. Cloudflare 删 DNS 记录

### 把 Cloudflare 切到 Proxied 模式

1. Cloudflare DNS → 把记录的橙云打开
2. SSL/TLS → Overview → 选 **Full (strict)**（验证 origin 证书；Google-managed 证书是真证书，能通过验证）
3. （可选）在 GCP 上加 Cloud Armor 只放行 Cloudflare 出口 IP 段（https://www.cloudflare.com/ips-v4 ） 防止源站被绕过

## 密钥与凭据管理

### 轮换数据库密码

1. 在 Secret Manager 加新版本：
   ```bash
   echo -n "<new-password>" | gcloud secrets versions add newapi-db-app-password --data-file=-
   ```
2. 改 Cloud SQL 用户密码：
   ```bash
   gcloud sql users set-password newapi_app --host=% \
     --instance=newapi-mysql --password='<new-password>'
   ```
3. 也同步刷新派生的 `newapi-sql-dsn` secret（DSN 里嵌了密码）：
   ```bash
   DSN="newapi_app:<new-password>@unix(/cloudsql/vocai-gemini-prod:us-west1:newapi-mysql)/newapi?parseTime=true&charset=utf8mb4&loc=UTC"
   echo -n "$DSN" | gcloud secrets versions add newapi-sql-dsn --data-file=-
   ```
4. 重启 Cloud Run revision 让它拉新 secret 版本：
   ```bash
   gcloud run services update newapi --region=us-west1 \
     --update-secrets="SQL_DSN=newapi-sql-dsn:latest"
   ```

> 注意：Cloud Run 用 `version=latest` 时，**只在新 revision 启动时**读 secret，不会热重载。重启才能生效。

### 轮换 SESSION_SECRET / CRYPTO_SECRET

类似流程：用 `gcloud secrets versions add` 写入新值，然后重启 Cloud Run。**但注意业务影响**：

- `SESSION_SECRET` 改了 → 用户全部登出
- `CRYPTO_SECRET` 改了 → 历史加密数据可能解密失败（取决于 new-api 内部用法）

变更前评估好场景。

### 填占位 secret（OAuth / Stripe）

```bash
# GitHub OAuth
echo -n "<client-id>" | gcloud secrets versions add newapi-github-client-id --data-file=-
echo -n "<client-secret>" | gcloud secrets versions add newapi-github-client-secret --data-file=-

# Stripe
echo -n "<sk-live-...>" | gcloud secrets versions add newapi-stripe-secret-key --data-file=-
```

写入后再去 `modules/cloud-run/main.tf` 加 env 注入，`terraform apply`。

## 故障排查

### 1. WIF 401/403（GitHub Actions Auth 步骤失败）

```
Error: google-github-actions/auth failed with: failed to retrieve OIDC token
```

或：
```
permission denied for principal: principal://...
```

检查：
- GH repo Settings → Secrets/Variables 里 `GCP_WIF_PROVIDER` 是不是完整路径 `projects/528088078482/locations/global/workloadIdentityPools/github-actions/providers/github`
- WIF provider 的 `attribute_condition` 是否 `assertion.repository == 'SolveaCX/new-api'`（仓库名必须完全匹配）
- deployer SA 上有 `roles/iam.workloadIdentityUser` 绑定到 `principalSet://...attribute.repository/SolveaCX/new-api`

诊断命令：
```bash
gcloud iam service-accounts get-iam-policy newapi-ci-deployer@vocai-gemini-prod.iam.gserviceaccount.com
```

### 2. Cloud Run 健康检查失败

```
Error: revision unhealthy after 30 attempts
```

可能原因：
- 镜像启动失败 → 看 Cloud Logging：
  ```bash
  gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=newapi" --limit=50 --order=desc
  ```
- DB 连接失败 → 检查 SQL_DSN secret，Cloud SQL 实例状态：
  ```bash
  gcloud sql instances describe newapi-mysql --format="value(state)"
  ```
- Redis 不通 → 检查 VPC egress 设置和 Memorystore status

健康检查失败 = Cloud Run 自动拒绝该 revision，**不会切流量**。老 revision 仍在跑。

### 3. 流式请求 504 超时

Cloud Run timeout 设为 3600s（1 小时），单请求超过会被切。检查：
- 上游 AI 提供商响应时间
- new-api 配置 `STREAMING_TIMEOUT`（默认 300s，超时后认为流挂掉）

### 4. Cloud SQL 连接耗尽（`Too many connections`）

每个 Cloud Run 实例的连接池上限来自 env：
- `SQL_MAX_OPEN_CONNS=20`（默认配置）
- `SQL_MAX_IDLE_CONNS=5`
- `SQL_MAX_LIFETIME=60s`

10 实例 × 20 = 200 连接，DB `max_connections=300` 留 100 余量。

如果还是耗尽：
- 是否有连接泄漏？查 Cloud SQL → Insights → Active connections
- 暂时扩容：DB flag `max_connections` 调到 500，再 `terraform apply`

### 5. SSL 证书一直 PROVISIONING

```bash
gcloud compute ssl-certificates describe newapi-cert --global \
  --format="value(managed.status,managed.domainStatus)"
```

如果 `domainStatus` 一直显示 `FAILED_NOT_VISIBLE`：
- 检查 Cloudflare DNS 是否解析到 `34.54.128.101`（用 `dig @8.8.8.8` 验证全球解析）
- 确认 Cloudflare 是 **DNS only**（灰云）。Proxied 会让 Google 看到 Cloudflare 的 IP，验证失败
- 给 24 小时，DNS 全球收敛需要时间

### 6. CI/CD build 失败

```bash
gh run list --repo SolveaCX/new-api --workflow gcp-deploy.yml --limit 5
gh run view <run-id> --log-failed
```

常见原因：
- Dockerfile bun lockfile 不一致 → 本地 `cd web/default && bun install` 重新生成 lock
- 镜像太大或构建太慢 → 检查 buildx cache（`type=gha`）是否命中

## Cloud Run revision 管理

### 列出最近 N 个 revision

```bash
gcloud run revisions list --service=newapi --region=us-west1 --limit=20
```

### 删除老 revision

Cloud Run 无限期保留，但配置项默认上限 1000 个 revision。手动删：

```bash
gcloud run revisions delete <revision-name> --region=us-west1
```

**不要删当前接流量的 revision**。

### 给 revision 加 tag 用于 A/B 测试

```bash
gcloud run services update-traffic newapi --region=us-west1 \
  --update-tags=experiment=<revision-name>
```

访问 URL：`https://experiment---newapi-5qjldqffdq-uw.a.run.app`

### 主动扩缩容（绕过 min/max 临时调）

```bash
# 临时把 min 调到 5（高峰前）
gcloud run services update newapi --region=us-west1 --min-instances=5

# 完事后调回
gcloud run services update newapi --region=us-west1 --min-instances=2
```

或者直接改 `terraform.tfvars`（如果有此项 var）+ `terraform apply`，让变更进入版本控制。

## 监控

### 实时日志

```bash
# Cloud Run
gcloud logging tail "resource.type=cloud_run_revision AND resource.labels.service_name=newapi"

# Cloud SQL slow query
gcloud logging read 'resource.type=cloudsql_database AND severity>=WARNING' --limit=20

# LB access log
gcloud logging read 'resource.type=http_load_balancer AND resource.labels.forwarding_rule_name=newapi-https-fwd' --limit=20
```

### Uptime check 状态

控制台：Monitoring → Uptime checks → `new-api /api/status`

后续要加邮件 / Slack / 钉钉通知：
1. 改 `terraform.tfvars` 的 `alert_email`（启用现有邮件通道）
2. 或者加 `google_monitoring_notification_channel` 资源（Slack / Webhook）

## 紧急联系链

| 谁 | 何事 |
|---|---|
| GCP 组织管理员 | 申请 `roles/run.admin`（解锁域名映射，省 LB 费用） |
| GCP 组织管理员 | 给 deployer SA 加 state bucket `roles/storage.objectUser`（解锁 PR 自动 plan） |
| Cloudflare 账号持有人 | DNS 改动、SSL 模式切换、加 Cloud Armor 白名单 IP |
| `slZhong` | GitHub Actions 部署审批 |

## 附录：常用一行命令

```bash
# 当前活跃 revision + 流量分配
gcloud run services describe newapi --region=us-west1 \
  --format="table(status.traffic[].revisionName,status.traffic[].percent,status.traffic[].tag)"

# 镜像列表
gcloud artifacts docker images list us-west1-docker.pkg.dev/vocai-gemini-prod/newapi/server --limit=10 --sort-by=~UPDATE_TIME

# Cloud SQL CPU/连接监控
gcloud sql instances describe newapi-mysql --format="value(state,settings.tier,currentDiskSize)"

# Redis 连接测试（从 Cloud Run 内）
# (在 Cloud Run 容器里 exec 一下 redis-cli)

# 强制重启 Cloud Run（无需改任何东西，pull 最新 secret）
gcloud run services update newapi --region=us-west1 --update-env-vars=DEPLOY_TIMESTAMP=$(date +%s)
```
