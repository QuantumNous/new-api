<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-18 | Updated: 2026-05-18 -->

# billing_setting

## Purpose

管理模型计费模式配置，支持两种计费模式：
- `ratio`（默认）：按固定倍率计费，沿用传统 `ratio_setting` 逻辑
- `tiered_expr`：基于表达式的分层计费，由 `pkg/billingexpr` 引擎执行

配置存储于数据库，键名格式为 `billing_setting.billing_mode` 和 `billing_setting.billing_expr`。

**重要**：在修改此目录代码之前，必须先阅读 `pkg/billingexpr/expr.md`（CLAUDE.md Rule 7）。

## Key Files

| File | Description |
|------|-------------|
| `tiered_billing.go` | `BillingSetting` 结构体定义、计费模式读写访问器、向 `GlobalConfig` 注册逻辑 |

## For AI Agents

### Working In This Directory

- `BillingSetting` 通过 `config.GlobalConfig.Register("billing_setting", &billingSetting)` 注册，DB 键为 `billing_setting.billing_mode` / `billing_setting.billing_expr`。
- `billing_mode` 和 `billing_expr` 均为 `map[string]string`，key 为模型名。
- 获取计费模式：`GetBillingMode(model)` 未配置时返回 `BillingModeRatio`。
- 获取表达式：`GetBillingExpr(model)` 返回 `(string, bool)`，调用方须检查 bool。
- 修改前必须阅读 `pkg/billingexpr/expr.md`，了解表达式语言规范和 token 归一化规则。

### Testing Requirements

- 目前无独立单元测试文件；集成测试覆盖在 relay 层。
- 修改后手动验证 `GetBillingMode` / `GetBillingExpr` 返回值正确性。

### Common Patterns

```go
// 判断模型使用哪种计费模式
mode := billing_setting.GetBillingMode(modelName)
if mode == billing_setting.BillingModeTieredExpr {
    expr, ok := billing_setting.GetBillingExpr(modelName)
    // ... 使用 billingexpr 引擎计算
}
```

## Dependencies

### Internal

- `setting/config/` — `GlobalConfig` 注册框架
- `pkg/billingexpr/` — 表达式引擎（计费计算阶段调用，非直接依赖）

### External

- `github.com/samber/lo` — 集合工具

<!-- MANUAL: 手动补充内容写在此分隔线下方，重新生成时保留 -->
