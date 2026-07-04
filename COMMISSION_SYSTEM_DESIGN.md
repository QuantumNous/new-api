# New-API 全功能返佣系统设计方案

## 📋 系统概述

### 设计理念
**"可以不用，但是不能没有"** - 构建一个完整、灵活、可配置的返佣系统，支持多种返佣模式和场景。

### 核心特性
- ✅ 按比例返佣（消费额百分比）
- ✅ 固定额度返佣
- ✅ 多级返佣（1-3级邀请链）
- ✅ 实时/定期结算
- ✅ 返佣记录追踪
- ✅ 返佣统计报表
- ✅ 灵活配置管理
- ✅ 管理后台API
- ✅ 防刷机制
- ✅ 退款扣回

---

## 🗄️ 数据库设计

### 1. commission_log 表（返佣记录）

```sql
CREATE TABLE commission_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    -- 相关用户
    user_id INT NOT NULL COMMENT '被邀请人（消费者）',
    inviter_id INT NOT NULL COMMENT '邀请人（获得返佣）',
    level INT NOT NULL DEFAULT 1 COMMENT '返佣层级（1=直接邀请，2=二级，3=三级）',

    -- 订单信息
    order_id VARCHAR(64) COMMENT '关联订单ID',
    log_id BIGINT COMMENT '关联消费日志ID',
    model_name VARCHAR(128) COMMENT '使用的模型',

    -- 金额信息
    consumption_quota INT NOT NULL COMMENT '消费金额（quota单位）',
    commission_rate DECIMAL(5,4) NOT NULL COMMENT '返佣比例（如0.1000=10%）',
    commission_quota INT NOT NULL COMMENT '返佣金额（quota单位）',

    -- 状态
    status VARCHAR(20) NOT NULL DEFAULT 'pending' COMMENT 'pending/settled/cancelled/refunded',
    settled_at TIMESTAMP NULL COMMENT '结算时间',

    -- 时间
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    -- 索引
    INDEX idx_user_id (user_id),
    INDEX idx_inviter_id (inviter_id),
    INDEX idx_order_id (order_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at),

    -- 外键
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (inviter_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 2. commission_rule 表（返佣规则）

```sql
CREATE TABLE commission_rules (
    id INT PRIMARY KEY AUTO_INCREMENT,
    rule_name VARCHAR(64) NOT NULL COMMENT '规则名称',
    rule_code VARCHAR(32) UNIQUE NOT NULL COMMENT '规则代码',

    -- 规则类型
    rule_type VARCHAR(20) NOT NULL COMMENT 'percentage/fixed/hybrid',

    -- 返佣配置
    level1_rate DECIMAL(5,4) DEFAULT 0 COMMENT '一级返佣比例',
    level2_rate DECIMAL(5,4) DEFAULT 0 COMMENT '二级返佣比例',
    level3_rate DECIMAL(5,4) DEFAULT 0 COMMENT '三级返佣比例',
    fixed_amount INT DEFAULT 0 COMMENT '固定返佣金额（仅fixed类型）',

    -- 限制条件
    min_consumption INT DEFAULT 0 COMMENT '最低消费门槛',
    max_commission INT DEFAULT 0 COMMENT '单次返佣上限（0=不限）',
    daily_limit INT DEFAULT 0 COMMENT '每日返佣上限（0=不限）',
    monthly_limit INT DEFAULT 0 COMMENT '每月返佣上限（0=不限）',

    -- 适用范围
    applicable_models TEXT COMMENT '适用模型（JSON数组，空=全部）',
    excluded_models TEXT COMMENT '排除模型（JSON数组）',

    -- 状态
    is_active BOOLEAN DEFAULT TRUE,
    priority INT DEFAULT 0 COMMENT '优先级（数字越大优先级越高）',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 3. commission_settlement 表（结算记录）

```sql
CREATE TABLE commission_settlements (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL COMMENT '结算用户',

    -- 结算周期
    period_type VARCHAR(10) NOT NULL COMMENT 'daily/weekly/monthly',
    period_start DATE NOT NULL COMMENT '周期开始日期',
    period_end DATE NOT NULL COMMENT '周期结束日期',

    -- 金额统计
    total_commission INT NOT NULL DEFAULT 0 COMMENT '应结算总额',
    settled_amount INT NOT NULL DEFAULT 0 COMMENT '已结算金额',
    pending_amount INT NOT NULL DEFAULT 0 COMMENT '待结算金额',

    -- 状态
    status VARCHAR(20) NOT NULL DEFAULT 'pending' COMMENT 'pending/processing/completed/failed',
    settled_at TIMESTAMP NULL COMMENT '结算完成时间',
    transaction_id VARCHAR(64) COMMENT '转账交易ID',

    -- 备注
    remark TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_user_id (user_id),
    INDEX idx_period (period_type, period_start, period_end),
    INDEX idx_status (status),

    FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 4. commission_config 表（系统配置）

```sql
CREATE TABLE commission_configs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    config_key VARCHAR(64) UNIQUE NOT NULL,
    config_value TEXT NOT NULL,
    config_type VARCHAR(20) NOT NULL COMMENT 'string/number/boolean/json',
    description VARCHAR(255),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## 🔧 核心逻辑设计

### 1. 返佣计算服务

```go
// service/commission.go

type CommissionService struct {
    db *gorm.DB
}

// CommissionRequest 返佣请求
type CommissionRequest struct {
    UserID       int     // 消费用户ID
    LogID        int64   // 消费日志ID
    OrderID      string  // 订单ID
    ModelName    string  // 使用的模型
    QuotaUsed    int     // 消费金额
}

// CommissionResult 返佣结果
type CommissionResult struct {
    TotalCommission int
    Details         []CommissionDetail
}

// CommissionDetail 单笔返佣详情
type CommissionDetail struct {
    InviterID      int
    Level          int
    CommissionRate float64
    CommissionQuota int
    Status         string
}

// CalculateCommission 计算返佣
func (s *CommissionService) CalculateCommission(req CommissionRequest) (*CommissionResult, error) {
    // 1. 查找用户的邀请链（最多3级）
    inviterChain, err := s.getInviterChain(req.UserID, 3)
    if err != nil {
        return nil, err
    }

    // 2. 获取适用的返佣规则
    rule, err := s.getApplicableRule(req.ModelName, req.QuotaUsed)
    if err != nil {
        return nil, err
    }

    result := &CommissionResult{}

    // 3. 计算各级返佣
    for level, inviterID := range inviterChain {
        if inviterID == 0 {
            break
        }

        var rate float64
        switch level {
        case 0:
            rate = rule.Level1Rate
        case 1:
            rate = rule.Level2Rate
        case 2:
            rate = rule.Level3Rate
        }

        if rate <= 0 {
            continue
        }

        // 计算返佣金额
        commissionQuota := int(float64(req.QuotaUsed) * rate)

        // 检查上限
        if rule.MaxCommission > 0 && commissionQuota > rule.MaxCommission {
            commissionQuota = rule.MaxCommission
        }

        // 检查每日/每月限额
        if !s.checkDailyLimit(inviterID, commissionQuota, rule.DailyLimit) {
            continue
        }
        if !s.checkMonthlyLimit(inviterID, commissionQuota, rule.MonthlyLimit) {
            continue
        }

        detail := CommissionDetail{
            InviterID:       inviterID,
            Level:           level + 1,
            CommissionRate:  rate,
            CommissionQuota: commissionQuota,
            Status:          "pending",
        }
        result.Details = append(result.Details, detail)
        result.TotalCommission += commissionQuota
    }

    return result, nil
}

// ProcessCommission 执行返佣
func (s *CommissionService) ProcessCommission(req CommissionRequest) error {
    // 计算返佣
    result, err := s.CalculateCommission(req)
    if err != nil {
        return err
    }

    // 开始事务
    return s.db.Transaction(func(tx *gorm.DB) error {
        for _, detail := range result.Details {
            // 1. 创建返佣记录
            log := &model.CommissionLog{
                UserID:          req.UserID,
                InviterID:       detail.InviterID,
                Level:           detail.Level,
                OrderID:         req.OrderID,
                LogID:           req.LogID,
                ModelName:       req.ModelName,
                ConsumptionQuota: req.QuotaUsed,
                CommissionRate:  detail.CommissionRate,
                CommissionQuota: detail.CommissionQuota,
                Status:          "settled",
                SettledAt:       time.Now(),
            }

            if err := tx.Create(log).Error; err != nil {
                return err
            }

            // 2. 直接结算到邀请人余额
            if err := tx.Model(&model.User{}).
                Where("id = ?", detail.InviterID).
                Updates(map[string]interface{}{
                    "quota":     gorm.Expr("quota + ?", detail.CommissionQuota),
                    "aff_quota": gorm.Expr("aff_quota + ?", detail.CommissionQuota),
                }).Error; err != nil {
                return err
            }

            // 3. 更新邀请历史统计
            if err := tx.Model(&model.User{}).
                Where("id = ?", detail.InviterID).
                Update("aff_history_quota",
                    gorm.Expr("aff_history_quota + ?", detail.CommissionQuota)).
                Error; err != nil {
                return err
            }
        }

        return nil
    })
}

// getInviterChain 获取邀请链
func (s *CommissionService) getInviterChain(userID int, maxLevel int) ([]int, error) {
    chain := make([]int, 0, maxLevel)
    currentID := userID

    for i := 0; i < maxLevel; i++ {
        var user model.User
        if err := s.db.Select("inviter_id").First(&user, currentID).Error; err != nil {
            break
        }

        if user.InviterID == 0 {
            break
        }

        chain = append(chain, user.InviterID)
        currentID = user.InviterID
    }

    return chain, nil
}
```

### 2. 退款扣回逻辑

```go
// RefundCommission 退款时扣回返佣
func (s *CommissionService) RefundCommission(logID int64) error {
    return s.db.Transaction(func(tx *gorm.DB) error {
        // 1. 查找相关返佣记录
        var logs []model.CommissionLog
        if err := tx.Where("log_id = ? AND status = ?", logID, "settled").
            Find(&logs).Error; err != nil {
            return err
        }

        for _, log := range logs {
            // 2. 扣除返佣金额
            if err := tx.Model(&model.User{}).
                Where("id = ?", log.InviterID).
                Updates(map[string]interface{}{
                    "quota":     gorm.Expr("GREATEST(0, quota - ?)", log.CommissionQuota),
                    "aff_quota": gorm.Expr("GREATEST(0, aff_quota - ?)", log.CommissionQuota),
                }).Error; err != nil {
                return err
            }

            // 3. 更新返佣记录状态
            if err := tx.Model(&log).
                Update("status", "refunded").Error; err != nil {
                return err
            }
        }

        return nil
    })
}
```

---

## 📡 API 设计

### 1. 用户端 API

#### 获取我的返佣信息
```http
GET /api/user/commission/info
```

**响应:**
```json
{
  "success": true,
  "data": {
    "total_commission": 150000,
    "settled_commission": 120000,
    "pending_commission": 30000,
    "aff_code": "ABCD",
    "aff_count": 15,
    "aff_quota": 50000,
    "aff_history_quota": 150000
  }
}
```

#### 获取返佣明细
```http
GET /api/user/commission/logs?page=1&limit=20&status=settled
```

**响应:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 12345,
        "user_id": 678,
        "username": "user***",
        "level": 1,
        "model_name": "gpt-4",
        "consumption_quota": 10000,
        "commission_rate": 0.1000,
        "commission_quota": 1000,
        "status": "settled",
        "created_at": "2026-07-04T10:30:00Z"
      }
    ],
    "total": 150,
    "page": 1,
    "limit": 20
  }
}
```

#### 转移返佣额度到余额
```http
POST /api/user/commission/transfer
Content-Type: application/json

