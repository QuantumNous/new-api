<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-18 | Updated: 2026-05-18 -->

# setting/ratio_setting

## Purpose

管理模型计费比率系统，是传统固定倍率计费（`BillingModeRatio`）的核心实现。维护以下四类比率：
- **模型比率**（`model_ratio.go`）：每个模型相对于 $0.002/1K tokens 的倍率，内置 40+ 主流模型默认值
- **分组比率**（`group_ratio.go`）：按用户分组叠加的价格系数
- **暴露比率**（`expose_ratio.go`）：对外展示的价格比率（与实际计费比率可以不同）
- **缓存比率**（`cache_ratio.go`）：缓存命中时的折扣系数

汇率常量：`USD2RMB = 7.3`，`USD = 500`（即 $1 = 500 quota 单位）。

## Key Files

| File | Description |
|------|-------------|
| `model_ratio.go` | 内置模型比率表（40+ 模型）、`GetModelRatio()` / `SetModelRatio()` |
| `group_ratio.go` | 分组比率读写、默认分组比率 |
| `expose_ratio.go` | 对外暴露价格比率配置 |
| `exposed_cache.go` | 暴露比率的缓存层 |
| `cache_ratio.go` | 缓存命中折扣比率配置 |
| `compact_suffix.go` | 模型名称紧凑后缀处理工具 |

## For AI Agents

### Working In This Directory

- 新增模型时，在 `model_ratio.go` 的 `defaultModelRatio` map 中添加条目，格式注释为 `// $X / 1M tokens`。
- 模型比率单位：`1.0` 对应 $0.002/1K tokens（即 $2/1M tokens）。常见换算：`gpt-4o` = 1.25（$2.5/1M）。
- 支持通配符模式（如 `"gpt-4-gizmo-*": 15`），匹配时使用前缀/通配符逻辑。
- 分组比率（`group_ratio`）与模型比率相乘得到最终计费系数。
- 暴露比率（`expose_ratio`）仅影响前端展示，不影响实际扣费。

### Testing Requirements

- 目前无独立单元测试文件。
- 新增模型比率后，通过 relay 层的计费路径验证扣费金额正确性。

### Common Patterns

```go
// 获取模型比率
ratio := ratio_setting.GetModelRatio(modelName)

// 获取分组比率
groupRatio := ratio_setting.GetGroupRatio(groupName)

// 实际计费系数 = modelRatio * groupRatio
finalRatio := ratio * groupRatio
```

## Dependencies

### Internal

- `setting/operation_setting/` — 运营配置（计费上下文）
- `types/` — relay 类型定义
- `common/` — 工具函数

### External

无

<!-- MANUAL: 手动补充内容写在此分隔线下方，重新生成时保留 -->
