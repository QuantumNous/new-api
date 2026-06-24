# 官网（Next.js）上线 Runbook

> 历史上线方案。当前生产形态已完成 website + console + router 三服务拆分；最新资源清单和日常操作以 `INFRASTRUCTURE.md` / `DEPLOYMENT.md` / `OPERATIONS.md` 为准。

把独立 Next.js 营销站（`website/`）接入 GCP LB，用**按域名分流**：`flatkey.ai` / `www.flatkey.ai` → Node 官网；`console.flatkey.ai` → Go 控制台服务 `newapi-console`；`router.flatkey.ai` → Go 模型调用服务 `newapi-router`。

> 配套阅读：`OPERATIONS.md`（雷区）、`INFRASTRUCTURE.md`（资源清单）、`DEPLOYMENT.md`（发布流程）。

## 目标态域名
| Host | 后端 | 说明 |
|---|---|---|
| `flatkey.ai`、`www.flatkey.ai` | Node `newapi-web` | 官网；www 建议 301→apex |
| `console.flatkey.ai` | Go `newapi-console` | 控制台/API，`NODE_TYPE=master` |
| `router.flatkey.ai` | Go `newapi-router` | 大模型 API，`NODE_TYPE=slave` |
| `new-api.app/api.*` | legacy/default `newapi` | 兼容入口，后续按日志清理 |

## 本次代码改动（已在分支 `ops/website-infra-cicd`）
- 新模块 `deploy/gcp/modules/cloud-run-web/`：Node 专用 Cloud Run（端口 4000、无 VPC/SQL、min=1、最小权限 SA）。
- `cloud-lb` 模块：新增 website NEG+backend + **按 host 的 url map 分流**（仅当 `website_domains` 非空才出现 host_rule）。
- 根模块 `envs/prod/`：`enable_website`、`website_*` 变量 + 接线；tfvars 默认 **Phase A**（`website_domains=[]`，apex 暂不翻）。
- 新 workflow `.github/workflows/gcp-deploy-website.yml`：`website/**` 变更触发，构建 `…/website:sha-*` 并 `gcloud run deploy newapi-web`（production 审批门）。

## 关键前提 / 雷区
- **基础设施 `terraform apply` 必须 Owner 本地执行**（ADC + `roles/run.admin`/Owner）。CI 的 `gcp-infra.yml` 因 deployer SA 权限不足跑不通（见 OPERATIONS）。
- **不改 `lb_domains` → 不重建证书 → 零 HTTPS 停机**。`flatkey.ai/www/console` 都是 depth≤2，靠 Cloudflare 橙云(Universal SSL)+回源 Full(非严格)，无需进托管证书。
- **`cloud_lb` 依赖 `cloud_run*`**，`-target` 无法隔离；整体 `plan -out` 再 apply。
- 改 `ServerAddress` 会临时打断 OAuth/邮件/视频代理直到所有实例滚完——**低峰执行**。

---

## 一次性准备

### 1. GitHub 仓库 Variables（Settings → Secrets and variables → Actions → Variables）
- `GCP_WEB_RUN_SERVICE` = `newapi-web`
- `WEBSITE_APP_CONSOLE_ORIGIN` = `https://console.flatkey.ai`
- `WEBSITE_SITE_ORIGIN` = `https://flatkey.ai`
（复用现有：`GCP_PROJECT_ID`、`GCP_REGION`、`GCP_AR_REPO_URL`、`GCP_WIF_PROVIDER`、`GCP_DEPLOYER_SA`。）

### 2. IAM：让 deployer SA 能部署 newapi-web
`newapi-web` 以 `newapi-web-runtime` 运行，deployer 需对它有 actAs：
```bash
gcloud iam service-accounts add-iam-policy-binding \
  newapi-web-runtime@vocai-gemini-prod.iam.gserviceaccount.com \
  --member="serviceAccount:newapi-ci-deployer@vocai-gemini-prod.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser" --project=vocai-gemini-prod
```
（`newapi-web-runtime` 由本次 TF 创建，所以这步在第 3 步 apply 之后执行。）

---

## Phase A —— 建服务（apex 不动，零风险）