{
  "quota": 10000
}
```

**响应:**
```json
{
  "success": true,
  "message": "转移成功",
  "data": {
    "transferred": 10000,
    "remaining_aff_quota": 40000,
    "new_balance": 60000
  }
}
```

#### 获取邀请统计
```http
GET /api/user/commission/stats?period=monthly
```

**响应:**
```json
{
  "success": true,
  "data": {
    "period": "2026-07",
    "level1": {
      "count": 5,
      "total_commission": 50000
    },
    "level2": {
      "count": 8,
      "total_commission": 30000
    },
    "level3": {
      "count": 12,
      "total_commission": 20000
    }
  }
}
```

### 2. 管理员 API

#### 获取返佣规则列表
```http
GET /api/admin/commission/rules
```

#### 创建/更新返佣规则
```http
POST /api/admin/commission/rules
Content-Type: application/json

{
  "rule_name": "标准返佣规则",
  "rule_code": "standard",
  "rule_type": "percentage",
  "level1_rate": 0.10,
  "level2_rate": 0.05,
  "level3_rate": 0.02,
  "min_consumption": 1000,
  "max_commission": 50000,
  "daily_limit": 100000,
  "monthly_limit": 1000000,
  "is_active": true
}
```

#### 获取返佣统计报表
```http
GET /api/admin/commission/statistics?start_date=2026-07-01&end_date=2026-07-04
```

**响应:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "total_commission": 5000000,
      "total_users": 150,
      "active_inviters": 89,
      "avg_commission_rate": 0.085
    },
    "daily_stats": [
      {
        "date": "2026-07-01",
        "commission": 1500000,
        "transactions": 450
      },
      {
        "date": "2026-07-02",
        "commission": 1800000,
        "transactions": 520
      }
    ],
    "top_inviters": [
      {
        "user_id": 123,
        "username": "top_user",
        "total_commission": 500000,
        "invite_count": 45
      }
    ]
  }
}
```

