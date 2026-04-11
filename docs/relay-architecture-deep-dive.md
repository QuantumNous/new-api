# Relay 架构深度解析

## 概述

**Relay** 是 new-api 项目的核心组件，负责将客户端的 AI API 请求转发到上游提供商（OpenAI、Claude、Gemini 等 40+ 家）。它实现了统一的 API 网关，提供协议转换、负载均衡、计费、重试等关键能力。

```
┌─────────────┐     ┌─────────────────────────────────────┐     ┌─────────────────┐
│   客户端     │────▶│            Relay 层                  │────▶│   OpenAI        │
│ (OpenAI SDK)│◄────│  (协议转换 · 负载均衡 · 计费 · 缓存)   │◄────│   Claude        │
└─────────────┘     └─────────────────────────────────────┘     │   Gemini        │
                                                                │   阿里云/百度/... │
                                                                └─────────────────┘
```

---

## 一、核心架构设计

### 1.1 分层架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        Controller 层                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐   │
│  │ Relay()  │ │ RelayTask│ │RelayMidjourney│  ...          │   │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────────┬─────────┘   │
└───────┼────────────┼────────────┼────────────────┼─────────────┘
        │            │            │                │
        ▼            ▼            ▼                ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Relay 核心层                             │
│  ┌──────────────┐ ┌──────────────┐ ┌─────────────────────────┐  │
│  │ relay_adaptor│ │ relay_task   │ │  common_handler         │  │
│  │ (适配器工厂)  │ │ (异步任务)   │ │  (通用响应处理)          │  │
│  └──────────────┘ └──────────────┘ └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Channel 适配器层                            │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐        │
│  │ openai │ │ claude │ │ gemini │ │  ali   │ │  aws   │  ...   │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘        │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 核心数据结构

#### RelayInfo - 请求上下文载体

```go
// relay/common/relay_info.go:85-172
type RelayInfo struct {
    // ========== 用户/Token 信息 ==========
    TokenId           int
    TokenKey          string
    TokenGroup        string
    UserId            int
    UsingGroup        string        // 当前使用的分组（跨分组重试时会变动）
    UserGroup         string        // 用户所在分组
    TokenUnlimited    bool
    
    // ========== 请求元数据 ==========
    StartTime         time.Time
    FirstResponseTime time.Time
    IsStream          bool
    RelayMode         int           // 请求类型（聊天/嵌入/图片/音频等）
    OriginModelName   string        // 原始模型名称
    RequestURLPath    string
    
    // ========== 计费相关 ==========
    ForcePreConsume   bool          // 强制预扣费（用于异步任务）
    Billing           BillingSettler // 计费会话
    BillingSource     string        // "wallet" | "subscription"
    PriceData         types.PriceData
    
    // ========== 渠道信息 ==========
    *ChannelMeta                    // 嵌入渠道元数据
    
    // ========== 特定功能 ==========
    *ClaudeConvertInfo              // Claude 协议转换状态
    *RerankerInfo                   // Rerank 请求信息
    *ResponsesUsageInfo             // Responses API 工具使用统计
    *TaskRelayInfo                  // 异步任务信息
}
```

**设计要点**：
- `RelayInfo` 贯穿整个请求生命周期，避免使用 context 传递导致的信息丢失
- 使用嵌入结构体（`*ChannelMeta` 等）实现可选/扩展字段
- 计费信息独立封装，支持钱包和订阅两种计费模式

#### ChannelMeta - 渠道元数据

```go
// relay/common/relay_info.go:60-78
type ChannelMeta struct {
    ChannelType          int
    ChannelId            int
    ChannelIsMultiKey    bool
    ChannelMultiKeyIndex int
    ChannelBaseUrl       string
    ApiType              int           // 映射到适配器类型
    ApiVersion           string        // Azure/Gemini API 版本
    ApiKey               string
    Organization         string
    ChannelCreateTime    int64
    ParamOverride        map[string]interface{}  // 参数覆盖
    HeadersOverride      map[string]interface{}  // Header 覆盖
    ChannelSetting       dto.ChannelSettings
    UpstreamModelName    string
    IsModelMapped        bool
    SupportStreamOptions bool
}
```

---

## 二、适配器模式（Adapter Pattern）

### 2.1 适配器接口定义

