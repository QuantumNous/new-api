# 返佣系统快速开始指南

## 🎯 5分钟快速集成

### 步骤 1: 注册路由（1分钟）

在 `main.go` 或 `router/router.go` 中添加：

```go
import "github.com/QuantumNous/new-api/router"

// 在其他路由设置之后
router.SetCommissionRouter(app)
```

### 步骤 2: 初始化数据库（1分钟）

创建迁移文件 `model/commission_migration.go`：

```go
package model

func init() {
    // 注册迁移任务
    migrations = append(migrations, &CommissionMigration{})
}

type CommissionMigration struct{}

func (m *CommissionMigration) ID() string {
    return "20260704_commission_tables"
}

func (m *CommissionMigration) Migrate() error {
    // 创建表
    if err := DB.AutoMigrate(
        &CommissionLog{},
        &CommissionRule{},
    ); err != nil {
        return err
    }

    // 初始化默认规则
    defaultRules := GetDefaultCommissionRules()
    for _, rule := range defaultRules {
        var count int64
        DB.Model(&CommissionRule{}).Where("rule_code = ?", rule.RuleCode).Count(&count)
        if count == 0 {
            DB.Create(&rule)
        }
    }

    return nil
}
```

### 步骤 3: 集成返佣触发（2分钟）

在消费日志的位置添加返佣调用：

```go
// 找到消费记录的位置（通常是 relay 或 service 中）
// 在消费成功后添加：

import "github.com/QuantumNous/new-api/service"

// 异步触发返佣（不阻塞主流程）
go func() {
    cs := service.NewCommissionService()
    req := service.CommissionRequest{
        UserID:    userID,
        LogID:     logId,
        ModelName: modelName,
        QuotaUsed: quotaUsed,
    }
    _, err := cs.ProcessCommission(req)
    if err != nil {
        logger.SysLog(fmt.Sprintf("返佣失败: %v", err))
    }
}()
```

### 步骤 4: 测试验证（1分钟）

```bash
# 1. 重启服务
go run main.go

# 2. 注册一个新用户（使用邀请码）
curl -X POST http://localhost:3000/api/user/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"12345678","aff":"ABCD"}'

# 3. 使用新用户消费

# 4. 查看邀请人的返佣
curl http://localhost:3000/api/user/commission/info \
  -H "Authorization: Bearer <token>"
```

---

## 📊 已创建的文件清单

### 模型层
- ✅ `model/commission_log.go` - 返佣记录模型
- ✅ `model/commission_rule.go` - 返佣规则模型

### 服务层
- ✅ `service/commission.go` - 返佣计算和处理服务
- ✅ `service/commission_guard.go` - 防刷检测服务

### 控制器层
- ✅ `controller/commission.go` - 所有API接口

### 路由层
- ✅ `router/commission-router.go` - 路由配置

### 文档
- ✅ `COMMISSION_SYSTEM_DESIGN.md` - 完整设计方案
- ✅ `INTEGRATION_GUIDE.md` - 详细集成指南
- ✅ `COMMISSION_QUICK_START.md` - 快速开始（本文件）

---

## 🔌 API 接口总览

### 用户端（需要登录）

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/user/commission/info` | GET | 获取返佣信息 |
| `/api/user/commission/logs` | GET | 获取返佣明细 |
| `/api/user/commission/stats` | GET | 获取返佣统计 |
| `/api/user/commission/transfer` | POST | 转移邀请额度到余额 |
| `/api/user/commission/consumption` | GET | 获取消费返佣记录 |

### 管理员端（需要管理员权限）

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/admin/commission/rules` | GET | 获取所有规则 |
| `/api/admin/commission/rules` | POST | 创建规则 |
| `/api/admin/commission/rules/:id` | PUT | 更新规则 |
| `/api/admin/commission/rules/:id` | DELETE | 删除规则 |
| `/api/admin/commission/rules/:id/toggle` | PATCH | 切换规则状态 |
| `/api/admin/commission/statistics` | GET | 获取统计报表 |
| `/api/admin/commission/logs` | GET | 获取返佣日志 |
| `/api/admin/commission/settle` | POST | 手动结算 |

