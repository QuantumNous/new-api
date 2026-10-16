# updateSpec 细粒度影响范围设计

## 背景

当前 `updateSpec` 的结果主要由 `reMake`、`reCompile`、`reRender`、`reSize` 等布尔字段表达。这些字段同时承担了三类职责：

1. spec 差异判断：哪些字段发生变化。
2. model 生命周期判断：是否需要重建、重编译、重新初始化。
3. chart 更新流水线判断：是否需要执行 data、scale domain、layout、render、animation 等阶段。

这种表达过粗，导致局部组件更新容易被提升成全图更新。例如 marker 数组从非空变为空时，marker exit 动画可以由 VRender 独立接管，但 VChart 仍可能走完整的 component、series、render 流水线，进而触发无关 label 的文本 update 动画。

## 目标

- 系统性降低 `updateSpec` 的不必要 `reMake`、`reCompile`、`reRender`。
- 让组件、系列、图表的更新影响范围显式化。
- 避免组件局部更新触发无关 series/data/scale/layout/animation 流程。
- 保持现有 API 行为兼容，优先面向正确、文档化调用方式优化。
- 支持渐进迁移，避免一次性重写所有组件和系列。

## 非目标

- 不改变公开 `updateSpec` API 语义。
- 不引入新的运行时依赖。
- 不在热路径加入大范围防御式兜底或深比较框架。
- 不通过大量 `onlyXChanged` 白名单长期维持行为。
- 不在 VChart 侧绕开 VRender 已提供的 marker exit 生命周期能力。

## 当前问题

### Chart 层流水线过固定

`BaseChart.updateSpec` 当前整体流程接近：

```text
chart config
-> global scale
-> region
-> component
-> series
-> reInit
-> updateData
-> updateGlobalScaleDomain
-> render
```

即使只有某个组件的局部配置变化，也容易带动后续 series、data、domain、render 阶段。

### result 语义不够表达依赖

`reMake` 表示必须销毁重建，但很多组件把“不确定如何局部更新”也升级为 `reMake`。`reRender` 表示需要渲染，但并不能说明是否需要 `reInit`、dataflow、scale domain 或 layout。

### 组件和系列边界不清

组件更新默认会与全图更新合并，缺少“只影响自身”“影响 layout”“影响 scale domain”“影响 series 数据映射”等更细粒度表达。系列更新也缺少 data、field、mark structure、style、animation 的差异分层。

## 设计概览

新增兼容式的 update effects，用于表达更新影响范围。旧字段继续保留，作为兼容层和保守回退。

建议在 `IUpdateSpecResult` 中增加可选字段：

```ts
interface IUpdateSpecEffects {
  remake?: boolean;
  compile?: boolean;
  render?: boolean;
  layout?: boolean;
  data?: boolean;
  scaleDomain?: boolean;
  series?: boolean;
  component?: boolean;
  animation?: boolean;
  localOnly?: boolean;
}
```

含义：

- `remake`：必须销毁并重建 chart/model/grammar。
- `compile`：需要重新编译 grammar 或 mark encode。
- `render`：需要触发 VRender/VGrammar 渲染。
- `layout`：需要重新布局。
- `data`：需要更新 chart data 或 series data。
- `scaleDomain`：需要重算全局或轴相关 domain。
- `series`：影响 series update/reInit。
- `component`：影响 component update/reInit。
- `animation`：影响动画配置或动画状态。
- `localOnly`：更新已由局部对象处理，不应继续推动全图流水线。

旧字段映射为 effects：

```text
reMake    -> remake + compile + data + scaleDomain + layout + render
reCompile -> compile + layout + render
reRender  -> render
reSize    -> layout + render
```

在迁移完成前，旧字段仍然是保守语义；effects 用来逐步收窄实际执行范围。

## Chart 层执行策略

Chart 层应从“固定流水线”改为“effect-driven pipeline”。

推荐逻辑：

1. VChart 处理顶层 spec、theme、background、size、type。
2. Chart 收集 chart、region、component、series 的 update effects。
3. 根据 effects 决定实际动作：
   - `remake`：走现有重建路径。
   - `compile`：清理/重编译必要 grammar。
   - `data`：更新 data view。
   - `scaleDomain`：更新 domain。
   - `layout`：设置 layout tag 并执行 layout。
   - `render`：触发 render。
   - `localOnly` 且无其他全局 effect：跳过后续全图流水线。
4. 只有明确影响 series 的变更才执行 series reInit。
5. 只有明确影响 data 或 domain 的变更才执行 dataflow/domain 更新。

## 组件更新职责

组件的 `updateSpec` 应表达真实影响范围，而不是统一升级到 `reMake`。

第一阶段建议迁移：

