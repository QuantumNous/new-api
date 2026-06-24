<!-- Generated: 2026-06-08 | Updated: 2026-06-08 -->
# AGENTS.md — Project Conventions for new-api

## Overview

This is an AI API gateway/proxy built with Go. It aggregates 40+ upstream AI providers (OpenAI, Claude, Gemini, Azure, AWS Bedrock, etc.) behind a unified API, with user management, billing, rate limiting, and a console dashboard.

The public marketing/SEO website is no longer maintained inside the Go application or `web/default`. The official website lives in the standalone Next.js project under `website/`. Treat the Go application as the API proxy plus authenticated console dashboard product only.

## Tech Stack

- **Backend**: Go 1.22+, Gin web framework, GORM v2 ORM
- **Console frontend**: React 19, TypeScript, Rsbuild, Base UI, Tailwind CSS (`web/default/`, embedded by the Go application)
- **Official website**: Next.js 16, React 19, Tailwind CSS (`website/`, standalone Node app)
- **Databases**: SQLite, MySQL, PostgreSQL (all three must be supported)
- **Cache**: Redis (go-redis) + in-memory cache
- **Auth**: JWT, WebAuthn/Passkeys, OAuth (GitHub, Discord, OIDC, etc.)
- **Frontend package manager**: Bun (preferred over npm/yarn/pnpm)

## Architecture

Layered architecture: Router -> Controller -> Service -> Model

```
main.go        — Main server entrypoint (HTTP server bootstrap, embedded frontend assets)
cmd/           — Auxiliary standalone binaries (not part of the main HTTP server)
  cmd/blockrun_balance/ — CLI: query ETH/USDC balance on Base chain from a private key
router/        — HTTP routing (API, relay, dashboard, web)
controller/    — Request handlers
service/       — Business logic
model/         — Data models and DB access (GORM)
relay/         — AI API relay/proxy with provider adapters
  relay/channel/ — Provider-specific adapters (openai/, claude/, gemini/, aws/, etc.)
middleware/    — Auth, rate limiting, CORS, logging, distribution
setting/       — Configuration management (ratio, model, operation, system, performance)
common/        — Shared utilities (JSON, crypto, Redis, env, rate-limit, etc.)
dto/           — Data transfer objects (request/response structs)
constant/      — Constants (API types, channel types, context keys)
types/         — Type definitions (relay formats, file sources, errors)
i18n/          — Backend internationalization (go-i18n, en/zh)
oauth/         — OAuth provider implementations
pkg/           — Internal packages (cachex, ionet)
web/             — Frontend themes container
 web/default/   — Console dashboard frontend (React 19, Rsbuild, Base UI, Tailwind; embedded by Go)
  web/classic/   — Classic frontend (React 18, Vite, Semi Design)
  web/default/src/i18n/ — Frontend internationalization (i18next, en/zh/fr/ru/ja/vi/es/pt)
website/        — Official public website (Next.js standalone Node app; SEO/marketing/legal/pricing pages)
```

## Internationalization (i18n)

### Backend (`i18n/`)
- Library: `nicksnyder/go-i18n/v2`
- Languages: en, zh

### Frontend (`web/default/src/i18n/`)
- Library: `i18next` + `react-i18next` + `i18next-browser-languagedetector`
- Languages: en (base), zh (fallback), fr, ru, ja, vi, es, pt — **8 种，以 `locales/` 目录实际文件为准**
- Translation files: `web/default/src/i18n/locales/{lang}.json` — flat JSON, keys are English source strings
- Usage: `useTranslation()` hook, call `t('English key')` in components
- CLI tools: `bun run i18n:sync` (from `web/default/`)

#### ⚠️ 多语言（i18n）注意事项 — 历史多次出 bug，任何涉及用户可见文案的工作（开发/重构/review）都必须遵守

