<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-07-02 | Updated: 2026-07-02 -->

# relay/channel/task/taskcommon

## Purpose

异步任务类 provider 适配器（`TaskAdaptor`）共享的辅助工具包。本包**不是适配器**，不实现 `TaskAdaptor` 接口；它被几乎所有 task 子目录下的适配器导入，集中放置跨渠道复用的逻辑：白标渠道注册表与品牌词脱敏、seedance 系通用入参绑定（`BindSeedanceRequest`）、`BaseBilling` 三段式计费默认实现、metadata→struct 反序列化、本地 task ID（base64）编解码、代理 URL 拼接等。**禁止 import `service` 包**（`service` 已反向 import 本包，会形成循环依赖）——所以本包返回的 error 由调用方自行用 `service.TaskErrorWrapper*` 包装。

## Key Files

| File | Description |
|------|-------------|
| `helpers.go` | 跨渠道辅助函数主文件。包含：`whitelabelChannels` 注册表与 `ShouldWhitelabelPlatform` / `ShouldWhitelabelChannelType` 判断、`brandKeywords` 与 `ContainsBrandKeyword` / `ScrubBrandedText` 品牌脱敏、`UnmarshalMetadata`（metadata→struct JSON 往返，**会 `delete(metadata, "model")` 防止 billing 绕过**）、`DefaultString` / `DefaultInt`、`EncodeLocalTaskID` / `DecodeLocalTaskID`（base64 RawURL 编解码，Gemini/Vertex 用上游 operation name 作 task ID 时使用）、`BuildProxyURL`（用 `system_setting.ServerAddress` 拼 `/v1/videos/{id}/content` 代理地址）、轮询进度常量（`ProgressSubmitted/Queued/InProgress/Complete`）、以及 `BaseBilling` 结构体（嵌入即可获得 `EstimateBilling` / `AdjustBillingOnSubmit` / `AdjustBillingOnComplete` 三段式计费的 no-op 默认实现） |
| `seedance.go` | **seedance 系共享入口**。`BindSeedanceRequest(c, info, action)` 把客户端官方 `content[]` 格式 body 解析为 provider-neutral 的 `dto.SeedanceVideoRequest`，调 `Validate()`，合成 `relaycommon.TaskSubmitReq`（prompt + image URLs + resolution/ratio/duration），调 `relaycommon.StoreTaskRequest` 写入 gin context，并把解析结果缓存到 context key `seedance_request`；`GetSeedanceRequest(c)` 让后续只读消费者（如渠道的 `EstimateBilling`）复用解析结果、避免重复 decode reusable body |
| `helpers_test.go` | `ShouldWhitelabelPlatform` / `ShouldWhitelabelChannelType` / `ScrubBrandedText` 的单元测试，覆盖各已注册白标渠道类型、非数字 platform、大小写混合品牌词等场景 |
| `seedance_test.go` | `BindSeedanceRequest` 单元测试：合法 content[] body 正确合成 task_request；空 content / 非法 JSON 被拒绝 |

## For AI Agents

### Working In This Directory

