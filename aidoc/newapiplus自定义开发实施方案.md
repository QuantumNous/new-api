# newapiplus 自定义开发实施方案

## 文档说明

本文档是当前 `new-api-plus` 项目的统一落地实施方案，用于直接指导后续开发、联调、测试与上线。

它合并了此前的两份文档：

- `aidoc/implementation_plan_revised.md`
- `aidoc/implementation_playbook.md`

并吸收了后续评审结论与最终拍板，尤其包括：

- 时间动态倍率纳入 Sprint A
- 时间动态倍率核心集成点固定在 `relay/helper/price.go`
- 时间动态倍率前端入口放在“运营设置”
- 时间字段改为 `"HH:MM"` 字符串
- Sprint A 不做“按渠道时间动态倍率”
- 维护模式考虑多实例部署，Redis 优先，数据库兜底
- 并发限制在 Redis 故障时 fail-open 放行
- 结构化配置优先采用 `config.GlobalConfig.Register()`

---

## 1. 总体结论

当前 `aidoc/` 原始方案有业务价值，但不能按原稿直接开发。

原因主要有：

- 当前项目必须同时兼容 SQLite / MySQL / PostgreSQL
- 当前项目已经存在较完整的 relay 主链路、日志、通知、巡检、自动禁用等能力
- 现有工程不是空白项目，开发策略必须是“增量增强”，不能平行重做
- 高风险能力必须分期落地，尤其不能把渠道兜底直接塞进现有重试链路

因此本次实施采用以下核心策略：

1. 先做低风险、高价值、与当前仓库贴合度高的功能
2. 尽量复用已有配置体系、日志体系、通知体系、后台任务模式
3. 高风险模块先做最小可上线版本，不做过度设计
4. 所有设计必须围绕当前真实代码结构展开，而不是围绕理想化架构展开

---

## 2. 当前仓库约束

### 2.1 必须遵守

- JSON 编解码统一使用 `common/json.go`
- 数据库必须同时兼容 SQLite / MySQL / PostgreSQL
- 业务层优先使用 GORM，不依赖数据库方言特性
- 新增结构化配置优先使用 `config.GlobalConfig.Register()`
- 新增复杂结构数据优先存为 `TEXT` 字段中的 JSON 字符串
- 新模型时间字段优先使用 `int64` Unix 时间戳

### 2.2 必须复用的现有能力

- Redis：`common.RDB`、`common.RedisEnabled`
- 全局配置：`common.OptionMap`、`config.GlobalConfig`
- 后台任务模式：`main.go` 启动、`service/*task.go`、`sync.Once + atomic.Bool`
- 通知能力：`service.NotifyRootUser`、`service.NotifyUser`
- 日志能力：`model.Log`、`logs.use_time`、`logs.request_id`
- 控制台设置：`console_setting`
- 状态接口：`controller.GetStatus`
- 渠道巡检与自动禁用：现有 `channel` 相关逻辑

### 2.3 关键工程原则

- 不平行造轮子
- 不新起独立配置中心
- 不在 Sprint A 引入复杂通用任务平台
- 不在 Sprint A 修改高风险重试主链路语义

---

## 3. 模块结论

| 模块 | 结论 | 分期建议 |
|------|------|----------|
| 模块 6 一键导出配置 | 最适合先做 | Sprint A |
| 模块 3 维护模式 V1 | 可做 | Sprint A |
| 时间动态倍率 | 可做，且建议纳入 | Sprint A |
| 模块 1 慢请求监控 | 可做 | Sprint B |
| 模块 7 不活跃账户清理 | 可做 | Sprint B |
| 模块 4 用户并发限制 | 可做 | Sprint C |
| 模块 2 轻量调度管理 | 可做，但要重设计 | Sprint D |
| Token 用量日报 | 可做 | Sprint D |
| 渠道健康评分 | 可做 | Sprint D |
| 模块 5 渠道兜底 | 可做，但风险最高 | Sprint E |

暂缓：

- 请求重放 / 调试
- 完整审计日志平台
- 完整 IP 白黑名单系统
- 独立数据库化公告系统

---

## 4. 总体分期

