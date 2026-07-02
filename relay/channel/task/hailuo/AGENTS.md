<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-07-02 | Updated: 2026-07-02 -->

# relay/channel/task/hailuo

## Purpose

海螺 / MiniMax 视频生成异步适配器（MiniMax-Hailuo-2.3、T2V-01、I2V-01、S2V-01 等系列）。上游为 MiniMax 开放平台 `POST /v1/video_generation` 创建、`GET /v1/query/video_generation?task_id=<id>` 轮询；鉴权为 `Authorization: Bearer <apiKey>`。入站使用 new-api 通用 `TaskSubmitReq`（`relaycommon.ValidateBasicTaskRequest` 解析）。**视频下载链特殊**：`ParseTaskResult` 拿到 `file_id` 后会**同步**调用 `GET /v1/files/retrieve?file_id=<id>` 换取真实 `download_url`，再作为 `taskResult.Url` 返回——这是一个同步阻塞的 HTTP 子调用。每模型有独立 `ModelConfig`（默认分辨率、支持时长、支持分辨率、是否有 `prompt_optimizer`/`fast_pretreatment`）。**非白标渠道**：直接返回上游 download URL，不经代理。

## Key Files

| File | Description |
|------|-------------|
| `adaptor.go` | `TaskAdaptor` 主实现。嵌入 `taskcommon.BaseBilling`。覆盖方法含 `ValidateRequestAndSetAction`（`ValidateBasicTaskRequest`）、`BuildRequestURL`（拼 `TextToVideoEndpoint`）、`BuildRequestHeader`、`BuildRequestBody`（`convertToRequestPayload`：从 `ModelConfig` 推默认分辨率、`parseResolutionFromSize` 从 size 字符串推断、`req.UnmarshalMetadata` 合并扩展字段）、`DoResponse`（校验 `base_resp.status_code`，非 0 报错）、`FetchTask`（GET query endpoint，task_id 走 query string）、`ParseTaskResult`（状态映射 + `buildVideoURL` 同步取 download_url）、`ConvertToOpenAIVideo`（用 `originTask.ToOpenAIVideo()` 通用构造）。注意文件末尾有 `contains`/`containsInt` 两个未被任何路径调用的辅助函数（疑似遗留代码） |
| `constants.go` | `ChannelName = "hailuo-video"`、`ModelList`（9 个模型）；接口路径常量 `TextToVideoEndpoint = "/v1/video_generation"`、`QueryTaskEndpoint = "/v1/query/video_generation"`；上游 `base_resp.status_code` 错误码常量（1002/1004/1008/1026/2013/2049）；任务状态字符串常量（Preparing/Queueing/Processing/Success/Fail）；分辨率常量（512P/720P/768P/1080P）；默认值（DefaultDuration=6、DefaultResolution=720P） |
| `models.go` | `SubjectReference`、`VideoRequest`（上游 wire body，含 `first_frame_image`/`last_frame_image`/`subject_reference` 等 MiniMax 私有字段）、`VideoResponse`（含 `BaseResp`）、`QueryTaskRequest`/`QueryTaskResponse`、`ErrorInfo`、`TaskStatusInfo`、`ModelConfig`、`RetrieveFileResponse`/`FileObject`。**`GetModelConfig(model)`** 是核心：返回每模型的 `DefaultResolution`/`SupportedDurations`/`SupportedResolutions`/`HasPromptOptimizer`/`HasFastPretreatment`；未知模型返回保守默认值（6s、DefaultResolution、仅 720P） |

## For AI Agents

### Working In This Directory

- **嵌入 `taskcommon.BaseBilling`**：获得默认三段式计费；本渠道无需自定义 `EstimateBilling`（无复杂倍率，按时长/分辨率靠框架默认 ratio_setting 配置）。
- **入站是 `TaskSubmitReq`，非 seedance `content[]`**：调用 `relaycommon.ValidateBasicTaskRequest`。
- **模型能力表 `GetModelConfig`** 是修改时的关键：新增模型务必在 `configs` map 添加条目，否则走兜底默认值（可能丢失该模型支持的分辨率/时长组合）。
- **`convertToRequestPayload` 字段合并**：
  - duration 默认 6（来自 `DefaultDuration` 常量），`req.Duration > 0` 时覆盖；
  - resolution 默认走 `ModelConfig.DefaultResolution`，`req.Size` 非空时由 `parseResolutionFromSize`（在 size 字符串中匹配 `1080`/`768`/`720`/`512` 子串）推断；
  - `req.UnmarshalMetadata(&videoRequest)` 把客户端 metadata 覆盖式合并到 `VideoRequest`，允许透传 `prompt_optimizer`/`fast_pretreatment`/`first_frame_image`/`last_frame_image`/`subject_reference`/`aigc_watermark`/`callback_url` 等字段。
