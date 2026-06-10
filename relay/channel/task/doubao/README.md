# Doubao Seedance 视频生成 — 开发参考文档

> 适配器位置：`relay/channel/task/doubao/`
> Channel 类型：`ChannelTypeDoubaoVideo = 54`（也复用于 `ChannelTypeVolcEngine = 45`）
> 上游平台：火山引擎方舟（Volcengine Ark）`https://ark.cn-beijing.volces.com`
> API 范式：**异步 Task**（提交 → 后台轮询 → 完成时差额结算）

本文档面向后续在本模块上做扩展（新增模型、调整计费、对接新参数、排查问题）的开发者，描述整体架构、数据流、关键文件与易错点。

---

## 1. 模块定位与整体架构

Doubao 视频走的是 new-api 的 **Task（异步任务）** 通用框架，而非同步 chat/relay 路径。整体分层与调用链如下：

```
客户端                         new-api                                上游（火山方舟 Ark）
  │  POST /v1/video/generations  │                                      │
  ├─────────────────────────────►│ controller.RelayTask                 │
  │                              │   └─ relay.RelayTaskSubmit            │
  │                              │        ├─ ValidateRequestAndSetAction │
  │                              │        ├─ EstimateBilling（视频折扣） │
  │                              │        ├─ ModelPriceHelperPerCall     │
  │                              │        ├─ PreConsume（预扣费）        │
  │                              │        ├─ BuildRequestBody ──────────►│ POST /api/v3/contents/generations/tasks
  │                              │        └─ DoResponse ◄────────────────│  { "id": "<upstream_task_id>" }
  │  { id/task_id: task_xxxx } ◄─┤   └─ SettleBilling（结算预扣）        │
  │                              │   └─ model.Task 落库                  │
  │                              │                                      │
  │                              │ 【后台轮询，每 15s】                  │
  │                              │ service.TaskPollingLoop              │
  │                              │   └─ updateVideoSingleTask           │
  │                              │        ├─ FetchTask ─────────────────►│ GET .../tasks/<upstream_task_id>
  │                              │        ├─ ParseTaskResult ◄───────────│  { status, content.video_url, usage }
  │                              │        └─ settleTaskBillingOnComplete │
  │  GET /v1/video/generations/  │                                      │
  │      :task_id                ├─ relay.RelayTaskFetch                │
  │  { OpenAI Video 格式 } ◄──────┤   └─ ConvertToOpenAIVideo            │
```

**核心要点**：
- 客户端拿到的是 new-api 生成的**公开 task_id**（`task_xxxx`），上游真实 task_id 存在 `model.Task` 内部，不外泄。
- 提交时按**模型按次价格 × 分组倍率 × 视频折扣**做预扣费；任务成功后若上游回传了 `total_tokens`，会按 token **重算差额**（多退少补）。

---

## 2. 文件清单

### 本模块（`relay/channel/task/doubao/`）

| 文件 | 行数 | 职责 |
|------|------|------|
| `adaptor.go` | ~369 | `TaskAdaptor` 全部实现：请求/响应 DTO、URL/Header 构造、计费估算、请求体转换、响应解析、任务轮询、结果映射、OpenAI 格式转换 |
| `constants.go` | ~26 | 模型列表 `ModelList`、渠道名 `ChannelName`、视频输入折扣表 `videoInputRatioMap` 及 `GetVideoInputRatio` |

### 关键依赖（跨模块）

| 文件 | 作用 |
|------|------|
| `relay/channel/task/taskcommon/helpers.go` | `BaseBilling`（计费方法的空实现基类）、`UnmarshalMetadata`（metadata→结构体）、进度常量、代理 URL 构造 |
| `relay/channel/adapter.go` | `TaskAdaptor` 接口定义（适配器契约） |
| `relay/relay_adaptor.go` | 平台→适配器选择（`ChannelTypeDoubaoVideo/VolcEngine → &taskdoubao.TaskAdaptor{}`，约 155 行） |
| `relay/relay_task.go` | Task 提交主流程（验证、定价、预扣、发请求、解析） |
| `relay/common/relay_info.go` | `RelayInfo`、`TaskSubmitReq`、`TaskInfo` 等核心结构 |
| `relay/helper/price.go` | `ModelPriceHelperPerCall`（按次价格计算） |
| `controller/relay.go` | `RelayTask`（提交入口）、`RelayTaskFetch`（查询入口） |
| `controller/task_video.go` | 视频任务轮询时的单任务结算逻辑 |
| `service/task_polling.go` | `TaskPollingLoop`（15s 轮询）、`updateVideoTasks`、`settleTaskBillingOnComplete` |
| `service/task_billing.go` | `RecalculateTaskQuotaByTokens`（按 token 差额结算） |
| `constant/channel.go` | `ChannelTypeDoubaoVideo=54`、基础 URL、渠道名映射 |
| `router/video-router.go` | 视频生成路由注册 |
| `dto/openai_video.go` | OpenAI 兼容视频响应 `OpenAIVideo` |