## Sprint A

- 模块 6：一键导出 Codex / Claude Code 配置
- 模块 3：维护模式 V1
- 时间动态倍率

## Sprint B

- 模块 1：慢请求监控 V1
- 模块 7：不活跃账户清理 V1

## Sprint C

- 模块 4：用户并发限制

## Sprint D

- 模块 2：轻量调度管理
- Token 用量日报
- 渠道健康评分

## Sprint E

- 模块 5：渠道兜底

---

## 5. 统一设计原则

### 5.1 结构化配置统一方案

新增业务配置统一采用以下模式：

1. 在 `setting/operation_setting/`、`setting/system_setting/` 或 `setting/ratio_setting/` 下新增配置文件
2. 定义结构体
3. 使用 `config.GlobalConfig.Register("xxx_setting", &xxxSetting)`
4. 通过现有持久化链路写入数据库
5. 前端继续沿用现有设置页接口读写配置

适合采用这种方式的配置包括：

- 时间动态倍率
- 并发限制配置
- 维护模式配置
- 慢请求监控配置

### 5.2 实时状态与持久状态分离

对于有“配置状态”和“实时生效状态”之分的能力，采用双层设计：

- 持久层：数据库配置
- 实时层：Redis

适用模块：

- 维护模式
- 并发限制
- 后续慢请求实时采样

### 5.3 Redis 故障策略

所有依赖 Redis 的保护性能力必须遵守：

- Redis 正常时按设计执行
- Redis 异常时优先保证主链路可用

具体要求：

- 并发限制：fail-open 放行
- 维护模式：回退数据库配置
- 慢请求监控：允许降级为日志聚合或临时不做实时统计

### 5.4 后台任务统一模式

延续当前项目已有模式：

- 在 `main.go` 中注册并启动
- 在 `service/` 中实现单次执行函数和循环函数
- 用 `sync.Once + atomic.Bool` 防止重复启动
- 只在 `common.IsMasterNode` 上运行

### 5.5 告警与通知复用现有体系

一期不新建 `notification_channels` 配置中心。

统一复用：

- `NotifyRootUser`
- `NotifyUser`

并沿用现有用户通知方式：

- email
- webhook
- bark
- gotify

---

## 6. Sprint A 详细实施

## 6.1 模块 6：一键导出 Codex / Claude Code 配置

### 目标

在用户 Token 管理界面，为每个 Token 提供“导出接入配置”的能力。

支持：

- Codex
- Claude Code
- Cursor
- Continue

不做：

- 自动写入用户本地文件
- 自动安装 CLI
- 下载脚本执行

### 路由设计

新增接口：

- `GET /api/token/:id/export?tool=codex`
- `GET /api/token/:id/export?tool=claude_code`
- `GET /api/token/:id/export?tool=cursor`
- `GET /api/token/:id/export?tool=continue`

鉴权要求：

- 走 `middleware.UserAuth()`
- 仅允许当前用户访问自己的 token

### 返回结构建议

```json
{
  "tool": "codex",
  "display_name": "Codex",
  "env_script": "export ...",
  "config_file": "~/.codex/config.toml",
  "config_content": "...",
  "test_command": "curl ...",
  "notes": [
    "说明1",
    "说明2"
  ]
}
```

### 后端文件落点

新增：

- `controller/token_export.go`
- `service/token_export.go` 可选

修改：

- `router/api-router.go`

复用：

- `model.GetTokenByIds`
- `system_setting.ServerAddress`
- token 权限校验逻辑

### 实现要点

- 服务地址优先从 `system_setting.ServerAddress` 获取
- 若为空，可回退为当前请求地址推导，但只作为兜底
- 返回真实 token key，不使用掩码
- 不同工具生成不同格式片段

### 前端落点

- `web/src/components/table/tokens/TokensColumnDefs.jsx`
- `web/src/components/table/tokens/modals/TokenExportConfigModal.jsx`
- `web/src/hooks/tokens/useTokensData.jsx` 视情况改动
- `web/src/i18n/locales/*.json`

### 验收标准

- 用户可以在 token 列表中直接打开导出弹窗
- 配置片段可复制
- 工具类型和内容对应正确
- 不会泄露其他用户 token

