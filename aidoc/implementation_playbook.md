# New-API 二次开发落地实施方案

## 文档目的

本文档用于指导后续实际开发、联调、测试与上线。

它基于当前仓库真实结构，而不是基于原始 `aidoc/` 草案的理想化设计。

本文档重点解决三类问题：

1. 做什么
2. 在当前仓库里放到哪里做
3. 以什么顺序和方式做，风险最低

---

## 1. 项目目标与范围

### 1.1 目标

基于当前 `new-api` 仓库，在不破坏现有主链路稳定性的前提下，分阶段落地以下能力：

- 模块 6：一键导出 Codex / Claude Code 配置
- 模块 3：维护模式 V1
- 时间动态倍率
- 模块 1：慢请求监控 V1
- 模块 7：不活跃账户清理 V1
- 模块 4：用户并发限制
- 模块 2：轻量调度管理
- 模块 5：渠道兜底
- 运维增强能力：用量日报、健康评分、自动禁用增强

### 1.2 一期范围

优先落地 Sprint A：

1. 模块 6：一键导出配置
2. 模块 3：维护模式 V1
3. 时间动态倍率

原因：

- 改动面相对集中
- 运维与用户价值都高
- 不会直接切入最复杂的 relay 失败重试逻辑

### 1.3 非目标

以下能力不进入 Sprint A：

- 独立调度平台 UI
- 渠道兜底
- 请求重放 / 调试
- 全量审计日志平台
- 完整 IP 白黑名单系统
- 独立数据库化公告中心

---

## 2. 当前仓库工程约束

### 2.1 必须遵守的规则

- JSON 编解码统一使用 `common/json.go`
- 数据库必须同时兼容 SQLite / MySQL / PostgreSQL
- 优先使用 GORM，不依赖数据库方言特性
- 新增结构化配置优先使用 `config.GlobalConfig.Register()`
- 新增表字段中的复杂 JSON 数据优先存为 `TEXT` 字符串
- 新模型时间字段优先使用 `int64` Unix 时间戳

### 2.2 必须复用的现有能力

- Redis：`common.RDB` / `common.RedisEnabled`
- 配置体系：
  - `common.OptionMap`
  - `config.GlobalConfig`
- 后台任务模式：
  - `main.go` 启动
  - `service/*task.go`
  - `sync.Once + atomic.Bool`
- 通知能力：
  - `service.NotifyRootUser`
  - `service.NotifyUser`
- 控制台配置与面板：
  - `console_setting`
  - `controller.GetStatus`
- 日志能力：
  - `model.Log`
  - `logs.use_time`
  - `logs.request_id`
- 通道巡检与自动禁用：
  - `controller/channel-test.go`
  - `service/channel.go`

### 2.3 当前设计基线

当前仓库已经不是“空白 new-api”，而是一个已扩展过的工程。

因此开发策略必须是：

- 增量增强
- 不平行造轮子
- 先把新增能力挂在现有链路上
- 能复用已有配置、通知、日志、后台任务的地方不另起一套

---

## 3. 总体分期

## Sprint A

- 模块 6：一键导出配置
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

## 4. 配置与状态设计总原则

### 4.1 结构化配置统一方案

新增的业务配置统一按以下模式实现：

1. 在 `setting/operation_setting/`、`setting/system_setting/` 或 `setting/ratio_setting/` 下新增配置文件
2. 定义结构体
3. `config.GlobalConfig.Register("xxx_setting", &xxxSetting)`
4. 通过现有 `option` 持久化机制读写数据库
5. 前端仍通过 `/api/option` 读写配置键

这样做的好处：

- 与现有仓库一致
- 类型安全
- 不需要为每个配置单独造表
- 前端可以继续沿用现有设置页更新方式

### 4.2 实时状态与持久状态分离

以下状态建议采用“双层设计”：

- 持久层：数据库 / option 配置
- 实时层：Redis

适合这样设计的能力：

- 维护模式
- 并发计数
- 后续的慢请求实时采样

### 4.3 Redis 故障策略

所有依赖 Redis 的保护性能力必须遵守：

- Redis 正常：按设计执行
- Redis 故障：优先保证主链路可用

对应策略：

- 并发限制：Redis 故障时 fail-open 放行
- 维护模式：Redis 故障时回退数据库配置
- 慢请求监控：Redis 故障时回退日志聚合或不触发实时统计

---

## 5. Sprint A 详细实施

## 5.1 模块 6：一键导出 Codex / Claude Code 配置

### 5.1.1 目标

在用户 Token 管理界面，为每个 Token 提供“导出接入配置”的能力。

能力范围：

