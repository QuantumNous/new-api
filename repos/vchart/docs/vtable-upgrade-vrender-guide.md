# VTable 升级 VRender 指南

> 面向对象：准备在 VTable / VTable-Gantt / VTable-Sheet 等上层包中升级 `@visactor/vrender*` 依赖的维护者。
>
> 资料边界：当前没有在 VChart 仓库中找到一份完整的“VChart 升级 VRender 全流程”正式文档。本指南依据本地可验证材料整理：VRender2 的 D3 state-engine 接入文档、VChart 升级提交与回归测试、以及 VTable 当前调用面抽查。

## 1. 资料来源

### VRender2 侧

- `/Users/bytedance/Documents/GitHub/VRender2/docs/refactor/state-engine/D3_UPPER_LAYER_ADOPTION_GUIDE.md`
- `/Users/bytedance/Documents/GitHub/VRender2/docs/refactor/state-engine/D3_FINAL_SUMMARY.md`
- `/Users/bytedance/Documents/GitHub/VRender2/docs/refactor/state-engine/graphic-state-animation-refactor-expectation.md`
- `/Users/bytedance/Documents/GitHub/VRender2/docs/refactor/state-engine/D3_VCHART_APP_SCOPED_ALIGNMENT_PLAN.md`
- `/Users/bytedance/Documents/GitHub/VRender2/docs/refactor/state-engine/D3_POST_ALPHA_WRAPUP_PLAN.md`

这些文档给出的稳定口径是：

1. Browser 主路径已经按 alpha ready 处理，Node 不应等强宣称。
2. 新接入优先使用 app-scoped 入口：`createBrowserVRenderApp()` / `createNodeVRenderApp()`，再由 `app.createStage()` 创建 stage。
3. `createStage()` 仍是 compat surface，新代码不要继续扩展它。
4. 状态静态真值按 `baseAttributes + resolvedStatePatch -> attribute` 理解，动画不是新的真值源。
5. shared-state 以 Group-first ownership 为主模型，`stateProxy` 只作为实例级 escape hatch，不是共享状态主模型。
6. 当前只承诺顶层 `graphic.attribute.xxx = value` 的兼容边界，不应继续依赖任意深层 nested mutation。
7. root app creator 是 browser/node 默认 bootstrap 入口，不是细粒度按需装配入口。

### VChart 侧

本地 VChart 升级相关提交给出迁移证据：

- `6f66026cf chore: unblock VChart validation on alpha.2`
- `ea7a0007c chore: align VChart with VRender alpha app and state`
- `2a1b6ca9a chore: enable VChart validation on VRender alpha.8`
- `6bc51096f test: cover VChart animation static truth with manual ticker`
- `db138714d chore: validate VRender alpha.9 animation fix`
- `eb33d40aa fix: stabilize VChart animations on VRender alpha.15`
- `39df8001f fix(vchart): align with VRender state and release contracts`
- `6fc9f45b3 fix(vchart): let marker exits finish fade-out`

关键落点：

- VChart 最终依赖统一到 `@visactor/vrender*` `1.1.0-alpha.15`。
- `packages/vchart/src/compile/stage-app.ts` 增加了 app 解析、fallback app 复用和引用计数释放。
- `packages/vchart/src/compile/compiler.ts` 区分 external stage 与 internal stage，防止释放外部传入 stage。
- `packages/vchart/src/util/graphic-state.ts` 与 `packages/vchart/src/mark/base/base-mark.ts` 对齐 VRender 新状态模型。
- `packages/vchart/__tests__/unit/animation/manual-ticker.test.ts` 用 `ManualTicker` 固定动画中间态、最终态和静态真值。
- `packages/vchart/src/component/marker/base-marker.ts` 修复 marker exit：离场动画期间保留旧 marker 图元，动画结束后再释放。

### VTable 当前抽查

当前 VTable 仍有明显的 legacy VRender 接入面：