```go
// relay/channel/adapter.go:15-32
type Adaptor interface {
    // 初始化适配器
    Init(info *relaycommon.RelayInfo)
    
    // 构建请求 URL
    GetRequestURL(info *relaycommon.RelayInfo) (string, error)
    
    // 设置请求头
    SetupRequestHeader(c *gin.Context, req *http.Header, info *relaycommon.RelayInfo) error
    
    // 请求转换方法群（支持多种输入格式）
    ConvertOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error)
    ConvertRerankRequest(c *gin.Context, relayMode int, request dto.RerankRequest) (any, error)
    ConvertEmbeddingRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.EmbeddingRequest) (any, error)
    ConvertAudioRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.AudioRequest) (io.Reader, error)
    ConvertImageRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error)
    ConvertOpenAIResponsesRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.OpenAIResponsesRequest) (any, error)
    ConvertClaudeRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.ClaudeRequest) (any, error)
    ConvertGeminiRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeminiChatRequest) (any, error)
    
    // 执行请求和处理响应
    DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error)
    DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (usage any, err *types.NewAPIError)
    
    // 元数据
    GetModelList() []string
    GetChannelName() string
}
```

### 2.2 适配器工厂

```go
// relay/relay_adaptor.go:53-125
func GetAdaptor(apiType int) channel.Adaptor {
    switch apiType {
    case constant.APITypeAli:
        return &ali.Adaptor{}
    case constant.APITypeAnthropic:
        return &claude.Adaptor{}
    case constant.APITypeBaidu:
        return &baidu.Adaptor{}
    case constant.APITypeGemini:
        return &gemini.Adaptor{}
    case constant.APITypeOpenAI:
        return &openai.Adaptor{}
    case constant.APITypeAws:
        return &aws.Adaptor{}
    // ... 40+ 家提供商
    }
    return nil
}
```

**设计优势**：
1. **解耦**：Controller 无需关心具体提供商实现
2. **可扩展**：新增提供商只需实现接口并注册到工厂
3. **一致性**：所有提供商遵循统一的请求/响应处理流程

### 2.3 OpenAI 适配器示例

```go
// relay/channel/openai/adaptor.go:37-40
type Adaptor struct {
    ChannelType    int
    ResponseFormat string
}

// Init 初始化适配器状态
func (a *Adaptor) Init(info *relaycommon.RelayInfo) {
    a.ChannelType = info.ChannelType
    // 初始化 ThinkingContentInfo（当启用 thinking_to_content 时）
    if info.ChannelSetting.ThinkingToContent {
        info.ThinkingContentInfo = relaycommon.ThinkingContentInfo{...}
    }
}

// GetRequestURL 处理不同渠道的 URL 构建
func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
    switch info.ChannelType {
    case constant.ChannelTypeAzure:
        // Azure 特殊处理：/openai/deployments/{model}/{task}?api-version={version}
        return buildAzureURL(info)
    case constant.ChannelTypeCustom:
        // 自定义渠道支持 {model} 占位符替换
        url := info.ChannelBaseUrl
        url = strings.Replace(url, "{model}", info.UpstreamModelName, -1)
        return url, nil
    default:
        return relaycommon.GetFullRequestURL(info.ChannelBaseUrl, info.RequestURLPath, info.ChannelType), nil
    }
}

// ConvertOpenAIRequest 请求转换与参数适配
func (a *Adaptor) ConvertOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error) {
    // OpenRouter 特殊适配
    if info.ChannelType == constant.ChannelTypeOpenRouter {
        // 处理 thinking 后缀、reasoning 参数等
        adaptForOpenRouter(request, info)
    }
    
    // o-series/gpt-5 模型适配
    if strings.HasPrefix(info.UpstreamModelName, "o") || strings.HasPrefix(info.UpstreamModelName, "gpt-5") {
        // 转换 MaxTokens → MaxCompletionTokens
        adaptOSeriesModels(request, info)
    }
    
    return request, nil
}

// DoResponse 根据 RelayMode 分发到不同处理器
func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (usage any, err *types.NewAPIError) {
    switch info.RelayMode {
    case relayconstant.RelayModeRealtime:
        err, usage = OpenaiRealtimeHandler(c, info)
    case relayconstant.RelayModeAudioSpeech:
        usage = OpenaiTTSHandler(c, resp, info)
    case relayconstant.RelayModeRerank:
        usage, err = common_handler.RerankHandler(c, info, resp)
    default:
        if info.IsStream {
            usage, err = OaiStreamHandler(c, info, resp)
        } else {
            usage, err = OpenaiHandler(c, info, resp)
        }
    }
    return
}
```