- **`DoResponse` 强制校验 `base_resp.status_code`**：非 `StatusSuccess (0)` 即视为失败，把 status_code 转成字符串作为 error code 返回（HTTP 400）。
- **轮询 `FetchTask`**：task_id 走 **query string**（`?task_id=<id>`），不是 path 参数；这是 MiniMax 协议特殊性。
- **`ParseTaskResult` 同步取 download_url**：SUCCEEDED 时调 `buildVideoURL(task_id, file_id)`，内部**同步** GET `/v1/files/retrieve?file_id=<file_id>` 换取真实 `download_url`。该调用走 `service.GetHttpClient()`（**不**带 proxy），失败时返回空字符串。这一段是潜在的延时与单点风险点（每次轮询成功都会打一次 retrieve），修改时注意。
- **状态映射**：Preparing/Queueing/Processing → InProgress（30%/50%）；Success → Success（填 `buildVideoURL` 结果）；Failed → Failure（100%）；默认 → InProgress（30%）。
- **`ConvertToOpenAIVideo` 用 `originTask.ToOpenAIVideo()`**：这是 model 层的通用构造（非本目录特有），失败时叠加 `OpenAIVideoError`。
- **非白标**：不在 `taskcommon.whitelabelChannels` 注册；download URL 直接返回，错误信息不经 `ScrubBrandedText`。
- **Rule 1**：JSON 走 `common.Marshal` / `common.Unmarshal`。
- **无 202-gate 需求**：上游返回 200 + task_id。
- **遗留代码**：`adaptor.go` 末尾的 `contains`/`containsInt` 函数当前未被调用，删除前用 grep 确认无外部引用（包私有用例均使用 `samber/lo` 或 `ModelConfig` 内联检查）。

### Testing Requirements

- 目录无 `_test.go` 文件。
- `go build ./relay/channel/task/hailuo/...` 必须通过。
- `go test ./relay/channel/task/...` 不会覆盖本目录。
- 修改 `GetModelConfig` 时建议补单测覆盖每模型的分辨率/时长组合。
- 建议手测：提交 MiniMax-Hailuo-2.3 任务，验证 file_id → download_url 的 retrieve 子调用与状态机。

### Common Patterns

- 新增模型：同时更新 `constants.go` 的 `ModelList` + `models.go` 的 `GetModelConfig.configs` map。
- 修改 `buildVideoURL`：注意它用的是 `service.GetHttpClient()`（无 proxy），与 `FetchTask` 用的 `GetHttpClientWithProxy(proxy)` 不同——这是因为 retrieve 发生在 `ParseTaskResult` 阶段，没有 proxy 参数传递路径。
- 上游错误码在 `constants.go` 集中定义但 `ParseTaskResult` 当前直接把 `base_resp.status_code` 透传到 `taskResult.Code`，不做按码差异化处理；若要按码做重试/降级需改这里。

## Dependencies

### Internal

- `github.com/QuantumNous/new-api/common` — `Marshal` / `Unmarshal`
- `github.com/QuantumNous/new-api/constant` — `TaskActionGenerate`
- `github.com/QuantumNous/new-api/dto` — `NewOpenAIVideo`、`OpenAIVideoError`、`TaskError`
- `github.com/QuantumNous/new-api/model` — `Task`、`TaskStatus*`
- `github.com/QuantumNous/new-api/relay/channel` — `DoTaskApiRequest`
- `taskcommon "github.com/QuantumNous/new-api/relay/channel/task/taskcommon"` — `BaseBilling`
- `relaycommon "github.com/QuantumNous/new-api/relay/common"` — `RelayInfo`、`TaskSubmitReq`、`TaskInfo`、`ValidateBasicTaskRequest`
- `github.com/QuantumNous/new-api/service` — `TaskErrorWrapper`、`GetHttpClient`、`GetHttpClientWithProxy`

### External

- `bytes`、`fmt`、`io`、`net/http`、`strconv`、`strings`、`time` — 标准库
- `github.com/gin-gonic/gin` — context
- `github.com/pkg/errors` — `errors.Wrap` / `Wrapf`

<!-- MANUAL: -->