- 新 key 必须写入 `locales/` 全部 8 个语言文件，漏写会回退英文；删除/重命名 key 同步清理 8 个文件。
- 必须真实翻译，禁止把英文原文复制为其他语言的值（es/pt 多次漏翻）；品牌词例外（`BRAND_AND_LITERAL_KEYS`）。
- 改完在 `web/default/` 跑 `bun run i18n:sync`，提交前检查 `locales/_reports/{lang}.untranslated.json` 是否出现自己改动的 key。
- 用户可见字符串一律走 `t()`（含 toast/placeholder/错误消息）；非 `t()` 字面量 key 登记 `src/i18n/static-keys.ts`；后端用户可见报错走 `i18n/`（go-i18n，en/zh），与前端体系独立。
- AI review 涉及文案的 diff 时必须逐项核对以上各条（找漏 key：`grep -L "新 key" src/i18n/locales/*.json`），发现问题按缺陷处理，不得降级为"可选优化"。

## Rules

### Rule 0: Repository For PRs, Releases, And Deployments

For project PR checks, GitHub Actions, releases, and production deployments, use the `SolveaCX/new-api` repository and its remotes/URLs. Do NOT use `QuantumNous/new-api` for release or deployment decisions; it is not the deployment repository for this project.

### Rule 1: JSON Package — Use `common/json.go`

All JSON marshal/unmarshal operations MUST use the wrapper functions in `common/json.go`:

- `common.Marshal(v any) ([]byte, error)`
- `common.Unmarshal(data []byte, v any) error`
- `common.UnmarshalJsonStr(data string, v any) error`
- `common.DecodeJson(reader io.Reader, v any) error`
- `common.GetJsonType(data json.RawMessage) string`

Do NOT directly import or call `encoding/json` in business code. These wrappers exist for consistency and future extensibility (e.g., swapping to a faster JSON library).

Note: `json.RawMessage`, `json.Number`, and other type definitions from `encoding/json` may still be referenced as types, but actual marshal/unmarshal calls must go through `common.*`.

### Rule 2: Database Compatibility — SQLite, MySQL >= 5.7.8, PostgreSQL >= 9.6

All database code MUST be fully compatible with all three databases simultaneously.

**Use GORM abstractions:**
- Prefer GORM methods (`Create`, `Find`, `Where`, `Updates`, etc.) over raw SQL.
- Let GORM handle primary key generation — do not use `AUTO_INCREMENT` or `SERIAL` directly.

**When raw SQL is unavoidable:**
- Column quoting differs: PostgreSQL uses `"column"`, MySQL/SQLite uses `` `column` ``.
- Use `commonGroupCol`, `commonKeyCol` variables from `model/main.go` for reserved-word columns like `group` and `key`.
- Boolean values differ: PostgreSQL uses `true`/`false`, MySQL/SQLite uses `1`/`0`. Use `commonTrueVal`/`commonFalseVal`.
- Use `common.UsingPostgreSQL`, `common.UsingSQLite`, `common.UsingMySQL` flags to branch DB-specific logic.

**Forbidden without cross-DB fallback:**
- MySQL-only functions (e.g., `GROUP_CONCAT` without PostgreSQL `STRING_AGG` equivalent)
- PostgreSQL-only operators (e.g., `@>`, `?`, `JSONB` operators)
- `ALTER COLUMN` in SQLite (unsupported — use column-add workaround)
- Database-specific column types without fallback — use `TEXT` instead of `JSONB` for JSON storage

**Migrations:**
- Ensure all migrations work on all three databases.
- For SQLite, use `ALTER TABLE ... ADD COLUMN` instead of `ALTER COLUMN` (see `model/main.go` for patterns).

### Rule 3: Frontend — Prefer Bun

Use `bun` as the preferred package manager and script runner for frontend projects:
- `bun install` for dependency installation
- `bun run dev` for development server
- `bun run build` for production build
- `bun run i18n:*` for i18n tooling

