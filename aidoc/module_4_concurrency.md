# 模块四：用户并发限制

## 设计更新（用户反馈）

- 充值用户默认并发 **10**（而非不限制）
- 管理员可**单独给某个用户**设置并发数量
- 并发数优先级：用户自定义 > 用户组默认 > 系统默认

---

## 并发限制层级

```
优先级（高 → 低）:
┌─────────────────────────────────────────┐
│ 1. 用户级自定义 (user_concurrency_override) │  ← 管理员单独设置
│ 2. 用户组默认   (group_concurrency_config)  │  ← 按组设置
│ 3. 系统默认     (system_config)             │  ← 全局兜底
└─────────────────────────────────────────┘
```

| 用户类型 | 默认并发 | 说明 |
|----------|----------|------|
| 免费用户 | 3 | 未充值、`quota <= 0` |
| 充值用户 | **10** | `quota > 0` 或 `is_charged = true` |
| VIP 用户 | 50 | `group = "vip"` |
| 管理员 | 不限制 | `role >= admin` |
| 自定义用户 | X | 管理员在用户详情页单独设置 |

---

## 中间件实现

```go
// middleware/concurrency.go
func ConcurrencyLimitMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        userID := c.GetInt("user_id")
        
        // 获取该用户的并发限制值
        limit := resolveUserConcurrencyLimit(userID)
        if limit <= 0 {
            // 不限制（管理员等）
            c.Next()
            return
        }
        
        concurrencyKey := fmt.Sprintf("concurrent:%d", userID)
        
        // Lua 脚本保证原子性：检查 + 递增
        result, err := redis.Eval(ctx, luaIncrIfUnder, []string{concurrencyKey}, limit, 300).Int64()
        if err != nil || result == 0 {
            c.JSON(429, gin.H{
                "error": gin.H{
                    "message": fmt.Sprintf(
                        "并发请求已达上限 (%d)，请稍后再试。升级套餐可提升并发限制。", limit),
                    "type": "concurrent_limit_exceeded",
                    "current_limit": limit,
                },
            })
            c.Abort()
            return
        }
        
        // 请求结束后递减
        defer redis.Decr(ctx, concurrencyKey)
        
        c.Next()
    }
}

// Lua 脚本：原子检查 + 递增（避免超发）
const luaIncrIfUnder = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local ttl = tonumber(ARGV[2])
local current = tonumber(redis.call('GET', key) or '0')
if current < limit then
    redis.call('INCR', key)
    redis.call('EXPIRE', key, ttl)
    return 1
end
return 0
`

// 解析用户实际并发限制
func resolveUserConcurrencyLimit(userID int) int {
    // 1. 检查用户级自定义
    override, exists := GetUserConcurrencyOverride(userID)
    if exists {
        return override  // 管理员为该用户单独设置的值
    }
    
    // 2. 检查用户类型
    user := GetUser(userID)
    
    // 管理员不限制
    if user.Role >= model.RoleAdmin {
        return -1  // -1 表示不限制
    }
    
    // 3. 检查用户组配置
    groupConfig := GetGroupConcurrencyConfig(user.Group)
    if groupConfig != nil {
        return groupConfig.MaxConcurrent
    }
    
    // 4. 按充值状态返回系统默认
    if isChargedUser(user) {
        return GetSystemConfig("charged_user_concurrent", 10)
    }
    return GetSystemConfig("free_user_concurrent", 3)
}
```

---

## 管理员操作界面

### 用户详情页 - 并发设置

```
┌─ 用户详情：张三 (ID: 42) ──────────────────────┐
│                                                  │
│  基本信息：                                      │
│  用户组：default    余额：50000    角色：普通用户 │
│                                                  │
│  ── 并发限制设置 ──                              │
│  当前生效值：10 (来源：充值用户默认)             │
│                                                  │
│  [  ] 为该用户设置自定义并发限制                 │
│       自定义并发数：[    ]                        │
│       说明：设置后将覆盖用户组默认值              │
│                                                  │
│  实时并发：3 / 10                                │
│                                                  │
│            [保存]                                 │
└──────────────────────────────────────────────────┘
```

### 系统设置页 - 并发默认值

```
┌─ 并发限制全局设置 ──────────────────────────────┐
│                                                  │
│  免费用户默认并发：    [3  ]                      │
│  充值用户默认并发：    [10 ]                      │
│  VIP 用户默认并发：    [50 ]                      │
│                                                  │
│  ── 用户组并发配置 ──                            │
│  │ 组名      │ 最大并发 │ 操作  │                │
│  │ default   │ 3        │ 📝   │                 │
│  │ charged   │ 10       │ 📝   │                 │
│  │ vip       │ 50       │ 📝   │                 │
│  │ premium   │ 100      │ 📝   │                 │
│                                                  │
│            [保存]                                 │
└──────────────────────────────────────────────────┘
```

---

## 数据库

```sql
-- 用户组并发配置
CREATE TABLE group_concurrency_configs (
    id              INT PRIMARY KEY AUTO_INCREMENT,
    group_name      VARCHAR(50) NOT NULL UNIQUE,
    max_concurrent  INT NOT NULL DEFAULT 3,
    description     VARCHAR(200),
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 用户级并发覆盖
CREATE TABLE user_concurrency_overrides (
    id              INT PRIMARY KEY AUTO_INCREMENT,
    user_id         INT NOT NULL UNIQUE,
    max_concurrent  INT NOT NULL,
    reason          VARCHAR(200),      -- 调整原因
    set_by          INT,               -- 由哪个管理员设置
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user (user_id)
);

-- 系统默认配置（复用已有的 options 表或新建）
INSERT INTO options (key, value) VALUES 
    ('free_user_concurrent', '3'),
    ('charged_user_concurrent', '10');
```

## API 端点

```
GET    /api/admin/concurrency/config           -- 获取全局并发配置
PUT    /api/admin/concurrency/config           -- 更新全局配置
GET    /api/admin/concurrency/groups           -- 获取组并发配置
PUT    /api/admin/concurrency/groups/:name     -- 更新组配置
GET    /api/admin/users/:id/concurrency        -- 获取用户并发设置
PUT    /api/admin/users/:id/concurrency        -- 设置用户自定义并发
DELETE /api/admin/users/:id/concurrency        -- 删除用户自定义（回退到组默认）
GET    /api/admin/concurrency/realtime         -- 实时并发统计
```
