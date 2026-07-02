<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-07-02 | Updated: 2026-07-02 -->

# relay/channel/task/vertex

## Purpose

Google Vertex AI 异步视频生成适配器（Veo 系列），对应 `constant.ChannelTypeVertex`。实现 `channel.TaskAdaptor` 接口。**关键特性：(1) 鉴权用 ADC 服务账号 JSON → OAuth2 access token**（API key 字段存的是 service account JSON credentials，`BuildRequestHeader` / `FetchTask` 都先 `vertexcore.AcquireAccessToken` 换 Bearer token）；(2) **上游 task ID 是长格式 operation name**（`projects/{project}/locations/{region}/models/{model}/operations/{id}`），本适配器用 `taskcommon.EncodeLocalTaskID` base64 编码后存为本地 task ID，`FetchTask` 时 `DecodeLocalTaskID` 还原，并从 operation name 用正则反解 region/project/model 重建 fetch URL；(3) **`EstimateBilling` 自定义**（按 Veo 的 seconds + resolution 维度算 ratios）；(4) **结果视频是 base64 内联**（`data:video/mp4;base64,...`，非可下载 URL），走代理 URL 后客户端通过 proxy 端点拉取。

## Key Files

| File | Description |
|------|-------------|
| `adaptor.go` | 全部实现集中在单文件。`TaskAdaptor` 嵌入 `taskcommon.BaseBilling`（**`EstimateBilling` 被覆盖**）；`ValidateRequestAndSetAction` 用 `relaycommon.ValidateBasicTaskRequest` + `TaskActionTextGenerate`（i2v 在 `BuildRequestBody` 里探测到 image 后动态改 action）；`BuildRequestURL` 用 `vertexcore.BuildGoogleModelURL` 拼 `predictLongRunning` 端点；`BuildRequestBody` 调 `geminitask.ExtractMultipartImage` / `ParseImageInput` 探测图片、用 `taskcommon.UnmarshalMetadata` 反序列化 `VeoParameters`；`DoResponse` 把上游 operation name 用 `EncodeLocalTaskID` 编码成本地 task ID；`ParseTaskResult` 处理 `operationResponse`，成功时从 `response.videos[0].bytesBase64Encoded` 拼 `data:` URI；`ConvertToOpenAIVideo` 从 `task.GetUpstreamTaskID()` 拿真实 operation name、反解出 model name 填入响应；含三个正则辅助函数 `extractRegionFromOperationName` / `extractModelFromOperationName` / `extractProjectFromOperationName` |

## For AI Agents

### Working In This Directory

- **复用 gemini task 与 vertex core 两个包**：本适配器**不自己重新实现** Veo 的请求体构造与 duration/resolution 解析逻辑——直接复用 `relay/channel/task/gemini`（`geminitask.VeoInstance` / `VeoParameters` / `VeoRequestPayload` / `ResolveVeoDuration` / `ResolveVeoResolution` / `VeoResolutionRatio` / `SizeToVeoResolution` / `SizeToVeoAspectRatio` / `ExtractMultipartImage` / `ParseImageInput`）与 `relay/channel/vertex`（`vertexcore.Credentials` / `AcquireAccessToken` / `BuildGoogleModelURL` / `GetModelRegion` / `DefaultAPIVersion`）。修改 Veo 相关逻辑时，gemini task 路径可能也需要同步改（gemini task 是兄弟适配器，同样用 Veo）。
- **operation name 是本地 task ID**：上游返回的 `name` 是完整 operation 路径（`projects/.../locations/.../models/.../operations/...`），存为本地 task ID 前用 `taskcommon.EncodeLocalTaskID` base64 (RawURL) 编码。`FetchTask` 时 `DecodeLocalTaskID` 还原。`ConvertToOpenAIVideo` 走 `task.GetUpstreamTaskID()`（而非 `task.TaskID`，后者已是公开 `task_xxxx` 格式），再反解出 model name。
- **region/project/model 从 operation name 反解**：`FetchTask` 不能用 submit 时的 URL（fetch 端点路径不同），需要从 operation name 用正则 `regionRe`/`modelRe`/`projectRe` 提取 region/project/modelName，再 `vertexcore.BuildGoogleModelURL` 拼 `fetchPredictOperation` 端点。region 反解失败默认 `us-central1`。
- **`EstimateBilling` 自定义（覆盖 BaseBilling）**：返回 `{seconds, resolution}` 两个 ratio 维度，数值由 gemini task 的 `ResolveVeoDuration` / `ResolveVeoResolution` / `VeoResolutionRatio` 计算。
- **i2v action 动态切换**：`ValidateRequestAndSetAction` 默认设 `TaskActionTextGenerate`；`BuildRequestBody` 里探测到 multipart image 或 `req.Images` 非空时，把 `info.Action` 改为 `TaskActionGenerate`。
- **结果视频是 base64 data URI**：`ParseTaskResult` 把 `bytesBase64Encoded` + `mimeType`/`encoding` 拼成 `data:video/mp4;base64,...` 存入 `taskInfo.Url`。`ConvertToOpenAIVideo` 检查 `GetResultURL()` 是否以 `data:` 开头，是则填入 metadata url。客户端通过 `/v1/videos/{task_id}/content` 代理端点拉取实际视频字节。
- **MIME 兜底链**：`ParseTaskResult` 有三档兜底——`response.videos[0]` → `response.bytesBase64Encoded` → `response.video`，encoding 字段不含 `/` 时前缀加 `video/`。修改时三档都要保持。
- **Rule 1（JSON）**：所有 marshal/unmarshal 走 `common.*`。

