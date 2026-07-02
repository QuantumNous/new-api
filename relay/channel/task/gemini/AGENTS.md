<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-07-02 | Updated: 2026-07-02 -->

# relay/channel/task/gemini

## Purpose

Google Gemini 异步视频生成适配器，对接 Veo 系列模型（`veo-3.0-generate-001`、`veo-3.0-fast-generate-001`、`veo-3.1-generate-preview`、`veo-3.1-fast-generate-preview`）。上游为 Gemini `predictLongRunning` 长运行接口（`POST /<version>/models/<model>:predictLongRunning`），返回 operation name；轮询走 Gemini operations API（`GET /<version>/<operation_name>`），完成后从 `response.generateVideoResponse.generatedVideos[0].video.uri` 取视频地址。鉴权用 `x-goog-api-key` 头（不是 `Authorization: Bearer`）。入站使用 new-api 通用 `TaskSubmitReq`（`relaycommon.ValidateBasicTaskRequest` 解析），支持 multipart 上传首帧图像（`ExtractMultipartImage`）。

**Operation name 本地编码**：`DoResponse` 把上游 operation name 经 `taskcommon.EncodeLocalTaskID` 编码后作为 task_id 存储，`FetchTask` 解码回原 name 再拼 operations URL；客户端永远看不到原始 `models/.../operations/...` 字符串。**非白标渠道**：成功任务的视频 URI 直接放进 `TaskInfo.RemoteUrl`，不经代理。本目录的 Veo DTO 与 image 解析工具也被 `relay/channel/task/vertex/` 复用（Veo on Vertex AI 走相同的 wire format）。

## Key Files

| File | Description |
|------|-------------|
| `adaptor.go` | `TaskAdaptor` 主实现。嵌入 `taskcommon.BaseBilling`。覆盖方法含 `ValidateRequestAndSetAction`（`ValidateBasicTaskRequest`，注意默认 action 是 `TaskActionTextGenerate` 而非 Generate，运行中若检测到图像输入会被改成 `TaskActionGenerate`）、`BuildRequestURL`（用 `model_setting.GetGeminiVersionSetting` 决定 API 版本路径）、`BuildRequestHeader`（`x-goog-api-key`）、`BuildRequestBody`（构造 `VeoRequestPayload`，含图像 multipart/URL 解析、metadata → `VeoParameters` 合并、duration/resolution/aspectRatio 默认值填充）、`DoResponse`（解析 `submitResponse.Name` + `EncodeLocalTaskID` 编码）、`FetchTask`（`DecodeLocalTaskID` 还原 operation name + 拼 operations URL）、`ParseTaskResult`（解析 `operationResponse` 的 `done`/`error`/`response`）、`ConvertToOpenAIVideo`（从 operation name 用正则提取真实模型名）、`EstimateBilling`（按时长 + 分辨率返回 OtherRatios） |
| `billing.go` | 纯计费辅助函数（无 IO）。`ParseVeoDurationSeconds` / `ParseVeoResolution`（从 metadata 提取）、`ResolveVeoDuration` / `ResolveVeoResolution`（优先级解析：metadata → std 字段 → 默认值）、`SizeToVeoResolution` / `SizeToVeoAspectRatio`（`WxH` → Veo 标签）、`VeoResolutionRatio`（4K 价格倍率，按 Vertex AI 官方定价：veo-3.1-generate 1.5x、veo-3.1-fast-generate ~2.333x） |
| `dto.go` | Veo 共享 DTO。`VeoImageInput`、`VeoInstance`、`VeoParameters`（含 `SampleCount`/`DurationSeconds`/`AspectRatio`/`Resolution`/`NegativePrompt`/`PersonGeneration`/`StorageUri`/`CompressionQuality`/`ResizeMode`/`Seed`/`GenerateAudio`）、`VeoRequestPayload`、`submitResponse`（`Name`）、`operationResponse`（含 `done`/`error`/`response.generateVideoResponse.generatedVideos[].video.uri`） |
| `image.go` | 图像输入解析。`ExtractMultipartImage`（从 multipart form `input_reference` 字段读首帧图，20MB 上限，转 base64 + 探测 MIME）、`ParseImageInput`（从字符串解析：data URI 或 raw base64）、`parseDataURI`（解析 `data:image/png;base64,...` 格式） |

## For AI Agents

### Working In This Directory