3. **Owner 本地 apply**（创建 `newapi-web` 服务 + SA + website NEG/backend；因 `website_domains=[]`，**不产生 host_rule**，apex/www 仍 100% 走 Go）：
   ```bash
   cd deploy/gcp/envs/prod
   terraform plan -out=website.plan     # 确认：新增 cloud_run_web、web SA、web NEG/backend；url map 无 host_rule
   terraform apply website.plan
   ```
4. 执行上面【第 2 步】的 actAs 绑定。
5. **首发镜像 + 部署**：合并本分支到 `main`（含 `website/`）触发 `gcp-deploy-website.yml`，或 `workflow_dispatch` 手动跑 → 审批 → 部署到 `newapi-web`。
6. **直连验证**（不经 LB）：
   ```bash
   gcloud run services describe newapi-web --region=us-west1 --format='value(status.url)'
   curl -I https://newapi-web-xxxx.run.app/           # 200，含 Next 响应头
   curl -sS https://newapi-web-xxxx.run.app/sitemap.xml | head
   ```

## Phase B —— 立 console + 迁 app 对外地址（已完成）

7. **CF 加 `console.flatkey.ai`**：当前为橙云 Proxied，A → `34.54.128.101`，LB host_rule 路由到 `newapi-console`：
   ```bash
   curl -sS https://console.flatkey.ai/api/status      # 期望 200
   ```
8. **迁移 app 绝对 URL 到 console**（低峰窗口）：
   - 各 OAuth provider redirect URI 增加 `https://console.flatkey.ai/...`
   - 后台 `ServerAddress` → `https://console.flatkey.ai`（⚠️ 会短暂影响 OAuth/邮件/视频代理）
   - `frontend_base_url`（tfvars，当前指废弃域名）→ `https://console.flatkey.ai`，apply
   - 确认 `COOKIE_SESSION_DOMAIN=.flatkey.ai` 已生效（apex↔console 共享登录态）

## Phase C —— 翻转 apex/www → Node（秒级可回滚）

9. **CF 加 `www.flatkey.ai`**：橙云，CNAME→`one`/apex。
10. **翻转**：编辑 `envs/prod/terraform.tfvars`：
    ```hcl
    website_domains = ["flatkey.ai", "www.flatkey.ai"]
    ```
    ```bash
    terraform plan -out=flip.plan   # 仅新增 url map host_rule + path_matcher（不动证书）
    terraform apply flip.plan
    ```
    生效近实时。此刻 `flatkey.ai/`、`/pricing`、`/blog/*` → Node；`/dashboard`、`/api/*` → Node（不存在）。
11. **兜底 301**（Node middleware 或 CF redirect rule）：`flatkey.ai/dashboard/*`、`/api/*`、(如有)`/v1` → `console`/`router`。
    - ⚠️ 翻转瞬间，已打开的旧 SPA 标签仍打 `flatkey.ai/api/*` → 进 Node 报错，用户刷新后重定向到 console。可接受"刷新即恢复"，或让 Node 过渡期反代 `/api/*`→console。
    - ⚠️ 先确认**无人用 `flatkey.ai/v1` 调大模型**（应都是 `router.flatkey.ai/v1`）。
12. **验证**：
    ```bash
    curl -I https://flatkey.ai/                 # Next
    curl -I https://www.flatkey.ai/             # Next（或 301→apex）
    curl -sS https://console.flatkey.ai/api/status   # newapi-console 200
    curl -sS https://router.flatkey.ai/api/status    # newapi-router 200
    ```

## 回滚
- **翻转回滚（秒级）**：`website_domains = []` → `terraform apply`（host_rule 消失，apex/www 立刻回 Go）。或直接在控制台/`gcloud` 删 url map 的 host_rule。
- **官网版本回滚**：`gcloud run services update-traffic newapi-web --to-revisions=<旧rev>=100`。
- 全程不碰 `lb_domains`/证书，无停机窗口。

## 验收清单
- [ ] `terraform plan` Phase A 只新增 web 服务/SA/NEG/backend，url map 无 host_rule
- [ ] `newapi-web` run.app 直连 `/`、`/sitemap.xml` 正常
- [ ] console.flatkey.ai 控制台可用、OAuth 回调通
- [ ] 翻转后 apex=Node、console=newapi-console、router=newapi-router，301 兜底生效
- [ ] 回滚演练（`website_domains=[]`）验证过
