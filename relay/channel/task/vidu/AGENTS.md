<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-07-02 | Updated: 2026-07-02 -->

# relay/channel/task/vidu

## Purpose

Vidu（生数科技）异步视频生成适配器，对应 `constant.ChannelTypeVidu`。实现 `channel.TaskAdaptor` 接口，支持四种 action：文生视频（`/text2video`）、图生视频（`/img2video`）、首尾帧生视频（`/start-end2video`，2 张图）、参考图生视频（`/reference2video`，>2 张图，**仅 `viduq2` 模型支持**，body 里 `model` 强制改为 `viduq2` 去掉 pro/turbo 后缀）。鉴权用 `Token {key}` header（非 `Bearer`）。通过 `taskcommon.BaseBilling` 嵌入获得默认三段式计费。

## Key Files

| File | Description |
|------|-------------|
| `adaptor.go` | 全部实现集中在单文件。`TaskAdaptor` 嵌入 `taskcommon.BaseBilling`；`ValidateRequestAndSetAction` 调 `ValidateBasicTaskRequest` 后用 `relaycommon.GetTaskRequest` 取出 `TaskSubmitReq`，根据 `metadata["action"]` / 图片数量推断 action（text / img2video / first_tail / reference）；`BuildRequestURL` 按 action 选 `/ent/v2/{path}`；`BuildRequestBody` 在 reference 路径上把 model 强制改 `viduq2`；`FetchTask` GET `/ent/v2/tasks/{taskID}/creations`；`ParseTaskResult` 映射 `created/queueing/processing/success/failed` → 统一状态；`ConvertToOpenAIVideo` 从 `taskResultResponse.creations[0].url` 取视频直链 |

## For AI Agents

### Working In This Directory

- **四种 action 路径**：`ValidateRequestAndSetAction` 的 action 推断优先级是：`metadata["action"]` 显式指定 > 图片数量判定（0 张 = text，1 张 = img2video，2 张 = first_tail，>2 张 = reference）。`BuildRequestURL` 按 action 选 `/ent/v2/text2video` / `/img2video` / `/start-end2video` / `/reference2video` 四个端点。
- **reference 路径强制 `viduq2` 模型**：`BuildRequestBody` 检测到 `TaskActionReferenceGenerate` 时，若 model 含 `viduq2`，强制改为裸 `viduq2`（去掉 pro/turbo 后缀）。这是上游约束（见 `https://platform.vidu.cn/docs/reference-to-video`），不要在 reference 路径上保留后缀。
- **鉴权用 `Token`（非 `Bearer`）**：`BuildRequestHeader` / `FetchTask` 都设 `Authorization: Token {key}`，是 Vidu 上游协议要求。
- **`metadata` 覆盖字段**：`convertToRequestPayload` 先填默认值（`Duration=5` / `Resolution=1080p` / `MovementAmplitude=auto` / `Bgm=false` / `Model=viduq1`），再用 `taskcommon.UnmarshalMetadata(req.Metadata, &r)` 让客户端 metadata 覆盖（含 `images` / `prompt` / `duration` / `seed` / `resolution` / `movement_amplitude` / `bgm` / `payload` / `callback_url` 等）。注意 `UnmarshalMetadata` 会 `delete(metadata, "model")` 防 billing 绕过。
- **`ParseTaskResult` 状态映射**：上游 `created`/`queueing` → `TaskStatusSubmitted`；`processing` → `TaskStatusInProgress`；`success` → `TaskStatusSuccess`（取 `creations[0].url`）；`failed` → `TaskStatusFailure`（`err_code` 填入 `Reason`）；未知状态直接返回 error（不 fallback）。
- **非白标**：Vidu 不是白标渠道，结果视频 `creations[0].url` 上游直链直接返回客户端，无需代理/脱敏。
- **Rule 1（JSON）**：所有 marshal/unmarshal 走 `common.*`。

### Testing Requirements

- `go build ./relay/channel/task/vidu/...` 必须通过
- 当前目录无独立 `_test.go` 文件
- 手动验证：四种 action 的 path 切换、reference 路径的 model 强制改写、`Token` 鉴权头

### Common Patterns

```go
// action 按图片数量推断（metadata 显式指定优先）
action := constant.TaskActionTextGenerate
if meatAction, ok := req.Metadata["action"]; ok {
    action, _ = meatAction.(string)
} else if req.HasImage() {
    action = constant.TaskActionGenerate
    if len(req.Images) == 2 {
        action = constant.TaskActionFirstTailGenerate
    } else if len(req.Images) > 2 {
        action = constant.TaskActionReferenceGenerate
    }
}

// reference 路径强制 viduq2（去后缀）
if info.Action == constant.TaskActionReferenceGenerate {
    if strings.Contains(body.Model, "viduq2") {
        body.Model = "viduq2"
    }
}

// Token 鉴权（非 Bearer）
req.Header.Set("Authorization", "Token "+info.ApiKey)

// metadata 覆盖默认值（model 字段会被 UnmarshalMetadata 内部 delete）
r := requestPayload{
    Model:             taskcommon.DefaultString(info.UpstreamModelName, "viduq1"),
    Duration:          taskcommon.DefaultInt(req.Duration, 5),
    Resolution:        taskcommon.DefaultString(req.Size, "1080p"),
    MovementAmplitude: "auto",
}
taskcommon.UnmarshalMetadata(req.Metadata, &r) // 客户端可覆盖
```

## Dependencies

### Internal

- `github.com/QuantumNous/new-api/common` — `Marshal` / `Unmarshal`（CLAUDE.md Rule 1）
- `github.com/QuantumNous/new-api/constant` — `ChannelTypeVidu` / `TaskActionGenerate` / `TaskActionTextGenerate` / `TaskActionFirstTailGenerate` / `TaskActionReferenceGenerate`
- `github.com/QuantumNous/new-api/dto` — `TaskError` / `NewOpenAIVideo` / `OpenAIVideoError`
- `github.com/QuantumNous/new-api/model` — `Task` / `TaskStatus*`
- `github.com/QuantumNous/new-api/relay/channel` — `DoTaskApiRequest`
- `github.com/QuantumNous/new-api/relay/channel/task/taskcommon` — `BaseBilling` / `DefaultString` / `DefaultInt` / `UnmarshalMetadata`
- `relaycommon "github.com/QuantumNous/new-api/relay/common"` — `RelayInfo` / `TaskSubmitReq` / `TaskInfo` / `ValidateBasicTaskRequest` / `GetTaskRequest`
- `github.com/QuantumNous/new-api/service` — `TaskErrorWrapper` / `TaskErrorWrapperLocal` / `GetHttpClientWithProxy`

### External

- `bytes` / `fmt` / `io` / `net/http` / `strings` / `time` — 标准库
- `github.com/gin-gonic/gin` — gin context
- `github.com/pkg/errors` — `errors.Wrap`

<!-- MANUAL: -->
