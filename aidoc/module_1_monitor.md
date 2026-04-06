# 模块一：慢请求监控告警

## 设计变更

> **用户反馈**：慢请求监控整合进调度管理模块，提供可配置选项给管理员。

不再作为独立的后台轮询，而是作为**调度任务的一种内置类型**，管理员可以在调度管理页面中：
- 创建/编辑慢请求监控任务
- 配置阈值、窗口、触发条件
- 选择告警通道

---

## 管理员可配置选项

在调度模块创建「慢请求监控」任务时，提供以下配置项：

```
┌─ 创建监控任务 ─────────────────────────────────┐
│                                                  │
│  任务名称：[慢请求监控 - 全渠道          ]       │
│  执行频率：[*/3 * * * *] (每3分钟)               │
│                                                  │
│  ── 监控参数 ──                                  │
│  慢请求阈值：  [10] 秒    ▼ (5/10/15/30/60)     │
│  监控窗口：    [5 ] 分钟  ▼ (3/5/10/15/30)      │
│  触发数量：    [10] 个    ▼ (5/10/20/50)         │
│  告警冷却：    [15] 分钟  ▼ (5/15/30/60)         │
│                                                  │
│  ── 监控范围 ──                                  │
│  ○ 全部渠道                                      │
│  ● 指定渠道：[✓ 渠道A] [✓ 渠道B] [  渠道C]     │
│  指定模型：  [全部 ▼]                            │
│                                                  │
│  ── 告警通道 ──                                  │
│  [✓] 钉钉机器人   Webhook: [https://...]         │
│  [✓] Telegram     Bot Token: [xxx] Chat: [xxx]   │
│  [ ] 企业微信                                    │
│  [ ] 邮件                                        │
│                                                  │
│            [取消]  [保存并启用]                   │
└──────────────────────────────────────────────────┘
```

---

## 后端实现

### 任务类型注册

```go
// scheduler/tasks/slow_request_check.go

type SlowRequestCheckParams struct {
    ThresholdSeconds int      `json:"threshold_seconds"` // 慢请求阈值
    WindowMinutes    int      `json:"window_minutes"`    // 监控窗口
    AlertCount       int      `json:"alert_count"`       // 触发数量
    CooldownMinutes  int      `json:"cooldown_minutes"`  // 冷却时间
    ChannelIDs       []int    `json:"channel_ids"`       // 指定渠道（空=全部）
    Models           []string `json:"models"`            // 指定模型（空=全部）
    AlertChannels    []string `json:"alert_channels"`    // 告警通道
}

func (t *SlowRequestCheckTask) Execute(params json.RawMessage) error {
    var p SlowRequestCheckParams
    json.Unmarshal(params, &p)
    
    // 1. 从 Redis 滑动窗口获取慢请求计数
    windowStart := time.Now().Add(-time.Duration(p.WindowMinutes) * time.Minute)
    count := redis.ZCount(ctx, "slow_requests", 
        strconv.FormatInt(windowStart.Unix(), 10), "+inf")
    
    // 2. 判断是否触发告警
    if count >= int64(p.AlertCount) {
        // 3. 检查冷却期
        cooldownKey := "alert_cooldown:slow_request"
        if redis.Exists(ctx, cooldownKey) == 0 {
            // 4. 发送告警
            SendAlert(p.AlertChannels, fmt.Sprintf(
                "⚠️ 慢请求告警\n窗口: %d分钟\n慢请求数: %d (阈值>%ds)\n请检查渠道状态",
                p.WindowMinutes, count, p.ThresholdSeconds))
            
            // 设置冷却
            redis.Set(ctx, cooldownKey, "1", 
                time.Duration(p.CooldownMinutes)*time.Minute)
        }
    }
    return nil
}
```

### 数据采集（在 relay 中间件，始终运行）

```go
// middleware/monitor.go
// 这部分是被动采集，不依赖调度，只要有请求就记录
func MonitorMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        start := time.Now()
        c.Next()
        
        duration := time.Since(start)
        
        // 获取当前全局慢请求阈值（从配置缓存读取）
        threshold := GetSlowThreshold() // 默认 10 秒
        
        if duration > time.Duration(threshold)*time.Second {
            // 写入 Redis Sorted Set，供调度任务检查
            redis.ZAdd(ctx, "slow_requests", &redis.Z{
                Score:  float64(time.Now().Unix()),
                Member: buildSlowRequestEntry(c, duration),
            })
            // 维护窗口大小，清除过期数据
            redis.ZRemRangeByScore(ctx, "slow_requests", "-inf",
                strconv.FormatInt(time.Now().Add(-30*time.Minute).Unix(), 10))
        }
    }
}
```

---

## 数据库

```sql
-- 告警通道配置表（全局共用）
CREATE TABLE notification_channels (
    id         INT PRIMARY KEY AUTO_INCREMENT,
    name       VARCHAR(100) NOT NULL,
    type       VARCHAR(30) NOT NULL,   -- 'dingtalk'/'wechat'/'telegram'/'email'/'webhook'
    config     JSON NOT NULL,          -- 渠道特定配置
    enabled    TINYINT(1) DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 告警历史
CREATE TABLE alert_history (
    id               INT PRIMARY KEY AUTO_INCREMENT,
    task_id          INT,                -- 关联调度任务
    alert_type       VARCHAR(50),        -- 'slow_request' / 'channel_down' / 'quota_low'
    message          TEXT,
    notification_ids JSON,               -- 使用了哪些通知渠道
    created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
);
```
