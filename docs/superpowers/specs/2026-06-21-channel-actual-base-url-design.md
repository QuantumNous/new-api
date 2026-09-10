# 渠道展示地址与真实请求地址分离 — 移植设计方案

> 日期：2026-06-21
> 分支：custom（二次开发分支）
> 来源：移植自 `claude_code2/new-api-main` 已完整实现并带测试的 `feature/channel-actual-base-url`
> 状态：待评审

## 1. 背景与目标

渠道真正请求的上游地址（例如 `https://aws-external-anthropic.us-east-1.api.aws`）属于商业机密，不希望暴露给客户或普通管理员。本方案把渠道地址拆成两个：

- **展示地址**：所有管理员可见可改，用于界面、日志、错误信息、导出。
- **真实请求地址**：仅超级管理员（role=100）可见可改，服务端实际转发用。

目标：来源隐藏只在配置层、UI 层、常规接口层做，不做网络层劫持；旧渠道零影响、零迁移。

## 2. 核心设计决策

| 维度 | 决策 |
|------|------|
| 数据模型 | 沿用 `base_url` 当展示地址；新增一列 `actual_base_url`（`*string`, `text`, 默认空串） |
| 出站规则 | `actual_base_url` 非空 → 用它发请求；否则沿用 `base_url` |
| 权限 | 仅 `role>=100` 可见与可改 `actual_base_url`，后端强制校验，不只靠前端隐藏 |
| 脱敏 | 对非超管的所有出口（中继错误/渠道测试/日志/管理面）把真实地址替换回展示地址；**写库与服务器日志不脱敏**（Root 排错保留原文） |
| 前端范围 | classic + default 两套界面都加（仅超管可见输入框） |

## 3. 数据模型

`model/channel.go` 的 `Channel` 增加一列，并在 `GetBaseURL()` 附近新增三个取数方法：

```go
ActualBaseURL *string `json:"actual_base_url,omitempty" gorm:"column:actual_base_url;type:text;default:''"`

func (c *Channel) GetActualBaseURL() string  // actual，trim；nil 返回 ""
func (c *Channel) GetRuntimeBaseURL() string // actual 非空用 actual，否则 GetBaseURL() —— 出站用
func (c *Channel) GetDisplayBaseURL() string // 等于 GetBaseURL() —— 展示/脱敏用
```

- `*string` + `omitempty`：对非超管序列化时字段直接消失，而非空串。
- 迁移走现有 GORM AutoMigrate（`model/main.go`），新列 `DEFAULT ''`，SQLite/MySQL/PostgreSQL 均直接生效，零回填。

## 4. 后端改动清单

### 4.1 出站切换（本项目实际清单，最易漏）

所有"发请求"语义的 `channel.GetBaseURL()` 改成 `GetRuntimeBaseURL()`。本项目实测调用点（行号以实现时为准）：

- 参考仓库已覆盖、照改：`middleware/distributor.go`、`relay/relay_task.go`、`controller/channel.go`（拉模型/查余额多处）、`controller/channel-billing.go`、`controller/channel-test.go`、`controller/codex_usage.go`、`controller/ratio_sync.go`、`controller/task_video.go`、`controller/video_proxy.go`、`controller/video_proxy_gemini.go`、`relay/mjproxy_handler.go`
- ⚠️ **本项目独有、参考仓库清单没有、必须补改**：`controller/channel_upstream_update.go`、`service/task_polling.go`
- ⚠️ **本项目比参考多一处调用**：`video_proxy_gemini.go`、`relay/relay_task.go`、`relay/mjproxy_handler.go`

> 实现时用 `grep -rn "GetBaseURL()" controller middleware relay service` 全量复查，逐个判断"出站"还是"纯展示/日志"。出站改 runtime；纯日志打印（如 mjproxy 的 LogDebug）保留 display。

### 4.2 上下文键与 RelayInfo

- `constant/context_key.go`：新增 `ContextKeyChannelDisplayBaseUrl`。
- `relay/common/relay_info.go`：`ChannelMeta` 新增 `ChannelDisplayBaseUrl string`，在初始化处从 context 读取，`ToString` 一并输出。
- `middleware/distributor.go` 出站注入点同时写入 runtime（`ContextKeyChannelBaseUrl`）与 display（`ContextKeyChannelDisplayBaseUrl`）。

### 4.3 脱敏服务（新文件 `service/channel_sanitize.go`）

```go
func SanitizeForChannel(channelID int, msg string) string      // 走 model.CacheGetChannel
func SanitizeWithPair(actual, display, msg string) string       // 热路径，已持有 (actual,display)
```

