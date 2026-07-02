<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-07-02 | Updated: 2026-07-02 -->

# relay/channel/task/kling

## Purpose

快手可灵（Kling）异步视频生成适配器，对应 `constant.ChannelTypeKling`。实现 `channel.TaskAdaptor` 接口，支持文生视频（text2video）与图生视频（image2video）两种 action，URL path 按 action 切换。**关键差异：鉴权用 JWT**（`accessKey|secretKey` 格式的 API key 在 `BuildRequestHeader` / `FetchTask` 内动态签发 30 分钟有效的 HS256 JWT），而非直接透传 API key——这是 task 适配器树里唯一用 JWT 的。通过 `taskcommon.BaseBilling` 嵌入获得默认三段式计费；客户端可见的 task ID 经 `info.PublicTaskID` 替换上游真实 task_id。

## Key Files

| File | Description |
|------|-------------|
| `adaptor.go` | 全部实现集中在单文件。`TaskAdaptor` 嵌入 `taskcommon.BaseBilling`；`ValidateRequestAndSetAction` 调 `relaycommon.ValidateBasicTaskRequest`（**非** seedance 路径，用通用 `TaskSubmitReq`）；`BuildRequestURL` 按 action 选 `/v1/videos/image2video` 或 `/v1/videos/text2video`（识别 `sk-` 前缀的 new-api relay key 时加 `/kling` 前缀）；`BuildRequestHeader` 动态生成 JWT；`BuildRequestBody` 用 `convertToRequestPayload` 把 `TaskSubmitReq` + metadata 翻译成上游 `requestPayload`（含 `camera_control` / `dynamic_masks` / `cfg_scale=0.5` 等可灵专属字段）；`FetchTask` GET `{base}/v1/videos/{path}/{taskID}`；`ParseTaskResult` 把 `submitted/processing/succeed/failed` 映射到统一状态，成功时从 `data.task_result.videos[0].url` 取视频、从 `data.final_unit_deduction` 解析计费 token 数（向上取整）；`ConvertToOpenAIVideo` 把持久化的上游响应转成 OpenAI 视频格式 |

## For AI Agents

### Working In This Directory

- **JWT 鉴权（特例）**：API key 格式必须是 `accessKey|secretKey`（管道分隔）。`createJWTTokenWithKey` 用 HS256 签发 claims `{iss: accessKey, exp: now+1800, nbf: now-5}`，30 分钟有效。若 key 以 `sk-` 开头则判定为 new-api 内部中继，直接当 Bearer token 用（不再签 JWT）——见 `isNewAPIRelay`。修改鉴权逻辑时两条路径都要顾。
- **action 动态切换**：`BuildRequestBody` 检查 image 字段，若 `Image` 和 `ImageTail` 都空，则把 action 改写为 `TaskActionTextGenerate` 并写入 context，`DoRequest` 读 context 覆盖 `info.Action`，从而让 URL 切到 text2video path。这是本适配器的特例，不要在别处复制。
- **`FinalUnitDeduction` 计费**：上游返回字符串型的最终扣费单位，`ParseTaskResult` 用 `strconv.ParseFloat` 解析后 `math.Ceil` 向上取整，填入 `CompletionTokens` / `TotalTokens`。若上游字段名/类型变更，这里会静默漏计费，修改时需留意。
- **Rule 1（JSON）**：所有 marshal/unmarshal 走 `common.*`（`common.Marshal` / `common.Unmarshal`）。
- **metadata 覆盖**：`convertToRequestPayload` 先填默认值，再用 `taskcommon.UnmarshalMetadata(req.Metadata, &r)` 让客户端 metadata 覆盖可灵专属字段（`camera_control` / `dynamic_masks` / `negative_prompt` / `external_task_id` 等）。注意 `UnmarshalMetadata` 会 `delete(metadata, "model")` 防 billing 绕过。
- **模型清单**：`GetModelList` 返回 `kling-v1` / `kling-v1-6` / `kling-v2-master`；`convertToRequestPayload` 中 `ModelName` 为空时默认回退 `kling-v1`。
- **非白标**：可灵不是白标渠道，结果 `video.Url` 上游直链直接返回客户端，无需代理/脱敏。

### Testing Requirements

- `go build ./relay/channel/task/kling/...` 必须通过
- 当前目录无独立 `_test.go` 文件
- 验证手动场景：JWT 签发是否成功、text2video/image2video path 切换、`final_unit_deduction` 计费解析

### Common Patterns

```go
// JWT 鉴权（task 树里唯一）
token, err := a.createJWTToken()  // 内部调 createJWTTokenWithKey(a.apiKey)
req.Header.Set("Authorization", "Bearer "+token)

// FetchTask 路径签名时复用同一 key
token, err := a.createJWTTokenWithKey(key)
if err != nil { token = key } // fallback：JWT 失败就直接用裸 key

// action 由 BuildRequestBody 动态切换（文生 vs 图生）
if body.Image == "" && body.ImageTail == "" {
    c.Set("action", constant.TaskActionTextGenerate)
}
// DoResponse 读 context 覆盖 info.Action
if action := c.GetString("action"); action != "" { info.Action = action }

// 计费 token 从字符串字段向上取整
if tokens, err := strconv.ParseFloat(resPayload.Data.FinalUnitDeduction, 64); err == nil {
    rounded := int(math.Ceil(tokens))
    if rounded > 0 {
        taskInfo.CompletionTokens = rounded
        taskInfo.TotalTokens = rounded
    }
}
```

## Dependencies

### Internal

- `github.com/QuantumNous/new-api/common` — `Marshal` / `Unmarshal`（CLAUDE.md Rule 1）
- `github.com/QuantumNous/new-api/constant` — `TaskActionGenerate` / `TaskActionTextGenerate`
- `github.com/QuantumNous/new-api/dto` — `TaskError` / `NewOpenAIVideo` / `OpenAIVideoError`
- `github.com/QuantumNous/new-api/model` — `Task` / `TaskStatus*`
- `github.com/QuantumNous/new-api/relay/channel` — `DoTaskApiRequest`
- `github.com/QuantumNous/new-api/relay/channel/task/taskcommon` — `BaseBilling` / `DefaultString` / `DefaultInt` / `UnmarshalMetadata`
- `relaycommon "github.com/QuantumNous/new-api/relay/common"` — `RelayInfo` / `TaskSubmitReq` / `TaskInfo` / `ValidateBasicTaskRequest`
- `github.com/QuantumNous/new-api/service` — `TaskErrorWrapper` / `TaskErrorWrapperLocal` / `GetHttpClientWithProxy`

### External

- `bytes` / `fmt` / `io` / `math` / `net/http` / `strconv` / `strings` / `time` — 标准库
- `github.com/gin-gonic/gin` — gin context
- `github.com/golang-jwt/jwt/v5` — **JWT 签发**（HS256，task 树唯一使用点）
- `github.com/pkg/errors` — `errors.Wrap` / `Wrapf`
- `github.com/samber/lo` — `lo.Ternary` 三元表达式（按 action 选 path）

<!-- MANUAL: -->