---

## 三、请求处理流程

### 3.1 同步请求完整流程

```
┌─────────────────────────────────────────────────────────────────────┐
│                         请求处理流程                                 │
└─────────────────────────────────────────────────────────────────────┘

 ① 接收请求
    │
    ▼
 ② 生成 RelayInfo
    │   GenRelayInfo(c, relayFormat, request, ws)
    │   ├── 设置基础信息（UserId, TokenId, 模型名等）
    │   ├── 设置 RelayMode（根据请求路径）
    │   └── 设置格式特定信息（ClaudeConvertInfo/RerankerInfo等）
    │
    ▼
 ③ Token 估算与敏感词检查
    │
    ▼
 ④ 价格计算与预扣费
    │   helper.ModelPriceHelper()
    │   └── service.PreConsumeBilling()
    │
    ▼
 ⑤ 渠道选择与重试循环
    │   for retry <= MaxRetries {
    │       channel := getChannel()       // 负载均衡选择
    │       adaptor := GetAdaptor(apiType) // 获取适配器
    │       adaptor.Init(info)
    │       
    │       // 构建请求
    │       url := adaptor.GetRequestURL(info)
    │       header := adaptor.SetupRequestHeader(c, &req.Header, info)
    │       body := adaptor.ConvertOpenAIRequest(c, info, request)
    │       
    │       // 发送与处理
    │       resp, _ := adaptor.DoRequest(c, info, body)
    │       usage, err := adaptor.DoResponse(c, resp, info)
    │       
    │       if err == nil { break }
    │       if !shouldRetry(err) { break }
    │   }
    │
    ▼
 ⑥ 计费结算
    │   service.SettleBilling(ctx, relayInfo, actualQuota)
    │
    ▼
 ⑦ 返回响应
```

### 3.2 Controller 层核心代码

```go
// controller/relay.go:67-242
func Relay(c *gin.Context, relayFormat types.RelayFormat) {
    // 1. 解析并验证请求
    request, err := helper.GetAndValidateRequest(c, relayFormat)
    
    // 2. 生成 RelayInfo
    relayInfo, err := relaycommon.GenRelayInfo(c, relayFormat, request, ws)
    
    // 3. Token 估算
    tokens, err := service.EstimateRequestToken(c, meta, relayInfo)
    relayInfo.SetEstimatePromptTokens(tokens)
    
    // 4. 价格计算与预扣费
    priceData, err := helper.ModelPriceHelper(c, relayInfo, tokens, meta)
    if !priceData.FreeModel {
        service.PreConsumeBilling(c, priceData.QuotaToPreConsume, relayInfo)
    }
    
    // 5. 重试循环
    retryParam := &service.RetryParam{...}
    for ; retryParam.GetRetry() <= common.RetryTimes; retryParam.IncreaseRetry() {
        channel, channelErr := getChannel(c, relayInfo, retryParam)
        addUsedChannel(c, channel.Id)
        
        // 根据格式分发到不同处理器
        switch relayFormat {
        case types.RelayFormatOpenAIRealtime:
            newAPIError = relay.WssHelper(c, relayInfo)
        case types.RelayFormatClaude:
            newAPIError = relay.ClaudeHelper(c, relayInfo)
        case types.RelayFormatGemini:
            newAPIError = geminiRelayHandler(c, relayInfo)
        default:
            newAPIError = relayHandler(c, relayInfo)  // 通用处理
        }
        
        if newAPIError == nil { return }  // 成功
        if !shouldRetry(c, newAPIError, remainingRetries) { break }
    }
}

// 根据 RelayMode 选择具体处理器
func relayHandler(c *gin.Context, info *relaycommon.RelayInfo) *types.NewAPIError {
    switch info.RelayMode {
    case relayconstant.RelayModeImagesGenerations:
        return relay.ImageHelper(c, info)
    case relayconstant.RelayModeAudioSpeech:
        return relay.AudioHelper(c, info)
    case relayconstant.RelayModeRerank:
        return relay.RerankHelper(c, info)
    case relayconstant.RelayModeEmbeddings:
        return relay.EmbeddingHelper(c, info)
    case relayconstant.RelayModeResponses:
        return relay.ResponsesHelper(c, info)
    default:
        return relay.TextHelper(c, info)  // 默认文本聊天
    }
}
```

