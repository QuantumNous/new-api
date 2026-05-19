<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-18 | Updated: 2026-05-18 -->

# relay/reasonmap

## Purpose

reasonmap 提供 Claude 与 OpenAI 之间 `finish_reason` / `stop_reason` 字段值的双向映射转换，是 Claude ↔ OpenAI 格式互转时的必要工具。

## Key Files

| File | Description |
|------|-------------|
| `reasonmap.go` | `ClaudeStopReasonToOpenAIFinishReason(stopReason string) string`：将 Claude 的 `stop_reason`（`end_turn`、`max_tokens`、`tool_use`、`stop_sequence`、`refusal`）转换为 OpenAI 的 `finish_reason`（`stop`、`length`、`tool_calls`、`content_filter`）；`OpenAIFinishReasonToClaudeStopReason(finishReason string) string`：反向转换 |

## Subdirectories

无子目录。

## For AI Agents

### Working In This Directory

- 本包是纯函数包，无状态，无外部依赖（仅引用 `constant.FinishReasonContentFilter`）。
- 新增 Claude stop_reason 值时，在 `ClaudeStopReasonToOpenAIFinishReason` 的 switch 中添加对应 case，同时在 `OpenAIFinishReasonToClaudeStopReason` 中补充反向映射（若有对应值）。
- 所有比较使用 `strings.ToLower`，入参大小写不敏感。
- 未知值会原样返回（switch default 分支），调用方需处理可能出现的非标准值。

### Testing Requirements

- 本包目前无独立测试文件；修改映射逻辑时建议添加表驱动测试覆盖所有枚举值。
- 运行 `go build ./relay/reasonmap/...` 确认编译通过。

### Common Patterns

- **调用场景**：Claude adaptor 的 `DoResponse` 在将 Claude 流式/非流式响应转换为 OpenAI 格式时调用 `ClaudeStopReasonToOpenAIFinishReason`；反向调用场景出现在将 OpenAI 格式请求桥接到 Claude 原生 API 时。
- **`content_filter`**：通过 `constant.FinishReasonContentFilter` 引用，保持与其他代码的一致性，不要硬编码字符串。

## Dependencies

### Internal

- `constant/` — `FinishReasonContentFilter`

### External

- `strings`（标准库）

<!-- MANUAL: 手动补充内容写在此分隔线下方，重新生成时保留 -->
