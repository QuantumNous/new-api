# new-api 发布与部署手册

> 这份文档是 `SolveaCX/new-api` 发布到 GCP 项目 `vocai-gemini-prod` 的操作指南。基础设施清单见 `INFRASTRUCTURE.md`，GCP 操作雷区见 `OPERATIONS.md`。

## 生产服务与发布目标

| 改动类型 | 生产入口 | Cloud Run service | Workflow | 说明 |
|---|---|---|---|---|
| 官网/SEO/公开页面 | `flatkey.ai`, `www.flatkey.ai` | `newapi-web` | `gcp-deploy-website.yml` | 独立 Next.js 项目 `website/` |
| 控制台、后台 API、管理 UI | `console.flatkey.ai` | `newapi-console` | `gcp-deploy.yml` | Go app，`NODE_TYPE=master`，高频发布目标 |
| 模型调用、relay、provider 适配 | `router.flatkey.ai` | `newapi-router` | `gcp-deploy.yml` | Go app，`NODE_TYPE=slave`，容量按模型调用配置 |
| legacy fallback | default backend | `newapi` | 仅兜底/同步需要 | 未命中 host_rule 的请求进入这里 |

Go app workflow 构建同一份 Go 镜像；生产部署必须经过 `production` Environment 审批。push 到 `main` 后会在同一个 run 里挂出 `deploy console` 和 `deploy router` 两个审批 job；有权限的人 approve 哪个，哪个才会真正部署。不要把 website 变更放到 Go workflow，也不要在 `web/default` 里恢复公开网站页面。

## 日常发布

### 触发方式

1. **push main**：PR 合并到 `main` 后，Go app workflow 构建并推送镜像，然后 `deploy console` / `deploy router` 两个 job 等待 `production` 审批。只 approve 需要发布的目标；未 approve 的目标不会部署。
2. **手动 deploy**：GitHub → Actions → `GCP Deploy` → Run workflow，选择 `deploy_target`。生产 deploy job 仍需 `production` Environment 审批。

`deploy_target` 行为：

| deploy_target | 行为 |
|---|---|
| `console` | 只发布 `newapi-console` |
| `router` | 只发布 `newapi-router` |
| `both` | 同一镜像分别发布到 `newapi-console` 和 `newapi-router` |
| `none` | 手动 run 时只 build / 复用镜像，不发布生产 |

### Go app 发布流程

```text
push main
  -> GitHub Actions build Go image
  -> push Artifact Registry
  -> deploy console waits for production approval
  -> deploy router waits for production approval
  -> approved target(s) deploy new revision and shift traffic

workflow_dispatch deploy_target=console/router/both
  -> build Go image or reuse image_tag
  -> selected deploy job(s) wait for production approval
  -> deploy new revision with --no-traffic
  -> canary tag health check /api/status
  -> shift traffic by revision
```

风险：

- Cloud Run 流量切换不会中断已经在旧 revision 上运行的请求；旧 revision 会继续 drain。
- 如果健康检查失败，新 revision 不应接流量，旧 revision 继续服务。
- `deploy-console` 和 `deploy-router` 是两个独立 job，GitHub Actions 图里会分别显示；push run 会同时挂出两个审批 job，手动 run 则按 `deploy_target` 挂出目标 job。
- 如果代码改动同时影响 console/router，两边都要发布并验证；不要只看一个域名。
- router 承载 LLM API/relay 真实流量，只有 review 明确要求时才 approve `deploy router`。

### Website 发布流程

`website/**` 变更走 `.github/workflows/gcp-deploy-website.yml`，部署 `newapi-web`，容器端口 4000。验证重点是 SSR、canonical、sitemap、pricing/blog 等公开页面。

## 发布后验证

### 1. URL map

```bash
gcloud compute url-maps describe newapi-urlmap \
  --project=vocai-gemini-prod --global \
  --format='yaml(hostRules,pathMatchers,defaultService)'
```

期望：

- `flatkey.ai`, `www.flatkey.ai` -> `newapi-web-backend`
- `console.flatkey.ai` -> `newapi-console-backend`
- `router.flatkey.ai` -> `newapi-router-backend`
- default -> `newapi-backend`

### 2. Cloud Run 当前流量

```bash
for svc in newapi-console newapi-router newapi-web newapi; do
  echo "== $svc =="
  gcloud run services describe "$svc" \
    --project=vocai-gemini-prod --region=us-west1 \
    --format='table(status.latestReadyRevisionName,status.traffic[].revisionName,status.traffic[].percent,status.url)'
done
```

