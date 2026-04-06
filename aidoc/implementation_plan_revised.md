# New-API 二次开发修订实施方案（贴合当前仓库）

## 1. 结论

当前 `aidoc/` 里的方案有业务价值，但不能按原文直接开工。

主要原因：

- 当前项目必须同时兼容 SQLite / MySQL / PostgreSQL，不适合直接采用大量 MySQL 风格 DDL。
- 当前项目已存在若干后台任务、通知、公告、通道自动禁用/恢复等基础能力，应该复用，而不是平行再造一套。
- 当前 relay 主链路已经包含鉴权、分发、重试、预扣费、退款、日志记录，渠道兜底不能作为一个独立小功能插入。
- 当前项目大量模型使用 `int64` Unix 时间戳，而不是 `DATETIME` 风格字段；新功能应延续现有数据风格。

因此，本修订版的核心原则是：

1. 先做低风险、高收益、与当前代码最贴合的模块。
2. 复用已有 `service` 后台循环、`option/config` 配置、`logs` 统计、`NotifyRootUser/NotifyUser` 通知能力。
3. 对高风险模块先做“最小可上线版本”，不要一开始设计成通用平台。
4. 所有新表优先使用 GORM 模型驱动迁移，字段使用跨库安全类型。

---

## 2. 当前仓库约束

### 2.1 必须遵守

- JSON 编解码统一走 `common/json.go` 中的封装。
- 数据库必须兼容 SQLite / MySQL / PostgreSQL。
- 新功能应优先使用 GORM，不直接写依赖数据库方言的 DDL。
- 新增 JSON 结构数据优先存为 `TEXT` 字段中的 JSON 字符串，避免直接依赖数据库 `JSON/JSONB` 类型。
- 新模型的时间字段优先使用当前项目风格：
  - `created_at int64`
  - `updated_at int64`
  - 业务时间字段也尽量使用 Unix 秒级时间戳

### 2.2 已有能力应复用

- Redis 已集成，可用于并发计数与短期状态缓存。
- 已有后台循环任务模式：
  - 订阅额度重置
  - Codex 凭证自动刷新
  - 渠道自动测试
- 已有日志表 `logs`，可用于慢请求统计、日报聚合、不活跃判断。
- 已有管理员通知能力：
  - `NotifyRootUser`
  - `NotifyUser`
- 已有公告配置能力：
  - `console_setting.announcements`
  - 控制台已有公告展示组件
- 已有渠道自动禁用/自动恢复基础能力：
  - 自动禁用判断
  - 渠道巡检恢复

---

## 3. 模块结论

| 模块 | 结论 | 建议 |
|------|------|------|
| 模块 1 慢请求监控 | 可做 | 一期做，先基于 `logs.use_time` 聚合，不强依赖 Redis ZSet |
| 模块 2 调度管理 | 可做，但要重设计 | 二期做，先实现“轻量持久化任务”而非通用任务平台 |
| 模块 3 维护模式 | 可做 | 一期做简化版，先支持即时维护与预告；排期维护放二期 |
| 模块 4 用户并发限制 | 可做 | 一期做，Redis 原子计数，先覆盖 relay 请求 |
| 模块 5 渠道兜底 | 可做，但风险最高 | 三期做，必须与现有重试/计费/流式链路一起设计 |
| 模块 6 一键导出 Codex / Claude Code | 最适合先做 | 一期做，低风险高收益 |
| 模块 7 不活跃账户清理 | 可做，但需重定义数据口径 | 一期做，基于 `logs/top_ups/subscription_orders` 判断 |
| 模块 8 建议功能 | 拆分处理 | 只保留与现有能力强相关的部分优先做 |

---

## 4. 推荐分期

## Phase 1：两周内可落地版本

目标：先交付对业务最有价值、对主链路改动较小的功能。

包含：

- 模块 6 一键导出 Codex / Claude Code 配置
- 模块 3 维护模式 V1（即时维护 + 预告 Banner）
- 时间动态倍率
- 模块 1 慢请求监控 V1
- 模块 7 不活跃账户清理 V1
- 模块 4 用户并发限制

不包含：

- 通用调度平台 UI
- 渠道兜底
- 请求重放
- 独立公告系统数据库化

## Phase 2：运维增强

包含：