替换逻辑：先整串替换 actual→display，再做裸 host 替换；`actual==""` 或 `actual==display` 时短路返回。直接照搬参考仓库最终版（已处理"二次替换损坏"边界）。

### 4.4 CRUD 权限与字段隐藏（`controller/channel.go`）

- 新增 `isRoot(c)` 与 `stripActualBaseURL(channels)` 辅助。
- `GetAllChannels` / `SearchChannels`：非超管把切片里 `ActualBaseURL` 置 nil。
- `GetChannel`：非超管把 `ActualBaseURL` 置 nil。
- `AddChannel`：非超管强制把入参 `ActualBaseURL` 置 nil。
- `UpdateChannel`（关键）：非超管更新时用 GORM `Omit("ActualBaseURL")` 保护该列——**入参带不带该字段都不会改动数据库已有值**。需核对本项目 `Update()` 签名与调用点，按参考思路新增带 Omit 的更新路径，不破坏其他调用方。
- 超管把 `actual_base_url` 显式设空字符串 → 用 `Select` 显式清列。
- `channel-test.go`：测试请求改用 `GetRuntimeBaseURL()`（真正打真实地址），返回前对非超管脱敏。
- 各管理面 controller 的错误返回、`log.go` 的日志查询：对非超管走脱敏。

## 5. 前端改动（两套）

### 5.1 classic（照搬）

`web/classic/src/components/table/channels/modals/EditChannelModal.jsx`：与参考仓库 `web/src` 结构一致，照搬——在 base_url 下追加 `actual_base_url` 输入框，仅 `role===100` 渲染；编辑时超管预填、提交时仅超管带入 payload。

### 5.2 default（重新适配）

本项目新架构（TypeScript + Base UI），集成点已确认：

- `lib/channel-form.ts`：schema 加 `actual_base_url: z.string().optional()`；默认值加 `actual_base_url: ''`；`transformChannelToFormDefaults` 加映射；`transformFormDataToCreate/UpdatePayload` 加序列化。
- `components/drawers/channel-mutate-drawer.tsx` 的 `ChannelApiAccessSection`：在 base_url 区域后加**一个统一的** `FormField`（不分渠道类型共用），用 `useAuthStore(s => s.auth.user?.role === ROLE.SUPER_ADMIN)` 判断，仅超管渲染。
- i18n：`web/default/src/i18n/locales/{zh,en}.json` 加 key（英文 key 作为源串）。

## 6. 验收标准

1. 超管配展示地址 `platform.claude.com`、真实地址 `aws-xxx.aws`，普通管理员列表/详情只能看到展示地址，返回 JSON 不含 `actual_base_url` 键。
2. 服务端实际出站目标为真实地址。
3. 普通管理员编辑渠道不会覆盖或清空已有真实地址。
4. **普通管理员可以修改展示地址（base_url），但只要真实地址非空，实际出站仍钉在真实地址上**（用户明确关心的场景，作为显式测试）。
5. 渠道测试失败时，普通管理员看到的错误不含真实地址。
6. 日志查询、toast 中不出现真实地址。
7. 未配置真实地址的旧渠道行为 100% 不变。

## 7. 测试计划

- `tests/model/`：`GetRuntimeBaseURL`/`GetDisplayBaseURL`/`GetActualBaseURL` 四种组合。
- `tests/service/`：sanitizer 整串替换、裸 host 替换、空值/相等短路、多次出现、含端口路径。
- `tests/controller/`：非超管不能写/不能清空、超管可改可清空、返回 JSON 字段隐藏、第 6 节场景 4 的"改显示不动真实"。
- 构建：后端 `go test`，前端 default `bun run build`（按本项目实际方式执行）。

## 8. 与参考仓库的差异与风险

- **行号全面不同**：参考实施计划的精确行号不可直接套用，需在本项目重新定位。
- **出站点不完全重合**：本项目多出 `channel_upstream_update.go`、`service/task_polling.go` 等，漏改会导致真实地址不生效或泄露——这是首要风险，靠全量 grep 复查兜底。
- **default 前端无现成代码**：需新写，是主要工作量与不确定点。
- **品牌保护**：移植中不得改动 `new-api`/`QuantumNous` 任何标识；不动官方 `CLAUDE.md`、`.gitignore`、官方 workflow。
- 回滚极轻量：单字段、单逻辑分支，删列即可。

## 9. 不在本期范围

- 渠道列表新增"真实地址"独立列。
- `actual_base_url` 多 URL 负载均衡（anyrouter 多 URL 场景下配真实地址会覆盖多 URL，需在输入框旁加文案提醒）。
- 服务端 stdout 脱敏（运维持 shell 仍可见，明确接受）。