---

## 6.2 模块 3：维护模式 V1

### 目标

提供可控的全站维护能力，支持：

- 即时开启维护
- 即时关闭维护
- 维护预告
- 多实例部署实时生效
- 管理员放行

### 一期范围

Sprint A 只做 V1：

- 单一当前维护状态
- 单一维护预告信息
- 不做复杂排期系统

### 配置结构

新增：

- `setting/system_setting/maintenance.go`

配置建议：

```go
type MaintenanceSetting struct {
    Enabled           bool   `json:"enabled"`
    Title             string `json:"title"`
    Content           string `json:"content"`
    StartAt           int64  `json:"start_at"`
    EndAt             int64  `json:"end_at"`
    AllowAdminAccess  bool   `json:"allow_admin_access"`
    BannerEnabled     bool   `json:"banner_enabled"`
    BannerTitle       string `json:"banner_title"`
    BannerContent     string `json:"banner_content"`
}
```

注册：

- `config.GlobalConfig.Register("maintenance_setting", &maintenanceSetting)`

### 多实例设计

采用“双层状态”：

- 数据库持久配置作为基线
- Redis 作为实时同步层

推荐逻辑：

1. 管理员修改维护配置
2. 先写数据库
3. Redis 可用时同步写 Redis
4. 读取时优先 Redis
5. Redis 不可用时回退数据库

这样可以兼顾：

- 多实例快速生效
- Redis 异常时仍可工作

### 中间件设计

新增：

- `middleware/maintenance.go`

挂载建议：

- 挂在 relay 入口前
- 挂在关键 API 前
- 对管理员请求按配置放行
- 对登录页、状态页、必要静态资源保留白名单

### API 设计

建议新增：

- `GET /api/maintenance`
- `PUT /api/maintenance`

前台状态联动：

- 在 `GetStatus` 返回当前维护状态或预告信息

### 前端落点

- `web/src/pages/Setting/Operation/SettingsMaintenance.jsx`
- `web/src/components/settings/OperationSetting.jsx`
- 仪表盘或全局通知展示组件
- `web/src/i18n/locales/*.json`

### 验收标准

- 维护开关能立即生效
- 多实例环境能通过 Redis 快速同步
- Redis 异常时可回退数据库读取
- 管理员可按配置放行
- 前端能展示维护预告

---

## 6.3 时间动态倍率

### 目标

支持按时间段动态调整计费倍率，用于：

- 高峰期涨价
- 低峰期促销
- 临时活动策略

### Sprint A 范围

Sprint A 只做：

- 全局倍率规则
- 按用户组倍率规则
- 按模型倍率规则
- 星期 + 时间区间匹配

Sprint A 不做：

- 按渠道时间动态倍率
- 节假日规则
- 日期范围规则
- 多层复杂优先级系统
- 与营销系统联动

### 为什么 Sprint A 不做按渠道

按渠道时间动态倍率技术上可行，但不建议放进 Sprint A。

原因：

- 当前渠道在定价前已经选出，理论上可以拿到 `channel_id`
- 但 relay 失败重试时可能切换渠道
- 如果倍率绑定渠道，会出现“预扣按原渠道、结算按重试渠道”的计费口径复杂度
- 这类能力应该与重试重算、补差、日志展示一起设计，放入后续增强版本更稳妥

### 配置结构

新增：

- `setting/operation_setting/time_dynamic_ratio.go`

建议结构：

```go
type TimeDynamicRatioSetting struct {
    Enabled bool                   `json:"enabled"`
    Rules   []TimeDynamicRatioRule `json:"rules"`
}

type TimeDynamicRatioRule struct {
    Name       string   `json:"name"`
    Enabled    bool     `json:"enabled"`
    StartTime  string   `json:"start_time"` // HH:MM
    EndTime    string   `json:"end_time"`   // HH:MM
    Weekdays   []int    `json:"weekdays"`
    Groups     []string `json:"groups"`
    Models     []string `json:"models"`
    Multiplier float64  `json:"multiplier"`
}
```

注册：