- `packages/vtable/package.json` 依赖 `@visactor/vrender-core/kits/components/animate` `~1.0.41`。
- `packages/vtable/src/vrender.ts` 使用 `preLoadAllModule()`、`loadBrowserEnv(container)`、`loadNodeEnv(container)`、`registerRect()` 等 legacy 装配。
- `packages/vtable/src/scenegraph/scenegraph.ts` 使用 `createStage(...)` 创建主表 stage。
- `packages/vtable-gantt/src/scenegraph/scenegraph.ts` 和 `packages/vtable-gantt/src/zoom-scale/DataZoomIntegration.ts` 也直接使用 `createStage(...)`。
- VTable 存在 `stateProxy`、`addState/removeState`、自定义布局动画、scrollbar/tooltip/legend release、chart-in-cell 等较多 VRender 交互面，需要分阶段验证。

## 2. 升级原则

### 2.1 先统一依赖版本

VRender 不是单包依赖。VTable 升级时应把下列包统一到同一个目标版本，避免 core / kits / components / animate 混用：

```json
{
  "@visactor/vrender": "<target>",
  "@visactor/vrender-core": "<target>",
  "@visactor/vrender-kits": "<target>",
  "@visactor/vrender-components": "<target>",
  "@visactor/vrender-animate": "<target>"
}
```

VTable 当前主包没有直接依赖 `@visactor/vrender` 根包，但 app-scoped 推荐入口来自根包。迁移普通 browser/node stage 创建路径时，建议新增根包依赖，而不是继续只从 `vrender-core` 拼 legacy 装配。

### 2.2 不把 VChart 的兼容修复照搬成 VTable 兜底

VChart 这次升级的经验不是“在上层到处包防御逻辑”，而是：

1. 按 VRender 新契约调用。
2. 在低频边界明确 ownership 和 stage/app 生命周期。
3. 用回归测试锁定有效用法。
4. 热路径避免大量 per-graphic 防御式兜底。

VTable 是大表格/虚拟滚动/大量单元格场景，新增逻辑尤其要避免落在 cell graphic 创建、滚动更新、hover/state 切换、bounds/render 热路径中。

### 2.3 先 browser，再 node / miniapp / custom assembly

VRender 文档明确 browser alpha ready，但 node 不是 node-complete alpha。VTable 应先完成 browser 主路径，再为 node export、SSR、miniapp、按需装配等路径单独建验证项。

## 3. 推荐迁移路径

### Phase 0：建立基线

1. 建升级分支，记录基线提交和当前 `@visactor/vrender*` 版本。
2. 跑当前 VTable 的核心测试和至少一条 browser demo smoke。
3. 记录当前 VTable 的关键路径：
   - `ListTable` 初始化 / updateOption / release
   - `PivotTable` 初始化 / updateOption / release
   - frozen row/col、scroll、resize
   - hover / selected / menu / tooltip / scrollbar
   - custom layout / JSX custom layout
   - VTable-Gantt stage 与 DataZoom 独立 stage
   - VTable-Sheet 内嵌表格实例 release

建议先跑：

```bash
cd /Users/bytedance/Documents/GitHub/VTable
rg '"@visactor/vrender' packages docs tools -g package.json
rg "createStage\\(|new Stage|loadBrowserEnv|loadNodeEnv|preLoadAllModule|registerRect\\(" packages -g '*.ts' -g '*.tsx'
rg "normalAttrs|stateProxy|addState\\(|removeState\\(|useStates\\(|animate\\(|release\\(" packages -g '*.ts' -g '*.tsx'
```

### Phase 1：统一依赖与本地 link

如果用本地 VRender2 验证，先确保 VTable 的安装结果真的指向本地 VRender2，不要只改 package.json：

```bash
cd /Users/bytedance/Documents/GitHub/VTable
realpath packages/vtable/node_modules/@visactor/vrender*
```

期望全部指向同一个本地 VRender 仓库对应包，例如：

```text
/Users/bytedance/Documents/GitHub/VRender2/packages/vrender-core
/Users/bytedance/Documents/GitHub/VRender2/packages/vrender-kits
/Users/bytedance/Documents/GitHub/VRender2/packages/vrender-components
/Users/bytedance/Documents/GitHub/VRender2/packages/vrender-animate
```