- 生成 Codex 配置片段
- 生成 Claude Code 配置片段
- 生成 Cursor / Continue 通用接入片段
- 提供测试命令

不做：

- 自动写入用户本地文件
- 下载脚本
- 自动安装 CLI

### 5.1.2 路由设计

新增接口：

- `GET /api/token/:id/export?tool=codex`
- `GET /api/token/:id/export?tool=claude_code`
- `GET /api/token/:id/export?tool=cursor`
- `GET /api/token/:id/export?tool=continue`

鉴权：

- `middleware.UserAuth()`
- 仅允许访问自己的 token

### 5.1.3 返回结构建议

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

### 5.1.4 后端文件落点

新增：

- `controller/token_export.go`

可选新增：

- `service/token_export.go`

修改：

- `router/api-router.go`

复用：

- `model.GetTokenByIds`
- `system_setting.ServerAddress`
- `controller/token.go` 的 token 权限模式

### 5.1.5 实现要点

- 统一从 `system_setting.ServerAddress` 取服务地址
- 若服务地址为空，可回退为当前请求推导地址，但文档中标记为兜底逻辑
- 输出的 token key 必须使用真实 key，不使用掩码
- 需要考虑不同客户端要求：
  - Codex：环境变量 + config 片段
  - Claude Code：环境变量 / gateway 模式片段
  - Cursor / Continue：OpenAI-compatible 片段

### 5.1.6 前端文件落点

可能涉及：

- `web/src/components/table/tokens/TokensColumnDefs.jsx`
- `web/src/components/table/tokens/modals/TokenExportConfigModal.jsx` 新增
- `web/src/hooks/tokens/useTokensData.jsx` 可能新增调用逻辑
- `web/src/i18n/locales/*.json`

### 5.1.7 UI 设计建议

在 token 列表的操作下拉中新增：

- 导出 Codex 配置
- 导出 Claude Code 配置
- 导出 Cursor 配置
- 导出 Continue 配置

点击后弹出模态框，内容分区展示：

- 环境变量方式
- 配置文件方式
- 测试命令
- 注意事项

### 5.1.8 测试

后端：

- token 不属于当前用户时返回 403
- 无效 tool 参数返回 400
- 返回内容字段完整
- 服务地址为空时的兜底逻辑

前端：

- 弹窗打开与关闭
- 配置片段复制
- 移动端展示不溢出

### 5.1.9 验收标准

- 用户能在 token 列表中直接打开导出配置弹窗
- 导出的内容能被复制
- 配置片段与当前服务地址、token 对应正确
- 不泄露其他用户 token

---

## 5.2 模块 3：维护模式 V1

### 5.2.1 目标

提供可控的全站维护能力，支持：

- 即时开启维护
- 即时关闭维护
- 维护预告
- 多实例部署实时生效
- 管理员放行

### 5.2.2 一期范围

Sprint A 只做 V1：

- 单一当前维护状态
- 不做多条未来排期计划
- 不做复杂时间编排 UI

### 5.2.3 配置结构

新增：

- `setting/system_setting/maintenance.go`

```go
type MaintenanceSetting struct {
    Enabled          bool   `json:"enabled"`
    Title            string `json:"title"`
    Message          string `json:"message"`
    NoticeEnabled    bool   `json:"notice_enabled"`
    NoticeStartAt    int64  `json:"notice_start_at"`
    StartAt          int64  `json:"start_at"`
    EndAt            int64  `json:"end_at"`
    WhitelistUserIds []int  `json:"whitelist_user_ids"`
    AllowAdminPass   bool   `json:"allow_admin_pass"`
}
```

注册：

- `config.GlobalConfig.Register("maintenance_setting", &maintenanceSetting)`

### 5.2.4 Redis 实时状态设计

键名建议：

- `maintenance:current`

值内容：

- 使用 JSON 字符串保存完整维护状态

行为规则：

- 管理端更新维护状态时：
  - 先写数据库持久化配置
  - 有 Redis 时同步写 Redis
- 请求链路读取时：
  - 优先读 Redis
  - Redis 不可用时回退配置

### 5.2.5 中间件设计

新增：

- `middleware/maintenance.go`

核心逻辑：

1. 读取当前维护状态
2. 若未启用则直接放行
3. 判断当前是否处于预告期
4. 判断当前是否处于维护中
5. root/admin/白名单用户可放行
6. 其余请求返回 503

### 5.2.6 挂载位置

建议新增中间件：

- relay 路由
- video 路由
- API 路由中的核心业务接口

不建议简单以 URL 前缀判断“管理接口是否放行”。

应该以鉴权角色判断。