- `config.GlobalConfig.Register("time_dynamic_ratio_setting", &timeDynamicRatioSetting)`

### 匹配策略

建议优先级：

1. 模型 + 分组同时匹配
2. 仅模型匹配
3. 仅分组匹配
4. 全局匹配

一期策略：

- 命中第一条即生效

### 核心集成点

时间动态倍率的核心集成点固定为：

- `relay/helper/price.go`
- `ModelPriceHelper()`

原因：

- 这里是当前价格计算的统一入口
- `PriceData` 会在这里统一产出
- `PriceData.OtherRatios` 已被现有下游结算链路消费

### 具体实现方式

推荐做法：

1. 在 `ModelPriceHelper()` 中解析当前命中的时间动态倍率规则
2. 计算倍率
3. 将倍率写入 `PriceData.OtherRatios["time_dynamic_multiplier"]`
4. 让下游文本、任务等计费路径自动复用现有 `OtherRatios` 生效

不建议 Sprint A 将该逻辑分散写入：

- `service/text_quota.go`
- `service/quota.go`

### 生效原则

V1 只影响最终计费倍率。

不影响：

- 模型发现
- 模型可用性
- 模型公开倍率同步接口
- 渠道路由选择

### 前端位置

前端入口明确放在：

- `web/src/components/settings/OperationSetting.jsx`
- `web/src/pages/Setting/Operation/SettingsTimeDynamicRatio.jsx`

按当前产品归类，放在“运营设置”，不放到“分组与模型定价设置”。

### 测试重点

- 指定时间命中规则
- 跨午夜区间匹配
- 全局 / 分组 / 模型规则匹配
- 未命中时倍率为 1
- `ModelPriceHelper()` 注入后文本与任务链路自动生效
- 重试切换渠道时不会引入“按渠道倍率差异”

### 验收标准

- 在配置时间窗口内计费结果按预期变化
- 日志中可看到动态倍率相关信息
- 未命中时不影响现有计费结果

---

## 7. Sprint B 实施

## 7.1 模块 1：慢请求监控 V1

### 目标

基于现有 `logs` 表聚合慢请求，不增加主链路写入复杂度。

### 核心方案

- 使用后台固定循环任务
- 默认每 3 分钟执行一次
- 统计最近 5 分钟窗口
- 从 `logs` 表按 `use_time` 聚合
- 达到阈值后通知管理员

### 配置建议

新增：

- `setting/operation_setting/slow_request_setting.go`

字段建议：

- `enabled`
- `threshold_seconds`
- `window_minutes`
- `alert_count`
- `cooldown_minutes`
- `notify_admin_only`

### 文件落点

- `service/slow_request_monitor_task.go`
- `setting/operation_setting/slow_request_setting.go`
- `controller/slow_request.go` 可选

### 注意点

- V1 不强依赖 Redis ZSet
- 优先复用 `logs`
- 冷却锁优先存 Redis
- Redis 异常时允许降级

---

## 7.2 模块 7：不活跃账户清理 V1

### 目标

清理长期不活跃且无充值 / 无订阅历史的用户额度。

### 判断口径

不活跃：

- 最近 N 天在 `logs` 中没有成功消费或错误请求

无充值：

- `top_ups` 无成功充值记录

无订阅：

- `subscription_orders` 无有效记录

### 实现方式

- 通过后台任务定期扫描
- 先生成清理目标
- 默认提供 dry-run
- 实际清理前记录结果日志

### 安全机制

- 首版必须支持 dry-run
- 建议先只处理长时间不活跃用户
- 结果通知管理员

---

## 8. Sprint C 实施

## 8.1 模块 4：用户并发限制

### 目标

限制用户并发中的 relay 请求数量，降低滥用与资源争抢。

### 挂载位置

建议挂在：

- 鉴权之后
- 渠道分发之前
- 进入实际 relay 之前

原因：

- 这时已能拿到用户身份
- 尚未进入上游调用
- 失败时不需要回滚上游状态

### 实现方式

优先采用 Redis 原子计数：

- 请求进入时 `INCR`
- 请求结束时 `DECR`
- 配合 TTL 兜底防止异常泄漏

