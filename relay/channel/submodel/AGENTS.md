<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-07-02 | Updated: 2026-07-02 -->

# relay/channel/submodel

## Purpose

"submodel"（子模型/代理模型）provider 适配器。这是一个 **OpenAI 兼容直通** 适配器：`ConvertOpenAIRequest` 直接把客户端请求原样返回，`DoResponse` 完全委托 `openai.OaiStreamHandler` / `openai.OpenaiHandler`。除 OpenAI chat completions 之外的所有端点（Gemini、Claude、Audio、Image、Rerank、Embedding、Responses）均返回 `errors.New("submodel channel: endpoint not supported")`。换言之，该 channel 只允许走标准 OpenAI 同步 chat 路径。

## Key Files

| File | Description |
|------|-------------|
| `adaptor.go` | 实现 `Adaptor` 接口。`Init` 为空实现；`GetRequestURL` 用 `relaycommon.GetFullRequestURL` 拼装；`SetupRequestHeader` 设置 `Authorization: Bearer <ApiKey>`；`ConvertOpenAIRequest` 仅做 nil 校验后透传；`DoRequest` 用 `channel.DoApiRequest`；`DoResponse` 按 `info.IsStream` 分流到 `openai.OaiStreamHandler` 或 `openai.OpenaiHandler` |
| `constants.go` | 定义 `ModelList`（如 `NousResearch/Hermes-4-405B-FP8`、`Qwen/Qwen3-*`、`zai-org/GLM-4.5-FP8`、`deepseek-ai/*` 等开源模型 ID）与 `ChannelName = "submodel"` |

## For AI Agents

### Working In This Directory

- 这是一个"几乎无逻辑"的 OpenAI 直通适配器。任何非 chat 路径的请求都会被显式拒绝（返回 error）。
- 如果需要为 submodel 增加新端点支持（例如 image），需要同时：(1) 在 `adaptor.go` 中实现对应的 `ConvertXxxRequest`；(2) 在 `DoResponse` 中按 `info.RelayMode` 分流到对应 handler。
- `DoResponse` 当前**只区分流式/非流式**，不区分 RelayMode——因为只支持 chat completions。
- `GetRequestURL` 不做模式判断，所有路径共用同一 URL（依赖上游 base URL 与请求路径拼接）。

### Testing Requirements
- `go build ./relay/channel/submodel/...` 必须通过
- `go test ./relay/channel/...`

### Common Patterns
- 直通适配器模板：`ConvertOpenAIRequest` 透传 → `DoRequest` 走 `channel.DoApiRequest` → `DoResponse` 委托 `openai.*Handler`。
- 不支持的端点统一返回 `errors.New("<name> channel: endpoint not supported")`。

## Dependencies

### Internal
- `github.com/QuantumNous/new-api/dto` — `GeneralOpenAIRequest` 及各类 Request DTO
- `github.com/QuantumNous/new-api/relay/channel` — `SetupApiRequestHeader`、`DoApiRequest`
- `github.com/QuantumNous/new-api/relay/channel/openai` — `OaiStreamHandler`、`OpenaiHandler`
- `github.com/QuantumNous/new-api/relay/common` — `RelayInfo`、`GetFullRequestURL`
- `github.com/QuantumNous/new-api/types` — `NewAPIError`

### External
- `github.com/gin-gonic/gin` — HTTP 上下文
- `io`、`net/http`、`errors` — 标准库

<!-- MANUAL: -->