- **本包不是适配器**：不实现 `TaskAdaptor`，不要在这里写 `Init` / `BuildRequestURL` 等；它只放被各适配器复用的纯函数和小工具。
- **禁止 import `service`**：会形成循环依赖。本包返回的 raw error 由调用方用 `service.TaskErrorWrapperLocal(err, code, httpStatus)` 包装。这是 `BindSeedanceRequest` 返回 `error` 而非 `*dto.TaskError` 的原因（注释里有明确说明）。
- **新增白标渠道**：在 `helpers.go` 的 `whitelabelChannels` map 中注册渠道类型常量，并在 `brandKeywords` 切片中追加该供应商品牌词（小写）。**两处都要改**，否则脱敏/代理两套机制会漏一边。
- **`BaseBilling` 嵌入模式**：渠道适配器只需 `taskcommon.BaseBilling` 即可获得三段式计费的 no-op 默认实现，仅覆盖需要自定义的方法（典型如 sora/vertex 的 `EstimateBilling`）。**不要在每个适配器里复制粘贴**这三段。
- **`UnmarshalMetadata` 会删 `model` 键**：调用前 metadata 里的 `model` 会被 `delete`，防止客户端通过 metadata 覆盖计费模型字段（billing 绕过防护）。如果你需要在 metadata 里保留 model，不要用这个函数。
- **seedance 入站格式与上游格式分离**：`BindSeedanceRequest` 解析的是**对客户端统一的官方 `content[]` 格式**（`dto.SeedanceVideoRequest`）；各渠道适配器在 `BuildRequestBody` 里再次从 reusable body 解析（同时拿官方字段 + 本渠道扩展字段），调私有的 `build<Channel>CreateRequest` 映射成上游 wire 格式。详见父文档「新增 seedance 系渠道适配器 SOP」（CLAUDE.md Rule 8）。
- **`GetSeedanceRequest` 的 fallback 行为**：context 没缓存时会自己 decode 一次 reusable body；body 必须 reusable（`common.UnmarshalBodyReusable`），否则 fallback 会消耗掉 body。

### Testing Requirements

- `go build ./relay/channel/task/taskcommon/...` 必须通过
- `go test ./relay/channel/task/taskcommon/...` 跑现有单元测试
- 改动白标/品牌词时，必须同步更新 `helpers_test.go` 的 `TestShouldWhitelabelPlatform` / `TestScrubBrandedText` table 用例

### Common Patterns

```go
// 适配器嵌入 BaseBilling 获得三段式计费默认实现
type TaskAdaptor struct {
    taskcommon.BaseBilling
    ChannelType int
    apiKey      string
    baseURL     string
}

// ValidateRequestAndSetAction 复用 BindSeedanceRequest（seedance 系渠道）
func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.RelayInfo) *dto.TaskError {
    seedReq, err := taskcommon.BindSeedanceRequest(c, info, constant.TaskActionGenerate)
    if err != nil {
        return service.TaskErrorWrapperLocal(err, "invalid_request", http.StatusBadRequest)
    }
    // 渠道私有取值校验（fail fast）
    if err := validateResolution(seedReq.Resolution); err != nil {
        return service.TaskErrorWrapperLocal(err, "invalid_request", http.StatusBadRequest)
    }
    return nil
}

// 后续只读消费者（如 EstimateBilling）用 GetSeedanceRequest 复用解析结果
func (a *TaskAdaptor) EstimateBilling(c *gin.Context, info *relaycommon.RelayInfo) map[string]float64 {
    seedReq, err := taskcommon.GetSeedanceRequest(c)
    if err != nil { return nil }
    // ...
}

// 白标：结果 URL 用代理地址，错误信息用 ScrubBrandedText 脱敏
ov.SetMetadata("url", originTask.GetResultURL()) // 代理地址，非上游真实 URL
ov.Error = &dto.OpenAIVideoError{
    Message: taskcommon.ScrubBrandedText(originTask.FailReason),
}
```

## Dependencies

### Internal

- `github.com/QuantumNous/new-api/common` — `Marshal` / `Unmarshal` / `UnmarshalBodyReusable`（CLAUDE.md Rule 1）
- `github.com/QuantumNous/new-api/constant` — `ChannelType*` 白标注册、`TaskPlatform`
- `github.com/QuantumNous/new-api/dto` — `SeedanceVideoRequest`（seedance 入参契约）
- `github.com/QuantumNous/new-api/model` — `Task`（用于 `AdjustBillingOnComplete` 签名）
- `relaycommon "github.com/QuantumNous/new-api/relay/common"` — `RelayInfo` / `TaskSubmitReq` / `TaskInfo` / `StoreTaskRequest`
- `github.com/QuantumNous/new-api/setting/system_setting` — `ServerAddress`（拼代理 URL）

### External

- `encoding/base64` — `RawURLEncoding` 用于本地 task ID 编解码
- `fmt` / `strconv` / `strings` — 字符串处理
- `github.com/gin-gonic/gin` — context 存取

<!-- MANUAL: -->