如果使用 Rush/pnpm override，参考 VChart 的 `common/config/rush/pnpm-config.json`：`globalOverrides` 可以统一覆盖 `@visactor/vrender-core`、`@visactor/vrender-kits`、`@visactor/vrender-components`、`@visactor/vrender-animate`。如果迁移到根包 app creator，还要覆盖 `@visactor/vrender`。

### Phase 2：迁移 stage/app ownership

VTable 当前的主要创建链是：

```text
packages/vtable/src/vrender.ts
  preLoadAllModule()
  loadBrowserEnv(container) / loadNodeEnv(container)
  register*()

packages/vtable/src/scenegraph/scenegraph.ts
  createStage(...)
```

推荐目标是类似 VChart 的三种 ownership 模式：

| 场景 | app 提供者 | stage 创建者 | release 责任 |
| --- | --- | --- | --- |
| 普通 `new ListTable/PivotTable({ container })` | VTable 内部 fallback shared app | VTable | table.release 释放自己创建的 stage；最后一个表释放后清理 fallback app |
| 同页多个表格或宿主统一运行时 | 宿主/scene/context 提供 app singleton | VTable | table.release 释放自己的 stage；不释放宿主 app |
| 外部传入 stage（如后续支持） | 外部调用方 | 外部调用方 | VTable 只借用，不释放外部 stage/app |

迁移建议：

1. 新增一个低频 helper，例如 `src/scenegraph/stage-app.ts` 或 `src/vrender-app.ts`。
2. helper 负责：
   - `resolveVRenderApp(option.app, mode)`
   - fallback app 按 browser/node 分域复用
   - 引用计数
   - `createStageFromApp(app, params)`
3. 主表、Gantt、DataZoom 等创建 stage 的地方逐步接入 helper。
4. release 时显式区分：
   - `internal-stage-owned`：释放 stage，并释放 fallback app ref
   - `external-app-owned`：释放 stage，不释放 app
   - `external-stage-owned`：不释放 stage，不释放 app，只移除 VTable 自己挂载的 root group / 事件 / proxy

不要在每个图元创建或滚动更新路径里判断 app/stage ownership。ownership 应在 table/scenegraph 初始化和 release 这些低频边界解决。

### Phase 3：状态系统对齐

VRender 新状态模型的关键点：

```text
baseAttributes + resolvedStatePatch -> attribute
```

VTable 迁移时应检查：

1. 是否把 `normalAttrs` 当作 snapshot/restore 主路径。
2. 是否依赖深层 `graphic.attribute.xxx.yyy = ...` mutation。
3. 是否把 `stateProxy` 当成共享状态定义的主路径。
4. hover/selected/disabled 等状态是否应收口到 Group-first shared-state 定义。
5. 大量单元格 state 切换是否仍保持 paint-only 快路径，不把状态解释逻辑带回 render/pick/bounds 热路径。

建议先保持 `stateProxy` 的实例级 escape hatch 能跑通，但不要在新代码里扩展它的 shared-state 职责。VTable custom layout/JSX custom layout 中的 `stateProxy` 应作为专项测试覆盖，尤其是 text 相关状态。

### Phase 4：动画与静态真值对齐

VChart 这次升级最容易暴露的问题集中在动画中断、updateSpec、exit 生命周期和静态真值污染。VTable 对应场景包括：

1. 单元格 appear/update 动画。
2. custom layout 图元动画。
3. hover/selected 状态动画。
4. scrollbar / menu / tooltip / legend 等组件动画。
5. Gantt task bar、dependency link、mark line、DataZoom 组件动画。
6. table release / updateOption 期间仍在运行的动画。

测试形态建议借鉴 VChart `manual-ticker.test.ts`：

```ts
const ticker = new ManualTicker();
ticker.autoStop = false;

const table = new ListTable({
  // ...
  renderOption: { ticker }
});

// render 后推进到动画中间时刻
ticker.tickAt(start + duration / 2);
expect(graphic.attribute.opacity).toBeGreaterThan(0);
expect(graphic.attribute.opacity).toBeLessThan(1);

// 动画结束后确认最终布局和静态真值
ticker.tickAt(start + duration + 50);
expect(graphic.attribute.x).toBe(expected.x);
expect(graphic.baseAttributes?.x).toBe(expected.x);
expect(graphic.getFinalAttribute?.().x).toBe(expected.x);
```

