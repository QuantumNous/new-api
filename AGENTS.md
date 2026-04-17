# AGENTS.md — new-api AI 二开统一执行规范

## 1. 规范定位

本文件是当前仓库内 **唯一权威的 AI 协作规范源**。所有 Codex / Claude 二开任务都必须先阅读本文件，再阅读：

1. `docs/ai/AI_TASK_TEMPLATE.md`
2. `docs/ai/AI_CHANGE_CHECKLIST.md`
3. `docs/ai/UPSTREAM_SYNC_RULES.md`（仅在同步官方更新时）

`CLAUDE.md` 仅作为 Claude 的入口适配文件，不再维护重复规范。这样做符合 `DRY`，直接收益是规则只维护一份，避免多文件漂移导致执行不一致。

---

## 2. 项目概览

### 技术栈

- 后端：Go 1.25+、Gin、GORM v2
- 前端：React 18、Vite、Semi Design UI
- 数据库：SQLite、MySQL、PostgreSQL
- 缓存：Redis + 内存缓存
- 认证：JWT、WebAuthn、OAuth/OIDC
- 前端包管理器：`bun`

### 架构分层

采用分层架构：`Router -> Controller -> Service -> Model`

```text
router/        HTTP 路由
controller/    请求处理
service/       业务逻辑
model/         数据模型与数据库访问
relay/         上游 AI 渠道适配与中继
middleware/    鉴权、限流、日志等中间件
setting/       系统配置
common/        通用能力
dto/           请求/响应对象
constant/      常量定义
types/         类型定义
oauth/         OAuth 实现
pkg/           内部通用包
web/           React 前端
```

这样做符合 `SOLID` 中的单一职责原则，直接收益是 AI 在改动时更容易定位边界，减少跨层污染和错误修改。

---

## 3. AI 任务工作流

### 3.1 开工前必须先输出的内容

AI 在开始修改代码前，必须显式给出以下内容，且建议直接按 `docs/ai/AI_TASK_TEMPLATE.md` 填写：

1. 任务目标
2. 成功标准
3. 本次范围
4. 本次明确不做什么
5. 影响模块 / 影响层次
6. 计划执行的验证方式
7. 本次需要特别遵守的项目规则

这样做符合 `KISS` 和 `YAGNI`，直接收益是任务边界更清楚，减少“顺手多改”的范围蔓延。

### 3.2 完成后必须输出的内容

AI 在提交结果时，必须显式给出：

1. 本次完成的核心改动
2. `KISS / YAGNI / DRY / SOLID` 的具体落地说明
3. 已执行的验证命令与结果
4. 已知风险 / 未覆盖点
5. 下一步建议

这样做符合 `SOLID` 中职责清晰和可验证的思想，直接收益是 review 更高效，便于追踪变更质量。

---

## 4. 通用硬规则

### 4.1 设计原则

所有任务都必须遵守以下原则：

- `KISS`：优先最简单可验证方案，禁止无必要复杂化。
- `YAGNI`：只实现当前明确需要的能力，禁止超前设计。
- `DRY`：优先复用现有能力，避免重复逻辑和双份规则。
- `SOLID`：保持清晰分层、稳定接口和低耦合实现。

### 4.2 沟通与提交语言

- Issue、PR 描述、评审意见、AI 回复默认使用简体中文。
- 代码标识符、命令、日志、报错保持原文。

### 4.3 文件编码

- 所有新增或修改文件必须使用 **UTF-8（无 BOM）**。
- 禁止提交 GBK、ANSI、UTF-8 BOM、乱码文件。

这样做符合 `KISS`，直接收益是跨平台协作更稳定，避免编码问题引发的隐性故障。

---

## 5. 项目特定强制规则

### 规则 1：JSON 统一走 `common/json.go`

所有 JSON marshal / unmarshal / decode 操作必须使用 `common/json.go` 中的封装函数：

- `common.Marshal`
- `common.Unmarshal`
- `common.UnmarshalJsonStr`
- `common.DecodeJson`
- `common.GetJsonType`

禁止在业务代码中直接调用 `encoding/json` 的 marshal / unmarshal / encoder / decoder。

允许的例外：

- `common/json.go` 自身
- 仅使用 `json.RawMessage`、`json.Number` 等类型定义

这样做符合 `DRY`，直接收益是统一行为入口，便于后续替换 JSON 库和统一问题排查。

### 规则 2：数据库必须同时兼容 SQLite / MySQL / PostgreSQL

所有数据库代码必须默认同时兼容：

