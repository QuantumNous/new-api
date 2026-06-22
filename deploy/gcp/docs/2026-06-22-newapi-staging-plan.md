# newapi-staging 完整测试环境 — 变更方案（待审批）

> 作者：环境搭建 / 日期：2026-06-22 / 审批人：**slZhong**
> 适用：`vocai-gemini-prod` GCP 项目，遵循 `OPERATIONS.md` Rule 7（动 GCP 基设须先 plan + 审批）。
> 范围：后端 + 官网双服务 + 独立 CI/CD，**先用 Cloud Run 自动生成的 `*.run.app` URL，本期不配自定义域名、不动 LB**。

---

## 摘要

| 项 | 内容 |
|---|---|
| **目标** | 复刻一套 staging：Go 后端 + Next 官网两个服务，独立 CI/CD（push `staging` 分支自动 build+deploy） |
| **入口** | 直接用生成的 URL：后端 `newapi-staging-…run.app`、官网 `newapi-web-staging-…run.app`（**不配域名、不动 LB**） |
| **DB** | 复用生产实例 `newapi-mysql` + 独立库/用户（用户已确认可共享实例） |
| **身份** | 新建 `newapi-staging-runtime`（后端）+ `newapi-web-staging-runtime`（官网）独立 SA（用户要求身份隔离） |
| **缓存** | 内存模式，不连 Redis；后端固定单实例 |
| **CI/CD** | 新增 2 个独立 workflow，触发分支 = `staging`，复用现有 WIF |
| **plan 预期** | 仅新增 staging 资源，**0 修改、0 销毁** 现有资源（不碰 LB/证书/生产服务） |
| **成本** | **~$25/月**（后端常驻 1 + 官网常驻 1 + 少量） |

---

## 0. 既成事实 ⚠️

搭建过程中已通过 `gcloud` 在生产实例 `newapi-mysql` 上**手动建了一个空库 `newapi_staging`**（对生产库零影响，库不纳入 TF）。需 slZhong 认可；不认可可一条命令删除：
`gcloud sql databases delete newapi_staging --instance=newapi-mysql --project=vocai-gemini-prod`

---

## 1. 用户要求 → 如何落地

| # | 用户要求 | 落地方式 |
|---|---|---|
| 1 | **CI/CD 独立**：`staging` 分支有新代码→自动 build+deploy | 新建 2 个 workflow（后端 / 官网），`on: push: branches: [staging]`；复用现有 WIF（已确认 WIF 只认仓库、不限分支）。新建远端 `staging` 分支 |
| 2 | **DB 用生产实例** | 复用 `newapi-mysql`，建独立库 `newapi_staging` + 独立用户 |
| 3 | **新建 `newapi-staging-runtime` SA** | 新 SA 仅授 staging secret 读 + cloudsql client，与生产身份隔离 |
| 4 | **官网 website 也要 staging** | 复刻 `cloud-run-web` 起 `newapi-web-staging` |
| — | **域名先不管，用生成的 URL** | 不改 `lb_domains`、不动 LB、不碰 Cloudflare —— 消除了证书重建停机风险 |

---

## 2. 思路：复用 vs 新增

**思路**：新增一套 staging 服务 + CI；底层（实例、镜像仓库、WIF）尽量复用；**完全不碰 LB/证书/生产服务**，把改动面和风险压到最小。

| 资源 | 处置 | 说明 |
|---|---|---|
| Cloud SQL 实例 `newapi-mysql` | **复用** | 独立库 + 独立用户 |
| 库 `newapi_staging` | 手动管理 | 已建（§0），不进 TF |
| DB 用户 `newapi_staging_app` | **新增** | 独立账号/密码 |
| Artifact Registry | **复用** | staging 镜像用独立 tag（`:staging-latest` / `:staging-sha-xxx`），与生产 tag 隔离 |
| WIF pool/provider | **复用** | 不限分支，无需改 |
| Runtime SA | **新建** `newapi-staging-runtime`（后端）+ `newapi-web-staging-runtime`（官网，最小权限） | 用户要求身份隔离 |
| Secrets `newapi-staging-*`（×3） | **新增** | sql-dsn / session / crypto |
| Cloud Run `newapi-staging`（后端） | **新增** | 单实例、内存缓存、挂 cloudsql |
| Cloud Run `newapi-web-staging`（官网） | **新增** | 复刻 cloud-run-web，端口 4000 |
| **LB / 证书 / 域名 / Cloudflare** | **完全不碰** | 本期用 `*.run.app`，零停机风险 |
| CI/CD workflow | **新增 2 个** | 后端 + 官网，触发 `staging` 分支 |

---

## 3. 关键设计决策

