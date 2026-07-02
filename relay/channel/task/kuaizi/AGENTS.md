<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-07-02 | Updated: 2026-07-02 -->

# relay/channel/task/kuaizi

## Purpose

筷子立臻（Kuaizi 丽帧视频 2.0）异步视频生成适配器，对应 `constant.ChannelTypeKuaiziLizhen`。**这是 seedance 系渠道的参考实现（Reference Implementation）**——父文档「新增 seedance 系渠道适配器 SOP」（CLAUDE.md Rule 8）以本目录为样板。入站对客户端统一暴露官方 seedance `content[]` 格式（经 `taskcommon.BindSeedanceRequest` 解析），适配器内部把 seedance 字段 + 筷子私有扩展（`web_search` / `super_resolution_config`）映射到上游 `/create` 的 flat JSON body。是**白标渠道**：上游 host（`aiopenapi.kuaizi.cn`）/ `tos-cn-beijing` 等 TOS 下载 URL / "kuaizi"/"lizhen"/"volces" 品牌词**一律不得出现在对客户的响应里**，结果视频走 `/v1/videos/{task_id}/content` 代理，错误原因经 `taskcommon.ScrubBrandedText` 脱敏。

## Key Files

| File | Description |
|------|-------------|
| `adaptor.go` | 适配器主体。`TaskAdaptor` 嵌入 `taskcommon.BaseBilling`；`ValidateRequestAndSetAction`（调 `BindSeedanceRequest` + 渠道私有 `validateResolution`）、`BuildRequestBody`（reusable body 一次性解析 `dto.SeedanceVideoRequest` + `kuaiziExtensions`，调纯函数 `buildKuaiziCreateRequest`，用 `common.MarshalNoHTMLEscape` 保留 URL 中的 `&`）、`FetchTask`（**POST** `/status` 带 `{task_id}`，是 task 树里唯一用 POST 做 fetch 的适配器）、`ParseTaskResult`（上游状态 `pending/submitted/running/succeeded/failed` → 统一 `TaskInfo`，成功时从 `data.usage` 取 `CompletionTokens`/`TotalTokens`）、`ConvertToOpenAIVideo`（成功用 `GetResultURL()` 代理地址；失败原因 `ScrubBrandedText` 脱敏）。包注释详尽记录了协议差异：auth header 是 `ApiKey:`（非 `Authorization: Bearer`）、无上游 `model` 字段、`code==200`/`code==0` 都算成功（以 `task_id` 非空为准） |
| `constants.go` | 渠道常量与 model→mode 映射。`ModelLizhenFast` / `ModelLizhenPro` 是对客户端暴露的两个 pseudo-model；`ModelToMode(model)` 把 pseudo-model 映射到上游 `mode` flag（`fast` / `pro`），上游靠 `mode` 而非 model name 区分档次 |
| `adaptor_test.go` | 完备的单元测试。覆盖 `ValidateRequestAndSetAction`（合法/空 content/坏 JSON/不支持 resolution）、`validateResolution`、`droppedSeedanceFields`、`buildKuaiziCreateRequest`（text2video / first_last_frame / reference / extensions / `-1` duration）、`BuildRequestBody` end-to-end（含 `&` 在 URL 中保留的断言）、`ParseTaskResult`（各状态映射 + usage）、`ExtractUpstreamVideoURL`、`ModelToMode` |

## For AI Agents

### Working In This Directory

- **这是 seedance 系参考实现**：新增同类渠道前，先读父文档 SOP，再来对照本目录的 `ValidateRequestAndSetAction` → `BuildRequestBody` → `buildKuaiziCreateRequest` → `ParseTaskResult` → `ConvertToOpenAIVideo` 五步骨架。本目录的代码组织（seedance 共享入口 + 渠道私有映射纯函数 + 扩展字段 struct + 取值校验 + 丢弃字段 DEBUG 日志）就是 SOP 的标准形态。
- **白标强制**：`taskcommon.whitelabelChannels` 已注册本渠道类型，`brandKeywords` 含 `kuaizi`/`lizhen`/`volces`/`bytedance`/`kz-cgt`/`tos-cn-beijing`。修改响应/日志时禁止泄露这些词；成功响应的 `url` 必须用 `originTask.GetResultURL()`（代理地址），**不要用** `taskInfo.Url`（上游 TOS 直链）。
- **Rule 1（JSON）**：所有 marshal/unmarshal 必须走 `common.*`。`BuildRequestBody` 用 `common.MarshalNoHTMLEscape`（非 `common.Marshal`），因为 `encoding/json` 默认会把 image URL 里的 `&` HTML 转义成 `&`，少数上游 URL fetcher 会按字节消费导致拉图失败。
- **Rule 5（指针 + omitempty）**：上游请求的可选标量字段用指针类型 + `omitempty`（如 `Duration *int`、`GenerateAudio *bool`、`Watermark *bool`、`WebSearch *bool`、`Seed *int`），保证客户端显式 `false/0` 也能发上游，不传则省略。测试 `TestBuildKuaiziCreateRequest_VideosAudiosAndDurationNeg1` 显式断言 `nil generate_audio` 被 omitempty。
- **取值域 fail fast**：上游 `/create` 只接受 `480p/720p/1080p` 顶层 resolution（更高需挂 `super_resolution_config`）；`ValidateRequestAndSetAction` 调 `validateResolution` 在提交前就拒绝，不让请求发到上游才报错。
- **不支持字段静默丢弃 + DEBUG 日志**：seedance 官方有 `camera_fixed` / `frames` / `callback_url` / `return_last_frame` 字段，上游不认。`buildKuaiziCreateRequest` 不映射它们，`droppedSeedanceFields` 在 `common.DebugEnabled` 时打一条 `[kuaizi] ignoring unsupported seedance fields: ...` 日志，便于运维定位"为何参数没生效"。
- **`FetchTask` 用 POST（特例）**：其他 task 适配器 fetch 用 GET，筷子上游要求 POST `/status` body `{"task_id":"..."}`。`ParseTaskResult` 因此也按 envelope `{code,message,data}` 解析（不是 GET 的扁平响应）。
- **`code==200` 与 `code==0` 都算成功**：文档说 `code==200`，实际部署有返回 `code==0`。`DoResponse` / `ParseTaskResult` 以 `data.task_id` 是否非空/`data` 是否非 nil 作为成功信号，不依赖 code 值。

