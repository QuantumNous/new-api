# 分组模型专属倍率设计方案

## 背景问题

现在系统只能配置两类倍率：

- 模型倍率：影响所有分组里的这个模型。
- 分组倍率：影响这个分组里的所有模型。

所以如果 `plg` 分组整体是 `0.9`，但只想让 `plg` 里的 `gpt-5.5` 单独变成 `0.3`，目前没有一等配置能做到。改模型倍率会影响所有分组，改分组倍率会影响 `plg` 下所有模型。

需要新增一个二维覆盖配置：某个使用分组 + 某个模型 => 最终分组倍率。

## 目标

- 新增“分组模型专属倍率”配置。
- 保持现有 `GroupRatio` 和 `GroupGroupRatio` 行为不变。
- 让普通 relay、按次计费、表达式计费、WSS/realtime、异步任务/视频结算都使用同一套最终倍率。
- 日志里能看出这次命中了模型专属倍率，方便对账。
- 控制台配置 UI 简单可用，参考“分组间比例覆盖”的折叠表格，不做大矩阵。
- 官网 `/models` 和 `/pricing` 的分组价格展示要和真实扣费一致。

## 不做什么

- 不做渠道级价格覆盖。
- 第一版不做通配符/正则匹配。
- 不改变模型倍率、补全倍率、缓存倍率、图片倍率、音频倍率的含义。
- 模型专属倍率不是在普通分组倍率上再乘一次；它就是最终分组倍率。

## 新配置

新增配置项：`GroupModelRatio`

JSON 结构：

```json
{
  "plg": {
    "gpt-5.5": 0.3,
    "gpt-4o-mini": 0.75
  }
}
```

含义：

- 外层 key：使用分组，也就是 token/channel 使用的分组，例如 `plg`。
- 内层 key：计费用模型名，例如 `gpt-5.5`。
- value：这个分组下这个模型的最终分组倍率。

倍率允许为 `0`，表示这个模型在这个分组下免费；不允许小于 `0`。

`GroupModelRatio` 对所有用户身份分组生效。也就是说，只要请求最终使用 `plg` 分组，并且模型是 `gpt-5.5`，就命中 `GroupModelRatio.plg.gpt-5.5`，不管用户本身是 `default`、`vip` 还是 `enterprise`。

模型匹配要跟现有模型倍率系统对齐：使用 billing-facing 的模型 key，先走现有 `FormatMatchingModelName` 风格的标准化，再查配置。不要用上游实际模型名作为 key。日志里要记录最终命中的模型 key。

## 倍率优先级

最终分组倍率按这个顺序解析：

1. `GroupModelRatio[usingGroup][model]`
2. `GroupGroupRatio[userGroup][usingGroup]`
3. `GroupRatio[usingGroup]`
4. `1`

例子：

- `GroupRatio.plg = 0.9`
- `GroupGroupRatio.vip.plg = 0.8`
- `GroupModelRatio.plg.gpt-5.5 = 0.3`

结果：

- vip 用户使用 `plg + gpt-5.5`：最终倍率 `0.3`
- vip 用户使用 `plg + 其他模型`：最终倍率 `0.8`
- 普通用户使用 `plg + gpt-5.5`：最终倍率 `0.3`
- 普通用户使用 `plg + 其他模型`：最终倍率 `0.9`

## 后端设计

### 配置与解析

修改 `setting/ratio_setting/group_ratio.go`：

- 新增 `groupModelRatioMap`，类型为 `types.RWMap[string, map[string]float64]`。
- `GroupRatioSetting` 增加字段 `GroupModelRatio`，JSON key 为 `group_model_ratio`。
- 新增 `GetGroupModelRatio(groupName, modelName string) (ratio float64, ok bool, matchedModel string)`。
- 新增 `GetEffectiveGroupRatio(userGroup, usingGroup, modelName string) types.GroupRatioInfo`。
- 新增 `UpdateGroupModelRatioByJSONString(jsonStr string) error`。
- 新增 `CheckGroupModelRatio(jsonStr string) error`。
- 新增 `GroupModelRatio2JSONString()` 和 `GetGroupModelRatioCopy()`，和现有 `GroupGroupRatio` 保持对称。

