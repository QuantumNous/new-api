# Completions 代码补全兼容设计

## Goal

让代码补全客户端可以通过 OpenAI-compatible `POST /v1/completions` 调用网关，并在常见代码补全与 FIM 场景中获得稳定的请求转发、流式响应、用量统计和计费行为。

## Current Gap

- 仓库已有 `/v1/completions` 路由、`RelayModeCompletions` 和通用 OpenAI 请求 DTO，但代码补全场景还缺少明确的兼容边界。
- 代码补全客户端常用 `prompt`、`suffix`、`max_tokens`、`temperature`、`top_p`、`stop`、`stream`、`echo`、`best_of`、`logprobs` 等字段；其中 `suffix`/FIM 行为需要在 provider adapter 中明确处理。
- 请求 DTO 需要继续保留显式零值语义，避免 `max_tokens: 0`、`temperature: 0`、`top_p: 0`、`stream: false` 等客户端显式输入被误删。

## Locked Decisions

- 入口继续使用 OpenAI-compatible `POST /v1/completions`，不新增前端页面或新的公网路径。
- 首期聚焦文本代码补全和 FIM 兼容：`prompt` 必填，`suffix` 可选，`stream` 支持沿用现有 relay 流式处理。
- `logprobs` 必须兼容 chat/completions 共用 DTO 的布尔值形态，以及 legacy completions 的整数形态。
- 对 OpenAI-compatible 上游优先透传标准字段；对非 OpenAI 上游只做最小必要转换。
- 可选标量字段必须继续使用 pointer + `omitempty`，遵守显式零值保留规则。
- JSON 读写必须继续使用 `common/json.go` 包装函数，不在业务代码中直接调用 `encoding/json` 的 marshal/unmarshal。

## Non-Goals

- 不新增数据库表、迁移或后台配置页。
- 不改变现有 `/v1/chat/completions`、`/v1/responses` 行为。
- 不实现 IDE 插件、Web 编辑器或代码索引服务。
- 不移除、替换或重命名受保护的项目标识、组织标识和相关元数据。

## Data And State Changes

无持久化数据变更。该能力只影响请求 DTO、relay 转换、provider adapter 兼容和响应处理。

## API Impact

- `POST /v1/completions` 应稳定接受代码补全请求。
- 非流式响应应保持 OpenAI text completion 兼容结构。
- 流式响应应保持 SSE text completion chunk 兼容结构。
- 失败时沿用现有 relay 错误响应和状态码映射机制。

## Acceptance Criteria

- `prompt` 为空时返回明确的参数错误；`prompt` 非空时进入 relay 分发。
- 支持 `suffix` 的上游能收到 FIM 所需字段；不支持的上游不得破坏普通 `prompt` 补全。
- `temperature: 0`、`top_p: 0`、`stream: false`、`max_tokens: 0` 等显式零值在 DTO 解析与重新序列化后仍可区分于缺省值。
- 非流式补全响应能正确统计 prompt/completion tokens 并触发文本计费。
- 流式补全响应能返回增量内容，并在可用时包含或估算 usage。

## Implementation Notes

- 优先检查 `dto.GeneralOpenAIRequest`、`relay/helper/valid_request.go`、`relay/compatible_handler.go` 和 provider adapter 的 completions 分支。
- 对 OpenAI-compatible provider，避免引入额外转换导致字段丢失。
- 对 Ollama、SiliconFlow、Vertex 等已有 `prompt`/`suffix` 处理的 adapter，补齐测试覆盖后再调整行为。
