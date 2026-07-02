<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-07-02 | Updated: 2026-07-02 -->

# relay/channel/task/doubao

## Purpose

豆包 / 火山引擎 Ark Seedance 视频生成适配器。上游为火山引擎 Ark 异步任务接口（`POST /api/v3/contents/generations/tasks` 创建、`GET` 同 URL + `/{id}` 轮询）。**入站格式已切换为官方 seedance `content[]`**（`taskcommon.BindSeedanceRequest` 解析），不再是旧的 prompt/images/metadata 入参形态。`content[]` 数组直接透传上游（Ark wire format 与官方 seedance schema 一致），适配器仅做：模型名映射、把 `*int`/`*bool` 指针转换成 Ark 的 `dto.IntValue`/`dto.BoolValue` 包装类型、合并豆包私有扩展字段（`service_tier`、`execution_expires_after`、`draft`、`tools`）。

**视频输入折扣**是本渠道独有的计费逻辑：当客户端 content[] 中含 `video_url` 项时，`EstimateBilling` 通过 `GetVideoInputRatio(modelName)` 查表返回折扣倍率（管理员应将 ModelRatio 设为"不含视频"的较高费率，系统检测到视频输入时自动乘以折扣）。鉴权为 `Bearer <apiKey>`。**非白标渠道**：成功任务的 `content.video_url` 直接返回给客户端，不经代理。

## Key Files

| File | Description |
|------|-------------|
| `adaptor.go` | `TaskAdaptor` 主实现。嵌入 `taskcommon.BaseBilling`。定义 `ContentItem`/`MediaURL`（别名到 `dto.SeedanceContentItem`/`dto.SeedanceURLObject`）、`toolItem`（Ark 私有 `tools[]` 扩展）、`requestPayload`（上游 wire body，标量用 `dto.IntValue`/`BoolValue` 包装 + `omitempty` 遵循 Rule 5）、`responsePayload`/`responseTask`、`doubaoExtensions`（仅豆包支持的 seedance 扩展字段）。覆盖方法含 `ValidateRequestAndSetAction`（`BindSeedanceRequest`）、`BuildRequestBody`（一次性解码官方字段 + 扩展字段，调 `buildDoubaoCreateRequest` 纯函数）、`EstimateBilling`（视频输入折扣）、`ParseTaskResult`（解析 `usage.completion_tokens`/`total_tokens` 用于按倍率计费）、`ConvertToOpenAIVideo`。还有 `toIntValue`/`toBoolValue` 指针转换工具 |
| `constants.go` | `ChannelName = "doubao-video"`、`ModelList`（6 个 doubao-seedance 模型）、`videoInputRatioMap`（视频输入折扣表，目前仅 `doubao-seedance-2-0-260128` ~0.6087、`doubao-seedance-2-0-fast-260128` ~0.5946）、`GetVideoInputRatio` 查询函数 |
| `adaptor_test.go` | adaptor 与映射函数测试 |

## For AI Agents

### Working In This Directory

- **嵌入 `taskcommon.BaseBilling`**：获得默认 `AdjustBillingOnSubmit` / `AdjustBillingOnComplete`；自定义 `EstimateBilling` 仅用于视频输入折扣。
- **入站 `BindSeedanceRequest`（seedance 系 SOP）**：`ValidateRequestAndSetAction` 调用 `taskcommon.BindSeedanceRequest(c, info, constant.TaskActionGenerate)` 解析官方 `content[]` 并缓存到 gin context（key `seedance_request`）。**没有**渠道私有的取值校验逻辑（不像 blockrunseedance 有 `validateSeedanceValues`）。
- **请求映射 `buildDoubaoCreateRequest`（纯函数）**：从 `dto.SeedanceVideoRequest` + `doubaoExtensions` 构造 `requestPayload`。要点：
  - `Content` 数组直接透传（`seedReq.Content`），因为 Ark wire format 与官方 seedance schema 一致；
  - `*int` / `*bool` 指针通过 `toIntValue` / `toBoolValue` 转换成 Ark 的 `dto.IntValue` / `dto.BoolValue` 包装类型；
  - 豆包私有扩展（`service_tier`、`execution_expires_after`、`draft`、`tools`）从同一 JSON body 解析后填入对应字段。
