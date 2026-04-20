# 新增计费规则 SOP

本文档描述如何在 `new-api` 中新增一条新的计费规则，并确保它能完整打通：

- 后端配置存储
- 运行时缓存刷新
- 实际扣费计算
- 管理后台可配置
- 自动化测试

本文以这次已经落地的 `video_input` 条件倍率为例。它的语义是：

- 基础价格仍来自 `ModelRatio` 或 `ModelPrice`
- 当任务请求的 `metadata.content` 中包含 `video_url` 时
- 再额外乘一个条件倍率，例如 `0.5`

## 1. 先判断你要加的是哪一类规则

在动手前，先分清规则属于哪一层：

### A. 静态模型价格

适用场景：

- 某模型永远按固定倍率收费
- 某模型永远按次收费
- 某模型的补全倍率、缓存倍率、图片倍率、音频倍率是固定的

优先复用现有配置项：

- `ModelRatio`
- `ModelPrice`
- `CompletionRatio`
- `CacheRatio`
- `CreateCacheRatio`
- `ImageRatio`
- `AudioRatio`
- `AudioCompletionRatio`

### B. 条件型规则

适用场景：

- 只有在请求满足某条件时才生效
- 条件来自任务请求内容、元数据、时长、分辨率、输入介质等

这类规则不要硬塞进 `ModelRatio`。当前推荐单独走：

- `TaskConditionRatio`

当前已落地的 JSON 结构示例：

```json
{
  "video_input": {
    "doubao-seedance-1-0-pro-250528": 0.5
  }
}
```

## 2. 明确计费公式

必须先写清楚公式，否则后面容易把“基础价格”和“条件倍率”混在一起。

建议先回答这 4 个问题：

1. 基础价格从哪里来，是 `ModelRatio`、`ModelPrice`，还是别的？
2. 规则是覆盖基础价格，还是在基础价格上再乘一层？
3. 规则只影响预扣，还是预扣和结算都要一致？
4. 规则的触发条件来自哪里，模型名、请求体、元数据，还是任务结果？

以 `video_input` 为例：

- 基础价格：`ModelRatio`
- 规则类型：附加倍率
- 触发条件：任务请求 `metadata.content` 中是否出现 `video_url`
- 作用阶段：预扣和异步结算都要一致

## 3. 设计配置载体

如果是全新规则类型，先确定要不要新增一个新的 option key。

当前仓库里，条件型任务倍率已经有现成模式：

- 配置项：`TaskConditionRatio`
- 后端读写入口：
  - `setting/ratio_setting/task_condition_ratio.go`
  - `model/option.go`
  - `controller/option.go`

如果你要新增的是同类条件，例如：

- `seconds`
- `resolution`
- `image_input`

通常不需要再新增一个 option key，只要继续扩展 `TaskConditionRatio` 的 JSON 结构即可。

如果你要新增的是完全不同的一大类计费逻辑，再考虑单独加新的 option key。

## 4. 后端存储与缓存接入

如果要新增或扩展一个配置项，后端至少要接这 3 个点。

### 4.1 设置读写帮助函数

参考：

- `setting/ratio_setting/task_condition_ratio.go`

至少要提供：

- `XXX2JSONString()`
- `UpdateXXXByJSONString()`
- `GetXXX(...)`
- 必要时提供 `GetXXXCopy()`

要求：

- JSON 解析失败时返回错误
- 更新成功后要触发 `InvalidateExposedDataCache`

### 4.2 启动时载入到 `OptionMap`

参考：

- `model/option.go`

至少要加两处：

1. `InitOptionMap()` 中把该配置放进 `common.OptionMap`
2. `updateOptionMap()` 中支持运行时更新

### 4.3 支持 `PUT /api/option/`

参考：

- `controller/option.go`

必须补 `case`，否则前端调用了也不会更新运行时缓存。

## 5. 接入实际扣费逻辑

这一步才是核心。配置能保存，不代表会参与扣费。

### 5.1 找到真正计费发生的层

本项目常见位置：

- 文本类：`service/quota.go`、`service/text_quota.go`
- 任务类：`service/task_billing.go`
- 特定渠道适配器：`relay/channel/...`

### 5.2 决定规则在什么阶段产生

对于任务模型，推荐在 adaptor 里给出 `OtherRatios`，再由公共任务计费逻辑统一乘进去。

参考：

- `relay/channel/task/doubao/adaptor.go`
- `service/task_billing.go`

这次 `video_input` 的做法是：

1. 在 `TaskAdaptor.EstimateBilling()` 里判断请求是否带视频输入
2. 返回：

```go
map[string]float64{"video_input": ratio}
```

3. 在 `service/task_billing.go` 中，`OtherRatios` 会被统一计入：

- 预扣日志
- 异步任务实际结算

### 5.3 不要只改预扣，不改结算

异步任务尤其要注意：

- 预扣用了一套逻辑
- 成功后按 token 或结果重算时又是一套逻辑

如果两边没有复用同一组 `OtherRatios`，最终会出现：

- 预扣对
- 实际结算错

当前任务计费已经在 `service/task_billing.go` 里统一把 `OtherRatios` 乘进去了，新增规则尽量复用这条链。

## 6. 后台配置入口

如果规则要给管理员配置，至少要决定支持哪些入口。

当前这份仓库建议两条都补：

### 6.1 手动 JSON 编辑

参考：

