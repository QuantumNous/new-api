<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-07-02 | Updated: 2026-07-02 -->

# relay/channel/task/suno

## Purpose

Suno AI 音乐生成异步适配器，对应 `constant.ChannelTypeSuno`。实现 `channel.TaskAdaptor` 接口，支持 music（生成音乐）与 lyrics（生成歌词）两种 action，由 URL path 参数 `:action` 决定。**关键差异：不使用通用 `ParseTaskResult`**——Suno 的轮询走专用批量拉取路径 `service.UpdateSunoTasks`，从上游 `/suno/fetch` 一次拉回多个任务状态（`dto.TaskResponse[[]dto.SunoDataResponse]`），所以 `ParseTaskResult` 直接返回错误占位。提交响应把上游真实 task_id 替换为 `info.PublicTaskID` 后再返回客户端。

## Key Files

| File | Description |
|------|-------------|
| `adaptor.go` | 适配器主体。`TaskAdaptor` 嵌入 `taskcommon.BaseBilling`；`ValidateRequestAndSetAction` 从 URL `:action` 参数取动作（`MUSIC`/`LYRICS`），用 `common.UnmarshalBodyReusable` 解析 `dto.SunoSubmitReq`，调 `actionValidate` 做动作级校验（music 默认 `mv=chirp-v3-0`；lyrics 要求非空 prompt；否则 `invalid_action`），写 context + 设 `info.Action`；`BuildRequestURL` 拼 `{base}/suno/submit/{action}`；`FetchTask` POST `{base}/suno/fetch` 带整个 body map（批量拉取）；`DoResponse` 解析 `dto.TaskResponse[string]`，校验 `IsSuccess()`，返回上游 task_id（但响应给客户端的 `Data` 字段替换为 `PublicTaskID`）；`ParseTaskResult` 永远返回 error（Suno 不走该路径） |
| `models.go` | 模型清单 `suno_music` / `suno_lyrics`，渠道名常量 `"suno"` |

## For AI Agents

### Working In This Directory

- **Suno 是批量轮询特例**：`ParseTaskResult` 在本适配器里**故意返回错误**。轮询逻辑由 `service.UpdateSunoTasks` 单独实现，一次性向上游 `/suno/fetch` POST 整个 body map，拿回 `[]dto.SunoDataResponse` 列表批量更新。不要试图给 `ParseTaskResult` 填实现，也不要用通用 per-task 轮询路径处理 Suno。
- **action 来自 URL 参数**：与其他 task 适配器不同，Soro 的 action 不在 body 而在 URL path 参数 `:action`，由 `strings.ToUpper(c.Param("action"))` 转大写后匹配 `constant.SunoActionMusic` / `constant.SunoActionLyrics`。改路由时务必保留 `:action` 参数。
- **`actionValidate` 的默认值与必填**：music 动作若 `mv` 为空，默认填 `chirp-v3-0`；lyrics 动作要求 `prompt` 非空，否则报 `prompt_empty`；未知动作报 `invalid_action`。
- **公开 ID 替换**：`DoResponse` 解析上游 `TaskResponse[string]`（`Data` 字段是上游 task_id），但回客户端的响应里 `Data` 替换为 `info.PublicTaskID`；返回值（上游真实 task_id）交给框架存储。这是 Suno 把上游 ID 与客户端 ID 隔离的方式。
- **Rule 1（JSON）**：`common.UnmarshalBodyReusable` / `common.Marshal` / `common.Unmarshal` 全部走 common 包封装。
- **`FetchTask` 的 body 含全部任务**：上游 `/suno/fetch` 是批量端点，body 是整个任务查询 map（含多个 task_id），不是单任务查询。

### Testing Requirements

- `go build ./relay/channel/task/suno/...` 必须通过
- 当前目录无独立 `_test.go` 文件
- 改 `actionValidate` 默认值或必填项后，手动验证 music/lyrics/未知动作三条路径
- 改批量轮询契约时，必须同步检查 `service.UpdateSunoTasks`（不在本目录）

### Common Patterns

```go
// ParseTaskResult 故意返回错误（批量轮询特例）
func (a *TaskAdaptor) ParseTaskResult([]byte) (*relaycommon.TaskInfo, error) {
    return nil, fmt.Errorf("suno uses batch polling via UpdateSunoTasks, ParseTaskResult is not applicable")
}

// action 来自 URL path 参数（不是 body）
action := strings.ToUpper(c.Param("action"))

// DoResponse 返回上游真实 ID，但给客户端的响应里替换为公开 ID
publicResponse := dto.TaskResponse[string]{
    Code:    sunoResponse.Code,
    Message: sunoResponse.Message,
    Data:    info.PublicTaskID, // 客户端看到的是公开 ID
}
c.JSON(http.StatusOK, publicResponse)
return sunoResponse.Data, nil, nil // 返回给框架的是上游真实 ID

// FetchTask POST 批量端点（不是 GET 单任务）
requestUrl := fmt.Sprintf("%s/suno/fetch", baseUrl)
byteBody, _ := common.Marshal(body)
req, _ := http.NewRequest("POST", requestUrl, bytes.NewBuffer(byteBody))
```

## Dependencies

### Internal

- `github.com/QuantumNous/new-api/common` — `Marshal` / `Unmarshal` / `UnmarshalBodyReusable` / `SysLog`（CLAUDE.md Rule 1）
- `github.com/QuantumNous/new-api/constant` — `SunoActionMusic` / `SunoActionLyrics`
- `github.com/QuantumNous/new-api/dto` — `TaskError` / `SunoSubmitReq` / `TaskResponse`
- `github.com/QuantumNous/new-api/relay/channel` — `DoTaskApiRequest`
- `github.com/QuantumNous/new-api/relay/channel/task/taskcommon` — `BaseBilling`
- `relaycommon "github.com/QuantumNous/new-api/relay/common"` — `RelayInfo` / `TaskInfo`
- `github.com/QuantumNous/new-api/service` — `TaskErrorWrapper` / `TaskErrorWrapperLocal` / `GetHttpClientWithProxy`（**外加 `service.UpdateSunoTasks`**——批量轮询路径，不在本目录）

### External

- `bytes` / `fmt` / `io` / `net/http` / `strings` — 标准库
- `github.com/gin-gonic/gin` — gin context（用 `c.Param("action")` 取 URL 参数）

<!-- MANUAL: -->
