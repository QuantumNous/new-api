<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-07-02 | Updated: 2026-07-02 -->

# relay/channel/task/ali

## Purpose

阿里云通义万相（Wan 系）异步视频生成适配器。上游为阿里云 DashScope 异步视频合成接口（`/api/v1/services/aigc/video-generation/video-synthesis`），请求必须带 `X-DashScope-Async: enable` 头由 DashScope 返回 task_id，之后走 `GET /api/v1/tasks/{task_id}` 轮询。入站使用 new-api 通用 `TaskSubmitReq`（`relaycommon.ValidateMultipartDirect` 解析，支持 multipart 上传），适配器内部转换为 `AliVideoRequest`（`Input` + `Parameters`），并支持从客户端 `metadata` 字段扩展 Ali 私有参数。非白标渠道：成功任务的 `video_url` 直接返回给客户端，不经代理。

## Key Files

| File | Description |
|------|-------------|
| `adaptor.go` | 唯一 adaptor 实现文件。定义 `TaskAdaptor`（嵌入 `taskcommon.BaseBilling`）、`AliVideoRequest`/`AliVideoInput`/`AliVideoParameters`/`AliVideoResponse`/`AliMetadata` 等 DTO，以及全部 `TaskAdaptor` 接口方法（`Init` / `ValidateRequestAndSetAction` / `BuildRequestURL` / `BuildRequestHeader` / `BuildRequestBody` / `DoRequest` / `DoResponse` / `FetchTask` / `ParseTaskResult` / `ConvertToOpenAIVideo` / `EstimateBilling` / `GetModelList` / `GetChannelName`）。还含 `convertToAliRequest`（请求映射 + 默认参数）、`ProcessAliOtherRatios`（按时长/分辨率计算计费倍率）、`sizeToResolution` 与三档 `size480p/720p/1080p` 尺寸表、`convertAliStatus`（状态映射） |
| `constants.go` | `ChannelName = "ali"`、`ModelList`（默认暴露的 5 个 wan 型号：`wan2.5-i2v-preview`、`wan2.2-i2v-flash`、`wan2.2-i2v-plus`、`wanx2.1-i2v-plus`、`wanx2.1-i2v-turbo`） |

## For AI Agents

### Working In This Directory

- **嵌入 `taskcommon.BaseBilling`**：`TaskAdaptor` 直接嵌入获得默认的三段式计费实现（`AdjustBillingOnSubmit` / `AdjustBillingOnComplete`），仅自定义 `EstimateBilling`。
- **入站请求是 `TaskSubmitReq`（非 seedance `content[]`）**：调用 `relaycommon.ValidateMultipartDirect` 解析（支持 multipart 文件上传 + JSON body）。**不是** seedance 系渠道，不走 `taskcommon.BindSeedanceRequest`。
- **异步 header 必须**：`BuildRequestHeader` 设置 `X-DashScope-Async: enable`，否则 DashScope 会同步处理而非返回 task_id。鉴权为 `Authorization: Bearer <apiKey>`。
- **请求映射 `convertToAliRequest`**：
  - 默认 `PromptExtend=true`、`Watermark=false`；
  - `req.Size` 含 `*` 当作 size（`832*480` 这种）映射；否则当作 resolution（`720P`）；缺失时按模型族（`wan2.6`/`wan2.5`/`wan2.2`）填默认值；
  - 时长来自 `req.Duration` 或 `req.Seconds`，默认 5 秒；
  - `req.Metadata` 整体 marshal→unmarshal 回 `aliReq`（覆盖式），允许客户端透传 `audio_url`/`first_frame_url`/`last_frame_url`/`negative_prompt`/`template` 等扩展字段；但 `Model` 不可被 metadata 改写（有显式校验）。
- **计费 `EstimateBilling`**：通过重新跑一次 `convertToAliRequest` 推导 `OtherRatios`，包含 `seconds`（时长）和 `resolution-<X>P`（来自 `ProcessAliOtherRatios` 中按模型×分辨率的倍率表）。`ProcessAliOtherRatios` 是导出函数，供其它位置（如管理端预览价格）复用。
- **轮询 `FetchTask`**：GET `{baseURL}/api/v1/tasks/{task_id}`，用 `Authorization: Bearer <key>`。走 `service.GetHttpClientWithProxy(proxy)`。
- **状态映射 `convertAliStatus` / `ParseTaskResult`**：上游状态 `PENDING/RUNNING/SUCCEEDED/FAILED/CANCELED/UNKNOWN` 映射到 `model.TaskStatusQueued/InProgress/Success/Failure`。注意 `ParseTaskResult` 把 SUCCEEDED 时的 `aliResp.Output.VideoURL` 直接放进 `taskResult.Url`（**非白标**，直接暴露上游 URL）。
- **`ConvertToOpenAIVideo`**：从 `task.Data` 反序列化 `AliVideoResponse`，把 `aliResp.Output.VideoURL` 写到 `metadata.url`；不调用 `task.GetResultURL()` 代理。
- **无白标**：本渠道不在 `taskcommon.whitelabelChannels` 注册；错误信息不经 `taskcommon.ScrubBrandedText`。
- **Rule 1**：所有 JSON 走 `common.Marshal` / `common.Unmarshal`。
- **无 202-gate 需求**：DashScope 异步 submit 返回 200 + task_id，不需要 `normalizeAcceptedStatus`。

### Testing Requirements

- 目录无 `_test.go` 文件。
- `go build ./relay/channel/task/ali/...` 必须通过。
- `go test ./relay/channel/task/...` 不会覆盖本目录。
- 建议手测：提交一个 wan2.2-i2v-flash 任务，验证 PENDING → RUNNING → SUCCEEDED 状态机与 `video_url` 字段。

### Common Patterns

- `ProcessAliOtherRatios` 为导出函数，扩展倍率表时直接修改 `aliRatios` map 即可（按模型名 → 分辨率 → 倍率）。
- `sizeToResolution` 使用 `samber/lo.Contains` 在三档尺寸表中查找，找不到返回 error；新增尺寸需更新三个 slice。
- `convertToAliRequest` 中 metadata 覆盖式合并的副作用是允许客户端覆盖 `prompt_extend/watermark/audio/seed` 等参数；若要禁止某字段被覆盖需在 unmarshal 后加显式校验。

## Dependencies

### Internal

- `github.com/QuantumNous/new-api/common` — JSON 包装（Rule 1）、`GetTimestamp`、`DebugEnabled`、`SysLog`
- `github.com/QuantumNous/new-api/dto` — `TaskError`、`NewOpenAIVideo`、`IntValue`、视频状态常量
- `github.com/QuantumNous/new-api/model` — `Task` 模型与 `TaskStatus*` 枚举
- `github.com/QuantumNous/new-api/relay/channel` — `DoTaskApiRequest` 通用 HTTP 调用
- `github.com/QuantumNous/new-api/relay/channel/task/taskcommon` — `BaseBilling` 嵌入
- `relaycommon "github.com/QuantumNous/new-api/relay/common"` — `RelayInfo`、`TaskSubmitReq`、`TaskInfo`、`ValidateMultipartDirect`、`GetTaskRequest`
- `github.com/QuantumNous/new-api/service` — `TaskErrorWrapper`、`GetHttpClientWithProxy`
- `github.com/QuantumNous/new-api/logger` — `LogJson`

### External

- `net/http`、`io`、`bytes`、`fmt`、`strconv`、`strings` — 标准库
- `github.com/gin-gonic/gin` — context
- `github.com/pkg/errors` — `errors.Wrap` / `Wrapf`
- `github.com/samber/lo` — `lo.Contains`

<!-- MANUAL: -->