- **入口用 `*.run.app`，不配域名。** 本期不改 `lb_domains`、不动 LB——这消除了原方案唯一的高风险项（托管证书重建会造成 HTTPS 停机窗口、波及生产域名）。将来要域名再单独走一次低峰期变更。
- **后端：内存缓存 + 固定单实例。** 不连 Redis（避免与生产串缓存/省钱），单实例消除内存缓存多副本不一致问题。
- **官网：复刻 `cloud-run-web` 范式。** 无状态 SSR，不碰 DB/Redis，min=1 避免冷启动。
- **新建独立 runtime SA（用户要求）。** 后端 SA 只授 staging 3 个 secret 读 + cloudsql client；官网 SA 只授 logging/monitoring。与生产 SA 完全分离。
- **库不进 TF。** 防止关 staging 时误删数据。
- **CI/CD 用 `staging` 分支触发，复用 WIF。** provider 只校验 `repository==SolveaCX/new-api`，任何分支可部署，无需动 WIF/IAM。staging workflow 只部署 staging 服务（服务名写死），与生产 `main` workflow 互不干扰。

---

## 4. 互联关系（origin 指向）

staging 自成闭环，不与生产串：
- 官网 staging（`newapi-web-staging`）的 `APP_CONSOLE_ORIGIN` → 指向**后端 staging 的 run.app URL**，不是生产 console。
- 后端 staging 的 `FRONTEND_BASE_URL` → 指向**自己的 run.app URL**（用于 OAuth 回调/邮件链接）。
- 因 URL 要 apply 后才确定，首次 apply 后取实际 URL 回填这两个 origin，再 apply 一次（或部署时由 CI 注入）。

---

## 5. 要落地的东西（清单）

**Terraform（`envs/prod`，全部由 `var.enable_staging` 开关控制，默认 false）**
1. 新文件 `staging.tf`：DB 用户、3 secret、2 个 runtime SA、后端 Cloud Run、官网 Cloud Run、相关 IAM、输出两个 URL。
   - **不改 `terraform.tfvars` 的 `lb_domains`，不改 `cloud-lb` 模块。**

**CI/CD（`.github/workflows/`）**
2. 新增 `gcp-deploy-staging.yml`（后端，`on: push: branches:[staging]`，build→部署 `newapi-staging`）。
3. 新增 `gcp-deploy-website-staging.yml`（官网，同上，paths 限 `website/**`）。
4. GitHub 配 staging 用的 vars（staging 服务名、origin 等）。

**分支**
5. 建远端 `staging` 分支。

> 具体 HCL / YAML 在落地 PR 给出；本方案只定思路、范围、风险。

---

## 6. 风险与缓解

| 风险 | 级别 | 缓解 |
|---|---|---|
| staging 与生产共享 Cloud SQL 实例 | 低 | `SQL_MAX_OPEN_CONNS=5` + 单实例，封顶 5 连接；实例 300 富余 |
| `staging` 分支可部署到生产项目（WIF 不限分支） | 中 | staging workflow 只部署 staging 服务（服务名写死）；生产 workflow 仍只认 `main`；tag/服务名隔离 |
| CI/CD 自动部署绕过把关 | 中 | deploy job 可挂/不挂审批，见决策点 §8 |
| 后端/官网 staging 公网暴露 | 低 | 后端有应用鉴权；官网本就是公开站 |
| 关闭 staging 时误删数据 | 低 | 库不进 TF；关开关只删服务/SA/secret |

> 注：原方案的"HTTPS 证书重建停机窗口"高风险项，因本期不配域名，**已不存在**。

---

## 7. 回滚

- **关掉整套 staging**：`terraform apply -var='enable_staging=false'` → 删除所有 staging 服务/SA/secret/IAM（不碰生产、不碰 LB）。
- 库与数据：手动 `gcloud sql databases delete newapi_staging`。

---

## 8. 成本

| 项 | 月成本 |
|---|---|
| 后端 `newapi-staging`（单实例 min=1，cpu_idle=true） | ~$13 |
| 官网 `newapi-web-staging`（min=1，512Mi） | ~$8 |
| 2 SA / 3 secret | ~$1 |
| DB（复用实例）/ LB（不碰） | $0 额外 |
| **合计** | **~$22–25/月** |

---

## 9. 需 slZhong 拍板的决策点

1. **认可已手动建的空库 `newapi_staging`？**（§0）
2. **CI/CD 审批**：staging 的 deploy job 要不要挂人工审批？
   - 建议**免审批自动上**（既然要的是"推了就自动部署"，挂审批就不自动了）；生产 `main` 的审批保留不变。
3. **谁来 apply**：需 Owner 身份本地执行（CI deployer 权限不足，见 OPERATIONS.md）。由谁执行？

---

## 10. 执行顺序（审批通过后）

1. 建远端 `staging` 分支。
2. 写 `staging.tf` + 2 个 workflow，开 PR。
3. 本地用 Owner ADC 跑 `terraform plan -var='enable_staging=true'`，**确认 0 change / 0 destroy** 再 apply。
4. 取两个 `*.run.app` URL，回填 origin（§4），验证：
   - `curl <后端URL>/api/status` → 200（首访自动建表）
   - `curl <官网URL>/` → 200
5. push `staging` 分支，验证 CI/CD 自动 build+deploy 链路打通。
6. 把 `enable_staging=true` 写进 `terraform.tfvars` 保持 desired-state 一致，合并 PR。
