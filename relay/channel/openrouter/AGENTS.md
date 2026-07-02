<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-07-02 | Updated: 2026-07-02 -->

# relay/channel/openrouter

## Purpose

OpenRouter 适配器的**常量与 DTO 定义包**。本目录**不含 `adaptor.go`**——OpenRouter 渠道的 adapter 实现由 `relay/channel/openai/adaptor.go` 的 `Adaptor` 直接承担（工厂在 `relay/relay_adaptor.go` 中返回 `&openai.Adaptor{}`）。`openai.Adaptor` 内部通过 `info.ChannelType == ChannelTypeOpenRouter` 分支处理 OpenRouter 特有的逻辑：reasoning 后缀适配（`-thinking` 后缀→reasoning enable）、`usage.include` 注入、Anthropic thinking 格式转换、Enterprise 响应信封拆包、`HTTP-Referer`/`X-OpenRouter-Title` 请求头。本目录仅提供 `ModelList`、`ChannelName` 与 OpenRouter 专用的 reasoning DTO。

## Key Files

| File | Description |
|------|-------------|
| `constant.go` | `ModelList`（空 `[]string{}`——OpenRouter 的模型列表不在此硬编码，由 `openai.Adaptor.GetModelList()` 在 `ChannelTypeOpenRouter` 分支返回本空列表）与 `ChannelName = "openrouter"` |
| `dto.go` | OpenRouter 专用 DTO：`RequestReasoning`（reasoning 配置，含 `Enabled bool`、`Effort string`（OpenAI 风格 high/medium/low）、`MaxTokens int`（Anthropic 风格 token 上限）、`Exclude bool`（从响应中排除 reasoning token））、`OpenRouterEnterpriseResponse`（Enterprise 信封 `{data json.RawMessage, success bool}`，`openai.OpenaiHandler` 在 `ChannelOtherSettings.IsOpenRouterEnterprise()` 时拆包：`success=true` 取 `data`，`success=false` 返回错误） |

## For AI Agents

### Working In This Directory

- **无 adaptor.go**：本目录不是独立的 adapter，OpenRouter 的请求/响应处理全部在 `relay/channel/openai/adaptor.go` 与 `relay-openai.go` 中完成。修改 OpenRouter 行为时，实际编辑的是 `openai/` 目录的文件——务必先 `Read` `relay/channel/openai/AGENTS.md`。
- **`openai.Adaptor` 中的 OpenRouter 分支**：`adaptor.go` 的 `ConvertOpenAIRequest`（reasoning 后缀、usage.include、Anthropic thinking）、`SetupRequestHeader`（HTTP-Referer/X-OpenRouter-Title）、`OpenaiHandler`（Enterprise 信封拆包）均包含 `ChannelTypeOpenRouter` 分支。
- **ModelList 为空**：`ModelList` 是空 slice，OpenRouter 的可用模型由上游动态决定，不在此静态列举。
- **Rule 1**：`dto.go` 导入 `encoding/json` 仅用于 `json.RawMessage` 类型引用（`OpenRouterEnterpriseResponse.Data`），符合 Rule 1 例外。
- **Rule 5**：`RequestReasoning` 使用 `omitempty` 区分 `Effort`（`string` 零值 `""` 被省略）与 `MaxTokens`（`int` 零值 `0` 被省略）——但因这两个字段互斥（OpenAI 风格 vs Anthropic 风格），零值省略不会造成语义歧义。

### Testing Requirements

- `go build ./relay/channel/openrouter/...` 必须通过
- `go test ./relay/channel/...`
- 无独立 `_test.go`；OpenRouter 的测试随 `openai` 包的测试覆盖
- 手动测试 reasoning 后缀适配（`-thinking` 后缀、`request.THINKING` Anthropic 格式）、Enterprise 响应拆包

### Common Patterns

- **DTO 共享包**：当 provider 的 adapter 逻辑完全复用基础 adapter（`openai.Adaptor`）时，provider 目录退化为常量 + DTO 定义包，供基础 adapter import。

## Dependencies

### Internal

- 无（本目录不依赖其他 internal 包，仅被 `relay/channel/openai` 依赖）

### External

- `encoding/json` — 仅 `json.RawMessage` 类型引用（Rule 1 例外）

<!-- MANUAL: -->