`GetEffectiveGroupRatio` 是唯一推荐的计费解析入口，所有扣费路径都应该调用它，不再各自手写 `GetGroupRatio + GetGroupGroupRatio`。

兼容要求：

- 老配置里没有 `group_model_ratio` 时，要自动初始化为空 map，不能 panic。
- `model/option.go` 初始化时要写入 `common.OptionMap["GroupModelRatio"]`。
- 保存配置时继续走顶层 option key `GroupModelRatio`，和 `GroupRatio`、`GroupGroupRatio` 一样。
- 如果通过 `GroupRatio` 改名分组，也要同步改 `GroupModelRatio` 的外层 group key。

### GroupRatioInfo

修改 `types/price_data.go`：

```go
type GroupRatioInfo struct {
    GroupRatio                float64
    GroupSpecialRatio         float64
    HasSpecialRatio           bool
    GroupModelRatio           float64
    HasGroupModelRatio        bool
    GroupModelRatioGroup      string
    GroupModelRatioModel      string
}
```

其中：

- `GroupRatio` 永远是最终用于扣费的倍率。
- `GroupModelRatio*` 字段只描述来源，方便日志和前端展示。

### 主 relay 扣费

修改 `relay/helper/price.go`：

- `HandleGroupRatio` 先处理 `auto_group`，确定最终 `UsingGroup`。
- 然后调用 `ratio_setting.GetEffectiveGroupRatio(relayInfo.UserGroup, relayInfo.UsingGroup, relayInfo.OriginModelName)`。

这样会覆盖：

- token 按量计费
- 按次计费
- `tiered_expr` 表达式计费，因为表达式结算最后也乘 `GroupRatioInfo.GroupRatio`

### WSS / realtime / audio

`service/quota.go` 里有独立的 realtime 预扣逻辑，现在直接调用 `GetGroupRatio` 和 `GetGroupGroupRatio`。这里必须改为 `GetEffectiveGroupRatio`，否则 realtime/audio 会漏掉模型专属倍率。

### 异步任务和视频结算

这些路径不一定经过 `HandleGroupRatio`：

- `service/task_billing.go`
- `controller/task_video.go`

它们现在也有手写 `GetGroupRatio + GetGroupGroupRatio`，要统一改成 `GetEffectiveGroupRatio(group, group, modelName)`。

任务是异步的，所以还要把来源信息持久化到 `model.TaskBillingContext`：

```go
GroupModelRatio      float64 `json:"group_model_ratio,omitempty"`
GroupModelRatioGroup string  `json:"group_model_ratio_group,omitempty"`
GroupModelRatioModel string  `json:"group_model_ratio_model,omitempty"`
```

否则任务完成后再生成日志时，只剩数字倍率，看不出当时命中了哪个模型专属配置。

### 配置保存与校验

修改 `model/option.go`：

```go
case "GroupModelRatio":
    err = ratio_setting.UpdateGroupModelRatioByJSONString(value)
```

修改 `controller/option.go`：

```go
case "GroupModelRatio":
    err = ratio_setting.CheckGroupModelRatio(option.Value.(string))
```

校验规则：

- JSON 必须是 `map[string]map[string]float64`。
- 倍率不能小于 `0`。
- JSON 解析使用项目封装的 `common.UnmarshalJsonStr`。

## 日志设计

日志 `other` 里保留：

- `group_ratio`：最终生效倍率，已有字段，继续保留。
- `user_group_ratio`：命中 `GroupGroupRatio` 时写入，已有字段。
- `group_model_ratio`：命中 `GroupModelRatio` 时写入。
- `group_model_ratio_group`：命中的分组 key。
- `group_model_ratio_model`：命中的模型 key。

建议新增后端 helper：

```go
AppendGroupRatioSource(other map[string]interface{}, info types.GroupRatioInfo)
```

所有日志路径统一调用它，避免 text/audio/WSS/MJ/task 各写一套。

使用日志前端展示：

- 普通分组倍率：`Economy · 0.9x`
- 用户组专属倍率：详情里继续显示 `User Exclusive Ratio`
- 模型专属倍率：列表显示类似 `Economy · model 0.3x`，详情显示 `Group Model Ratio 0.3x`

## 控制台 UI

