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

**💖 Community Contributions**

Thanks to everyone who contributed to this release through code, issue reports, test cases, and regression verification. Special thanks to:

- @g1f9: contributed function support for discrete legend `maxRow` / `maxCol`, and fixed linear axis nice-domain recalculation based on the final plot area.

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

# v2.0.12

2025-12-25

**🆕 New Features**

- **@visactor/vchart**: Support `autoLabelMaxWidth` configuration in `CircleAxis` by @xuefei1313 in https://github.com/VisActor/VChart/pull/4357
- **@visactor/vchart**: Add support for chart disappear state by @xuefei1313 in https://github.com/VisActor/VChart/pull/4341
- **@visactor/vchart**: Optimize heatmap shape rendering logic by @xuefei1313 in https://github.com/VisActor/VChart/pull/4377
- **@visactor/vchart**: Optimize map zoom interaction and add `zoomRate` configuration by @xuefei1313 in https://github.com/VisActor/VChart/pull/4373

**🐛 Bug Fixes**

- **@visactor/vchart**: Fix axis title layout issue by @xuefei1313 in https://github.com/VisActor/VChart/pull/4371

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

- **@visactor/vchart**: Enhance boxplot features by @xile611 in https://github.com/VisActor/VChart/pull/4323

**🐛 Bug Fixes**

- **@visactor/vchart**: Upgrade vrender dependency to fix rose chart issues by @xuefei1313 in https://github.com/VisActor/VChart/pull/4315
- **@visactor/vchart**: Upgrade vrender dependency to fix animation issues by @xuefei1313 in https://github.com/VisActor/VChart/pull/4325
- **@visactor/vchart**: Fix extension mark update logic by @xile611 in https://github.com/VisActor/VChart/pull/4318
- **@visactor/vchart**: Fix font family setting issue by @xuefei1313 in https://github.com/VisActor/VChart/pull/4324
- **@visactor/vchart**: Fix issue with setDimensionIndex by @xuefei1313 in https://github.com/VisActor/VChart/pull/4291

**📖 Documentation**

- **@visactor/vchart**: Add candlestick chart guide by @xuefei1313 in https://github.com/VisActor/VChart/pull/4310
- **@visactor/vchart**: Add theme development guide by @xuanhun in https://github.com/VisActor/VChart/pull/4322
- **@visactor/vchart**: Add map rewind guide by @xuefei1313 in https://github.com/VisActor/VChart/pull/4326
- **@visactor/vchart**: Add 3D registration content to guide by @xuefei1313 in https://github.com/VisActor/VChart/pull/4312
- **@visactor/vchart**: Fix documentation for common chart option labelLayout by @xuefei1313 in https://github.com/VisActor/VChart/pull/4316

**Full Changelog**: https://github.com/VisActor/VChart/compare/v2.0.9...v2.0.10

[more detail about v2.0.10](https://github.com/VisActor/VChart/releases/tag/v2.0.10)

# v2.0.9

2025-11-18

**🆕 New Features**

- **@visactor/react-vchart**: Add export for registerChartResizeZoomPlugin by @xuefei1313 in https://github.com/VisActor/VChart/pull/4286
- **@visactor/vchart**: Support effect animation by @purpose233 in https://github.com/VisActor/VChart/pull/4299
- **@visactor/vchart**: Enhance datazoom and fix bugs by @skie1997 in https://github.com/VisActor/VChart/pull/4065

**🐛 Bug Fixes**

- **@visactor/vchart-extension**: Fix the vchart-extension packaged artifacts contained an extra version by @xuefei1313 in https://github.com/VisActor/VChart/pull/4277
- **@visactor/vchart**: Fix markline auto range by @xuefei1313 in https://github.com/VisActor/VChart/pull/4290

**📖 Documentation**

- **@visactor/vchart**: Fix registerMorph error in example by @xuefei1313 in https://github.com/VisActor/VChart/pull/4285
- **@visactor/vchart**: Add candlestick demo by @xuefei1313 in https://github.com/VisActor/VChart/pull/4297

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

- fix: fix the issue of legend pager by @xuefei1313 in https://github.com/VisActor/VChart/pull/4212
- Feat/support calc in formatter by @xuefei1313 in https://github.com/VisActor/VChart/pull/4211
- Fix/fix error of markline when series no data by @xuefei1313 in https://github.com/VisActor/VChart/pull/4216
- feat: update bugreport metthod by @xuanhun in https://github.com/VisActor/VChart/pull/4221
- feat: upgrade vrender to fix animation bug by @xuefei1313 in https://github.com/VisActor/VChart/pull/4222
- feat: support waterfallType in waterfall chart by @xuefei1313 in https://github.com/VisActor/VChart/pull/4220
- feat: change vrender dependencies by @xuefei1313 in https://github.com/VisActor/VChart/pull/4224

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