### Testing Requirements

- `go build ./relay/channel/task/vertex/...` 必须通过
- 当前目录无独立 `_test.go` 文件
- 改 Veo 请求/响应字段时，同步检查 `relay/channel/task/gemini`（兄弟适配器）是否需要一起改
- 手动验证：ADC token 获取、operation name 编解码循环、base64 data URI 拼接

### Common Patterns

```go
// 鉴权：ADC JSON → access token
adc := &vertexcore.Credentials{}
common.Unmarshal([]byte(a.apiKey), adc)
token, err := vertexcore.AcquireAccessToken(*adc, proxy)
req.Header.Set("Authorization", "Bearer "+token)
req.Header.Set("x-goog-user-project", adc.ProjectID)

// operation name ↔ 本地 task ID 的 base64 编解码
localID := taskcommon.EncodeLocalTaskID(s.Name)       // submit 时
upstreamName, _ := taskcommon.DecodeLocalTaskID(taskID) // fetch 时

// 从 operation name 反解 region/project/model 重建 fetch URL
project := extractProjectFromOperationName(upstreamName)
region := extractRegionFromOperationName(upstreamName)  // 失败默认 us-central1
modelName := extractModelFromOperationName(upstreamName)
url, _ := vertexcore.BuildGoogleModelURL(baseURL, vertexcore.DefaultAPIVersion, project, region, modelName, "fetchPredictOperation")

// 结果 base64 data URI（三档兜底）
if v0.BytesBase64Encoded != "" {
    ti.Url = "data:" + mime + ";base64," + v0.BytesBase64Encoded
}
```

## Dependencies

### Internal

- `github.com/QuantumNous/new-api/common` — `Marshal` / `Unmarshal`（CLAUDE.md Rule 1）
- `github.com/QuantumNous/new-api/constant` — `TaskActionTextGenerate` / `TaskActionGenerate`
- `github.com/QuantumNous/new-api/dto` — `TaskError` / `NewOpenAIVideo`
- `github.com/QuantumNous/new-api/model` — `Task` / `TaskStatus*`
- `github.com/QuantumNous/new-api/relay/channel` — `DoTaskApiRequest`
- `geminitask "github.com/QuantumNous/new-api/relay/channel/task/gemini"` — **复用** Veo 请求/响应/参数结构与解析辅助（`VeoInstance` / `VeoParameters` / `VeoRequestPayload` / `ResolveVeo*` / `VeoResolutionRatio` / `ExtractMultipartImage` / `ParseImageInput`）
- `github.com/QuantumNous/new-api/relay/channel/task/taskcommon` — `BaseBilling` / `EncodeLocalTaskID` / `DecodeLocalTaskID` / `UnmarshalMetadata`
- `vertexcore "github.com/QuantumNous/new-api/relay/channel/vertex"` — **复用** ADC 凭证与 Google URL 构造（`Credentials` / `AcquireAccessToken` / `BuildGoogleModelURL` / `GetModelRegion` / `DefaultAPIVersion`）
- `relaycommon "github.com/QuantumNous/new-api/relay/common"` — `RelayInfo` / `TaskSubmitReq` / `TaskInfo` / `ValidateBasicTaskRequest`
- `github.com/QuantumNous/new-api/service` — `TaskErrorWrapper` / `GetHttpClientWithProxy`

### External

- `bytes` / `fmt` / `io` / `net/http` / `regexp` / `strings` / `time` — 标准库
- `github.com/gin-gonic/gin` — gin context

<!-- MANUAL: -->