如果 VTable 侧还没有把 ticker 暴露到 `renderOption` 或 stage 创建参数，应优先补测试入口，而不是依赖真实时间等待。

### Phase 5：组件 release 与 exit 生命周期

VChart marker exit 的问题给 VTable 一个重要提醒：如果图元需要 exit fade-out，不能在创建 exit animation 后马上 detach/release。

正确判断方式：

1. 如果希望有 exit 动画：旧图元必须在动画期间仍 attached。
2. 中间 tick 应能看到 `opacity` / `fillOpacity` / `strokeOpacity` 等属性处于中间值。
3. 动画结束后再释放或 detach。
4. 如果图元不需要 exit 动画，才可以同步清理。

排查时必须收集：

- tracked graphics 数量与 attached 状态
- ticker 当前时间、exitStart、duration、中间 tick 时间
- 图元 animate 列表或等价动画状态
- `opacity/fillOpacity/strokeOpacity/visible` 等属性快照
- 是否提前 `removeChild` / `release`
- 上层是否真的创建了 exit animation config

若最小复现证明 VRender ticker/animate 没有推进，owner 是 VRender；若 VTable 在动画结束前释放图元，owner 是 VTable。

## 4. VTable 专项检查清单

### 4.1 依赖与装配

- [ ] 所有 `@visactor/vrender*` 版本一致。
- [ ] 如果使用本地 VRender2，`realpath node_modules/@visactor/vrender*` 指向本地仓库。
- [ ] 新代码不再新增 `createStage()` compat caller。
- [ ] 普通 browser stage 改走 `createBrowserVRenderApp() + app.createStage()`。
- [ ] node 路径单独标记 readiness，不与 browser 一起宣称完成。
- [ ] legacy `loadBrowserEnv(container)` / `register*()` caller 分类：保留为高级自定义装配，或迁移到 app-scoped 默认入口。

### 4.2 主表生命周期

- [ ] `ListTable` 创建、updateOption、resize、release 通过。
- [ ] `PivotTable` 创建、updateOption、resize、release 通过。
- [ ] release 后 ticker、stage、event listener、tooltip/menu、scrollbar、legend、layoutMap 全部清理。
- [ ] 多个 table 同页创建时互不释放对方 stage。
- [ ] 最后一个使用 fallback app 的 table 释放后 app 被清理。

### 4.3 VTable-Gantt / Sheet

- [ ] Gantt 主 stage 迁移或明确保留 compat path。
- [ ] Gantt DataZoom 独立 stage 有明确 app/stage ownership。
- [ ] Gantt release 不遗漏 DataZoom wrapper/canvas/stage。
- [ ] Sheet 内部多个 table instance 切换/释放不误释放共享 app。
- [ ] chart-in-cell 的 VChart 依赖版本与 VTable 的 VRender 版本策略不冲突。

### 4.4 状态与交互

- [ ] hover / selected / disabled 状态视觉正确。
- [ ] 大量单元格 hover/selection 不出现明显性能回退。
- [ ] `stateProxy` 覆盖 text 与非 text 图元。
- [ ] 不再依赖 `normalAttrs` 作为主恢复源。
- [ ] 不固化深层 nested mutation 作为新契约。

### 4.5 动画

- [ ] appear/update 中间态可由 ManualTicker 稳定断言。
- [ ] 中断动画后最终布局正确，`baseAttributes` 与 `finalAttribute` 不被旧中间值污染。
- [ ] exit 动画期间图元仍 attached。
- [ ] release 期间动画被正确停止或收尾，不产生悬挂 ticker。

## 5. Owner 判断规则

### 判断为 VTable owner

满足任一条件通常应在 VTable 修：

1. VTable 仍新增或依赖 deprecated `createStage()` 普通路径。
2. VTable 在动画结束前 detach/release 自己的图元。
3. VTable release 不区分 internal/external stage/app ownership。
4. VTable 把 `normalAttrs` 或深层 `attribute` mutation 当主契约。
5. VTable 缺少对自有 custom layout / Gantt / Sheet 生命周期的测试。