---

## 四、异步任务（Task）设计

### 4.1 Task 与同步请求的区别

| 特性 | 同步请求 | 异步任务 |
|------|----------|----------|
| 响应时间 | 即时（秒级） | 延迟（分钟级） |
| 典型场景 | 聊天、嵌入 | 视频生成、音乐生成 |
| 计费模式 | 按 Token | 按次/按参数（时长、分辨率） |
| 状态管理 | 无 | 需持久化任务状态 |
| 结果获取 | 直接返回 | 需要轮询查询 |

### 4.2 TaskAdaptor 接口

```go
// relay/channel/adapter.go:34-79
type TaskAdaptor interface {
    Init(info *relaycommon.RelayInfo)
    
    // 验证与计费估算
    ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) *dto.TaskError
    EstimateBilling(c *gin.Context, info *relaycommon.RelayInfo) map[string]float64  // 返回 OtherRatios
    AdjustBillingOnSubmit(info *relaycommon.RelayInfo, taskData []byte) map[string]float64
    AdjustBillingOnComplete(task *model.Task, taskResult *relaycommon.TaskInfo) int
    
    // 请求构建
    BuildRequestURL(info *relaycommon.RelayInfo) (string, error)
    BuildRequestHeader(c *gin.Context, req *http.Request, info *relaycommon.RelayInfo) error
    BuildRequestBody(c *gin.Context, info *relaycommon.RelayInfo) (io.Reader, error)
    
    // 请求执行
    DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (*http.Response, error)
    DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (taskID string, taskData []byte, err *dto.TaskError)
    
    // 轮询相关
    FetchTask(baseUrl, key string, body map[string]any, proxy string) (*http.Response, error)
    ParseTaskResult(respBody []byte) (*relaycommon.TaskInfo, error)
    
    GetModelList() []string
    GetChannelName() string
}
```

### 4.3 任务提交流程

```go
// relay/relay_task.go:144-258
func RelayTaskSubmit(c *gin.Context, info *relaycommon.RelayInfo) (*TaskSubmitResult, *dto.TaskError) {
    info.InitChannelMeta(c)
    
    // 1. 确定 platform 并创建适配器
    platform := GetTaskPlatform(c)
    adaptor := GetTaskAdaptor(platform)
    adaptor.Init(info)
    
    // 2. 验证请求
    if taskErr := adaptor.ValidateRequestAndSetAction(c, info); taskErr != nil {
        return nil, taskErr
    }
    
    // 3. 应用模型映射
    helper.ModelMappedHelper(c, info, nil)
    
    // 4. 预生成公开 Task ID
    if info.PublicTaskID == "" {
        info.PublicTaskID = model.GenerateTaskID()
    }
    
    // 5. 基础价格计算
    priceData, _ := helper.ModelPriceHelperPerCall(c, info)
    info.PriceData = priceData
    
    // 6. 计费估算（获取 OtherRatios：时长、分辨率等）
    if estimatedRatios := adaptor.EstimateBilling(c, info); len(estimatedRatios) > 0 {
        for k, v := range estimatedRatios {
            info.PriceData.AddOtherRatio(k, v)
        }
    }
    
    // 7. 应用 OtherRatios 计算最终额度
    for _, ra := range info.PriceData.OtherRatios {
        if ra != 1.0 {
            info.PriceData.Quota = int(float64(info.PriceData.Quota) * ra)
        }
    }
    
    // 8. 预扣费（仅首次）
    if info.Billing == nil && !info.PriceData.FreeModel {
        info.ForcePreConsume = true
        service.PreConsumeBilling(c, info.PriceData.Quota, info)
    }
    
    // 9. 构建并发送请求
    requestBody, _ := adaptor.BuildRequestBody(c, info)
    resp, _ := adaptor.DoRequest(c, info, requestBody)
    
    // 10. 提交后计费调整
    upstreamTaskID, taskData, taskErr := adaptor.DoResponse(c, resp, info)
    finalQuota := info.PriceData.Quota
    if adjustedRatios := adaptor.AdjustBillingOnSubmit(info, taskData); len(adjustedRatios) > 0 {
        finalQuota = recalcQuotaFromRatios(info, adjustedRatios)
    }
    
    return &TaskSubmitResult{
        UpstreamTaskID: upstreamTaskID,
        TaskData:       taskData,
        Platform:       platform,
        Quota:          finalQuota,
    }, nil
}
```