- 模块 2 轻量调度管理
- 模块 3 排期维护
- 模块 1 慢请求监控高级配置
- Token 用量日报
- 渠道健康评分

## Phase 3：高风险主链路能力

包含：

- 模块 5 渠道兜底
- 与兜底联动的健康度降权
- 更细粒度的自动禁用与恢复

## 暂缓

- 请求重放 / 调试
- 独立 `notification_channels` 配置中心
- 全量审计日志平台
- 完整 IP 白黑名单系统

---

## 5. 架构修订

## 5.1 后台任务不要新起一套完全独立架构

建议延续当前项目已有模式：

- 在 `main.go` 启动后台任务
- 在 `service/` 中实现任务循环和单次执行函数
- 用 `sync.Once + atomic.Bool` 防重复运行
- 只在 `common.IsMasterNode` 上运行

这与当前已有任务保持一致，维护成本最低。

## 5.2 调度功能先做“轻量持久化任务”

不要一开始就设计成“任意任务 + 任意 Schema + 任意通知通道”的通用平台。

推荐先支持有限内置任务：

- `slow_request_check`
- `inactive_cleanup`
- `usage_report`
- `log_cleanup`

每个任务：

- 有固定 `TaskType`
- 有固定参数结构
- 参数存在 `TEXT` 字段中，内容为 JSON 字符串
- 后端按 `TaskType` 路由到具体 handler

## 5.3 慢请求监控优先复用 `logs`

当前 `logs` 已记录：

- `created_at`
- `channel_id`
- `model_name`
- `use_time`
- `request_id`

因此 V1 建议直接从 `logs` 聚合慢请求：

- 优点：无额外采集链路风险
- 优点：兼容已有日志与统计能力
- 优点：部署不依赖 Redis 特性

Redis ZSet 版本可作为 Phase 2 优化项。

## 5.4 告警通道优先复用现有通知体系

不建议一开始就上 `notification_channels` 全局配置表。

V1 做法：

- 管理员告警统一走 `NotifyRootUser`
- 或对已启用通知的管理员广播 `NotifyUser`
- 通知方式复用已有用户设置：
  - email
  - webhook
  - bark
  - gotify

这样能显著减少新表、新页面和配置管理复杂度。

## 5.5 公告系统不重做

当前项目已经有：

- `console_setting.announcements`
- 控制台公告展示面板

因此“用户公告系统”不建议单独再建表作为一期能力。

建议先做：

- 公告编辑体验增强
- 维护预告与系统公告联动

## 5.6 结构化配置优先使用 `config.GlobalConfig.Register()`

对于新增的结构化配置，不建议优先落到单个 `option` JSON 字符串中。

更推荐的方式：

- 在 `setting/operation_setting/` 或 `setting/system_setting/` 下新增配置结构体
- 使用 `config.GlobalConfig.Register()` 注册
- 通过现有配置持久化链路读写数据库

适合这样做的配置包括：

- 时间动态倍率
- 并发默认配置
- 维护模式配置

这样做的好处：

- 与当前仓库风格一致
- 字段更清晰，类型更安全
- 后续前端和接口扩展时更容易维护

---

## 6. 新增数据模型建议

以下为推荐新增模型，不要求第一期全部落地。

## 6.1 `ScheduledTask`

用于 Phase 2 的轻量调度。

```go
type ScheduledTask struct {
    Id         int    `json:"id"`
    Name       string `json:"name" gorm:"type:varchar(100);index"`
    TaskType   string `json:"task_type" gorm:"type:varchar(50);index"`
    CronExpr   string `json:"cron_expr" gorm:"type:varchar(100)"`
    Params     string `json:"params" gorm:"type:text"`
    Enabled    bool   `json:"enabled" gorm:"default:true;index"`
    LastStatus string `json:"last_status" gorm:"type:varchar(20);default:'idle'"`
    LastOutput string `json:"last_output" gorm:"type:text"`
    LastRunAt  int64  `json:"last_run_at" gorm:"bigint;default:0"`
    NextRunAt  int64  `json:"next_run_at" gorm:"bigint;default:0"`
    CreatedBy  int    `json:"created_by" gorm:"index"`
    CreatedAt  int64  `json:"created_at" gorm:"bigint;index"`
    UpdatedAt  int64  `json:"updated_at" gorm:"bigint"`
}
```

