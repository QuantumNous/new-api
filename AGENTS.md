# AGENTS.md — new-api 项目约定

## 项目概览

这是一个使用 Go 构建的 AI API 网关/代理。它将 OpenAI、Claude、Gemini、Azure、AWS Bedrock 等 40 多个上游 AI 提供商聚合到统一 API 后面，并提供用户管理、计费、限流和管理后台。

## 技术栈

- **后端**：Go 1.22+、Gin Web 框架、GORM v2 ORM
- **前端**：React 18、Vite、Semi Design UI（@douyinfe/semi-ui）
- **数据库**：SQLite、MySQL、PostgreSQL（三者都必须支持）
- **缓存**：Redis（go-redis）+ 内存缓存
- **认证**：JWT、WebAuthn/Passkeys、OAuth（GitHub、Discord、OIDC 等）
- **前端包管理器**：Bun（优先于 npm/yarn/pnpm）

## 架构

分层架构：Router -> Controller -> Service -> Model

```
router/        — HTTP 路由（API、relay、dashboard、web）
controller/    — 请求处理器
service/       — 业务逻辑
model/         — 数据模型和数据库访问（GORM）
relay/         — AI API relay/proxy，包含提供商适配器
  relay/channel/ — 各提供商适配器（openai/、claude/、gemini/、aws/ 等）
middleware/    — 认证、限流、CORS、日志、分发
setting/       — 配置管理（ratio、model、operation、system、performance）
common/        — 通用工具（JSON、crypto、Redis、env、rate-limit 等）
dto/           — 数据传输对象（request/response struct）
constant/      — 常量（API 类型、渠道类型、上下文 key）
types/         — 类型定义（relay 格式、文件来源、错误）
i18n/          — 后端国际化（go-i18n，en/zh）
oauth/         — OAuth 提供商实现
pkg/           — 内部包（cachex、ionet）
web/           — React 前端
  web/src/i18n/  — 前端国际化（i18next，zh/en/fr/ru/ja/vi）
```

## 国际化（i18n）

### 后端（`i18n/`）
- 库：`nicksnyder/go-i18n/v2`
- 语言：en、zh

### 前端（`web/src/i18n/`）
- 库：`i18next` + `react-i18next` + `i18next-browser-languagedetector`
- 语言：zh（fallback）、en、fr、ru、ja、vi
- 翻译文件：`web/src/i18n/locales/{lang}.json` — 扁平 JSON，key 为中文源文本
- 用法：使用 `useTranslation()` hook，在组件中调用 `t('中文key')`
- Semi UI locale 通过 `SemiLocaleWrapper` 同步
- CLI 工具：`bun run i18n:extract`、`bun run i18n:sync`、`bun run i18n:lint`

## 规则

### 规则 0：本地验证 —— 禁止使用 SQLite

在此工作区中，Agent 在任何本地运行、验证、调试、复现或自动化测试执行中都**不得**使用 SQLite。需要数据库的测试只能使用 MySQL 或 PostgreSQL，并且必须显式设置 `TEST_SQL_DSN`。

本规则约束的是 Agent 在此工作区中的操作方式。除非用户明确改变产品要求，否则产品代码和迁移仍必须同时兼容 SQLite、MySQL 和 PostgreSQL。

### 规则 1：JSON 包 —— 使用 `common/json.go`

所有 JSON marshal/unmarshal 操作都**必须**使用 `common/json.go` 中的包装函数：

- `common.Marshal(v any) ([]byte, error)`
- `common.Unmarshal(data []byte, v any) error`
- `common.UnmarshalJsonStr(data string, v any) error`
- `common.DecodeJson(reader io.Reader, v any) error`
- `common.GetJsonType(data json.RawMessage) string`

不要在业务代码中直接导入或调用 `encoding/json`。这些包装函数用于保证一致性，并为未来扩展（例如替换为更快的 JSON 库）预留空间。

注意：`json.RawMessage`、`json.Number` 以及 `encoding/json` 中的其他类型定义仍可作为类型引用，但实际 marshal/unmarshal 调用必须走 `common.*`。

### 规则 2：数据库兼容性 —— SQLite、MySQL >= 5.7.8、PostgreSQL >= 9.6

所有数据库代码都**必须**同时完整兼容这三种数据库。

**使用 GORM 抽象：**
- 优先使用 GORM 方法（`Create`、`Find`、`Where`、`Updates` 等），而不是原始 SQL。
- 让 GORM 处理主键生成，不要直接使用 `AUTO_INCREMENT` 或 `SERIAL`。