#### 手动结算
```http
POST /api/admin/commission/settle
Content-Type: application/json

{
  "period_type": "monthly",
  "period_start": "2026-07-01",
  "period_end": "2026-07-31",
  "user_ids": [123, 456, 789]  // 可选，空=全部
}
```

#### 导出返佣报表
```http
GET /api/admin/commission/export?format=excel&start_date=2026-07-01&end_date=2026-07-31
```

---

## ⚙️ 配置项设计

### 系统配置（commission_configs表）

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `commission.enabled` | 是否启用返佣系统 | `true` |
| `commission.realtime_settle` | 是否实时结算 | `true` |
| `commission.max_level` | 最大返佣层级 | `3` |
| `commission.min_consumption` | 最低消费门槛 | `1000` |
| `commission.daily_limit` | 默认每日限额 | `100000` |
| `commission.monthly_limit` | 默认每月限额 | `1000000` |
| `commission.withdraw_min` | 最低提现金额 | `10000` |
| `commission.settlement_cycle` | 结算周期 | `realtime` |

### 防刷配置

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `commission.anti_spam.enabled` | 启用防刷 | `true` |
| `commission.anti_spam.max_self_invite` | 自邀请检测 | `3` |
| `commission.anti_spam.max_daily_invites` | 每日邀请上限 | `50` |
| `commission.anti_spam.ip_limit` | 同IP限制 | `5` |
| `commission.anti_spam.device_limit` | 同设备限制 | `3` |