说明：

- `Params` 使用 `TEXT` 保存 JSON 字符串。
- 读写统一使用 `common.Marshal` / `common.UnmarshalJsonStr`。

## 6.2 `ScheduledTaskExecution`

```go
type ScheduledTaskExecution struct {
    Id         int    `json:"id"`
    TaskId     int    `json:"task_id" gorm:"index"`
    Status     string `json:"status" gorm:"type:varchar(20);index"`
    Output     string `json:"output" gorm:"type:text"`
    DurationMs int64  `json:"duration_ms" gorm:"bigint"`
    StartedAt  int64  `json:"started_at" gorm:"bigint;index"`
    FinishedAt int64  `json:"finished_at" gorm:"bigint"`
}
```

## 6.3 `UserConcurrencyOverride`

只保留用户级覆盖，组级默认先放在 `options` 中。

```go
type UserConcurrencyOverride struct {
    Id            int    `json:"id"`
    UserId        int    `json:"user_id" gorm:"uniqueIndex"`
    MaxConcurrent int    `json:"max_concurrent"`
    Reason        string `json:"reason" gorm:"type:varchar(255)"`
    SetBy         int    `json:"set_by" gorm:"index"`
    CreatedAt     int64  `json:"created_at" gorm:"bigint"`
    UpdatedAt     int64  `json:"updated_at" gorm:"bigint"`
}
```

配套 `option` 键：

- `concurrency.free_default`
- `concurrency.paid_default`
- `concurrency.group_defaults`

其中 `concurrency.group_defaults` 存 JSON 字符串，例如：

```json
{
  "default": 3,
  "vip": 50,
  "premium": 100
}
```

## 6.4 `QuotaCleanupLog`

```go
type QuotaCleanupLog struct {
    Id          int    `json:"id"`
    UserId      int    `json:"user_id" gorm:"index"`
    QuotaBefore int    `json:"quota_before"`
    QuotaAfter  int    `json:"quota_after"`
    CleanupType string `json:"cleanup_type" gorm:"type:varchar(50);index"`
    TaskId      int    `json:"task_id" gorm:"index"`
    Remark      string `json:"remark" gorm:"type:text"`
    CreatedAt   int64  `json:"created_at" gorm:"bigint;index"`
}
```

## 6.5 `ChannelFallbackRule`

仅在 Phase 3 引入。

```go
type ChannelFallbackRule struct {
    Id                 int    `json:"id"`
    PrimaryChannelId   int    `json:"primary_channel_id" gorm:"uniqueIndex"`
    FallbackChain      string `json:"fallback_chain" gorm:"type:text"`
    TriggerStatusCodes string `json:"trigger_status_codes" gorm:"type:text"`
    TriggerKeywords    string `json:"trigger_keywords" gorm:"type:text"`
    TriggerOnTimeout   bool   `json:"trigger_on_timeout" gorm:"default:true"`
    TimeoutSeconds     int    `json:"timeout_seconds" gorm:"default:30"`
    Enabled            bool   `json:"enabled" gorm:"default:true;index"`
    CreatedAt          int64  `json:"created_at" gorm:"bigint"`
    UpdatedAt          int64  `json:"updated_at" gorm:"bigint"`
}
```

---

## 7. 模块级实施设计

## 7.1 模块 6：一键导出 Codex / Claude Code 配置

### 目标

在用户 Token 页面生成配置片段，不直接写用户本地文件。

### 后端

新增接口：

- `GET /api/token/:id/export?tool=codex`
- `GET /api/token/:id/export?tool=claude_code`
- `GET /api/token/:id/export?tool=cursor`
- `GET /api/token/:id/export?tool=continue`

原因：

- 当前 token 相关接口已在 `/api/token` 下，保持路由风格一致。
- 由当前用户访问自己的 token，更符合现有权限模型。

返回内容：

- 环境变量方式
- 配置文件片段
- 测试命令
- 注意事项

### 设计注意

- 只做“文本生成”，不做客户端下载或远端安装。
- `baseURL` 应来自当前服务地址配置，而不是简单拼接请求来源头。
- 输出内容需要按最新官方工具配置方式校验后再固定。

### 可行性

高，可作为首批交付功能。

---