### 5.2.7 API 设计

新增：

- `GET /api/maintenance`
- `PUT /api/maintenance`
- `POST /api/maintenance/disable`

权限建议：

- `middleware.RootAuth()`

理由：

- 该操作影响全站
- 风险高于普通管理员编辑单业务数据

### 5.2.8 与状态接口联动

修改：

- `controller/misc.go`

在 `GetStatus()` 中新增：

- `maintenance`

建议结构：

```json
{
  "enabled": true,
  "notice_enabled": true,
  "title": "系统维护",
  "message": "预计 30 分钟恢复",
  "notice_start_at": 0,
  "start_at": 0,
  "end_at": 0
}
```

### 5.2.9 前端改动

新增设置页建议：

- `web/src/pages/Setting/Operation/SettingsMaintenance.jsx`

接入：

- `web/src/components/settings/OperationSetting.jsx`

控制台展示：

- 用户侧顶部 banner
- 维护中时，可在部分页面显示明显提示

### 5.2.10 测试

后端：

- Redis 可用时状态即时生效
- Redis 不可用时回退 option/config
- 预告期正常放行且带状态
- 维护期普通用户被拦截
- root/admin 放行
- 白名单用户放行

前端：

- 设置页保存成功
- 用户端 banner 正确展示

### 5.2.11 验收标准

- 多实例部署下，维护开关在数秒内生效
- Redis 宕机时仍可通过数据库配置正常工作
- 普通用户在维护期收到一致的 503 响应
- 管理员不被维护模式误伤

---

## 5.3 时间动态倍率

### 5.3.1 目标

支持按时间段动态调整计费倍率，用于高峰限流、低峰促销、活动运营。

### 5.3.2 一期范围

Sprint A 只做 V1：

- 全局倍率规则
- 按用户组倍率规则
- 按模型倍率规则
- 星期 + 时间区间匹配

不做：

- 按渠道倍率规则
- 节假日规则
- 日期范围配置
- 多层复杂优先级系统
- 与前端营销系统联动

补充说明：

- 按渠道时间动态倍率在技术上可行，但不建议进入 Sprint A
- 原因是 relay 重试时可能切换渠道，会引入“预扣按原渠道、结算按重试渠道”的计费口径复杂度
- 该能力建议放入后续增强版本，与重试重算、补差、日志展示一起设计

### 5.3.3 配置结构

新增：

- `setting/operation_setting/time_dynamic_ratio.go`

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

### 5.3.4 匹配策略

建议优先级：

1. 模型 + 组同时匹配
2. 仅模型匹配
3. 仅组匹配
4. 全局匹配

一期可以采用：

- 命中第一条即生效

后续若需要更复杂规则，再扩展。

### 5.3.5 生效位置

核心集成点固定为：

- `relay/helper/price.go`
- `ModelPriceHelper()`

原因：

- 当前价格计算主入口已经在这里统一汇总 `PriceData`
- `PriceData.OtherRatios` 已被下游文本计费、任务计费等路径消费
- 在这里一次注入倍率，下游会自动生效，改动面最小

可新增辅助函数，例如：

- `ResolveTimeDynamicMultiplier(...)`
- `MatchTimeDynamicRatioRule(...)`

但最终注入动作应收口在 `ModelPriceHelper()`

### 5.3.6 集成点

Sprint A 不建议把时间动态倍率逻辑分散写入多个计费文件。

推荐方式：

- 在 `relay/helper/price.go` 的 `ModelPriceHelper()` 中注入 `OtherRatios`
- 保持 `service/text_quota.go`
- 保持 `service/task_billing.go`
- 保持其他现有计费路径按原有 `OtherRatios` 消费逻辑运行

这样可以避免在多个结算入口重复维护同一套时间规则。

### 5.3.7 实现建议

优先复用现有 `PriceData.OtherRatios`：

- key 建议：`time_dynamic_multiplier`

这样做的好处：

- 日志可追踪
- 与现有附加倍率机制兼容
- 减少额外上下文传递改动

### 5.3.8 计费原则

V1 只影响最终额度计算。

不影响：

- 模型发现
- 模型可用性
- 模型公开倍率同步接口
- 通道路由选择

### 5.3.9 前端

新增设置页建议：

- `web/src/pages/Setting/Operation/SettingsTimeDynamicRatio.jsx`

接入：

- `web/src/components/settings/OperationSetting.jsx`

说明：

- 尽管该能力本质上属于定价策略，但按当前产品归类，前端放到“运营设置”
- Sprint A 不放到“分组与模型定价设置”

展示建议：

- 开关
- 规则表
- 新增/编辑规则 modal