---

## 3. 支持的模型与渠道配置

### 模型列表（`constants.go`）

```go
var ModelList = []string{
    "doubao-seedance-1-0-pro-250528",
    "doubao-seedance-1-0-lite-t2v",   // 文生视频
    "doubao-seedance-1-0-lite-i2v",   // 图生视频
    "doubao-seedance-1-5-pro-251215",
    "doubao-seedance-2-0-260128",      // 2.0 标准版
    "doubao-seedance-2-0-fast-260128", // 2.0 快速版
}

var ChannelName = "doubao-video"
```

### 渠道常量（`constant/channel.go`）

- `ChannelTypeDoubaoVideo = 54`，默认 baseURL `https://ark.cn-beijing.volces.com`，名称映射 `"DoubaoVideo"`。
- `ChannelTypeVolcEngine = 45` 共用同一适配器（`relay_adaptor.go` 中两者都返回 `taskdoubao.TaskAdaptor`）。

### 新增模型的步骤

1. 在 `ModelList` 追加模型名。
2. 若该模型有「含视频/不含视频」差异定价，在 `videoInputRatioMap` 增加折扣比率。
3. 在后台为该模型配置 `ModelRatio`（详见第 6 节计费）。

---

## 4. 请求 / 响应数据结构

### 4.1 上游请求体 `requestPayload`（`adaptor.go:43-62`）

所有可选标量字段遵循 **CLAUDE.md Rule 6**：使用指针类型（`*dto.IntValue` / `*dto.BoolValue`）+ `omitempty`，以保留显式零值语义（`0`/`false` 不会被静默丢弃）。

```go
type requestPayload struct {
    Model                 string         `json:"model"`
    Content               []ContentItem  `json:"content,omitempty"`        // 文本/图片/视频/音频混合内容
    CallbackURL           string         `json:"callback_url,omitempty"`
    ReturnLastFrame       *dto.BoolValue `json:"return_last_frame,omitempty"`
    ServiceTier           string         `json:"service_tier,omitempty"`
    ExecutionExpiresAfter *dto.IntValue  `json:"execution_expires_after,omitempty"`
    GenerateAudio         *dto.BoolValue `json:"generate_audio,omitempty"`
    Draft                 *dto.BoolValue `json:"draft,omitempty"`
    Tools                 []struct{ Type string `json:"type,omitempty"` } `json:"tools,omitempty"`
    Resolution            string         `json:"resolution,omitempty"`     // 分辨率
    Ratio                 string         `json:"ratio,omitempty"`          // 宽高比
    Duration              *dto.IntValue  `json:"duration,omitempty"`       // 时长（秒）
    Frames                *dto.IntValue  `json:"frames,omitempty"`
    Seed                  *dto.IntValue  `json:"seed,omitempty"`
    CameraFixed           *dto.BoolValue `json:"camera_fixed,omitempty"`
    Watermark             *dto.BoolValue `json:"watermark,omitempty"`
}
```

**完整字段参考**（取值/范围随模型版本而异，以火山方舟官方文档为准；下表为常见取值）：