- **嵌入 `taskcommon.BaseBilling`**：获得默认三段式计费；自定义 `EstimateBilling` 返回 `{"seconds": <dur>, "resolution": <ratio>}`。
- **入站是 `TaskSubmitReq`，非 seedance `content[]`**：调用 `relaycommon.ValidateBasicTaskRequest`；默认 action 是 `TaskActionTextGenerate`，`BuildRequestBody` 检测到 multipart 或 `req.Images[0]` 图像输入后改为 `TaskActionGenerate`。
- **图像输入三路径**（优先级递减）：multipart `input_reference` 文件（`ExtractMultipartImage`）> `req.Images[0]` 字符串（`ParseImageInput`：data URI 或 raw base64）> 无图像纯文生视频。`ParseImageInput` 当前**不支持** HTTP URL 下载（代码中有 TODO 注释）。
- **API 版本路由**：`BuildRequestURL` 与 `FetchTask` 都用 `model_setting.GetGeminiVersionSetting(modelName)` 决定 URL 中的版本路径；`FetchTask` 用 `"default"` 作为版本查询 key（因为 task_id 已含完整 operation name，只需 baseURL + 版本前缀）。
- **Operation name 编码**：上游返回 `models/<model>/operations/<id>`，本适配器经 `taskcommon.EncodeLocalTaskID` 编码后作为 task_id 持久化；`FetchTask` 与 `ConvertToOpenAIVideo` 用 `DecodeLocalTaskID` 还原。客户端永远看不到原始 name。
- **`ConvertToOpenAIVideo` 不返回 URL**：从 `task.Data` 不解析视频 URI（视频地址在 `ParseTaskResult` 阶段已写入 `TaskInfo.RemoteUrl`，由框架存储）。仅用正则 `modelRe` 从 operation name 提取真实模型名（兜底 `veo-3.0-generate-001`）。
- **计费 `EstimateBilling`**：
  - 时长来自 `ResolveVeoDuration`（优先级：`metadata.durationSeconds` → `req.Duration` → `req.Seconds` → 默认 8 秒）；
  - 分辨率倍率来自 `VeoResolutionRatio`（4K 才有非 1.0 倍率，按模型区分）；
  - 返回 `map[string]float64{"seconds": <dur>, "resolution": <ratio>}`。
- **状态映射 `ParseTaskResult`**：`op.Error.Message` 非空 → Failure；`!op.Done` → InProgress（50%）；`op.Done` 且无 error → Success（取 `generateVideoResponse.generatedVideos[0].video.uri`）。
- **非白标**：不在 `taskcommon.whitelabelChannels` 注册；视频 URI 直接返回，错误信息不经 `ScrubBrandedText`。
- **Rule 1**：JSON 走 `common.Marshal` / `common.Unmarshal`。
- **无 202-gate 需求**：Gemini `predictLongRunning` 返回 200 + operation name，poll 返回 200。

### Testing Requirements

- 目录无 `_test.go` 文件。
- `go build ./relay/channel/task/gemini/...` 必须通过。
- `go test ./relay/channel/task/...` 不会覆盖本目录。
- 修改 `VeoResolutionRatio` 时建议补单测覆盖 4K 倍率（按 Vertex AI 官方定价校对）。
- 建议手测：提交 veo-3.0-generate-001 任务，验证 operation name 编码/解码、InProgress → Success 转换。

### Common Patterns

- `billing.go` 是纯函数模块，无 IO，便于在 vertex 适配器或单测中复用。
- 添加 Veo 新模型：更新 `GetModelList` 返回的 slice；若新模型支持 4K 且定价不同，更新 `VeoResolutionRatio`。
- Veo DTO（`dto.go`）与 image 工具（`image.go`）被 `relay/channel/task/vertex/` 复用；修改这些文件需同步检查 vertex 适配器。
- `VeoInstance` 中有 TODO 注释：`referenceImages`（最多 3 张风格/asset 引用）与 `lastFrame`（首尾帧插值，Veo 3.1）尚未支持。

## Dependencies

### Internal

- `github.com/QuantumNous/new-api/common` — `Marshal` / `Unmarshal`、`GetTimestamp`
- `github.com/QuantumNous/new-api/constant` — `TaskActionTextGenerate`、`TaskActionGenerate`
- `github.com/QuantumNous/new-api/dto` — `NewOpenAIVideo`、`TaskError`
- `github.com/QuantumNous/new-api/model` — `Task`、`TaskStatus*`
- `github.com/QuantumNous/new-api/relay/channel` — `DoTaskApiRequest`
- `taskcommon "github.com/QuantumNous/new-api/relay/channel/task/taskcommon"` — `BaseBilling`、`EncodeLocalTaskID`、`DecodeLocalTaskID`、`UnmarshalMetadata`
- `relaycommon "github.com/QuantumNous/new-api/relay/common"` — `RelayInfo`、`TaskSubmitReq`、`TaskInfo`、`ValidateBasicTaskRequest`
- `github.com/QuantumNous/new-api/service` — `TaskErrorWrapper`、`GetHttpClientWithProxy`
- `github.com/QuantumNous/new-api/setting/model_setting` — `GetGeminiVersionSetting`

### External

- `bytes`、`encoding/base64`、`fmt`、`io`、`net/http`、`regexp`、`strconv`、`strings`、`time` — 标准库
- `github.com/gin-gonic/gin` — context
- `github.com/pkg/errors` — `errors.Wrap`

<!-- MANUAL: -->
