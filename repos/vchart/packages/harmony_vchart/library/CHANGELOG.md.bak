# v2.1.0

2026-06-23

**🆕 New Features**

- **@visactor/vchart**: markLine expandDistancesupport callback. close#4568
- **@visactor/vchart**: support function type for `maxRow` / `maxCol` of the discrete legend, evaluated during layout against the legend's allocated rect, so the row / column count can adapt to the available space

**🐛 Bug Fixes**

- **@visactor/vchart**: waterfall lead line bug. fix#4580
- **@visactor/vchart**: preserve discrete legend filtering after updateSpec when `legends.data` is a callback (Issue #4566)
- **@visactor/vchart**: re-nice the cartesian linear axis with the real plot-area length after layout when `tick.tickCount` is a function, so the length-based tick count and nice ceiling match the final plot area instead of the pre-layout chart viewRect
- **@visactor/vchart**: vchart relayout api not work bug. fix#4537
- **@visactor/vchart**: label not follow when drag. fix#4547
- **@visactor/vchart**: prcoess render error. fix#4578

**🔨 Chores**

- **@visactor/vchart**: update changes for 009-fix-map-roam-pointer-drag: This plan fixes a map roam drag bug where mobile browsers lose stable vertical dragging after supportsTouchEvents is forced to false
- **@visactor/vchart**: introduce scoped updateSpec effects to make chart, component, series, data, layout, render, and animation update ranges explicit; local component updates such as marker exit, title text, legend appearance, axis appearance, mark style, field, label, animation, and layout-related series changes now avoid unnecessary chart remake/recompile paths when the existing chart model can be updated in place
- **@visactor/vchart**: align VChart with the VRender 1.1.0 app-scoped runtime, state resolver, and animation contracts while keeping standard VChart spec usage compatible; consolidate mark shared-state handling, glyph sub-graphic state isolation, word-cloud scaleIn initialization, and interaction-state behavior for Sankey, brush, legend textures, marker rich text, and circular progress tick masks

**Full Changelog**: https://github.com/VisActor/VChart/compare/v2.0.20...v2.1.0

[more detail about v2.1.0](https://github.com/VisActor/VChart/releases/tag/v2.1.0)
# v2.0.22

2026-04-13

**🐛 Bug Fixes**

- **@visactor/vchart**: correct stacked bar corner clipping when barMinHeight is applied (Issue #4543)
- **@visactor/vchart**: relayout api not work bug. fix#4537
- **@visactor/vchart**: custom mark not release after update spec. fix#4537
- **@visactor/vchart**: map error when roam or drag canvas. fix#4547
- **@visactor/vchart**: handle sankey tooltip labels when source index is 0 (Issue #4488)

**Full Changelog**: https://github.com/VisActor/VChart/compare/v2.0.20...v2.0.22

[more detail about v2.0.22](https://github.com/VisActor/VChart/releases/tag/v2.0.22)
# v2.0.21

2026-04-03

**🆕 New Features**

- TODO: Fill in change details for v2.0.21.

**Full Changelog**: https://github.com/VisActor/VChart/compare/v2.0.20...v2.0.21

[more detail about v2.0.21](https://github.com/VisActor/VChart/releases/tag/v2.0.21)
# v2.0.20

2026-03-26

**🐛 Bug Fixes**

- **@visactor/vchart**: fix theme config of spec and option
- **@visactor/vchart**: datazoom update domain after data change. fix#4186

**🔨 Chores**

- **@visactor/vchart**: update changes for 008-fix-size-legend-handler-text: Allow size legend handlerText.style to accept function-based values in the same way other legend style hooks already do, and add regression coverage proving the style callback is preserved through continuous legend attribute transformation.
- **@visactor/vchart**: update changes for 009-fix-heatmap-scrollbar-axis-direction: Align ScrollBar with DataZoom by using the shared reverse-axis detection when converting scrollbar state percentages back into domain values.
- **@visactor/vchart**: update changes for 009-fix-issue-of-mark-state-when-updateSpec: Fix an issue where mark states were not properly cleared when updateSpec was called, causing incorrect state persistence.
- **@visactor/vchart**: update changes for 010-hide-empty-axes: Add an opt-in hideWhenEmpty axis option for cartesian axes.
- **@visactor/vchart**: update changes for 009-fix-issue-of-mark-state-when-updateSpec: Fix an issue where mark states were not properly cleared when updateSpec was called, causing incorrect state persistence.
- **@visactor/vchart**: upgrade vutils, vdataset, vscale, vlayouts to ~1.0.23

**Full Changelog**: https://github.com/VisActor/VChart/compare/v2.0.19...v2.0.20

[more detail about v2.0.20](https://github.com/VisActor/VChart/releases/tag/v2.0.20)
# v2.0.19

2026-03-06

**🔨 Chores**

- **@visactor/vchart**: remove unused GitHub Actions workflows

**Full Changelog**: https://github.com/VisActor/VChart/compare/v2.0.18...v2.0.19

[more detail about v2.0.19](https://github.com/VisActor/VChart/releases/tag/v2.0.19)
# v2.0.18

2026-03-05

**🆕 New Features**

- **@visactor/vchart**: feat: optimiz workflows for release



**🐛 Bug Fixes**

- **@visactor/vchart**: fix: ensure DataZoom updates when data source changes (Issue #4185)
- **@visactor/vchart**: fix: fix default lineWidth for heatmap label


- **@visactor/vchart**: fix: Fix memory leaks in Player component and BaseComponent release logic.

**Full Changelog**: https://github.com/VisActor/VChart/compare/v2.0.17...v2.0.18

[more detail about v2.0.18](https://github.com/VisActor/VChart/releases/tag/v2.0.18)
# v2.0.17

2026-02-26

**🐛 Bug Fixes**

- **@visactor/vchart**: fix: support functional alternateColor in axis grid configuration

**Full Changelog**: https://github.com/VisActor/VChart/compare/v2.0.16...v2.0.17

[more detail about v2.0.17](https://github.com/VisActor/VChart/releases/tag/v2.0.17)
# v2.0.16

2026-02-13

**🆕 New Features**

- **@visactor/vchart**: Add Timeline chart by @xile611 in https://github.com/VisActor/VChart/pull/4440
- **@visactor/vchart**: Optimize Word Cloud shape algorithm for better performance and layout by @xuefei1313 in https://github.com/VisActor/VChart/pull/4452
- **@visactor/vchart**: Add skills feature support by @xile611 in https://github.com/VisActor/VChart/pull/4447

**🐛 Bug Fixes**

- **@visactor/vchart**: Upgrade `vrender` dependency to fix Word Cloud chart issues by @xuefei1313 in https://github.com/VisActor/VChart/pull/4432
- **@visactor/vchart**: Fix React VChart tooltip render style by @xile611 in https://github.com/VisActor/VChart/pull/4430
- **@visactor/vchart**: Fix invalid `fontSize` setting in `markPoint.itemContent.text.style` by @xuefei1313 in https://github.com/VisActor/VChart/pull/4453
- **@visactor/vchart**: Fix fill graphic type definition by @xuefei1313 in https://github.com/VisActor/VChart/pull/4454
- **@visactor/vchart**: Update `visual` type definition and related documentation by @xile611 in https://github.com/VisActor/VChart/pull/4451

**🔨 Chores**

- **@visactor/vchart**: Optimize `spec-kit` commands by @xuefei1313 in https://github.com/VisActor/VChart/pull/4442
- **@visactor/vchart**: Update and fix release changelog GitHub Action workflow by @xuefei1313 in https://github.com/VisActor/VChart/pull/4439

**Full Changelog**: https://github.com/VisActor/VChart/compare/v2.0.14...v2.0.16

[more detail about v2.0.16](https://github.com/VisActor/VChart/releases/tag/v2.0.16)

# v2.0.15

2026-02-02

**🆕 New Features**

- **@visactor/vchart**: Support Brush API and Interactive API by @skie1997 in https://github.com/VisActor/VChart/pull/4408
- **@visactor/vchart**: Support fixed pixel step scrolling on wheel event and minimum scrollbar slider height by @xuefei1313 in https://github.com/VisActor/VChart/pull/4423

**🐛 Bug Fixes**

- **@visactor/vchart**: Fix React VChart component registration logic by @xile611 in https://github.com/VisActor/VChart/pull/4419
- **@visactor/vchart**: Upgrade `vrender` dependency to fix Word Cloud chart issues by @xuefei1313 in https://github.com/VisActor/VChart/pull/4422

**🔨 Chores**

- **@visactor/vchart**: Add `spec-kit` and project constitution by @xuefei1313 in https://github.com/VisActor/VChart/pull/4412

**Full Changelog**: https://github.com/VisActor/VChart/compare/v2.0.14...v2.0.15

[more detail about v2.0.15](https://github.com/VisActor/VChart/releases/tag/v2.0.15)

# v2.0.14

2026-01-22

**🆕 New Features**

- **@visactor/vchart**: Support Brush API and Interactive API by @skie1997 in https://github.com/VisActor/VChart/pull/4408
- **@visactor/vchart**: Support fixed pixel step scrolling on wheel event and minimum scrollbar slider height by @xuefei1313 in https://github.com/VisActor/VChart/pull/4423

**🐛 Bug Fixes**

- **@visactor/vchart**: Fix React VChart component registration logic by @xile611 in https://github.com/VisActor/VChart/pull/4419
- **@visactor/vchart**: Upgrade `vrender` dependency to fix Word Cloud chart issues by @xuefei1313 in https://github.com/VisActor/VChart/pull/4422
- **@visactor/vchart**: Fix tooltip display issue in Map charts by @xuefei1313 in https://github.com/VisActor/VChart/pull/4417
- **@visactor/vchart**: Fix subtitle layout bug by @xuefei1313 in https://github.com/VisActor/VChart/pull/4415
- **@visactor/vchart**: Add protection code for tooltip handler to prevent errors by @skie1997 in https://github.com/VisActor/VChart/pull/4424

**🔨 Chores**

- **@visactor/vchart**: Update GH CLI and usage documentation by @xuefei1313 in https://github.com/VisActor/VChart/pull/4409

**Full Changelog**: https://github.com/VisActor/VChart/compare/v2.0.13...v2.0.14

[more detail about v2.0.14](https://github.com/VisActor/VChart/releases/tag/v2.0.14)

[more detail about v2.0.14](https://github.com/VisActor/VChart/releases/tag/v2.0.14)

# v2.0.13

2026-01-08

# v2.0.13

2026-01-08

**🐛 Bug Fixes**

- **@visactor/vchart**: Fix tooltip display issue when stage is transformed by @xuefei1313 in https://github.com/VisActor/VChart/pull/4393
- **@visactor/vchart**: Fix map tooltip issue by @xuefei1313 in https://github.com/VisActor/VChart/pull/4396
- **@visactor/vchart**: Fix animation state issue by @xuefei1313 in https://github.com/VisActor/VChart/pull/4398

**🔨 Chores**

- **@visactor/vchart**: Update base Node.js version to 20+ by @xile611 in https://github.com/VisActor/VChart/pull/4402

**📖 Documentation**

- **@visactor/vchart**: Update marker point style and state documentation by @skie1997 in https://github.com/VisActor/VChart/pull/4369
- **@visactor/vchart**: Add exit animation demo by @purpose233 in https://github.com/VisActor/VChart/pull/4374

**Full Changelog**: https://github.com/VisActor/VChart/compare/v2.0.12...v2.0.13

[more detail about v2.0.13](https://github.com/VisActor/VChart/releases/tag/v2.0.13)

[more detail about v2.0.13](https://github.com/VisActor/VChart/releases/tag/v2.0.13)

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

[more detail about v2.0.12](https://github.com/VisActor/VChart/releases/tag/v2.0.12)


# v2.0.11

2025-12-11

# v2.0.11

2025-12-11

**🆕 New Features**

- **@visactor/vchart**: Support `componentShowContent` in `initOption` by @xuefei1313 in https://github.com/VisActor/VChart/pull/4334
- **@visactor/vchart**: Support boxplot label by @xile611 in https://github.com/VisActor/VChart/pull/4346
- **@visactor/vchart**: Export data constant by @xuefei1313 in https://github.com/VisActor/VChart/pull/4339

**🐛 Bug Fixes**

- **@visactor/vchart**: Fix crosshair behavior when having inner offset by @xile611 in https://github.com/VisActor/VChart/pull/4340
- **@visactor/vchart**: Fix outlier color in boxplot by @xile611 in https://github.com/VisActor/VChart/pull/4347
- **@visactor/vchart**: Fix boxplot outlier style by @xile611 in https://github.com/VisActor/VChart/pull/4350


**Full Changelog**: https://github.com/VisActor/VChart/compare/v2.0.10...v2.0.11

[more detail about v2.0.11](https://github.com/VisActor/VChart/releases/tag/v2.0.11)

[more detail about v2.0.11](https://github.com/VisActor/VChart/releases/tag/v2.0.11)

# v2.0.10

2025-11-28


**🆕 New Features**


* @visactor/vchart: Enhance boxplot features by @xile611 in https://github.com/VisActor/VChart/pull/4323


**🐛 Bug Fixes**


* @visactor/vchart: Upgrade vrender dependency to fix rose chart issues by @xuefei1313 in https://github.com/VisActor/VChart/pull/4315
* @visactor/vchart: Upgrade vrender dependency to fix animation issues by @xuefei1313 in https://github.com/VisActor/VChart/pull/4325
* @visactor/vchart: Fix extension mark update logic by @xile611 in https://github.com/VisActor/VChart/pull/4318
* @visactor/vchart: Fix font family setting issue by @xuefei1313 in https://github.com/VisActor/VChart/pull/4324
* @visactor/vchart: Fix issue with setDimensionIndex by @xuefei1313 in https://github.com/VisActor/VChart/pull/4291


**📖 Documentation**


* @visactor/vchart: Add candlestick chart guide by @xuefei1313 in https://github.com/VisActor/VChart/pull/4310
* @visactor/vchart: Add theme development guide by @xuanhun in https://github.com/VisActor/VChart/pull/4322
* @visactor/vchart: Add map rewind guide by @xuefei1313 in https://github.com/VisActor/VChart/pull/4326
* @visactor/vchart: Add 3D registration content to guide by @xuefei1313 in https://github.com/VisActor/VChart/pull/4312
* @visactor/vchart: Fix documentation for common chart option labelLayout by @xuefei1313 in https://github.com/VisActor/VChart/pull/4316

**Full Changelog**: https://github.com/VisActor/VChart/compare/v2.0.9...v2.0.10

[more detail about v2.0.10](https://github.com/VisActor/VChart/releases/tag/v2.0.10)

# v2.0.9

2025-11-18


**🆕 New Features**


* @visactor/react-vchart: Add export for registerChartResizeZoomPlugin by @xuefei1313 in https://github.com/VisActor/VChart/pull/4286
* @visactor/vchart: Support effect animation by @purpose233 in https://github.com/VisActor/VChart/pull/4299
* @visactor/vchart: Enhance datazoom and fix bugs by @skie1997 in https://github.com/VisActor/VChart/pull/4065


**🐛 Bug Fixes**


* @visactor/vchart-extension: Fix the vchart-extension packaged artifacts contained an extra version by @xuefei1313 in https://github.com/VisActor/VChart/pull/4277
* @visactor/vchart: Fix markline auto range by @xuefei1313 in https://github.com/VisActor/VChart/pull/4290


**📖 Documentation**


* @visactor/vchart: Fix registerMorph error in example by @xuefei1313 in https://github.com/VisActor/VChart/pull/4285
* @visactor/vchart: Add candlestick demo by @xuefei1313 in https://github.com/VisActor/VChart/pull/4297

**Full Changelog**: https://github.com/VisActor/VChart/compare/v2.0.7...v2.0.9

[more detail about v2.0.9](https://github.com/VisActor/VChart/releases/tag/v2.0.9)

# v2.0.7

2025-11-03

🆕 New Features

@visactor/vchart: Support resize zoom chart plugin by @xuefei1313 in https://github.com/VisActor/VChart/pull/4241
@visactor/vchart: Register transform boxplot by @xile611 in https://github.com/VisActor/VChart/pull/4268
@visactor/vchart: Add translate-issues workflow configuration by @xuefei1313 in https://github.com/VisActor/VChart/pull/4264
@visactor/vchart: Add regression-lines in vchart-extension by @xile611 in https://github.com/VisActor/VChart/pull/4245
@visactor/vchart: Change vrender dependencies, see https://github.com/VisActor/VChart/pull/4224

🐛 Bug Fixes

@visactor/vchart: Fix crosshair not hide by @xile611 in https://github.com/VisActor/VChart/pull/4252
@visactor/vchart: Fix issue of layout by @xuefei1313 in https://github.com/VisActor/VChart/pull/4249
@visactor/vchart: Fix logistic regression line by @xile611 in https://github.com/VisActor/VChart/pull/4263
@visactor/vchart: Fix support regression line for grouped scatter by @xile611 in https://github.com/VisActor/VChart/pull/4248
@visactor/vchart: Fix check if stackData is empty by @kkxxkk2019 in https://github.com/VisActor/VChart/pull/4244
@visactor/vchart: Fix issue of waterfall stack total by @xuefei1313 in https://github.com/VisActor/VChart/pull/4243





[more detail about v2.0.7](https://github.com/VisActor/VChart/releases/tag/v2.0.7)

# v2.0.6

2025-10-14


**What's Changed**

* fix: fix the issue of legend pager by @xuefei1313 in https://github.com/VisActor/VChart/pull/4212
* Feat/support calc in formatter by @xuefei1313 in https://github.com/VisActor/VChart/pull/4211
* Fix/fix error of markline when series no data by @xuefei1313 in https://github.com/VisActor/VChart/pull/4216
* feat: update bugreport metthod by @xuanhun in https://github.com/VisActor/VChart/pull/4221
* feat: upgrade vrender to fix animation bug by @xuefei1313 in https://github.com/VisActor/VChart/pull/4222
* feat: support waterfallType in waterfall chart by @xuefei1313 in https://github.com/VisActor/VChart/pull/4220
* feat: change vrender dependencies by @xuefei1313 in https://github.com/VisActor/VChart/pull/4224


**Full Changelog**: https://github.com/VisActor/VChart/compare/v2.0.5...v2.0.6

[more detail about v2.0.6](https://github.com/VisActor/VChart/releases/tag/v2.0.6)

# v2.0.5

2025-09-19



[more detail about v2.0.5](https://github.com/VisActor/VChart/releases/tag/v2.0.5)

# v2.0.2

2025-07-28


**🆕 New feature**

- **@visactor/vchart**: add the afterClearRect hook of render

**Full Changelog**: https://github.com/VisActor/VChart/compare/v2.0.1...v2.0.2

[more detail about v2.0.2](https://github.com/VisActor/VChart/releases/tag/v2.0.2)

# v2.0.1

2025-07-24


**🆕 New feature**

- **@visactor/vchart**: add config to avoid brush state update. close [#4035](https://github.com/VisActor/VChart/issues/4035)
- **@visactor/vchart**: optimize datazoom animation effect
- **@visactor/vchart**: add the afterClearScreen hook of render

**🐛 Bug fix**

- **@visactor/vchart**: fix issue with 3d chart grid
- **@visactor/vchart**: tickData of axis should update when `sampling` is changed, fix [#4059](https://github.com/VisActor/VChart/issues/4059)
- **@visactor/vchart**: only calculate multi layer label items when need, fix [#4056](https://github.com/VisActor/VChart/issues/4056)
- **@visactor/vchart**: fix resize error when remake, and re-normal aniamtion bug, fix [#4070](https://github.com/VisActor/VChart/issues/4070)
- **@visactor/vchart**: fix issue with feishu block and call setenv when create vchart
- **@visactor/vchart**: fix bug of tooltip triggerOff & tooltip lock
- **@visactor/vchart**: fix tooltip throw error when some tooltip processor is undefined, fix [#4044](https://github.com/VisActor/VChart/issues/4044)
- **@visactor/vchart**: fix `textAlign` not works in tooltip.style.titleLabel, fix [#4043](https://github.com/VisActor/VChart/issues/4043)



[more detail about v2.0.1](https://github.com/VisActor/VChart/releases/tag/v2.0.1)

# v1.13.11

2025-05-29


**🆕 New feature**

- **@visactor/vchart**: add `barGap` option for histogram chart
- **@visactor/vchart**: support tooltip.trigger and crosshair.trigger in theme

**🐛 Bug fix**

- **@visactor/vchart**: fix data-zoom domain when the label of band size is number-like string, fix [#3982](https://github.com/VisActor/VChart/issues/3982)
- **@visactor/vchart**: fix the order of title in mark tooltip when dimension tooltip has no title, fix [#3991](https://github.com/VisActor/VChart/issues/3991)
- **@visactor/vchart**: option `{ poptip: true }` should load `poptipForText`
- **react-vchart**: when use children to render customized tooltip, react-vchart should update
- **@visactor/vchart**: customized render of tooltip should be render in react 17 and react 18

**🔖 other**

- **@visactor/vchart**: fix:Replace all the vchartConstrouctor to vchartConstructor,and ensure backward compatibility with older versions.



[more detail about v1.13.11](https://github.com/VisActor/VChart/releases/tag/v1.13.11)

# v1.13.10

2025-05-16


**🆕 New feature**

- **@visactor/vchart**: tooltip support inside position
- **@visactor/vchart**: mosaic chart supports bandWidthField and percent config, closed [#3945](https://github.com/VisActor/VChart/issues/3945)

**🐛 Bug fix**

- **@visactor/vchart**: export ManualTicker & StreamLight
- **@visactor/vchart**: tooltip should hide when enterable, fix [#3965](https://github.com/VisActor/VChart/issues/3965), fix [#3922](https://github.com/VisActor/VChart/issues/3922)
- **@visactor/vchart**: fix error of enterable tooltip when multiple charts in a page, fix [#3940](https://github.com/VisActor/VChart/issues/3940)
- **@visactor/vchart**: upgrade vgrammar to 0.16.7, fix [#3965](https://github.com/VisActor/VChart/issues/3965)



[more detail about v1.13.10](https://github.com/VisActor/VChart/releases/tag/v1.13.10)

# v1.13.9

2025-04-21


**🆕 New feature**

- **@visactor/vchart**: axis datafilter support context. close [#3332](https://github.com/VisActor/VChart/issues/3332)
- **@visactor/vchart**: gauge support clip when mark outof axis. close [#3859](https://github.com/VisActor/VChart/issues/3859)
- **@visactor/vchart**: markLine and markArea supports render multiple labels

**🐛 Bug fix**

- **@visactor/vchart**: clear event listener for normal animation when updateSpec, [#3881](https://github.com/VisActor/VChart/issues/3881)
- **@visactor/vchart**: fix coordinate of rect crosshair when bandSize is 0, fix [#3907](https://github.com/VisActor/VChart/issues/3907)
- **@visactor/vchart**: when set defaultSelect of crosshair, `axisIndex` should have a default value: 0
- **@visactor/vchart**: fix type error of datazoom texts
- **@visactor/vchart**: the width of title label should auto fit content width when `autoWidth` is true, fix [#3880](https://github.com/VisActor/VChart/issues/3880)
- **@visactor/vchart**: mark line valid judgement. fix[#3857](https://github.com/VisActor/VChart/issues/3857)
- **@visactor/vchart**: empty placeholder should update after data is updated, fix [#3855](https://github.com/VisActor/VChart/issues/3855)

**🔨 Refactor**

- **@visactor/vchart**: brush interactive. close[#3765](https://github.com/VisActor/VChart/issues/3765) & [#3262](https://github.com/VisActor/VChart/issues/3262) & [#2802](https://github.com/VisActor/VChart/issues/2802) & [#3885](https://github.com/VisActor/VChart/issues/3885)

**📖 Site / documentation update**

- **@visactor/vchart**: supply interface of docs. fix [#3877](https://github.com/VisActor/VChart/issues/3877)



[more detail about v1.13.9](https://github.com/VisActor/VChart/releases/tag/v1.13.9)

# v1.13.8

2025-03-31


**🆕 New feature**

- **@visactor/vchart**: add  `alwayCalculateTotal` for total label
- **@visactor/vchart**: add options `onlyFull` to lockStatisticsByDomain

**🐛 Bug fix**

- **@visactor/vchart**: fix the issue where the bar chart grow animation does not work correctly when the axis `zero: false`, [#3808](https://github.com/VisActor/VChart/issues/3808)
- **@visactor/vchart**: crosshair should hide when label is invalid
- **@visactor/vchart**: crosshair should hide when datazoom change
- **@visactor/vchart**: fix the bubble level issue prevented by event.prevent, [#3728](https://github.com/VisActor/VChart/issues/3728)
- **@visactor/vchart**: fix error when load gauge chart on demand, [#3836](https://github.com/VisActor/VChart/issues/3836)
- **@visactor/vchart**: `legends.title.visible` should change visiblity of title in legend, fix [#3846](https://github.com/VisActor/VChart/issues/3846)
- **@visactor/vchart**: fix the issue of pictogram svg path has not been drawn
- **react-vchart**: children of tooltip should not be set to spec
- **@visactor/vchart**: data.fields can set domain of field
- **@visactor/vchart**: fix bug of zoomable in mobile device which only use pointer event
- **@visactor/vchart**: fix datazoom drag and zoom triggered at the same time, fix [#3819](https://github.com/VisActor/VChart/issues/3819)



[more detail about v1.13.8](https://github.com/VisActor/VChart/releases/tag/v1.13.8)

# v1.13.7

2025-03-14


**🆕 New feature**

- **@visactor/vchart**: support `position` config in totalLabel, [#3396](https://github.com/VisActor/VChart/issues/3396)

**🐛 Bug fix**

- **@visactor/vchart**: vchart should not merge original options, fix [#3798](https://github.com/VisActor/VChart/issues/3798)
- **react-vchart**: lifecycle event callback should be fired, fix [#3792](https://github.com/VisActor/VChart/issues/3792)
- **@visactor/vchart**: react-vchart should export `WaterfallChart`, fix [#3791](https://github.com/VisActor/VChart/issues/3791)
- **@visactor/vchart**: fix fontFamily of richtext, fix [#3768](https://github.com/VisActor/VChart/issues/3768)
- **@visactor/vchart**: fix issue with wx get context

**🔧 Configuration releated**

- **@visactor/vchart**: add util to export



[more detail about v1.13.7](https://github.com/VisActor/VChart/releases/tag/v1.13.7)

# v1.13.6

2025-03-03


**🆕 New feature**

- **@visactor/vchart**: optimize the display effect of waterfall chart lieaderLine
- **@visactor/vchart**: add `transformRatioText` config for transformRatio text content in funnel tooltip, [#3704](https://github.com/VisActor/VChart/issues/3704)

**🐛 Bug fix**

- **@visactor/vchart**: display line label normally when seriesField is missing, [#3709](https://github.com/VisActor/VChart/issues/3709)
- **@visactor/vchart**: customMark should return components in `getVRenderComponents()`, fix [#3727](https://github.com/VisActor/VChart/issues/3727)
- **@visactor/vchart**: map zoom error bug. fix[#3743](https://github.com/VisActor/VChart/issues/3743)

**🔖 other**

- **@visactor/vchart**: 'feat: support `clamp` in linear scales, [#3738](https://github.com/VisActor/VChart/issues/3738)'



[more detail about v1.13.6](https://github.com/VisActor/VChart/releases/tag/v1.13.6)

# v1.13.5

2025-02-14


**🆕 New feature**

- **@visactor/vchart**: add params of startvalue and endvalue in brushend event
- **@visactor/vchart**: label support triggering mark tooltip, [#3634](https://github.com/VisActor/VChart/issues/3634)
- **@visactor/vchart**: export getCartesianDimensionInfo and getPolarDimensionInfo, fix [#3668](https://github.com/VisActor/VChart/issues/3668)
- **@visactor/vchart**: support stackInverse for waterfall chart

**🐛 Bug fix**

- **@visactor/vchart**: incorrect update animation of funnel transform mark, [#3685](https://github.com/VisActor/VChart/issues/3685)
- **@visactor/vchart**: fix the issue where the upper mark in stacked area overlaps the border of lower mark, [#3684](https://github.com/VisActor/VChart/issues/3684)
- **@visactor/vchart**: fix cache of crosshair value when hide crosshair, fix [#3686](https://github.com/VisActor/VChart/issues/3686)
- **@visactor/vchart**: allow dispatch roam zoom in datazoom component. fix[#3714](https://github.com/VisActor/VChart/issues/3714)
- **@visactor/vchart**: datazoom and scrollbar realtime not work. fix[#3716](https://github.com/VisActor/VChart/issues/3716)
- **@visactor/vchart**: fix the issue of tickAlign accuracy
- **@visactor/vchart**: indicator should show when switch `visible`, fix [#3675](https://github.com/VisActor/VChart/issues/3675)
- **@visactor/vchart**: circular progress should support morphing
- **@visactor/vchart**: tooltip should not handle mousemove or mouseout when enter tooltip, fix [#3708](https://github.com/VisActor/VChart/issues/3708)
- **@visactor/vchart**: tooltip should auto wrap when `maxWidth` is valid and `multiLine` is not false, fix [#3718](https://github.com/VisActor/VChart/issues/3718)
- **@visactor/vchart**: fix the type definition of text mark

**🔨 Refactor**

- **@visactor/vchart**: optimize performance of pictogram

**📖 Site / documentation update**

- **@visactor/vchart**: update options of poptip, close [#3139](https://github.com/VisActor/VChart/issues/3139)



[more detail about v1.13.5](https://github.com/VisActor/VChart/releases/tag/v1.13.5)

# v1.13.4

2025-01-17


**🆕 New feature**

- **@visactor/vchart**: add wordCloudConfig in _wordCloudTransformOption()

**🐛 Bug fix**

- **@visactor/vchart**: fix error of tooltip about `showDelay`, fix [#3663](https://github.com/VisActor/VChart/issues/3663)
- **@visactor/vchart**: fix offset of tooltip, fix [#3666](https://github.com/VisActor/VChart/issues/3666)
- **@visactor/vchart**: fix bug of parse lineHeight of tooltip row, fix [#3643](https://github.com/VisActor/VChart/issues/3643)
- **@visactor/vchart**: axis break's scope calculate error, fix[#3656](https://github.com/VisActor/VChart/issues/3656)
- **@visactor/vchart**: fix the issue where map drag interaction cannot be terminated outside the canvas, [#3650](https://github.com/VisActor/VChart/issues/3650)
- **@visactor/vchart**: fix the issue where map drag interaction cannot be terminated outside the canvas.



[more detail about v1.13.4](https://github.com/VisActor/VChart/releases/tag/v1.13.4)

# v1.13.3

2025-01-08


**🆕 New feature**

- **@visactor/vchart**: add datum to params on axis-label event
- **@visactor/vchart**: wrap some hook in vgrammar

**🐛 Bug fix**

- **@visactor/vchart**: fix the issue of incorrect label display in 3D charts, [#3584](https://github.com/VisActor/VChart/issues/3584)
- **@visactor/vchart**: fix the issue of animation in 3d wordcloud not work
- **@visactor/vchart**: brush data will be undefined when mark is hovered. fix[#3623](https://github.com/VisActor/VChart/issues/3623)
- **@visactor/vchart**: fix style of dom tooltip when tooltip has customized child, fix [#3615](https://github.com/VisActor/VChart/issues/3615)
- **@visactor/vchart**: fix error update of dom tooltip when update theme, fix [#3619](https://github.com/VisActor/VChart/issues/3619)
- **@visactor/vchart**: fix position of html tooltip when confine is false, fix [#3632](https://github.com/VisActor/VChart/issues/3632)
- **@visactor/vchart**: fix the typographical error of dataset tutorial
- **@visactor/vchart**: compilier should add dpr to vrender
- **@visactor/vchart**: fix invisible region blocking mark events, [#3638](https://github.com/VisActor/VChart/issues/3638)
- **@visactor/vchart**: undefined points shoulde not show when dimension hover, fix [#3610](https://github.com/VisActor/VChart/issues/3610)
- **@visactor/vchart**: fix layout error of title component, fix [#3614](https://github.com/VisActor/VChart/issues/3614)



[more detail about v1.13.3](https://github.com/VisActor/VChart/releases/tag/v1.13.3)

# v1.13.2

2024-12-24


**🆕 New feature**

- **@visactor/vchart**: add miss Series and Chart in react vchart, close [#3578](https://github.com/VisActor/VChart/issues/3578)
- **@visactor/vchart**: vchart support clickInterval params

**🐛 Bug fix**

- **@visactor/vchart**: support percentage state radius config in gauge segment mark, [#3459](https://github.com/VisActor/VChart/issues/3459)
- **@visactor/vchart**: media query should not throw error when has empty axis, related to [#3575](https://github.com/VisActor/VChart/issues/3575)
- **@visactor/vchart**: tooltip should not render empty column when `hasShape` of tooltip is `false`, related to [#3572](https://github.com/VisActor/VChart/issues/3572)
- **@visactor/vchart**: `othersLine` of tooltip can be hidden by `visible: false`, related to [#3572](https://github.com/VisActor/VChart/issues/3572)
- **@visactor/vchart**: fix position of tooltip, related to [#3590](https://github.com/VisActor/VChart/issues/3590)
- **@visactor/vchart**: page should not crash when `tickStep` is too small, fix  [#3591](https://github.com/VisActor/VChart/issues/3591)
- **@visactor/vchart**: fix updating of customized DOM when has interactive layer, fix  [#3587](https://github.com/VisActor/VChart/issues/3587)
- **@visactor/vchart**: fix axis breaks when set `tickStep`, fix  [#3560](https://github.com/VisActor/VChart/issues/3560)



[more detail about v1.13.2](https://github.com/VisActor/VChart/releases/tag/v1.13.2)

# v1.13.1

2024-12-17


**🆕 New feature**

- **@visactor/vchart**: add config `customFilter` to legend, support cutomized filter function, close [#3492](https://github.com/VisActor/VChart/issues/3492)
- **@visactor/vchart**: Area chart supports setting labels in the middle `'inside-middle'`, close [#3353](https://github.com/VisActor/VChart/issues/3353)

**🐛 Bug fix**

- **@visactor/vchart**: fix break of waterfall, fix [#3544](https://github.com/VisActor/VChart/issues/3544)
- **@visactor/vchart**: fix the bug of updateModelSpecSync can not set axis.tick.forceTickCount
- **@visactor/vchart**: fix filter of lock domain when field is array, related [#3469](https://github.com/VisActor/VChart/issues/3469)
- **@visactor/vchart**: fix size of datazoom when update, fix [#3521](https://github.com/VisActor/VChart/issues/3521)
- **@visactor/vchart**: html tooltip can reuse the dom content and fix the unneed animation
- **@visactor/vchart**: fix update of extensionMark when mark has `name`, fix [#3547](https://github.com/VisActor/VChart/issues/3547)
- **@visactor/vchart**: fix indicator when change visible to be false, fix [#3506](https://github.com/VisActor/VChart/issues/3506)
- **@visactor/vchart**: fix tooltip content when only has `valueFormatter` or `keyFormatter`
- **@visactor/vchart**: fix style of dom tooltip
- **vchart-extension**: series-break should keep align width axis break, related to [#3560](https://github.com/VisActor/VChart/issues/3560)
- **@visactor/vchart**: breaks should consider the `min` and `max` of axis, related to [#3560](https://github.com/VisActor/VChart/issues/3560)



[more detail about v1.13.1](https://github.com/VisActor/VChart/releases/tag/v1.13.1)

# v1.13.0

2024-12-06


**🆕 New feature**

- **@visactor/vchart**: add pictogram chart
- **@visactor/vchart**: support auto generated scrollbar in sankey, close [#2838](https://github.com/VisActor/VChart/issues/2838)
- **@visactor/vchart**: react vchart support event filter, close [#3461](https://github.com/VisActor/VChart/issues/3461)
- **@visactor/vchart**: tooltip key/content support config by field, close [#2576](https://github.com/VisActor/VChart/issues/2576)
- **@visactor/vchart**: support max height of tooltip, by percent value , close [#2675](https://github.com/VisActor/VChart/issues/2675)


**🐛 Refactor**


- **@visactor/vchart**: [Break Change] refactor the implement of html tooltip, fix [#3137](https://github.com/VisActor/VChart/issues/3137), close [#2924](https://github.com/VisActor/VChart/issues/2924), close [#2591](https://github.com/VisActor/VChart/issues/2591)
- **@visactor/vchart**: [Break Change] support label overlap for inside arc labels by default


**⚡ Performance optimization**


- **@visactor/vchart**: [Break Change] vrender optimize the bounds of text, which will change the display of all text



[more detail about v1.13.0](https://github.com/VisActor/VChart/releases/tag/v1.13.0)

# v1.12.15

2024-12-05


**🆕 New feature**

- **@visactor/vchart**: support `restorePosition` in position/bound label overlap strategy

**🐛 Bug fix**

- **@visactor/vchart**: optimize `shiftY` of label



[more detail about v1.12.15](https://github.com/VisActor/VChart/releases/tag/v1.12.15)

# v1.12.14

2024-12-05


**🆕 New feature**

- **@visactor/vchart**: support `autoRefreshDpr` in chart options
- **@visactor/vchart**: dataZoom can do filter when has `lockStatisticsByDomain`, close [#3469](https://github.com/VisActor/VChart/issues/3469)
- **@visactor/vchart**: add marker context to support the same color as series. close[#3437](https://github.com/VisActor/VChart/issues/3437)
- **@visactor/vchart**: update options `maxNodeHeight`, `maxLinkHeight` in sankey, close 3439
- **@visactor/vchart-extension**: add component `series-break`, close [#3450](https://github.com/VisActor/VChart/issues/3450)

**🐛 Bug fix**

- **@visactor/vchart**: upgrade scrollbar visible after layout. fix[#3452](https://github.com/VisActor/VChart/issues/3452)
- **@visactor/vchart**: fix `adjacency` in sankey, fix [#3460](https://github.com/VisActor/VChart/issues/3460)
- **@visactor/vchart**: not update layout when scrollbar domain is the same as before. fix[#3452](https://github.com/VisActor/VChart/issues/3452)
- **@visactor/vchart**: value in scale range should consider about whole range. fix[#3446](https://github.com/VisActor/VChart/issues/3446)
- **@visactor/vchart**:  when the `invalidType` of line is  `"link"`, line should be connected rightly. fix [#3436](https://github.com/VisActor/VChart/issues/3436), fix [#3238](https://github.com/VisActor/VChart/issues/3238)
- **@visactor/vchart**:  richtext should work when set state, fix [#3465](https://github.com/VisActor/VChart/issues/3465)



[more detail about v1.12.14](https://github.com/VisActor/VChart/releases/tag/v1.12.14)

# v1.12.13

2024-11-22


**🐛 Bug fix**

- **@visactor/vchart**: fix `groupKey` of boxplot series, fix [#3409](https://github.com/VisActor/VChart/issues/3409), related to [#2855](https://github.com/VisActor/VChart/issues/2855)
- **@visactor/vchart**: fix the issue where the length of the outerlabel line is incorrect when richtext, fix [#3441](https://github.com/VisActor/VChart/issues/3441)



[more detail about v1.12.13](https://github.com/VisActor/VChart/releases/tag/v1.12.13)

# v1.12.12

2024-11-18


**🐛 Bug fix**

- **@visactor/vchart**: fix: fix the issue where modifying area.visible through updateSpec does not take effect, related [#3393](https://github.com/VisActor/VChart/issues/3393)
- **@visactor/vchart**: fix incorrect rendering when changing `direction` via updateSpec in area chart, related [#3406](https://github.com/VisActor/VChart/issues/3406)
- **@visactor/vchart**: fix zIndex of background image, fix [#3403](https://github.com/VisActor/VChart/issues/3403)
- **@visactor/vchart**: fix error of tooltip when chart is released, fix [#3428](https://github.com/VisActor/VChart/issues/3428)

**⚡ Performance optimization**

- **@visactor/vchart**: optimize the effect of break data



[more detail about v1.12.12](https://github.com/VisActor/VChart/releases/tag/v1.12.12)

# v1.12.11

2024-11-13


**🆕 New feature**

- **@visactor/vchart**: support axis sync to the axis that has breaks
- **@visactor/vchart**: tooltip can support customized `trigger` and `triggerOff`

**🐛 Bug fix**

- **@visactor/vchart**: fix the issue where the axis breaks render incorrectly in some cases
- **@visactor/vchart**: fix `zIndex` of series, fix [#3395](https://github.com/VisActor/VChart/issues/3395)
- **@visactor/vchart**: fix layout of title when orient is "left" or "right", fix [#3401](https://github.com/VisActor/VChart/issues/3401)
- **@visactor/vchart**: fix the issue of custom svg string in tooltip shape, related [#3384](https://github.com/VisActor/VChart/issues/3384)
- **@visactor/vchart**: tooltip `enterable` should work when update, fix [#3405](https://github.com/VisActor/VChart/issues/3405)
- **@visactor/vchart**: fix tooltip position by `mode: pointer`, close [#3367](https://github.com/VisActor/VChart/issues/3367)
- **@visactor/vchart**: wordcloud should not throw error when `word.visible` is `false`, fix [#3378](https://github.com/VisActor/VChart/issues/3378)
- **@visactor/vchart**: fix the issue where the scrolling legend triggers map zooming under certain conditions, related [#3391](https://github.com/VisActor/VChart/issues/3391)



[more detail about v1.12.11](https://github.com/VisActor/VChart/releases/tag/v1.12.11)

# v1.12.10

2024-10-31

**🆕 New feature**

- **@visactor/vchart**: pie series support center of percent string

**🐛 Bug fix**

- **@visactor/vchart**: scroll not dispatch view update when axis is not display. fix[#3278](https://github.com/VisActor/VChart/issues/3278)
- **@visactor/vchart**: changes to `roam` via updateSpec do not take effect
- **@visactor/vchart**: fix the issue of symbolActiveMark visible setting
- **@visactor/vchart**: fix issue with chart background in harmony
- **@visactor/vchart**: fix event of angle axis in radarchart, fix [#3343](https://github.com/VisActor/VChart/issues/3343)
- **@visactor/vchart**: type issue of title theme
- **@visactor/vchart**: fix the issue of incorrect display of legend scrollbar in boundary scenarios

**🔨 Refactor**

- **@visactor/vchart**: optimize setter and getter about markConfig
- **@visactor/vchart**: Optimize the issue of excessive omission of head and tail labels when axis labels are rotated in Cartesian coordinate systems.
- **@visactor/vchart**: Optimize the automatic line wrapping effect of axis labels in Cartesian coordinate systems.

[more detail about v1.12.10](https://github.com/VisActor/VChart/releases/tag/v1.12.10)

# v1.12.9

2024-10-25


**🆕 New feature**

- **@visactor/vchart**: support tooltip for overlapped points, close [#3224](https://github.com/VisActor/VChart/issues/3224)

**🐛 Bug fix**

- **@visactor/vchart**: fixed the issue where map labels do not scale accordingly after updateSpec.
- **@visactor/vchart**: all the SeriesData should call `compileData()`, fix [#3322](https://github.com/VisActor/VChart/issues/3322)
- **@visactor/vchart**: clear throttle timer when out, fix [#3326](https://github.com/VisActor/VChart/issues/3326)
- **@visactor/vchart**: fix `tooltipHide` event when handler is empty
- **@visactor/vchart**: tooltip data should has `datum` in each line
- **@visactor/vchart**: Fixed the issue of label component misalignment in specific situations
- **@visactor/vchart**: Fixed the issue of partial blank areas in charts during resizing when dpr is not an integer, fix [#3255](https://github.com/VisActor/VChart/issues/3355)


[more detail about v1.12.9](https://github.com/VisActor/VChart/releases/tag/v1.12.9)

# v1.12.8

2024-10-15


**🆕 New feature**

- **@visactor/vchart**: support `firstVisible` of axis label, close [#3200](https://github.com/VisActor/VChart/issues/3200)
- **@visactor/vchart**: support `roam.blank` to enable dragging from blank area of region in map chart
- **@visactor/vchart**: optimize data empty condition
 **@visactor/vchart**: Label component text style supports `wordBreak: "keep-all"`

**🐛 Bug fix**

- **@visactor/vchart**: chart should `remake` when visible of axis change, fix [#3287](https://github.com/VisActor/VChart/issues/3287)
- **@visactor/vchart**: fix visible change of label, fix [#3277](https://github.com/VisActor/VChart/issues/3277)
- **@visactor/vchart**: custom theme by chartType cannot work in initial options, [#3285](https://github.com/VisActor/VChart/issues/3285)
- **@visactor/vchart**: fix issue of `html` and `dom` not work correctly in label
- **@visactor/vchart**: axis line on zero should consider the bindAxis's inverse, fixed[#3306](https://github.com/VisActor/VChart/issues/3306)
- **react-vchart**: register labels by default in circlePacking, sankey, sunburst, treemap, venn, fix [#3148](https://github.com/VisActor/VChart/issues/3148)
- **@visactor/vchart**: Fix the issue where `item.label.space` and `pager.space` are not effective in discrete legends

**🔨 Refactor**

- **@visactor/vchart**: refactor implement of `enterable` in tooltip component


[more detail about v1.12.8](https://github.com/VisActor/VChart/releases/tag/v1.12.8)

# v1.12.7

2024-09-29


**🆕 New feature**

- **@visactor/vchart**: feat: support `minLength` in funnel outerlabel line
- **react-vchart**: support `morphConfig` of react-vchart, close [#3219](https://github.com/VisActor/VChart/issues/3219)

**🐛 Bug fix**

- **@visactor/vchart**: fix error of `updateSpec` when data changed, fix [#3261](https://github.com/VisActor/VChart/issues/3261)
- **@visactor/vchart**: color of linear progress track in dark mode
- **@visactor/vchart**: datazoom state field and value field is incomplete problem. fix[#3199](https://github.com/VisActor/VChart/issues/3199)
- **@visactor/vchart**: fix title of axis when the bounds is empty, fix [#3265](https://github.com/VisActor/VChart/issues/3265)
- **@visactor/vchart**: fix media-query when `updateSpec`
- **@visactor/vchart**: fix updateSpec when add attributes `width`, `height` to `spec`



[more detail about v1.12.7](https://github.com/VisActor/VChart/releases/tag/v1.12.7)

# v1.12.6

2024-09-23

**🆕 New Features**

- **@visactor/vchart**: Added lifecycle hooks, `afterCreateVChart`, `beforeInitializeChart`, `afterInitializeChart`
- **@visactor/vchart**: Polar coordinate angle axis supports configurations like `autoLimit`, `autoWrap`, `autoHide`, etc.

**🐛 Bug Fixes**

- **@visactor/vchart**: Allow adding `indicator` components in polar charts
- **@visactor/vchart**: Fix the default value issue of `position` in the `label` component, fix [#3242](https://github.com/VisActor/VChart/issues/3242)
- **@visactor/vchart**: Fix type error, change `type` in `PointerMarkSpec` to an optional type, fix [#3227](https://github.com/VisActor/VChart/issues/3227)
- **@visactor/vchart**: Use `throttle` for throttling when triggering `resize`
- **@visactor/vchart**: Fix the chart update type to be `reCompile` instead of `remake` when updating `label` configurations
- **@visactor/vchart**: Fix the issue where `customMark` does not support `markName` event filters
- **@visactor/vchart**: Fix the issue of incorrect animation triggering during radar chart updates, fix [#3228](https://github.com/VisActor/VChart/issues/3228)

[more detail about v1.12.6](https://github.com/VisActor/VChart/releases/tag/v1.12.6)

# v1.12.5

2024-09-23

**🆕 New Features**

- **@visactor/vchart**: extension mark and customized mark support `markName` event filter

**🐛 Bug Fixes**

- **@visactor/vchart**: optimize first axis label autolimit effect of cartesian chart
- **@visactor/vchart**: `animationUpdate` should also control labels animation
- **@visactor/vchart**: fix default value of circular-progress, fix [#2683](https://github.com/VisActor/VChart/issues/2683)
- **@visactor/vchart**: fix display of radar-chart when has negative radius
- **@visactor/vchart**: `word.style.fontWeight` should change the style of text in wordcloud, fix [#3212](https://github.com/VisActor/VChart/issues/3212)

**🔨 Refactor**

- **@visactor/vchart**: simplify `getSpecInfo`

[more detail about v1.12.5](https://github.com/VisActor/VChart/releases/tag/v1.12.5)


# v1.12.4

2024-09-09


**🆕 New feature**

- **@visactor/vchart**: support axis break
- **@visactor/vchart**: stackCornerRadius support callback. feat[#3164](https://github.com/VisActor/VChart/issues/3164)
- **@visactor/vchart**: add `crossNodeAlign` to sankey

**🐛 Bug fix**

- **@visactor/vchart**: bind first axis to series but not last. fix[#3139](https://github.com/VisActor/VChart/issues/3139)
- **@visactor/vchart**: crosshair won't update when switch theme
- **@visactor/vchart**: wordcloud text overlap. fix[#3177](https://github.com/VisActor/VChart/issues/3177)
- **@visactor/vchart**: fix zIndex of label in pie-chart

**🔧 Configuration releated**

- **@visactor/vchart**: clear state when updateSpec. fix[#3162](https://github.com/VisActor/VChart/issues/3162)



[more detail about v1.12.4](https://github.com/VisActor/VChart/releases/tag/v1.12.4)

# v1.12.3

2024-09-05


**🐛 Bug fix**

- **@visactor/vchart**: cannot disable label update animation by `option.animation:false`



[more detail about v1.12.3](https://github.com/VisActor/VChart/releases/tag/v1.12.3)

# v1.12.2

2024-09-05


**🆕 New feature**

- **brush**: add config to control zoom when brush empty data. close[#2934](https://github.com/VisActor/VChart/issues/2934)
- **@visactor/vchart**: support 'inside-center' label position in pie chart

**🐛 Bug fix**

- **@visactor/vchart**: rangeMode of scrollbar not work. fix[#3147](https://github.com/VisActor/VChart/issues/3147)
- **@visactor/vchart**: fix error of `barWidth`, `barMinWidth`, `barMaxWidth` when value is null
- **@visactor/vchart**: x brush filter not work. fix[#3111](https://github.com/VisActor/VChart/issues/3111)
- **@visactor/vchart**: indicator stop tooltip interactive. fix[#3123](https://github.com/VisActor/VChart/issues/3123)
- **@visactor/vchart**: fix error of `getCenter` when layoutRadius is a customized function in radar
- **@visactor/vchart**: media query causes incorrect render result, [#3102](https://github.com/VisActor/VChart/issues/3102)
- **@visactor/vchart**: normal animation not work since v1.12.0
- **@visactor/vchart**: sankey scale update not work
- **@visactor/vchart**: fix error of sankey when some customized mark has name "node"
- **@visactor/vchart**: fix dimension value of tooltip when has innerOffset, fix [#2923](https://github.com/VisActor/VChart/issues/2923)
- **@visactor/vchart**: vchart should not throw error when the values of series data is empty, fix [#3082](https://github.com/VisActor/VChart/issues/3082)
- **@visactor/vchart**: fix error of `updateSpec` when array change
- **@visactor/vchart**: wordcloud fill not update after updateSpec. fix[#3122](https://github.com/VisActor/VChart/issues/3122)
- **@visactor/vchart**: wordcloud scale update not work. fix[#3129](https://github.com/VisActor/VChart/issues/3129)

**🔨 Refactor**

- **@visactor/vchart**: refactor the parser of tooltip pattern

**📖 Site / documentation update**

- **@visactor/vchart**: fix issue of treemap.label not shown in option pages, fix [#2562](https://github.com/VisActor/VChart/issues/2562)
- **@visactor/vchart**: update docs about circular progress, close [#2987](https://github.com/VisActor/VChart/issues/2987)



[more detail about v1.12.2](https://github.com/VisActor/VChart/releases/tag/v1.12.2)

# v1.12.1

2024-08-21


**🐛 Bug fix**

- **@visactor/vchart**: x brush filter not work. fix [#3111](https://github.com/VisActor/VChart/issues/3111)
- **@visactor/vchart**: fix error of `getCenter` when layoutRadius is a customized function in radar
- **@visactor/vchart**: media query causes incorrect render result, [#3102](https://github.com/VisActor/VChart/issues/3102)
- **@visactor/vchart**: vchart should not throw error when the values of series data is empty, fix [#3082](https://github.com/VisActor/VChart/issues/3082)



[more detail about v1.12.1](https://github.com/VisActor/VChart/releases/tag/v1.12.1)

# v1.12.0

2024-08-16


**🆕 New feature**

  - **@visactor/vchart**: marker's `coordinates` and `positions` property support callback
  - **@visactor/vchart**: support `animationState` config
  - **@visactor/vchart**: show evenly divided pie chart with `showAllZero`
  - **@visactor/vchart**: enable `supportNegative` option to treat negative values as absolute values
  - **@visactor/vchart**: support theme config by chart type
  - **@visactor/vchart**: support text shape of word-cloud
  - **@visactor/vchart**: add new chart mosaic chart
  - **@visactor/vchart**: support customized tick function of linear axis
  - **@visactor/vchart**: add emptyPlaceholder and emptyCircle for pie chart

  ## 🐛 fix
  - **@visactor/vchart**: y-axis is reverted after brush zoomin. fix [#3089](https://github.com/VisActor/VChart/issues/3089)
  - **@visactor/vchart**: mark-point position type error fix
  ## 🔨 refactor
  - **@visactor/vchart**: refactor the graphics in linear-progress chart
  - **@visactor/vchart**: use label component to refactor sankey label
  - **@visactor/vchart**: stack can be required by need
  ## 🔖 other
  - **@visactor/vchart**: sequence support bottom axes. fix [#2927](https://github.com/VisActor/VChart/issues/2927)



[more detail about v1.12.0](https://github.com/VisActor/VChart/releases/tag/v1.12.0)

# v1.11.12

2024-08-15


**🆕 New feature**

- **@visactor/vchart**: support `layoutRadius` of pie

**🐛 Bug fix**

- **@visactor/vchart**: fix params of tickCount in linear-axis-mixin,  fix [#3053](https://github.com/VisActor/VChart/issues/3053)
- **@visactor/vchart**: fix `padding` of region not work
- **@visactor/vchart**: brush error after legend filter. fix[#3061](https://github.com/VisActor/VChart/issues/3061)
- **@visactor/vchart**: fix funnel chart color bug with different category and series fields
- **@visactor/vchart**: fix issue with harmony event
- **@visactor/vchart**: fix type error of react vchart, fix [#3065](https://github.com/VisActor/VChart/issues/3065)
- **@visactor/vchart**: tooltip should show when chart has multiple regions
- **@visactor/vchart**: fix the issue background of chart not updated, fix [#3054](https://github.com/VisActor/VChart/issues/3054)
- **@visactor/vchart**: fix the update of `startAngle` and `endAngle` in pie chart, fix [#3059](https://github.com/VisActor/VChart/issues/3059)
- **@visactor/vchart**: fix switch `visible` of legend, fix [#3060](https://github.com/VisActor/VChart/issues/3060)



[more detail about v1.11.12](https://github.com/VisActor/VChart/releases/tag/v1.11.12)

# v1.11.11

2024-08-06


**🆕 New feature**

- **@visactor/vchart**: label line support custom path. close[#3000](https://github.com/VisActor/VChart/issues/3000)
- **@visactor/vchart**: upgrade vrender to 0.19.20, to support `catmullRom` and `catmullRomClosed` curveType, related [#2610](https://github.com/VisActor/VChart/issues/2610)

**🐛 Bug fix**

- **@visactor/vchart**: fix crosshair of histogram, fix [#2826](https://github.com/VisActor/VChart/issues/2826)
- **@visactor/vchart**: use `vglobal.getElementById` to replace `document.getElementById`
- **@visactor/vchart**: liquid gradient not work after reverse
- **@visactor/vchart**: add group mark to fix gradient color bug of liquid and add rect shape to fix rect symbol padding bug
- **@visactor/vchart**: fix `lockAfterClick` of tooltip, related [#1574](https://github.com/VisActor/VChart/issues/1574)
- **@visactor/vchart**:  prevent trigger original event in panEnd composite event [#2931](https://github.com/VisActor/VChart/issues/2931)
- **@visactor/vchart**: charts should not stack when only specify `stackValue` but `stack` is false, fix [#3005](https://github.com/VisActor/VChart/issues/3005)
- **@visactor/vchart**: `updateData` incorrect with datazoom, related [#3041](https://github.com/VisActor/VChart/issues/3041)
- **@visactor/vchart**: fix issue of `updateSpec` when visible of grid in axis change, fix [#3004](https://github.com/VisActor/VChart/issues/3004)
- **@visactor/vchart**: fix fontFamily when update theme, fix [#3028](https://github.com/VisActor/VChart/issues/3028)

**🔖 other**

- **@visactor/vchart**: fix:curveType `monotone` in seriesStyle not work



[more detail about v1.11.11](https://github.com/VisActor/VChart/releases/tag/v1.11.11)

# v1.11.10

2024-07-24


**🆕 New feature**

- **@visactor/vchart**: liquid support reverse and target mark. close [#2977](https://github.com/VisActor/VChart/issues/2977)  & close [#2978](https://github.com/VisActor/VChart/issues/2978)
- **@visactor/vchart**: add `totalScale` params in geo zoom event
- **@visactor/vchart**: support `geoZoomByIndex`/`geoZoomById` API, close [#2925](https://github.com/VisActor/VChart/issues/2925)
- **@visactor/vchart**: marker label background support  custom path. close [#2959](https://github.com/VisActor/VChart/issues/2959)

**🐛 Bug fix**

- **@visactor/vchart**: prevent issue with ios bug while pointEvent is configed
- **@visactor/vchart**: liquid gradient not work after reverse
- **@visactor/vchart**: prevent trigger original event in zoomEnd composite event [#2931](https://github.com/VisActor/VChart/issues/2931)
- **@visactor/vchart**: fix error of setDimentionIndex when dimension axis is linear

**🔧 Configuration releated**

- **@visactor/vchart**: update rollup.config.js to fix es5/index.js, fix [#2971](https://github.com/VisActor/VChart/issues/2971)



[more detail about v1.11.10](https://github.com/VisActor/VChart/releases/tag/v1.11.10)

# v1.11.9

2024-07-17


**🆕 New feature**


* @visactor/vchart: tooltip theme support transition duration


**🐛 Bug fix**


* @visactor/vchart: fix statistics confict of linear and discrete field, close [#2926](https://github.com/VisActor/VChart/issues/2926)
* @visactor/vchart: fix theme error of update spec
* @visactor/vchart: fix update of label when udpate spec
* @visactor/vchart: fix bug of polar point update aniamtion
* @visactor/vchart: react attributes should support react 17
* @visactor/vchart: fix height of link when set `minNodeHeight` of sankey



[more detail about v1.11.9](https://github.com/VisActor/VChart/releases/tag/v1.11.9)

# v1.11.7

2024-07-06


**🆕 New feature**
# v1.11.7

2024-07-06


**🆕 New feature**

- **@visactor/vchart**: support configuring callback function in indicator text style attributes, [#2540](https://github.com/VisActor/VChart/issues/2540)
- **@visactor/vchart**: add options `hideTimer` in toolti, to hide tooltip by timer
- **@visactor/vchart**: support `updateIndicatorDataById`/`updateIndicatorDataByIndex` API, related [#2776](https://github.com/VisActor/VChart/issues/2776)
- **@visactor/vchart**: add `userUpdateOptions` to let user specify update type of charts, fix some animation bug

**🐛 Bug fix**

- **barbackground**: datakey is undefined when set custom datakey fix [#2908](https://github.com/VisActor/VChart/issues/2908)
- **@visactor/vchart**: fix the issue where `barMaxWidth` does not work when `barWidth` is configured, [#2885](https://github.com/VisActor/VChart/issues/2885)`
- **@visactor/vchart**: line/area clip animation by incorrect direction
- **crosshair**: fix bug of crosshair position when legend filter data. fix [#2905](https://github.com/VisActor/VChart/issues/2905)
- **@visactor/vchart**: fix polar animation logic for radar charts
- **@visactor/vchart**: type define fix

[more detail about v1.11.7](https://github.com/VisActor/VChart/releases/tag/v1.11.7)

# v1.11.6

2024-06-27


**🐛 功能修复**

- **@visactor/vchart**: 修复图表背景不支持渐变色配置的问题
- **animation**: 修复玫瑰图重复更新，动画bug，关闭[#2856](https://github.com/VisActor/VChart/issues/2856)
- **@visactor/vchart**:修复类型定义 `ITooltipTheme`, 关闭 [#2850](https://github.com/VisActor/VChart/issues/2850)
- **@visactor/vchart**: 修复`updateSpec`时，更新动画没有触发的问题 [#2835](https://github.com/VisActor/VChart/issues/2835) [#2836](https://github.com/VisActor/VChart/issues/2836)



[更多详情请查看 v1.11.6](https://github.com/VisActor/VChart/releases/tag/v1.11.6)

# v1.11.5

2024-06-21


**🆕 New feature**

- **@visactor/vchart**: add option `style.align` of Tooltip, support RTL tooltip
-

**🐛 Bug fix**

  - **@visactor/vchart**: optimize discrete legend pager color in dark theme, related [#2654](https://github.com/VisActor/VChart/issues/2654)
  - **@visactor/vchart**: fix the issue issue with stacked waterfall charts where positive and negative values were not stacked separately when there were both positive and negative values in the same stack, fix [#2212](https://github.com/VisActor/VChart/issues/2212)





[more detail about v1.11.5](https://github.com/VisActor/VChart/releases/tag/v1.11.5)

# 1.11.4

## 🐛 fix
  - **@visactor/vchart**: fix bug of `updateSpec` when has `scales`, close #2744
  - **@visactor/vchart**: gauge chart might throw error when the value is close to its maximum, fix #2783
  - **@visactor/vchart**: fix the behavior of the gauge pointer when it exceeds the axis range, fix #2780
  - **@visactor/vchart**: normal animation not work when appear animation is disabled, fix #2807
  - **@visactor/vchart**: upgrade vrender to 0.19.10, vgrammar to 0.13.9

# 1.11.3
## 🆕 feat
@visactor/vchart: add option showBackgroundChart of DataZoom

## 🐛 fix
@visactor/vchart: bar chart should work normally when x-axis is linear, fix #2758
@visactor/vchart: fix issue of continuous legend filter in treemap
@visactor/vchart: fixed the issue that the newly added component type could not take effect when updateSpec
@visactor/vchart: fixed setSelected of sankey chart, fix #2757 , fix #2765


# 1.11.2
- 正式版发布
- @visactor/vchart: fix the bug that animationThreshold not work, close #2745
- @visactor/vchart: fix the issue of update animation in area chart is not work
- common: bar series support auto band size in common chart. fix#2704
- @visactor/vchart: corsshair should hide when pointer out view, fix #2726
- @visactor/vchart: close animation cause by datazoom/scrollbar
- @visactor/vchart: `type-step` markLine's label should consider the refX/refY/dx/dy set by user, fixed#2739
- react-vchart: fix the issue of <Axis /> that the props id not work
- @visactor/vchart: polarAxis.grid.smooth not work in theme configuratio
  🔧 chore
- @visactor/vchart: when build es5 , targets of @babel/preset-env should be defaults, fix #2702

# 1.11.0-alpha.3
- 更新README

# 1.11.0-alpha.2
- VChart组件支持InitOptions参数

# 1.11.0-alpha.1
- VChart支持HarmonyOS的StageTS架构

