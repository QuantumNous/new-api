# v2.1.1

2026-06-25

**🆕 新增功能**

- TODO: Fill in change details for v2.1.1.

**Full Changelog**: https://github.com/VisActor/VChart/compare/v2.1.0...v2.1.1

[更多详情请查看 v2.1.1](https://github.com/VisActor/VChart/releases/tag/v2.1.1)
# v2.1.0

2026-06-23

**🆕 新增功能**

- **@visactor/vchart**: `markLine.expandDistance` 支持回调函数配置。close #4568
- **@visactor/vchart**: 离散图例的 `maxRow` / `maxCol` 支持函数类型，可在布局阶段基于图例实际分配区域动态计算行数和列数。

**🐛 问题修复**

- **@visactor/vchart**: 修复瀑布图引导线（leader line）在部分场景下位置异常的问题。fix #4580
- **@visactor/vchart**: 修复 `legends.data` 为回调函数时，`updateSpec` 后离散图例筛选状态丢失的问题。fix #4566
- **@visactor/vchart**: 修复笛卡尔线性坐标轴在 `tick.tickCount` 为函数时，未基于最终绘图区尺寸重新计算 nice domain 的问题。
- **@visactor/vchart**: 修复 `reLayout` API 不生效的问题。fix #4537
- **@visactor/vchart**: 修复地图拖拽时标签未正确跟随的问题。fix #4547
- **@visactor/vchart**: 修复部分渲染流程异常的问题。fix #4578

**🔨 维护与杂项**

- **@visactor/vchart**: 修复移动端地图漫游拖拽场景中，`supportsTouchEvents` 被设为 `false` 后纵向拖拽不稳定的问题。
- **@visactor/vchart**: 引入更细粒度的 `updateSpec` 影响范围标记，显式区分 chart、component、series、data、layout、render 和 animation 等更新路径；marker 退出、标题文本、图例外观、坐标轴外观、mark 样式、字段、标签、动画及布局相关更新，在可复用现有图表模型时会避免不必要
  的 chart remake / recompile。
- **@visactor/vchart**: 适配 VRender 1.1.0 的 app-scoped runtime、状态 resolver 和动画契约，在保持标准 VChart spec 用法兼容的基础上，收敛 mark shared-state、glyph 子图元状态隔离、词云 `scaleIn` 初始状态，以及 Sankey、Brush、图例纹理、marker 富文本、circularProgress
  tickMask 等交互和渲染行为。

**💖 社区贡献**

感谢所有参与本次版本建设、反馈和验证的社区贡献者。特别感谢：

- @g1f9: 贡献离散图例 `maxRow` / `maxCol` 函数配置支持，并修复线性坐标轴基于最终绘图区重新 nice 的问题。

**Full Changelog**: https://github.com/VisActor/VChart/compare/v2.0.20...v2.1.0

[更多详情请查看 v2.1.0](https://github.com/VisActor/VChart/releases/tag/v2.1.0)

# v2.0.22

2026-04-13

**🐛 问题修复**

- **@visactor/vchart**: correct stacked bar corner clipping when barMinHeight is applied （问题 #4543）
- **@visactor/vchart**: relayout api not work 问题. fix#4537
- **@visactor/vchart**: custom mark not release after update spec. fix#4537
- **@visactor/vchart**: map error when roam or drag canvas. fix#4547
- **@visactor/vchart**: handle sankey Tooltip labels when source index is 0 （问题 #4488）

**Full Changelog**: https://github.com/VisActor/VChart/compare/v2.0.20...v2.0.22

[更多详情请查看 v2.0.22](https://github.com/VisActor/VChart/releases/tag/v2.0.22)

# v2.0.21

2026-04-03

**🆕 新增功能**

- TODO: Fill in change details for v2.0.21.

**Full Changelog**: https://github.com/VisActor/VChart/compare/v2.0.20...v2.0.21

[更多详情请查看 v2.0.21](https://github.com/VisActor/VChart/releases/tag/v2.0.21)

# v2.0.20

2026-03-26

**🐛 问题修复**

- **@visactor/vchart**: 修复 theme config of spec and option
- **@visactor/vchart**: datazoom update domain after data change. fix#4186

**🔨 维护与杂项**

- **@visactor/vchart**: 更新 changes for 008-fix-size-图例-handler-text: Allow size 图例 handlerText.style accept function-based values in the same way other 图例 style hooks already do, and add regression coverage proving the style callback is preserved through continuous 图例 attribute transformation.
- **@visactor/vchart**: 更新 changes for 009-fix-heatmap-scrollbar-axis-direction: Align ScrollBar with DataZoom by using the shared reverse-axis detection when converting scrollbar state percentages back into domain values.
- **@visactor/vchart**: 更新 changes for 009-fix-问题-of-mark-state-when-updateSpec: Fix an 问题 where mark states were not properly cleared when updateSpec was called, causing incorrect state persistence.
- **@visactor/vchart**: 更新 changes for 010-hide-empty-axes: Add an opt-in hideWhenEmpty axis option for cartesian axes.
- **@visactor/vchart**: 更新 changes for 009-fix-问题-of-mark-state-when-updateSpec: Fix an 问题 where mark states were not properly cleared when updateSpec was called, causing incorrect state persistence.
- **@visactor/vchart**: 升级 vutils, vdataset, vscale, vlayouts ~1.0.23

**Full Changelog**: https://github.com/VisActor/VChart/compare/v2.0.19...v2.0.20

[更多详情请查看 v2.0.20](https://github.com/VisActor/VChart/releases/tag/v2.0.20)

# v2.0.19

2026-03-06

**🔨 维护与杂项**

- **@visactor/vchart**: remove unused GitHub Actions workflows

**Full Changelog**: https://github.com/VisActor/VChart/compare/v2.0.18...v2.0.19

[更多详情请查看 v2.0.19](https://github.com/VisActor/VChart/releases/tag/v2.0.19)

# v2.0.18

2026-03-05

**🆕 新增功能**

- **@visactor/vchart**: 优化发布相关的工作流程（Release Workflows）

**🐛 问题修复**

- **@visactor/vchart**: 修复数据源变更时 DataZoom 未触发更新的问题 (Issue #4185)
- **@visactor/vchart**: 修复热力图（Heatmap）标签的默认线宽（`lineWidth`）问题
- **@visactor/vchart**: 修复 Player 组件以及 `BaseComponent` 销毁释放逻辑中的内存泄漏问题

**Full Changelog**: https://github.com/VisActor/VChart/compare/v2.0.17...v2.0.18

[more detail about v2.0.18](https://github.com/VisActor/VChart/releases/tag/v2.0.18)

# v2.0.17

2026-02-26

**🐛 问题修复**

- **@visactor/vchart**: 修复坐标轴网格（Axis Grid）配置中对函数形式的交替颜色（`alternateColor`）的支持问题

**Full Changelog**: https://github.com/VisActor/VChart/compare/v2.0.16...v2.0.17

[more detail about v2.0.17](https://github.com/VisActor/VChart/releases/tag/v2.0.17)

# v2.0.16

2026-02-13

**🆕 新增功能**

- **@visactor/vchart**: 新增时间线（Timeline）图表 by @xile611 in https://github.com/VisActor/VChart/pull/4440
- **@visactor/vchart**: 优化词云图（Word Cloud）形状算法，提升性能与布局效果 by @xuefei1313 in https://github.com/VisActor/VChart/pull/4452
- **@visactor/vchart**: 新增 skills 特性支持 by @xile611 in https://github.com/VisActor/VChart/pull/4447

**🐛 问题修复**

- **@visactor/vchart**: 升级 `vrender` 依赖以修复词云图相关问题 by @xuefei1313 in https://github.com/VisActor/VChart/pull/4432
- **@visactor/vchart**: 修复 React VChart 中 Tooltip 的渲染样式问题 by @xile611 in https://github.com/VisActor/VChart/pull/4430
- **@visactor/vchart**: 修复 `markPoint.itemContent.text.style.fontSize` 设置无效的问题 by @xuefei1313 in https://github.com/VisActor/VChart/pull/4453
- **@visactor/vchart**: 修复填充图形（fill graphic）的类型定义 by @xuefei1313 in https://github.com/VisActor/VChart/pull/4454
- **@visactor/vchart**: 更新 `visual` 类型定义并完善相关文档 by @xile611 in https://github.com/VisActor/VChart/pull/4451

**🔨 维护与杂项**

- **@visactor/vchart**: 优化 `spec-kit` 命令行工具 by @xuefei1313 in https://github.com/VisActor/VChart/pull/4442
- **@visactor/vchart**: 更新并修复 Release Changelog 的 GitHub Action 工作流 by @xuefei1313 in https://github.com/VisActor/VChart/pull/4439

**Full Changelog**: https://github.com/VisActor/VChart/compare/v2.0.14...v2.0.16

[more detail about v2.0.16](https://github.com/VisActor/VChart/releases/tag/v2.0.16)

# v2.0.15

2026-02-02

**🆕 新增功能**

- **@visactor/vchart**: 支持 Brush API 及交互（Interactive）API by @skie1997 in https://github.com/VisActor/VChart/pull/4408
- **@visactor/vchart**: 支持鼠标滚轮固定像素步进滚动，并支持设置滚动条滑块的最小高度 by @xuefei1313 in https://github.com/VisActor/VChart/pull/4423

**🐛 问题修复**

- **@visactor/vchart**: 修复 React VChart 组件的注册逻辑 by @xile611 in https://github.com/VisActor/VChart/pull/4419
- **@visactor/vchart**: 升级 `vrender` 依赖以修复词云图（Word Cloud）相关问题 by @xuefei1313 in https://github.com/VisActor/VChart/pull/4422

**🔨 维护与杂项**

- **@visactor/vchart**: 新增 `spec-kit` 工具包及项目章程（Constitution） by @xuefei1313 in https://github.com/VisActor/VChart/pull/4412

**Full Changelog**: https://github.com/VisActor/VChart/compare/v2.0.14...v2.0.15

[more detail about v2.0.15](https://github.com/VisActor/VChart/releases/tag/v2.0.15)

# v2.0.14

2026-01-22

**🆕 新增功能**

- **@visactor/vchart**: 支持 Brush API 和交互（Interactive）API by @skie1997 in https://github.com/VisActor/VChart/pull/4408
- **@visactor/vchart**: 支持鼠标滚轮固定像素步进滚动，并支持设置滚动条滑块的最小高度 by @xuefei1313 in https://github.com/VisActor/VChart/pull/4423

**🐛 问题修复**

- **@visactor/vchart**: 修复 React VChart 组件的注册逻辑 by @xile611 in https://github.com/VisActor/VChart/pull/4419
- **@visactor/vchart**: 升级 `vrender` 依赖以修复词云图（Word Cloud）相关问题 by @xuefei1313 in https://github.com/VisActor/VChart/pull/4422
- **@visactor/vchart**: 修复地图（Map）Tooltip 的显示问题 by @xuefei1313 in https://github.com/VisActor/VChart/pull/4417
- **@visactor/vchart**: 修复副标题（Subtitle）的布局错误 by @xuefei1313 in https://github.com/VisActor/VChart/pull/4415
- **@visactor/vchart**: 为 Tooltip 处理程序添加防御性代码以防止报错 by @skie1997 in https://github.com/VisActor/VChart/pull/4424

**🔨 维护与杂项**

- **@visactor/vchart**: 更新 GH CLI 工具及相关使用文档 by @xuefei1313 in https://github.com/VisActor/VChart/pull/4409

**Full Changelog**: https://github.com/VisActor/VChart/compare/v2.0.13...v2.0.14

[more detail about v2.0.14](https://github.com/VisActor/VChart/releases/tag/v2.0.14)

# v2.0.13

2026-01-08

**🐛 问题修复**

- **@visactor/vchart**: 修复场景（Stage）发生变换后 Tooltip 显示异常的问题 by @xuefei1313 in https://github.com/VisActor/VChart/pull/4393
- **@visactor/vchart**: 修复地图（Map）Tooltip 的相关问题 by @xuefei1313 in https://github.com/VisActor/VChart/pull/4396
- **@visactor/vchart**: 修复动画状态（Animation State）的逻辑问题 by @xuefei1313 in https://github.com/VisActor/VChart/pull/4398

**🔨 维护与杂项**

- **@visactor/vchart**: 将基础 Node.js 版本依赖升级至 20+ by @xile611 in https://github.com/VisActor/VChart/pull/4402

**📖 文档更新**

- **@visactor/vchart**: 更新标注点（Marker Point）样式与状态的文档 by @skie1997 in https://github.com/VisActor/VChart/pull/4369
- **@visactor/vchart**: 新增退场动画（Exit Animation）示例 by @purpose233 in https://github.com/VisActor/VChart/pull/4374

**Full Changelog**: https://github.com/VisActor/VChart/compare/v2.0.12...v2.0.13

[更多详情请查看 v2.0.13](https://github.com/VisActor/VChart/releases/tag/v2.0.13)

# v2.0.12

2025-12-25

**🆕 新增功能**

- **@visactor/vchart**: 极坐标轴（CircleAxis）支持 `autoLabelMaxWidth` 配置 by @xuefei1313 in https://github.com/VisActor/VChart/pull/4357
- **@visactor/vchart**: 新增图表消失（Disappear）状态支持 by @xuefei1313 in https://github.com/VisActor/VChart/pull/4341
- **@visactor/vchart**: 优化热力图（Heatmap）形状渲染逻辑 by @xuefei1313 in https://github.com/VisActor/VChart/pull/4377
- **@visactor/vchart**: 优化地图（Map）zoom交互，增加 `zoomRate` 配置 by @xuefei1313 in https://github.com/VisActor/VChart/pull/4373

**🐛 问题修复**

- **@visactor/vchart**: 修复坐标轴标题（Axes Title）的布局问题 by @xuefei1313 in https://github.com/VisActor/VChart/pull/4371

**Full Changelog**: https://github.com/VisActor/VChart/compare/v2.0.11...v2.0.12

[更多详情请查看 v2.0.12](https://github.com/VisActor/VChart/releases/tag/v2.0.12)

# v2.0.11

2025-12-11

**🆕 新增功能**

- **@visactor/vchart**: 在 `initOption` 中支持 `componentShowContent` 配置 by @xuefei1313 in https://github.com/VisActor/VChart/pull/4334
- **@visactor/vchart**: 增强箱形图（Boxplot）标签功能 by @xile611 in https://github.com/VisActor/VChart/pull/4346
- **@visactor/vchart**: 导出数据常量定义 by @xuefei1313 in https://github.com/VisActor/VChart/pull/4339

**🐛 问题修复**

- **@visactor/vchart**: 修复存在内部偏移（inner offset）时的十字准星（crosshair）显示问题 by @xile611 in https://github.com/VisActor/VChart/pull/4340
- **@visactor/vchart**: 修复十字准星在特定内部偏移下的定位逻辑 (fix #4338) by @xile611 in https://github.com/VisActor/VChart/pull/4343
- **@visactor/vchart**: 修复箱形图异常值的颜色显示问题 by @xile611 in https://github.com/VisActor/VChart/pull/4347
- **@visactor/vchart**: 修复箱形图异常值的样式问题 by @xile611 in https://github.com/VisActor/VChart/pull/4350

**Full Changelog**: https://github.com/VisActor/VChart/compare/v2.0.10...v2.0.11

[more detail about v2.0.11](https://github.com/VisActor/VChart/releases/tag/v2.0.11)

# v2.0.10

2025-11-28

**🆕 新特性**

- **@visactor/vchart**: 箱型图 (Boxplot) 功能增强 by @xile611 in https://github.com/VisActor/VChart/pull/4323

**🐛 问题修复**

- **@visactor/vchart**: 升级 vrender 依赖以修复玫瑰图 (Rose Chart) 的问题 by @xuefei1313 in https://github.com/VisActor/VChart/pull/4315
- **@visactor/vchart**: 升级 vrender 依赖以修复动画相关问题 by @xuefei1313 in https://github.com/VisActor/VChart/pull/4325
- **@visactor/vchart**: 修复扩展标记 (Extension Mark) 的更新逻辑 by @xile611 in https://github.com/VisActor/VChart/pull/4318
- **@visactor/vchart**: 修复字体系列 (Font Family) 设置的问题 by @xuefei1313 in https://github.com/VisActor/VChart/pull/4324
- **@visactor/vchart**: 修复 setDimensionIndex 方法的问题 by @xuefei1313 in https://github.com/VisActor/VChart/pull/4291

**📖 文档更新**

- **@visactor/vchart**: 新增 K 线图 (Candlestick) 开发指南 by @xuefei1313 in https://github.com/VisActor/VChart/pull/4310
- **@visactor/vchart**: 新增主题 (Theme) 开发指南 by @xuanhun in https://github.com/VisActor/VChart/pull/4322
- **@visactor/vchart**: 新增地图卷绕 (Map Rewind) 指南 by @xuefei1313 in https://github.com/VisActor/VChart/pull/4326
- **@visactor/vchart**: 在指南中补充 3D 注册相关内容 by @xuefei1313 in https://github.com/VisActor/VChart/pull/4312
- **@visactor/vchart**: 修正通用图表配置 labelLayout 的文档说明 by @xuefei1313 in https://github.com/VisActor/VChart/pull/4316

[更多详情请查看 v2.0.10](https://github.com/VisActor/VChart/releases/tag/v2.0.10)

# v2.0.9

2025-11-18

**🆕 新特性**

- **@visactor/react-vchart**: 新增 registerChartResizeZoomPlugin 导出 by @xuefei1313 in https://github.com/VisActor/VChart/pull/4286
- **@visactor/vchart**: 支持特效动画 by @purpose233 in https://github.com/VisActor/VChart/pull/4299
- **@visactor/vchart**: 增强 DataZoom 组件功能并修复相关问题 by @skie1997 in https://github.com/VisActor/VChart/pull/4065

**🐛 问题修复**

- **@visactor/vchart-extension**: 修复 vchart-extension 打包产物中包含额外版本的问题 by @xuefei1313 in https://github.com/VisActor/VChart/pull/4277
- **@visactor/vchart**: 修复标线 (MarkLine) 自动范围计算的问题 by @xuefei1313 in https://github.com/VisActor/VChart/pull/4290

**📖 文档更新**

- **@visactor/vchart**: 修复示例中 registerMorph 的错误 by @xuefei1313 in https://github.com/VisActor/VChart/pull/4285
- **@visactor/vchart**: 新增 K 线图 (Candlestick) 示例 by @xuefei1313 in https://github.com/VisActor/VChart/pull/4297

[更多详情请查看 v2.0.9](https://github.com/VisActor/VChart/releases/tag/v2.0.9)

# v2.0.7

2025-11-03

**🆕 新增功能**

- **@visactor/vchart**：支持 resize zoom 图表插件，关联 [#4241](https://github.com/VisActor/VChart/pull/4241)
- **@visactor/vchart**：注册 boxplot transform，关联 [#4268](https://github.com/VisActor/VChart/pull/4268)
- **@visactor/vchart**：新增 translate-issues 工作流配置，关联 [#4264](https://github.com/VisActor/VChart/pull/4264)
- **@visactor/vchart**：在 vchart-extension 中新增回归线 (regression-lines)，关联 [#4245](https://github.com/VisActor/VChart/pull/4245)
- **@visactor/vchart**：变更 vrender 依赖项，关联 [#4224](https://github.com/VisActor/VChart/pull/4224)

**🐛 功能修复**

- **@visactor/vchart**：修复十字准星 (crosshair) 未隐藏的问题，修复 [#4252](https://github.com/VisActor/VChart/pull/4252)
- **@visactor/vchart**：修复布局 (layout) 的问题，修复 [#4249](https://github.com/VisActor/VChart/pull/4249)
- **@visactor/vchart**：修复逻辑回归线 (logistic regression line) 的问题，修复 [#4263](https://github.com/VisActor/VChart/pull/4263)
- **@visactor/vchart**：修复分组散点图 (grouped scatter) 的回归线支持问题，修复 [#4248](https://github.com/VisActor/VChart/pull/4248)
- **@visactor/vchart**：修复堆叠数据 (stackData) 为空时的检查问题，修复 [#4244](https://github.com/VisActor/VChart/pull/4244)
- **@visactor/vchart**：修复瀑布图堆叠总计 (waterfall stack total) 的问题，修复 [#4243](https://github.com/VisActor/VChart/pull/4243)

[更多详情请查看 v2.0.7](https://github.com/VisActor/VChart/releases/tag/v2.0.7)

# v2.0.6

2025-10-14

**🆕 新增功能**

- **@visactor/vchart**：`formatter` 新增计算功能，关联 [#4211](https://github.com/VisActor/VChart/pull/4211)
- **@visactor/vchart**：更新缺陷报告方法，关联 [#4221](https://github.com/VisActor/VChart/pull/4221)
- **@visactor/vchart**：升级 `vrender` 版本以修复动画问题，关联 [#4222](https://github.com/VisActor/VChart/pull/4222)
- **@visactor/vchart**：瀑布图新增 `waterfallType` 配置，关联 [#4220](https://github.com/VisActor/VChart/pull/4220)
- **@visactor/vchart**：变更 `vrender` 依赖项，关联 [#4224](https://github.com/VisActor/VChart/pull/4224)

**🐛 功能修复**

- **@visactor/vchart**：修复图例翻页器的问题，修复 [#4212](https://github.com/VisActor/VChart/pull/4212)
- **@visactor/vchart**：修复当系列没有数据时 `markline` 的报错问题，修复 [#4216](https://github.com/VisActor/VChart/pull/4216)

[更多详情请查看 v2.0.6](https://github.com/VisActor/VChart/releases/tag/v2.0.6)

# v2.0.5

2025-09-19

[更多详情请查看 v2.0.5](https://github.com/VisActor/VChart/releases/tag/v2.0.5)

# v2.0.2

2025-07-28

**🆕 新增功能**

- **@visactor/vchart**: add the afterClearRect hook of render

**Full Changelog**: https://github.com/VisActor/VChart/compare/v2.0.1...v2.0.2

[更多详情请查看 v2.0.2](https://github.com/VisActor/VChart/releases/tag/v2.0.2)

# v2.0.1

2025-07-24

**🆕 新增功能**

- **@visactor/vchart**：新增配置项以避免 `brush` 状态更新，关闭 [#4035](https://github.com/VisActor/VChart/issues/4035)
- **@visactor/vchart**：优化 `datazoom` 动画效果
- **@visactor/vchart**：新增 vrender 的 `afterClearScreen` 钩子

**🐛 功能修复**

- **@visactor/vchart**：修复 3D 图表网格问题
- **@visactor/vchart**：当 `sampling` 变更时，轴的 `tickData` 应同步更新，修复 [#4059](https://github.com/VisActor/VChart/issues/4059)
- **@visactor/vchart**：仅在需要时计算多层 `label` 项，修复 [#4056](https://github.com/VisActor/VChart/issues/4056)
- **@visactor/vchart**：修复 `remake` 时的 `resize` 错误及动画归一化 bug，修复 [#4070](https://github.com/VisActor/VChart/issues/4070)
- **@visactor/vchart**：修复飞书 block 相关问题，并在创建 vchart 时调用 setenv
- **@visactor/vchart**：修复 tooltip triggerOff 与 tooltip lock 的 bug
- **@visactor/vchart**：修复 `tooltip` 处理器为 `undefined` 时抛出异常的问题，修复 [#4044](https://github.com/VisActor/VChart/issues/4044)
- **@visactor/vchart**：修复 `tooltip.style.titleLabel` 的 `textAlign` 不生效问题，修复 [#4043](https://github.com/VisActor/VChart/issues/4043)

[更多详情请查看 v2.0.1](https://github.com/VisActor/VChart/releases/tag/v2.0.1)