| 字段 | JSON tag | 类型 | 必填 | 取值 / 范围 | 默认 | 说明 |
|------|----------|------|:---:|------------|------|------|
| `Model` | `model` | string | ✅ | 模型名 | — | 代码内部从 `req.Model` 填充；含模型映射逻辑（`BuildRequestBody`） |
| `Content` | `content` | `[]ContentItem` | ✅ | 见 4.2 | — | 文本 + 媒体（图/视频/音频）混合内容数组 |
| `CallbackURL` | `callback_url` | string | ❌ | URL | 不下发 | 任务状态变更时上游主动回调地址 |
| `ReturnLastFrame` | `return_last_frame` | `*bool` | ❌ | `true`/`false` | `false` | 是否额外返回视频尾帧图 |
| `ServiceTier` | `service_tier` | string | ❌ | `default` / `priority`（按需） | 不下发 | 服务等级 / 优先级队列 |
| `ExecutionExpiresAfter` | `execution_expires_after` | `*int` | ❌ | 秒（正整数） | 不下发 | 任务执行超时上限，超时上游主动失败 |
| `GenerateAudio` | `generate_audio` | `*bool` | ❌ | `true`/`false` | `false` | 是否生成配音/音效（Seedance 2.0 系列支持） |
| `Draft` | `draft` | `*bool` | ❌ | `true`/`false` | `false` | 草稿/预览模式（更快、低质，用于预览） |
| `Tools` | `tools` | `[]{type}` | ❌ | 如 `[{"type":"web_search"}]` | 不下发 | 启用上游工具（联网搜索等，2.0 系列） |
| `Resolution` | `resolution` | string | ❌ | `480p` / `720p` / `1080p`（模型相关，2.0 另有 `2k` 等） | 模型默认 | 输出分辨率档位 |
| `Ratio` | `ratio` | string | ❌ | `16:9` / `4:3` / `1:1` / `3:4` / `9:16` / `21:9` / `adaptive` | 模型默认 | 宽高比；`adaptive` 表示按参考图自适应 |
| `Duration` | `duration` | `*int` | ❌ | 秒，常见 `3`~`12`（模型相关，多为 `5`/`10`） | 模型默认 | 视频时长；可被顶层 `seconds` 覆盖（见 5.1.1） |
| `Frames` | `frames` | `*int` | ❌ | 帧数（与 fps × duration 关联） | 不下发 | 总帧数；与 duration 二选一表达时长的另一种方式 |
| `Seed` | `seed` | `*int` | ❌ | `-1` ~ `2^31-1`（`-1` 为随机） | `-1` | 随机种子；固定可复现结果 |
| `CameraFixed` | `camera_fixed` | `*bool` | ❌ | `true`/`false` | `false` | 是否固定镜头（禁止运镜） |
| `Watermark` | `watermark` | `*bool` | ❌ | `true`/`false` | 模型默认 | 是否添加平台水印 |

> ⚠️ 指针类型字段（`*dto.IntValue` / `*dto.BoolValue`）的「默认」列指**不传时 omitempty 不下发**，由上游决定真实默认；一旦客户端显式传零值（`0`/`false`）则强制下发（Rule 6）。

### 4.2 内容项 `ContentItem`（`adaptor.go:30-41`）

```go
type ContentItem struct {
    Type     string    `json:"type,omitempty"`      // "text" | "image_url" | "video_url" | "audio_url"
    Text     string    `json:"text,omitempty"`
    ImageURL *MediaURL `json:"image_url,omitempty"`
    VideoURL *MediaURL `json:"video_url,omitempty"`
    AudioURL *MediaURL `json:"audio_url,omitempty"`
    Role     string    `json:"role,omitempty"`
}
type MediaURL struct { URL string `json:"url,omitempty"` }
```

**字段说明**：

| 字段 | JSON tag | 取值 / 说明 |
|------|----------|------------|
| `Type` | `type` | `text`（文本提示词）/ `image_url`（图片）/ `video_url`（视频）/ `audio_url`（音频） |
| `Text` | `text` | 仅 `type==text` 时有效；最终会被 `convertToRequestPayload` 统一替换为顶层 `req.Prompt`（见 5.1.1） |
| `ImageURL` | `image_url` | `type==image_url` 时的图片地址；支持公网 URL 或 `data:image/...;base64,` 内联 |
| `VideoURL` | `video_url` | `type==video_url` 时的视频地址（视频续写/参考），命中视频输入折扣计费（见第 6 节） |
| `AudioURL` | `audio_url` | `type==audio_url` 时的音频地址（驱动音频，模型相关） |
| `Role` | `role` | 媒体项角色，图生视频/首尾帧场景使用：常见 `first_frame`（首帧）/ `last_frame`（尾帧）/ `reference_image`（参考图）。不传则由上游按位置默认处理 |

