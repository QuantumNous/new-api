# 基于监控数据的动态调权与平台探活方案

## 背景

aiapi114 已接入 Ikun 与 Foxcode 的上游状态同步，监控数据会归一化写入 `supplier_status_syncs`。下一阶段需要基于这些监控数据自动影响渠道调度，并为尚未接入外部状态源的渠道提供平台方主动探活能力。

本方案覆盖三类来源：

- 外部状态源：Ikun、Foxcode 等第三方状态页。
- 显式映射源：管理员维护监控对象与本地渠道、模型能力的映射。
- 平台探活源：aiapi114 自己定时对渠道模型发起轻量探测。

## 目标

- 全量扫描库内 `channels` 与 `abilities`，不只处理显式配置监控来源的渠道。
- 有可靠外部映射时优先使用外部状态。
- 无外部映射时进入平台探活队列。
- 使用独立表保存动态覆盖层和审计日志。
- 默认 `dry-run=true`，管理员可开关并查询建议动作、覆盖记录、审计日志和探活结果。
- 优先调整模型能力，不把单模型异常扩大为整渠道禁用。
- 渠道级自动禁用必须启用最后可用渠道保护。

## 状态来源优先级

1. 外部状态源映射结果。
2. 平台主动探活结果。
3. `unknown`：没有状态数据、数据过期、映射不可靠或探活未完成。

`unknown` 不产生降权、禁用或恢复动作，只记录审计。

## 独立表设计

### 动态覆盖表

保存当前动态任务对渠道能力的覆盖状态。

核心字段：

- `channel_id`
- `group`
- `model`
- `provider`
- `monitor_id`
- `monitor_name`
- `source`
- `state`
- `base_enabled`
- `base_priority`
- `base_weight`
- `applied_enabled`
- `applied_priority`
- `applied_weight`
- `dry_run`
- `active`
- `last_reason`
- `updated_at`

作用：

- 保留恢复基准。
- 区分人工操作与自动操作。
- 支持 dry-run。
- 支持回滚和审计。

### 动态审计表

保存每次策略判断和执行结果。

核心字段：

- `channel_id`
- `group`
- `model`
- `provider`
- `source`
- `state`
- `action`
- `dry_run`
- `protected`
- `reason`
- `before_enabled / before_priority / before_weight`
- `after_enabled / after_priority / after_weight`
- `error`
- `created_at`

## 平台探活机制

平台探活只用于未可靠匹配外部状态源的渠道能力。

### 探活分级

连接探活：

- 验证渠道基础配置、base_url、key 与基础接口可用性。
- 失败只记录状态，不直接禁用模型能力。

模型探活：

- 针对 `abilities` 中存在的模型执行最小请求。
- 使用现有渠道测试能力复用请求构造与上游适配逻辑。
- 按渠道、模型、分组轮询，避免一次性全量打爆上游。

### 探活保护

- 默认只在 dry-run 下记录建议动作。
- 探活失败需要连续命中阈值才进入 `unhealthy`。
- 探活超时、请求错误、无响应归类记录。
- 受全局并发、超时、间隔和每日预算约束。
- 最后可用渠道保护始终生效。

## 健康状态判定

`healthy`：

- 当前状态可用。
- 最近窗口无连续不可用。
- 可用率达到阈值。

动作：

- 对动态任务曾经改过的能力恢复基准值。

`degraded`：

- 当前状态降级。
- 或可用率低于健康阈值但未低于不可用阈值。
- 或延迟超过慢请求阈值。

动作：

- 优先降低 `weight`。
- 必要时降低 `priority`。

`unhealthy`：

- 当前状态不可用。
- 或连续不可用达到阈值。
- 或可用率低于不可用阈值。

动作：

- 禁用对应 `ability`。
- 仅当同一渠道已映射能力全部不可用，且不触发最后可用渠道保护时，才允许自动禁用渠道。

`unknown`：

- 无数据、映射缺失、数据过期、探活未完成或状态源异常。

动作：

- 不调整调度，只记录审计。

## dry-run 管理

默认开启 `dry-run=true`。

管理员需要能完成：

- 查看当前动态调权设置。
- 开关 dry-run。
- 查询动态覆盖记录。
- 查询策略审计日志。
- 查询平台探活结果。
- 查询被最后可用渠道保护拦截的动作。

建议接口：

- `GET /api/channel/dynamic/settings`
- `PUT /api/channel/dynamic/settings`
- `GET /api/channel/dynamic/overrides`
- `GET /api/channel/dynamic/logs`
- `GET /api/channel/dynamic/probes`

## 执行安全

- 默认 dry-run，首期不直接影响线上路由。
- 手动禁用的渠道不得被自动恢复。
- 动态任务只恢复自己改过的记录。
- 最后可用渠道不禁用，只降权并记录保护日志。
- 多表写操作使用事务。
- 所有策略动作写审计日志。

## 首期实现范围

- 建立动态覆盖与审计模型。
- 建立平台探活结果模型。
- 实现健康状态到动作的策略引擎。
- 实现 dry-run 设置与管理员查询接口。
- 复用现有状态同步数据和渠道测试能力，为后续真实定时任务接入预留接口。
- 首期默认不自动关闭 dry-run。

## 后续补齐项（已完成）

- 渠道级联动：已补 `channels.status` 自动禁用/恢复。仅当整渠道全部已知能力都为 `unhealthy` 时自动置为 `ChannelStatusAutoDisabled`；恢复仅在动态任务自己标记过自动禁用且能力恢复时执行。
- 显式映射：已支持读取 `channel.other_info.status_monitor`，优先按 `provider_slug + request_model` 匹配上游监控结果，再回退 `tag / name` 近似匹配。
- 独立平台探活：已增加独立探活循环任务，按 `platform_probe_interval_seconds` 周期执行，对未接入显式上游监控的渠道主动探活并写入 `ChannelProbeResult`。