## 7.2 模块 3：维护模式 V1

### V1 目标

先支持：

- 即时开启维护
- 即时关闭维护
- 预告信息展示
- 管理员 / root 放行

### V1 存储建议

一期不先建 `maintenance_schedules` 表。

先用 `config.GlobalConfig.Register()` 注册维护配置，并持久化到数据库；多实例部署时，有 Redis 则优先使用 Redis 作为实时状态源。

建议配置字段例如：

- `maintenance.enabled`
- `maintenance.title`
- `maintenance.message`
- `maintenance.notice_start_at`
- `maintenance.start_at`
- `maintenance.end_at`
- `maintenance.whitelist_user_ids`

### 多实例部署建议

维护模式在多实例下不能只依赖数据库轮询同步。

建议规则：

- 有 Redis：
  - 管理端修改维护状态后，立即写 Redis
  - 请求链路优先读 Redis 中的当前维护状态
  - 数据库中的配置作为持久化和兜底来源
- 无 Redis：
  - 回退为数据库配置 + 本地缓存
  - 接受短暂的配置同步延迟

这样可以避免多实例下因 `SyncOptions` 周期造成的维护状态切换延迟。

### 中间件挂载建议

挂在 relay 路径和关键 API 路径前面，但不能简单依赖 `/api/admin` 前缀判断。

建议规则：

- root / admin 用户放行
- 特定公开接口可放行
- 其余 API 与 relay 请求返回 503

### Phase 2

如确实需要“多个未来维护计划”，再引入 `MaintenancePlan` 表和管理页。

### 可行性

中高，适合一期。

---

## 7.3 模块 1：慢请求监控 V1

### V1 目标

先做慢请求统计与管理员告警，不做复杂多通道告警配置。

### 实现路径

直接聚合 `logs`：

- `type in (consume,error)`
- `use_time >= threshold`
- `created_at >= now - window`
- 可按 `channel_id` / `model_name` 过滤

### 执行方式

Phase 1 可以先做固定后台循环：

- 每 3 分钟检查一次
- 阈值与窗口放在 `option/config`

Phase 2 再纳入轻量调度平台。

### 告警方式

复用：

- `NotifyRootUser`
- 或管理员广播通知

### 不建议的做法

- 一期直接上 `notification_channels` 配置中心
- 一期在主链路额外写一份慢请求 Redis 结构

### 可行性

高。

---

## 7.4 模块 7：不活跃账户清理 V1

### 原方案问题

原文依赖：

- `users.is_charged`
- `request_logs`

这两者在当前仓库中都不存在。

### V1 口径建议

“从未充值”定义为：

- 在 `top_ups` 中无成功充值记录
- 且在 `subscription_orders` / `user_subscriptions` 中无有效订阅购买记录

“不活跃”定义为：

- 在 `logs` 中最近 N 天无消费/错误请求记录

“有剩余额度”定义为：

- `users.quota > 0`

### 执行方式

Phase 1 先做固定后台循环，默认每天凌晨执行。

### 安全机制

- 默认 dry-run 一次
- 必须记录 `QuotaCleanupLog`
- 支持白名单用户 ID
- 默认排除管理员和 root

### 可行性

中高，但查询逻辑要按现有真实表重写。

---

## 7.5 模块 4：用户并发限制

### 目标

限制同一用户同时进行的 relay 请求数。

### 挂载位置

建议挂载在 relay 入口的 `TokenAuth()` 之后、`Distribute()` 之前。

原因：

- 这时已经拿到用户身份
- 这时尚未进入渠道选择和上游调用
- 可以尽早失败，降低系统成本

### 实现方式

Redis Lua 原子计数方案可保留。

优先级建议：

1. 用户级覆盖表
2. 用户组默认值（来自 `config.GlobalConfig.Register()` 的结构化配置）
3. 系统默认值

### “充值用户”判定建议

不要用 `quota > 0` 判断。

更合理口径：

- 有成功 `top_up`
- 或有有效订阅
- 或由管理员显式归类到特定用户组

若一期赶工，可先按用户组判断，不自动推断“是否充值”。

### Redis 宕机降级策略

并发限制不能采用 Redis 故障即全拒绝的策略。

推荐策略：

