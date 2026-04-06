# 模块七：不活跃账户额度清理

## 需求描述

> 一周内从没有使用过的且从未充值过用户的额度清理

作为**调度任务的内置类型**，管理员在调度管理中配置。

---

## 清理规则

| 条件 | 说明 |
|------|------|
| 最近 N 天无请求记录 | 默认 7 天，管理员可配置 |
| 从未充值 | `is_charged = false` 且无充值记录 |
| 有剩余额度 | `quota > 0`（否则无需清理） |
| 非管理员 | `role < admin` |
| 非白名单用户 | 管理员可设置免清理白名单 |

---

## 后端实现

```go
// scheduler/tasks/inactive_cleanup.go

type InactiveCleanupParams struct {
    InactiveDays    int   `json:"inactive_days"`    // 不活跃天数，默认 7
    ExcludeCharged  bool  `json:"exclude_charged"`  // 排除充值用户，默认 true
    ExcludeUserIDs  []int `json:"exclude_user_ids"` // 白名单用户
    DryRun          bool  `json:"dry_run"`          // 试运行模式（只统计不清理）
    NotifyUsers     bool  `json:"notify_users"`     // 是否通知被清理用户
    AlertOnComplete bool  `json:"alert_on_complete"` // 完成后告警通知管理员
}

func (t *InactiveCleanupTask) Execute(ctx context.Context, params json.RawMessage) (*TaskResult, error) {
    var p InactiveCleanupParams
    json.Unmarshal(params, &p)
    if p.InactiveDays == 0 {
        p.InactiveDays = 7
    }
    
    cutoffTime := time.Now().AddDate(0, 0, -p.InactiveDays)
    
    // 查询不活跃用户
    // 条件：最后请求时间 < cutoffTime 且从未充值 且有余额
    users, err := model.GetInactiveUsersWithQuota(cutoffTime, p.ExcludeCharged, p.ExcludeUserIDs)
    if err != nil {
        return nil, err
    }
    
    if p.DryRun {
        return &TaskResult{
            Success: true,
            Output: fmt.Sprintf("[试运行] 发现 %d 个不活跃用户待清理，总额度: %d", 
                len(users), sumQuota(users)),
        }, nil
    }
    
    // 执行清理
    cleaned := 0
    totalQuota := 0
    for _, user := range users {
        totalQuota += user.Quota
        
        // 记录清理日志（便于追溯）
        model.CreateCleanupLog(user.ID, user.Quota, "inactive_cleanup")
        
        // 清零额度
        model.UpdateUserQuota(user.ID, 0)
        cleaned++
    }
    
    output := fmt.Sprintf("清理完成：%d 个不活跃用户，回收额度 %d", cleaned, totalQuota)
    
    if p.AlertOnComplete && cleaned > 0 {
        SendAlert(nil, fmt.Sprintf("🧹 不活跃账户清理\n清理用户数: %d\n回收额度: %d\n不活跃标准: %d 天",
            cleaned, totalQuota, p.InactiveDays))
    }
    
    return &TaskResult{Success: true, Output: output}, nil
}
```

### 查询不活跃用户的 SQL

```sql
-- 查找不活跃用户
SELECT u.id, u.username, u.quota, u.is_charged, 
       MAX(l.created_at) as last_request_time
FROM users u
LEFT JOIN request_logs l ON u.id = l.user_id
WHERE u.quota > 0                              -- 有余额
  AND u.role < 10                              -- 非管理员
  AND (u.is_charged = 0 OR u.is_charged IS NULL) -- 从未充值
  AND u.id NOT IN (?)                          -- 排除白名单
GROUP BY u.id
HAVING last_request_time IS NULL               -- 从未使用
   OR last_request_time < ?                    -- 超过 N 天未使用
```

---

## 管理员配置界面

在调度模块创建「不活跃账户清理」任务时：

```
┌─ 创建清理任务 ──────────────────────────────────┐
│                                                  │
│  任务名称：[不活跃账户额度清理          ]        │
│  执行频率：[0 3 * * *] (每天凌晨3点)             │
│                                                  │
│  ── 清理参数 ──                                  │
│  不活跃天数：    [7  ] 天      ▼ (3/7/14/30)     │
│  [✓] 排除曾经充值的用户                          │
│  [✓] 完成后通知管理员                            │
│  [ ] 通知被清理的用户                            │
│                                                  │
│  ── 安全选项 ──                                  │
│  [✓] 首次执行使用试运行模式（只统计不清理）       │
│  白名单用户：[输入用户ID，逗号分隔]              │
│                                                  │
│            [取消]  [保存并启用]                   │
└──────────────────────────────────────────────────┘
```

---

## 数据库

```sql
-- 额度清理日志（审计追溯）
CREATE TABLE quota_cleanup_logs (
    id            INT PRIMARY KEY AUTO_INCREMENT,
    user_id       INT NOT NULL,
    quota_before  INT NOT NULL,        -- 清理前额度
    cleanup_type  VARCHAR(50) NOT NULL, -- 'inactive_cleanup' / 'manual' / 'expired'
    task_id       INT,                  -- 关联的调度任务 ID
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user (user_id),
    INDEX idx_time (created_at)
);
```

## 安全机制

| 措施 | 说明 |
|------|------|
| 试运行模式 | 首次执行只统计不清理，管理员确认后关闭 |
| 清理日志 | 所有清理操作记录在 `quota_cleanup_logs`，可追溯恢复 |
| 白名单 | 重要用户可加入白名单免清理 |
| 排除充值用户 | 默认排除所有曾充值过的用户 |
| 管理员通知 | 清理完成后推送通知 |