### Redis 故障策略

必须明确：

- Redis 正常时按限制执行
- Redis 故障时 fail-open 放行

不能因为 Redis 宕机导致全站请求被拒。

### 配置建议

新增：

- `setting/operation_setting/concurrency_setting.go`

字段建议：

- `enabled`
- `free_default`
- `paid_default`
- `group_defaults`
- `redis_fail_open`

### 可选数据模型

若需要用户级覆盖，可在后续加入：

- `model/user_concurrency_override.go`

但 Sprint C 可先不引入新表。

---

## 9. Sprint D 实施

## 9.1 模块 2：轻量调度管理

### 原则

不做“任意任务 + 任意 JSON Schema + 任意执行器”的通用调度平台。

Sprint D 只做轻量持久化任务。

### 支持的任务类型

- `slow_request_check`
- `inactive_cleanup`
- `usage_report`
- `log_cleanup`

### 推荐模型

建议新增：

- `ScheduledTask`
- `ScheduledTaskExecution`

其中 `Params` 使用 `TEXT` 存 JSON 字符串。

### 文件落点

- `model/scheduled_task.go`
- `service/scheduled_task_runner.go`
- `service/scheduled_task_handlers.go`
- `controller/scheduled_task.go`

### 路由建议

- `GET /api/scheduled-task`
- `POST /api/scheduled-task`
- `PUT /api/scheduled-task/:id`
- `POST /api/scheduled-task/:id/run`
- `POST /api/scheduled-task/:id/toggle`

---

## 9.2 渠道健康评分

### 目标

基于现有日志和巡检结果，对渠道给出健康评分。

### 数据来源

- 请求成功率
- 平均耗时
- 错误率
- 自动禁用记录
- 巡检结果

### 输出

- 渠道总分
- Top 渠道
- 差评渠道
- 建议是否降权 / 禁用

---

## 9.3 Token 用量日报

### 目标

按日给管理员输出 token 用量摘要。

### 数据来源

- `logs`
- 充值记录
- 订阅消耗记录

### 输出内容

- 总请求数
- 总 token / quota 消耗
- 热门模型
- 热门分组
- 异常高消耗用户

---

## 10. Sprint E 实施

## 10.1 模块 5：渠道兜底

### 这是最高风险模块

该模块必须放到最后做。

原因：

- 当前 relay 主链路已包含分发、预扣费、退款、重试、流式处理
- 兜底能力会直接影响重试语义
- 若设计不当，容易引入重复扣费、错误退款、流式异常、中间状态不一致

### 实施原则

1. 不重写现有分发逻辑
2. 在现有重试链路上增强“候选渠道重试能力”
3. 每次切换渠道时都必须同步上下文
4. 保证计费口径、日志口径、错误口径一致

### 先决条件

在做渠道兜底前，建议先完成：

- 渠道健康评分
- 更稳定的自动禁用 / 恢复
- 更清晰的重试日志

### 可选数据模型

- `ChannelFallbackRule`

但不建议在 Sprint A~D 提前引入复杂兜底表设计。

---

## 11. 数据模型总清单

按阶段建议如下：

### Sprint A

不建议新增业务表，以配置为主。

### Sprint B

可不新增表。

### Sprint C

可选：

- `UserConcurrencyOverride`

### Sprint D

建议新增：

- `ScheduledTask`
- `ScheduledTaskExecution`

### Sprint E

可选：

- `ChannelFallbackRule`

### 其他可选模型

若需要保留清理记录，可增加：

- `QuotaCleanupLog`

---

## 12. 路由与文件修改清单

## Sprint A

### 后端新增

- `controller/token_export.go`
- `middleware/maintenance.go`
- `service/maintenance_state.go`
- `setting/system_setting/maintenance.go`
- `setting/operation_setting/time_dynamic_ratio.go`

### 后端修改

- `router/api-router.go`
- `router/relay-router.go`
- `router/video-router.go`
- `controller/misc.go`
- `relay/helper/price.go`

### 前端新增

- `web/src/components/table/tokens/modals/TokenExportConfigModal.jsx`
- `web/src/pages/Setting/Operation/SettingsMaintenance.jsx`
- `web/src/pages/Setting/Operation/SettingsTimeDynamicRatio.jsx`