- Redis 正常：执行原子计数限制
- Redis 异常：
  - 记录告警和错误日志
  - 本次请求降级放行
  - 不影响主链路可用性

理由：

- 并发限制属于保护性能力，不应成为系统单点故障源
- Redis 故障时，优先保证请求可用，再由运维介入恢复

### 配置落点建议

并发配置建议新增单独 setting，例如：

- `ConcurrencySetting`
- `config.GlobalConfig.Register("concurrency_setting", &concurrencySetting)`

字段可包括：

- `free_default`
- `paid_default`
- `group_defaults`
- `redis_fail_open`

### 可行性

中高，但需要谨慎处理异常退出时的 Redis 计数回收。

---

## 7.5A 时间动态倍率

### 建议纳入 Sprint A

这是一个低风险、高收益、与现有计费体系贴合度较高的需求，建议直接纳入 Sprint A。

### 目标

支持按时间段对指定模型、分组或全局倍率进行动态调整，用于：

- 高峰期涨价
- 低峰期促销
- 临时活动策略

### 范围控制

一期只影响计费计算，不改动以下能力：

- 模型同步
- 公开倍率同步接口
- 模型可用性判断
- 上游渠道选择逻辑

也就是说，V1 只在最终扣费倍率阶段生效。

Sprint A 明确不做：

- 按渠道时间动态倍率

原因：

- 现有 relay 重试链路可能在失败后切换渠道
- 若倍率绑定渠道，会出现“预扣按原渠道、结算按重试渠道”的口径复杂度
- 该能力应放到后续增强版本，届时与重试重算、补差、日志展示一起设计

### 配置方式

建议新增结构化配置，例如：

```go
type TimeDynamicRatioSetting struct {
    Enabled bool `json:"enabled"`
    Rules   []TimeDynamicRatioRule `json:"rules"`
}

type TimeDynamicRatioRule struct {
    Name       string   `json:"name"`
    StartTime  string   `json:"start_time"` // HH:MM
    EndTime    string   `json:"end_time"`   // HH:MM
    Weekdays   []int    `json:"weekdays"`
    Groups     []string `json:"groups"`
    Models     []string `json:"models"`
    Multiplier float64  `json:"multiplier"`
    Enabled    bool     `json:"enabled"`
}
```

并注册到：

- `config.GlobalConfig.Register("time_dynamic_ratio_setting", &timeDynamicRatioSetting)`

后端配置文件建议放在：

- `setting/operation_setting/time_dynamic_ratio.go`

### 生效位置

建议固定在现有价格计算主入口：

- `relay/helper/price.go`
- `ModelPriceHelper()`

具体方式：

- 在 `ModelPriceHelper()` 中解析命中的时间动态倍率规则
- 将倍率以 `PriceData.OtherRatios["time_dynamic_multiplier"]` 方式一次注入
- 让下游文本计费、任务计费等路径自动复用现有 `OtherRatios` 机制生效

不建议 Sprint A 将逻辑分散写入：

- `service/text_quota.go`
- `service/quota.go`

### Sprint A 实施建议

V1 先支持：

- 全局时段倍率
- 按用户组时段倍率
- 按模型时段倍率
- 简单 weekday + 时间区间

先不支持：

- 按渠道时段倍率
- 节假日规则
- 多规则复杂优先级
- 与促销系统联动

### 前端放置建议

按当前产品归类，前端入口放在：

- 运营设置 Tab

不放到定价设置 Tab。

---

## 7.6 模块 2：轻量调度管理

### 不建议直接照原方案做的点

- 不建议一开始做 JSON Schema 动态表单平台
- 不建议一开始支持过多任务类型
- 不建议把所有后台任务都强行迁入调度器

### 推荐最小版本

先支持：

- 任务列表
- 创建 / 编辑 / 启停
- 手动执行一次
- 最近执行日志

先支持的任务类型：

- `slow_request_check`
- `inactive_cleanup`
- `usage_report`
- `log_cleanup`

### 代码组织建议

- `model/scheduled_task.go`
- `service/scheduled_task_runner.go`
- `service/scheduled_task_handlers.go`
- `controller/scheduled_task.go`

### 路由建议

- `GET /api/scheduled_task`
- `POST /api/scheduled_task`
- `PUT /api/scheduled_task/:id`
- `DELETE /api/scheduled_task/:id`
- `POST /api/scheduled_task/:id/run`
- `POST /api/scheduled_task/:id/toggle`
- `GET /api/scheduled_task/:id/executions`