修改 `web/default/src/features/system-settings/models/`：

- settings defaults/types/form/save flow 都加 `GroupModelRatio`。
- 在分组定价页面新增“分组模型专属倍率”区域。
- UI 参考现有“分组间比例覆盖”：
  - 外层折叠：使用分组，例如 `plg`
  - 内层表格：模型名 + 倍率
  - 支持新增、编辑、删除
  - 模型名可以从已知模型列表中选，也允许手动输入

所有新增用户可见文案都要补齐 `web/default/src/i18n/locales/` 下 8 种语言。

## 官网和价格展示

你指出的 `https://flatkey.ai/zh/models` 很关键。这里的 “Pricing by Group” 当前按普通分组倍率展示，例如 `plg 0.9x`。如果实际扣费已经被 `GroupModelRatio` 覆盖成 `0.3x`，官网继续显示 `0.9x` 就是错的。

因此第一版就必须让公开价格展示支持 `GroupModelRatio`。

后端 pricing API：

- `/api/website/pricing` 响应增加 `group_model_ratio`。
- 结构和 `GroupModelRatio` 一样：

```json
{
  "plg": {
    "gpt-5.5": 0.3
  }
}
```

- bump `pricing_version`，让缓存刷新。

官网 `website/`：

- `website/src/lib/pricing.ts` 类型增加 `groupModelRatio`。
- 价格计算 helper 优先使用 `groupModelRatio[group][model]`。
- `website/src/components/pricing-model-browser.tsx` 的 Ratio 列也必须用同一个 effective ratio helper，不能继续直接读 `props.groupRatio[group]`。
- 命中模型专属倍率时，Ratio 列可以显示 `0.3x`，旁边加一个小的 `model` 标记。

控制台模型价格页如果也展示分组价，也要同步检查并使用同一套 effective ratio。

## 测试要求

后端单测：

- `GroupModelRatio` 优先于 `GroupRatio`。
- `GroupModelRatio` 优先于 `GroupGroupRatio`。
- 未命中模型专属倍率时回退到 `GroupGroupRatio`。
- 再未命中时回退到 `GroupRatio`。
- 都没有时回退到 `1`。
- 负数倍率保存失败。
- `tiered_expr` 预扣使用覆盖后的最终倍率。
- WSS/realtime 使用覆盖后的最终倍率。
- 异步任务 token 重算使用覆盖后的最终倍率，并保留来源 metadata。

前端检查：

```bash
cd web/default
bun run typecheck
bun run i18n:sync
```

官网检查：

```bash
cd website
bun run typecheck
bun test -- pricing
bun run build
```

手工 QA：

- 配置 `GroupRatio.plg = 0.9`
- 配置 `GroupModelRatio.plg.gpt-5.5 = 0.3`
- 请求 `plg + gpt-5.5`，确认日志显示 `plg · model 0.3x`
- 请求 `plg + 其他模型`，确认日志显示 `plg · 0.9x`
- 打开日志详情，确认来源标签正确
- 打开官网 `/models`，确认该模型的 “Pricing by Group” 显示 `plg 0.3x` 且价格按 `0.3` 算
- 如果目标模型支持 realtime/audio，也跑一次该路径

## 多节点行为

配置仍走现有 options/config 体系。所有节点加载同一份 DB 配置，不依赖单机内存状态保证正确性。

注意：配置更新后的缓存刷新行为应沿用现有 `GroupRatio` / `GroupGroupRatio` 机制，不新增进程本地的独立真相源。

## 部署建议

Router deploy: required。

原因：影响 `/v1` relay 计费、realtime、表达式计费、任务/视频结算。

Other deploy targets:

- `newapi-console` required：配置 UI、日志 UI、pricing API 都在这里。
- `newapi-web` required：官网 `/models` 和 `/pricing` 会展示受影响后的分组价格。
- legacy `newapi`：如果仍作为 fallback API/console 服务，也需要部署。
- Terraform / Cloudflare：不需要。

上线前最低验证：

- 后端 targeted tests 通过。
- `web/default` typecheck 和 i18n sync 通过。
- `website` typecheck、pricing test、build 通过。
- staging 上用一个命中覆盖模型和一个未命中模型分别请求并核对日志和官网价格。
