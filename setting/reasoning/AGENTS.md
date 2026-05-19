<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-18 | Updated: 2026-05-18 -->

# setting/reasoning

## Purpose

提供推理模型 effort 后缀的解析工具函数，用于从模型名称中提取推理强度级别（如 `-high`、`-low`、`-max` 等后缀），并还原为基础模型名称。该包不持有任何可持久化配置，仅提供纯函数工具。

支持的后缀集合：
- 通用：`-max`、`-xhigh`、`-high`、`-medium`、`-low`、`-minimal`
- OpenAI 专用：`-high`、`-minimal`、`-low`、`-medium`、`-none`、`-xhigh`
- DeepSeek V4 专用：`-none`、`-max`

## Key Files

| File | Description |
|------|-------------|
| `suffix.go` | `TrimEffortSuffix()`、`ParseOpenAIReasoningEffortFromModelSuffix()`、`ParseDeepSeekV4ThinkingSuffix()` |

## For AI Agents

### Working In This Directory

- 所有函数均为无副作用纯函数，无全局状态，无需初始化。
- `TrimEffortSuffix(modelName)` 返回 `(baseModel, level, found)`；`found=false` 表示模型名不含已知后缀。
- `ParseOpenAIReasoningEffortFromModelSuffix` 专门处理 OpenAI reasoning effort 后缀集，返回 `(effort, baseModel)`；未匹配时 `effort=""`, `baseModel=modelName`。
- `ParseDeepSeekV4ThinkingSuffix` 专门处理 `deepseek-v4-*` 前缀的模型，区分 `-none`（禁用 thinking）和 `-max`（最大 thinking）。
- 新增厂商的 effort 后缀时，先定义新的 `[]string` 后缀集，再调用 `TrimEffortSuffixWithSuffixes`，不要修改通用 `EffortSuffixes` 列表。

### Testing Requirements

- 目前无独立测试文件；函数逻辑简单，可在调用方集成测试中覆盖。
- 新增后缀集时建议添加表驱动单元测试。

### Common Patterns

```go
// relay 层解析模型 effort
effort, baseModel := reasoning.ParseOpenAIReasoningEffortFromModelSuffix(requestedModel)
if effort != "" {
    // 注入 reasoning_effort 参数到上游请求
}

// DeepSeek V4 thinking 解析
baseModel, thinkingType, effortLevel, ok := reasoning.ParseDeepSeekV4ThinkingSuffix(modelName)
```

## Dependencies

### Internal

无

### External

- `github.com/samber/lo` — `lo.Find` 用于后缀匹配

<!-- MANUAL: 手动补充内容写在此分隔线下方，重新生成时保留 -->
