# 模块八：补充建议功能（8-14）

> 以下功能为建议增加项，可根据优先级选择性开发。

---

## 8. 渠道健康度自动评分

**目的**：与兜底策略联动，低分渠道自动降权或告警。

```go
// 健康评分算法
type ChannelHealthScore struct {
    ChannelID    int
    SuccessRate  float64   // 成功率 (0-100)
    AvgLatency   float64   // 平均延迟 (ms)
    ErrorRate    float64   // 错误率
    Score        int       // 综合评分 (0-100)
    UpdatedAt    time.Time
}

// 评分公式：
// Score = SuccessRate * 0.5 + (1 - min(AvgLatency/10000, 1)) * 100 * 0.3 + (1 - ErrorRate) * 100 * 0.2
```

作为调度任务 `health_score`，每 10 分钟更新。管理后台展示渠道健康度排行。

---

## 9. Token 用量日报推送

**目的**：每日推送用量摘要，及时发现异常。

报告内容：
- 昨日总请求数 / 总消耗额度
- Top 5 用户用量排行
- Top 5 模型调用排行
- 渠道用量分布
- 与前一天对比的变化趋势

作为调度任务 `usage_report`，每天上午 9 点推送到告警通道。

---

## 10. IP 白名单 / 黑名单

```sql
CREATE TABLE ip_rules (
    id         INT PRIMARY KEY AUTO_INCREMENT,
    ip_pattern VARCHAR(50) NOT NULL,     -- 支持 CIDR，如 192.168.1.0/24
    rule_type  VARCHAR(10) NOT NULL,     -- 'allow' / 'deny'
    scope      VARCHAR(20) DEFAULT 'global', -- 'global' / 'user:123'
    reason     VARCHAR(200),
    expires_at DATETIME,                 -- 到期自动失效
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

在 Gin 中间件链最前端检查 IP。

---

## 11. 请求重放 / 调试

对指定 Token 或用户启用**完整请求记录**（默认关闭，性能影响大）：
- 记录完整的请求体和响应体
- 支持一键重放
- 排查问题时临时开启

```sql
CREATE TABLE request_recordings (
    id            BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id       INT,
    token_id      INT,
    channel_id    INT,
    model         VARCHAR(100),
    request_body  MEDIUMTEXT,
    response_body MEDIUMTEXT,
    status_code   INT,
    duration_ms   INT,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 12. 渠道自动禁用与恢复

与渠道健康评分联动：
- 连续失败 N 次（默认 5 次）→ 自动禁用渠道
- 禁用后，调度任务定期探活（发送测试请求）
- 探活成功 → 自动恢复渠道
- 所有状态变更记录日志并告警

```go
// 在 relay 失败后调用
func HandleChannelFailure(channelID int) {
    key := fmt.Sprintf("channel_failures:%d", channelID)
    count := redis.Incr(ctx, key)
    redis.Expire(ctx, key, 10*time.Minute)
    
    if count >= GetAutoDisableThreshold() {
        model.DisableChannel(channelID, "连续失败自动禁用")
        SendAlert(nil, fmt.Sprintf("⛔ 渠道 #%d 已自动禁用（连续失败 %d 次）", channelID, count))
    }
}
```

---

## 13. 用户公告系统

```sql
CREATE TABLE announcements (
    id           INT PRIMARY KEY AUTO_INCREMENT,
    title        VARCHAR(200) NOT NULL,
    content      TEXT NOT NULL,
    type         VARCHAR(20) DEFAULT 'info',   -- 'info'/'warning'/'urgent'
    target       VARCHAR(20) DEFAULT 'all',    -- 'all'/'users'/'admins'
    pinned       TINYINT(1) DEFAULT 0,
    published_at DATETIME,
    expires_at   DATETIME,
    created_by   INT,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

用户登录面板时顶部展示公告 Banner，支持已读标记和置顶。

---

## 14. 操作审计日志

```sql
CREATE TABLE audit_logs (
    id           BIGINT PRIMARY KEY AUTO_INCREMENT,
    operator_id  INT NOT NULL,          -- 操作人
    action       VARCHAR(100) NOT NULL, -- 'channel.create'/'user.update'/'token.delete'
    target_type  VARCHAR(50),           -- 'channel'/'user'/'token'
    target_id    INT,
    detail       JSON,                  -- 操作详情
    ip_address   VARCHAR(50),
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_operator (operator_id),
    INDEX idx_action (action),
    INDEX idx_time (created_at)
);
```

在所有管理端写操作后记录审计日志，支持按操作人/操作类型/时间范围查询。

---

## 开发优先级建议

| 优先级 | 功能 | 理由 |
|--------|------|------|
| 建议第一批 | #12 渠道自动禁用恢复 | 与兜底策略强关联 |
| 建议第一批 | #8 渠道健康评分 | 运维核心指标 |
| 建议第二批 | #9 用量日报 | 运营需要 |
| 建议第二批 | #13 公告系统 | 用户体验 |
| 可选 | #10 IP 控制 | 安全加固 |
| 可选 | #14 审计日志 | 多管理员场景 |
| 可选 | #11 请求重放 | 调试场景 |