### 可行性

中等，建议二期。

---

## 7.7 模块 5：渠道兜底

### 这是全案中风险最高的模块

原因：

- 当前 relay 已有重试机制
- 当前 relay 已有预扣费/退款逻辑
- 当前 relay 包含流式和非流式两套行为
- 当前请求体会复用 body storage，多次转发需要严格处理
- 当前渠道分发逻辑并非简单“按 channel_id 直接转发”

### 推荐做法

不要新增一个与当前 relay 并行的 `RelayWithFallback` 主流程。

应在现有链路上增强：

1. 先拿到主渠道
2. 判断是否存在 fallback rule
3. 在“可重试且可切换渠道”的错误场景下，显式指定候选渠道重试
4. 确保每次切换渠道时：
   - 请求体可重放
   - 账单上下文一致
   - 错误日志与使用日志正确归属
   - 流式请求不会多次向客户端写入冲突数据

### 先决条件

在做兜底前，建议先梳理：

- `controller/relay.go`
- `middleware/Distribute()`
- 账单预扣与退款逻辑
- 渠道自动禁用逻辑

### 可行性

中等偏低，但不是不能做；建议单独成一期。

---

## 8. 对补充功能（8-14）的修订建议

## 8.1 渠道健康评分

建议保留，但放在 Phase 2。

输入数据来源：

- `logs.use_time`
- `logs.type`
- 渠道测试结果

用途：

- 后台展示排名
- 后续为兜底与降权提供参考

## 8.2 Token 用量日报

建议保留，Phase 2。

数据来源可直接基于现有 `logs` 聚合，无需新表。

## 8.3 IP 白黑名单

建议暂缓。

因为：

- 会影响公开 API、relay、管理员登录等多类入口
- CIDR、代理头、反代部署、白名单优先级都容易出错

## 8.4 请求重放 / 调试

建议暂缓。

原因：

- 涉及请求体和响应体完整落盘
- 可能包含敏感密钥、图片、文件、隐私数据
- 还会显著增加存储和性能压力

## 8.5 渠道自动禁用与恢复

当前已有基础能力，不应重做。

建议在现有能力上增强：

- 增加更清晰的失败次数窗口统计
- 增加后台展示
- 与健康评分联动

## 8.6 用户公告系统

当前已有基础能力，不建议单独新建 `announcements` 表作为一期。

建议先增强现有 `console_setting.announcements` 的编辑和展示。

## 8.7 操作审计日志

建议二期后半段再做。

原因：

- 涉及所有管理写操作
- 改动面广
- 需要定义统一埋点口径

---

## 9. 推荐开发顺序

## Sprint A

- 模块 6：导出 Codex / Claude Code 配置
- 模块 3：维护模式 V1

## Sprint B

- 模块 1：慢请求监控 V1
- 模块 7：不活跃账户清理 V1

## Sprint C

- 模块 4：用户并发限制

## Sprint D

- 模块 2：轻量调度管理
- 模块 8 中的日报与健康评分

## Sprint E

- 模块 5：渠道兜底

---

## 10. 粗略工期评估

| 阶段 | 工期 |
|------|------|
| Sprint A | 2-3 天 |
| Sprint B | 3-4 天 |
| Sprint C | 2-3 天 |
| Sprint D | 4-6 天 |
| Sprint E | 5-8 天 |

合计：

- 仅 Phase 1：约 7-10 个工作日
- 到 Phase 2：约 11-16 个工作日
- 包含兜底：约 16-24 个工作日

这比原先“13 个工作日全做完”的估计更接近实际。

---

## 11. 最终建议

如果目的是尽快交付一批能上线的功能，推荐立刻开始的范围是：

1. 模块 6 一键导出配置
2. 模块 3 维护模式 V1
3. 模块 1 慢请求监控 V1
4. 模块 7 不活跃账户清理 V1
5. 模块 4 用户并发限制

如果目的是做成一套完整运维平台，再进入第二阶段：

1. 轻量调度管理
2. 用量日报
3. 渠道健康评分

渠道兜底必须放到最后单独设计和实现，不建议作为前几天的核心任务直接切入。