### 4.4 计费模型：OtherRatios

异步任务采用多维度计费模型：

```
最终额度 = 基础价格 × 时长比例 × 分辨率比例 × 分组倍率

示例（视频生成）：
- 基础价格: 1000 quota
- 时长比例: 5秒 → 5.0
- 分辨率比例: 1080p → 1.666
- 分组倍率: 1.0

最终额度 = 1000 × 5.0 × 1.666 × 1.0 = 8330 quota
```

```go
// relay/relay_task.go:262-279
func recalcQuotaFromRatios(info *relaycommon.RelayInfo, ratios map[string]float64) int {
    // 1. 从当前额度恢复基础额度
    baseQuota := info.PriceData.Quota
    for _, ra := range info.PriceData.OtherRatios {
        if ra != 1.0 && ra > 0 {
            baseQuota = int(float64(baseQuota) / ra)
        }
    }
    
    // 2. 应用新的 ratios
    result := float64(baseQuota)
    for _, ra := range ratios {
        if ra != 1.0 {
            result *= ra
        }
    }
    return int(result)
}
```

---

## 五、重试机制

### 5.1 重试决策逻辑

```go
// controller/relay.go:318-348
func shouldRetry(c *gin.Context, openaiErr *types.NewAPIError, retryTimes int) bool {
    if openaiErr == nil {
        return false
    }
    // 渠道亲和性失败后不重试
    if service.ShouldSkipRetryAfterChannelAffinityFailure(c) {
        return false
    }
    // 渠道错误可重试（连接失败等）
    if types.IsChannelError(openaiErr) {
        return true
    }
    // 明确标记跳过重试的错误
    if types.IsSkipRetryError(openaiErr) {
        return false
    }
    // 耗尽重试次数
    if retryTimes <= 0 {
        return false
    }
    // 指定渠道时不重试
    if _, ok := c.Get("specific_channel_id"); ok {
        return false
    }
    // 2xx 成功状态不重试
    code := openaiErr.StatusCode
    if code >= 200 && code < 300 {
        return false
    }
    // 根据配置判断是否重试
    return operation_setting.ShouldRetryByStatusCode(code)
}
```

### 5.2 状态码重试策略

| 状态码范围 | 默认行为 | 说明 |
|-----------|---------|------|
| 2xx | 不重试 | 成功响应 |
| 429 | 重试 | 限流，可切换渠道重试 |
| 5xx | 重试 | 服务端错误 |
| 400 | 不重试 | 客户端错误，重试无效 |
| 408 | 不重试 | 超时（Azure 特殊处理）|
| <100 或 >599 | 重试 | 非标准 HTTP 状态 |

---

## 六、计费系统

### 6.1 计费会话模式

```go
// service/billing.go:17-78

// PreConsumeBilling 创建计费会话并执行预扣费
func PreConsumeBilling(c *gin.Context, preConsumedQuota int, relayInfo *relaycommon.RelayInfo) *types.NewAPIError {
    session, apiErr := NewBillingSession(c, relayInfo, preConsumedQuota)
    if apiErr != nil {
        return apiErr
    }
    relayInfo.Billing = session  // 会话绑定到 RelayInfo
    return nil
}

// SettleBilling 结算（支持多退少补）
func SettleBilling(ctx *gin.Context, relayInfo *relaycommon.RelayInfo, actualQuota int) error {
    if relayInfo.Billing != nil {
        preConsumed := relayInfo.Billing.GetPreConsumedQuota()
        delta := actualQuota - preConsumed
        
        if delta > 0 {
            // 实际消耗 > 预扣费，补扣差额
            logger.LogInfo(ctx, fmt.Sprintf("预扣费后补扣费：%s", logger.FormatQuota(delta)))
        } else if delta < 0 {
            // 实际消耗 < 预扣费，返还差额
            logger.LogInfo(ctx, fmt.Sprintf("预扣费后返还扣费：%s", logger.FormatQuota(-delta)))
        }
        
        return relayInfo.Billing.Settle(actualQuota)
    }
    // 回退到旧路径
    return PostConsumeQuota(relayInfo, quotaDelta, relayInfo.FinalPreConsumedQuota, true)
}
```