- `web/src/pages/Setting/Ratio/ModelRatioSettings.jsx`
- `web/src/pages/Setting/Ratio/taskConditionRatio.js`

适合：

- 先快速验证规则是否可配置
- 新规则刚上线时先有一个可靠入口

### 6.2 可视化编辑

参考：

- `web/src/pages/Setting/Ratio/components/ModelPricingEditor.jsx`
- `web/src/pages/Setting/Ratio/hooks/useModelPricingEditorState.js`
- `web/src/pages/Setting/Ratio/modelPricingTaskCondition.js`

适合：

- 管理员长期使用
- 价格与倍率一起可视化维护

注意：

- 手动编辑和可视化编辑是两条不同链路
- 只改其中一条，另一条页面通常看不到

这次 `video_input` 一开始只改了手动编辑页，后来又补到了可视化编辑页。

## 7. `/api/pricing` 展示层要不要改

这个要按规则类型判断。

### 需要改的情况

- 你希望模型广场直接展示这条规则
- 你希望前端筛选、预览、展示字段能看到它

### 不一定要改的情况

- 规则只影响运行时扣费
- 模型广场只展示基础价格

这次 `video_input` 的处理方式是：

- `/api/pricing` 仍以基础 `model_ratio` 为主
- 条件倍率由配置页和任务计费逻辑维护
- 不额外把它塞进 `pricing.data[*]` 的独立字段

如果后续你希望模型广场也直接显示条件倍率，需要继续扩展：

- `model/pricing.go`
- 对应前端展示组件

## 8. 测试清单

新增计费规则时，至少补 3 类测试。

### 8.1 配置解析测试

参考：

- `setting/ratio_setting/task_condition_ratio_test.go`

至少覆盖：

- 空 JSON
- 正常 JSON
- 取到规则
- 取不到规则

### 8.2 业务逻辑测试

参考：

- `relay/channel/task/doubao/adaptor_test.go`

至少覆盖：

- 条件命中时能产出正确 `OtherRatios`
- 未命中时不产出倍率
- 新规则优先级是否高于旧硬编码 fallback

### 8.3 前端状态/序列化测试

参考：

- `web/src/pages/Setting/Ratio/taskConditionRatio.test.js`
- `web/src/pages/Setting/Ratio/modelPricingTaskCondition.test.js`

至少覆盖：

- 从 option 字符串正确解析
- 保存时保留其它条件并只更新当前条件
- 清空值时正确删除对应 block

## 9. 验证 SOP

开发完成后，建议按下面顺序验证。

### 9.1 跑自动化测试

```powershell
go test ./setting/ratio_setting ./relay/channel/task/doubao
node --test src/pages/Setting/Ratio/taskConditionRatio.test.js src/pages/Setting/Ratio/modelPricingTaskCondition.test.js
```

前端测试在 `web/` 目录执行。

### 9.2 实际保存配置

用管理员在 WebUI 中：

1. 打开系统设置
2. 进入分组与模型定价设置
3. 配置你的新规则
4. 点击保存

### 9.3 查数据库或 option 接口

```sql
select key, value from options where key = 'TaskConditionRatio';
```

或者调：

```http
GET /api/option/
```

### 9.4 发真实请求验证扣费

对目标模型发一条命中条件的请求，再检查：

- 实际计费日志
- 任务日志中的 `other`
- 必要时看 `service/task_billing.go` 相关日志输出

## 10. `video_input` 现成示例

这次规则落点如下：

- 后端配置：
  - `setting/ratio_setting/task_condition_ratio.go`
  - `model/option.go`
  - `controller/option.go`
- 任务适配器：
  - `relay/channel/task/doubao/adaptor.go`
- 手动配置页：
  - `web/src/pages/Setting/Ratio/ModelRatioSettings.jsx`
  - `web/src/pages/Setting/Ratio/taskConditionRatio.js`
- 可视化配置页：
  - `web/src/pages/Setting/Ratio/components/ModelPricingEditor.jsx`
  - `web/src/pages/Setting/Ratio/hooks/useModelPricingEditorState.js`
  - `web/src/pages/Setting/Ratio/modelPricingTaskCondition.js`
- 测试：
  - `setting/ratio_setting/task_condition_ratio_test.go`
  - `relay/channel/task/doubao/adaptor_test.go`
  - `web/src/pages/Setting/Ratio/taskConditionRatio.test.js`
  - `web/src/pages/Setting/Ratio/modelPricingTaskCondition.test.js`

## 11. 常见坑

### 只改数据库，不改运行时缓存

后果：

- `options` 表里看起来对了
- 运行中的服务仍然没生效

解决：

- 通过 `PUT /api/option/` 写回
- 或确保后端的 option 更新入口已接入

### 只改手动编辑页，不改可视化编辑页

后果：

- 管理员在常用页面看不到新字段

### 只改预扣，不改异步结算

后果：

- 任务完成后真实扣费不对

### 把条件规则塞进 `ModelRatio`

后果：

- 破坏原有 `model -> float` 约定
- 上游同步和现有前端容易一起出问题

## 12. 推荐最小落地顺序

如果你要快速上线一条新计费规则，建议按这个顺序做：

1. 先把公式写清楚
2. 后端先接 `option` 存储和读取
3. 在实际计费链路把规则乘进去
4. 先补手动 JSON 配置页
5. 补测试
6. 再补可视化编辑页
7. 最后决定要不要扩展 `/api/pricing` 展示层
