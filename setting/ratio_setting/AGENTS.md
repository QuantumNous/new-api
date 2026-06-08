<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-18 | Updated: 2026-06-08 -->

# setting/ratio_setting

## Purpose

管理模型计费比率系统，是传统固定倍率计费（`BillingModeRatio`）的核心实现。维护以下六类比率：
- **模型比率**（`model_ratio.go`）：每个模型相对于 $0.002/1K tokens 的倍率，内置 100+ 主流模型默认值；另含 `defaultModelPrice`（按次定价）、`defaultAudioRatio`、`defaultAudioCompletionRatio`、`defaultImageRatio`、`defaultCompletionRatio`
- **分组比率**（`group_ratio.go`）：按用户分组叠加的价格系数，包含跨分组比率（`groupGroupRatio`）和特殊可用分组（`groupSpecialUsableGroup`）
- **暴露比率开关**（`expose_ratio.go`）：`atomic.Bool` 控制是否向外暴露价格数据
- **暴露数据缓存**（`exposed_cache.go`）：对外 API 返回的比率快照，TTL 30s，含 model_ratio / completion_ratio / cache_ratio / create_cache_ratio / model_price 五项
- **缓存比率**（`cache_ratio.go`）：提示词缓存命中时的折扣系数（`cacheRatioMap`）和创建缓存的溢价系数（`createCacheRatioMap`，默认 1.25）
- **紧凑后缀**（`compact_suffix.go`）：`-openai-compact` 后缀用于 compact 模式通配符定价

汇率常量：`USD2RMB = 7.3`，`USD = 500`（即 $1 = 500 quota 单位），`RMB = USD / USD2RMB`。

## Key Files

| File | Description |
|------|-------------|
| `model_ratio.go` | 内置模型比率表（100+ 模型）、`defaultModelPrice`、`defaultAudioRatio/CompletionRatio`、`defaultImageRatio`、`defaultCompletionRatio`；`InitRatioSettings()`（一次性初始化所有 map）；`GetModelRatio()`、`GetModelPrice()`、`GetCompletionRatio()`、`GetCompletionRatioInfo()`、`FormatMatchingModelName()`、`GetModelRatioOrPrice()`；按需计算 completion 倍率的 `getHardcodedCompletionModelRatio()` |
| `group_ratio.go` | `GroupRatioSetting`（含三个 `RWMap` 字段，注册键 `group_ratio_setting`）、`GetGroupRatio()`、`GetGroupGroupRatio()`、`GetGroupRatioSetting()`、`CheckGroupRatio()` |
| `expose_ratio.go` | `exposeRatioEnabled`（`atomic.Bool`）、`SetExposeRatioEnabled()`、`IsExposeRatioEnabled()` |
| `exposed_cache.go` | `GetExposedData()` — 双检锁 30s TTL 快照；`InvalidateExposedDataCache()` — 任意比率更新后由回调触发失效 |
| `cache_ratio.go` | `defaultCacheRatio`、`defaultCreateCacheRatio`；`GetCacheRatio()`、`GetCreateCacheRatio()`、`UpdateCacheRatioByJSONString()`、`UpdateCreateCacheRatioByJSONString()` |
| `compact_suffix.go` | `CompactModelSuffix = "-openai-compact"`、`CompactWildcardModelKey`、`WithCompactModelSuffix()` |

## For AI Agents

### Working In This Directory

- 新增模型时，在 `model_ratio.go` 的 `defaultModelRatio` map 中添加条目，格式注释为 `// $X / 1M tokens`；若为按次计费模型，改在 `defaultModelPrice` 中添加（单位：美元/次）。
- 模型比率单位：`1.0` 对应 $0.002/1K tokens（即 $2/1M tokens）。常见换算：`gpt-4o` = 1.25（$2.5/1M），`gpt-4` = 15（$30/1M）。
- `GetModelRatio()` 返回 `(ratio float64, ok bool, name string)`；未命中时，SelfUseMode 下返回 `(37.5, true, name)`，否则返回 `(37.5, false, name)`。
- `GetModelRatioOrPrice()` 优先取 `modelPriceMap`（`usePrice=true`），未命中才取 `modelRatioMap`；调用方根据 `usePrice` 决定计费方式。
- `FormatMatchingModelName()` 对 Gemini 思考预算模型（含 `-thinking-`）和 gizmo 通配符模型做名称规范化，**所有内部 Get/Contains 函数调用前均会先执行此步骤**。
- `InvalidateExposedDataCache()` 作为回调注入 `types.LoadFromJsonStringWithCallback()`，任意比率 JSON 更新后自动失效暴露缓存；直接调用 `exposedData.Store(nil)` 等价。
- 分组比率注册键为 `group_ratio_setting`（整个 `GroupRatioSetting` 结构体序列化），不是单独的 `group_ratio`。
- `groupSpecialUsableGroup`：key 前缀 `-:` 表示从用户可用分组中移除，无前缀表示追加。

### Testing Requirements

- 目前无独立单元测试文件。
- 新增模型比率后，通过 relay 层的计费路径验证扣费金额正确性。
- 修改 `getHardcodedCompletionModelRatio()` 中的前缀匹配逻辑时，添加表驱动测试覆盖边界模型名。

### Common Patterns

```go
// 初始化（程序启动时调用一次）
ratio_setting.InitRatioSettings()

// 获取模型比率或按次价格
ratio, usePrice, exists := ratio_setting.GetModelRatioOrPrice(modelName)

// 获取分组比率
groupRatio := ratio_setting.GetGroupRatio(groupName)  // 未找到返回 1.0

// 获取缓存折扣比率
cacheRatio, ok := ratio_setting.GetCacheRatio(modelName)       // 默认 1
createRatio, ok := ratio_setting.GetCreateCacheRatio(modelName) // 默认 1.25

// 对外暴露全量比率（带 30s TTL 缓存）
data := ratio_setting.GetExposedData()
```

## Dependencies

### Internal

- `setting/operation_setting/` — `SelfUseModeEnabled`（`GetModelRatio` 未命中时的行为分支）
- `setting/config/` — `GlobalConfig` 注册框架（`group_ratio_setting`）
- `types/` — `RWMap`、`LoadFromJsonString`、`LoadFromJsonStringWithCallback`
- `common/` — `Marshal`、`SysError`、`SysLog`

### External

- `github.com/gin-gonic/gin` — `gin.H`（暴露数据缓存类型）

<!-- MANUAL: 手动补充内容写在此分隔线下方，重新生成时保留 -->