**必须使用原始 SQL 时：**
- 列引用方式不同：PostgreSQL 使用 `"column"`，MySQL/SQLite 使用 `` `column` ``。
- 对 `group`、`key` 等保留字列，使用 `model/main.go` 中的 `commonGroupCol`、`commonKeyCol` 变量。
- 布尔值不同：PostgreSQL 使用 `true`/`false`，MySQL/SQLite 使用 `1`/`0`。使用 `commonTrueVal`/`commonFalseVal`。
- 使用 `common.UsingPostgreSQL`、`common.UsingSQLite`、`common.UsingMySQL` 标志分支处理数据库特定逻辑。

**没有跨库 fallback 时禁止使用：**
- MySQL 专用函数（例如没有 PostgreSQL `STRING_AGG` 等价实现的 `GROUP_CONCAT`）
- PostgreSQL 专用操作符（例如 `@>`、`?`、`JSONB` 操作符）
- SQLite 不支持的 `ALTER COLUMN`（应使用添加列等兼容方案）
- 没有 fallback 的数据库专用列类型，JSON 存储使用 `TEXT` 而不是 `JSONB`

**迁移：**
- 确保所有迁移都能在三种数据库上运行。
- 对 SQLite，使用 `ALTER TABLE ... ADD COLUMN`，而不是 `ALTER COLUMN`（参考 `model/main.go` 中的模式）。

### 规则 3：前端 —— 优先使用 Bun

前端（`web/` 目录）优先使用 `bun` 作为包管理器和脚本运行器：
- `bun install` 安装依赖
- `bun run dev` 启动开发服务器
- `bun run build` 构建生产版本
- `bun run i18n:*` 运行 i18n 工具

### 规则 4：新渠道的 StreamOptions 支持

实现新渠道时：
- 确认提供商是否支持 `StreamOptions`。
- 如果支持，将该渠道加入 `streamSupportedChannels`。

### 规则 5：上游 Relay 请求 DTO —— 保留显式零值

对于从客户端 JSON 解析后又重新 marshal 给上游提供商的请求结构体（尤其是 relay/convert 路径）：

- 可选标量字段**必须**使用带 `omitempty` 的指针类型（例如 `*int`、`*uint`、`*float64`、`*bool`），不要使用非指针标量。
- 语义必须是：
  - 客户端 JSON 中字段缺失 => `nil` => marshal 时省略；
  - 客户端显式设置为零值/false => 非 `nil` 指针 => 必须继续发送给上游。
- 避免对可选请求参数使用带 `omitempty` 的非指针标量，因为零值（`0`、`0.0`、`false`）会在 marshal 时被静默丢弃。

### 规则 6：Agent 执行焦点 —— 只允许一个活动目标

在此仓库中作为 AI 编码代理工作时，你必须始终锁定用户最新的明确目标。专注是硬性执行规则，不是风格建议。

**单目标执行：**
- 任意时刻都只能存在一个活动中的用户目标。
- 活动目标必须来自用户最近一次清晰的指令或纠正。
- 除非用户再次明确提出，否则不要继续旧目标、支线任务或后台清理。

**当用户打断或纠正时：**
- 如果用户表示任务变了、你跑偏了，或要求停止，立即放弃之前的目标。
- 立即丢弃为旧目标创建的任何过期任务列表、TODO 列表或进度状态。
- 不要继续为已放弃的目标运行构建、lint、搜索、编辑或后续命令。

**在每次工具调用或代码编辑之前：**
- 用一句简短更新说明：
  - 当前目标；
  - 将要涉及的确切文件或命令；
  - 为什么该操作与当前目标直接相关。
- 如果你无法用一句话解释这种直接关系，就不要执行该操作。

**任务列表约束：**
- 只展示属于当前目标的任务。
- 不要把历史任务和当前任务混在一起。
- 一旦目标变更，不要再展示之前的 UI 工作、无关清理或更早的功能任务等过期条目。

**允许的工作范围：**
- 优先选择能解决当前目标的最小闭环：
  - 找出相关代码；
  - 只编辑直接相关的文件；
  - 只运行直接相关的验证。
- 避免无关改进、顺手重构、样式微调，或“既然来了顺便做一下”的变更。

**禁止行为：**
- 不要把偏题操作解释为“遗留状态”“之前的计划”或“验证时顺便”。
- 不要汇报你并未实际执行的任务进度。
- 不要为无关文件或功能运行验证。
- 一旦用户缩小范围，不要继续保留早先回合中的后台意图。

### 规则 7：计费表达式系统 —— 阅读 `pkg/billingexpr/expr.md`

处理分层/动态计费（基于表达式的定价）时，必须先阅读 `pkg/billingexpr/expr.md`。该文档说明了设计理念、表达式语言（变量、函数、示例）、完整系统架构（编辑器 → 存储 → 预扣费 → 结算 → 日志展示）、token 归一化规则（`p`/`c` 自动排除）、额度换算和表达式版本管理。所有计费表达式系统相关代码变更都必须遵循该文档中的模式。