---

## 🛡️ 安全与防刷

### 1. 防刷检测

```go
// service/commission_guard.go

type CommissionGuard struct {
    db *gorm.DB
}

// PreCheck 返佣前检查
func (g *CommissionGuard) PreCheck(userID int, inviterID int) error {
    // 1. 检查自邀请
    if userID == inviterID {
        return errors.New("不能邀请自己")
    }

    // 2. 检查邀请链循环
    if g.hasCircularInvitation(userID, inviterID) {
        return errors.New("检测到循环邀请")
    }

    // 3. 检查同IP/设备
    if g.isSameIPDevice(userID, inviterID) {
        return errors.New("同IP/设备限制")
    }

    // 4. 检查邀请频率
    if g.isInvitationTooFrequent(inviterID) {
        return errors.New("邀请过于频繁")
    }

    return nil
}

// hasCircularInvitation 检测循环邀请
func (g *CommissionGuard) hasCircularInvitation(userID int, inviterID int) bool {
    visited := make(map[int]bool)
    current := inviterID

    for i := 0; i < 10; i++ { // 最多检查10层
        if current == 0 || current == userID {
            return current == userID
        }

        if visited[current] {
            return true // 检测到循环
        }
        visited[current] = true

        var user model.User
        if err := g.db.Select("inviter_id").First(&user, current).Error; err != nil {
            break
        }
        current = user.InviterID
    }

    return false
}
```

### 2. 审计日志

所有返佣操作都记录到审计日志，便于追溯和排查。

---

## 📊 监控与告警

### 关键指标

1. **返佣率** - 返佣金额 / 总消费金额
2. **邀请转化率** - 成功邀请数 / 注册数
3. **活跃邀请人** - 近30天有返佣的用户数
4. **异常检测** - 单用户返佣金额突增

### 告警规则

- 单用户日返佣超过阈值
- 同IP大量注册
- 返佣比例异常偏高

---

## 🚀 实施计划

### Phase 1: 基础框架（1-2天）
- [ ] 创建数据库表
- [ ] 实现基础模型
- [ ] 配置系统选项

### Phase 2: 核心逻辑（2-3天）
- [ ] 返佣计算服务
- [ ] 消费时触发返佣
- [ ] 实时结算逻辑
- [ ] 退款扣回机制

### Phase 3: API接口（1-2天）
- [ ] 用户端API
- [ ] 管理员API
- [ ] 统计报表API

### Phase 4: 高级功能（2-3天）
- [ ] 防刷检测
- [ ] 多级返佣
- [ ] 规则引擎
- [ ] 批量结算

### Phase 5: 监控优化（1天）
- [ ] 性能优化
- [ ] 监控指标
- [ ] 告警配置

---

## 💡 扩展性考虑

### 1. 灵活的规则引擎
- 支持按模型、用户等级、时间段配置不同返佣规则
- 支持特殊活动期间的加倍返佣

### 2. 多种结算方式
- 实时到账（默认）
- 每日结算
- 每周/每月结算
- 手动结算

### 3. 数据导出
- Excel报表导出
- 财务对账单
- 税务报表

---

## ✅ 验收标准

1. ✅ 被邀请人消费后，邀请人实时获得返佣
2. ✅ 支持1-3级邀请链返佣
3. ✅ 返佣金额准确，无误差
4. ✅ 退款时自动扣回返佣
5. ✅ 防刷机制有效
6. ✅ 统计报表准确
7. ✅ API响应时间 < 100ms
8. ✅ 支持高并发场景

---

## 📝 注意事项

1. **数据一致性** - 使用数据库事务确保原子性
2. **性能优化** - 异步处理非关键路径
3. **幂等性** - 同一订单不重复返佣
4. **可追溯** - 完整的审计日志
5. **可配置** - 所有参数可动态调整

---

**设计完成日期**: 2026-07-04
**预计开发工期**: 7-10天
**优先级**: 高
