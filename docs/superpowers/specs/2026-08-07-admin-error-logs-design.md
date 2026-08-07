# 管理端错误日志（Failed Requests）设计

日期：2026-08-07  
状态：已确认

## 目标

解决「用户调用直接报错，管理端看不到任何记录」的问题：对用户侧 API/Relay 失败请求统一落库，并在管理端提供独立页面与筛选（含「上游错误」单独筛选项），便于统计与排错。

## 背景与现状

- 用量/错误共用 `logs` 表，`type=5` 为 Error。
- 错误日志默认关闭：`ERROR_LOG_ENABLED` 默认 `false`（`common/init.go` → `constant.ErrorLogEnabled`）。
- 即使开启，仅 `controller/relay.go` 的 `processChannelError` 在「已选渠道后的上游失败」时写入；鉴权、限流、选渠、校验、预扣费等早退路径均不入库。
- 部分预扣费错误显式带 `ErrOptionWithNoRecordErrorLog()`，禁止记 Error。
- 管理端 Usage Logs 虽有 Error 类型筛选，但无独立错误页，且无 `error_category` 细分筛选。
- 用户侧日志 API（`/api/log/self`）本设计不展示 Error（仅管理员可见）。

## 范围

### 做

- 默认开启错误日志；系统设置可关；兼容环境变量 `ERROR_LOG_ENABLED`
- 扩展采集面：鉴权 / 限流 / 选渠 / 校验 / 额度 / 上游（及 Task、MJ 本地与上游失败补记）
- 继续使用 `logs` 表 `type=5`；在 `other` JSON 增加 `error_category`
- 管理端独立页面「错误日志」+ 分类等筛选（上游错误单独一项）
- 管理端专用查询 API（AdminAuth）
- 上游重试：每次上游失败各记一条，可用 `request_id` 关联

### 不做（首版）

- 用户自助查看失败日志
- 独立 `error_logs` 表
- 实时告警 / Webhook
- 按分类单独清理策略（复用现有按时间清理 `logs`）
- 连接级失败（TLS/断连，未进 Gin）
- 管理端/控制台自身 API 错误

## 方案选型

采用「扩展现有 `logs.type=5`」：

| 方案 | 结论 |
|------|------|
| 扩展 type=5 + 独立管理页 | **采用**：改动小，复用清理与模型 |
| 新建 error_logs 表 | 过重，与现有 Error 重复 |
| 仅文件日志检索 | 不满足管理端筛选与排错 |

## 错误分类（error_category）

写入 `other.error_category`，取值固定：

| key | 含义 | 典型场景 |
|-----|------|----------|
| `auth` | 鉴权失败 | 无效/过期 token、用户禁用、IP 限制 |
| `rate_limit` | 限流/过载 | 模型限流、全局限流、系统性能拒绝 |
| `channel` | 渠道选择失败 | 无可用渠道、模型无权、渠道禁用 |
| `validation` | 请求校验失败 | 参数错误、敏感词、估价失败、body 过大 |
| `quota` | 额度/预扣费失败 | 余额不足、token 额度不足 |
| `upstream` | 上游/渠道调用失败 | 已选渠道后上游报错（含重试中的失败） |
| `other` | 其它 | 未归入以上的本地错误 |

前端筛选下拉使用上述 key；「上游错误」对应 `upstream`。

## 数据模型

不改表结构。继续 `model.Log`：

- `type = 5`（`LogTypeError`）
- 字段尽量填充：`user_id`、`username`、`token_name`、`token_id`、`model_name`、`channel_id`、`group`、`ip`、`request_id`、`upstream_request_id`、`use_time`、`is_stream`、`content`
- 鉴权失败时 user/token 可能为空，列表展示 `-`
- `other`（JSON）至少包含：
  - `error_category`（必填）
  - `error_type` / `error_code` / `status_code`（有则写）
  - `request_path`（有则写）
  - 现有 `admin_info`（`use_channel`、multi-key、affinity 等，有则写）

消费统计、用户日志查询继续排除或不返回 `type=5`（与「仅管理员可见」一致）。

## 写入设计

### 统一入口

扩展现有 `model.RecordErrorLog`（或新增薄封装 `RecordRequestErrorLog`）：

- 受 `ErrorLogEnabled` 控制（默认 true）
- 必传 `error_category`
- 从 `gin.Context` 尽量补齐上下文
- 尊重 `types.IsRecordErrorLog`：**首版对 quota 路径取消 `NoRecordErrorLog` 限制**，使额度不足可入库；若某类错误未来需静默，再按 category 配置

### 挂钩点