Scope frontend work correctly:
- `web/default/` and `web/classic/` are console/dashboard frontends served by the Go app.
- `website/` is the only maintained official public website. Do not add or maintain public website pages in the Go app or `web/default`.
- The Go app should focus on API proxy, billing, auth, admin/user console, relay, and dashboard behavior.
- Website-to-console links and API proxy origins are environment-driven: `OFFICIAL_WEBSITE_ORIGIN` points console Home to the website; `APP_CONSOLE_ORIGIN` points the Next website to the Go application.

### Rule 4: New Channel StreamOptions Support

When implementing a new channel:
- Confirm whether the provider supports `StreamOptions`.
- If supported, add the channel to `streamSupportedChannels`.

### Rule 5: Upstream Relay Request DTOs — Preserve Explicit Zero Values

For request structs that are parsed from client JSON and then re-marshaled to upstream providers (especially relay/convert paths):

- Optional scalar fields MUST use pointer types with `omitempty` (e.g. `*int`, `*uint`, `*float64`, `*bool`), not non-pointer scalars.
- Semantics MUST be:
  - field absent in client JSON => `nil` => omitted on marshal;
  - field explicitly set to zero/false => non-`nil` pointer => must still be sent upstream.
- Avoid using non-pointer scalars with `omitempty` for optional request parameters, because zero values (`0`, `0.0`, `false`) will be silently dropped during marshal.

### Rule 6: Billing Expression System — Read `pkg/billingexpr/expr.md`

When working on tiered/dynamic billing (expression-based pricing), you MUST read `pkg/billingexpr/expr.md` first. It documents the design philosophy, expression language (variables, functions, examples), full system architecture (editor → storage → pre-consume → settlement → log display), token normalization rules (`p`/`c` auto-exclusion), quota conversion, and expression versioning. All code changes to the billing expression system must follow the patterns described in that document.

### Rule 7: GCP Operations — Read `deploy/gcp/docs/OPERATIONS.md`

Before running any `terraform`, `gcloud`, or other command that touches GCP infrastructure (project `vocai-gemini-prod`), you MUST read `deploy/gcp/docs/OPERATIONS.md` first. It documents Terraform state location, the two separate auth systems (ADC vs user CLI), Cloud Run fields owned by CI/CD that must stay in `lifecycle.ignore_changes`, the env-var-update / revision-conflict workaround, the HTTPS downtime window during managed SSL cert rotation (always warn the user before applying `lb_domains` changes), Cloudflare DNS-only constraint for depth-3 hostnames, and the whitelabel channel registry. Companion docs: `INFRASTRUCTURE.md` (resource inventory), `DEPLOYMENT.md` (deploy/rollback procedures).

### Rule 8: New Seedance Video Channel — Follow the SOP in `relay/channel/task/AGENTS.md`

When onboarding a **new seedance-based video channel supplier** (any upstream serving seedance 2.0–style video generation), you MUST read the「新增 seedance 系渠道适配器 SOP」section in `relay/channel/task/AGENTS.md` first and follow its architecture seam:

