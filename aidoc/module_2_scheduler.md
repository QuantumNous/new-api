# 模块二：调度管理引擎

## 核心定位

调度管理是一个**统一的定时任务平台**，所有需要周期性执行的功能（慢请求监控、账户清理、渠道探活等）都注册为调度任务类型，管理员在前端统一配置和管理。

---

## 内置任务类型（管理员选择创建）

| 任务类型 | 标识 | 参数配置 | 默认频率 |
|----------|------|----------|----------|
| 慢请求监控 | `slow_request_check` | 阈值/窗口/数量/告警通道 | `*/5 * * * *` |
| 渠道可用性检测 | `channel_test` | 测试模型/超时时间 | `*/5 * * * *` |
| 渠道余额检查 | `channel_balance` | 最低余额阈值/告警通道 | `0 */6 * * *` |
| **不活跃账户清理** | `inactive_cleanup` | 不活跃天数/排除充值用户 | `0 3 * * *` |
| 日志清理 | `log_cleanup` | 保留天数 | `0 4 * * *` |
| 统计聚合 | `stats_aggregate` | 聚合粒度 | `0 * * * *` |
| Token 用量日报 | `usage_report` | 报告范围/推送通道 | `0 9 * * *` |
| 渠道健康评分更新 | `health_score` | 评分算法参数 | `*/10 * * * *` |

---

## 管理员配置界面

### 任务列表页

```
┌─ 调度任务管理 ─────────────────────────────────────────────┐
│                                              [+ 新建任务]   │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ 状态  │ 名称              │ 类型          │ 频率       │ 上次执行   │ 操作     ││
│ │──────│──────────────────│──────────────│───────────│──────────│────────││
│ │ 🟢   │ 全渠道慢请求监控   │ 慢请求监控    │ 每3分钟    │ 2分钟前    │ ⏸ 📝 🗑 ││
│ │ 🟢   │ 渠道可用性巡检     │ 渠道检测      │ 每5分钟    │ 3分钟前    │ ⏸ 📝 🗑 ││
│ │ 🟢   │ 不活跃账户清理     │ 账户清理      │ 每天3:00  │ 21小时前   │ ⏸ 📝 🗑 ││
│ │ ⏸    │ 日志清理           │ 日志清理      │ 每天4:00  │ 已暂停     │ ▶ 📝 🗑 ││
│ └──────────────────────────────────────────────────────────┘│
│                                                              │
│ 📊 最近执行日志                                              │
│ ├─ [09:15] 全渠道慢请求监控 ✅ 成功 (45ms)                  │
│ ├─ [09:10] 渠道可用性巡检 ✅ 成功，3/3 渠道正常 (2.1s)     │
│ └─ [03:00] 不活跃账户清理 ✅ 清理 12 个用户额度 (156ms)     │
└──────────────────────────────────────────────────────────────┘
```

### 创建任务流程

```
Step 1: 选择任务类型
┌─────────────────────────────────────────┐
│  请选择任务类型：                        │
│                                         │
│  📊 慢请求监控     - 检测响应过慢的请求  │
│  🔍 渠道可用性检测 - 定期测试渠道连通性  │
│  💰 渠道余额检查   - 监控渠道余额        │
│  🧹 不活跃账户清理 - 清理闲置用户额度    │
│  📁 日志清理       - 清除过期日志数据     │
│  📈 统计聚合       - 汇总请求统计数据     │
│  📮 用量日报       - 推送每日用量报告     │
│  ❤️ 渠道健康评分   - 更新渠道健康度       │
└─────────────────────────────────────────┘

Step 2: 配置参数（根据类型动态渲染表单）

Step 3: 设置执行频率（Cron 表达式 + 可视化选择）
┌──────────────────────────────────┐
│  快捷选择：                      │
│  [每分钟] [每5分钟] [每小时]     │
│  [每天指定时间] [每周] [自定义]  │
│                                  │
│  Cron 表达式：*/5 * * * *        │
│  说明：每 5 分钟执行一次         │
└──────────────────────────────────┘
```

---

## 后端实现

### 调度引擎

```go
// scheduler/engine.go
type SchedulerEngine struct {
    cron      *cron.Cron
    registry  map[string]TaskHandler   // 任务类型 → 处理器
    mu        sync.RWMutex
}

type TaskHandler interface {
    // 返回任务类型标识
    Type() string
    // 返回参数的 JSON Schema（前端动态渲染用）
    ParamSchema() json.RawMessage
    // 执行任务
    Execute(ctx context.Context, params json.RawMessage) (*TaskResult, error)
}

type TaskResult struct {
    Success bool   `json:"success"`
    Output  string `json:"output"`
}

// 启动时注册所有内置任务类型
func (e *SchedulerEngine) RegisterBuiltinTasks() {
    e.Register(&SlowRequestCheckTask{})
    e.Register(&ChannelTestTask{})
    e.Register(&InactiveCleanupTask{})
    e.Register(&LogCleanupTask{})
    e.Register(&StatsAggregateTask{})
    e.Register(&UsageReportTask{})
    e.Register(&HealthScoreTask{})
    e.Register(&ChannelBalanceTask{})
}

// 从数据库加载已配置的任务并启动
func (e *SchedulerEngine) LoadAndStart() error {
    tasks, _ := model.GetEnabledTasks()
    for _, task := range tasks {
        handler := e.registry[task.TaskType]
        e.cron.AddFunc(task.CronExpr, func() {
            e.executeTask(task, handler)
        })
    }
    e.cron.Start()
    return nil
}
```

### 数据库

```sql
CREATE TABLE scheduled_tasks (
    id            INT PRIMARY KEY AUTO_INCREMENT,
    name          VARCHAR(100) NOT NULL,
    task_type     VARCHAR(50) NOT NULL,       -- 对应 TaskHandler.Type()
    cron_expr     VARCHAR(100) NOT NULL,
    task_params   JSON,                       -- 任务参数
    enabled       TINYINT(1) DEFAULT 1,
    last_run_at   DATETIME,
    next_run_at   DATETIME,
    last_status   VARCHAR(20) DEFAULT 'idle', -- idle/running/success/failed
    last_output   TEXT,
    created_by    INT,                        -- 创建者
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE task_execution_logs (
    id            INT PRIMARY KEY AUTO_INCREMENT,
    task_id       INT NOT NULL,
    status        VARCHAR(20) NOT NULL,
    output        TEXT,
    duration_ms   INT,
    started_at    DATETIME,
    finished_at   DATETIME,
    INDEX idx_task_time (task_id, started_at)
);
```

### API 端点

```
POST   /api/scheduler/tasks          -- 创建任务
GET    /api/scheduler/tasks          -- 列表
PUT    /api/scheduler/tasks/:id      -- 更新
DELETE /api/scheduler/tasks/:id      -- 删除
POST   /api/scheduler/tasks/:id/run  -- 手动执行
POST   /api/scheduler/tasks/:id/toggle -- 启停
GET    /api/scheduler/tasks/:id/logs -- 执行日志
GET    /api/scheduler/task-types     -- 获取可用任务类型和参数 Schema
```