> `MediaURL.URL` 既可为公网可访问 URL，也可为 Base64 Data URL；具体支持格式与大小上限以官方文档为准。

### 4.3 提交响应 `responsePayload`（`adaptor.go:64-66`）

```go
type responsePayload struct {
    ID string `json:"id"` // 上游 task_id
}
```

### 4.4 任务状态响应 `responseTask`（`adaptor.go:68-97`）

```go
type responseTask struct {
    ID       string
    Model    string
    Status   string                       // pending|queued|processing|running|succeeded|failed
    Content  struct{ VideoURL string `json:"video_url"` }
    Seed, Duration, FramesPerSecond int
    Resolution, Ratio, ServiceTier  string
    Tools    []struct{ Type string }
    Usage    struct {
        CompletionTokens int `json:"completion_tokens"`
        TotalTokens      int `json:"total_tokens"`   // ★ 差额结算依据
        ToolUsage        struct{ WebSearch int `json:"web_search"` }
    }
    Error    struct{ Code, Message string }
    CreatedAt, UpdatedAt int64
}
```

> 上为精简示意，真实 JSON tag 见 `adaptor.go:68-97`：`FramesPerSecond` 的 tag 是 `framespersecond`（无下划线）、`Usage.ToolUsage` 的 tag 是 `tool_usage`、其内 `WebSearch` 为 `web_search`。`ParseTaskResult` 映射到内部 `TaskInfo` 时仅取 `Content.VideoURL`、`Usage.CompletionTokens`、`Usage.TotalTokens`、`Error.Message`（见 5.2）；其余字段（`Seed`/`Resolution`/`Ratio`/`Duration` 等）当前仅解析不回传客户端。

### 4.5 客户端顶层请求字段 `TaskSubmitReq`（`relay/common/relay_info.go:684`）

客户端 POST body 先被解析为通用的 `TaskSubmitReq`，再由 `convertToRequestPayload` 映射到 Doubao 的 `requestPayload`。**并非所有顶层字段都被 Doubao 消费**——下表标注每个字段在本适配器中的实际处理：

| 顶层字段 | JSON tag | 类型 | Doubao 是否消费 | 映射 / 说明 |
|---------|----------|------|:--------------:|------------|
| `Prompt` | `prompt` | string | ✅ | 唯一文本来源，无条件追加为 `content` 中的 `text` 项 |
| `Model` | `model` | string | ✅ | 填入 `requestPayload.Model`，经模型映射后下发 |
| `Images` | `images` | `[]string` | ✅ | 每个 URL 转成一条 `image_url` 类型的 `ContentItem`（图生视频参考图） |
| `Seconds` | `seconds` | string | ✅ | 可解析为正整数时**覆盖** `Duration`（OpenAI `seconds` 兼容字段） |
| `Metadata` | `metadata` | `map` | ✅ | 扩展参数总入口，JSON round-trip 映射进 `requestPayload`（见 5.1.1） |
| `Duration` | `duration` | int | ⚠️ **不消费** | `TaskSubmitReq` 会解析顶层 `duration`（兼容 int/string），但 `convertToRequestPayload` **未读取** `req.Duration`；要设时长须用 `seconds` 或 `metadata.duration` |
| `Image` | `image` | string | ❌ | 单图字段；Doubao 仅用 `Images`（复数），单图请放入 `images` 数组 |
| `Size` | `size` | string | ❌ | 未映射；分辨率请用 `metadata.resolution` |
| `Mode` | `mode` | string | ❌ | 未映射 |
| `InputReference` | `input_reference` | string | ❌ | 未映射（remix 场景由 `ResolveOriginTask` 另行处理） |

> ⚠️ **时长字段易错点**：顶层 `duration` 看似直观却被 Doubao 忽略。优先级为 `seconds`（顶层）> `metadata.duration`；顶层 `duration` 无效。若需统一支持顶层 `duration`，须在 `convertToRequestPayload` 中显式读取 `req.Duration`（当前未实现）。

---

## 5. 适配器方法详解（`TaskAdaptor`）

适配器嵌入 `taskcommon.BaseBilling`（提供计费方法的空实现），仅覆写需要定制的方法。

