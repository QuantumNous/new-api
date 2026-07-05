# 审查清单（For Fable 5）

> **快速审查指南**：按优先级查看关键文件

---

## 🔴 优先级1：紧急修复（必查）

### A1 - 限额漏洞修复
**文件**: `service/commission.go:380-427`
```go
// 检查点：是否正确使用 time.Time 而非 Unix 秒
dayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location()) // ✅ 不要 .Unix()
```

**验证**:
- [ ] dayStart/dayEnd 是 time.Time 类型
- [ ] monthStart 是 time.Time 类型
- [ ] 注释说明了两类时间列的区别

### A2 - 限额测试
**文件**: `service/commission_limit_test.go`
- [ ] TestDailyLimitBlocks 存在
- [ ] TestDailyLimitExactBoundary 存在
- [ ] TestMonthlyLimitBlocks 存在
- [ ] 测试使用非零限额（1500/2000）

---

## 🟠 优先级2：安全加固（重要）

### B1 - 全局IP限制
**文件**: `service/commission_guard.go:159-168`
```go
// 检查点：是否统计全局IP（不分邀请人）
if globalCount > int64(common.CommissionGlobalIPLimit) {
    return fmt.Errorf("同IP注册账号总数过多(%d)，疑似刷单", globalCount)
}
```

### B2 - OAuth写入register_ip
**文件**: `controller/oauth.go:272`
```go
// 检查点：在InsertWithTx之前赋值
user.RegisterIP = c.ClientIP()
```

**文件**: `controller/wechat.go:98`
- [ ] 两处都有 register_ip 赋值

### D1 - 规则更新防篡改
**文件**: `controller/commission.go:269-369`
```go
// 检查点：DTO白名单，不直接绑定到model
var in struct {
    RuleName  *string  `json:"rule_name"`
    // ... 其他字段
}

// 数值校验
if in.Level1Rate != nil && (*in.Level1Rate < 0 || *in.Level1Rate > 1) {
    common.ApiErrorMsg(c, "level1_rate 必须在 [0, 1] 范围内")
    return
}
```

### D2 - 序列化安全
**文件**: `model/commission_log.go:40-41`
```go
// 检查点：关联字段不序列化
User    User `json:"-" gorm:"foreignKey:UserID"`
Inviter User `json:"-" gorm:"foreignKey:InviterID"`
```

---

## 🟡 优先级3：新功能（体验额度）

### User结构体
**文件**: `model/user.go:49-50`
```go
// 检查点：新增字段
TrialQuota     int   `json:"trial_quota" gorm:"type:int;default:0"`
TrialExpiresAt int64 `json:"trial_expires_at" gorm:"type:int;default:0"`
```

### 注册逻辑
**文件**: `model/user.go:399-404`
```go
// 检查点：注册时设置体验额度
trialDays := common.TrialQuotaExpirationDays
if common.QuotaForNewUser > 0 && trialDays > 0 {
    user.TrialQuota = common.QuotaForNewUser
    user.TrialExpiresAt = time.Now().AddDate(0, 0, trialDays).Unix()
}
```

### 消费逻辑
**文件**: `model/user.go:950-1005`
```go
// 检查点：优先扣除体验额度
func deductTrialQuota(id int, quota int) {
    // 1. 检查是否过期
    // 2. 未过期则扣除
    // 3. 已过期则清零
}
```

### 定时清理
**文件**: `model/user.go:1007-1020`
```go
// 检查点：批量清理所有过期
func CleanupExpiredTrialQuota() {
    DB.Model(&User{}).
        Where("trial_quota > 0 AND trial_expires_at > 0 AND trial_expires_at < ?", now).
        Updates(...)
}
```

**文件**: `main.go:110-116`
```go
// 检查点：每小时运行
go func() {
    ticker := time.NewTicker(1 * time.Hour)
    defer ticker.Stop()
    for range ticker.C {
        model.CleanupExpiredTrialQuota()
    }
}()
```

---

## 🟢 优先级4：配置项

### Option注册
**文件**: `model/option.go`
- [ ] CommissionGlobalIPLimit 注册（InitOptionMap）
- [ ] CommissionGlobalIPLimit 动态分发（updateOptionMap）
- [ ] TrialQuotaExpirationDays 注册（InitOptionMap）
- [ ] TrialQuotaExpirationDays 动态分发（updateOptionMap）
- [ ] CommissionMaxLevel 注册（InitOptionMap）
- [ ] CommissionMaxLevel 动态分发（updateOptionMap）

