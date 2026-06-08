<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-18 | Updated: 2026-06-08 -->

# setting/reasoning

## Purpose

提供推理模型 effort 后缀的解析工具函数，用于从模型名称中提取推理强度级别（如 `-high`、`-low`、`-max` 等后缀），并还原为基础模型名称。该包不持有任何可持久化配置，仅提供纯函数工具。

支持的后缀集合（均定义为包级 `var`，可被外部读取）：
- `EffortSuffixes`（通用）：`-max`、`-xhigh`、`-high`、`-medium`、`-low`、`-minimal`
- `OpenAIEffortSuffixes`：`-high`、`-minimal`、`-low`、`-medium`、`-none`、`-xhigh`
- `DeepSeekV4EffortSuffixes`：`-none`、`-max`

## Key Files

| File | Description |
|------|-------------|
| `suffix.go` | `TrimEffortSuffix()`、`TrimEffortSuffixWithSuffixes()`（底层实现，接受自定义后缀集）、`ParseOpenAIReasoningEffortFromModelSuffix()`、`ParseDeepSeekV4ThinkingSuffix()` |

## For AI Agents

### Working In This Directory

- 所有函数均为无副作用纯函数，无全局状态，无需初始化。
- `TrimEffortSuffix(modelName)` → `(baseModel, level, found)`；`level` 已去除前缀 `-`（如 `"high"`），`found=false` 表示模型名不含已知通用后缀。
- `TrimEffortSuffixWithSuffixes(modelName, suffixes)` 是底层实现，新增厂商后缀时直接调用此函数，**不要修改**通用 `EffortSuffixes` 列表。
- `ParseOpenAIReasoningEffortFromModelSuffix(modelName)` → `(effort, baseModel)`；未匹配时 `effort=""`, `baseModel=modelName`（注意返回顺序：effort 在前，baseModel 在后）。
- `ParseDeepSeekV4ThinkingSuffix(modelName)` → `(baseModel, thinkingType, effort, ok)`；需同时满足 `deepseek-v4-` 前缀才返回 `ok=true`；`-none` → `thinkingType="disabled"`，`-max` → `thinkingType="enabled", effort="max"`。
- 该函数对 `deepseek-v4-` 前缀有硬性校验，非此前缀的模型即使带有 `-none`/`-max` 后缀也返回 `ok=false`。

### Testing Requirements

- 目前无独立测试文件；函数逻辑简单，可在调用方集成测试中覆盖。
- 新增后缀集时建议添加表驱动单元测试（尤其注意边界：模型名本身含 `-max` 子串但不以其结尾的情况）。

### Common Patterns

```go
// relay 层解析 OpenAI reasoning effort
effort, baseModel := reasoning.ParseOpenAIReasoningEffortFromModelSuffix(requestedModel)
if effort != "" {
    // 注入 reasoning_effort 参数到上游请求
}

// 通用后缀解析（自定义后缀集）
baseModel, level, found := reasoning.TrimEffortSuffixWithSuffixes(modelName, myVendorSuffixes)

// DeepSeek V4 thinking 解析
baseModel, thinkingType, effortLevel, ok := reasoning.ParseDeepSeekV4ThinkingSuffix(modelName)
if ok && thinkingType == "disabled" {
    // 关闭 thinking
}
```

## Dependencies

### Internal

无

### External

- `github.com/samber/lo` — `lo.Find` 用于后缀匹配

<!-- MANUAL: 手动补充内容写在此分隔线下方，重新生成时保留 -->