### 5.3.10 测试

- 指定时间命中规则
- 跨午夜区间规则
- 模型匹配、组匹配、全局匹配
- 未命中时倍率为 1
- `ModelPriceHelper()` 注入后的文本与任务链路都能生效
- 重试切换渠道时不引入按渠道倍率差异

### 5.3.11 验收标准

- 在配置时间窗口内，计费结果按预期变化
- 日志中可看到动态倍率信息
- 未命中规则时不影响现有计费结果

---

## 6. Sprint B 实施

## 6.1 模块 1：慢请求监控 V1

### 目标

基于现有 `logs` 聚合慢请求，不增加主链路写入复杂度。

### 核心设计

- 使用后台固定循环
- 周期默认 3 分钟
- 统计窗口默认 5 分钟
- 从 `logs` 表按 `use_time` 聚合
- 告警默认发给 root 或启用通知的管理员

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

### 测试

- 聚合逻辑正确
- 冷却时间生效
- 无日志时不误报

---

## 6.2 模块 7：不活跃账户清理 V1

### 目标

清理长期不活跃且无充值/订阅历史的用户额度。

### 判断口径

不活跃：

- 最近 N 天在 `logs` 中没有消费或错误请求

未充值：

- `top_ups` 无成功充值记录
- `subscription_orders` / `user_subscriptions` 无有效订阅记录

### 实现路径

新增：

- `model/quota_cleanup_log.go`
- `service/inactive_cleanup_task.go`
- `setting/operation_setting/inactive_cleanup_setting.go`

### 注意点

- 一期先做 dry-run 模式
- 实际执行前必须记录清理日志
- 白名单、管理员、root 默认不处理

---

## 7. Sprint C 实施

## 7.1 模块 4：用户并发限制

### 目标

限制同一用户在 relay 主链路上的并发请求数。

### 挂载位置

建议加在：

- `TokenAuth()` 之后
- `Distribute()` 之前

对应路由：

- `router/relay-router.go`
- `router/video-router.go`
- 任务相关 relay 入口也要覆盖

### 设计原则

- Redis 正常时原子计数
- Redis 故障时 fail-open 放行
- 请求结束后释放计数
- 异常中断依赖 TTL 自动回收

### 配置结构

新增：

- `setting/operation_setting/concurrency_setting.go`

字段建议：

- `enabled`
- `free_default`
- `paid_default`
- `group_defaults`
- `redis_fail_open`
- `counter_ttl_seconds`

### 数据模型

新增：

- `model/user_concurrency_override.go`

只做用户级覆盖，不单独建组配置表。

### 中间件

新增：

- `middleware/concurrency_limit.go`

### 注意点

- “已充值用户”不建议用 `quota > 0` 判断
- 一期可优先按用户组区分

---

## 8. Sprint D 实施

## 8.1 模块 2：轻量调度管理

### 目标

不是做通用平台，而是做“有限内置任务的持久化编排器”。

### 支持任务类型

- `slow_request_check`
- `inactive_cleanup`
- `usage_report`
- `log_cleanup`

### 数据模型

新增：

- `model/scheduled_task.go`
- `model/scheduled_task_execution.go`

### 后端

新增：

- `service/scheduled_task_runner.go`
- `service/scheduled_task_handlers.go`
- `controller/scheduled_task.go`

### 路由

- `GET /api/scheduled_task`
- `POST /api/scheduled_task`
- `PUT /api/scheduled_task/:id`
- `DELETE /api/scheduled_task/:id`
- `POST /api/scheduled_task/:id/run`
- `POST /api/scheduled_task/:id/toggle`
- `GET /api/scheduled_task/:id/executions`

### UI

新增设置页或管理页：

- 任务列表
- 启停
- 手动执行
- 最近执行日志

---

## 8.2 渠道健康评分

### 目标

基于现有日志和巡检结果给渠道打分。

### 数据来源

- `logs.use_time`
- `logs.type`
- 自动巡检结果

### 输出

- 后台排行
- 后续供兜底和自动禁用增强使用

---

## 8.3 Token 用量日报

### 目标

每天推送用量汇总给管理员。

### 数据来源

- `logs`

### 输出内容

- 总请求数
- 总额度消耗
- Top 用户
- Top 模型
- Top 渠道

---

## 9. Sprint E 实施

## 9.1 模块 5：渠道兜底

### 这是最高风险模块

原因：

- 当前 relay 已有重试
- 当前 relay 有预扣费与退款
- 流式与非流式逻辑不同
- body storage 需要多次重放
- 错误日志与使用日志都已嵌入主链路

