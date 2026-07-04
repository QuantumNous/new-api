# 返佣系统集成指南

## 📋 集成步骤

### 1. 在消费逻辑中触发返佣

找到你的消费记录位置（通常在 relay 或 service 中），添加返佣触发：

```go
// 在消费完成后，调用返佣服务
commissionService := service.NewCommissionService()

req := service.CommissionRequest{
    UserID:    userID,           // 消费用户ID
    LogID:     logId,           // 消费日志ID（如果有）
    OrderID:   orderId,         // 订单ID（如果有）
    ModelName: modelName,       // 使用的模型
    QuotaUsed: quotaUsed,       // 消费金额
}

result, err := commissionService.ProcessCommission(req)
if err != nil {
    // 返佣失败不影响主流程，只记录日志
    logger.SysLog(fmt.Sprintf("返佣处理失败: %v", err))
} else if result.TotalCommission > 0 {
    logger.SysLog(fmt.Sprintf("返佣成功: 用户%d消费%d, 总返佣%d", userID, quotaUsed, result.TotalCommission))
}
```

### 2. 在 relay/helper/quota.go 中集成（推荐位置）

```go
// 在 consumeQuota 函数中添加
func consumeQuota(ctx *gin.Context, userId int, modelName string, quotaUsed int, logId int64) {
    // ... 原有的消费逻辑 ...

    // 消费成功后触发返佣
    if quotaUsed > 0 {
        go func() { // 异步执行，不阻塞主流程
            commissionService := service.NewCommissionService()
            req := service.CommissionRequest{
                UserID:    userId,
                LogID:     logId,
                ModelName: modelName,
                QuotaUsed: quotaUsed,
            }
            _, err := commissionService.ProcessCommission(req)
            if err != nil {
                logger.SysLog(fmt.Sprintf("返佣处理失败: user=%d, err=%v", userId, err))
            }
        }()
    }
}
```

### 3. 在注册时记录邀请关系

在 `controller/user.go` 的 Register 函数中已经处理：

```go
// 已有的代码（不需要修改）
user := req.User
if user.AffCode == "" && req.Aff != "" {
    user.AffCode = req.Aff
}

// ... 后续注册逻辑会自动处理邀请关系 ...
affCode := user.AffCode
inviterId, _ := model.GetUserIdByAffCode(affCode)

// 创建用户时设置邀请人
cleanUser := model.User{
    Username:    user.Username,
    Password:    user.Password,
    DisplayName: user.Username,
    InviterId:   inviterId,  // 设置邀请人
    // ...
}
```

### 4. 在退款时扣回返佣

在退款逻辑中调用：

```go
commissionService := service.NewCommissionService()
err := commissionService.RefundCommission(logId)
if err != nil {
    logger.SysLog(fmt.Sprintf("返佣扣回失败: %v", err))
}
```

### 5. 注册路由

在 `main.go` 或 `router/router.go` 中添加：

```go
// 设置返佣路由
router.SetCommissionRouter(app)
```

### 6. 初始化数据库表

创建数据库迁移文件：

```go
// model/migration.go

func migrateCommission() error {
    // 自动迁移
    return DB.AutoMigrate(
        &CommissionLog{},
        &CommissionRule{},
    )
}

func initCommissionRules() error {
    // 初始化默认返佣规则
    defaultRules := model.GetDefaultCommissionRules()
    for _, rule := range defaultRules {
        existing, _ := model.GetCommissionRuleByCode(rule.RuleCode)
        if existing == nil || existing.Id == 0 {
            if err := model.CreateCommissionRule(&rule); err != nil {
                return err
            }
        }
    }
    return nil
}
```

---

## 🔧 配置项

在管理后台添加以下配置选项：

### common/constants.go 中添加

```go
// 返佣系统配置
var CommissionEnabled = true        // 是否启用返佣系统
var CommissionRealTimeSettle = true // 是否实时结算
var CommissionMaxLevel = 3          // 最大返佣层级

// 防刷配置
var AntiSpamEnabled = true          // 是否启用防刷
var MaxDailyInvites = 50            // 每日邀请上限
var MaxSelfInviteCheck = 3          // 自邀请检测
```

### model/option.go 中添加配置读取

```go
// 在 initOptionMap 中添加
case "CommissionEnabled":
    common.CommissionEnabled = value == "true"
case "CommissionRealTimeSettle":
    common.CommissionRealTimeSettle = value == "true"
case "CommissionMaxLevel":
    common.CommissionMaxLevel, _ = strconv.Atoi(value)
case "AntiSpamEnabled":
    common.AntiSpamEnabled = value == "true"
case "MaxDailyInvites":
    common.MaxDailyInvites, _ = strconv.Atoi(value)
```

---

## 📊 监控与告警

### 1. 添加 Prometheus 指标（可选）

```go
// metrics/commission.go

var (
    commissionTotal = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "commission_total",
            Help: "Total commission amount",
        },
        []string{"level"},
    )

    commissionSuccess = prometheus.NewCounter(
        prometheus.CounterOpts{
            Name: "commission_success_total",
            Help: "Total successful commission transactions",
        },
    )

    commissionFailed = prometheus.NewCounter(
        prometheus.CounterOpts{
            Name: "commission_failed_total",
            Help: "Total failed commission transactions",
        },
    )
)

func init() {
    prometheus.MustRegister(commissionTotal, commissionSuccess, commissionFailed)
}
```

### 2. 日志告警

在 `service/commission.go` 中添加告警逻辑：

```go
// 检测异常高额返佣
if detail.CommissionQuota > 100000 { // 阈值可配置
    logger.SysLog(fmt.Sprintf("[ALERT] 高额返佣: user=%d, inviter=%d, amount=%d",
        req.UserID, detail.InviterID, detail.CommissionQuota))
    // 发送告警通知
}
```

---

## 🧪 测试用例

### 单元测试示例

```go
// service/commission_test.go

func TestCalculateCommission(t *testing.T) {
    cs := NewCommissionService()

    req := CommissionRequest{
        UserID:    100,
        ModelName: "gpt-4",
        QuotaUsed: 10000,
    }

    result, err := cs.CalculateCommission(req)
    assert.NoError(t, err)
    assert.NotNil(t, result)

    // 验证返佣金额
    if len(result.Details) > 0 {
        assert.True(t, result.Details[0].CommissionQuota > 0)
        assert.Equal(t, 1, result.Details[0].Level)
    }
}

func TestMultiLevelCommission(t *testing.T) {
    // 创建测试用户链: A邀请B，B邀请C
    // 用户C消费后，B获得一级返佣，A获得二级返佣
}
```

---

## ✅ 验收检查清单

- [ ] 数据库表已创建
- [ ] 默认返佣规则已初始化
- [ ] 路由已注册
- [ ] 消费逻辑已集成返佣触发
- [ ] 注册逻辑已处理邀请关系
- [ ] 退款逻辑已集成返佣扣回
- [ ] 配置项已添加到管理后台
- [ ] 单元测试已通过
- [ ] 集成测试已完成
- [ ] 性能测试已通过

---

## 🚀 部署步骤

1. **备份数据库**
2. **运行数据库迁移**
3. **更新代码**
4. **重启服务**
5. **验证功能**
6. **监控日志**

---

## 📈 性能优化建议

1. **异步处理** - 返佣计算和记录使用 goroutine
2. **批量结算** - 大量用户时使用批量操作
3. **缓存规则** - 高频访问的返佣规则使用缓存
4. **索引优化** - 确保查询字段有索引
5. **分区表** - 大数据量时考虑按时间分区

---

**集成完成后，你的系统将拥有完整的返佣功能！**