### 默认值
**文件**: `common/constants.go`
```go
var CommissionGlobalIPLimit = 10    // 同IP总数上限
var TrialQuotaExpirationDays = 7    // 体验额度天数
var CommissionMaxLevel = 3          // 最大层级（已接入Option）
```

---

## 🔍 优先级5：代码质量

### B3 - 死代码清理
**文件**: `service/commission_guard.go`
- [ ] ipTracker/deviceTracker 已删除
- [ ] IPRecord/DeviceRecord 已删除
- [ ] RecordIPDevice 已删除
- [ ] CleanupExpiredRecords 已删除
- [ ] mu sync.RWMutex 已删除
- [ ] GetUserIPStats 改为查库
- [ ] DetectSuspiciousActivity 改为查库

### E2 - rune安全
**文件**: `controller/commission.go:700-705`
```go
// 检查点：支持中文等多字节字符
func maskUsername(username string) string {
    r := []rune(username)
    if len(r) <= 2 {
        return username + "***"
    }
    return string(r[:2]) + "***"
}
```

### D3 - 用户端脱敏
**文件**: `controller/commission.go:85-96`
- [ ] GetUserCommissionLogs 响应无 user_id 字段

### B4 - 管理端点
**文件**: `router/commission-router.go:52`
```go
// 检查点：新端点注册
adminCommissionRouter.GET("/suspicious/:user_id", controller.AdminDetectSuspicious)
```

**文件**: `controller/commission.go:707-725`
- [ ] AdminDetectSuspicious 函数存在
- [ ] 调用 commissionService.Guard().DetectSuspiciousActivity()

---

## ⚠️ 重点关注

### 1. 并发安全
- [ ] RefundCommission 使用条件更新（RowsAffected检查）
- [ ] 行锁读取（clause.Locking{Strength: "UPDATE"}）
- [ ] SQLite兼容（Go侧计算min防负）

### 2. 时间类型
- [ ] commission_logs.created_at 是 time.Time
- [ ] users.created_at 是 int64（Unix秒）
- [ ] 两处检查使用正确的时间类型

### 3. 防绕过
- [ ] 全局IP限制（B1）堵住环形绕过
- [ ] OAuth写入register_ip（B2）堵住第三方登录绕过
- [ ] 规则更新白名单（D1）堵住篡改

---

## 📊 测试验证

### 运行测试
```bash
cd new-api
go test ./service/ -v -run "TestDailyLimit|TestMonthlyLimit"
```

**预期输出**:
```
--- PASS: TestDailyLimitBlocks
--- PASS: TestDailyLimitExactBoundary
--- PASS: TestMonthlyLimitBlocks
PASS
```

### 编译验证
```bash
go build ./...
```

**预期**: 无错误（go vet警告为历史遗留）

---

## 📝 审查模板

复制以下内容填写审查结果：

```markdown
## 审查结果

### 通过项
- [ ] A1: 限额漏洞修复
- [ ] A2: 限额测试
- [ ] B1: 全局IP限制
- [ ] B2: OAuth写入IP
- [ ] B3: 死代码清理
- [ ] B4: 管理端点
- [ ] C1: aff_history扣减
- [ ] D1: 规则防篡改
- [ ] D2: 序列化安全
- [ ] D3: 去掉user_id
- [ ] E1: MaxLevel接入Option
- [ ] E2: rune安全
- [ ] E7: 大扫除
- [ ] Trial Quota: 体验额度过期

### 问题项
（列出发现的问题）

### 建议改进
（可选的优化建议）

### 最终结论
- [ ] ✅ 通过，可部署
- [ ] ⚠️ 需修改后重新提交
- [ ] ❌ 重大问题，需返工
```

---

## 📦 交付物

- **源码**: `new-api-v5-trial-quota-20260704.tar.gz`（38MB）
- **报告**: `FINAL_REPORT.md`（本目录）
- **清单**: `REVIEW_CHECKLIST.md`（本文件）

---

**预祝审查顺利！** 🎉