- SQLite
- MySQL >= 5.7.8
- PostgreSQL >= 9.6

要求：

- 优先使用 GORM 抽象。
- 原始 SQL 必须考虑方言差异。
- 需要引用 `group` / `key` 这类保留字时，使用 `model/main.go` 中已有约定。
- 布尔值、JSON 存储、列变更语义必须有跨库兜底。

禁止：

- 无 fallback 的 MySQL/PostgreSQL 专属函数或操作符
- SQLite 不支持的 `ALTER COLUMN`
- 只适用于单一数据库的迁移实现

这样做符合 `SOLID` 和 `KISS`，直接收益是减少环境差异导致的回归问题。

### 规则 3：前端统一使用 `bun`

`web/` 目录下必须使用：

- `bun install`
- `bun run dev`
- `bun run build`
- `bun run lint`
- `bun run eslint`
- `bun run i18n:*`

禁止把 `npm` / `yarn` 作为 `web/` 的默认工作流写入代码、文档、脚本或提示。

这样做符合 `KISS` 和 `DRY`，直接收益是前端工作流统一，避免团队和 AI 输出出现多套命令体系。

### 规则 4：新增 Channel 时检查 `StreamOptions`

实现新的 channel 时：

1. 必须先确认上游是否支持 `StreamOptions`
2. 如果支持，必须加入 `streamSupportedChannels`

这样做符合 `YAGNI`，直接收益是只在明确支持时扩展能力，同时避免遗漏已有能力注册点。

### 规则 5：受保护的项目信息不得修改或删除

以下项目标识是受保护内容，禁止修改、删除、替换或移除：

- `new-api` / `New API`
- `QuantumNous`
- 相关模块路径、镜像名、版权和项目归属标识

典型受保护位置包括但不限于：

- README / LICENSE / copyright
- Go module path / import path
- Docker 镜像名、部署配置
- 页面标题、元信息、关于页

这样做符合 `SOLID` 中的稳定契约思想，直接收益是避免二开时误破坏上游识别和项目归属信息。

### 规则 6：Relay DTO 必须保留显式零值

对于会被解析后再转发给上游的请求 DTO：

- 可选标量字段必须使用指针类型配合 `omitempty`
- 缺失字段应为 `nil`
- 显式传入的 `0` / `0.0` / `false` 必须能够继续传给上游

禁止用非指针标量字段配合 `omitempty` 表达“可选参数”。

这样做符合 `KISS`，直接收益是避免显式零值被静默吞掉，减少难排查的兼容问题。

### 规则 7：i18n 不能漏同步

前端涉及用户可见文案时：

- 必须检查是否需要同步 `web/src/i18n/locales/*.json`
- 必须运行 `bun run i18n:lint`

这样做符合 `DRY`，直接收益是多语言资源和 UI 文案保持一致，避免发布后出现漏翻译或 key 漏洞。

---

## 6. 变更必检项矩阵

| 变更类型 | 必检内容 |
| --- | --- |
| 后端 Go 代码 | `go test` 至少覆盖被改包；禁止直接使用 `encoding/json`；检查层次边界是否清晰 |
| DTO / Relay | 指针零值语义；上游字段透传；兼容已有请求格式 |
| 数据库 / Model | SQLite / MySQL / PostgreSQL 兼容；原始 SQL 风险；迁移策略 |
| 前端 `web/` | `bun run lint`、`bun run eslint`、`bun run build` |
| 前端文案 / i18n | `bun run i18n:lint`；必要时同步 locale 文件 |
| Docker / Compose / `.env.example` | 配置合法性；示例值合理；不破坏当前部署流程 |
| 文档 / 提示模板 / PR 说明 | 中文表达清晰；不要粘贴未经整理的 AI 输出；保持与本规范一致 |

这样做符合 `KISS` 和 `SOLID`，直接收益是每类改动都有明确的最小验证标准，降低遗漏概率。

---

## 7. Codex / Claude 的固定入口

所有 Codex / Claude 二开任务都必须遵循以下入口顺序：

1. 阅读 `AGENTS.md`
2. 按 `docs/ai/AI_TASK_TEMPLATE.md` 组织任务
3. 改动前根据 `docs/ai/AI_CHANGE_CHECKLIST.md` 确认检查项
4. 同步官方更新时额外遵循 `docs/ai/UPSTREAM_SYNC_RULES.md`

禁止裸提示直接要求 AI 改代码而不声明目标、范围和验证方式。

这样做符合 `DRY` 和 `YAGNI`，直接收益是后续每次任务都能复用统一骨架，减少上下文偏差。