- marker：增删和 exit 生命周期只影响 marker component；VRender 接管 exit 动画时不触发 chart render。
- title：文本和样式变化通常影响 component/render；位置、orient、visible 可能影响 layout；不影响 series/data。
- legend：orient/layout 影响 layout；样式和 selected 状态影响自身或 series 过滤；不应默认 remake。
- axis：拆分外观、layout、scale/domain：
  - tick/label/grid 样式变化影响 component/render。
  - visible/orient/position 变化影响 layout。
  - domain、range、sync、field 相关变化才影响 scaleDomain 和 series 映射。
- brush/crosshair：交互组件优先局部更新；只有结构性变更才 remake。

## 系列更新职责

Series 的 `_compareSpec` 应将字段分层：

- data 变化：`data + scaleDomain + render`。
- x/y/angle/radius 等字段变化：通常 `compile + data + scaleDomain + layout/render`，不一定 remake。
- mark visible 或 mark 结构变化：`compile`，结构增删时才 `remake`。
- style 变化：优先 `render` 或 `compile encode`。
- animation 配置变化：`animation` 或 `compile`，避免默认 remake。
- label/totalLabel：区分 visible/layout/formatter/style，不同影响范围不同。

## 迁移计划

### 阶段 1：引入 effects，保持行为兼容

- 扩展 `IUpdateSpecResult`。
- 扩展 `mergeUpdateResult`。
- 新增旧字段到 effects 的兼容转换。
- Chart 层仍以旧行为为主，只记录和合并 effects。

验收标准：现有单测不变，effects 不改变行为。

### 阶段 2：Chart pipeline 接入 effects

- 将 `BaseChart.updateSpec` 的后续动作改为按 effects 执行。
- 保守处理旧字段：旧字段仍映射到完整影响范围。
- 增加测试覆盖“不应触发”的阶段。

验收标准：旧行为兼容，能够支持 `localOnly` 跳过全图 render。

### 阶段 3：迁移 marker/component 高收益路径

- marker 删除改为通用 `localOnly/component` effect。
- title/legend/axis 的典型非结构更新从 `reMake` 降级为具体 effects。
- 清理 marker-only 临时特例，避免白名单扩散。

验收标准：marker exit fade-out 和 scatter label 不复播回归测试稳定通过；组件局部更新不触发 series reInit。

### 阶段 4：迁移 series 高收益路径

- 拆分 data、field、style、animation、label 的影响范围。
- 降低不必要 series remake。
- 补充 field/data/domain 相关回归测试。

验收标准：常见 series updateSpec 不再默认 remake，数据和动画结果正确。

### 阶段 5：收敛旧字段语义

- 将 `reMake` 限定为真正结构性重建。
- 将 `reRender` 限定为渲染动作，不隐含 data/layout/series。
- 文档化组件和系列返回 update effects 的规则。

验收标准：新增组件和系列有清晰更新语义，不需要通过保守 remake 兜底。

## 测试策略

新增测试应覆盖两类断言：

1. 正向结果正确：图形属性、状态、动画、数据、布局最终正确。
2. 负向阶段不发生：无关 series 不 reInit，无关 label 不复播，无关 dataflow 不触发，无关 render 不执行。

优先回归集：

- marker 删除触发 exit fade-out，但 scatter label 不从 0 复播。
- custom highlight opacity 在 updateSpec/state refresh 后保持。
- title 文案变化不触发 series reInit。
- legend 样式变化不触发 dataflow。
- axis 外观变化不触发 series remake。
- axis domain/field 变化仍正确更新 series 映射。
- data 更新仍正确更新 scale domain 和 label。
- wordCloud remake 路径仍正确刷新 layout/compiler 状态。

## 风险与控制

- 风险：effects 过细导致漏更新。
  - 控制：第一阶段只记录不改变行为；迁移时按组件逐个收敛，并补负向测试。

- 风险：旧字段和 effects 语义冲突。
  - 控制：旧字段优先作为保守上界；effects 只能在明确路径中收窄。

- 风险：热路径增加额外分配或深比较。
  - 控制：复用现有 compare 逻辑；effects 是少量布尔字段，不引入通用 diff 框架。

- 风险：局部更新跳过 render 后对象残留。
  - 控制：局部生命周期必须由对应 component/VRender public API 明确接管；release/reMake 路径强制 flush pending exit。

## 开放问题

- effects 字段是否使用对象布尔值，还是 bitmask。对象更易读，bitmask 更低分配；第一阶段建议对象，性能验证后再决定是否压缩。
- `localOnly` 是否作为独立字段，还是由 `render=false && component=true` 推导。建议保留独立字段，避免误读。
- updateModelSpec 单模型更新是否同步接入 effects。建议纳入阶段 2，否则 model-level API 仍会触发粗粒度 dataflow。

## 推荐结论

采用兼容式 effects 设计，分阶段迁移。短期保留旧字段保证稳定性，中期让 marker、title、legend、axis、series 高收益路径逐步返回真实影响范围，长期将 `reMake` 收敛为真正结构性重建语义。
