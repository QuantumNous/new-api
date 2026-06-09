<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-06-08 | Updated: 2026-06-08 -->

# service/openaicompat

## Purpose

提供 OpenAI Chat Completions ↔ OpenAI Responses API 的双向转换层。当配置策略启用时，chat completions 请求会在进入 relay 之前被透明地转换为 Responses API 格式发往上游，上游响应再转换回 chat completions 格式返回给调用方。整个过程对客户端透明。

## Key Files

| File | Description |
|------|-------------|
| `chat_to_responses.go` | 核心转换：`ChatCompletionsRequestToResponsesRequest` 将 `dto.GeneralOpenAIRequest` 转为 `dto.OpenAIResponsesRequest`；处理 system→instructions 提升、tool/function_call 消息格式转换、`tool_choice` 格式差异（chat 嵌套 `function.name` → responses 顶层 `name`）、`response_format`→`text.format` 映射、`reasoning_effort`→`Reasoning{Effort,Summary}` 映射 |
| `responses_to_chat.go` | 反向转换：`ResponsesResponseToChatCompletionsResponse` 将 `dto.OpenAIResponsesResponse` 转为 `dto.OpenAITextResponse`；`ExtractOutputTextFromResponses` 从 `output[]` 中提取文本（优先 assistant message 的 output_text，fallback 全量扫描）；tool call 输出从 `function_call` 类型的 output 条目重建 |
| `policy.go` | 策略判断：`ShouldChatCompletionsUseResponsesGlobal` / `ShouldChatCompletionsUseResponsesPolicy` 读取 `model_setting.ChatCompletionsToResponsesPolicy`，按 channelID/channelType + model 正则匹配决定是否启用转换 |
| `regex.go` | `matchAnyRegex`：带 `sync.Map` 缓存的正则匹配，编译失败的 pattern 直接跳过（不中断流量） |

## For AI Agents

### Working In This Directory

- 本包是**纯转换工具包**，不持有任何状态，不访问数据库，不调用外部 HTTP。
- JSON 操作必须使用 `common.Marshal` / `common.Unmarshal`（Rule 1）；`session.go` 中使用 `encoding/json` 是因为它直接操作 gin session 字节，属于框架边界例外。
- `chat_to_responses.go` 中对 `tool_choice` 的转换有细粒度的格式分支（string / `{"type":"function","function":{"name":"..."}}` → `{"type":"function","name":"..."}`），修改时要同时验证这三条路径。
- `system` / `developer` role 的消息被提升为顶层 `instructions` 字段（多条用 `\n\n` 拼接），不进入 `input[]`。
- `tool` / `function` role 消息转为 `function_call_output` 类型条目；缺少 `tool_call_id` 时 fallback 为 user 消息并打标。
- `responses_to_chat.go` 的 usage 映射同时填充 chat 字段（`PromptTokens`/`CompletionTokens`）和 Responses API 字段（`InputTokens`/`OutputTokens`），保证下游计费双通道均可读。
- `regex.go` 的缓存是 package 级 `sync.Map`，进程生命周期内常驻；pattern 编译失败不 panic，仅跳过。

### Testing Requirements

- 构建验证：`go build ./service/openaicompat/...`
- 当前无独立测试文件；转换逻辑通过 `service/openai_chat_responses_compat.go` 的集成路径间接覆盖。
- 新增转换逻辑时，应在本包或 `service/` 层添加单元测试，重点覆盖 tool_choice 格式分支和 response_format 映射。

### Common Patterns

- 所有导出函数均为纯函数（无副作用），输入 nil 时返回 error 而非 panic。
- `map[string]any` 用于构造 Responses API 的 JSON 字段，最终通过 `common.Marshal` 序列化为 `json.RawMessage` 写入 DTO。
- `lo.FromPtrOr` / `lo.ToPtr` / `lo.FromPtr` 用于安全地解引用/构造指针字段。

## Dependencies

### Internal

- `dto/` — `GeneralOpenAIRequest`、`OpenAIResponsesRequest`、`OpenAIResponsesResponse`、`OpenAITextResponse`、`Usage`、`Reasoning`
- `common/` — `Marshal`、`Unmarshal`、`GetPointer`、`Interface2String`
- `setting/model_setting` — `ChatCompletionsToResponsesPolicy`、`GetGlobalSettings`

### External

- `github.com/samber/lo` — 指针工具（`FromPtrOr`、`ToPtr`、`FromPtr`）
- `encoding/json` — 仅用于类型声明（`json.RawMessage`），实际 marshal/unmarshal 走 `common.*`

<!-- MANUAL: -->