| 方法 | 行号 | 说明 |
|------|------|------|
| `Init` | 110 | 从 `RelayInfo` 取 `ChannelType` / `baseURL` / `apiKey` |
| `ValidateRequestAndSetAction` | 117 | 调 `ValidateBasicTaskRequest`，固定 action 为 `TaskActionGenerate` |
| `BuildRequestURL` | 123 | `{baseURL}/api/v3/contents/generations/tasks` |
| `BuildRequestHeader` | 128 | `Authorization: Bearer <apiKey>` + JSON 头 |
| `EstimateBilling` | 136 | **覆写 BaseBilling**：检测 metadata 含视频输入则返回 `{"video_input": ratio}` |
| `BuildRequestBody` | 179 | `TaskSubmitReq → requestPayload`，处理模型映射 |
| `DoRequest` | 202 | 委托 `channel.DoTaskApiRequest` |
| `DoResponse` | 207 | 解析上游 `id`，向客户端返回带公开 task_id 的 OpenAI Video 响应；返回上游 task_id 落库 |
| `FetchTask` | 238 | 轮询：`GET .../tasks/{task_id}` |
| `ParseTaskResult` | 306 | 上游 status → 内部 `TaskStatus`，成功时提取 video_url 与 usage tokens |
| `ConvertToOpenAIVideo` | 344 | 落库的 `model.Task` → OpenAI Video 格式（供客户端查询） |
| `GetModelList` / `GetChannelName` | 262/266 | 返回 `ModelList` / `ChannelName` |

### 5.1 请求体转换 `convertToRequestPayload`（`adaptor.go:270-304`）

关键逻辑顺序：
1. 把 `req.Images`（图生视频参考图）逐张转成 `image_url` 类型的 `ContentItem`。
2. 通过 `taskcommon.UnmarshalMetadata(metadata, &r)` 把客户端 `metadata` 反序列化进 `requestPayload`——这是 **resolution / ratio / duration / watermark 等扩展参数的入口**。
   - ⚠️ `UnmarshalMetadata` 会 `delete(metadata, "model")`，防止客户端用 metadata 覆盖模型名绕过计费。
3. 若 `req.Seconds`（OpenAI `seconds` 字段）可解析为正整数，覆盖 `Duration`。
4. 剔除 metadata 里可能带入的 `text` 项，统一用 `req.Prompt` 作为唯一 text content（避免重复/冲突）。

### 5.1.1 metadata 解析全流程与字段优先级 ★

`metadata`（`TaskSubmitReq.Metadata`，类型 `map[string]interface{}`）是客户端向 Doubao 透传扩展参数的**唯一通道**。`resolution`、`ratio`、`seed`、`watermark`、`camera_fixed`、`generate_audio`、`return_last_frame`、`tools`、`content` 等字段都只能经由 metadata 进入。它在代码里有**两个独立的读取点**：

**① 计费阶段（只读检测，不反序列化）** — `EstimateBilling → hasVideoInMetadata`（`adaptor.go:151-176`）
- 仅扫描 `metadata["content"]` 数组，判断是否存在 `type == "video_url"` 或带 `video_url` 字段的项。
- 命中则注入 `video_input` 折扣，**不构造** `requestPayload`，避免重复开销。

**② 请求体构造阶段（完整反序列化）** — `convertToRequestPayload → taskcommon.UnmarshalMetadata`（`helpers.go:16-30`）

`UnmarshalMetadata` 走 **JSON round-trip** 把 map 映射到结构体：
```go
func UnmarshalMetadata(metadata map[string]any, target any) error {
    if metadata == nil { return nil }          // nil 直接跳过
    delete(metadata, "model")                  // ★ 删除 model，防止覆盖模型名绕过计费
    metaBytes, _ := common.Marshal(metadata)   // map → JSON bytes
    return common.Unmarshal(metaBytes, target) // JSON bytes → *requestPayload
}
```
即：metadata 中**任意与 `requestPayload` JSON tag 同名的键都会被填入对应字段**；无法对应的键被忽略。

**字段优先级与覆盖关系（`convertToRequestPayload` 执行顺序）**