---

## 💡 核心功能特性

### ✅ 多级返佣
- 支持1-3级邀请链
- 每级可设置不同返佣比例
- 自动追踪邀请关系

### ✅ 灵活配置
- 按比例返佣（百分比）
- 固定额度返佣
- 按模型配置不同规则
- 消费门槛和返佣上限

### ✅ 实时结算
- 消费后立即返佣
- 自动计入邀请人余额
- 无需手动操作

### ✅ 防刷机制
- 邀请链循环检测
- 同IP/设备限制
- 邀请频率限制
- 可疑活动检测

### ✅ 退款扣回
- 退款时自动扣回返佣
- 防止负数余额
- 完整的审计日志

### ✅ 统计报表
- 用户返佣统计
- 管理后台统计
- 每日/每周/每月报表
- TOP邀请人排行

---

## 🛠️ 高级配置

### 自定义返佣规则

通过管理后台API创建自定义规则：

```bash
curl -X POST http://localhost:3000/api/admin/commission/rules \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "rule_name": "VIP用户返佣",
    "rule_code": "vip",
    "rule_type": "percentage",
    "level1_rate": 0.20,
    "level2_rate": 0.10,
    "level3_rate": 0.05,
    "min_consumption": 5000,
    "max_commission": 100000,
    "daily_limit": 500000,
    "monthly_limit": 5000000,
    "is_active": true,
    "priority": 500
  }'
```

### 配置系统选项

在管理后台添加配置：

```go
// common/constants.go
var CommissionEnabled = true
var CommissionRealTimeSettle = true
var CommissionMaxLevel = 3
var AntiSpamEnabled = true
```

---

## 📈 监控建议

### 关键指标
1. **返佣率** - 返佣金额 / 总消费金额
2. **邀请转化率** - 邀请注册数 / 总注册数
3. **活跃邀请人** - 近30天有返佣的用户数
4. **异常检测** - 单用户返佣金额突增

### 告警规则
- 单用户日返佣超过阈值（如 100,000）
- 同IP大量注册（如 > 5）
- 返佣比例异常偏高（如 > 20%）

---

## ✅ 测试清单

### 单元测试
- [ ] 返佣计算逻辑
- [ ] 多级返佣计算
- [ ] 防刷检测
- [ ] 退款扣回

### 集成测试
- [ ] 注册邀请流程
- [ ] 消费返佣流程
- [ ] 余额转移流程
- [ ] 退款扣回流程

### 性能测试
- [ ] 高并发返佣处理
- [ ] 大量数据查询
- [ ] 统计报表性能

---

## 🐛 常见问题

### Q: 返佣没有触发？
**A:** 检查以下几点：
1. 是否调用了 `ProcessCommission`
2. 邀请人是否存在
3. 是否被防刷机制拦截
4. 查看日志中的错误信息

### Q: 返佣金额不对？
**A:** 检查：
1. 返佣规则配置
2. 消费门槛是否满足
3. 每日/每月限额
4. 单次返佣上限

### Q: 多级返佣只有第一级？
**A:** 检查：
1. 用户的邀请链是否完整
2. 高级返佣规则是否激活
3. 日志中的警告信息

---

## 📞 技术支持

如有问题，请查看：
1. 日志文件中的错误信息
2. 数据库中的返佣记录
3. 完整的设计文档：`COMMISSION_SYSTEM_DESIGN.md`
4. 详细集成指南：`INTEGRATION_GUIDE.md`

---

## 🎉 恭喜！

你已经拥有一个**完整的返佣系统**！

### 功能清单
- ✅ 按比例返佣
- ✅ 多级返佣（1-3级）
- ✅ 实时结算
- ✅ 返佣记录追踪
- ✅ 统计报表
- ✅ 灵活配置
- ✅ 防刷机制
- ✅ 退款扣回
- ✅ 管理后台API

### 可选扩展
- 📊 高级统计面板
- 🔔 返佣通知
- 📱 移动端适配
- 🌍 多语言支持

**系统已经可以投入使用了！**