### 前端修改

- `web/src/components/table/tokens/TokensColumnDefs.jsx`
- `web/src/components/settings/OperationSetting.jsx`
- 仪表盘或全局通知展示组件
- `web/src/i18n/locales/*.json`

## Sprint B

### 后端新增 / 修改

- `service/slow_request_monitor_task.go`
- `setting/operation_setting/slow_request_setting.go`
- 不活跃账户清理相关 service

## Sprint C

### 后端新增 / 修改

- 并发限制中间件
- `setting/operation_setting/concurrency_setting.go`

## Sprint D

### 后端新增 / 修改

- `model/scheduled_task.go`
- `service/scheduled_task_runner.go`
- `service/scheduled_task_handlers.go`
- `controller/scheduled_task.go`

## Sprint E

### 后端新增 / 修改

- 兜底规则与重试增强相关代码

---

## 13. 测试策略

### 13.1 单元测试

重点覆盖：

- 导出配置生成逻辑
- 维护状态判定逻辑
- Redis 失效回退逻辑
- 时间动态倍率匹配与 `ModelPriceHelper()` 注入逻辑
- 慢请求聚合逻辑
- 清理目标筛选逻辑
- 并发限制 Redis fail-open

### 13.2 集成测试

重点覆盖：

- `GET /api/token/:id/export`
- `GET /api/maintenance`
- `PUT /api/maintenance`
- 维护期开启后 relay 返回维护响应
- `GetStatus` 返回维护信息
- 时间动态倍率影响实际计费

### 13.3 手工验证

重点验证：

- 多实例维护模式同步
- 维护预告展示
- Token 导出内容复制与使用
- 时间动态倍率跨午夜规则
- Redis 宕机时并发限制降级

---

## 14. 上线策略

### 14.1 默认值策略

新增能力上线时默认应尽量“关闭”或“保守”：

- 维护模式默认关闭
- 时间动态倍率默认关闭
- 慢请求监控默认低频执行
- 并发限制默认关闭或设置宽松值

### 14.2 上线顺序

建议严格按以下顺序：

1. Sprint A
2. Sprint A 验收通过后再做 Sprint B
3. Sprint B 稳定后再做 Sprint C
4. Sprint C 稳定后再做 Sprint D
5. 最后单独推进 Sprint E

### 14.3 风险控制

- 高风险能力独立发布
- 对保护性能力设置 Redis 降级策略
- 不在同一版本中同时改大量 relay 关键路径
- 对维护模式、并发限制、时间倍率提供可快速关闭的配置开关

---

## 15. 各 Sprint 验收清单

## Sprint A 验收

- Token 导出配置功能可用
- 维护模式能即时启停
- 多实例维护模式可通过 Redis 快速同步
- Redis 异常时维护模式可回退数据库
- 时间动态倍率能对计费结果生效
- 时间动态倍率放在运营设置中可配置

## Sprint B 验收

- 能按窗口识别慢请求
- 告警可发送给管理员
- 不活跃用户筛选口径正确

## Sprint C 验收

- 并发限制能拦截超限请求
- 异常退出不长期泄漏计数
- Redis 异常时可降级放行

## Sprint D 验收

- 可创建、编辑、启停、手动执行轻量任务
- 可生成 token 用量日报
- 可展示渠道健康评分

## Sprint E 验收

- 主渠道失败时可切换备用渠道
- 不出现重复扣费或退款异常
- 流式与非流式链路都可稳定工作

---

## 16. 最终开发建议

建议按以下顺序直接开工：

1. 模块 6：一键导出配置
2. 模块 3：维护模式 V1
3. 时间动态倍率

其中时间动态倍率的最终落地结论已经明确：

- 放在“运营设置”
- 核心集成点在 `relay/helper/price.go`
- 用 `PriceData.OtherRatios` 一次注入
- Sprint A 不做按渠道规则
- 时间区间字段使用 `"HH:MM"`

如果后续要继续推进编码，当前这份文档已经可以作为唯一开发依据使用。