| 字段 | 来源与最终取值规则 |
|------|--------------------|
| `model` | 始终来自 `req.Model`；metadata 里的 `model` 被 `delete` 强制剔除（计费安全） |
| `content`（媒体项） | 先用 `req.Images` 填充 `image_url` 项；**随后 `UnmarshalMetadata` 若 metadata 含 `content` 键，会按 JSON slice 语义重置并覆盖整个 Content（包括前面填的 images）**。⚠️ 即「`req.Images` + `metadata.content` 二选一」，同时给会以 metadata.content 为准 |
| `content`（text 项） | **无条件**：最后 `lo.Reject` 剔除所有 `type=="text"` 项，再 append 一条 `req.Prompt`。故 metadata 里写的任何 text 都无效，prompt 永远取顶层 `req.Prompt` |
| `duration` | metadata 可设 `duration`；若顶层 `req.Seconds`（OpenAI `seconds` 字段）能解析为正整数，则**覆盖** metadata 的值。⚠️ 顶层 `req.Duration`（`duration` 字段）虽被 `TaskSubmitReq` 解析，但 `convertToRequestPayload` **不读取**，故无效（见 4.5） |
| `resolution` / `ratio` / `seed` / `watermark` / `camera_fixed` / `generate_audio` / `return_last_frame` / `tools` / `service_tier` 等 | **仅能**通过 metadata 传入，无顶层字段，无默认值（不传则 omitempty 不下发） |

**典型客户端请求示例**：
```json
POST /v1/video/generations
{
  "model": "doubao-seedance-2-0-260128",
  "prompt": "a cat running on the beach",
  "seconds": "5",
  "metadata": {
    "resolution": "1080p",
    "ratio": "16:9",
    "watermark": false,
    "seed": 42,
    "content": [
      { "type": "image_url", "image_url": { "url": "https://.../ref.jpg" } }
    ]
  }
}
```
解析结果：`model` 取顶层；`duration=5`（seconds 覆盖）；`resolution/ratio/watermark/seed` 来自 metadata；`content` = metadata 的 image_url 项 + 自动追加的 `{type:text, text:"a cat..."}`。

### 5.2 状态映射（`ParseTaskResult`，`adaptor.go:317-339`）

| 上游 status | 内部状态 | Progress | 备注 |
|-------------|----------|----------|------|
| `pending` / `queued` | `TaskStatusQueued` | `10%` | |
| `processing` / `running` | `TaskStatusInProgress` | `50%` | |
| `succeeded` | `TaskStatusSuccess` | `100%` | 提取 `video_url`、`CompletionTokens`、`TotalTokens` |
| `failed` | `TaskStatusFailure` | `100%` | 记录 `Error.Message` 为 Reason |
| 其他/未知 | `TaskStatusInProgress` | `30%` | 兜底当作处理中 |

---

## 6. 计费机制（重点）

Doubao 视频计费分为**两阶段**：提交时预扣 + 完成时差额重算。

### 6.1 计费模型：ModelRatio + 视频输入折扣

- 管理员在后台为模型配置 **ModelRatio**，按「**不含视频**」的较高单价设定。
  - 换算公式：`ModelRatio = 不含视频单价($/M) ÷ 2`（基于 `QuotaPerUnit = 500000`，即 $1 = 500000 quota）。
- 当请求**含视频输入**时，系统自动乘以 `videoInputRatioMap` 中的折扣比率，无需客户端干预。

官方价参考（截至本文编写时）：

| 模型 | 不含视频价 | 含视频价 | ModelRatio | 视频折扣 |
|------|-----------|----------|-----------|----------|
| `doubao-seedance-2-0-260128` | $7.7/M | $4.7/M | 3.85 | `28/46 ≈ 0.6087` |
| `doubao-seedance-2-0-fast-260128` | $5.6/M | $3.3/M | 2.8 | `22/37 ≈ 0.5946` |

> 折扣比率定义为「含视频单价 / 不含视频单价」。实测：标准版 ≈ 含视频价4.7÷不含视频价7.7 的近似分数 28/46；fast 同理 22/37。配置新模型时按官方实际价折算即可。

### 6.2 视频输入检测 `EstimateBilling` / `hasVideoInMetadata`（`adaptor.go:136-176`）

```go
func (a *TaskAdaptor) EstimateBilling(c, info) map[string]float64 {
    req, _ := relaycommon.GetTaskRequest(c)
    if hasVideoInMetadata(req.Metadata) {
        if ratio, ok := GetVideoInputRatio(info.OriginModelName); ok {
            return map[string]float64{"video_input": ratio}  // 注入 OtherRatio
        }
    }
    return nil
}
```

