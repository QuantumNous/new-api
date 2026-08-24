# 渠道最大并发显式清零修复 — 设计 Spec

日期：2026-08-17

模块：`controller/channel.go`、`model/channel.go`、渠道更新回归测试

状态：设计已与用户确认，待书面规格复核后编写实现计划

## 1. 问题与根因

管理员把渠道 `max_concurrency` 从非零值改为 `0` 时，更新接口返回成功，但数据库仍保留旧值。

请求数据已经正确携带 `"max_concurrency": 0`，问题发生在 model 层：
`Channel.Update()` 使用 GORM 的 `Updates(struct)`。GORM 默认跳过结构体中的零值字段，因此
`0` 没有进入生成的 `UPDATE` 语句。

该接口还支持局部更新。请求未携带 `max_concurrency` 时，绑定后的 Go 字段同样是 `0`。因此
不能简单让 `Channel.Update()` 每次都写入该列，否则只编辑渠道名称、权重等其他字段时，会把
已有并发限制误清零。

## 2. 目标与语义

需要保持以下三种行为：

1. 请求明确携带 `max_concurrency: 0`：数据库写入 `0`，表示取消渠道并发限制。
2. 请求未携带 `max_concurrency`：数据库保留原值，继续维持局部更新语义。
3. 请求明确携带正整数：数据库正常更新为新值；负数仍由现有校验拒绝。

非目标：

- 不重构整个渠道更新 DTO。
- 不改变其他字段的零值/缺省值语义。
- 不调整渠道并发控制、等待队列或 429 行为。
- 不修改渠道 14、53 或任何生产配置。

## 3. 设计

### 3.1 Controller：识别字段是否明确出现

`UpdateChannel` 使用 Gin 1.9.1 已有的 `ShouldBindBodyWith(..., binding.JSON)` 读取同一请求体：

- 第一次绑定到现有 `PatchChannel`，保持当前校验和更新流程。
- 第二次绑定到只包含 `*int MaxConcurrency` 的轻量 presence 结构。

指针语义为：

- JSON 字段缺省或 `null`：`nil`，按“未修改”处理。
- JSON 明确传 `0`：非 `nil` 且值为 `0`。
- JSON 明确传正/负整数：非 `nil` 且保留原值，现有 `validateChannel` 继续负责范围校验。

该方式不会给 `PatchChannel` 增加同名 JSON 字段，因此不会改变成功响应的数据结构。

### 3.2 Model：为明确更新提供专用入口

保留现有 `Channel.Update()` 的调用方式和默认行为，并新增
`Channel.UpdateWithMaxConcurrency()`。两个公开方法复用私有的
`channel.update(forceMaxConcurrency bool)` 实现：

- 普通 `Update()`：继续执行现有 `Updates(struct)`，未传字段不会被零值覆盖。
- `UpdateWithMaxConcurrency()`：在现有结构体更新后，额外执行
  `Update("max_concurrency", channel.MaxConcurrency)`，从而允许写入 `0`。

只有 Controller 确认请求明确携带该字段时，才调用专用入口。

### 3.3 原子性与缓存

明确更新路径中的以下操作放在同一个数据库事务里：

1. 当前结构体字段更新。
2. `max_concurrency` 强制更新（包括零值）。
3. 回读完整渠道记录。
4. 更新渠道 abilities。

任一步失败都回滚，接口返回现有统一错误响应。普通 `Update()` 调用者保持当前行为，避免把本次
修复扩大成全局事务语义变更。

事务成功后继续调用现有 `publishChannelsChanged()`。Controller 继续执行
`model.InitChannelCache()` 和 `service.ResetProxyClientCache()`，因此本节点立即刷新，其他生产
节点通过 Redis Pub/Sub 收到渠道配置失效通知，并保留现有 60 秒同步兜底。

数据库操作全部使用 GORM 抽象，兼容 SQLite、MySQL 和 PostgreSQL。

## 4. 错误处理

- JSON 绑定失败：沿用 `common.ApiError`。
- `max_concurrency < 0`：沿用 `validateChannel` 的现有错误。
- 数据库更新或 abilities 更新失败：事务回滚并沿用 `common.ApiError`。
- 字段缺省或 `null`：不强制写列，不产生新的错误。

## 5. 测试设计

新增 Controller 级 SQLite 回归测试，直接调用真实 `UpdateChannel` 和 model 层，不模拟 GORM：

1. 数据库初值为 `10`，请求明确传 `0`，断言接口成功且数据库值为 `0`。
2. 数据库初值为 `10`，请求只修改其他字段，断言其他字段更新且并发值仍为 `10`。
3. 数据库初值为 `10`，请求明确传正整数，断言数据库更新为新值。
4. 保留现有负数校验测试。

实施严格采用 RED → GREEN：先在未修复代码上观察第 1 项因数据库仍为 `10` 而失败，再写最小
实现；随后运行新增测试、`go test ./model/...`、相关 Controller 测试及构建检查。

当前 `origin/main@ec2e30d12` 的干净工作树基线：

- `go test ./model/...`：通过。
- `go test ./controller/...`：已有与本修复无关的
  `TestStripeCheckoutSessionEmbeddedModeUsesReturnURL` 失败；期望 URL 未带参数，而当前实现返回
  带 `session_id` 和 `trade_no` 的 URL。本修复不修改 Stripe 代码，最终报告会单独标注该既有
  基线失败，并用目标测试及可归因检查证明本次变更。

## 6. 风险与部署

- 主要风险是错误区分“未传”与“明确传 0”；Controller 级三态测试覆盖该风险。
- 事务只用于明确更新 `max_concurrency` 的路径，其他 `Channel.Update()` 调用者不受影响。
- 不涉及 schema 迁移。
- `Router deploy`：required。Router 节点读取渠道并发配置执行 `/v1` 请求的容量控制，必须部署
  新后端代码才能使用修正后的数据库值。
- 其他部署目标：`newapi-console` 需要部署以修复管理接口；使用同一 Go 二进制的 legacy
  `newapi` 也应同步。`newapi-web`、Terraform、Cloudflare 不涉及。
- 最小发布验证：在 staging 将测试渠道从正整数设为 `0`，重新读取数据库/API 后确认值为 `0`，
  并确认该渠道不再触发配置的并发上限；无需再使用生产渠道 14 或 53 做修复验证。
