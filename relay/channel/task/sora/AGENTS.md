<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-07-02 | Updated: 2026-07-02 -->

# relay/channel/task/sora

## Purpose

OpenAI Sora 异步视频生成适配器，对应 `constant.ChannelTypeSora`。实现 `channel.TaskAdaptor` 接口，支持两种入站请求形态：标准生成（multipart/form-data 直传，经 `relaycommon.ValidateMultipartDirect` 解析）与 remix（JSON body 二次创作已有视频）。**关键差异：自定义 `EstimateBilling`**（覆盖 `BaseBilling` 默认实现，按请求的 `seconds` 和 `size` 维度算 OtherRatios，宽屏 1792x1024 / 1024x1792 档位倍率 1.666667）。`BuildRequestBody` 对 multipart 与 JSON 两种 Content-Type 分别重建 body（强制改写 `model` 字段为 `info.UpstreamModelName`，并按需 sniff 文件 MIME）。客户端可见 ID 经 `info.PublicTaskID` 替换。

## Key Files

| File | Description |
|------|-------------|
| `adaptor.go` | 适配器主体。`TaskAdaptor` 嵌入 `taskcommon.BaseBilling`（**但 `EstimateBilling` 被覆盖**）；`ValidateRequestAndSetAction` 按 `info.Action == TaskActionRemix` 分流到 `validateRemixRequest` 或 `ValidateMultipartDirect`；`EstimateBilling` 按 seconds + size 算 ratios；`BuildRequestURL` remix 路径用 `/v1/videos/{OriginTaskID}/remix`；`BuildRequestBody` 对 multipart/form-data 重建（含 MIME sniff：512 字节缓冲 `http.DetectContentType`）、对 JSON 用 `sjson`-style map 改写 `model` 字段；`ParseTaskResult` 映射 `queued/pending/processing/completed/failed/cancelled` → 统一状态；`ConvertToOpenAIVideo` 用 `sjson.SetBytes` 把持久化数据里的 `id` 改写为公开 `task.TaskID` |
| `constants.go` | 模型清单 `sora-2` / `sora-2-pro`，渠道名常量 `"sora"` |

## For AI Agents

### Working In This Directory

- **双入站形态**：Sora 是少数同时支持 multipart 和 JSON 入站的 task 适配器。`ValidateRequestAndSetAction` 按 `info.Action == TaskActionRemix` 分流：remix 走 `validateRemixRequest`（JSON，要求非空 prompt），标准生成走 `relaycommon.ValidateMultipartDirect`（multipart 主路径）。`BuildRequestBody` 按 `Content-Type` 前缀（`application/json` vs `multipart/form-data`）分别重建 body。
- **multipart 重建 + MIME sniff**：`BuildRequestBody` 对 multipart 路径用 `common.ParseMultipartFormReusable` 解析，再重建 writer：所有文本字段原样写回（除 `model` 被替换为 `UpstreamModelName`），文件字段用 `http.DetectContentType` sniff 512 字节确定真实 MIME（`application/octet-stream` 不可靠）。**sniff 后必须 re-open**（`f.Close()` 再 `fh.Open()`），否则复制阶段会少前 512 字节。
- **`EstimateBilling` 自定义（覆盖 BaseBilling）**：sora 是少数不沿用 `BaseBilling` 默认 no-op 的适配器。计算维度：`seconds`（默认 4）、`size`（默认 720x1280；1792x1024 或 1024x1792 倍率 1.666667）。remix 路径在 `ResolveOriginTask` 阶段已设过 OtherRatios，本方法直接返回 nil。
- **公开 ID 替换**：`DoResponse` 把上游 `ID` / `TaskID` 都改写成 `info.PublicTaskID` 再 `c.JSON` 回客户端；返回给框架的上游真实 ID 用于后续轮询。`ConvertToOpenAIVideo` 用 `sjson.SetBytes(data, "id", task.TaskID)` 把持久化数据里的 id 字段也改回公开 ID。
- **`ParseTaskResult` 不返回 URL**：注释明确说明 `completed` 状态下 `Url` 字段**故意留空**——调用方（轮询框架）用公开 task ID 自建代理 URL，不依赖上游直链。
- **Rule 1（JSON）**：所有 marshal/unmarshal 走 `common.*`。multipart 路径用 `common.ParseMultipartFormReusable` / `common.GetBodyStorage`，body 可复用。

### Testing Requirements

- `go build ./relay/channel/task/sora/...` 必须通过
- 当前目录无独立 `_test.go` 文件
- 手动验证：multipart 含 image file 的 sniff 行为、JSON 路径的 `model` 改写、宽屏 size 的倍率计算

### Common Patterns

```go
// EstimateBilling 按 seconds + size 维度算 ratios（覆盖 BaseBilling）
func (a *TaskAdaptor) EstimateBilling(c *gin.Context, info *relaycommon.RelayInfo) map[string]float64 {
    if info.Action == constant.TaskActionRemix { return nil }
    req, err := relaycommon.GetTaskRequest(c)
    if err != nil { return nil }
    seconds, _ := strconv.Atoi(req.Seconds)
    if seconds == 0 { seconds = req.Duration }
    if seconds <= 0 { seconds = 4 }
    size := req.Size
    if size == "" { size = "720x1280" }
    ratios := map[string]float64{"seconds": float64(seconds), "size": 1}
    if size == "1792x1024" || size == "1024x1792" {
        ratios["size"] = 1.666667
    }
    return ratios
}

// multipart MIME sniff + re-open 模式
ct := fh.Header.Get("Content-Type")
if ct == "" || ct == "application/octet-stream" {
    buf512 := make([]byte, 512)
    n, _ := io.ReadFull(f, buf512)
    ct = http.DetectContentType(buf512[:n])
    f.Close()
    f, err = fh.Open() // 必须重开，否则复制阶段少前 512 字节
}

// ConvertToOpenAIVideo 用 sjson 原地改 id 字段
data, err = sjson.SetBytes(data, "id", task.TaskID)
```

## Dependencies

### Internal

- `github.com/QuantumNous/new-api/common` — `Marshal` / `Unmarshal` / `UnmarshalBodyReusable` / `GetBodyStorage` / `ParseMultipartFormReusable` / `ReaderOnly`（CLAUDE.md Rule 1）
- `github.com/QuantumNous/new-api/constant` — `TaskActionRemix`
- `github.com/QuantumNous/new-api/dto` — `TaskError` / `NewOpenAIVideo`
- `github.com/QuantumNous/new-api/model` — `Task` / `TaskStatus*`
- `github.com/QuantumNous/new-api/relay/channel` — `DoTaskApiRequest`
- `github.com/QuantumNous/new-api/relay/channel/task/taskcommon` — `BaseBilling`（EstimateBilling 被覆盖）
- `relaycommon "github.com/QuantumNous/new-api/relay/common"` — `RelayInfo` / `TaskSubmitReq` / `TaskInfo` / `ValidateMultipartDirect` / `GetTaskRequest`
- `github.com/QuantumNous/new-api/service` — `TaskErrorWrapper` / `TaskErrorWrapperLocal` / `GetHttpClientWithProxy`

### External

- `bytes` / `fmt` / `io` / `mime/multipart` / `net/http` / `net/textproto` / `strconv` / `strings` — 标准库
- `github.com/gin-gonic/gin` — gin context
- `github.com/pkg/errors` — `errors.Wrap` / `Wrapf`
- `github.com/tidwall/sjson` — `sjson.SetBytes` 原地改写持久化 JSON 字段（不重新 marshal 整个结构体）

<!-- MANUAL: -->
