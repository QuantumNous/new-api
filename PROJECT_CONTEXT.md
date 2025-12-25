# PROJECT_CONTEXT

本文档用于快速理解仓库的“特点与环境信息（开发/构建/CI）”，便于后续维护与交接。

## 1) 项目概览

- 后端：Go（Gin）服务，统一入口为 [`main()`](main.go:39)，路由装配通过 [`router.SetRouter()`](main.go:157) 且 API 路由在 [`SetApiRouter()`](router/api-router.go:11) 下挂载 `/api/*`。
- 前端：Web 前端位于 [`web/`](web/package.json:1)，构建产物会被嵌入后端二进制：[`//go:embed web/dist`](main.go:33) 与 [`//go:embed web/dist/index.html`](main.go:36)。
- 前端 UI：使用 Vite 构建（见 `scripts.build`）与 Semi UI 组件库依赖：[`"build": "vite build"`](web/package.json:48)、[`"@douyinfe/semi-ui"`](web/package.json:8)。

## 2) 本次新增/差异能力摘要（相对上游）

以下能力为本仓库与上游差异点汇总，详细条目来源见 [`Difference.md`](Difference.md:1)：

1. 模型健康度（分时间片统计成功率）：后端提供小时维度查询 API：[`GetModelHealthHourlyStatsAPI()`](controller/model_health.go:28)，路由为 [`/api/model_health/hourly`](router/api-router.go:273)。
2. RPM 豁免：在模型请求限流中间件中支持对特定用户进行豁免：[`ModelRequestRateLimit()`](middleware/model-rate-limit.go:167) 与 [`setting.IsModelRequestRateLimitExemptUser()`](middleware/model-rate-limit.go:176)（用于“管理员豁免用户限速 RPM”的场景）。
   - 回归点：管理后台“RPM 豁免用户”保存不应提示“你似乎并没有修改什么”；文本域修改后应触发 `/api/option/` 更新 `ModelRequestRateLimitExemptUserIDs`。
   - 验证方式：保存后对目标用户发起请求，响应应包含 `X-RateLimit-Bypass: ModelRequestRateLimit`（命中豁免）。
3. 最近调用缓存（最近 100 次请求/返回含错误与上游流式片段）：核心实现为 [`RecentCallsCache()`](service/recent_calls_cache.go:116)，支持在请求生命周期内写入错误与响应：[`UpsertErrorByContext()`](service/recent_calls_cache.go:196)、[`UpsertUpstreamResponseByContext()`](service/recent_calls_cache.go:218)、[`AppendStreamChunkByContext()`](service/recent_calls_cache.go:283)。
4. 用户小时排行（按小时 bucket 统计并排序）：后端接口为 [`GetUserHourlyCallsRankAPI()`](controller/user_rank.go:25)，路由为 [`/api/user_rank/hourly_calls`](router/api-router.go:270)。
5. 随机兑换码：见差异说明条目（实现点在 [`Difference.md`](Difference.md:7) 中列出，用于后续在对应 controller/service/model 里定位）。
6. role 映射（模型自定义角色转换）：实现为 [`ApplyModelRoleMappingsToRequest()`](service/model_role_mapping.go:134)，配置项 key 为 [`OptionKeyModelRoleMappings`](service/model_role_mapping.go:15)。
7. 强制在日志记录 IP：见差异说明条目（实现点在 [`Difference.md`](Difference.md:9) 中列出，用于后续追踪 middleware/logger 相关改动）。

## 3) 本地环境要点（Windows 11 / PowerShell / Go 缓存权限）

默认开发环境假设：
- OS：Windows 11
- Shell：PowerShell（pwsh）

常见问题与建议：
- Go module/cache 权限问题：在 Windows 下，如果默认的 Go cache 目录位于受控目录（例如 OneDrive 同步目录或受权限限制的路径），可能出现写入失败/权限拒绝。
- 建议将 Go 缓存与工具链目录显式指向可写位置（例如 `C:\Users\hello\AppData\Local\...` 或自定义 `D:\go-cache\...`）：
  - `GOMODCACHE`：module 下载缓存
  - `GOCACHE`：编译缓存
  - `GOTOOLCHAIN`：工具链模式（例如 `auto` / `local`，按团队策略统一）
- 项目使用 Go Modules：[`go.mod`](go.mod:1)。

备注：以上是面向“减少权限/路径问题”的通用建议，不改变仓库业务逻辑即可在开发机侧解决。

## 4) 前端构建要点（Vite / npm install vs npm ci / build）

- 前端目录：[`web/package.json`](web/package.json:1)。
- 构建命令：[`npm run build`](web/package.json:48)（等价于 `vite build`）。
- 依赖安装策略（CI 与本地一致性）：
  - 若存在 lockfile（例如 `package-lock.json`），CI/可复现构建优先使用 `npm ci`（严格按 lockfile 安装）。
  - 若没有 lockfile 或需要更新依赖树，使用 `npm install` 生成/更新 lockfile 后再提交。
- 后端嵌入前端产物：构建后需生成 `web/dist`，由 [`//go:embed web/dist`](main.go:33) 打包进二进制。

## 5) CI / 发布要点（GHCR workflow / tag 触发 / 镜像命名）

- GHCR 发布 workflow：[`Publish Docker image to GHCR`](.github/workflows/ghcr-publish.yml:1)。
- 触发规则：
  - push tag：匹配 [`"v*"`](.github/workflows/ghcr-publish.yml:6) 时触发
  - 手动触发：[`workflow_dispatch`](.github/workflows/ghcr-publish.yml:7)
- tag 规则与 `latest`：
  - workflow 会检测是否为 semver tag：[`Detect semver tag`](.github/workflows/ghcr-publish.yml:20)（仅 `vX.Y.Z` 视为 semver：[`^v[0-9]+\.[0-9]+\.[0-9]+$`](.github/workflows/ghcr-publish.yml:24)）。
  - 只有 semver tag 才会额外推送 `latest`：[`enable=${{ env.IS_SEMVER == 'true' }}`](.github/workflows/ghcr-publish.yml:50)。
- 镜像地址格式：
  - 镜像仓库：[`ghcr.io/${{ github.repository }}`](.github/workflows/ghcr-publish.yml:47)
  - tags 由 metadata action 生成并用于 build-push：[`tags: ${{ steps.meta.outputs.tags }}`](.github/workflows/ghcr-publish.yml:59)
- 构建平台：[`linux/amd64,linux/arm64`](.github/workflows/ghcr-publish.yml:57)（使用 QEMU + Buildx：[`Set up QEMU`](.github/workflows/ghcr-publish.yml:30)、[`Set up Docker Buildx`](.github/workflows/ghcr-publish.yml:33)）。