`hasVideoInMetadata` 直接扫描 `metadata["content"]` 数组里是否存在 `type == "video_url"` 或带 `video_url` 字段的项——避免提前构造完整 `requestPayload`。返回的 `{"video_input": ratio}` 进入 `RelayInfo.PriceData` 的 OtherRatios，参与预扣与重算。

### 6.3 预扣费（提交时）

- `relay_task.go` 提交流程 → `helper.ModelPriceHelperPerCall` 计算基础按次额度。
- 预扣额度 ≈ `基础模型价 × 分组倍率 × 视频折扣(OtherRatios 乘积)`。
- 提交时把分组倍率/OtherRatios **快照**写入 `task.PrivateData.BillingContext`（见下条，结算时复用）。

### 6.4 差额结算（完成时）

入口：`service/task_polling.go:543` `settleTaskBillingOnComplete`：

```go
func settleTaskBillingOnComplete(ctx, adaptor, task, taskResult) {
    if bc := task.PrivateData.BillingContext; bc != nil && bc.PerCallBilling {
        return // 按次计费任务不做差额结算
    }
    if actualQuota := adaptor.AdjustBillingOnComplete(task, taskResult); actualQuota > 0 {
        RecalculateTaskQuota(...)  // Doubao 用的是 BaseBilling 空实现，返回 0，走下一步
        return
    }
    if taskResult.TotalTokens > 0 {
        RecalculateTaskQuotaByTokens(ctx, task, taskResult.TotalTokens) // ★ Doubao 走这里
    }
}
```

`RecalculateTaskQuotaByTokens`（`service/task_billing.go:250`）核心公式：

```
actualQuota = totalTokens × modelRatio × finalGroupRatio × otherMultiplier
```

- **不读 `CompletionRatio`**——Doubao 视频按 `total_tokens` 直接计费，补全倍率与本路径无关。因此把这两个模型的 CompletionRatio 设为 0 是安全的，不影响预扣或结算。
- `modelRatio` 来自 `GetModelRatio`；若**未配置倍率或 ≤0**（即固定价格模式），直接 `return`，**不做** token 重算，保持预扣额度。
- `finalGroupRatio` **优先取提交时快照** `task.PrivateData.BillingContext.GroupRatio`，而非实时重查。原因（见代码注释 `task_billing.go:276-281`）：
  1. 防止提交后管理员把分组倍率从 0 改为非零造成反向计费；
  2. 提交时的 0 来自特殊组倍率 `GetGroupGroupRatio(userGroup, usingGroup)`，实时重查键不对称会回落到非零基础倍率，导致免费任务被重复计费。
- `otherMultiplier` 取快照里的 OtherRatios 乘积（仅计入 `!= 1.0 && > 0` 的比率，即视频折扣等）。
- 算出 `actualQuota` 后交 `RecalculateTaskQuota` 做多退少补。

### 6.5 失败退款

任务 `failed` 时，轮询逻辑（`controller/task_video.go`）调用 `model.IncreaseUserQuota` 退还预扣额度并记录退款日志。

---

## 7. 路由与控制器

### 路由（`router/video-router.go`）

```go
videoV1Router := router.Group("/v1")
videoV1Router.Use(middleware.RouteTag("relay"), middleware.TokenAuth(), middleware.Distribute())
{
    videoV1Router.POST("/video/generations", controller.RelayTask)       // 提交
    videoV1Router.GET("/video/generations/:task_id", controller.RelayTaskFetch) // 查询
    videoV1Router.POST("/videos/:video_id/remix", controller.RelayTask)  // remix

    // OpenAI 兼容别名
    videoV1Router.POST("/videos", controller.RelayTask)
    videoV1Router.GET("/videos/:task_id", controller.RelayTaskFetch)
}
```

### 提交处理 `controller.RelayTask`（`controller/relay.go`）

`relay.ResolveOriginTask`（remix 时基于已有任务）→ `relay.RelayTaskSubmit` → 成功后 `service.SettleBilling` → 创建 `model.Task` 记录并落库。

---

## 8. 异步轮询机制

### 主循环 `TaskPollingLoop`（`service/task_polling.go:91`）