### Testing Requirements

- `go build ./relay/channel/task/kuaizi/...` 必须通过
- `go test ./relay/channel/task/kuaizi/...` 跑全部单元测试（覆盖很全，改任何分支都要同步改对应 test case）
- 改 `buildKuaiziCreateRequest` 映射逻辑后，必须更新 `TestBuildKuaiziCreateRequest_*` 系列；改 `validateResolution` 的取值集后，必须更新 `TestValidateResolution` 的 supported/unsupported 两组

### Common Patterns

```go
// BuildRequestBody 一次性解析官方字段 + 渠道扩展
var inbound struct {
    dto.SeedanceVideoRequest
    kuaiziExtensions
}
common.UnmarshalBodyReusable(c, &inbound)
mode, ok := ModelToMode(info.UpstreamModelName) // pseudo-model → 上游 mode
body := buildKuaiziCreateRequest(&inbound.SeedanceVideoRequest, inbound.kuaiziExtensions, mode)
data, _ := common.MarshalNoHTMLEscape(body) // 保留 URL 中的 &

// ParseTaskResult 状态映射 + usage 提取
switch data.Status {
case "succeeded":
    info.Status = model.TaskStatusSuccess
    info.Url = data.VideoURL
    info.CompletionTokens = data.Usage.CompletionTokens  // 框架自动落 task.PrivateData
    info.TotalTokens = data.Usage.TotalTokens
case "failed":
    info.Status = model.TaskStatusFailure
    info.Reason = data.Error  // 注意：上游用 error 而非 fail_reason
}

// ConvertToOpenAIVideo 白标：代理 URL + 脱敏
if originTask.Status == model.TaskStatusSuccess {
    ov.SetMetadata("url", originTask.GetResultURL()) // 代理，非 data.VideoURL
}
if originTask.Status == model.TaskStatusFailure {
    ov.Error = &dto.OpenAIVideoError{
        Message: taskcommon.ScrubBrandedText(originTask.FailReason),
    }
}
```

## Dependencies

### Internal

- `github.com/QuantumNous/new-api/common` — `Marshal` / `Unmarshal` / `UnmarshalBodyReusable` / `MarshalNoHTMLEscape` / `DebugEnabled` / `SysLog`（CLAUDE.md Rule 1）
- `github.com/QuantumNous/new-api/constant` — `ChannelTypeKuaiziLizhen` / `TaskActionGenerate`
- `github.com/QuantumNous/new-api/dto` — `SeedanceVideoRequest` / `OpenAIVideo` / `OpenAIVideoUsage` / `TaskError`
- `github.com/QuantumNous/new-api/model` — `Task` / `TaskStatus*`
- `github.com/QuantumNous/new-api/relay/channel` — `DoTaskApiRequest`
- `github.com/QuantumNous/new-api/relay/channel/task/taskcommon` — `BaseBilling` / `BindSeedanceRequest` / `ScrubBrandedText`
- `relaycommon "github.com/QuantumNous/new-api/relay/common"` — `RelayInfo` / `TaskSubmitReq` / `TaskInfo`
- `github.com/QuantumNous/new-api/service` — `TaskErrorWrapper` / `TaskErrorWrapperLocal` / `GetHttpClientWithProxy`

### External

- `bytes` / `fmt` / `io` / `net/http` / `strconv` / `strings` / `time` — 标准库
- `github.com/gin-gonic/gin` — gin context
- `github.com/pkg/errors` — `errors.Wrap` / `Wrapf`

<!-- MANUAL: -->