### 3. 域名健康检查

```bash
curl -i --max-time 20 https://console.flatkey.ai/api/status
curl -i --max-time 20 https://router.flatkey.ai/api/status
curl -I --max-time 20 https://flatkey.ai
```

期望：

- console/router `/api/status` 返回 200。
- website 返回 200/3xx，且响应来自 Next.js website。

### 4. LB 日志确认真实后端

```bash
gcloud logging read \
  'resource.type="http_load_balancer" AND resource.labels.backend_service_name="newapi-console-backend"' \
  --project=vocai-gemini-prod --freshness=10m --limit=100 --format=json

gcloud logging read \
  'resource.type="http_load_balancer" AND resource.labels.backend_service_name="newapi-router-backend"' \
  --project=vocai-gemini-prod --freshness=10m --limit=100 --format=json
```

看点：

- 有近期请求进入对应 backend。
- 5xx 不应上升。
- router 出现少量 400/403 可以是业务请求错误，不等于基础设施失败；重点看 5xx 和延迟。

## 回滚

### 回滚某个 Cloud Run service 的应用 revision

风险：低到中。只切流量，不改 DNS/LB/证书；正在运行的旧请求不会被强杀，但新请求会进入指定 revision。

推荐方式：GitHub → Actions → `GCP Rollback` → Run workflow，选择 `rollback_target`（`console` 或 `router`）并填写目标 revision；该 workflow 同样经过 `production` Environment 审批。

```bash
gcloud run revisions list \
  --project=vocai-gemini-prod --region=us-west1 \
  --service=<newapi-console|newapi-router|newapi-web> --limit=10

gcloud run services update-traffic <service> \
  --project=vocai-gemini-prod --region=us-west1 \
  --to-revisions=<previous-revision-name>=100
```

验证：

```bash
gcloud run services describe <service> \
  --project=vocai-gemini-prod --region=us-west1 \
  --format='value(status.traffic)'
```

### 回滚 console host 分流到 legacy `newapi`

风险：中。`console.flatkey.ai` 新请求会回到 legacy default backend；如果 legacy 镜像/env 与 console 当前状态不一致，可能出现行为差异。不会改 Cloudflare，不会触发 GCP managed cert rotation。

步骤：

1. 改 `deploy/gcp/envs/prod/terraform.tfvars`：
   ```hcl
   console_domains = []
   ```
2. 本地 plan 并人工 review：
   ```bash
   terraform -chdir=deploy/gcp/envs/prod plan -input=false -no-color
   ```
3. 仅确认 URL map 删除 console host_rule 时再 apply。
4. 验证 `console.flatkey.ai/api/status` 和 LB 日志。

### 回滚 router host 分流到 legacy `newapi`

风险：高于 console。router 承载真实模型调用流量，回滚会把新请求切回 legacy default backend；要先确认 legacy revision 有相同模型调用代码和配置。

步骤：

1. 改 `deploy/gcp/envs/prod/terraform.tfvars`：
   ```hcl
   router_domains = []
   ```
2. 本地 plan 并人工 review。
3. 低峰 apply。
4. 重点观察 router 5xx、延迟和 provider 错误。

### 回滚 website host 分流到 legacy `newapi`

风险：中。`flatkey.ai` / `www.flatkey.ai` 会回到 default backend，公开官网会不可用或变成 Go app 行为；只适合 website 严重故障时短时兜底。

```hcl
website_domains = []
```

再 plan/apply，并验证 apex/www。

## 基础设施变更

任何 `terraform` / `gcloud` 前必须先读 `OPERATIONS.md`。

### 标准流程

```bash
terraform -chdir=deploy/gcp/envs/prod init
terraform -chdir=deploy/gcp/envs/prod plan -input=false -no-color
```

检查点：

- 不应出现 Cloud Run `image`、`traffic`、live env 被 Terraform 改回的 diff。
- `lb_domains` 变更会触发 GCP managed cert rotation，必须单独确认维护窗口。
- CI `gcp-infra.yml` plan/apply 目前受 IAM gap 影响，不作为生产 apply 依据。

### 添加或删除 LB host 分流

优先改这些变量：

```hcl
website_domains = ["flatkey.ai", "www.flatkey.ai"]
console_domains = ["console.flatkey.ai"]
router_domains  = ["router.flatkey.ai"]
```