- new-api exposes ONE universal client-facing format — the official seedance `content[]` request (`dto.SeedanceVideoRequest`); do NOT invent a new per-channel inbound format.
- Reuse `taskcommon.BindSeedanceRequest` (parse + validate + synthesize `task_request` + set Action). Each channel only writes its own `build<Channel>CreateRequest` mapping function (seedance → that channel's upstream wire format), its value-domain checks (fail fast on unsupported values), and registration.
- Whitelabel is mandatory: never leak the upstream supplier name, host, or internal model name in responses/logs/docs; results go through the `/v1/videos/{task_id}/content` proxy. Token `usage` is surfaced automatically via `task.PrivateData`.
- Reference implementation: `relay/channel/task/kuaizi/`.

### Rule 9: Official Public Website Lives Only in `website/`

The public-facing official website — home/marketing, pricing, rankings, blog, legal pages, and SEO surfaces (`sitemap.xml` / `robots.txt` / `llms.txt`, canonical/hreflang) — is maintained **exclusively** in the standalone Next.js project under `website/`. Read `website/AGENTS.md` before touching it.

- **Do NOT** add, restore, or maintain public website / marketing / landing / legal / pricing pages in the Go application or in `web/default`. `web/default` is the authenticated **console/dashboard SPA only**; the old in-SPA marketing pages are deprecated — extend the public site in `website/`, never in `web/default` or the Go app.
- Production routing is **host-based** at the GCP LB: `flatkey.ai` + `www.flatkey.ai` → the Next website (Cloud Run `newapi-web`); `console.flatkey.ai` → Go console service `newapi-console` (`NODE_TYPE=master`); `router.flatkey.ai` → Go router service `newapi-router` (`NODE_TYPE=slave`). The legacy `newapi` service remains the default/fallback backend. Do not reintroduce public pages on the Go hosts.
- Cross-app wiring is **environment-driven** — never hardcode the peer origin: `APP_CONSOLE_ORIGIN` (website → Go console/API), `SITE_ORIGIN` / `NEXT_PUBLIC_SITE_ORIGIN` (website's own canonical origin), `OFFICIAL_WEBSITE_ORIGIN` (console → website).
- CI/CD & infra: `website/` builds and deploys via `.github/workflows/gcp-deploy-website.yml` (separate Cloud Run service, container port 4000); the Go app uses `gcp-deploy.yml` (which `paths-ignore`s `website/**`). Production LB host-split, website service, and console/router runtime split live in `deploy/gcp/` — see `deploy/gcp/docs/INFRASTRUCTURE.md` and `deploy/gcp/docs/DEPLOYMENT.md`.

### Rule 10: GitHub Issues And Pull Requests Must Preserve The Reasoning Trail

When creating or updating a GitHub issue or PR, write a reviewable engineering note, not just a title, task list, change summary, or command log. Non-trivial issues/PRs must preserve the reasoning trail: **problem/background**, **evidence or reproduction**, **root cause or hypothesis**, **scope or design**, **impact and risks**, and **validation or acceptance criteria**.

Small mechanical items can be shorter, but still need clear requested/changed behavior and verification. For production incidents, bug fixes, cross-module changes, billing/auth/relay work, migrations, or large PRs, do not publish without the evidence-backed chain: phenomenon → evidence → root cause/hypothesis → fix/scope → impact → validation.

When addressing PR review comments, reviewer comments, or review-bot comments, do not only fix code locally. Reply on GitHub to every actionable comment with the resolution: what changed, which commit/PR update contains it, validation run, or why the comment is not applicable. For top-level PR comments (issue comments), add a new PR comment that links to and quotes the original comment; for inline review threads, reply in the thread when GitHub supports it. Keep replies factual and traceable.

### Rule 11: Production Is Multi-Node

Production runs as a multi-node deployment. Code changes and technical plans MUST account for multiple application instances serving traffic at the same time.

- Do not rely on in-memory state, process-local locks, or single-instance ordering for correctness.
- Use database transactions, row locks, unique constraints, Redis/distributed locks, idempotency keys, or other cross-node-safe mechanisms when correctness depends on coordination.
- Cache invalidation, background jobs, startup initialization, scheduled work, and one-time migrations must be safe when executed by more than one node.
- PRs and technical designs that touch auth, billing, quota, token/key creation, relay routing, caches, jobs, or configuration writes must explicitly mention the multi-node behavior or why it is not relevant.

### Rule 12: Code Reviews Must Include Production Deployment Advice

When reviewing a PR or performing a code review, the review output MUST include a **production deployment recommendation** for the current diff. The recommendation must explicitly answer whether the production router nodes need to be deployed.

Required output:

- `Router deploy`: `required`, `not required`, or `unclear`.
- `Reason`: cite the changed surfaces that drive the decision, especially relay/model invocation paths, provider adapters, billing/quota logic used by relay, shared middleware, shared config, DB migrations, or runtime env changes.
- `Other deploy targets`: mention whether `newapi-console`, `newapi-web`, legacy `newapi`, staging, Terraform, or Cloudflare are also involved.
- `Risk / validation`: note production risk and the minimum validation before release.

Default guidance: mark router deploy `required` when changes can affect `/v1`, relay/model calls, provider routing, streaming, auth/rate-limit middleware used by API traffic, billing/quota settlement, shared Go runtime initialization, shared config/env parsing, DB schema used by router requests, or any code imported by those paths. Mark router deploy `not required` only when the diff is clearly limited to website-only code, console-only UI/admin behavior, docs, tests, or tooling with no runtime effect on router paths. Use `unclear` when the dependency path is uncertain and call out what must be checked.

### Rule 13: Staging Deploys From The `staging` Branch

The GCP staging environment is deployed by GitHub Actions from the remote `staging` branch. To deploy staging, merge or push the desired code into branch `staging`; this automatically builds and deploys staging without the production approval gate.

- Backend workflow: `.github/workflows/gcp-deploy-staging.yml` builds the Go application image and deploys Cloud Run service `newapi-staging`.
- Website workflow: `.github/workflows/gcp-deploy-website-staging.yml` builds `website/` and deploys Cloud Run service `newapi-web-staging`.
- Staging domains are `https://staging-console.flatkey.ai`, `https://staging-router.flatkey.ai`, and `https://staging-website.flatkey.ai`.
- This is separate from production: production deploys from `main` through the production workflows and approval gate. Do not use `staging` as evidence that production has been deployed.
- Do not copy production-only runtime settings, callback URLs, payment credentials, OAuth secrets, or production domains into staging. Staging must keep its own domain/origin values.

---

## Code Map — 按需加载的模块级文档（重要）

本仓库为每个主要模块都维护了一份 `AGENTS.md`，记录该目录的职责、关键文件、内部约定与测试方式。**这些文件不会在会话启动时自动加载**——只有当前文件（根 `AGENTS.md` / `CLAUDE.md`）会随会话初始化进入上下文。

### 加载约定（AI 阅读规则）

- **禁止**一次性把全部 `AGENTS.md` 读入上下文，浪费 token。
- **必须**在以下场景**主动 `Read` 对应模块的 `AGENTS.md`**：
  1. 准备**读取或修改**某个模块目录下的代码文件之前
  2. 需要了解某模块的内部约定、典型模式、依赖关系或测试方式时
  3. 跨模块协作（例如新增 channel 同时涉及 `relay/` + `setting/` + `dto/`）
  4. 用户提问明确指向某个目录或子系统时
- **可省略**：若本文件 Rule 1–7 已覆盖目标问题（如纯粹的 JSON / 跨 DB / Bun 问题），不必再读子文件。
- 子文件顶部均带 `<!-- Parent: ../AGENTS.md -->`，可沿父链回溯。
- 子文件末尾 `<!-- MANUAL: -->` 分隔线下方为人工补充内容，重新生成时必须保留。

### 模块级文档索引

#### 后端 Go 应用层
- `controller/AGENTS.md` — HTTP handler 薄胶水层、统一响应与 i18n 错误
- `service/AGENTS.md` — 业务逻辑层（计费、渠道选择、token 计数等）
- `model/AGENTS.md` — GORM 数据访问、跨 DB 兼容、内存缓存
- `router/AGENTS.md` — 路由注册与限流策略分配
- `middleware/AGENTS.md` — 鉴权、分发、限流、CORS、日志、错误响应

#### 共享与类型
- `common/AGENTS.md` — 共享工具（JSON / DB flags / Redis / crypto / env），Rule 1 核心实现
- `dto/AGENTS.md` — 请求/响应结构体（重点：Rule 5 指针零值）
- `constant/AGENTS.md` — 枚举常量与 context key
- `types/AGENTS.md` — relay 格式、错误体系（NewAPIError）

#### Relay 中继子系统
- `relay/AGENTS.md` — 总入口、handler 分发与计费生命周期
- `relay/channel/AGENTS.md` — 40+ provider 适配器模式（**新增 channel 必读**，含 Rule 4）
- `relay/channel/task/AGENTS.md` — 异步任务类 provider（kling/sora/suno/jimeng/kuaizi …）；**含「新增 seedance 系渠道适配器 SOP」（→ Rule 8）**
- `relay/common/AGENTS.md` — RelayInfo / BillingSettler / StreamStatus / streamSupportedChannels
- `relay/common_handler/AGENTS.md` — 跨 provider 复用的响应处理器
- `relay/constant/AGENTS.md` — RelayMode / Path2RelayMode
- `relay/helper/AGENTS.md` — SSE 流式工具、计费辅助
- `relay/reasonmap/AGENTS.md` — Claude ↔ OpenAI finish_reason 映射

#### 内部包 pkg/
- `pkg/AGENTS.md` — 子包总览
- `pkg/billingexpr/AGENTS.md` — 计费表达式（→ Rule 6 / `expr.md`）
- `pkg/cachex/AGENTS.md` — 双层缓存（Redis + 内存）
- `pkg/ionet/AGENTS.md` — HTTP 客户端抽象
- `pkg/perf_metrics/AGENTS.md` — 性能指标采集

#### 配置 setting/
- `setting/AGENTS.md` — 配置注册体系总览
- `setting/billing_setting/AGENTS.md` — 计费相关配置（→ Rule 6）
- `setting/config/AGENTS.md` — ConfigManager 与 DB 序列化
- `setting/console_setting/AGENTS.md` — 控制台 UI 配置
- `setting/model_setting/AGENTS.md` — 模型相关配置
- `setting/operation_setting/AGENTS.md` — 运营配置
- `setting/perf_metrics_setting/AGENTS.md` — 性能指标开关
- `setting/performance_setting/AGENTS.md` — 性能调优
- `setting/ratio_setting/AGENTS.md` — 计费比率与模型价格
- `setting/reasoning/AGENTS.md` — 推理相关配置
- `setting/system_setting/AGENTS.md` — 系统级配置

#### 国际化与认证
- `oauth/AGENTS.md` — OAuth provider 实现
- `i18n/AGENTS.md` — 后端 go-i18n（与前端 i18next 完全独立）

#### 辅助二进制工具 cmd/
- `cmd/AGENTS.md` — Go 辅助命令入口总览
- `cmd/blockrun_balance/AGENTS.md` — Base 链 ETH/USDC 余额查询 CLI

#### 部署与文档
- `deploy/AGENTS.md` — 部署目录总览
- `deploy/gcp/AGENTS.md` — GCP 部署入口（→ Rule 7 / `OPERATIONS.md`）
- `docs/AGENTS.md` — 面向人类的项目文档导航
- `logger/AGENTS.md` — 日志输出层
- `electron/AGENTS.md` — 桌面端打包

#### 前端
- `web/AGENTS.md` — 前端容器（双主题）
- `web/default/AGENTS.md` — 默认主题（React 19 + Rsbuild + Base UI + Tailwind，规范详尽）
- `web/classic/AGENTS.md` — 经典主题（React 18 + Vite + Semi Design）
- `website/AGENTS.md` — 独立官网（Next.js 16 standalone Node 应用；SEO/营销/法务/定价/博客；**新增/修改公开页必读**，→ Rule 9）

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **new-api** (44712 symbols, 145081 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/new-api/context` | Codebase overview, check index freshness |
| `gitnexus://repo/new-api/clusters` | All functional areas |
| `gitnexus://repo/new-api/processes` | All execution flows |
| `gitnexus://repo/new-api/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