### 判断为 VRender owner

满足任一条件应交给 VRender，而不是在 VTable 侧绕开：

1. 使用 `createBrowserVRenderApp() + app.createStage()` 的最小 VRender-only 复现失败。
2. ManualTicker 推进时 animate/timeline 不执行。
3. 图元 attached 且 animation config 已创建，但属性完全不随 tick 变化。
4. `setAttribute/setAttributes` 正式写路径无法维持 `baseAttributes + resolvedStatePatch -> attribute`。
5. `app.release()` / `stage.release()` 违反 VRender 文档声明的 ownership。

VRender handoff 最小材料：

```text
版本矩阵：
- @visactor/vrender*: <version or local commit>
- VTable commit: <sha>

最小复现：
1. createBrowserVRenderApp()
2. app.createStage(...)
3. 创建最少图元/组件
4. 触发 state/animate/release
5. ManualTicker tick 到 t=0 / t=mid / t=end

实际结果：
- attached/released 状态
- animate 列表
- attribute/baseAttributes/finalAttribute/resolvedStatePatch 快照
- ticker 时间点

期望结果：
- 中间态应如何变化
- 结束态应如何提交
- 谁应负责 release

调用链：
- VTable 触发路径
- VRender 相关源码路径
```

## 6. 建议验证矩阵

### VTable browser 主路径

```bash
cd /Users/bytedance/Documents/GitHub/VTable
rush update
rush build --to @visactor/vtable
cd packages/vtable
./node_modules/.bin/jest __tests__/listTable.test.ts --runInBand
./node_modules/.bin/jest __tests__/pivotTable.test.ts --runInBand
```

实际项目中应按 touched files 和 VTable CI 配置替换为更准确的命令。若改动源码类型接口，必须跑对应 `tsc --noEmit` 或 Rush compile。

### 动画专项

新增或调整类似 VChart 的 manual ticker 测试，至少覆盖：

1. appear：中间态不污染静态真值。
2. update：排序/resize/filter 后最终布局正确。
3. interrupted update：连续 updateOption 后 retained graphic 仍动画到正确终点。
4. state animation：hover/selected 过渡不污染 `baseAttributes`。
5. exit：需要 fade-out 的组件在结束前不被 remove/release。

### 生命周期专项

1. 单 table create -> release。
2. 同页两个 table，释放第一个不影响第二个。
3. updateOption 期间 release。
4. Gantt + DataZoom release。
5. Sheet 多实例切换与 release。
6. 外部 canvas / viewBox / node mode 分支。

## 7. 推荐提交顺序

1. **dependency bump only**：只统一 `@visactor/vrender*` 版本和 lockfile，确认 install/link 正确。
2. **app/stage ownership**：新增低频 helper，迁移主表 stage 创建与 release，补生命周期测试。
3. **state alignment**：收口 `normalAttrs/stateProxy/shared-state` 相关调用，补交互状态测试。
4. **animation alignment**：补 ManualTicker 回归，逐个修 appear/update/exit。
5. **Gantt/Sheet follow-up**：处理独立 stage 和嵌套实例生命周期。
6. **browser smoke and perf**：跑浏览器 demo、滚动大表、hover/selection 批量切换。
7. **node/custom assembly**：单独验证，不随 browser 主路径一起宣称完成。

每一步都应保持小 diff。若某一步暴露 VRender owner 问题，先产出 VRender 最小复现，不在 VTable 热路径绕开。

## 8. 迁移完成标准

可以宣布 VTable browser 主路径完成升级，至少需要满足：

1. 依赖和 lockfile 中 `@visactor/vrender*` 版本一致。
2. 主表 browser stage 创建走 app-scoped 入口，或 compat path 被明确标记为保留原因。
3. table release ownership 有测试覆盖。
4. hover/selected/stateProxy 关键交互通过。
5. animation manual ticker 覆盖至少 appear/update/state/exit 一组代表场景。
6. Gantt/DataZoom/Sheet 的独立 stage 有清晰 owner 判断或明确后续项。
7. touched package 的 lint/typecheck/test 通过。
8. 若 node/custom assembly 未完成，文档和发布说明明确写为未完成项。