### 实施原则

不要新建一个平行的 relay 主流程。

应在现有：

- `controller/relay.go`
- `middleware/Distribute()`

基础上增强“候选渠道重试能力”。

### 数据模型

新增：

- `model/channel_fallback_rule.go`

### 关键要求

- 每次 fallback 都能重放请求体
- 预扣费与退款口径一致
- 流式场景不出现重复写响应
- 错误日志能看出 fallback 链路

### 建议先决工作

先补齐：

- 渠道健康评分
- 自动禁用增强
- 错误分类清晰化

---

## 10. 数据模型总清单

建议新增的模型文件：

- `model/user_concurrency_override.go`
- `model/quota_cleanup_log.go`
- `model/scheduled_task.go`
- `model/scheduled_task_execution.go`
- `model/channel_fallback_rule.go`

不建议 Sprint A 新增业务表。

Sprint A 以配置与接口为主。

---

## 11. 路由与文件修改清单

## Sprint A

后端新增：

- `controller/token_export.go`
- `middleware/maintenance.go`
- `service/maintenance_state.go`
- `setting/system_setting/maintenance.go`
- `setting/operation_setting/time_dynamic_ratio.go`

后端修改：

- `router/api-router.go`
- `router/relay-router.go`
- `router/video-router.go`
- `controller/misc.go`
- `relay/helper/price.go`
- `service/task_billing.go`

前端新增：

- `web/src/components/table/tokens/modals/TokenExportConfigModal.jsx`
- `web/src/pages/Setting/Operation/SettingsMaintenance.jsx`
- `web/src/pages/Setting/Operation/SettingsTimeDynamicRatio.jsx`

前端修改：

- `web/src/components/table/tokens/TokensColumnDefs.jsx`
- `web/src/components/settings/OperationSetting.jsx`
- 仪表盘或全局通知展示组件
- `web/src/i18n/locales/*.json`

---

## 12. 测试策略

### 12.1 单元测试

重点覆盖：

- 导出配置生成逻辑
- 维护状态判定逻辑
- Redis 失效回退逻辑
- 动态倍率匹配与 `ModelPriceHelper()` 注入逻辑
- 慢请求聚合逻辑
- 清理目标筛选逻辑
- 并发限制 Redis fail-open

### 12.2 集成测试

重点覆盖：

- `GET /api/token/:id/export`
- `GET/PUT /api/maintenance`
- 维护期 relay 返回 503
- GetStatus 返回维护信息
- 动态倍率影响实际计费

### 12.3 手工验证

必须进行：

- 多实例维护切换验证
- Redis 下线验证
- 用户端 banner 验证
- Codex / Claude Code 配置连通性验证

---

## 13. 上线策略

### 13.1 配置默认值

所有新增能力默认关闭：

- maintenance: disabled
- time dynamic ratio: disabled
- slow request monitor: disabled
- inactive cleanup: dry-run / disabled
- concurrency limit: disabled

### 13.2 上线顺序

推荐：

1. 先发布后端
2. 再发布前端
3. 再逐项开启功能开关

### 13.3 风险控制

- 任何 Redis 依赖能力都不能阻断主链路
- 维护模式必须先在测试环境验证多实例同步
- 动态倍率必须先在测试组或单模型试运行

---

## 14. 各模块验收清单

## Sprint A 验收

- Token 导出配置接口可用
- 前端可展示导出弹窗
- 维护模式可即时开启关闭
- 多实例下维护状态同步正常
- Redis 异常时维护模式能回退数据库配置
- 时间动态倍率能对计费结果生效
- 日志中可看到动态倍率信息

## Sprint B 验收

- 慢请求监控可告警
- 清理任务可 dry-run
- 清理任务执行有日志

## Sprint C 验收

- 并发数限制生效
- Redis 故障时自动放行
- 用户级覆盖可配置

## Sprint D 验收

- 调度任务可创建、执行、查看日志
- 日报可发送
- 健康评分可展示

## Sprint E 验收

- 主渠道失败时能切换备用渠道
- 不影响账单口径
- 不破坏流式响应

---

## 15. 最终建议

开发时请始终按以下顺序判断：

1. 能否复用现有能力
2. 能否先做配置版 / 简化版
3. 是否会碰 relay 主链路
4. Redis 故障时是否仍可用
5. 多实例部署是否一致

对于当前项目，最稳妥的开发顺序是：

1. 先做 Sprint A
2. Sprint A 验收通过后再做慢请求和清理
3. 再做并发限制
4. 最后再进入调度与兜底

这份方案可以直接作为后续开发、拆任务、测试和上线的基线文档。
