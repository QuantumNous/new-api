<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-18 | Updated: 2026-06-10 -->

# setting/model_setting

## Purpose

管理模型层的全局与厂商专属配置，包括：
- 全局模型行为策略（透传开关、思维模型黑名单、Chat Completions → Responses API 转换策略）
- Claude 模型专属参数（缓存、思维预算等）
- Gemini 模型专属参数
- Qwen 模型专属参数
- Grok 模型专属参数
- Codex 渠道专属配置（图像出图承载文本模型）

## Key Files

| File | Description |
|------|-------------|
| `global.go` | `GlobalSettings` 结构体（透传开关、thinking 黑名单、C2R 转换策略）及 `GlobalConfig` 注册 |
| `claude.go` | Claude 专属配置（extended thinking、prompt caching 等） |
| `claude_test.go` | Claude 配置单元测试 |
| `codex.go` | `CodexSettings` 结构体（`ImageCarrierModel` 字段）；注册键 `codex`；`GetCodexSettings()` |
| `gemini.go` | Gemini 专属配置 |
| `grok.go` | Grok 专属配置 |
| `qwen.go` | Qwen 专属配置 |

## For AI Agents

### Working In This Directory

- `global.go` 中的 `GlobalSettings` 注册键为 `global`，DB 键如 `global.pass_through_request_enabled`。
- `ChatCompletionsToResponsesPolicy` 控制是否将 `/v1/chat/completions` 请求透明转换为 Responses API 格式；`IsChannelEnabled(channelID, channelType)` 按渠道 ID、渠道类型过滤；`ModelPatterns` 字段预留但当前不参与 `IsChannelEnabled` 判断。
- `ThinkingModelBlacklist` 列表中的模型不会被自动启用 extended thinking，即使请求中携带相关参数。默认包含 `"moonshotai/kimi-k2-thinking"` 和 `"kimi-k2-thinking"`。
- `ShouldPreserveThinkingSuffix(modelName)` 是对黑名单的封装，精确匹配（trim 后）模型名，用于判断是否保留 thinking 相关后缀而不做剥离处理。
- 各厂商专属配置（claude/gemini/grok/qwen）各自注册不同的 GlobalConfig 键，命名约定为 `<vendor>_setting`。注意：`codex.go` 的注册键为 `codex`（不带 `_setting` 后缀），是命名约定的例外。
- 新增厂商配置时，遵循现有文件结构：定义结构体 → 声明默认值 → `init()` 注册 → 提供 getter。
- **`CodexSettings.ImageCarrierModel`**：codex 图像出图的全局承载文本模型，留空时 relay 层回退到代码常量 `defaultImageCarrierModel`（当前默认 `gpt-5.4`）。当上游文本模型改名或下线时，只需通过管理接口更新该字段，无需改代码。`gpt-image-2` 的 token 计费方案（方案 b）依赖此模型完成图像生成，定价见 `setting/ratio_setting/model_ratio.go`。

### Testing Requirements

- 运行 `go test ./setting/model_setting/...` 覆盖 Claude 配置逻辑。
- 新增厂商配置时，参照 `claude_test.go` 补充对应测试。

### Common Patterns

```go
// 检查模型是否应保留 thinking 后缀（黑名单精确匹配）
if model_setting.ShouldPreserveThinkingSuffix(modelName) {
    // 跳过 thinking 参数注入 / 保留后缀不剥离
}

// 判断是否需要 C2R 转换
settings := model_setting.GetGlobalSettings()
if settings.ChatCompletionsToResponsesPolicy.IsChannelEnabled(channelID, channelType) {
    // 执行转换
}
```

## Dependencies

### Internal

- `setting/config/` — `GlobalConfig` 注册框架

### External

- `slices`（标准库）— 黑名单检查

<!-- MANUAL: 手动补充内容写在此分隔线下方，重新生成时保留 -->
