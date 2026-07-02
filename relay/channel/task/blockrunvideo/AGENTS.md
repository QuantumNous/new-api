<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-07-02 | Updated: 2026-07-02 -->

# relay/channel/task/blockrunvideo

## Purpose

BlockRun 代理视频适配器（白标渠道）。上游为 BlockRun 的 OpenAI 风格 video proxy API（`POST /v1/video/generations` 创建、`GET /v1/video/generations/{id}` 轮询），背后模型是 `bytedance/seedance-2.0` 系列。入站使用 new-api 通用 `TaskSubmitReq`（`relaycommon.ValidateBasicTaskRequest` 解析），**不是**官方 seedance `content[]` 格式（与 `blockrunseedance/` 区分：那个才是 seedance 系 SOP 渠道）。鉴权为普通 `Bearer <apiKey>`，无 x402。结果走 `/v1/videos/{task_id}/content` 代理，错误经 `taskcommon.ScrubBrandedText` 脱敏。

## Key Files

| File | Description |
|------|-------------|
| `adaptor.go` | 唯一 adaptor 实现文件。嵌入 `taskcommon.BaseBilling`。定义 `requestPayload`（仅 model/prompt/seconds/resolution/ratio/image_url 六个字段，watermark/seed/generateAudio 等 proxy 不转发的字段不发送）、`responseTask`（`error` 字段是字符串而非对象，因 api2 失败格式特殊）、`TaskAdaptor` 与全部接口方法，以及导出的 `ExtractUpstreamVideoURL`（供 `controller.VideoProxy` 解析真实视频地址，顶层 `url` 优先、回退 `data[0].url`） |
| `constants.go` | `ChannelName = "blockrun-video"`、`ModelList`（默认 `bytedance/seedance-2.0`、`bytedance/seedance-2.0-fast`） |
| `adaptor_test.go` | adaptor 行为单测（注：父文档列出的 `request.go` 在本目录**不存在**，所有逻辑都在 `adaptor.go` 内） |

## For AI Agents

### Working In This Directory

- **嵌入 `taskcommon.BaseBilling`**：获得默认三段式计费实现，本渠道无需自定义 `EstimateBilling`（无复杂倍率逻辑）。
- **入站是 `TaskSubmitReq`，非 seedance `content[]`**：调用 `relaycommon.ValidateBasicTaskRequest` 解析。**与 `blockrunseedance/` 不是同一个渠道类型**：那个用 x402 + 202-gate + content[]，本渠道用普通 Bearer + 同步风格 200 + TaskSubmitReq。
- **请求字段极简**：`convertToRequestPayload` 只填 6 个字段；watermark/seed/generateAudio 等参数**故意不发**（api2 proxy 不转发，发了也无效）。若客户端依赖这些参数，应改用 `blockrunseedance/` 渠道。
- **`DoResponse` 严格校验**：`dResp.ID == "" || dResp.Error != "" || dResp.Status == "failed"` 三选一即视为创建失败（HTTP 502），避免即时校验拒绝后还进入轮询白白占用预扣额。
- **`FetchTask` 用 GET**：URL 为 `{baseURL}/v1/video/generations/{task_id}`（注意是单数 `video`，与创建接口的 `video/generations` 对齐）；带 `Authorization: Bearer <key>`。
- **状态映射 `ParseTaskResult`**：上游状态枚举较多（`queued/pending`、`in_progress/processing/running`、`completed/succeeded`、`failed/cancelled`），统一映射到 `model.TaskStatus*`。`progress` 字段（int 0~100）若有效则透传为 `"N%"`，否则用固定档位（10/30/50/100）。
- **无状态但有 `error` 字段时判定失败**：默认分支里若 `rt.Error != ""`（如 "task not found"）也视为 FAILURE 触发结算/退款，避免僵尸任务。
- **白标**：渠道在 `taskcommon.whitelabelChannels` 注册（推断自 `ScrubBrandedText` 的使用）。`ConvertToOpenAIVideo` 成功用 `originTask.GetResultURL()`（代理地址），失败用 `ScrubBrandedText(originTask.FailReason)`。**`ExtractUpstreamVideoURL` 是导出函数**，供 `controller.VideoProxy` 服务端解析真实 MP4 地址。
- **Rule 1**：所有 JSON 走 `common.Marshal` / `common.Unmarshal`。URL 中无 `&` 需求，无需 `MarshalNoHTMLEscape`。
- **无 202-gate 需求**：上游 submit 返回 200 + id，poll 返回 200，无 202。

### Testing Requirements

- `adaptor_test.go` 已存在。
- `go test ./relay/channel/task/blockrunvideo/...` 必须通过。
- `go build ./...` 跑全量编译。
- 建议手测：提交一个 bytedance/seedance-2.0-fast 任务，验证 queued → in_progress → completed 三态转换与代理 URL。

### Common Patterns

- 上游响应 `error` 字段是**字符串**而非对象，这是 BlockRun proxy 的协议特殊性；新增字段时注意类型。
- 添加新模型：只需更新 `constants.go` 的 `ModelList`；`convertToRequestPayload` 直接透传 `req.Model`，无需模型差异化映射。
- 若需暴露更多上游支持的参数（如 seed），先确认 api2 proxy 真的会转发，再扩 `requestPayload` 字段；扩字段时遵守 Rule 5（指针 + omitempty）。

## Dependencies

### Internal

- `github.com/QuantumNous/new-api/common` — `Marshal` / `Unmarshal`
- `github.com/QuantumNous/new-api/constant` — `TaskActionGenerate`
- `github.com/QuantumNous/new-api/dto` — `NewOpenAIVideo`、`OpenAIVideoError`、`TaskError`
- `github.com/QuantumNous/new-api/model` — `Task`、`TaskStatus*`
- `github.com/QuantumNous/new-api/relay/channel` — `DoTaskApiRequest`
- `github.com/QuantumNous/new-api/relay/channel/task/taskcommon` — `BaseBilling`、`ScrubBrandedText`
- `relaycommon "github.com/QuantumNous/new-api/relay/common"` — `RelayInfo`、`TaskSubmitReq`、`TaskInfo`、`ValidateBasicTaskRequest`、`GetTaskRequest`
- `github.com/QuantumNous/new-api/service` — `TaskErrorWrapper`、`GetHttpClientWithProxy`

### External

- `bytes`、`fmt`、`io`、`net/http`、`strconv`、`time` — 标准库
- `github.com/gin-gonic/gin` — context
- `github.com/pkg/errors` — `errors.Wrap` / `Wrapf`

<!-- MANUAL: -->
