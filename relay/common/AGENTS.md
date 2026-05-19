<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-18 | Updated: 2026-05-18 -->

# relay/common

## Purpose

relay/common 是贯穿整个 relay 子系统的共享基础层，提供请求上下文载体、任务信息结构、计费抽象接口和流式状态管理。几乎所有 relay 层的代码都依赖本包，但本包自身不依赖具体的 provider 实现，避免循环引用。

## Key Files

| File | Description |
|------|-------------|
| `relay_info.go` | 核心：`RelayInfo` 结构体（请求全生命周期的上下文载体）；`ChannelMeta`（渠道元数据）；`TaskRelayInfo`（异步任务扩展）；`TaskSubmitReq`（任务提交通用请求体）；`TaskInfo`（任务状态统一结构）；`streamSupportedChannels`（支持 stream_options 的渠道集合）；各 `GenRelayInfo*` 工厂函数 |
| `relay_utils.go` | 工具函数：`GetFullRequestURL`（处理 Cloudflare Gateway URL 前缀）；`GetAPIVersion`；任务请求验证（`ValidateBasicTaskRequest`、`ValidateMultipartDirect`）；`GetTaskRequest` / `storeTaskRequest`；请求字段过滤（`RemoveDisabledFields`、`RemoveGeminiDisabledFields`） |
| `relay_info_test.go` | `RelayInfo` 相关单元测试 |
| `billing.go` | `BillingSettler` 接口定义（`Settle` / `Refund` / `NeedsRefund` / `GetPreConsumedQuota` / `Reserve`），由 `service.BillingSession` 实现，存储在 `RelayInfo.Billing` 避免循环引用 |
| `override.go` | 参数覆盖（param override）逻辑 |
| `override_test.go` | 参数覆盖单元测试 |
| `request_conversion.go` | 请求格式转换链辅助（`RequestConversionChain` 管理） |
| `stream_status.go` | `StreamStatus` 结构体：流式处理的终止原因（`StreamEndReason`）、错误收集（`StreamErrorEntry`）、线程安全的状态记录 |
| `stream_status_test.go` | StreamStatus 单元测试 |

## Subdirectories

无子目录。

## For AI Agents

### Working In This Directory

- **Rule 1**：`relay_info.go` 中 `TaskSubmitReq.UnmarshalJSON` 和 `RemoveDisabledFields` 均已使用 `common.Unmarshal` / `common.Marshal`，修改时保持一致。
- **Rule 4**：`relay_info.go` 的 `streamSupportedChannels` map 是新 provider 支持 `stream_options` 的唯一注册点，添加新渠道后必须在此处更新。
- **`RelayInfo` 是只增不减的结构**：字段只能新增，不能删除或改类型，以免破坏所有依赖方。新增字段须提供合理零值语义。
- **`BillingSettler` 接口**：不得在本包中引入 `service/` 包（会产生循环引用），接口通过 `RelayInfo.Billing` 字段由外部注入。
- `RemoveDisabledFields` 过滤逻辑受 `ChannelOtherSettings` 控制，修改过滤项时同步更新 `dto.ChannelOtherSettings` 字段及前端配置。

### Testing Requirements

- 运行 `go test ./relay/common/...` 跑所有单元测试。
- 修改 `RelayInfo` 结构后检查 `relay_info_test.go` 是否需要同步更新。
- 修改 `RemoveDisabledFields` 后补充对应的边界用例测试。

### Common Patterns

- **工厂函数命名**：`GenRelayInfo<Format>(c, request)` — 如 `GenRelayInfoOpenAI`、`GenRelayInfoClaude`、`GenRelayInfoGemini`，每种请求格式对应一个工厂函数，内部调用 `genBaseRelayInfo` 后设置格式特有字段。
- **`RelayInfo.InitChannelMeta`**：在中间件设置好渠道 context key 后调用，填充 `ChannelMeta` 并根据 `streamSupportedChannels` 设置 `SupportStreamOptions`。
- **`StreamStatus`**：每个流式请求创建一个 `StreamStatus` 实例，由 `helper.StreamScannerHandler` 在扫描循环中更新，处理完成后通过 `EndReason` 判断正常结束还是异常中断。
- **`TaskSubmitReq`**：异步任务通用请求体，`duration` 字段支持 int/string 两种 JSON 类型（`UnmarshalJSON` 中兼容处理）；`Metadata` 字段存储 provider 特有扩展参数，通过 `UnmarshalMetadata` 反序列化到具体结构。

## Dependencies

### Internal

- `common/` — `UnmarshalBodyReusable`、`GetContextKey*`、`Marshal`/`Unmarshal`
- `constant/` — `ContextKey*`、`ChannelType*`、`TaskPlatform`、`TaskAction*`
- `dto/` — `ChannelSettings`、`ChannelOtherSettings`、`UserSetting`、`Request` 接口等
- `types/` — `RelayFormat`、`PriceData`
- `pkg/billingexpr/` — `BillingSnapshot`、`RequestInput`
- `setting/model_setting/` — `GetGlobalSettings`、`GetGeminiSettings`
- `relay/constant/` — `RelayMode*` 常量

### External

- `github.com/gin-gonic/gin`
- `github.com/gorilla/websocket`

<!-- MANUAL: 手动补充内容写在此分隔线下方，重新生成时保留 -->