- **`BuildRequestBody` 单次解码**：用匿名 struct 嵌入 `dto.SeedanceVideoRequest` + `doubaoExtensions` 一次 `common.UnmarshalBodyReusable` 同时拿到官方字段和扩展字段。
- **模型名映射**：`info.IsModelMapped` 为 true 时用 `info.UpstreamModelName` 覆盖 `body.Model`，否则反向把 `body.Model` 写回 `info.UpstreamModelName`（供后续 `EstimateBilling` 使用）。
- **视频输入折扣 `EstimateBilling`**：
  - 通过 `taskcommon.GetSeedanceRequest(c)` 复用 `BindSeedanceRequest` 已解析的请求（**不重复解码 body**）；
  - 仅当 `seedReq.Videos()` 非空时查表，键是 **`info.UpstreamModelName`**（不是客户端别名 `OriginModelName`，因为折扣表只有真实模型名）；
  - 返回 `map[string]float64{"video_input": ratio}`，框架会乘进最终价格。
- **计费 token**：`ParseTaskResult` 在 `succeeded` 状态填 `taskResult.CompletionTokens` / `TotalTokens`（从上游 `usage` 解析），框架按倍率结算。
- **状态映射**：`pending/queued` → Queued；`processing/running` → InProgress；`succeeded` → Success（填 `content.video_url` + usage）；`failed` → Failure（填 `error.message`）。
- **非白标**：不在 `taskcommon.whitelabelChannels` 注册；`ConvertToOpenAIVideo` 直接把 `dResp.Content.VideoURL` 写到 `metadata.url`，**不**调 `task.GetResultURL()` 代理，错误信息也**不**经 `ScrubBrandedText`。
- **Rule 1**：所有 JSON 走 `common.Marshal` / `common.Unmarshal`。无 URL `&` 需求，无需 `MarshalNoHTMLEscape`。
- **Rule 5**：`requestPayload` 标量字段用 `*dto.IntValue` / `*dto.BoolValue` + `omitempty`。
- **无 202-gate 需求**：Ark submit 返回 200 + id，poll 返回 200。

### Testing Requirements

- `adaptor_test.go` 已存在。
- `go test ./relay/channel/task/doubao/...` 必须通过。
- `go build ./...` 跑全量编译。
- 修改 `videoInputRatioMap` 时务必跑全链路：建一个含 video_url 的请求，验证最终价格 = ModelRatio × video_input 折扣。

### Common Patterns

- 新增模型：更新 `constants.go` 的 `ModelList`；若该模型支持视频输入折扣，加进 `videoInputRatioMap` 并更新测试。
- 新增豆包私有扩展字段：扩 `doubaoExtensions` struct + `requestPayload` 字段 + `buildDoubaoCreateRequest` 映射；遵守 Rule 5。
- 添加取值校验：在 `ValidateRequestAndSetAction` 的 `BindSeedanceRequest` 之后追加，参考 `blockrunseedance/` 的 `validateSeedanceValues` 模式。

## Dependencies

### Internal

- `github.com/QuantumNous/new-api/common` — `Marshal` / `Unmarshal` / `UnmarshalBodyReusable`
- `github.com/QuantumNous/new-api/constant` — `TaskActionGenerate`
- `github.com/QuantumNous/new-api/dto` — `SeedanceVideoRequest`、`SeedanceContentItem`、`SeedanceURLObject`、`IntValue`、`BoolValue`、`NewOpenAIVideo`、`OpenAIVideoError`、`TaskError`
- `github.com/QuantumNous/new-api/model` — `Task`、`TaskStatus*`
- `github.com/QuantumNous/new-api/relay/channel` — `DoTaskApiRequest`
- `github.com/QuantumNous/new-api/relay/channel/task/taskcommon` — `BaseBilling`、`BindSeedanceRequest`、`GetSeedanceRequest`
- `relaycommon "github.com/QuantumNous/new-api/relay/common"` — `RelayInfo`、`TaskInfo`
- `github.com/QuantumNous/new-api/service` — `TaskErrorWrapper`、`TaskErrorWrapperLocal`、`GetHttpClientWithProxy`

### External

- `bytes`、`fmt`、`io`、`net/http`、`time` — 标准库
- `github.com/gin-gonic/gin` — context
- `github.com/pkg/errors` — `errors.Wrap` / `Wrapf`

<!-- MANUAL: -->