### 6.2 计费流程

```
┌─────────────────────────────────────────────────────────────┐
│                        计费流程                              │
└─────────────────────────────────────────────────────────────┘

 ① 价格计算
    │   helper.ModelPriceHelper()
    │   ├── 获取模型基础价格
    │   ├── 应用模型倍率 (ModelRatio)
    │   ├── 应用分组倍率 (GroupRatio)
    │   └── 计算预扣额度
    │
    ▼
 ② 预扣费
    │   service.PreConsumeBilling()
    │   ├── 检查余额/订阅额度
    │   ├── 扣除预扣额度
    │   └── 创建 BillingSession
    │
    ▼
 ③ 请求执行（可能重试）
    │
    ▼
 ④ 结算
    │   service.SettleBilling()
    │   ├── 计算实际消耗
    │   ├── 多退少补
    │   └── 记录日志
    │
    ▼
 ⑤ 失败回滚
    │   defer: Billing.Refund()
    └── 返还预扣额度
```

---

## 七、多协议支持

### 7.1 支持的请求格式

```go
// types/relay_format.go
type RelayFormat string

const (
    RelayFormatOpenAI                   RelayFormat = "openai"
    RelayFormatOpenAIAudio              RelayFormat = "openai_audio"
    RelayFormatOpenAIImage              RelayFormat = "openai_image"
    RelayFormatOpenAIRealtime           RelayFormat = "openai_realtime"
    RelayFormatOpenAIResponses          RelayFormat = "openai_responses"
    RelayFormatOpenAIResponsesCompaction RelayFormat = "openai_responses_compaction"
    RelayFormatClaude                   RelayFormat = "claude"
    RelayFormatGemini                   RelayFormat = "gemini"
    RelayFormatEmbedding                RelayFormat = "embedding"
    RelayFormatRerank                   RelayFormat = "rerank"
    RelayFormatTask                     RelayFormat = "task"
    RelayFormatMjProxy                  RelayFormat = "mj_proxy"
)
```

### 7.2 请求转换链

```go
// relay/common/relay_info.go:575-617

// 记录请求格式转换历史
func (info *RelayInfo) AppendRequestConversion(format types.RelayFormat) {
    if len(info.RequestConversionChain) == 0 {
        info.RequestConversionChain = []types.RelayFormat{format}
        return
    }
    last := info.RequestConversionChain[len(info.RequestConversionChain)-1]
    if last == format {
        return
    }
    info.RequestConversionChain = append(info.RequestConversionChain, format)
}

// 获取最终请求格式
func (info *RelayInfo) GetFinalRequestRelayFormat() types.RelayFormat {
    if info.FinalRequestRelayFormat != "" {
        return info.FinalRequestRelayFormat
    }
    if n := len(info.RequestConversionChain); n > 0 {
        return info.RequestConversionChain[n-1]
    }
    return info.RelayFormat
}
```

**转换示例**：
- Claude SDK → OpenAI API: `["claude", "openai"]`
- Gemini SDK → OpenAI API: `["gemini", "openai"]`
- OpenAI → Claude API: `["openai", "claude"]`

---

## 八、关键设计决策

### 8.1 为什么使用 RelayInfo 而不是 Context？

| 方案 | 优点 | 缺点 |
|------|------|------|
| Context | 标准做法，跨层透传 | 类型不安全，异步处理时信息易丢失 |
| **RelayInfo（当前）** | 类型安全，显式依赖，异步友好 | 参数显式传递，略显冗长 |

**关键考量**：
- 异步任务（Task）需要持久化任务状态，Context 无法序列化
- 重试时需要保持完整的请求上下文
- 计费信息需要跨多个函数调用保持一致

### 8.2 适配器 vs. 函数式编程

```go
// 方案对比

// 方案A：函数式（每个提供商一组函数）
func OpenAIConvertRequest(...) (any, error)
func OpenAIDoRequest(...) (any, error)
func OpenAIDoResponse(...) (any, error)

// 方案B：适配器模式（当前采用）
type Adaptor interface { ... }
type OpenAIAdaptor struct{}
func (a *OpenAIAdaptor) ConvertRequest(...) (any, error)

// 选择方案B的原因：
// 1. 状态管理：适配器可持有状态（如 ChannelType、ResponseFormat）
// 2. 接口约束：编译时检查是否实现所有方法
// 3. 工厂模式：通过 apiType 直接获取对应适配器
```

