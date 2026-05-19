<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-18 | Updated: 2026-05-18 -->

# types

## Purpose
全局类型定义层，集中声明跨包使用的核心类型：统一错误体系（`NewAPIError`）、Relay 格式枚举（`RelayFormat`）、文件来源枚举（`FileSource`）、价格数据结构、泛型集合等。与 `constant/` 的区别是：`types/` 包含带方法的类型和业务逻辑，`constant/` 仅含纯常量。

## Key Files
| File | Description |
|------|-------------|
| `error.go` | **核心错误体系**。定义 `NewAPIError`、`OpenAIError`、`ClaudeError`；`ErrorType` 和 `ErrorCode` 枚举；`NewError`、`NewOpenAIError`、`WithOpenAIError`、`WithClaudeError` 等构造函数；`IsSkipRetryError`、`IsChannelError`、`ErrOptionWith*` 等选项函数 |
| `relay_format.go` | `RelayFormat` 字符串枚举，标识请求走哪条 relay 路径（`openai`、`claude`、`gemini`、`embedding`、`rerank`、`task`、`mj_proxy` 等） |
| `file_source.go` | `FileSource` 类型及其枚举值，标识文件数据来源（URL、base64、上传等） |
| `file_data.go` | 文件数据传递结构体 |
| `price_data.go` | 模型价格数据结构体（用于计费） |
| `channel_error.go` | 渠道错误包装类型 |
| `request_meta.go` | 请求元数据结构体 |
| `rw_map.go` | 泛型读写安全 Map（`RWMap[K, V]`） |
| `set.go` | 泛型 Set 集合类型 |

## For AI Agents

### Working In This Directory
- **错误构造**：整个项目的错误处理统一使用 `types.NewAPIError` 体系。新增错误场景时，在 `error.go` 的 `ErrorCode` 块追加常量，再用 `types.NewError`/`types.NewOpenAIError` 构造，勿自行定义新错误类型。
- **错误选项模式**：使用 `ErrOptionWithSkipRetry()`、`ErrOptionWithStatusCode()` 等函数式选项来定制错误行为，不直接修改 `NewAPIError` 字段。
- **Rule 1**：`error.go` 内部调用 `common.MaskSensitiveInfo`，如需序列化错误，仍须走 `common.Marshal`。
- `RelayFormat` 决定 relay 层的 handler 路由，新增 relay 格式时需同步在 relay 路由表注册。

### Testing Requirements
- 此包多为类型定义，单元测试较少；错误行为由上层 relay 集成测试覆盖。
- 修改 `error.go` 后运行：`go build ./...` 确认无编译错误。

### Common Patterns
- 错误构造：`types.NewError(err, types.ErrorCodeXxx)` 或 `types.NewOpenAIError(err, code, statusCode)`。
- 跳过重试：附加 `types.ErrOptionWithSkipRetry()` 选项。
- 判断是否渠道错误：`types.IsChannelError(err)`（基于 `channel:` 前缀判断）。
- 泛型集合：`types.RWMap[string, int]{}` 用于并发安全的 map 场景。

## Dependencies

### Internal
- `common` — `MaskSensitiveInfo`、`GetPointer`、`DebugEnabled`

### External
- `encoding/json` — `json.RawMessage` 类型定义（仅类型引用）
- `net/http` — HTTP 状态码常量

<!-- MANUAL: 手动补充内容写在此分隔线下方，重新生成时保留 -->