- 每 **15s** 执行一次。
- 先 `sweepTimedOutTasks` 清理超时任务（按 `constant.TaskTimeoutMinutes`，超时标记失败 + 退款）。
- `model.GetAllUnFinishSyncTasks` 取所有未完成任务，按 platform 分发到 `updateVideoTasks`。

### 批量更新 `updateVideoTasks`（`service/task_polling.go:291`）

- 按渠道取适配器，逐任务 `updateVideoSingleTask`。
- **每个任务之间 sleep 1s**，避免触发上游限流。

### 单任务更新 `updateVideoSingleTask`

1. `adaptor.FetchTask` → `GET .../tasks/{upstream_task_id}`。
2. `adaptor.ParseTaskResult` → 状态映射。
3. 成功：`settleTaskBillingOnComplete` 做差额结算。
4. 失败：退款。
5. `task.Update()` 持久化最新状态/进度。

---

## 9. 新增 / 扩展开发指引（Checklist）

### 新增一个 Doubao Seedance 模型
- [ ] `constants.go`：`ModelList` 追加模型名。
- [ ] 若有含/不含视频差异价：`videoInputRatioMap` 加折扣比率。
- [ ] 后台为模型配置 `ModelRatio`（不含视频单价 ÷ 2）。
- [ ] 可选：CompletionRatio 设 0（视频路径不读取，安全）。

### 新增一个上游参数（如新的生成选项）
- [ ] `requestPayload` 增加字段，**可选标量用 `*dto.IntValue`/`*dto.BoolValue` + omitempty**（Rule 6）。
- [ ] 客户端通过 `metadata` 传入，`UnmarshalMetadata` 自动映射，无需改转换代码（除非需要特殊默认值/校验）。
- [ ] 若该参数影响计费，评估是否需要新增 OtherRatio。

### 新增一个上游状态值
- [ ] `ParseTaskResult` 的 `switch` 增加 case，映射到合适的 `TaskStatus` 与 Progress。

### 接入新的火山引擎区域/endpoint
- [ ] `constant/channel.go` 调整 baseURL，或由渠道配置 `ChannelBaseUrl` 覆盖（`Init` 已读取）。

---

## 10. 易错点与注意事项

1. **CompletionRatio 与本渠道无关**：差额结算只用 `total_tokens × ModelRatio × GroupRatio × OtherMultiplier`。不要误以为设置补全倍率会影响视频计费。
2. **固定价格 vs 倍率**：若模型走「固定按次价格」（未配置 ModelRatio 或 ≤0），`RecalculateTaskQuotaByTokens` 会直接返回、**不重算**，预扣即最终额度。需要 token 重算必须配置 ModelRatio。
3. **分组倍率必须用快照**：结算时务必读 `BillingContext.GroupRatio` 而非实时重查，否则免费组/特殊组会被错误重复计费（详见 6.4）。
4. **metadata 不能覆盖 model**：`UnmarshalMetadata` 已 `delete(metadata,"model")`，新增类似敏感字段时注意同样防护。
5. **公开 task_id ≠ 上游 task_id**：对外只暴露 `info.PublicTaskID`（`task_xxxx`），上游 ID 仅内部存储与轮询使用。
6. **指针标量字段**：所有可选请求参数遵循 Rule 6，零值（0/false）必须能显式下发，禁止用非指针标量 + omitempty。
7. **轮询限流**：单任务间已有 1s 间隔；若批量任务量大需关注上游 QPS 限制。
8. **VolcEngine 共用适配器**：修改本适配器会同时影响 `ChannelTypeVolcEngine(45)`，回归时两个渠道都要覆盖。
9. **JSON 必须走 `common.*`**：序列化/反序列化统一用 `common.Marshal/Unmarshal`（Rule 1），勿直接 `encoding/json`。

---

## 11. 相关文档

- `pkg/billingexpr/expr.md` — 表达式计费系统（若后续 Doubao 接入动态/分档计费需阅读）。
- `doubao-seedance-billing-check.md`（项目根目录）— 计费核实任务的背景记录与官方价对照。
- 项目 `CLAUDE.md` — Rule 1（JSON）、Rule 2（多数据库）、Rule 6（请求 DTO 零值）、Rule 7（计费表达式）。