### 8.3 流式响应处理

```go
// 流式处理采用逐行扫描 + SSE 格式输出
func OaiStreamHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
    // 1. 设置 SSE 头
    c.Writer.Header().Set("Content-Type", "text/event-stream")
    c.Writer.Header().Set("Cache-Control", "no-cache")
    c.Writer.Header().Set("Connection", "keep-alive")
    
    // 2. 逐行读取上游响应
    scanner := bufio.NewScanner(resp.Body)
    for scanner.Scan() {
        line := scanner.Text()
        
        // 3. 转换响应格式（如需要）
        transformed := transformStreamLine(line, info)
        
        // 4. 发送给客户端
        fmt.Fprintf(c.Writer, "data: %s\n\n", transformed)
        c.Writer.Flush()
        
        // 5. 统计 Usage
        usage.AddStreamChunk(line)
    }
    
    // 6. 发送结束标记
    fmt.Fprintf(c.Writer, "data: [DONE]\n\n")
    return usage, nil
}
```

---

## 九、扩展指南

### 9.1 添加新的上游提供商

1. **创建适配器文件**：`relay/channel/{provider}/adaptor.go`

```go
package myprovider

type Adaptor struct {
    ChannelType int
}

func (a *Adaptor) Init(info *relaycommon.RelayInfo) {
    a.ChannelType = info.ChannelType
}

func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
    return fmt.Sprintf("%s/v1/chat/completions", info.ChannelBaseUrl), nil
}

func (a *Adaptor) ConvertOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error) {
    // 如有需要，转换请求格式
    return request, nil
}

func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (usage any, err *types.NewAPIError) {
    // 处理响应，返回 usage 信息
    return
}
```

2. **注册到工厂**：`relay/relay_adaptor.go`

```go
func GetAdaptor(apiType int) channel.Adaptor {
    switch apiType {
    case constant.APITypeMyProvider:
        return &myprovider.Adaptor{}
    }
}
```

3. **定义常量**：`constant/channel_type.go`

```go
const (
    ChannelTypeMyProvider = 45
)
```

### 9.2 添加新的 RelayMode

1. **定义模式常量**：`relay/constant/relay_mode.go`

```go
const (
    RelayModeMyFeature = iota + 1
)
```

2. **添加路径映射**：`relay/constant/path_mapping.go`

```go
func Path2RelayMode(path string) int {
    switch {
    case strings.HasSuffix(path, "/my-feature"):
        return RelayModeMyFeature
    }
}
```

3. **实现处理器**：`relay/my_feature.go`

```go
func MyFeatureHelper(c *gin.Context, info *relaycommon.RelayInfo) *types.NewAPIError {
    // 获取适配器
    adaptor := GetAdaptor(info.ApiType)
    adaptor.Init(info)
    
    // 构建请求
    url, _ := adaptor.GetRequestURL(info)
    // ... 发送请求
    
    // 处理响应
    usage, err := adaptor.DoResponse(c, resp, info)
    
    // 结算
    service.SettleBilling(c, info, calculateQuota(usage))
    return err
}
```

4. **注册到 Controller**：`controller/relay.go`

```go
func relayHandler(c *gin.Context, info *relaycommon.RelayInfo) *types.NewAPIError {
    switch info.RelayMode {
    case relayconstant.RelayModeMyFeature:
        return relay.MyFeatureHelper(c, info)
    }
}
```

---

## 十、总结

Relay 架构的核心设计原则：

1. **统一抽象**：通过 `Adaptor` 接口屏蔽 40+ 家提供商的差异
2. **状态集中**：`RelayInfo` 承载完整请求上下文，支持同步/异步/重试场景
3. **可观测性**：详细的日志记录、错误分类、渠道健康检查
4. **计费精确**：预扣费 + 结算模式，支持多维度计费（Token/次数/参数）
5. **高可用性**：智能重试、负载均衡、渠道自动禁用

这种设计使得添加新的 AI 提供商或功能只需实现少量接口，而不会破坏现有代码，实现了良好的可扩展性和可维护性。
