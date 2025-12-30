# new-api 限流功能详解

## 目录

- [概述](#概述)
- [限流类型](#限流类型)
- [限流算法](#限流算法)
- [配置说明](#配置说明)
- [核心文件](#核心文件)
- [存储方式](#存储方式)
- [错误响应](#错误响应)
- [最佳实践](#最佳实践)

---

## 概述

new-api 项目实现了多层限流机制，用于保护系统资源、防止滥用。主要包含以下五种限流类型：

| 限流类型 | 作用范围 | 限制对象 | 主要用途 |
|---------|---------|---------|---------|
| 全局速率限制 | Web/API 接口 | IP 地址 | 防止 DDoS、爬虫攻击 |
| 模型请求速率限制 | AI 模型调用 | 用户 ID | 控制 API 调用频率 |
| 邮件验证速率限制 | 邮件发送 | IP 地址 | 防止邮件轰炸 |
| 通知速率限制 | 通知发送 | 用户 ID + 通知类型 | 防止通知轰炸 |
| 渠道限流状态管理 | 上游 API | 渠道 ID | 处理上游 429 错误 |

---

## 限流类型

### 1. 全局速率限制

基于 IP 地址的全局限流，分为以下几种：

#### 1.1 Web 限流

针对 Web 页面请求的限流。

```go
// 环境变量配置
GLOBAL_WEB_RATE_LIMIT_ENABLE=true   // 是否启用
GLOBAL_WEB_RATE_LIMIT=100           // 请求数量
GLOBAL_WEB_RATE_LIMIT_DURATION=60   // 时间窗口（秒）
```

#### 1.2 API 限流

针对 API 接口请求的限流。

```go
// 环境变量配置
GLOBAL_API_RATE_LIMIT_ENABLE=true   // 是否启用
GLOBAL_API_RATE_LIMIT=100           // 请求数量
GLOBAL_API_RATE_LIMIT_DURATION=60   // 时间窗口（秒）
```

#### 1.3 关键操作限流

针对登录、注册等关键操作的限流，防止暴力破解。

```go
// 环境变量配置
CRITICAL_RATE_LIMIT_ENABLE=true     // 是否启用
CRITICAL_RATE_LIMIT=60              // 请求数量（默认 60）
CRITICAL_RATE_LIMIT_DURATION=600    // 时间窗口（默认 10 分钟）
```

应用于以下接口：
- `POST /api/user/register` - 用户注册
- `POST /api/user/login` - 用户登录
- `POST /api/user/reset` - 密码重置

#### 1.4 上传/下载限流

针对文件上传和下载的限流。

```go
// 上传限流
UPLOAD_RATE_LIMIT_ENABLE=true       // 是否启用
UPLOAD_RATE_LIMIT=30                // 请求数量（默认 30）
UPLOAD_RATE_LIMIT_DURATION=60       // 时间窗口（默认 60 秒）

// 下载限流
DOWNLOAD_RATE_LIMIT_ENABLE=true     // 是否启用
DOWNLOAD_RATE_LIMIT=30              // 请求数量（默认 30）
DOWNLOAD_RATE_LIMIT_DURATION=60     // 时间窗口（默认 60 秒）
```

---

### 2. 模型请求速率限制

基于用户 ID 的模型调用限流，支持分组配置。

#### 2.1 基本配置

通过管理后台「运营设置」→「速率限制」进行配置：

| 配置项 | 说明 | 默认值 |
|-------|------|-------|
| 启用模型请求速率限制 | 总开关 | 关闭 |
| 启用等待机制 | 达到限制时等待而非拒绝 | 关闭 |
| 时间窗口（分钟） | 限流统计周期 | 1 |
| 总请求数限制 | 时间窗口内最大请求数（0=不限制） | 0 |
| 成功请求数限制 | 时间窗口内最大成功请求数 | 1000 |
| 最大等待时间（秒） | 等待机制的最大等待时间 | 120 |

#### 2.2 分组配置

支持按用户分组配置不同的限流策略：

```json
{
    "admin":   [0, 999999],    // [总请求数, 成功请求数]，0 表示不限制
    "default": [255, 245],
    "vip":     [500, 480]
}
```

用户分组通过 `users` 表的 `group` 字段设置。

#### 2.3 等待机制

当启用等待机制时：
- 请求达到限制后会排队等待，而非立即返回 429
- 最大等待时间由配置控制（默认 120 秒）
- 等待期间会检测客户端是否断开连接
- 适用于对延迟不敏感但需要保证请求成功的场景

---

### 3. 邮件验证速率限制

防止邮件轰炸的限流机制。

```go
// 硬编码配置
EmailVerificationMaxRequests = 2    // 30 秒内最多 2 次
EmailVerificationDuration    = 30   // 时间窗口 30 秒
```

应用于 `GET /api/verification` 接口。

---

### 4. 通知速率限制

防止通知轰炸的限流机制，按用户 ID + 通知类型进行限制。

```go
// 硬编码配置
NotifyRateLimitPerHour = 10  // 每小时每种通知类型最多 10 次
```

---

### 5. 渠道限流状态管理

当上游 API 返回 429 错误时，系统会标记该渠道为限流状态。

#### 5.1 数据结构

```go
type RateLimitInfo struct {
    ChannelId     int    `json:"channel_id"`
    KeyIndex      int    `json:"key_index"`       // -1 表示整个渠道
    RateLimitedAt int64  `json:"rate_limited_at"` // Unix 时间戳
    RetryAfter    int    `json:"retry_after"`     // 限流持续秒数
    Reason        string `json:"reason"`
}
```

#### 5.2 工作流程

1. 请求上游 API 返回 429 错误
2. 解析 `Retry-After` 响应头获取等待时间
3. 标记渠道/密钥为限流状态
4. 后续请求自动跳过被限流的渠道
5. 限流时间过后自动恢复

---

## 限流算法

### 1. 滑动窗口算法

**使用场景**：全局限流、成功请求限流、内存模式总请求限流

**原理**：维护一个时间戳队列，只保留时间窗口内的请求记录。

```
时间窗口: 60秒, 限制: 100次

请求队列: [t1, t2, t3, ..., t100]
         ↑                    ↑
      窗口起点              当前时间

新请求到达时:
1. 移除窗口外的旧记录
2. 检查队列长度是否 < 100
3. 允许则添加当前时间戳
```

**优点**：精确控制、平滑限流
**缺点**：存储开销较大

### 2. 令牌桶算法

**使用场景**：Redis 模式下的总请求数限流

**原理**：以固定速率向桶中添加令牌，请求消耗令牌。

```
桶容量: 100, 生成速率: 10/秒

        ┌─────────────┐
        │  令牌桶     │
        │  ○○○○○○○○  │ ← 令牌以固定速率添加
        │  ○○○○○○○○  │
        └─────┬───────┘
              │
              ↓ 请求消耗令牌
         [请求队列]
```

**优点**：允许突发流量、平滑输出
**缺点**：实现复杂、仅 Redis 支持

### 3. 计数器算法

**使用场景**：邮件验证限流、通知限流

**原理**：在固定时间窗口内计数。

```
时间窗口: 30秒, 限制: 2次

窗口1 [0-30s]:  请求1 ✓, 请求2 ✓, 请求3 ✗
窗口2 [30-60s]: 请求1 ✓, 请求2 ✓
```

**优点**：实现简单
**缺点**：存在边界问题（窗口切换时可能突发）

---

## 配置说明

### 环境变量汇总

```bash
# 全局 Web 限流
GLOBAL_WEB_RATE_LIMIT_ENABLE=true
GLOBAL_WEB_RATE_LIMIT=100
GLOBAL_WEB_RATE_LIMIT_DURATION=60

# 全局 API 限流
GLOBAL_API_RATE_LIMIT_ENABLE=true
GLOBAL_API_RATE_LIMIT=100
GLOBAL_API_RATE_LIMIT_DURATION=60

# 关键操作限流
CRITICAL_RATE_LIMIT_ENABLE=true
CRITICAL_RATE_LIMIT=60
CRITICAL_RATE_LIMIT_DURATION=600

# 上传限流
UPLOAD_RATE_LIMIT_ENABLE=true
UPLOAD_RATE_LIMIT=30
UPLOAD_RATE_LIMIT_DURATION=60

# 下载限流
DOWNLOAD_RATE_LIMIT_ENABLE=true
DOWNLOAD_RATE_LIMIT=30
DOWNLOAD_RATE_LIMIT_DURATION=60
```

### 管理后台配置

模型请求限流通过管理后台配置，路径：`运营设置` → `速率限制`

---

## 核心文件

| 文件路径 | 功能描述 |
|---------|---------|
| `middleware/rate-limit.go` | 全局速率限制中间件 |
| `middleware/model-rate-limit.go` | 模型请求速率限制中间件 |
| `middleware/email-verification-rate-limit.go` | 邮件验证速率限制中间件 |
| `service/notify-limit.go` | 通知速率限制服务 |
| `common/rate-limit.go` | 内存限流器实现（滑动窗口） |
| `common/limiter/limiter.go` | Redis 令牌桶限流器 |
| `common/limiter/lua/rate_limit.lua` | 令牌桶 Lua 脚本 |
| `setting/rate_limit.go` | 模型限流配置管理 |
| `common/constants.go` | 限流常量定义 |
| `model/channel_rate_limit.go` | 渠道限流状态管理 |

---

## 存储方式

### Redis 存储（分布式模式）

| 限流类型 | Key 格式 | 数据结构 |
|---------|---------|---------|
| 全局限流 | `rateLimit:{mark}{IP}` | List (时间戳队列) |
| 模型成功请求 | `rateLimit:MRRLS:{userId}` | List (时间戳队列) |
| 模型总请求 | `rateLimit:{userId}` | Hash (tokens, last_time) |
| 邮件验证 | `emailVerification:EV:{IP}` | String (计数器) |
| 通知限流 | `notify_limit:{userId}:{type}:{hour}` | String (计数器) |
| 渠道限流 | `channel_rate_limit:{channelId}` | String (JSON) |

### 内存存储（单机模式）

当未配置 Redis 时，自动使用内存存储：

```go
type InMemoryRateLimiter struct {
    store              map[string]*[]int64  // key -> 时间戳队列
    mutex              sync.Mutex
    expirationDuration time.Duration        // 默认 20 分钟
}
```

**注意**：内存模式不支持分布式部署，重启后限流状态会丢失。

---

## 错误响应

### 全局限流响应

```
HTTP 429 Too Many Requests
```

### 模型请求限流响应

```json
{
    "error": {
        "message": "rate_limit_exceeded: 请求频度超限，请在 X 秒后重试",
        "type": "rate_limit_error",
        "code": "rate_limit_exceeded"
    }
}
```

### 邮件验证限流响应

```json
{
    "success": false,
    "message": "发送过于频繁，请等待 25 秒后再试"
}
```

### 渠道限流响应

当所有可用渠道都被限流时：

```json
{
    "error": {
        "message": "当前分组 xxx 下对于模型 xxx 无可用渠道",
        "type": "invalid_request_error",
        "code": "no_available_channel"
    }
}
```

---

## 最佳实践

### 1. 生产环境配置建议

```bash
# 启用 Redis 以支持分布式限流
REDIS_CONN_STRING=redis://localhost:6379

# 全局 API 限流（根据服务器性能调整）
GLOBAL_API_RATE_LIMIT_ENABLE=true
GLOBAL_API_RATE_LIMIT=1000
GLOBAL_API_RATE_LIMIT_DURATION=60

# 关键操作限流（防止暴力破解）
CRITICAL_RATE_LIMIT_ENABLE=true
CRITICAL_RATE_LIMIT=10
CRITICAL_RATE_LIMIT_DURATION=300
```

### 2. 模型限流分组策略

```json
{
    "admin":   [0, 0],        // 管理员不限制
    "vip":     [1000, 900],   // VIP 用户高配额
    "default": [100, 90],     // 普通用户标准配额
    "free":    [20, 15]       // 免费用户低配额
}
```

### 3. 监控建议

- 监控 429 响应比例，过高说明限流配置过严
- 监控渠道限流状态，频繁限流说明上游配额不足
- 监控 Redis 内存使用，限流 Key 过多可能导致内存问题

### 4. 常见问题

**Q: 为什么配置了限流但不生效？**
- 检查是否启用了对应的限流开关
- 检查 Redis 连接是否正常（分布式模式）
- 检查用户分组是否正确配置

**Q: 如何临时关闭某个用户的限流？**
- 将用户分组设置为 `admin` 或配置 `[0, 0]` 的分组

**Q: 限流导致正常用户被误伤怎么办？**
- 适当提高限流阈值
- 启用等待机制而非直接拒绝
- 为不同用户分组配置不同策略

---

## 架构图

```
                    ┌─────────────────────────────────────────┐
                    │              请求入口                    │
                    └─────────────────┬───────────────────────┘
                                      │
                    ┌─────────────────▼───────────────────────┐
                    │         全局速率限制中间件               │
                    │    (IP 级别, 滑动窗口算法)              │
                    └─────────────────┬───────────────────────┘
                                      │
              ┌───────────────────────┼───────────────────────┐
              │                       │                       │
    ┌─────────▼─────────┐   ┌────────▼────────┐   ┌─────────▼─────────┐
    │   Web 路由        │   │   API 路由      │   │   Relay 路由      │
    │   (Web 限流)      │   │   (API 限流)    │   │                   │
    └───────────────────┘   └─────────────────┘   └─────────┬─────────┘
                                                            │
                                              ┌─────────────▼─────────────┐
                                              │   模型请求速率限制中间件   │
                                              │   (用户级别, 分组策略)    │
                                              └─────────────┬─────────────┘
                                                            │
                                              ┌─────────────▼─────────────┐
                                              │      渠道选择器           │
                                              │   (跳过被限流的渠道)      │
                                              └─────────────┬─────────────┘
                                                            │
                                              ┌─────────────▼─────────────┐
                                              │      上游 API 调用        │
                                              │   (处理 429 响应)         │
                                              └───────────────────────────┘
```

---

## 更新日志

- 2025-12-30: 初始版本，整理限流功能文档