| 位置 | category |
|------|----------|
| Token/用户鉴权中间件失败 | `auth` |
| 限流 / 性能过载中间件 | `rate_limit` |
| Distribute 选渠失败 | `channel` |
| Relay 校验 / 敏感词 / 估价 / body | `validation` |
| 预扣费失败 | `quota` |
| `processChannelError` | `upstream` |
| Task/MJ 本地失败 | 对应 `channel` / `validation` / `other` |
| Task/MJ 上游失败 | `upstream` |

### 去重与重试

- 同一请求在中间件 Abort 后不应二次写入（避免中间件 + Relay 双记）
- 上游重试：每次失败各记一条 `upstream`，靠 `request_id` 关联排查

### 异步与性能

- 写入方式与现有 `RecordErrorLog` / `RecordConsumeLog` 保持一致（不额外引入队列）
- 失败写日志不得改变对用户返回的错误响应语义

## 配置

| 键 / 来源 | 含义 | 默认 |
|-----------|------|------|
| 系统设置 `ErrorLogEnabled` | 是否记录错误日志（持久化到 options） | `true` |
| 环境变量 `ERROR_LOG_ENABLED` | 仅作进程启动时的初始值；库中已有 option 时以 option 为准 | 缺省 `true`（行为变更：旧版缺省为 `false`，需在更新说明中写明） |

管理端「日志/维护」设置区增加开关，与 `LogConsumeEnabled` 并列。

## API（仅管理员）

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/error-log/` | 分页列表 + 筛选 |

首版不做 `/api/error-log/stat`；后续若要做分类汇总再加。

筛选参数（与 Usage Logs 风格对齐）：

- 时间范围
- `error_category`（含 `upstream`）
- 用户名 / 用户 ID
- 模型名
- 渠道 ID
- Token 名称
- `request_id`
- 关键词（匹配 `content`）

鉴权：`AdminAuth`。  
清理：首版复用 `DELETE /api/log/`（按时间清理，含 Error）；文档说明 Error 与 Consume 同表。

实现上可复用 `controller/log.go` / `model.GetAllLogs` 逻辑，强制 `type=5`，并增加按 `other` 内 `error_category` 过滤（注意 SQLite / MySQL / PostgreSQL 兼容：优先在应用层过滤，或使用各库可接受的 JSON/LIKE 策略；若性能不足再加生成列/索引——首版以正确性优先）。

## 前端（web/default）

- 侧栏新增「错误日志」入口（仅管理员），路由例如 `/error-logs`
- 独立功能目录（可参考 `features/usage-logs`）：表格 + 筛选栏 + 详情/展开
- 列表列：时间、Request ID、用户、Token、模型、分组、渠道、错误分类标签、状态码/error_code、错误摘要、耗时、流式、路径
- 筛选：时间、**错误分类（上游错误单独可选）**、用户、模型、渠道、Token、Request ID、关键词
- i18n：按项目惯例用英文 key + `bun run i18n:sync`（或技能流程）补全 locale
- Classic 主题：首版只做 `web/default`；Classic 不在首版范围

## 可见性规则

- 管理端错误日志页 + `/api/error-log/*`：仅管理员
- `/api/log/self` 及用户 Usage Logs：**不返回 / 不展示** `type=5`
- 管理端 Usage Logs：保留对 `type=5` 的展示与筛选（兼容旧习惯）；主排查入口为独立错误页（支持 `error_category`）

## 验收标准

1. 默认开启后：无效 token、无可用渠道、余额不足、上游 5xx 等均可在错误日志页查到，且 category 正确
2. 筛选「上游错误」仅显示 `upstream`
3. 用户侧用量日志看不到 Error
4. 关闭 `ErrorLogEnabled` 后不再新写入
5. 记日志不改变原有错误响应；不引入独立表迁移失败
6. SQLite / MySQL / PostgreSQL 查询与筛选可用

## 风险与注意

- 默认开启后 Error 写入量上升，依赖现有日志清理；需在设置/文档中提示定期清理
- `other` 内 JSON 筛选跨库兼容需谨慎，避免 PostgreSQL 专用 JSONB 运算符而无 SQLite/MySQL 回退
- 鉴权失败高频时可能噪音大；首版仍记录（产品已确认 C 类全覆盖 + 默认开）；若后续需降噪，再按 category 可配置开关

## 实现顺序建议

1. 配置默认开启 + 设置项 UI
2. 统一写入入口与 `error_category`
3. 中间件与 Relay 早退挂钩
4. 管理端 API
5. 独立前端页面与筛选
6. Task/MJ 补记与回归验收
