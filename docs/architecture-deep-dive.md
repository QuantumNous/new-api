# new-api 架构深度解析

> 本文档深入分析 new-api 项目的请求处理流程、核心数据结构和算法设计，用于运维、Debug 和开发优化参考。

## 目录

- [1. 系统架构概览](#1-系统架构概览)
- [2. 请求处理流程详解](#2-请求处理流程详解)
- [3. 核心数据结构](#3-核心数据结构)
- [4. 算法设计](#4-算法设计)
- [5. 缓存机制](#5-缓存机制)
- [6. 计费系统](#6-计费系统)
- [7. 扩展开发指南](#7-扩展开发指南)

---

## 1. 系统架构概览

### 1.1 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 后端框架 | Go 1.22+ + Gin | Web 框架和路由 |
| ORM | GORM v2 | 数据库操作 |
| 数据库 | SQLite/MySQL/PostgreSQL | 三数据库兼容 |
| 缓存 | Redis + In-Memory | 多级缓存 |
| 前端 | React 18 + Vite + Semi UI | 管理界面 |
| 前端包管理 | Bun | 推荐使用 |

### 1.2 目录结构

```
new-api/
├── router/           # 路由定义 (API/Dashboard/Relay/Web)
├── controller/       # HTTP 请求处理器
├── service/          # 业务逻辑层
├── model/            # 数据模型和数据库访问
├── relay/            # AI API 中继层
│   ├── channel/      # 供应商适配器 (40+ providers)
│   ├── common/       # 公共结构和工具
│   └── constant/     # Relay 常量
├── middleware/       # HTTP 中间件 (Auth/RateLimit/Log)
├── setting/          # 配置管理
├── common/           # 共享工具库
├── dto/              # 数据传输对象
├── constant/         # 常量定义
├── types/            # 类型定义
└── web/              # React 前端
```

### 1.3 分层架构图

```
┌─────────────────────────────────────────────────────────┐
│                      客户端请求                          │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│  Router Layer (router/)                                 │
│  - API Router: /api/* 管理接口                           │
│  - Relay Router: /v1/* 中继接口                          │
│  - Dashboard Router: /dashboard/* 数据看板               │
│  - Web Router: /* 前端静态资源                           │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│  Middleware Layer (middleware/)                         │
│  - TokenAuth: API Key 验证                              │
│  - UserAuth: Session 用户认证                           │
│  - Distribute: 渠道选择和负载均衡                        │
│  - RateLimit: 限流控制                                  │
│  - Logger: 请求日志记录                                  │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│  Controller Layer (controller/)                         │
│  - relay.go: 核心中继控制器                              │
│  - user/token/channel: 资源管理                          │
│  - billing: 计费相关                                     │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│  Service Layer (service/)                               │
│  - channel_select.go: 渠道选择算法                       │
│  - billing.go: 计费逻辑                                  │
│  - quota.go: 额度计算                                    │
│  - channel_affinity.go: 渠道亲和性                       │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│  Relay Layer (relay/)                                   │
│  - relay_adaptor.go: 适配器工厂                          │
│  - channel/*/adaptor.go: 供应商适配器实现                 │
│  - common/relay_info.go: 中继信息结构                    │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│  Model Layer (model/)                                   │
│  - channel.go: 渠道模型                                  │
│  - ability.go: 能力模型(分组-模型-渠道映射)               │
│  - token.go: 令牌模型                                    │
│  - user.go: 用户模型                                     │
│  - channel_cache.go: 渠道缓存                            │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│  Upstream Providers                                     │
│  - OpenAI/Azure/Claude/Gemini/AWS/...                   │
└─────────────────────────────────────────────────────────┘
```

---

## 2. 请求处理流程详解

### 2.1 标准 Chat Completions 请求流程

```
┌─────────────────────────────────────────────────────────────────────┐
│                        请求生命周期流程                               │
└─────────────────────────────────────────────────────────────────────┘

  客户端
     │
     │ POST /v1/chat/completions
     │ Authorization: Bearer sk-xxxx
     ▼
┌──────────────┐
│   Router     │ 路由匹配到 relay-router.go
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  Middleware  │
│  - TokenAuth │ 验证 API Key, 获取用户信息
│  - Set Group │ 设置用户分组到 Context
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  Controller  │
│   relay.go   │ Relay() 主流程
└──────┬───────┘
       │
       ├── 1. GetAndValidateRequest() - 解析请求体
       ├── 2. GenRelayInfo() - 生成中继信息
       ├── 3. Sensitive check - 敏感词检测
       ├── 4. EstimateRequestToken() - Token 预估
       └── 5. PreConsumeBilling() - 预扣费
       │
       ▼
┌──────────────┐     ┌──────────────────────────────────┐
│   Service    │     │         渠道选择重试循环          │
│ channel_     │◄────┤  retry=0 → 查询分组内优先级0渠道  │
│ select.go    │     │     ↓                              │
└──────┬───────┘     │  失败? retry=1 → 查询优先级1渠道  │
       │             │     ↓                              │
       ▼             │  分组耗尽? → 切换到下一个分组重试 │
┌──────────────┐     └──────────────────────────────────┘
│    Model     │
│   ability    │ GetRandomSatisfiedChannel(group, model, priority)
└──────┬───────┘
       │
       ▼
┌──────────────┐
│    Relay     │
│  adaptor.go  │ GetAdaptor(apiType) → 获取供应商适配器
└──────┬───────┘
       │
       ├── ConvertRequest() - 转换请求格式
       ├── SetupRequestHeader() - 设置请求头
       ├── DoRequest() - 发送 HTTP 请求
       └── DoResponse() - 处理响应
       │
       ▼
┌──────────────┐
│  Upstream    │ HTTP POST 到上游供应商 API
└──────────────┘
       │
       ▼
┌──────────────┐
│    Model     │
│ consume_log  │ 记录消费日志 (异步)
└──────────────┘
       │
       ▼
┌──────────────┐
│   Service    │ PostConsumeQuota() - 实际结算
│  billing.go  │ SettleBilling() - 多退少补
└──────┬───────┘
       │
       ▼
    客户端 ← 返回响应
```

### 2.2 关键处理阶段说明

#### 阶段 1: 认证与鉴权 (TokenAuth)

```go
// middleware/auth.go - TokenAuth 流程
func TokenAuth() {
    1. 从 Header 提取 Authorization (支持 Bearer/Anthropic/Gemini 格式)
    2. model.ValidateUserToken(key) - 验证令牌有效性
    3. Check IP limits - IP 白名单检查
    4. GetUserCache - 获取用户缓存信息
    5. SetupContextForToken - 设置请求上下文
       - user_id, token_id, token_key
       - user_group, token_group
       - quota, unlimited_quota
}
```

#### 阶段 2: 请求解析与预处理

```go
// controller/relay.go - Relay 主流程
func Relay(c *gin.Context, relayFormat types.RelayFormat) {
    1. GetAndValidateRequest() - 解析并验证请求体
    2. GenRelayInfo() - 生成中继信息
    3. Sensitive check - 敏感词检测
    4. EstimateRequestToken() - Token 预估
    5. PreConsumeBilling() - 预扣费
}
```

#### 阶段 3: 渠道选择 (核心算法)

```go
// service/channel_select.go
func CacheGetRandomSatisfiedChannel(param *RetryParam) (*Channel, string, error) {
    if tokenGroup == "auto" {
        // 自动分组模式：按优先级遍历分组
        for each autoGroup {
            channel = GetRandomSatisfiedChannel(group, model, priorityRetry)
            if channel != nil { return channel }
            // 切换到下一个分组
        }
    } else {
        // 固定分组模式
        channel = GetRandomSatisfiedChannel(tokenGroup, model, retry)
    }
}
```

#### 阶段 4: 请求中继

```go
// relay/relay_adaptor.go
func GetAdaptor(apiType int) channel.Adaptor {
    switch apiType {
    case constant.APITypeOpenAI: return &openai.Adaptor{}
    case constant.APITypeAnthropic: return &claude.Adaptor{}
    case constant.APITypeGemini: return &gemini.Adaptor{}
    // ... 40+ 适配器
    }
}

// 适配器接口
type Adaptor interface {
    Init(info *RelayInfo)
    GetRequestURL(info *RelayInfo) (string, error)
    SetupRequestHeader(c *gin.Context, header *http.Header, info *RelayInfo) error
    ConvertOpenAIRequest(c *gin.Context, info *RelayInfo, request *dto.GeneralOpenAIRequest) (any, error)
    DoRequest(c *gin.Context, info *RelayInfo, requestBody io.Reader) (any, error)
    DoResponse(c *gin.Context, resp *http.Response, info *RelayInfo) (usage any, err *types.NewAPIError)
}
```

#### 阶段 5: 计费与日志

```go
// service/text_quota.go
func PostTextConsumeQuota(ctx, relayInfo, usage) {
    1. calculateTextQuotaSummary() - 计算额度明细
       - Prompt tokens * ModelRatio * GroupRatio
       - Completion tokens * CompletionRatio
       - Cache tokens * CacheRatio
       - Web search / File search 额外计费
    2. SettleBilling() - 结算（多退少补）
    3. RecordConsumeLog() - 记录消费日志
}
```

---

## 3. 核心数据结构

### 3.1 Channel (渠道模型)

```go
// model/channel.go
type Channel struct {
    Id                 int         // 渠道ID
    Type               int         // 渠道类型 (ChannelTypeOpenAI/Anthropic/Gemini...)
    Key                string      // API Key (支持多key换行分隔)
    Status             int         // 状态 (Enabled/Disabled/AutoDisabled)
    Name               string
    Weight             *uint       // 权重 (负载均衡)
    Priority           *int64      // 优先级 (重试用)
    BaseURL            *string     // 自定义基础URL
    Models             string      // 支持的模型 (逗号分隔)
    Group              string      // 所属分组 (逗号分隔)
    ModelMapping       *string     // 模型映射配置
    StatusCodeMapping  *string     // 状态码映射
    AutoBan            *int        // 是否自动禁用
    Tag                *string     // 标签 (批量管理)
    Setting            *string     // 渠道设置 (JSON)
    ParamOverride      *string     // 参数覆盖 (JSON)
    HeaderOverride     *string     // Header覆盖 (JSON)
    ChannelInfo        ChannelInfo // 多Key管理信息
}

type ChannelInfo struct {
    IsMultiKey             bool              // 是否多Key模式
    MultiKeySize           int               // Key数量
    MultiKeyStatusList     map[int]int       // key索引 -> 状态
    MultiKeyDisabledReason map[int]string    // key索引 -> 禁用原因
    MultiKeyDisabledTime   map[int]int64     // key索引 -> 禁用时间
    MultiKeyPollingIndex   int               // 轮询索引
    MultiKeyMode           MultiKeyMode      // random/polling
}
```

### 3.2 Ability (能力模型)

```go
// model/ability.go
// 核心关系表: 分组 × 模型 × 渠道 的映射关系
type Ability struct {
    Group     string  `gorm:"primaryKey"`  // 分组名
    Model     string  `gorm:"primaryKey"`  // 模型名
    ChannelId int     `gorm:"primaryKey"`  // 渠道ID
    Enabled   bool                        // 是否启用
    Priority  *int64                      // 优先级
    Weight    uint                        // 权重
    Tag       *string                     // 标签
}

// 查询示例: 获取分组下某模型的可用渠道
SELECT * FROM abilities 
WHERE `group` = 'vip' AND model = 'gpt-4' AND enabled = 1 
ORDER BY priority DESC
```

### 3.3 RelayInfo (中继信息)

```go
// relay/common/relay_info.go
type RelayInfo struct {
    // 用户/令牌信息
    TokenId           int
    TokenKey          string
    TokenGroup        string        // 令牌指定的分组
    UserId            int
    UserGroup         string        // 用户默认分组
    UsingGroup        string        // 实际使用的分组(auto模式下会变化)
    
    // 请求信息
    OriginModelName   string        // 原始请求的模型名
    RelayMode         int           // 中继模式 (Chat/Embedding/Image...)
    RelayFormat       RelayFormat   // 格式 (OpenAI/Claude/Gemini...)
    IsStream          bool
    StartTime         time.Time
    FirstResponseTime time.Time
    
    // 渠道信息
    ChannelMeta       *ChannelMeta
    
    // 计费信息
    PriceData         PriceData
    Billing           BillingSettler
    BillingSource     string        // wallet/subscription
    
    // 请求转换链
    RequestConversionChain []RelayFormat  // 如: [openai, claude]
}

type ChannelMeta struct {
    ChannelType          int
    ChannelId            int
    ApiType              int
    ApiKey               string
    ChannelBaseUrl       string
    UpstreamModelName    string    // 实际发送到上游的模型名
    IsModelMapped        bool      // 是否经过模型映射
    SupportStreamOptions bool
    ParamOverride        map[string]interface{}
    HeadersOverride      map[string]interface{}
}
```

### 3.4 Token (令牌模型)

```go
// model/token.go
type Token struct {
    Id                 int
    UserId             int
    Key                string         // 48字符唯一key
    Status             int            // Enabled/Disabled/Exhausted/Expired
    Name               string
    ExpiredTime        int64          // -1 表示永不过期
    RemainQuota        int            // 剩余额度
    UnlimitedQuota     bool           // 是否无限额度
    ModelLimitsEnabled bool           // 是否启用模型限制
    ModelLimits        string         // 限制的模型列表
    AllowIps           *string        // IP白名单
    Group              string         // 令牌分组 (覆盖用户分组)
    CrossGroupRetry    bool           // 是否跨分组重试
}
```

### 3.5 BillingSession (计费会话)

```go
// service/billing_session.go
type BillingSession struct {
    relayInfo        *RelayInfo
    funding          FundingSource    // WalletFunding / SubscriptionFunding
    preConsumedQuota int              // 预扣额度
    tokenConsumed    int              // 实际扣减的令牌额度
    fundingSettled   bool             // 资金是否已结算
    settled          bool             // 是否已完成
    refunded         bool             // 是否已退款
    mu               sync.Mutex       // 并发保护
}

type FundingSource interface {
    Source() string                    // "wallet" / "subscription"
    PreConsume(amount int) error       // 预扣
    Settle(delta int) error            // 结算 (delta > 0 补扣, < 0 返还)
    Refund() error                     // 退款
}
```

---

## 4. 算法设计

### 4.1 渠道选择算法

#### 4.1.1 加权随机选择

```go
// model/channel_cache.go - GetRandomSatisfiedChannel
func GetRandomSatisfiedChannel(group, model string, retry int) (*Channel, error) {
    // 1. 获取该分组+模型的所有渠道
    channels := group2model2channels[group][model]
    
    // 2. 获取唯一优先级列表并排序
    uniquePriorities := getUniquePriorities(channels)
    sort.Sort(sort.Reverse(sort.IntSlice(uniquePriorities)))
    
    // 3. 根据 retry 次数确定目标优先级
    // retry=0 取最高优先级, retry=1 取次高优先级...
    targetPriority := uniquePriorities[min(retry, len(uniquePriorities)-1)]
    
    // 4. 筛选出目标优先级的渠道
    targetChannels := filterByPriority(channels, targetPriority)
    
    // 5. 加权随机选择
    // 权重平滑处理: 当平均权重<10时, smoothingFactor=100
    totalWeight := sumWeight * smoothingFactor
    randomWeight := rand.Intn(totalWeight)
    
    for _, channel := range targetChannels {
        randomWeight -= channel.GetWeight()*smoothingFactor + smoothingAdjustment
        if randomWeight < 0 {
            return channel, nil
        }
    }
}
```

#### 4.1.2 Auto 分组跨组重试

```go
// service/channel_select.go
func CacheGetRandomSatisfiedChannel(param *RetryParam) (*Channel, string, error) {
    if param.TokenGroup == "auto" {
        autoGroups := GetUserAutoGroup(userGroup) // [group1, group2, group3]
        
        for i := startGroupIndex; i < len(autoGroups); i++ {
            autoGroup := autoGroups[i]
            
            // 计算当前分组内的优先级重试次数
            priorityRetry := param.GetRetry()
            if i > startGroupIndex {
                priorityRetry = 0  // 新分组重置优先级
            }
            
            channel, _ = model.GetRandomSatisfiedChannel(autoGroup, model, priorityRetry)
            if channel == nil {
                // 当前分组无可用渠道,切换到下一个分组
                common.SetContextKey(ctx, ContextKeyAutoGroupIndex, i+1)
                param.SetRetry(0)
                continue
            }
            return channel, autoGroup, nil
        }
    }
}
```

**重试流程示例** (假设每个分组有2个优先级, RetryTimes=3):

```
Retry=0: GroupA, priority0 (最高优先级)
Retry=1: GroupA, priority1 (次高优先级)
Retry=2: GroupA exhausted → GroupB, priority0
Retry=3: GroupB, priority1
```

### 4.2 多 Key 轮询算法

```go
// model/channel.go - GetNextEnabledKey
func (channel *Channel) GetNextEnabledKey() (string, int, *types.NewAPIError) {
    if !channel.ChannelInfo.IsMultiKey {
        return channel.Key, 0, nil  // 单Key直接返回
    }
    
    keys := channel.GetKeys()
    
    switch channel.ChannelInfo.MultiKeyMode {
    case MultiKeyModeRandom:
        // 随机选择一个可用key
        enabledIdx := getEnabledKeyIndexes()
        selectedIdx := enabledIdx[rand.Intn(len(enabledIdx))]
        return keys[selectedIdx], selectedIdx, nil
        
    case MultiKeyModePolling:
        // 轮询选择
        lock := GetChannelPollingLock(channel.Id)  // 每渠道一个锁
        lock.Lock()
        defer lock.Unlock()
        
        start := channelInfo.MultiKeyPollingIndex
        for i := 0; i < len(keys); i++ {
            idx := (start + i) % len(keys)
            if keyIsEnabled(idx) {
                // 更新轮询索引
                channel.ChannelInfo.MultiKeyPollingIndex = (idx + 1) % len(keys)
                return keys[idx], idx, nil
            }
        }
    }
}
```

### 4.3 Token 预估算法

```go
// service/token_estimator.go
func EstimateRequestToken(c *gin.Context, meta *types.TokenCountMeta, info *relaycommon.RelayInfo) (int, error) {
    switch meta.TokenType {
    case types.TokenTypeEstimate:
        // 基于MaxTokens预估
        return estimateByMaxTokens(meta.MaxTokens), nil
        
    case types.TokenTypePromptTokens:
        // 使用实际的PromptTokens
        return meta.PromptTokens, nil
        
    case types.TokenTypeTokenizer:
        // 使用tiktoken精确计算
        return countTokensByTokenizer(meta.CombineText, info.OriginModelName)
    }
}

// 预估策略优先级:
// 1. 如果 CountToken 启用且请求体不太大: 使用tiktoken精确计算
// 2. 如果请求包含MaxTokens: 按MaxTokens预扣
// 3. 否则使用默认预估 (如 1000 tokens)
```

---

## 5. 缓存机制

### 5.1 多级缓存架构

```
┌─────────────────────────────────────────────────────────┐
│  Level 1: In-Memory Cache (channel_cache.go)            │
│  - group2model2channels: map[group][model][]channelId   │
│  - channelsIDM: map[channelId]*Channel                  │
│  - 同步频率: 默认60秒 (SyncFrequency)                    │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼ (未命中)
┌─────────────────────────────────────────────────────────┐
│  Level 2: Redis Cache (token_cache.go, user_cache.go)   │
│  - 用户配额信息                                          │
│  - 令牌信息                                              │
│  - 渠道状态                                              │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼ (未命中)
┌─────────────────────────────────────────────────────────┐
│  Level 3: Database (GORM)                               │
│  - 主数据存储                                            │
└─────────────────────────────────────────────────────────┘
```

### 5.2 缓存同步机制

```go
// model/channel_cache.go
func InitChannelCache() {
    // 1. 加载所有渠道
    channels := DB.Find(&channels)
    for _, channel := range channels {
        channelsIDM[channel.Id] = channel
    }
    
    // 2. 构建 group -> model -> channelIds 映射
    for _, channel := range channels {
        if channel.Status != Enabled { continue }
        
        groups := strings.Split(channel.Group, ",")
        models := strings.Split(channel.Models, ",")
        
        for _, group := range groups {
            for _, model := range models {
                group2model2channels[group][model] = append(..., channel.Id)
            }
        }
    }
    
    // 3. 按优先级排序
    for each group, model2channels {
        sortByPriority(model2channels)
    }
}

// 后台定期同步
func SyncChannelCache(frequency int) {
    for {
        time.Sleep(frequency * time.Second)
        InitChannelCache()
    }
}
```

### 5.3 缓存一致性保证

| 操作 | 缓存更新策略 |
|------|-------------|
| 渠道状态变更 | `CacheUpdateChannelStatus()` 立即更新内存 + 异步更新Redis |
| 渠道编辑 | `InitChannelCache()` 全量刷新 |
| 令牌额度消耗 | `cacheDecrTokenQuota()` 更新Redis + 批量更新DB |
| 用户额度变更 | `cacheSetUserQuota()` 更新Redis + 异步写DB |

---

## 6. 计费系统

### 6.1 计费模型

```go
// 额度计算公式 (text_quota.go)
Quota = (
    // 基础输入
    (PromptTokens - CacheTokens - CacheCreationTokens - ImageTokens - AudioTokens) * ModelRatio * GroupRatio +
    
    // 缓存输入
    CacheTokens * CacheRatio * ModelRatio * GroupRatio +
    
    // 缓存创建
    CacheCreationTokens * CacheCreationRatio * ModelRatio * GroupRatio +
    
    // 图片输入
    ImageTokens * ImageRatio * ModelRatio * GroupRatio +
    
    // 音频输入 (按价格)
    AudioTokens * AudioPricePerMillion / 1000000 * GroupRatio +
    
    // 补全输出
    CompletionTokens * CompletionRatio * ModelRatio * GroupRatio +
    
    // 额外服务
    WebSearchCallCount * WebSearchPrice / 1000 * GroupRatio +
    FileSearchCallCount * FileSearchPrice / 1000 * GroupRatio
) * OtherRatios

// 按价格计费 (绕过token计算)
Quota = ModelPrice * QuotaPerUnit * GroupRatio
```

### 6.2 计费流程

```go
// controller/relay.go
func Relay(c *gin.Context, relayFormat) {
    // 1. 预估阶段
    estimatedTokens := EstimateRequestToken(...)
    priceData := ModelPriceHelper(...)  // 获取价格配置
    
    // 2. 预扣费
    PreConsumeBilling(c, quotaToPreConsume, relayInfo)
    
    defer func() {
        if error != nil {
            // 3. 失败退款
            relayInfo.Billing.Refund(c)
        }
    }()
    
    // 4. 执行请求 (可能重试)
    for retry <= RetryTimes {
        err = relayHandler(c, relayInfo)
        if err == nil { break }
    }
    
    // 5. 结算 (多退少补)
    PostTextConsumeQuota(c, relayInfo, actualUsage)
}
```

### 6.3 计费来源优先级

```go
// service/billing_session.go - NewBillingSession
func NewBillingSession(c, relayInfo, preConsumedQuota) {
    pref := NormalizeBillingPreference(userSetting.BillingPreference)
    
    switch pref {
    case "subscription_only":
        // 仅使用订阅
        return trySubscription()
        
    case "wallet_only":
        // 仅使用钱包
        return tryWallet()
        
    case "wallet_first":
        // 优先钱包,不足时回退到订阅
        session, err := tryWallet()
        if err == InsufficientQuota {
            return trySubscription()
        }
        return session
        
    case "subscription_first": // 默认
        // 优先订阅,无订阅时回退到钱包
        if !hasActiveSubscription() {
            return tryWallet()
        }
        session, err := trySubscription()
        if err == InsufficientQuota {
            return tryWallet()
        }
        return session
    }
}
```

---

## 7. 扩展开发指南

### 7.1 添加新渠道适配器

```go
// 1. 创建适配器文件 relay/channel/newprovider/adaptor.go
package newprovider

type Adaptor struct {
    ChannelType int
}

func (a *Adaptor) Init(info *relaycommon.RelayInfo) {
    a.ChannelType = info.ChannelType
}

func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
    return fmt.Sprintf("%s/v1/chat/completions", info.ChannelBaseUrl), nil
}

func (a *Adaptor) SetupRequestHeader(c *gin.Context, header *http.Header, info *relaycommon.RelayInfo) error {
    header.Set("Authorization", "Bearer "+info.ApiKey)
    return nil
}

func (a *Adaptor) ConvertOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error) {
    // 转换请求格式
    return request, nil
}

func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
    return channel.DoApiRequest(a, c, info, requestBody)
}

func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (usage any, err *types.NewAPIError) {
    // 处理响应
    return common_handler.OpenaiHandler(c, info, resp)
}

// 2. 在 relay/relay_adaptor.go 注册
func GetAdaptor(apiType int) channel.Adaptor {
    switch apiType {
    case constant.APITypeNewProvider:
        return &newprovider.Adaptor{}
    }
}

// 3. 在 constant/channel.go 添加常量
const ChannelTypeNewProvider = 45
const APITypeNewProvider = 45

// 4. 添加基础URL映射
var ChannelBaseURLs = map[int]string{
    ChannelTypeNewProvider: "https://api.newprovider.com",
}
```

### 7.2 添加新中继模式

```go
// 1. 在 relay/constant/relay_mode.go 添加
const (
    RelayModeChatCompletions = iota
    ...
    RelayModeNewFeature
)

// 2. 在 Path2RelayMode 映射路由
func Path2RelayMode(path string) int {
    switch {
    case strings.HasSuffix(path, "/new-feature"):
        return RelayModeNewFeature
    }
}

// 3. 在 controller/relay.go 添加处理器
func relayHandler(c *gin.Context, info *relaycommon.RelayInfo) *types.NewAPIError {
    switch info.RelayMode {
    case relayconstant.RelayModeNewFeature:
        err = relay.NewFeatureHelper(c, info)
    }
}
```

### 7.3 调优与监控要点

| 调优项 | 配置位置 | 建议值 |
|--------|----------|--------|
| 渠道同步频率 | `SYNC_FREQUENCY` | 60s (渠道多时适当增加) |
| 重试次数 | `RETRY_TIMES` | 3 |
| 信任额度阈值 | `TRUST_QUOTA` | 100000 (1美元) |
| 批量更新间隔 | `BATCH_UPDATE_INTERVAL` | 5s |
| 请求超时 | `TIMEOUT` | 根据模型调整 |

**关键监控指标**:
- 渠道成功率 (用于自动禁用决策)
- 平均响应时间 (用于渠道选择权重调整)
- 各模型 Token 消耗分布
- 缓存命中率 (Redis/Memory)

---

## 附录: 调试技巧

### 启用 Debug 日志
```bash
export GIN_MODE=debug
export DEBUG=true
```

### 查看渠道选择过程
```bash
# 在日志中搜索
"Auto selecting group"
"priorityRetry"
```

### 追踪单个请求
```bash
# 每个请求有唯一的 request_id
# 在日志中搜索 request_id 可追踪完整生命周期
```

---

*文档版本: v1.0*  
*最后更新: 2025-03-30*