风险：

- host_rule 变更是 URL map 原地更新，通常不停机。
- 配错 host/backend 会把新请求导到错误服务。
- 变更 `lb_domains` 不是普通 host_rule 变更，会触发证书风险。

### Cloudflare

当前策略：

- `console.flatkey.ai`：Proxied。不要改，除非决定把 console 加进 GCP cert 并接受 cert rotation 风险。
- `router.flatkey.ai`：DNS only。由 GCP managed cert 覆盖，适合模型调用长连接。
- `flatkey.ai` / `www.flatkey.ai`：Proxied。官网入口。

Cloudflare “origin IP partially exposed” warning 在当前混合模式下是预期现象，不是必须修复项。

## 密钥与凭据管理

### Secret 更新原则

- 用 `printf '%s'` 写 secret，避免尾部换行。
- Cloud Run `latest` secret 只在新 revision 启动时读取，不会热加载。
- 更新 secret 后，需要对目标 service 创建新 revision，并确认 traffic。

### 轮换数据库密码

```bash
printf '%s' '<new-password>' | gcloud secrets versions add newapi-db-app-password \
  --project=vocai-gemini-prod --data-file=-

gcloud sql users set-password newapi_app --host=% \
  --project=vocai-gemini-prod --instance=newapi-mysql --password='<new-password>'

DSN="newapi_app:<new-password>@unix(/cloudsql/vocai-gemini-prod:us-west1:newapi-mysql)/newapi?parseTime=true&charset=utf8mb4&loc=UTC"
printf '%s' "$DSN" | gcloud secrets versions add newapi-sql-dsn \
  --project=vocai-gemini-prod --data-file=-
```

然后按目标服务逐个创建新 revision 并切流量。风险较高，建议维护窗口。

## 故障排查

### 1. 请求没有进入预期 backend

```bash
gcloud compute url-maps describe newapi-urlmap \
  --project=vocai-gemini-prod --global \
  --format='yaml(hostRules,pathMatchers,defaultService)'
```

再查 LB 日志：

```bash
gcloud logging read \
  'resource.type="http_load_balancer" AND httpRequest.requestUrl:"console.flatkey.ai"' \
  --project=vocai-gemini-prod --freshness=10m --limit=50 --format=json
```

可能原因：

- URL map 尚未传播，等待 1-3 分钟再查。
- Cloudflare DNS/Proxy 指向不对。
- Host header 与期望不同。

### 2. Cloud Run revision 健康检查失败

```bash
gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="<service>"' \
  --project=vocai-gemini-prod --freshness=30m --limit=100 --format=json
```

健康检查失败时不要切流量。旧 revision 继续服务。

### 3. router 5xx 或流式异常上升

先按 backend 看 LB 5xx，再看 Cloud Run logs：

```bash
gcloud logging read \
  'resource.type="http_load_balancer" AND resource.labels.backend_service_name="newapi-router-backend" AND httpRequest.status>=500' \
  --project=vocai-gemini-prod --freshness=30m --limit=100 --format=json
```

如果是新 revision 引入，优先 revision rollback；如果是 LB host 分流错误，再考虑把 `router_domains=[]` 回 default backend。

### 4. console 登录/OAuth 异常

检查：

- `console.flatkey.ai/api/status` 是否 200。
- OAuth provider redirect URI 是否包含 `https://console.flatkey.ai/...`。
- 后台 `ServerAddress` / 网站 `APP_CONSOLE_ORIGIN` 是否指向 `https://console.flatkey.ai`。

## 常用命令

```bash
# URL map
gcloud compute url-maps describe newapi-urlmap --project=vocai-gemini-prod --global \
  --format='yaml(hostRules,pathMatchers,defaultService)'

# 当前 service traffic
gcloud run services describe newapi-console --project=vocai-gemini-prod --region=us-west1 \
  --format='table(status.traffic[].revisionName,status.traffic[].percent,status.traffic[].tag)'

gcloud run services describe newapi-router --project=vocai-gemini-prod --region=us-west1 \
  --format='table(status.traffic[].revisionName,status.traffic[].percent,status.traffic[].tag)'

# LB backend logs
gcloud logging read 'resource.type="http_load_balancer" AND resource.labels.backend_service_name="newapi-console-backend"' \
  --project=vocai-gemini-prod --freshness=10m --limit=50 --format=json
```
