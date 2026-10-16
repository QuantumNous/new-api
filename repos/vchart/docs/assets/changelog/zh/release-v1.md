# v1.13.11

2025-05-29

**🆕 新增功能**

- **@visactor/vchart**: 直方图新增 `barGap` 配置项
- **@visactor/vchart**: 主题支持 `tooltip.trigger` 和 `crosshair.trigger` 配置

**🐛 功能修复**

- **@visactor/vchart**: 修复当轴标签为类数字字符串时 data-zoom 的 domain 问题，修复 [#3982](https://github.com/VisActor/VChart/issues/3982)
- **@visactor/vchart**: 修复当维度 tooltip 无标题时，mark tooltip 标题顺序错误的问题，修复 [#3991](https://github.com/VisActor/VChart/issues/3991)
- **@visactor/vchart**: 配置项 `{ poptip: true }` 时应加载 `poptipForText`
- **react-vchart**: 使用 children 自定义渲染 tooltip 时，react-vchart 应能正确更新
- **@visactor/vchart**: tooltip 的自定义渲染应兼容 React 17 和 React 18

**🔖 其他**

- **@visactor/vchart**: 修复：将所有 `vchartConstrouctor` 替换为 `vchartConstructor`，并保证旧版本兼容性

[更多详情请查看 v1.13.11](https://github.com/VisActor/VChart/releases/tag/v1.13.11)

# v1.13.10

2025-05-16

**🆕 新增功能**

- **@visactor/vchart**: tooltip 定位支持内侧相关的定位点
- **@visactor/vchart**: 马赛克图表支持 bandWidthField 和 percent 配置，关闭 [#3945](https://github.com/VisActor/VChart/issues/3945)

**🐛 功能修复**

- **@visactor/vchart**: 导出 ManualTicker 和 StreamLight
- **@visactor/vchart**: tooltip 设置`enterable`后，离开 tooltip，tooltip 应隐藏，修复 [#3965](https://github.com/VisActor/VChart/issues/3965)，修复 [#3922](https://github.com/VisActor/VChart/issues/3922)
- **@visactor/vchart**: 修复页面中多个图表配置 tooltip 的 enterable 时，部分图表 tooltip 不能正确交互的错误，修复 [#3940](https://github.com/VisActor/VChart/issues/3940)
- **@visactor/vchart**: 升级 vgrammar 至 0.16.7，修复 [#3965](https://github.com/VisActor/VChart/issues/3965)

[更多详情请查看 v1.13.10](https://github.com/VisActor/VChart/releases/tag/v1.13.10)

# v1.13.9

2025-04-21

**🆕 新增功能**

- **@visactor/vchart**: 轴数据过滤支持上下文，关闭 [#3332](https://github.com/VisActor/VChart/issues/3332)
- **@visactor/vchart**: 仪表盘支持在标记超出轴范围时裁剪，关闭 [#3859](https://github.com/VisActor/VChart/issues/3859)
- **@visactor/vchart**: markLine 和 markArea 支持渲染多个标签

**🐛 功能修复**

- **@visactor/vchart**: 更新规格时清除普通动画的事件监听器，[#3881](https://github.com/VisActor/VChart/issues/3881)
- **@visactor/vchart**: 修复当 bandSize 为 0 时矩形十字线的坐标问题，修复 [#3907](https://github.com/VisActor/VChart/issues/3907)
- **@visactor/vchart**: 当设置十字线的默认选择时，`axisIndex` 应有默认值 0
- **@visactor/vchart**: 修复 datazoom 文本的类型错误
- **@visactor/vchart**: 当 `autoWidth` 为 true 时，标题标签的宽度应自动适应内容宽度，修复 [#3880](https://github.com/VisActor/VChart/issues/3880)
- **@visactor/vchart**: 修复 markLine 的有效性判断，修复 [#3857](https://github.com/VisActor/VChart/issues/3857)
- **@visactor/vchart**: 数据更新后空占位符应更新，修复 [#3855](https://github.com/VisActor/VChart/issues/3855)

**🔨 功能重构**

- **@visactor/vchart**: 重构 brush 交互，关闭 [#3765](https://github.com/VisActor/VChart/issues/3765)、[#3262](https://github.com/VisActor/VChart/issues/3262)、[#2802](https://github.com/VisActor/VChart/issues/2802) 和 [#3885](https://github.com/VisActor/VChart/issues/3885)

**📖 文档更新**

- **@visactor/vchart**: 提供文档接口，修复 [#3877](https://github.com/VisActor/VChart/issues/3877)

[更多详情请查看 v1.13.9](https://github.com/VisActor/VChart/releases/tag/v1.13.9)

# v1.13.8

2025-03-31

**🆕 新增功能**

- **@visactor/vchart**: 为总计标签添加 `alwayCalculateTotal` 配置项
- **@visactor/vchart**: 为 `lockStatisticsByDomain` 添加 `onlyFull` 配置项

**🐛 功能修复**

- **@visactor/vchart**: 修复当轴配置 `zero: false` 时，柱状图增长动画无法正常工作的问题，[#3808](https://github.com/VisActor/VChart/issues/3808)
- **@visactor/vchart**: 当标签无效时，十字线应隐藏
- **@visactor/vchart**: 当 datazoom 发生变化时，十字线应隐藏
- **@visactor/vchart**: 修复事件 `prevent` 导致的气泡层级问题，[#3728](https://github.com/VisActor/VChart/issues/3728)
- **@visactor/vchart**: 修复按需加载仪表盘图表时的错误，[#3836](https://github.com/VisActor/VChart/issues/3836)
- **@visactor/vchart**: `legends.title.visible` 应控制图例标题的可见性，修复 [#3846](https://github.com/VisActor/VChart/issues/3846)
- **@visactor/vchart**: 修复象形图中 SVG 路径未绘制的问题
- **react-vchart**: tooltip 的子元素不应设置到 spec 中
- **@visactor/vchart**: `data.fields` 可设置字段的 domain
- **@visactor/vchart**: 修复仅使用 pointer 事件的移动设备上 zoomable 的问题
- **@visactor/vchart**: 修复 datazoom 拖拽和缩放同时触发的问题，修复 [#3819](https://github.com/VisActor/VChart/issues/3819)

[更多详情请查看 v1.13.8](https://github.com/VisActor/VChart/releases/tag/v1.13.8)

# v1.13.7

2025-03-14

**🆕 新增功能**

- **@visactor/vchart**: 支持在 totalLabel 中配置 `position`，[#3396](https://github.com/VisActor/VChart/issues/3396)

**🐛 功能修复**

- **@visactor/vchart**: vchart 内部不合并原始的 options，修复 [#3798](https://github.com/VisActor/VChart/issues/3798)
- **@visactor/react-vchart**: 生命周期事件回调应被触发，修复 [#3792](https://github.com/VisActor/VChart/issues/3792)
- **@visactor/vchart**: react-vchart 应导出 `WaterfallChart`，修复 [#3791](https://github.com/VisActor/VChart/issues/3791)
- **@visactor/vchart**: 修复 richtext 的 fontFamily，修复 [#3768](https://github.com/VisActor/VChart/issues/3768)
- **@visactor/vchart**: 修复 wx 获取上下文的问题

**🔧 项目配置**

- **@visactor/vchart**: add util to export

[更多详情请查看 v1.13.7](https://github.com/VisActor/VChart/releases/tag/v1.13.7)

# v1.13.6

2025-03-03

**🆕 新增功能**

- **@visactor/vchart**：优化瀑布图引导线的显示效果
- **@visactor/vchart**：为漏斗图提示框中的转化率文本内容添加 `transformRatioText` 配置，[#3704](https://github.com/VisActor/VChart/issues/3704)
- **@visactor/vchart**：支持线性比例尺中的 `clamp` 配置，[#3738](https://github.com/VisActor/VChart/issues/3738)

**🐛 功能修复**

- **@visactor/vchart**：当 `seriesField` 缺失时正常显示折线图标签，[#3709](https://github.com/VisActor/VChart/issues/3709)
- **@visactor/vchart**：自定义 Mark（customMark）应在 `getVRenderComponents()` 方法中返回组件，修复 [#3727](https://github.com/VisActor/VChart/issues/3727)
- **@visactor/vchart**：修复地图缩放错误问题，修复 [#3743](https://github.com/VisActor/VChart/issues/3743)
- **@visactor/vchart**：修复桑基图设置了`setNodeLayer`时，内部最大层级没有更新的问题
- **@visactor/vchart**：修复桑基图节点个数为 1，边的个数为 0 时，节点也不展示的问题，修复 [#3749](https://github.com/VisActor/VChart/issues/3749)

[更多详情请查看 v1.13.6](https://github.com/VisActor/VChart/releases/tag/v1.13.6)

# v1.13.5

2025-02-14

**🆕 新增功能**

- **@visactor/vchart**: 在 `brushend` 事件中添加 `startvalue` 和 `endvalue` 参数
- **@visactor/vchart**: `label` 支持触发 `mark`类型的`tooltip`，[#3634](https://github.com/VisActor/VChart/issues/3634)
- **@visactor/vchart**: 导出 `getCartesianDimensionInfo` 和 `getPolarDimensionInfo`，修复 [#3668](https://github.com/VisActor/VChart/issues/3668)
- **@visactor/vchart**: 支持瀑布图的 `stackInverse`

**🐛 功能修复**

- **@visactor/vchart**: 修复漏斗图转换标记的更新动画错误，[#3685](https://github.com/VisActor/VChart/issues/3685)
- **@visactor/vchart**: 修复堆叠区域上标记重叠下标记边框的问题，[#3684](https://github.com/VisActor/VChart/issues/3684)
- **@visactor/vchart**: 修复隐藏 `crosshair` 时状态缓存问题，修复 [#3686](https://github.com/VisActor/VChart/issues/3686)
- **@visactor/vchart**: 允许在 `datazoom` 组件中分发 `roam`和 `zoom`，修复 [#3714](https://github.com/VisActor/VChart/issues/3714)
- **@visactor/vchart**: 修复 `datazoom` 和 `scrollbar` 实时更新不生效的问题，修复 [#3716](https://github.com/VisActor/VChart/issues/3716)
- **@visactor/vchart**: 修复 `tickAlign` 精度问题
- **@visactor/vchart**: 切换 `visible` 时应显示 indicator，修复 [#3675](https://github.com/VisActor/VChart/issues/3675)
- **@visactor/vchart**: 圆形进度条应支持全局形变动画
- **@visactor/vchart**: `tooltip` 在进入浮层后时不应处理`mousemove` 或 `mouseout`事件，解决`enterable`很难触发的问题，修复 [#3708](https://github.com/VisActor/VChart/issues/3708)
- **@visactor/vchart**: 当 `maxWidth` 有效且 `multiLine` 不为 `false` 时，`tooltip` 应自动换行，修复 [#3718](https://github.com/VisActor/VChart/issues/3718)
- **@visactor/vchart**: 修复 `text` 图元的类型定义

**🔨 功能重构**

- **@visactor/vchart**: 优化象形图的性能

**📖 文档更新**

- **@visactor/vchart**: 更新 `poptip` 的配置文档，关闭 [#3139](https://github.com/VisActor/VChart/issues/3139)

[更多详情请查看 v1.13.5](https://github.com/VisActor/VChart/releases/tag/v1.13.5)

# v1.13.4

2025-01-17

**🆕 新增功能**

- **@visactor/vchart**: 词云图系列`wordCloudConfig`增加`insertZerosToArray`配置，解决特定浏览器性能问题
- **@visactor/vchart**: `markArea`标记区域标签支持更多的位置，包括: `'insideBottom'`, `'topLeft'`, `'topRight'`, `'bottomLeft'`,`'bottomRight'`,`'insideTopLeft'`,`'insideTopRight'`,`'insideBottomLeft'`,`'insideBottomRight'`

**🐛 功能修复**

- **@visactor/vchart**: 修复 tooltip 关于 `showDelay` 的错误，修复 [#3663](https://github.com/VisActor/VChart/issues/3663)
- **@visactor/vchart**: 修复 tooltip 的偏移问题，修复 [#3666](https://github.com/VisActor/VChart/issues/3666)
- **@visactor/vchart**: 修复 tooltip 行高解析的错误，修复 [#3643](https://github.com/VisActor/VChart/issues/3643)
- **@visactor/vchart**: 修复轴断点范围计算错误的问题，修复 [#3656](https://github.com/VisActor/VChart/issues/3656)
- **@visactor/vchart**: 修复地图拖拽交互无法在画布外终止的问题，修复 [#3650](https://github.com/VisActor/VChart/issues/3650)
- **@visactor/vchart**: 修复当线条、面积中有非法点，`invalidType` 为`link`的时候，线形展示不对的问题，修复[#3146](https://github.com/VisActor/VChart/issues/3146)

[更多详情请查看 v1.13.4](https://github.com/VisActor/VChart/releases/tag/v1.13.4)

# v1.13.3

2025-01-08

**🆕 新增功能**

- **@visactor/vchart**: 在 axis-label 事件中添加 datum 到参数
- **@visactor/vchart**: 将 vgrammar 提供的狗子，包装一层 vchart 实例上下文

**🐛 功能修复**

- **@visactor/vchart**: 修复 3D 图表中标签显示不正确的问题，[#3584](https://github.com/VisActor/VChart/issues/3584)
- **@visactor/vchart**: 修复 3D 词云动画不工作的问题
- **@visactor/vchart**: 修复 mark 悬停时 brush 数据未定义的问题，修复 [#3623](https://github.com/VisActor/VChart/issues/3623)
- **@visactor/vchart**: 修复 tooltip 有自定义子元素时的 DOM 样式问题，修复 [#3615](https://github.com/VisActor/VChart/issues/3615)
- **@visactor/vchart**: 修复更新主题时 DOM tooltip 更新错误的问题，修复 [#3619](https://github.com/VisActor/VChart/issues/3619)
- **@visactor/vchart**: 修复 confine 为 false 时 html tooltip 位置错误的问题，修复 [#3632](https://github.com/VisActor/VChart/issues/3632)
- **@visactor/vchart**: 修复数据集教程中的排版错误
- **@visactor/vchart**: 修复 vchart 实例没有将 dpr 传递给 stage 的问题
- **@visactor/vchart**: 修复不可见区域阻挡 mark 事件的问题，[#3638](https://github.com/VisActor/VChart/issues/3638)
- **@visactor/vchart**: 修复维度悬停时不应显示未定义的点，修复 [#3610](https://github.com/VisActor/VChart/issues/3610)
- **@visactor/vchart**: 修复标题组件的布局错误，修复 [#3614](https://github.com/VisActor/VChart/issues/3614)

[更多详情请查看 v1.13.3](https://github.com/VisActor/VChart/releases/tag/v1.13.3)

# v1.13.2

2024-12-24

**🆕 新增功能**

- **@visactor/vchart**: 在 react vchart 中添加缺失的 Series 和 Chart，关闭 [#3578](https://github.com/VisActor/VChart/issues/3578)
- **@visactor/vchart**: vchart 支持 clickInterval 参数

**🐛 功能修复**

- **@visactor/vchart**: 支持在仪表盘图元中配置百分比状态半径，关闭 [#3459](https://github.com/VisActor/VChart/issues/3459)
- **@visactor/vchart**: 当轴为空时，媒体查询不应抛出错误，相关 [#3575](https://github.com/VisActor/VChart/issues/3575)
- **@visactor/vchart**: 当 tooltip 的 `hasShape` 为 `false` 时，不应渲染空列，相关 [#3572](https://github.com/VisActor/VChart/issues/3572)
- **@visactor/vchart**: tooltip 的 `othersLine` 可以通过 `visible: false` 隐藏，相关 [#3572](https://github.com/VisActor/VChart/issues/3572)
- **@visactor/vchart**: 修复 tooltip 的位置，相关 [#3590](https://github.com/VisActor/VChart/issues/3590)
- **@visactor/vchart**: 当 `tickStep` 太小时，页面不应崩溃，修复 [#3591](https://github.com/VisActor/VChart/issues/3591)
- **@visactor/vchart**: 修复在有交互层时自定义 DOM 的更新问题，修复 [#3587](https://github.com/VisActor/VChart/issues/3587)
- **@visactor/vchart**: 修复设置 `tickStep` 时的轴截断刻度问题，修复 [#3560](https://github.com/VisActor/VChart/issues/3560)

[更多详情请查看 v1.13.2](https://github.com/VisActor/VChart/releases/tag/v1.13.2)

# v1.13.1

2024-12-17

**🆕 新增功能**

- **@visactor/vchart**: 添加配置 `customFilter` 到图例，支持自定义过滤函数，关闭 [#3492](https://github.com/VisActor/VChart/issues/3492)
- **@visactor/vchart**: 面积图支持标签设置在中间`'inside-middle'`，关闭 [#3353](https://github.com/VisActor/VChart/issues/3353)

**🐛 功能修复**

- **@visactor/vchart**: 修复瀑布图的设置了轴截断后的展示问题，修复 [#3544](https://github.com/VisActor/VChart/issues/3544)
- **@visactor/vchart**: 修复 `updateModelSpecSync` 无法更新 `axis.tick.forceTickCount` 的问题
- **@visactor/vchart**: 修复当字段配置了`lockStatisticsByDomain`后，Datazoom 设置`filterMode` 为 `filter`时，过滤效果不符合预期的问题，相关 [#3469](https://github.com/VisActor/VChart/issues/3469)
- **@visactor/vchart**: 修复更新时 Y 轴方向 datazoom 的高度问题，修复 [#3521](https://github.com/VisActor/VChart/issues/3521)
- **@visactor/vchart**: html tooltip 可以重用 DOM 内容并修复不必要的动画
- **@visactor/vchart**: 修复当标记有 `name` 时 extensionMark 的更新问题，修复 [#3547](https://github.com/VisActor/VChart/issues/3547)
- **@visactor/vchart**: 修复当 `visible` 变为 false 时的 Indicator 组件不能正常隐藏的问题，修复 [#3506](https://github.com/VisActor/VChart/issues/3506)
- **@visactor/vchart**: 修复仅有 `valueFormatter` 或 `keyFormatter` 时的 Tooltip 内容问题
- **@visactor/vchart**: 修复 html 类型的 tooltip 的样式
- **@visactor/vchart-extension**: series-break 应保持与轴断点对齐，相关 [#3560](https://github.com/VisActor/VChart/issues/3560)
- **@visactor/vchart**: 断点应考虑轴的 `min` 和 `max`，相关 [#3560](https://github.com/VisActor/VChart/issues/3560)

[更多详情请查看 v1.13.1](https://github.com/VisActor/VChart/releases/tag/v1.13.1)

# v1.13.0

2024-12-06

**🆕 新增功能**

- **@visactor/vchart**: 添加象形图表
- **@visactor/vchart**: 支持在桑基图中自动生成滚动条，关闭 [#2838](https://github.com/VisActor/VChart/issues/2838)
- **@visactor/vchart**: react vchart 支持事件过滤器，关闭 [#3461](https://github.com/VisActor/VChart/issues/3461)
- **@visactor/vchart**: tooltip 支持按字段配置，关闭 [#2576](https://github.com/VisActor/VChart/issues/2576)
- **@visactor/vchart**: 支持 tooltip 通过百分比值设置内容的最大高度 ，关闭 [#2675](https://github.com/VisActor/VChart/issues/2675)

**🐛 功能重构**

- **@visactor/vchart**: [重大变更] 重构 HTML 提示框的实现，修复 [#3137](https://github.com/VisActor/VChart/issues/3137)，关闭 [#2924](https://github.com/VisActor/VChart/issues/2924)，关闭 [#2591](https://github.com/VisActor/VChart/issues/2591)
- **@visactor/vchart**: [重大变更] 饼图内部标签默认支持防重叠处理

**⚡ 性能优化**

- **@visactor/vchart**: [重大变更] vrender 优化了文本的 Bounds 计算，让文本在各种字体下展示效果对齐 dom

[更多详情请查看 v1.13.0](https://github.com/VisActor/VChart/releases/tag/v1.13.0)

# v1.12.15

2024-12-05

**🆕 新增功能**

- **@visactor/vchart**: support `restorePosition` in position/bound label overlap strategy

**🐛 功能修复**

- **@visactor/vchart**: optimize `shiftY` of label

[更多详情请查看 v1.12.15](https://github.com/VisActor/VChart/releases/tag/v1.12.15)

# v1.12.14

2024-12-05

**🆕 新增功能**

- **@visactor/vchart**: 图表配置支持 `autoRefreshDpr`，自动根据设备像素比调整图表的 dpr。
- **@visactor/vchart**: 当设置了 `lockStatisticsByDomain`的时候，dataZoom 的`filter` 模式可以正常更新图表范围, close [#3469](https://github.com/VisActor/VChart/issues/3469)
- **@visactor/vchart**: 添加标记上下文以支持与系列相同的颜色，关闭 [#3437](https://github.com/VisActor/VChart/issues/3437)
- **@visactor/vchart**: 更新桑基图中的选项 `maxNodeHeight` 和 `maxLinkHeight`，关闭 3439
- **@visactor/vchart-extension**: 添加组件 `series-break`，关闭 [#3450](https://github.com/VisActor/VChart/issues/3450)

**🐛 功能修复**

- **@visactor/vchart**: 升级布局后滚动条可见性，修复 [#3452](https://github.com/VisActor/VChart/issues/3452)
- **@visactor/vchart**: 修复桑基图中的 `adjacency`，修复 [#3460](https://github.com/VisActor/VChart/issues/3460)
- **@visactor/vchart**: 当滚动条域与之前相同时，不更新布局，修复 [#3452](https://github.com/VisActor/VChart/issues/3452)
- **@visactor/vchart**: 比例尺范围内的值应考虑整个范围，修复 [#3446](https://github.com/VisActor/VChart/issues/3446)
- **@visactor/vchart**: 当线的 `invalidType` 为 `"link"` 时，线应正确连接，修复 [#3436](https://github.com/VisActor/VChart/issues/3436)，修复 [#3238](https://github.com/VisActor/VChart/issues/3238)
- **@visactor/vchart**: 设置状态时富文本应正常工作，修复 [#3465](https://github.com/VisActor/VChart/issues/3465)

[更多详情请查看 v1.12.14](https://github.com/VisActor/VChart/releases/tag/v1.12.14)

# v1.12.13

2024-11-22

**🐛 功能修复**

- **@visactor/vchart**: 修复箱线图系列的 `groupKey`，修复 [#3409](https://github.com/VisActor/VChart/issues/3409)，相关 [#2855](https://github.com/VisActor/VChart/issues/2855)
- **@visactor/vchart**: 修复富文本时外标签线长度不正确的问题，修复 [#3441](https://github.com/VisActor/VChart/issues/3441)

[更多详情请查看 v1.12.13](https://github.com/VisActor/VChart/releases/tag/v1.12.13)

# v1.12.12

2024-11-18

**🐛 功能修复**

- **@visactor/vchart**: 修复通过 `updateSpec` 修改 `area.visible` 不生效的问题，相关 [#3393](https://github.com/VisActor/VChart/issues/3393)
- **@visactor/vchart**: 修复在面积图中通过 `updateSpec` 更改 `direction` 时渲染不正确的问题，相关 [#3406](https://github.com/VisActor/VChart/issues/3406)
- **@visactor/vchart**: 修复背景图 `zIndex` 问题，修复 [#3403](https://github.com/VisActor/VChart/issues/3403)
- **@visactor/vchart**: 修复图表释放时 `tooltip` 错误，修复 [#3428](https://github.com/VisActor/VChart/issues/3428)

**⚡ 性能优化**

- **@visactor/vchart**: 优化轴截断效果

[更多详情请查看 v1.12.12](https://github.com/VisActor/VChart/releases/tag/v1.12.12)

# v1.12.11

2024-11-13

**🆕 新增功能**

- **@visactor/vchart**: 当轴截断的时候，支持零值对齐功能
- **@visactor/vchart**: tooltip 支持自定义 `trigger` 和 `triggerOff`配置触发和关闭事件

**🐛 功能修复**

- **@visactor/vchart**: 修复在某些情况下轴断点渲染不正确的问题
- **@visactor/vchart**: 修复系列的 `zIndex`不生效的问题，修复 [#3395](https://github.com/VisActor/VChart/issues/3395)
- **@visactor/vchart**: 修复 orient 为 "left" 或 "right" 时标题的布局问题，修复 [#3401](https://github.com/VisActor/VChart/issues/3401)
- **@visactor/vchart**: 修复 tooltip 形状中的自定义 svg 字符串问题，相关 [#3384](https://github.com/VisActor/VChart/issues/3384)
- **@visactor/vchart**: tooltip `enterable` 在更新时应生效，修复 [#3405](https://github.com/VisActor/VChart/issues/3405)
- **@visactor/vchart**: 修复 `mode: pointer` 的 tooltip 位置问题，关闭 [#3367](https://github.com/VisActor/VChart/issues/3367)
- **@visactor/vchart**: 当 `word.visible` 为 `false` 时，wordcloud 不应抛出错误，修复 [#3378](https://github.com/VisActor/VChart/issues/3378)
- **@visactor/vchart**: 修复在某些条件下滚动图例触发地图缩放的问题，相关 [#3391](https://github.com/VisActor/VChart/issues/3391)

[更多详情请查看 v1.12.11](https://github.com/VisActor/VChart/releases/tag/v1.12.11)

# v1.12.10

2024-10-31

**🆕 新增功能**

- **@visactor/vchart**: 饼图支持通过百分比设置中心点

**🐛 功能修复**

- **@visactor/vchart**: 当轴不显示时，滚动不会触发视图更新。修复 [#3278](https://github.com/VisActor/VChart/issues/3278)
- **@visactor/vchart**: 修复 updateSpec 更改 `roam` 不生效
- **@visactor/vchart**: 修复 symbolActiveMark 设置 visible 导致报错的问题
- **@visactor/vchart**: 修复 harmony 中图表背景的问题
- **@visactor/vchart**: 修复雷达图中角度轴的事件问题，修复 [#3343](https://github.com/VisActor/VChart/issues/3343)
- **@visactor/vchart**: 修复标题主题的类型问题
- **@visactor/vchart**: 修复图例滚动条边界场景展示错误的问题

**🔨 功能重构**

- **@visactor/vchart**: 优化 mark 图元配置相关 api
- **@visactor/vchart**: 优化直角坐标系中轴标签旋转的时候，自动隐藏标签在头尾标签省略过多的问题
- **@visactor/vchart**: 优化直角坐标系中轴标签自动换行效果

[更多详情请查看 v1.12.10](https://github.com/VisActor/VChart/releases/tag/v1.12.10)

# v1.12.9

2024-10-25

**🆕 新增功能**

- **@visactor/vchart**: mark tooltip 支持当图元重叠的时候，检测所有重叠图元，一起展示到 tooltip 中 [#3224](https://github.com/VisActor/VChart/issues/3224)

**🐛 功能修复**

- **@visactor/vchart**: 修复了 updateSpec 后地图标签不能相应缩放的问题
- **@visactor/vchart**: 所有 SeriesData 都应该调用`compileData()`，修复 [#3322](https://github.com/VisActor/VChart/issues/3322)
- **@visactor/vchart**: 退出时清除节流定时器，修复 [#3326](https://github.com/VisActor/VChart/issues/3326)
- **@visactor/vchart**: 修复处`tooltip.handler`为空时的`tooltipHide`事件
- **@visactor/vchart**: tooltip 数据在每行中应该有`datum`
- **@visactor/vchart**: 修复标签组件在特定情况下有错位的问题
- **@visactor/vchart**: 修复 dpr 不为整数时，图表 resize 的时候导致图表部分空白的问题，修复 [#3255](https://github.com/VisActor/VChart/issues/3355)

[更多详情请查看 v1.12.9](https://github.com/VisActor/VChart/releases/tag/v1.12.9)

# v1.12.8

2024-10-15

**🆕 新增功能**

- **@visactor/vchart**: 支持坐标轴标签的 `firstVisible` 属性，关闭 [#3200](https://github.com/VisActor/VChart/issues/3200)
- **@visactor/vchart**: 支持地图图表中通过 `roam.blank` 启用从区域空白处拖拽
- **@visactor/vchart**: 优化饼图中，空白占位圆中数据为空的判断条件
- **@visactor/vchart**: label 组件文字样式支持`wordBreak: "keep-all"`

**🐛 功能修复**

- **@visactor/vchart**: 当坐标轴的 visible 发生变化时，图表应该进行 `remake`，修复 [#3287](https://github.com/VisActor/VChart/issues/3287)
- **@visactor/vchart**: 修复 label 组件 visible 发生变化时的问题，修复 [#3277](https://github.com/VisActor/VChart/issues/3277)
- **@visactor/vchart**: 在初始 options 中，按图表类型自定义主题无法生效，[#3285](https://github.com/VisActor/VChart/issues/3285)
- **@visactor/vchart**: 修复 label 组件中 `html` 和 `dom` 不能正确工作的问题
- **@visactor/vchart**: 零点处的坐标轴线应考虑绑定坐标轴的反转，修复 [#3306](https://github.com/VisActor/VChart/issues/3306)
- **@visactor/react-vchart**: 在 circlePacking、sankey、sunburst、treemap、venn 中默认注册标签，修复 [#3148](https://github.com/VisActor/VChart/issues/3148)
- **@visactor/vchart**: 修复离散图例中，`item.label.space` 和 `pager.space` 不生效的问题

**🔨 功能重构**

- **@visactor/vchart**: 重构 tooltip 组件中 `enterable` 的实现

[更多详情请查看 v1.12.8](https://github.com/VisActor/VChart/releases/tag/v1.12.8)

# v1.12.7

2024-09-29

**🆕 新增功能**

- **@visactor/vchart**: feat: 支持漏斗图外标签线的 `minLength`
- **react-vchart**: 支持 react-vchart 的 `morphConfig`，关闭 [#3219](https://github.com/VisActor/VChart/issues/3219)

**🐛 功能修复**

- **@visactor/vchart**: 修复数据变化时 `updateSpec` 的错误，修复 [#3261](https://github.com/VisActor/VChart/issues/3261)
- **@visactor/vchart**: 修复暗模式下线性进度条轨道的颜色
- **@visactor/vchart**: 修复 datazoom 状态字段和值字段不完整的问题，修复 [#3199](https://github.com/VisActor/VChart/issues/3199)
- **@visactor/vchart**: 修复轴标题在边界为空时的问题，修复 [#3265](https://github.com/VisActor/VChart/issues/3265)
- **@visactor/vchart**: 修复 `updateSpec` 时的媒体查询问题
- **@visactor/vchart**: 修复在 `spec` 中添加 `width` 和 `height` 属性时的 `updateSpec` 问题

[更多详情请查看 v1.12.7](https://github.com/VisActor/VChart/releases/tag/v1.12.7)

# v1.12.6

2024-09-23

**🆕 新增功能**

- **@visactor/vchart**: 添加生命周期钩子，`afterCreateVChart`, `beforeInitializeChart`, `afterInitializeChart`
- **@visactor/vchart**: 极坐标系角度轴，支持`autoLimit`、`autoWrap`、`autoHide` 等配置

**🐛 功能修复**

- **@visactor/vchart**: 允许极坐标图中的增加`indicator`组件
- **@visactor/vchart**: 修复`label`组件中`position`默认值的问题，修复[#3242](https://github.com/VisActor/VChart/issues/3242)
- **@visactor/vchart**: 修复类型错误，`PointerMarkSpec`中`type`修改为可选类型，修复 [#3227](https://github.com/VisActor/VChart/issues/3227)
- **@visactor/vchart**: 在触发`resize`时使用 `throttle`节流
- **@visactor/vchart**: 修复`label`配置更新的时候，图表更新类型应该为`reCompile`而不是`remake`
- **@visactor/vchart**: 修复`customMark`不支持`markName` 事件过滤器的问题
- **@visactor/vchart**: 修复雷达图更新动画触发错误的问题，修复[#3228](https://github.com/VisActor/VChart/issues/3228)

[更多详情请查看 v1.12.6](https://github.com/VisActor/VChart/releases/tag/v1.12.6)

# v1.12.5

2024-09-23

**🆕 新增功能**

- **@visactor/vchart**: `customMark`和`extensionMark`支持 `markName` 事件过滤器

**🐛 功能修复**

- **@visactor/vchart**: 优化笛卡尔图表的第一个坐标轴标签自动限制效果
- **@visactor/vchart**: `animationUpdate` 也应控制标签动画
- **@visactor/vchart**: 修复环形进度条的默认值，修复 [#2683](https://github.com/VisActor/VChart/issues/2683)
- **@visactor/vchart**: 修复雷达图在存在负半径时的显示问题
- **@visactor/vchart**: `word.style.fontWeight` 应该改变词云中文本的样式，修复 [#3212](https://github.com/VisActor/VChart/issues/3212)

**🔨 重构**

- **@visactor/vchart**: 简化 `getSpecInfo`

[more detail about v1.12.5](https://github.com/VisActor/VChart/releases/tag/v1.12.5)

# v1.12.4

2024-09-09

**🆕 新增功能**

- **@visactor/vchart**: 支持坐标轴断开
- **@visactor/vchart**: stackCornerRadius 支持回调函数。特性[#3164](https://github.com/VisActor/VChart/issues/3164)
- **@visactor/vchart**: 为桑基图添加 `crossNodeAlign` 配置

**🐛 功能修复**

- **@visactor/vchart**: 当系列没有显式的和轴进行绑定的时候，将系列绑定到将第一个相关坐标轴，而不是最后一个，修复[#3139](https://github.com/VisActor/VChart/issues/3139)
- **@visactor/vchart**: 切换主题时 Crosshair 不会更新
- **@visactor/vchart**: 修复词云图文本重叠的问题。修复[#3177](https://github.com/VisActor/VChart/issues/3177)
- **@visactor/vchart**: 修复饼图中 label 的 zIndex 不可配置的问题

**🔧 项目配置**

- **@visactor/vchart**: 新增 api `clearclearAllStates`。修复[#3162](https://github.com/VisActor/VChart/issues/3162)

[更多详情请查看 v1.12.4](https://github.com/VisActor/VChart/releases/tag/v1.12.4)

# v1.12.3

2024-09-05

**🐛 功能修复**

- **@visactor/vchart**: 修复无法通过 `option.animation:false` 禁用标签更新动画

[更多详情请查看 v1.12.3](https://github.com/VisActor/VChart/releases/tag/v1.12.3)

# v1.12.2

2024-09-05

**🆕 新增功能**

- **brush**: 添加配置以控制 Brush 组件在空数据时的缩放行为。关闭 [#2934](https://github.com/VisActor/VChart/issues/2934)
- **@visactor/vchart**: 在饼图中支持 'inside-center' 标签位置

**🐛 功能修复**

- **@visactor/vchart**: 滚动条的 rangeMode 不生效。修复 [#3147](https://github.com/VisActor/VChart/issues/3147)
- **@visactor/vchart**: 修复当 `barWidth`、`barMinWidth`、`barMaxWidth` 的值为 null 时的错误
- **@visactor/vchart**: x 轴的 brush 过滤器不生效。修复 [#3111](https://github.com/VisActor/VChart/issues/3111)
- **@visactor/vchart**: 修复 Indicator 阻止了 tooltip 的交互。修复 [#3123](https://github.com/VisActor/VChart/issues/3123)
- **@visactor/vchart**: 修复雷达图中当 layoutRadius 是自定义函数时 `getCenter` 的错误
- **@visactor/vchart**: 媒体查询导致渲染结果不正确，[#3102](https://github.com/VisActor/VChart/issues/3102)
- **@visactor/vchart**: 修复 normal 动画不生效的问题
- **@visactor/vchart**: 修复桑基图 scale 更新不生效
- **@visactor/vchart**: 修复桑基图中某些自定义 mark 名称为 "node" 时导致事件错误
- **@visactor/vchart**: 修复当有 innerOffset 时 tooltip 的维度值，修复 [#2923](https://github.com/VisActor/VChart/issues/2923)
- **@visactor/vchart**: 当系列数据的值为空时，vchart 不应抛出错误，修复 [#3082](https://github.com/VisActor/VChart/issues/3082)
- **@visactor/vchart**: 修复数组变化时 `updateSpec` 的错误
- **@visactor/vchart**: 词云图在 updateSpec 后填充不更新。修复 [#3122](https://github.com/VisActor/VChart/issues/3122)
- **@visactor/vchart**: 词云图比例尺更新不生效。修复 [#3129](https://github.com/VisActor/VChart/issues/3129)

**🔨 功能重构**

- **@visactor/vchart**: 重构 tooltip 模式的解析器

**📖 文档更新**

- **@visactor/vchart**: 修复树图标签在选项页面中不显示的问题，修复 [#2562](https://github.com/VisActor/VChart/issues/2562)
- **@visactor/vchart**: 更新关于环形进度图的文档，关闭 [#2987](https://github.com/VisActor/VChart/issues/2987)

[更多详情请查看 v1.12.2](https://github.com/VisActor/VChart/releases/tag/v1.12.2)

# v1.12.1

2024-08-21

**🐛 功能修复**

- **@visactor/vchart**: 修复 x 方向框选不生效的问题，修复 [#3111](https://github.com/VisActor/VChart/issues/3111)
- **@visactor/vchart**: 修复当`layoutRadius`为自定义函数时，`getCenter`报错的问题
- **@visactor/vchart**: 修复媒体查询器导致渲染效果不正确的问题， [#3102](https://github.com/VisActor/VChart/issues/3102)
- **@visactor/vchart**: 修复系列数据为空时的报错问题，修复 [#3082](https://github.com/VisActor/VChart/issues/3082)

[更多详情请查看 v1.12.1](https://github.com/VisActor/VChart/releases/tag/v1.12.1)

# v1.12.0

2024-08-16

**🆕 新增功能**

- **@visactor/vchart**: marker 的 `coordinates` 和 `positions` 属性支持回调函数
- **@visactor/vchart**: 支持 `animationState` 配置，用于配置状态动画
- **@visactor/vchart**: 饼图支持使用属性 `showAllZero` ，在数据全为 0 时，显示均分的饼图
- **@visactor/vchart**: 饼图支持 `supportNegative` 选项，将负值视为绝对值处理
- **@visactor/vchart**: 主题支持按图表类型配置
- **@visactor/vchart**: 词云图支持文字作为轮廓
- **@visactor/vchart**: 新增马赛克图表 MosaicChart
- **@visactor/vchart**: 支持线性轴的自定义刻度函数
- **@visactor/vchart**: 为饼图添加 ·emptyPlaceholder`和`emptyCircle`配置，设置数据为空的展位展示

## 🐛 修复

- **@visactor/vchart**: 修复 brush 缩放后，导致 y 轴倒置的问题。修复 [#3089](https://github.com/VisActor/VChart/issues/3089)
- **@visactor/vchart**: 修复 MarkPoint 位置类型错误

## 🔨 重构

- **@visactor/vchart**: 重构线性进度图中的图形
- **@visactor/vchart**: 使用 Label 组件重构桑基图标签
- **@visactor/vchart**: 按需加载堆叠功能

## 🔖 其他

- **@visactor/vchart**: sequence 图支持底部轴。修复 [#2927](https://github.com/VisActor/VChart/issues/2927)

[更多详情请查看 v1.12.0](https://github.com/VisActor/VChart/releases/tag/v1.12.0)

# v1.11.12

2024-08-15

**🆕 新增功能**

- **@visactor/vchart**: 支持饼图的 `layoutRadius`

**🐛 功能修复**

- **@visactor/vchart**: 修复 linear-axis-mixin 中 tickCount 参数不一致的问题，修复 [#3053](https://github.com/VisActor/VChart/issues/3053)
- **@visactor/vchart**: 修复 region `padding` 不生效的问题
- **@visactor/vchart**: 修复图例过滤后 Brush 组件报错的问题，修复 [#3061](https://github.com/VisActor/VChart/issues/3061)
- **@visactor/vchart**: 修复不同类别和系列字段带来的漏斗图颜色问题
- **@visactor/vchart**: 修复 harmony 事件的问题
- **@visactor/vchart**: 修复 react vchart 的类型错误，修复 [#3065](https://github.com/VisActor/VChart/issues/3065)
- **@visactor/vchart**: 当图表有多个区域时，tooltip 应该显示
- **@visactor/vchart**: 修复图表背景未更新的问题，修复 [#3054](https://github.com/VisActor/VChart/issues/3054)
- **@visactor/vchart**: 修复饼图中 `startAngle` 和 `endAngle` 更新的问题，修复 [#3059](https://github.com/VisActor/VChart/issues/3059)
- **@visactor/vchart**: 修复图例 `visible` 切换的问题，修复 [#3060](https://github.com/VisActor/VChart/issues/3060)

[更多详情请查看 v1.11.12](https://github.com/VisActor/VChart/releases/tag/v1.11.12)

# v1.11.11

2024-08-06

**🆕 新增功能**

- **@visactor/vchart**: 标签引导线支持自定义形状，关闭[#3000](https://github.com/VisActor/VChart/issues/3000)
- **@visactor/vchart**: 新增曲线插值算法`catmullRom` 和 `catmullRomClosed`，相关 issue[#2610](https://github.com/VisActor/VChart/issues/2610)

**🐛 功能修复**

- **@visactor/vchart**: 修复直方图 crosshair 不展示的问题, 关闭 [#2826](https://github.com/VisActor/VChart/issues/2826)
- **@visactor/vchart**: 使用 `vglobal.getElementById` 替代 `document.getElementById`，修复小程序报错问题
- **@visactor/vchart**: 修复水波图反转后不支持渐变色的问题
- **@visactor/vchart**: 优化水波图渐变色效果
- **@visactor/vchart**: 修复 tooltip `lockAfterClick` 配置不生效的问题，相关 issue [#1574](https://github.com/VisActor/VChart/issues/1574)
- **@visactor/vchart**: 在`panEnd` 事件完成前，阻止默认事件，相关 issue [#2931](https://github.com/VisActor/VChart/issues/2931)
- **@visactor/vchart**: 当申明了 `stackValue` ，但是配置`stack` 为`false`的时候，图表不应该堆积, 修复[#3005](https://github.com/VisActor/VChart/issues/3005)
- **@visactor/vchart**: 修复`updateData` 在存在 datazoom 组件时，更新错误的问题, 相关 issue [#3041](https://github.com/VisActor/VChart/issues/3041)
- **@visactor/vchart**: 修复坐标轴网格线显示/隐藏切换时，图表不更新的问题，修复[#3004](https://github.com/VisActor/VChart/issues/3004)
- **@visactor/vchart**: 修复更新主题中`fontFamily` 时，更新不生效的问题，修复 [#3028](https://github.com/VisActor/VChart/issues/3028)

- **@visactor/vchart**: 修复`seriesStyle`配置`monotone` 不生效的问题

[更多详情请查看 v1.11.11](https://github.com/VisActor/VChart/releases/tag/v1.11.11)

# v1.11.10

2024-07-24

**🆕 新增功能**

- **@visactor/vchart**: 水波图支持反转和通过自定义 mark 实现目标线的能力。关闭 [#2977](https://github.com/VisActor/VChart/issues/2977) 和关闭 [#2978](https://github.com/VisActor/VChart/issues/2978)
- **@visactor/vchart**: 在地理缩放事件中添加 `totalScale` 参数
- **@visactor/vchart**: 支持 `geoZoomByIndex`/`geoZoomById` API，关闭 [#2925](https://github.com/VisActor/VChart/issues/2925)
- **@visactor/vchart**: MarkLine 的标签签背景支持自定义路径。关闭 [#2959](https://github.com/VisActor/VChart/issues/2959)

**🐛 功能修复**

- **@visactor/vchart**: 修复 ios 设备中，`pointEvent` 开启后导致的问题
- **@visactor/vchart**: 修复水波图反转后，渐变色不生效的问题
- **@visactor/vchart**: 修复`zoomEnd` 组合事件中，触发原始事件的 bug [#2931](https://github.com/VisActor/VChart/issues/2931)
- **@visactor/vchart**: 修复当维度轴为连续类型时，`setDimensionIndex`不能正常的展示 tooltip 的问题

**🔧 项目配置**

- **@visactor/vchart**: 更新 rollup.config.js，修复 es5/index.js 在浏览器中报错的问题，修复 [#2971](https://github.com/VisActor/VChart/issues/2971)

[更多详情请查看 v1.11.10](https://github.com/VisActor/VChart/releases/tag/v1.11.10)

# v1.11.9

2024-07-17

**🆕 新增功能**

- @visactor/vchart: 主题支持配置 tooltip 更新动画过渡持续时间

**🐛 功能修复**

- @visactor/vchart: 修复字段作为离散类型和连续类型时，计算统计值冲突的问题，关闭 [#2926](https://github.com/VisActor/VChart/issues/2926)
- @visactor/vchart: 修复更新图表时主题错误的问题
- @visactor/vchart: 修复更新图表时标签错误更新的问题
- @visactor/vchart: 修复极坐标系点更新动画的 bug
- @visactor/vchart: React 属性应支持 React 17
- @visactor/vchart: 修复设置桑基最小节点高度 `minNodeHeight` 时，边的高度计算不合理的问题

[更多详情请查看 v1.11.9](https://github.com/VisActor/VChart/releases/tag/v1.11.9)

# v1.11.7

2024-07-06

**🆕 新增功能**

- **@visactor/vchart**：支持在指标文本样式属性中配置回调函数，相关[#2540](https://github.com/VisActor/VChart/issues/2540)
- **@visactor/vchart**：在工具提示中添加选项 hideTimer，以通过计时器隐藏工具提示
- **@visactor/vchart**：支持 updateIndicatorDataById/updateIndicatorDataByIndex API，相关 [#2776](https://github.com/VisActor/VChart/issues/2776)
- **@visactor/vchart**：添加 userUpdateOptions 让用户指定图表的更新类型，修复一些动画错误

**🐛 功能修复**

- **barbackground**：设置自定义数据键修复时数据键未定义[#2908](https://github.com/VisActor/VChart/issues/2908)
- **@visactor/vchart**：修复配置 barWidth 时 barMaxWidth 不起作用的问题，修复[#2885](https://github.com/VisActor/VChart/issues/2885)
- **@visactor/vchart**：方向不正确的线/区域剪辑动画
- **十字线**：修复图例过滤数据时十字线位置的错误。修复修复[#2905](https://github.com/VisActor/VChart/issues/2905)
- **@visactor/vchart**：修复雷达图的极坐标动画逻辑
- **@visactor/vchart**：类型定义修复

[更多详情请查看 v1.11.7](https://github.com/VisActor/VChart/releases/tag/v1.11.7)

# v1.11.6

2024-06-27

**🐛 功能修复**

- **@visactor/vchart**: 修复图表背景不支持渐变色配置的问题
- **animation**: 修复玫瑰图重复更新，动画 bug，关闭[#2856](https://github.com/VisActor/VChart/issues/2856)
- **@visactor/vchart**:修复类型定义 `ITooltipTheme`, 关闭 [#2850](https://github.com/VisActor/VChart/issues/2850)
- **@visactor/vchart**: 修复`updateSpec`时，更新动画没有触发的问题 [#2835](https://github.com/VisActor/VChart/issues/2835) [#2836](https://github.com/VisActor/VChart/issues/2836)

[更多详情请查看 v1.11.6](https://github.com/VisActor/VChart/releases/tag/v1.11.6)

# v1.11.5

2024-06-21

**🆕 新增功能**

- **@visactor/vchart**: Tooltip 支持配置`style.align`，用于支持 RTL 模式
- **🐛 功能修复**

- **@visactor/vchart**: 优化暗色主题中，图例分页器的样式，关联问题 [#2654](https://github.com/VisActor/VChart/issues/2654)
- **@visactor/vchart**: 修复瀑布图堆积中，正数、负数在同一堆积下，表现错误的问题，修复 [#2212](https://github.com/VisActor/VChart/issues/2212)

[更多详情请查看 v1.11.5](https://github.com/VisActor/VChart/releases/tag/v1.11.5)

# v1.11.4

2024-06-18

**🐛 功能修复**

- **@visactor/vchart**: 修复当配置了`scales`的时候，`updateSpec` 效果错误的问题 [#2744](https://github.com/VisActor/VChart/issues/2744)
- **@visactor/vchart**: 修复当值接近最大值时，仪表盘可能抛错的问题，关闭[#2783](https://github.com/VisActor/VChart/issues/2783)
- **@visactor/vchart**: 修复仪表盘指针位置超出轴范围的问题，修复[#2780](https://github.com/VisActor/VChart/issues/2780)
- **@visactor/vchart**: 修复关闭 appear 动画后，循环动画不生效的问题，关闭[#2807](https://github.com/VisActor/VChart/issues/2807)

[更多详情请查看 v1.11.4](https://github.com/VisActor/VChart/releases/tag/v1.11.4)

# v1.11.3

2024-06-06

**🆕 新增功能**

- **@visactor/vchart**: DataZoom 新增配置项`showBackgroundChart`，用于显示/隐藏背景图

**🐛 功能修复**

- **@visactor/vchart**: 修复当 x 轴为线性轴时，柱形图应该正常工作，修复 [#2758](https://github.com/VisActor/VChart/issues/2758)
- **@visactor/vchart**: 修复 Treemap 连续图例数据过滤问题
- **@visactor/vchart**: 修复更新 Spec 时，新增组件类型无法生效的问题
- **@visactor/vchart**: 修复桑基图的 `setSelected` 方法，修复 [#2757](https://github.com/VisActor/VChart/issues/2757) 和 [#2765](https://github.com/VisActor/VChart/issues/2765)

[更多详情请查看 v1.11.3](https://github.com/VisActor/VChart/releases/tag/v1.11.3)

# v1.11.2

2024-05-30

**🐛 功能修复**

- **@visactor/vchart**: 修复配置 `animationThreshold` 不生效的问题，关闭 [#2745](https://github.com/VisActor/VChart/issues/2745)
- **@visactor/vchart**: 修复面积图更新动画不生效的问题
- **common**: 在 common 图表中，柱系列支持自动带宽尺寸，即`autoBandSize`。修复[#2704](https://github.com/VisActor/VChart/issues/2704)
- **@visactor/vchart**: 修复`Corsshiar`没有正常隐藏的问题，修复 [#2726](https://github.com/VisActor/VChart/issues/2726)
- **@visactor/vchart**: 关闭由`Datazoom`、`Scrollbar`交互引发的更新动画
- **@visactor/vchart**: 设置了 `type-step`的 markLine 的标签应该考虑用户设置的`refX`,`refY`,`dx`,`dy`，修复[#2739](https://github.com/VisActor/VChart/issues/2739)
- **react-vchart**: 修复 `<Axis />` 中的 props `id` 不生效的问题
- **@visactor/vchart**: 修复在主题配置中，`polarAxis.grid.smooth` 不生效的问题

**🔧 项目配置**

- **@visactor/vchart**: 在构建 es5 时，`@babel/preset-env` 的 `targets` 应该是 `defaults`，修复 [#2702](https://github.com/VisActor/VChart/issues/2702)

[更多详情请查看 v1.11.2](https://github.com/VisActor/VChart/releases/tag/v1.11.2)

# v1.11.1

2024-05-21

**🆕 新增功能**
**marker**：标记点支持圆弧线和前置标注符号。关闭[#2590](https://github.com/VisActor/VChart/issues/2590)
**@visactor/vchart**：添加 option 实现 crosshair 和 tooltip 保持同步
**🐛 功能修复**
**@visactor/vchart**：修复扩展标记中缺失 defaultDataIndex 的问题
**@visactor/vchart**：修复空 spec 的错误，修复[#1193](https://github.com/VisActor/VChart/issues/1193)
**@visactor/vchart**：修复发布后 renderNextTick 导致的错误
**@visactor/vchart**： layout-model 应该在 spec 中读取 layoutLevel，并且不为隐藏组件创建 layoutItem，相关[#1674](https://github.com/VisActor/VChart/issues/1674)
**@visactor/vchart**：当标记的 spec 更新时，应该调用 vchart. updateSpec 更新
**@visactor/vchart**：修复 flush 为 true 时采样的问题，修复[#2272](https://github.com/VisActor/VChart/issues/2272)
**@visactor/vchart**：修复 sankey 的 api valueToPositionX 和 valueToPositionY
**@visactor/vchart**： sankey 应该按序列字段着色，修复[#2678](https://github.com/VisActor/VChart/issues/2678)
**@visactor/vchart**：修复当轴为线性轴时 setDimensionIndex 的 bug
**@visactor/vchart**：修复导入 registerTTEnv 的问题
**@visactor/vchart**：修复 taro tt env 的问题，已关闭[#2648](https://github.com/VisActor/VChart/issues/2648)
**@visactor/vchart**：修复 renderSync()之前调用 updateFullDataSync()的错误，修复[#2655](https://github.com/VisActor/VChart/issues/2655)
**📖 新增文档**
**@visactor/vchart**：添加自定义动画文档
**@visactor/vchart**：react-lynx-vgraph 的完美文档

[更多详情请查看 v1.11.1](https://github.com/VisActor/VChart/releases/tag/v1.11.1)

# v1.11.0

2024-05-08

**🆕 新增功能**

- **@visactor/vchart**: 支持自定义 Mark 配置动画
- **@visactor/vchart**: 更新图表 spec 或数据时，图例应保持未选中状态，修复 [#2531](https://github.com/VisActor/VChart/issues/2531)，相关 [#2443](https://github.com/VisActor/VChart/issues/2443)
- **marker**: 增强 Marker 相关组件的的状态和动画，并支持极坐标和地理坐标轴。关闭[#1165](https://github.com/VisActor/VChart/issues/1165)
- **marker**: 为 Marker 相关组件添加交互式事件监听器。关闭[#2248](https://github.com/VisActor/VChart/issues/2248)
- **marker**: Marker 组件添加关于所有相关系列的自定义数据的配置。关闭[#2183](https://github.com/VisActor/VChart/issues/2183)
- **@visactor/vchart**: 在 react-vchart 中支持 spec 相同时的数据更新
- **@visactor/vchart**: 在线性轴中支持`softMin`和`softMax`，关闭 [#2498](https://github.com/VisActor/VChart/issues/2498)
- **@visactor/vchart**: 在 Tooltip 事件参数中添加新属性`tooltipSpec`和`tooltipActual`，相关 [#2454](https://github.com/VisActor/VChart/issues/2454)
- **@visactor/vchart**: 添加`othersLine`为 tooltip 超过显示行数后显示的“其他”行内容
- **@visactor/vchart**: 新增图表类型 Venn，相关 [#2144](https://github.com/VisActor/VChart/issues/2144)
- **@visactor/vchart**: 增强瀑布图总标签的功能
- **@visactor/vchart**: 添加`clearState()`、`clearSelected()`、`clearHovered()`的 API，修复 [#2552](https://github.com/VisActor/VChart/issues/2552)
- **@visactor/vchart**: 在`registerMap` API 中支持`simplify.tolerance`配置

**🐛 功能修复**

- **wordCloud**: 修复更新数据时，wordCloud 布局错误问题以及颜色 Scale 错误的问题。修复 [#2605](https://github.com/VisActor/VChart/issues/2605)
- **@visactor/vchart**: 修复更新 viewBox 时，位置错误问题
- **scroll**: 在 iOS 中滚动不生效。修复 [#1224](https://github.com/VisActor/VChart/issues/1224)
- **@visactor/vchart**: 修复 RangeColumn 图中`barWidth`等配置不生效的问题
- **marker**: 修复 Marker 组件位置偏移问题。修复 [#2579](https://github.com/VisActor/VChart/issues/2579)
- **@visactor/vchart**: 修复数据更新时，自定义 Mark 应该更新的问题
- **@visactor/vchart**: 修复漏斗图中重复的 categoryField 数据将导致意外的渲染结果
- **@visactor/vchart**: 修复散点图的 x 轴和 y 轴类型为 band 时报错的问题
- **@visactor/vchart**: vchart 不应重复创建相同的 scale
- **@visactor/vchart**: 修复桑基图标签隐藏时，点击空白处会报错的问题
- **@visactor/vchart**: 修复图例切换，导致散点图中`visible`通道发生变更，带来的渲染错误问题，关闭 [#2625](https://github.com/VisActor/VChart/issues/2625)
- **@visactor/vchart**: 修复默认的选中交互的关闭触发条件

**🔨 功能重构**

- **@visactor/vchart**: react-vchart 默认按需引入组件
- **@visactor/vchart**: 移除内置的`simplify`数据转换

**🔧 项目配置**

- **@visactor/vchart**: 升级依赖

[更多详情请查看 v1.11.0](https://github.com/VisActor/VChart/releases/tag/v1.11.0)

# v1.10.6

2024-05-08

**🆕 新增功能**

- **@visactor/vchart**: 水波图总计标签能力增强

**🐛 功能修复**

- **wordCloud**: 修复更新数据时，wordCloud 布局错误问题以及颜色比例尺错误的问题。修复 [#2605](https://github.com/VisActor/VChart/issues/2605)
- **@visactor/vchart**: 修复更新 viewBox 时，crosshair 位置错误问题
- **scroll**: 修复在 iOS 中滚动不生效的问题。修复 [#1224](https://github.com/VisActor/VChart/issues/1224)
- **@visactor/vchart**: 修复 range-column 图表`barWidth`等配置不生效问题
- **@visactor/vchart**: 修复漏斗图中重复的 categoryField 数据将导致意外的渲染结果
- **@visactor/vchart**: 修复桑基图标签隐藏时，点击空白处会报错的问题
- **@visactor/vchart**: 修复图例切换，导致散点图中`visible`通道发生变更，带来的渲染错误问题，关闭 [#2625](https://github.com/VisActor/VChart/issues/2625)
- **@visactor/vchart**: 修复默认的选中交互的关闭触发条件

[更多详情请查看 v1.10.6](https://github.com/VisActor/VChart/releases/tag/v1.10.6)

# v1.10.5

2024-04-26

**🆕 新增功能**

- **@visactor/vchart**: player 组件支持隐藏播放的功能。新增功能[#2524](https://github.com/VisActor/VChart/issues/2524)

**🐛 功能修复**

- **datazoom**: 修复 DataZoom 组件在外部拖拽开始、结束 icon，仍然触发`minSpan`和`maxSpan`更新的问题。 修复 [#2559](https://github.com/VisActor/VChart/issues/2559)
- **@visactor/vchart**：修复连续图例指定 `seriesId` 或 `seriesIndex`的时候，图例数据计算错误的问题
- **@visactor/vchart**：修复在 `react-vchart` 中 `eventsBinded`更新顺序问题
- **滚动条**：修复标签位置没有和`mark`对齐的问题。修复[#2534](https://github.com/VisActor/VChart/issues/2534)
- **滚动条**：`Scrollbar`滚动到边界时，恢复页面上的事件冒泡。修复[#2521](https://github.com/VisActor/VChart/issues/2521)
- **@visactor/vchart**：修复更新主题是，系列也减少导致的报错

**⚡ 性能优化**

- **@visactor/vchart**：优化饼图性能，修复[#2568](https://github.com/VisActor/VChart/issues/2568)

[更多详情请查看 v1.10.5](https://github.com/VisActor/VChart/releases/tag/v1.10.5)

# v1.10.4

2024-04-03

**🆕 新增功能**

- **@visactor/vchart**: 增强图表堆叠能力，提供 `stackSort` 以支持堆叠时的排序

**🐛 功能修复**

- **@visactor/vchart**: 修复了隐藏轴线时轴的单位错位的问题
- **@visactor/vchart**: 修复了堆叠图表中数据顺序不一致的问题
- **@visactor/vchart**: 增加了 common 图表中 markArea 和 markPoint 的类型定义
- **@visactor/vchart**: 修复了 crosshair 的 `formatMethod` 有可能执行多次的问题（提示：修复过以后，之前 crosshair label 保留两位小数的逻辑变成了默认的 formatMethod，用户替换 formatMethod 以后不再保留小数），相关[#2501](https://github.com/VisActor/VChart/issues/2501)
- **@visactor/vchart**: 修复了连续轴轴数据范围过小时，crosshair 难以移动的问题，相关[#2492](https://github.com/VisActor/VChart/issues/2492)
- **@visactor/vchart**: 修复了 `updateDataSync` 方法造成图表布局没有刷新的问题，相关[#2503](https://github.com/VisActor/VChart/issues/2503)

**🔨 功能重构**

- **@visactor/vchart**: 增加事件参数 `vchart`，会在生命周期事件中更新，相关[#2502](https://github.com/VisActor/VChart/issues/2502)

[更多详情请查看 v1.10.4](https://github.com/VisActor/VChart/releases/tag/v1.10.4)

# v1.10.3

2024-03-28

**🆕 新增功能**

- **@visactor/vchart**：支持`element-select`和`element-highlight`的交互事件
- **@visactor/vchart**：支持在地图图表中使用`showDefaultName`来显示地图数据中未匹配的名称

**🐛 功能修复**

- **@visactor/vchart**：修复 Tooltip 边框被裁减的问题[#2471](https://github.com/VisActor/VChart/issues/2471)
- **@visactor/vchart**：修复矩形 Crosshair 中`lineWidth`无效，相关[#2432](https://github.com/VisActor/VChart/issues/2432)
- **@visactor/vchart**：应该使用`series.getMarkInName`来获取总标签的计算标记，已修复[#2448](https://github.com/VisActor/VChart/issues/2448)
- **@visactor/vchart**：修复`updateSpecSync()`后事件触发次数不断增加的问题
- **@visactor/vchart**：如果未在 nameMap 中配置，地图数据将不会显示
- **@visactor/vchart**：在采样角度轴上缺少轴标签，相关[#2439](https://github.com/VisActor/VChart/issues/2439)
- **@visactor/vchart**：修复雷达图 clipAngle 动画在按需加载时的错误
- **@visactor/vchart**：修复\_eventDispatcher 的释放顺序问题
- **@visactor/vchart**：应该使用系列的\_seriesMark 来计算总标记，不是所有系列标记名称都与系列类型相同

[更多详情请查看 v1.10.3](https://github.com/VisActor/VChart/releases/tag/v1.10.3)

# v1.10.2

2024-03-26

**🆕 新增功能**

- **@visactor/vchart**：: 支持`element-select`和`element-highlight`交互事件

**🐛 功能修复**

- **@visactor/vchart**：：`lineWidth`在矩形十字准线中无效，相关[#2432](https://github.com/VisActor/VChart/issues/2432)
- **@visactor/vchart**：：应该使用 `series.getMarkInName` 来获取总标签计算的标记，修复[#2448](https://github.com/VisActor/VChart/issues/2448)
- **@visactor/vchart**：：修复`updateSpecSync()`之后事件触发计数的问题
- **@visactor/vchart**：：修复雷达图按需加载时的 clipAngle 动画错误

[更多详情请查看 v1.10.2](https://github.com/VisActor/VChart/releases/tag/v1.10.2)

# v1.10.0

2024-03-13

**🆕 新增功能**

- **@visactor/vchart**：柱状图支持`autoBandSize`，根据传入的配置（如`barWidth`）自动计算 bandSize，从而影响轴的实际长度，相关[#2268](https://github.com/VisActor/VChart/issues/2268)
- **@visactor/vchart**：堆叠柱状图支持配置`stackCornerRadius`，用于配置堆叠柱状图组的圆角半径，相关[#2185](https://github.com/VisActor/VChart/issues/2185)
- **@visactor/vchart**：优化 DataZoom 在大数据场景，已经存在`Brush`的场景下的性能以及体验
- **@visactor/vchart**：DataZoom 预览图，至此采样相关功能
- **@visactor/vchart**：支持图例中的滚动条
- **@visactor/vchart**：图例主题支持在不同方向中单独配置不同主题，相关[#2216](https://github.com/VisActor/VChart/issues/2216)
- **@visactor/vchart**：react-vchart 支持自定义 Tooltip 渲染，相关[#2288](https://github.com/VisActor/VChart/issues/2288)
- **@visactor/vchart**：主题支持配置堆叠状态下的系列主题，相关[#2331](https://github.com/VisActor/VChart/issues/2331)
- **@visactor/vchart**：主题支持自定义 token，相关[#2255](https://github.com/VisActor/VChart/issues/2255)
- **@visactor/vchart**：Tooltip 支持`lockAfterClick`，相关[#2352](https://github.com/VisActor/VChart/issues/2352)
- **@visactor/vchart**：Tooltip 的`x`和`y`位置可以分别固定，相关[#2320](https://github.com/VisActor/VChart/issues/2320)
- **@visactor/vchart**：在图表 spec 配置中，`tooltip.style`中添加更多提示形状配置，相关[#2292](https://github.com/VisActor/VChart/issues/2292)
- **@visactor/vchart**：arc 图元的状态样式支持`innerPadding`和`outerPadding`，相关[#2038](https://github.com/VisActor/VChart/issues/2038)
- **@visactor/vchart**：默认注册悬停/选择交互
- **@visactor/vchart**：在简单捆绑中移除高级交互

**🐛 功能修复**

- **@visactor/vchart**：可进入的提示在鼠标直接从提示移动到非图表区域时不会隐藏，相关[#2315](https://github.com/VisActor/VChart/issues/2315)
- **@visactor/vchart**：升级 vgrammar 版本以修复动画结束状态
- **@visactor/vchart**：在圆形进度图中`tickMask`无效，相关[#2316](https://github.com/VisActor/VChart/issues/2316)
- **@visactor/vchart**：矩形十字准线应在`lockAfterClick`为 true 时锁定
- **@visactor/vchart**：当区域样式为空时，不应创建`_backgroundMark`或`_foregroundMark`
- **@visactor/vchart**：修复无法监听 vchart 上的自定义标记事件的问题
- **@visactor/vchart**：网格组件及其子元素不应该可选
- **@visactor/vchart**：`<Bar />`上的事件不应触发两次
- **@visactor/vchart**：插件应在`release()`中释放

**🔨 功能重构**

- **react-vchart**：重构 react-vchart 以支持在严格模式下渲染

**🔧 项目配置**

- **@visactor/vchart**：使用`rimraf`替换`rm -rf`

[更多详情请查看 v1.10.0](https://github.com/VisActor/VChart/releases/tag/v1.10.0)

# v1.9.6

2024-03-11

**🆕 新增功能**

- **@visactor/vchart**：支持在 CustomMark 和 ExtensionMark 中设置`dataKey`
- **@visactor/vchart**：支持瀑布图总维度中的多个数据

**🐛 功能修复**

- **@visactor/vchart**：修复`animationAppear: false`不起作用的问题
- **@visactor/vchart**：修复设置 Mark 样式为无效值时引发错误的问题
- **@visactor/vchart**：修复重复事件注册的问题，修复[#2336](https://github.com/VisActor/VChart/issues/2336)
- **@visactor/vchart**：修复无法监听 vchart 上的标签和 totalLabel 组件事件的问题，`vchart.on('click', { level: 'model', type: 'label' })`
- **@visactor/vchart**：优化当轴反转时的总标签位置
- **@visactor/vchart**：升级 vrender 至 0.17.27，vgrammar 至 0.11.15
- **scrollbar**：被可缩放组件阻止点击。修复[#2333](https://github.com/VisActor/VChart/issues/2333)

[更多详情请查看 v1.9.6](https://github.com/VisActor/VChart/releases/tag/v1.9.6)

# v1.9.5

2024-03-04

**🆕 新增功能**

- **@visactor/vchart**: 自定义 Mark 和拓展 Mark 支持`dataKey`配置，用于配置数据对应的唯一 key
- **@visactor/vchart**: 瀑布图总计支持多分组数据

**🐛 功能修复**

- **@visactor/vchart**: 修复动画配置`animationAppear: false`不生效的问题
- **@visactor/vchart**: 优化坐标轴反转时，总计`label`展示位置

[更多详情请查看 v1.9.5](https://github.com/VisActor/VChart/releases/tag/v1.9.5)

# v1.9.3

2024-02-07

**🆕 新增功能**

- **@visactor/vchart**: supply pie percent data as `data._percent_`

**🐛 功能修复**

- **@visactor/vchart**: 由于收集数据导致轴零不工作。修复[#2226](https://github.com/VisActor/VChart/issues/2226)
- **@visactor/vchart**: 标记区域 xy 布局需要处理空坐标点的问题
- **player**: 默认属性导致布局错误。修复[#241](https://github.com/VisActor/VChart/issues/241)
- **@visactor/vchart**: 词云支持矩形形状。修复[#2220](https://github.com/VisActor/VChart/issues/2220)

[更多详情请查看 v1.9.3](https://github.com/VisActor/VChart/releases/tag/v1.9.3)

# v1.9.2

2024-02-05

**🐛 功能修复**

- **@visactor/vchart**: 当位置为'inside-bottom'或'inside-top'时，条形图标签存在问题
- **@visactor/vchart**: 在 block-vchart 演示中，`dpr`获取方法错误，需要实时获取
- **@visactor/vchart**: 系列可以从图表规格中读取`direction`，相关[#2181](https://github.com/VisActor/VChart/issues/2181)
- **@visactor/vchart**: dataZoom 的最小和最大范围无效，相关[#2195](https://github.com/VisActor/VChart/issues/2195)
- **@visactor/vchart**: 修复关闭尾部标签后，多层轴标签不显示的问题，相关[#2179](https://github.com/VisActor/VChart/issues/2179)
- **@visactor/vchart**: 修复极地动画插值问题
- **@visactor/react-vchart**: 修复当`<VChart />`的`onClick`为 null 时的错误，关闭[#2186](https://github.com/VisActor/VChart/issues/2186)
- **@visactor/vchart**: 当系列类型相同但轴不同时，图表不应切换堆叠，相关[#2210](https://github.com/VisActor/VChart/issues/2210)
- **@visactor/vchart**: DOM 工具提示形状的位置存在一些偏移，相关[#2188](https://github.com/VisActor/VChart/issues/2188)

**🔧 项目配置**

- **@visactor/vchart**: add react-lynx doc

[更多详情请查看 v1.9.2](https://github.com/VisActor/VChart/releases/tag/v1.9.2)

# v1.9.1

2024-01-31

**🐛 功能修复**

- **@visactor/vchart**: 自定义拓展 mark 运行顺序需要在所有系列 mark 的最后，修复[#2156](https://github.com/VisActor/VChart/issues/2156)
- **@visactor/vchart**: 通过`interactions`配置的交互能够通过配置 `option.disableTriggerEvent`关闭
- **@visactor/vchart**: 当图表有多个类目轴的时候，相同的数据在维度 tooltip 中只能展示一条，相关 issue[#2148](https://github.com/VisActor/VChart/issues/2148)
- **@visactor/react-vchart**: 修复 react-vchart 在 react 的 `strict-mode` 报错的问题
- **@visactor/vchart**: 修复双轴图，0 值没有对齐的问题，[#2167](https://github.com/VisActor/VChart/issues/2167)

[更多详情请查看 v1.9.1](https://github.com/VisActor/VChart/releases/tag/v1.9.1)

# v1.9.0

2024-01-26

**🆕 新增功能**

- **@visactor/vchart**：轴支持 `hasDimensionTooltip` 以强制指定 DimensionTooltip，相关 [#1678](https://github.com/VisActor/VChart/issues/1678)
- **@visactor/vchart**：crosshiar 支持定时关闭，修复 [#1676](https://github.com/VisActor/VChart/issues/1676)
- **@visactor/vchart**：条形图中的 `barBackground` 支持 `fieldLevel` 配置，指定 `barBackground` 是在 group 级别展示还是特定的层级展示，相关 [#1601](https://github.com/VisActor/VChart/issues/1601)
- **@visactor/vchart**：直方图图表支持条形背景，相关 [#1979](https://github.com/VisActor/VChart/issues/1979)
- **@visactor/vchart**：支持指标的 `fitStrategy`
- **liquid**：新增水波图。关闭[#1158](https://github.com/VisActor/VChart/issues/1158)
- **@visactor/vchart**：类目轴支持多层轴标签展示
- **@visactor/vchart**：面积图，支持分别配置线、面积是否支持交互响应，参见 [#1592](https://github.com/VisActor/VChart/issues/1592)
- **@visactor/vchart**：支持 mark 状态的 `stateSort`，修复 [#2003](https://github.com/VisActor/VChart/issues/2003)
- **@visactor/vchart**：支持在 extensionMark 中自定义 vrender 组件
- **@visactor/vchart**：Tooltip 支持 html 类型和 canvas 类型的按需引用，相关 [#1397](https://github.com/VisActor/VChart/issues/1397)

**🐛 功能修复**

- **@visactor/vchart**：修复当悬停和单击都配置时，Crosshair 触发的 bug，修复 [#1574](https://github.com/VisActor/VChart/issues/1574)
- **@visactor/vchart**：Tooltip 支持内容区域滚动，相关 [#2001](https://github.com/VisActor/VChart/issues/2001)
- **@visactor/vchart**：在默认主题中移除标签行高，相关 [#1983](https://github.com/VisActor/VChart/issues/1983)
- **@visactor/vchart**：修复某些情况下 Tooltip 回调可能无效的问题，相关 [#1943](https://github.com/VisActor/VChart/issues/1943)

**🔨 功能重构**

- **@visactor/vchart**：在 react-vchart 中弃用 `useSyncRender`，统一使用同步渲染

[更多详情请查看 v1.9.0](https://github.com/VisActor/VChart/releases/tag/v1.9.0)

# v1.8.10

2024-01-25

**🆕 新增功能**

- **@visactor/vchart**: 支持 vchart 笛卡尔坐标轴的 innerOffset

**🐛 功能修复**

- **@visactor/vchart**: 修复连续颜色比例尺的问题，关闭 [#2131](https://github.com/VisActor/VChart/issues/2131)
- **@visactor/vchart**: 不返回空数据的最小值和最大值，修复 [#1711](https://github.com/VisActor/VChart/issues/1711)
- **@visactor/vchart**: 修复极坐标相对轴刻度值获取错误的问题，已修复[#2117](https://github.com/VisActor/VChart/issues/2117)
- **@visactor/vchart**: 修复标记线未按图例过滤的问题，关闭 [#2127](https://github.com/VisActor/VChart/issues/2127)
- **@visactor/vchart**: 序列图区域绑定错误，修复[#2115](https://github.com/VisActor/VChart/issues/2115)
- **@visactor/vchart**: DOM 提示框上的星形图标显示不正确，相关 [#1905](https://github.com/VisActor/VChart/issues/1905)
- **@visactor/vchart**: 旋转树图的事件错误
- **@visactor/vchart**: 关闭动画时旋转树图的事件错误

[更多详情请查看 v1.8.10](https://github.com/VisActor/VChart/releases/tag/v1.8.10)

# v1.8.9

2024-01-23

**🆕 新增功能**

- **@visactor/vchart**：`option` 支持 `supportsTouchEvents` 和 `supportsPointerEvents` 配置，修复 [#2036](https://github.com/VisActor/VChart/issues/2036)
- **@visactor/vchart**：布局类型为 `normal-inline` 元素支持 `alignSelf` 配置，修复 [#2072](https://github.com/VisActor/VChart/issues/2072)
- **@visactor/vchart**：升级 vrender

**🐛 功能修复**

- **@visactor/vchart**：修复 Crosshair 定时器的 bug，修复 [#2088](https://github.com/VisActor/VChart/issues/2088)
- **@visactor/vchart**：修复轴的 onZero 属性的 bug，已修复 [#2098](https://github.com/VisActor/VChart/issues/2098)，[#2099](https://github.com/VisActor/VChart/issues/2099)
- **@visactor/vchart**：更新线图动画应排除 `defined` 通道的问题

[更多详情请查看 v1.8.9](https://github.com/VisActor/VChart/releases/tag/v1.8.9)

# v1.8.8

2024-01-19

**🆕 新增功能**

- **@visactor/vchart**: 增强滚动效果，已关闭 [#2037](https://github.com/VisActor/VChart/issues/2037)
- **@visactor/vchart**: 升级 @visactor/vrender-core 至锁定版本 0.17.14
- **@visactor/vchart**: sankey 图表支持 disableTriggerEvent 配置
- **@visactor/vchart**: 支持新的布局类型 region-relative-overlap

**🐛 功能修复**

- **@visactor/vchart**: `area.interactive` 在 area series spec 中不可用，相关 [#2030](https://github.com/VisActor/VChart/issues/2030)
- **@visactor/vchart**: 修复 datazoom 改变轴后 sortDataByAxis 不工作的问题
- **@visactor/vchart**: 当轴的 `trimPadding` 为 true 时，应显示 crosshair，修复 [#2054](https://github.com/VisActor/VChart/issues/2054)
- **@visactor/vchart**: 为 dimension tooltip 计算层转换
- **@visactor/vchart**: 修复了线图点的可见配置为 false 时 activePoint 不生效的问题
- **@visactor/vchart**: 在 [#1956](https://github.com/VisActor/VChart/issues/1956) 中配置 label.overlap:true 时的不同效果
- **@visactor/vchart**: label 位置与 region indent 不正确
- **scroll**: 在 lynx 环境中的事件错误。修复[#2041](https://github.com/VisActor/VChart/issues/2041)
- **@visactor/vchart**: 在 updateSpec 或 resize 后，地图比例尺不正确
- **@visactor/vchart**: 修复 tickCount 是函数时 nice 的 bug，修复 [#2050](https://github.com/VisActor/VChart/issues/2050)

[更多详情请查看 v1.8.8](https://github.com/VisActor/VChart/releases/tag/v1.8.8)

# v1.8.7

2024-01-11

**🆕 新增功能**

- **markPoint**：标记点支持项目内容限制。修复 [#1573](https://github.com/VisActor/VChart/issues/1573)
- **@visactor/vchart**：支持区域布局缩进

**🐛 功能修复**

- **@visactor/vchart**：标记工具提示在 rangeColumn 图表中不起作用，关闭 [#1959](https://github.com/VisActor/VChart/issues/1959)
- **brush**：绘制 brush 时图元 hover 无效。修复[#1985](https://github.com/VisActor/VChart/issues/1985)
- **@visactor/vchart**：修复 indent.top 无法正常生效的问题
- **@visactor/vchart**：只有当点位于某些 x 轴和 y 轴时才应触发十字准线，修复 [#1954](https://github.com/VisActor/VChart/issues/ 1954)
- **@visactor/vchart**：修复了自定义离散图例数据后图例过滤失败的问题，已修复[#1994](https://github.com/VisActor/VChart/issues/1994)
- **@visactor/vchart**：范围柱形图的 `barMinHeight` 属性不生效，已关闭[#1999](https://github.com/VisActor/VChart/issues/1999)
- **@visactor/vchart**：工具提示值堆叠在堆叠雷达图中，相关[#450](https://github.com/VisActor/VChart/issues/450)
- **@visactor/vchart**：修复 onebyone 符号动画顺序，关闭 [#1932](https://github.com/VisActor/VChart/issues/1932)

[更多详情请查看 v1.8.7](https://github.com/VisActor/VChart/releases/tag/v1.8.7)

# v1.8.5

2024-01-04

**🆕 新增功能**

- **@visactor/vchart**：添加 zAxis 主题并将标签空间设置为 0，关闭 [#149](https://github.com/VisActor/VChart/issues/149)

**🐛 功能修复**

- **@visactor/vchart**：计算十字准线的层转置
- **@visactor/vchart**：优化漏斗 clip 动画，无需扩展标记
- **@visactor/vchart**：修复多个系列的 hover 状态，关闭 [#1899](https://github.com/VisActor/VChart/issues/1899)
- **@visactor/vchart**：waterfall.label 在 [#1897](https://github.com/VisActor/VChart/issues/1897) 中不起作用

[更多详情请查看 v1.8.5](https://github.com/VisActor/VChart/releases/tag/v1.8.5)

# v1.8.4

2024-01-02

**🐛 功能修复**

- **@visactor/vchart**：将媒体查询规范接口添加到默认图表规范
- **@visactor/vchart**：修复无有效动画时扩展标记的 bug，修复 [#1877](https://github.com/VisActor/VChart/issues/1877)

[更多详情请查看 v1.8.4](https://github.com/VisActor/VChart/releases/tag/v1.8.4)

# v1.8.3

2024-01-02

**🆕 新增功能**

- **@visactor/vchart**：添加`useSyncRender`到 react-vchart，关闭[#1685](https://github.com/VisActor/VChart/issues/1685)
- **@visactor/vchart**：支持初始化参数`disableTriggerEvent`关闭图表默认交互效果

**🐛 功能修复**

- **@visactor/vchart**：图表选项。动画不起作用
- **@visactor/vchart**：修复 react-vchart 严格模式下的错误，修复[#1669](https://github.com/VisActor/VChart/issues/1669)
- **@visactor/vchart**：媒体查询操作的图表级别修改错误
- **@visactor/vchart**：二维图表中的维度工具提示仅包含一维数据，相关[#1841](https://github.com/VisActor/VChart/issues/1841)
- **@visactor/vchart**：修复带轴没有域时布局中的错误
- **@visactor/vchart**：漏斗 ClipIn 动画对于溢出 [#1839](https://github.com/VisActor/VChart/issues/1839) 中区域范围的标记有延迟
- **@visactor/vchart**：当标记标签的填充是一个对象时，它应该起作用
- **@visactor/vchart**：tt 小程序中未定义 globalThis，请参阅 [#1854](https://github.com/VisActor/VChart/issues/1854)
  **🔨 功能重构**
- **@visactor/vchart**：优化 marker 的样式配置

[更多详情请查看 v1.8.3](https://github.com/VisActor/VChart/releases/tag/v1.8.3)

# v1.8.2

2023-12-22

**🆕 新增功能**

- **@visactor/vchart**: 支持初始化参数 disableTriggerEvent，以关闭图表的默认交互效果
  **🐛 功能修复**
- **@visactor/vchart**: 修复了图表选项中配置 `animation` 无效的问题
- **@visactor/vchart**: 修复了媒体查询操作中图表级别修改出错的问题

[更多详情请查看 v1.8.2](https://github.com/VisActor/VChart/releases/tag/v1.8.2)

# v1.8.1

2023-12-21

**🐛 功能修复**

- **@visactor/vchart**: 提高了 spec 转换器和媒体查询的稳定性
- **@visactor/vchart**: 修复了 `select.triggerOff: none` 无效的问题

[更多详情请查看 v1.8.1](https://github.com/VisActor/VChart/releases/tag/v1.8.1)

# v1.8.0

2023-12-19

**🆕 新增功能**

- **@visactor/vchart**: 在漏斗 Mark 属性上下文中添加了 `getPoints` API
- **@visactor/vchart**: 支持图表级别插件，相关 [#1784](https://github.com/VisActor/VChart/issues/1784)
- **@visactor/vchart**: 新增媒体查询插件，支持自适应图表，相关 [#1413](https://github.com/VisActor/VChart/issues/1413)
- **@visactor/vchart**: 支持优化配置，并自动将 `disableCheckGraphicWidthOutRange` 设置为 true
- **@visactor/vchart**: 移除了图例的缺省主题

**🐛 功能修复**

- **@visactor/vchart**: 修复了 API：`getComponentsByKey` 无效的问题
- **@visactor/vchart**: 支持仪表盘指针系列的动画，相关 [#1699](https://github.com/VisActor/VChart/issues/1699)
- **@visactor/vchart**: 修复了数据流的问题，已关闭 [#1760](https://github.com/VisActor/VChart/issues/1760)
  **🔨 功能重构**
- **@visactor/vchart**: 更新了数据缩放和刷子更新回调，使用事件
  **⚡ 性能优化**
- **@visactor/vchart**: 当 visible 为 false 时，不解析详细属性

[更多详情请查看 v1.8.0](https://github.com/VisActor/VChart/releases/tag/v1.8.0)

# v1.7.5

2023-12-15

**🐛 功能修复**

- **brush**: 修复更新 `spec`后，brush 组件的释放问题. 修复 [#1720](https://github.com/VisActor/VChart/issues/1720)
- **@visactor/vchart**: 修复系列配置 `morph` 没正确解析的问题
- **@visactor/vchart**: 修复 spec 类型问题，修复 [#1486](https://github.com/VisActor/VChart/issues/1486)

[更多详情请查看 v1.7.5](https://github.com/VisActor/VChart/releases/tag/v1.7.5)

# v1.7.4

2023-12-12

**🆕 新增功能**

- **@visactor/vchart**: 支持 region 对应的 group 的交互操作

**🐛 功能修复**

- **@visactor/vchart**: 修复更新主题时， 标签样式未更新的问题 [#1698](https://github.com/VisActor/VChart/issues/1698)

[更多详情请查看 v1.7.4](https://github.com/VisActor/VChart/releases/tag/v1.7.4)

# v1.7.3

2023-12-06

**🆕 新增功能**

- **@visactor/vchart**: marker 支持 `coordinatesOffset` 用于点的位置调整
- **@visactor/vchart**: markLine `x`,`y`,`y1` / `y`,`x`,`x1` / `x`,`y`,`x1`,`y1` 三种格式的位置 pei
- **@visactor/vchart**: markPoint 支持 x\y 位置
- **@visactor/vchart**: 标记的位置属性支持相对坐标
- **@visactor/vchart**: 标记的坐标属性支持回调
- **@visactor/vchart**: 直角坐标系 crosshair 矩形宽度支持回调，支持 [#1567](https://github.com/VisActor/VChart/issues/1567)
- **@visactor/vchart**: 极坐标系 crosshair 支持默认展示
- **@visactor/vchart**: 支持文本省略位置配置 `suffixPosition`
- **@visactor/vchart**: 支持 `pickStrokeBuffer` 样式属性以扩展描边选择范围

**🐛 功能修复**

- **@visactor/vchart**: 修复了带有 seriesField 的 3D 条形图问题，关闭 [#1646](https://github.com/VisActor/VChart/issues/1646)
- **@visactor/vchart**: 修复了 3D 图表 z 轴无法正常工作的问题，关闭 [#1668](https://github.com/VisActor/VChart/issues/1668)
- **@visactor/vchart**: 更新时清除 mark encode, 修复了问题 [#1630](https://github.com/VisActor/VChart/issues/1630)
- **@visactor/vchart**: 修复了跟踪标记在仪表系列中具有多个元素的问题，相关问题编号 [#1643](https://github.com/VisActor/VChart/issues/1643)
- **@visactor/vchart**: 修复了仪表指针系列不支持自定义 `innerRadius` 的问题，相关问题编号 [#1644](https://github.com/VisActor/VChart/issues/1644)
- **@visactor/vchart**: 修复了 markArea 的类型问题
- **@visactor/vchart**: 外边框的颜色默认应与标签背景的填充颜色相同
- **@visactor/vchart**: 修复 `oneByOne` 循环动画
- **@visactor/vchart**: 大小图例增加 `align` 属性, 并修复了属性赋值不生效的问题，相关问题编号 [#1553](https://github.com/VisActor/VChart/issues/1553)

**🔨 功能重构**

- **@visactor/vchart**: 在组件模型中统一 `getVRenderComponents` 方法

**⚡ 性能优化**

- **@visactor/vchart**: 仅在需要时调用 `cloneDeepSpec()`

[更多详情请查看 v1.7.3](https://github.com/VisActor/VChart/releases/tag/v1.7.3)

# v1.7.2

2023-11-30

**🐛 功能修复**

- **@visactor/vchart**: 更新时清除旧的编码，修复了问题 [#1630](https://github.com/VisActor/VChart/issues/1630)
- **@visactor/vchart**: 修复了跟踪标记在仪表系列中具有多个元素的问题，相关问题编号 [#1643](https://github.com/VisActor/VChart/issues/1643)
- **@visactor/vchart**: 修复了仪表指针系列不支持自定义 `innerRadius` 的问题，相关问题编号 [#1644](https://github.com/VisActor/VChart/issues/1644)

**🔨 功能重构**

- **@visactor/vchart**: 在组件模型中统一 `getVRenderComponents` 方法

[更多详情请查看 v1.7.2](https://github.com/VisActor/VChart/releases/tag/v1.7.2)

# v1.7.1

2023-11-30

**🐛 功能修复**

- **@visactor/vchart**: 通过 `dataId` 读取扩展标记的数据视图
- **@visactor/vchart**: 修复了仅显示 domainLine 时轴的布局尺寸不正确的问题
- **@visactor/vchart**: 修复了创建系列时规格发生变化的 bug
- **pie**: 修复了获取中心位置错误的问题，修复了 [#1610](https://github.com/VisActor/VChart/issues/1610)
- **@visactor/vchart**: 优化了 `tooltip.enterable` 的效果，使用户的指针可以轻松进入工具提示，相关问题编号 [#1598](https://github.com/VisActor/VChart/issues/1598)

[更多详情请查看 v1.7.1](https://github.com/VisActor/VChart/releases/tag/v1.7.1)

# v1.7.0

2023-11-24

**🆕 新增功能**

- **@visactor/vchart**: 支持对带类型轴的 `trimPadding`，用于去除轴两端的空白空间，已关闭 [#1174](https://github.com/VisActor/VChart/issues/1174)
- **@visactor/vchart**: 自定义标记支持动画配置
- **@visactor/vchart**: 支持自定义标记形状
- **@visactor/vchart**: 优化数据缩放的自动模式，相关问题编号 [#1416](https://github.com/VisActor/VChart/issues/1416)
- **@visactor/vchart**: 增强标记的位置能力
- **@visactor/vchart**: 标记区域应支持同时指定 x、x1、y 和 y1
- **@visactor/vchart**: 添加了 light-mobile 和 dark-mobile 主题，相关问题编号 [#1414](https://github.com/VisActor/VChart/issues/1414)
- **@visactor/vchart**: 优化计算数据的性能
- **@visactor/vchart**: 在组件布局类型中支持 none
- **@visactor/vchart**: 支持线/区域标签
- **@visactor/vchart**: 不再在 vchart 中注册移动主题
- **@visactor/vchart**: 新功能：支持注册函数表达式语法，相关问题编号 [#1187](https://github.com/VisActor/VChart/issues/1187)

**🐛 功能修复**

- **@visactor/vchart**: 切换全局主题时图表填充不会更新
- **@visactor/vchart**: 修复了数据模型中规格意外修改的问题，详细信息见 [#1514](https://github.com/VisActor/VChart/issues/1514)
- **@visactor/vchart**: 更新了 enableSegements 的实现

**🔨 功能重构**

- **@visactor/vchart**: 重构图表模块的继承结构，使布局系统独立，详细信息见 [#1428](https://github.com/VisActor/VChart/issues/1428)

**⚡ 性能优化**

- **@visactor/vchart**: 在可编译标记中不需要调用 `attrTransform()`
- **@visactor/vchart**: 移除 `getStatisticsDomain()`
- **@visactor/vchart**: 当用户指定组件的宽度/高度时不再调用边界计算

[更多详情请查看 v1.7.0](https://github.com/VisActor/VChart/releases/tag/v1.7.0)

# v1.6.7

2023-11-21

**🐛 功能修复**

- **@visactor/wx-vchart**: 修复包打包相关问题 [#1570](https://github.com/VisActor/VChart/issues/1570) , PR in [#1571](https://github.com/VisActor/VChart/issues/1571)

[更多详情请查看 v1.6.7](https://github.com/VisActor/VChart/releases/tag/v1.6.7)

# v1.6.6

2023-11-21

**🐛 功能修复**

- **@visactor/vchart**: 修复了使用 updateSpecSync 时图表屏幕仍然存在的问题，详细信息见 [#1421](https://github.com/VisActor/VChart/issues/1421)
- **@visactor/vchart**: 当鼠标点击空白区域时，悬停形状应该重置，已修复 [#1538](https://github.com/VisActor/VChart/issues/1538)

[更多详情请查看 v1.6.6](https://github.com/VisActor/VChart/releases/tag/v1.6.6)

# v1.6.5

2023-11-17

**🆕 新增功能**

- **@visactor/vchart**: 在 react-vchart 中添加了 `skipFunctionDiff`，用于跳过函数的差异

**🐛 功能修复**

- **@visactor/vchart**: 更新规格后，维度点击无效，已修复 [#1532](https://github.com/VisActor/VChart/issues/1532)

[更多详情请查看 v1.6.5](https://github.com/VisActor/VChart/releases/tag/v1.6.5)

# v1.6.4

2023-11-16

**🐛 功能修复**

- **@visactor/vchart**: 修复了在修改数据缩放轴范围后触发不合理的自动缩进的问题
- **@visactor/vchart**: 默认实时效果在滚动条和数据缩放中无效。修复 [#1462](https://github.com/VisActor/VChart/issues/1462)
- **@visactor/vchart**: 漫游时滚动条和数据缩放中的过滤模式错误。修复 [#1460](https://github.com/VisActor/VChart/issues/1460)
- **@visactor/lark-vchart**: 修复了 lark-vchart、wx-vchart 中 `options` 无法工作的问题
- **@visactor/wx-vchart**: 修复了 lark-vchart、wx-vchart 中 `options` 无法工作的问题
- **@visactor/vchart**: `legendItemHover` 和 `legendItemUnHover` 应该只触发一次，详情见 https://github.com/VisActor/VRender/pull/678

**⚡ 性能优化**

- **@visactor/vchart**: 优化了桑基图的数据流

[更多详情请查看 v1.6.4](https://github.com/VisActor/VChart/releases/tag/v1.6.4)

# v1.6.3

2023-11-10

**🐛 功能修复**

- **@visactor/vchart**: 修复更新动画在线条标记上无效的问题
- **@visactor/vchart**: 更新 vgrammar 到 ~0.8.3 以修复问题，即 vrender 在 renderAsync 期间不应自动渲染
- **@visactor/vchart**: 修复在异步渲染期间快速释放 vchart 时出现的错误
- **@visactor/vchart**: 当用户全局配置 css overflow-warp 时，强制 tooltip 值换行，相关问题 [#1446](https://github.com/VisActor/VChart/issues/1446)
- **@visactor/vchart**: 修复：svg 模型的 id 应该是唯一的，已修复 [#1422](https://github.com/VisActor/VChart/issues/1422)，[#1442](https://github.com/VisActor/VChart/issues/1442)
- **@visactor/vchart**: 修复：空字符串不应该是有效数字，修复 [#1463](https://github.com/VisActor/VChart/issues/1463)

**⚡ 性能优化**

- **@visactor/vchart**: 优化桑基图的编码性能

[更多详情请查看 v1.6.3](https://github.com/VisActor/VChart/releases/tag/v1.6.3)

# v1.6.2

2023-11-08

**🐛 功能修复**

- **@visactor/vchart**: 当用户全局配置 css overflow-warp 时，强制提示值换行，相关问题 [#1446](https://github.com/VisActor/VChart/issues/1446)

[更多详情请查看 v1.6.2](https://github.com/VisActor/VChart/releases/tag/v1.6.2)

# v1.6.1

2023-11-08

**🆕 新增功能**

- **@visactor/vchart**: 标签格式方法回调添加上下文参数以提供系列对象
- **@visactor/vchart**: 添加 react-vchart 的 `<Title />` 和 `<Indicator />` 组件，关闭 [#1424](https://github.com/VisActor/VChart/issues/1424)

**🐛 功能修复**

- **@visactor/vchart**: 地图图表中 `centroidProperty` 无效
- **@visactor/vchart**: 修复由动画引起的不正确的图例过滤结果，问题编号 [#1403](https://github.com/VisActor/VChart/issues/1403)
- **@visactor/vchart**: 如果布局项不可见，则不参与网格布局，相关问题编号 [#1425](https://github.com/VisActor/VChart/issues/1425)
- **@visactor/vchart**: 聚合返回值无穷大的问题，修复 [#1380](https://github.com/VisActor/VChart/issues/1380)'

[更多详情请查看 v1.6.1](https://github.com/VisActor/VChart/releases/tag/v1.6.1)

# v1.6.0

2023-11-03

**🆕 新增功能**

- **@visactor/vchart**: 为类似柱状系列添加柱状背景标记，相关问题编号 [#1154](https://github.com/VisActor/VChart/issues/1154)
- **@visactor/vchart**: 在提示规范中添加 `updateElement` 回调，以配置基于默认提示处理程序的自定义提示 DOM 元素，相关问题编号 [#1338](https://github.com/VisActor/VChart/issues/1338)
- **@visactor/vchart**: 在更新数据时启用退出动画
- **@visactor/vchart**: 支持在线/区域/散点/柱状系列中配置功能标签位置
- **@visactor/vchart**: 动态加载浏览器或节点环境代码
- **@visactor/vchart**: 数据方案支持通过区分系列方向进行配置，相关问题编号 [#1209](https://github.com/VisActor/VChart/issues/1209)
- **@visactor/vchart**: 数据采样和点重叠。关闭 [#460](https://github.com/VisActor/VChart/issues/460)
- **@visactor/taro-vchart**: 支持小程序

**🐛 功能修复**

- **@visactor/vchart**: 修复 react-vchart 模式无效
- **@visactor/vchart**: 优化非浏览器环境中悬停的触发
- **@visactor/vchart**: 如果系列标记为线条，当用户需要填充值时返回描边值，已修复 [#1388](https://github.com/VisActor/VChart/issues/1388)
- **@visactor/vchart**: 修复玫瑰维度提示中的角度偏移，相关问题编号 [#1263](https://github.com/VisActor/VChart/issues/1263)

**⚡ 性能优化**

- **@visactor/vchart**: 在需要时创建堆栈并计算堆栈属性

[更多详情请查看 v1.6.0](https://github.com/VisActor/VChart/releases/tag/v1.6.0)

# v1.5.4

2023-10-30

**🐛 功能修复**

- **@visactor/vchart**: 漏斗转化比例标签出现异常，见 [#1348](https://github.com/VisActor/VChart/issues/1348)
- **@visactor/vchart**: 在 Lark 小程序中，提示值标签被裁剪，相关问题编号 [#1346](https://github.com/VisActor/VChart/issues/1346)

[更多详情请查看 v1.5.4](https://github.com/VisActor/VChart/releases/tag/v1.5.4)

# v1.5.3

2023-10-27

**🆕 新增功能**

- **@visactor/vchart**: 支持 vchart 的 exportCanvas api

**🐛 功能修复**

- **@visactor/vchart**: sankey chart 下游高亮，相关问题编号 [#1269](https://github.com/VisActor/VChart/issues/1269)
- **@visactor/vchart**: 解决首次选择无效的问题。修复 [#1129](https://github.com/VisActor/VChart/issues/1129)
- **@visactor/vchart**: 圆形轴标签的新布局方法，相关问题编号 [#1123](https://github.com/VisActor/VChart/issues/1123)
- **@visactor/vchart**: 更改仪表图中轴的默认 zIndex，相关问题编号 [#1122](https://github.com/VisActor/VChart/issues/1122)
- **@visactor/vchart**: 调整数据缩放的位置错误，当调整大小时。修复 [#520](https://github.com/VisActor/VChart/issues/520)
- **@visactor/vchart**: 释放后解决事件关闭错误
- **@visactor/vchart**: 修复散点图的 invalidType 检查 x 和 y 同时出现的问题
- **@visactor/vchart**: 修复 markline 中的 min/max 聚合结果不正确的问题，见 [#1261](https://github.com/VisActor/VChart/issues/1261)
- **@visactor/vchart**: 修复地图提示标题不显示来自 nameMap 的名称的问题，见 [#1260](https://github.com/VisActor/VChart/issues/1260)
- **@visactor/vchart**: sankey 支持字符串值
- **@visactor/vchart**: 修复十字准线在 weapp 中无法触发的问题，已修复 [#1322](https://github.com/VisActor/VChart/issues/1322)

[更多详情请查看 v1.5.3](https://github.com/VisActor/VChart/releases/tag/v1.5.3)

# v1.5.2

2023-10-24

**🆕 新增功能**

- **@visactor/vchart**: 支持 vchart 的 exportCanvas api

**🐛 功能修复**

- **@visactor/vchart**: 圆形轴标签的新布局方法，相关问题编号 [#1123](https://github.com/VisActor/VChart/issues/1123)
- **@visactor/vchart**: 更改仪表图中轴的默认 zIndex，相关问题编号 [#1122](https://github.com/VisActor/VChart/issues/1122)
- **@visactor/vchart**: 调整数据缩放的位置错误，当调整大小时。修复 [#520](https://github.com/VisActor/VChart/issues/520)
- **@visactor/vchart**: 修复 markline 中的 min/max 聚合结果不正确的问题，见 [#1261](https://github.com/VisActor/VChart/issues/1261)
- **@visactor/vchart**: 修复地图提示标题不显示来自 nameMap 的名称的问题，见 [#1260](https://github.com/VisActor/VChart/issues/1260)

[更多详情请查看 v1.5.2](https://github.com/VisActor/VChart/releases/tag/v1.5.2)

# v1.5.1

2023-10-20

**🆕 新增功能**

- **@visactor/vchart**: 支持相关图表
- **@visactor/vchart**: 在布局项中添加 getGraphicBounds api 以支持获取图形大小
- **@visactor/vchart**: 优化布局中的自动缩进逻辑，确保填充效果正确
- **@visactor/vchart**: 在地图系列中支持 `centroidProperty`
- **@visactor/vchart**: 滚动条增强缩放和拖动滚动功能。关闭 [#965](https://github.com/VisActor/VChart/issues/965)
- **@visactor/vchart**: 数据缩放增强 zoomLock 和 span 配置。关闭 [#1082](https://github.com/VisActor/VChart/issues/1082)
- **@visactor/vchart**: 为 customMark 的属性回调提供 attributeContext 参数
- **@visactor/vchart**: 提供 afterLayout 事件以支持用户修改布局效果
- **@visactor/vchart**: 在 tooltip 的 `updateContent` 回调参数中提供 datum，相关 [#1244](https://github.com/VisActor/VChart/issues/1244)
- **@visactor/vchart**: 添加 markLine、markArea 和 funnel 系列的默认主题（light、dark）
- **@visactor/vchart**: 支持按需加载环境代码

**🐛 功能修复**

- **@visactor/vchart**: 优化仪表图中 `padAngle` 的显示，并将 `padAngle` 的单位更改为角度，相关 [#1215](https://github.com/VisActor/VChart/issues/1215)
- **@visactor/vchart**: 修复桑基图 'adjacency' 交互高亮效果错误，[#1121](https://github.com/VisActor/VChart/issues/1121)
- **@visactor/vchart**: 修复箱线图异常值动画会抛出错误的问题
- **@visactor/vchart**: 修复滚动条中重复的事件注册，已修复[#1241](https://github.com/VisActor/VChart/issues/1241)

**🔨 功能重构**

- **@visactor/vchart**: 添加注册函数以收集图表/系列/组件的副作用代码
- **@visactor/vchart**: 添加动画的注册函数

[更多详情请查看 v1.5.1](https://github.com/VisActor/VChart/releases/tag/v1.5.1)

# v1.4.3

2023-10-17

**🆕 新增功能**

- **@visactor/vchart**: 刷子状态代理到状态规格

**🐛 功能修复**

- **@visactor/vchart**: 修复图例项仅具有描边时无法与图形颜色一致的问题，详细信息见 [#1147](https://github.com/VisActor/VChart/issues/1147)

[更多详情请查看 v1.4.3](https://github.com/VisActor/VChart/releases/tag/v1.4.3)

# v1.4.2

2023-10-12

**🆕 新增功能**

- **@visactor/vchart**: 仪表图系列支持标签组件，相关 [#1039](https://github.com/VisActor/VChart/issues/1039)
- **@visactor/vchart**: 在 `VChart.Utils` 中添加静态工具
- **@visactor/vchart**: 支持 afterResize 和 afterRender 事件
- **@visactor/vchart**: 在提示框标签样式中添加新配置 `autoWidth`，相关 [#688](https://github.com/VisActor/VChart/issues/688)

**🐛 功能修复**

- **@visactor/vchart**: 当被 VTable 释放时，`tooltipRelease` 事件可能无效
- **@visactor/vchart**: 设置刷子时选择错误。修复 [#1129](https://github.com/VisActor/VChart/issues/1129)
- **@visactor/vchart**: 优化长提示框标题的默认性能，相关 [#688](https://github.com/VisActor/VChart/issues/688)
- **@visactor/vchart**: 如果 `markLine` 为空，如 `{}` 或 `[]`，则不应创建标记组件
- **@visactor/vchart**: 修复使用 `positions` 创建标记组件时的问题，已修复 [#1084](https://github.com/VisActor/VChart/issues/1084)
- **@visactor/vchart**: 线性轴自动可见。修复 [#1118](https://github.com/VisActor/VChart/issues/1118)

[更多详情请查看 v1.4.2](https://github.com/VisActor/VChart/releases/tag/v1.4.2)

# v1.4.1

2023-09-27

**🐛 功能修复**

- **@visactor/vchart**: 优化 updateSpec 以避免额外的主题更新
- **@visactor/vchart**: 修复 resize 后 updateViewBox api 失败的问题
- **datazoom**: 修复没有预览图表时的边界错误。修复 [#1050](https://github.com/VisActor/VChart/issues/1050)
- **@visactor/vchart**: 玫瑰图的第一个扇区的 startAngle 应该从极坐标的 startAngle 开始，修复 [#900](https://github.com/VisActor/VChart/issues/900)
- **@visactor/vchart**: 修复 `theme.fontFamily` 无法工作的问题
- **@visactor/vchart**: 修复 updateFullData 无法更新系列数据的问题

[更多详情请查看 v1.4.1](https://github.com/VisActor/VChart/releases/tag/v1.4.1)

# v1.4.0

2023-09-25

**🆕 新增功能**

**@visactor/vchart**: 添加滚动条布局规范到序列。关闭[#792](https://github.com/VisActor/VChart/issues/792)
**@visactor/vchart**: 线性轴支持`tooltipFilterRange`以配置维度提示的相对数据范围，相关[#933](https://github.com/VisActor/VChart/issues/933)
**@visactor/vchart**: 在标记函数样式的参数中添加 vchart 到上下文
**@visactor/vchart**: 为 scrollBar 添加默认的暗黑主题
**@visactor/vchart**: 为带轴的规范添加配置项`bandSize`，`maxBandSize`，`minBandSize`，相关[#263](https://github.com/VisActor/VChart/issues/263)
**@visactor/vchart**: 为条形系列支持`barMinHeight`，关联[#722](https://github.com/VisActor/VChart/issues/722)
**@visactor/vchart**: 增强默认词云出现动画，详情见[#675](https://github.com/VisActor/VChart/issues/675)
**@visactor/vchart**: 极坐标进度图表支持刻度蒙版，相关[#596](https://github.com/VisActor/VChart/issues/596)
**@visactor/vchart**: 饼图标签线支持平滑
**@visactor/vchart**: 支持 tickCount 的自定义回调，参见[#951](https://github.com/VisActor/VChart/issues/951)
**@visactor/vchart**: 支持`label.confine`用于 markLine 和 markPoint 自动调整标签位置，关联https://github.com/VisActor/VChart/issues/699
**@visactor/vchart**: 支持饼图的`minAngle`，关联[#738](https://github.com/VisActor/VChart/issues/738)
**@visactor/vchart**: 在地图系列中默认禁用标签动画
**@visactor/vchart**: 增加图表堆叠能力，提供 stackValue 支持多系列独立堆叠
**@visactor/vchart**: 增加图表堆叠能力，提供 stackInverse 支持反向堆叠
**@visactor/vchart**: 为 mark 提供`scaleCenter`属性，见[#781](https://github.com/VisActor/VChart/issues/781)
**@visactor/vchart**: 提供 updateModelSpec api，使用户可以单独更新图表模块的配置
**@visactor/vchart**: 支持删除通过处理程序传递的相应类型的所有事件而不传递
**@visactor/vchart**: 提示支持自定义形状类型，相关[#496](https://github.com/VisActor/VChart/issues/496)
**@visactor/vchart**: 提示支持每行的自定义`spaceRow`，相关[#949](https://github.com/VisActor/VChart/issues/949)
**@visactor/vchart**: 提示支持相对于光标的自定义固定位置，相关[#541](https://github.com/VisActor/VChart/issues/541)
**@visactor/vchart**: 修复仅数据更改时 updateSpec 不起作用的问题，详情见[#912](https://github.com/VisActor/VChart/issues/912)
**@visactor/vchart**: 支持 wx 环境
**@visactor/vchart**: 删除阈值的兼容性代码
**@visactor/vchart**: 在地图系列中访问标签

**🐛 功能修复**
**@visactor/vchart**: 当 stack 为 false 且没有`fieldX2`或`fieldY2`时，`dataToPositionX1`和`dataToPositionY1`应使用 0，关闭[#647](https://github.com/VisActor/VChart/issues/647)
**@visactor/vchart**: 当 stroke 设置为 null 时，标签描边应遵循默认颜色，详见[#985](https://github.com/VisActor/VChart/issues/985)
**@visactor/vchart**: `offsetX`和`offsetY`在标记组件中无法工作
**@visactor/vchart**: 桑基图支持颜色配置
**@visactor/vchart**: 设置标记悬停时样式不生效。修复[#976](https://github.com/VisActor/VChart/issues/976)
**@visactor/vchart**: 当计算机运行缓慢时，tooltipHide 事件可能无效
**@visactor/vchart**: 图表通过 serDataByAxis 配置传递到系列
**@visactor/vchart**: 调用 updateSpec 时，先前的滚动条尚未清除，关联[#1044](https://github.com/VisActor/VChart/issues/1044)
**@visactor/vchart**: 为 this.\_spec 添加保护，修复[#1045](https://github.com/VisActor/VChart/issues/1045)
**@visactor/vchart**: 修复`seriesId`在图例中不起作用的问题，关闭[#910](https://github.com/VisActor/VChart/issues/910)
**@visactor/vchart**: 锁定域时状态刻度错误。修复[#629](https://github.com/VisActor/VChart/issues/629)
**@visactor/vchart**: 通过处理程序传递时修复 unoff 事件
**@visactor/vchart**: 多次添加 userEvent
**@visactor/vchart**: 线和区域标记应默认设置 closePath，修复[#654](https://github.com/VisActor/VChart/issues/654)
**@visactor/vchart**: 修复雷达区域的 invalidType 不起作用的问题，修复[#867](https://github.com/VisActor/VChart/issues/867)
**@visactor/vchart**: 在调用 updataDataSync 后 invalidType 不起作用，详情见[#1057](https://github.com/VisActor/VChart/issues/1057)
**@visactor/vchart**: 在 updateData 后标记不渲染。修复[#882](https://github.com/VisActor/VChart/issues/882)
**@visactor/vchart**: 修复 markLine symbol.size 不起作用的问题
**@visactor/vchart**: 优化 normal-inline 的布局，修复[#989](https://github.com/VisActor/VChart/issues/989)
**@visactor/vchart**: 对 this.\_spec 进行乘积，修复[#1062](https://github.com/VisActor/VChart/issues/1062)
**@visactor/vchart**: 修复多区域进度布局的问题
**@visactor/vchart**: 当点和链接数据为空时渲染错误。修复[#1019](https://github.com/VisActor/VChart/issues/1019)
**@visactor/vchart**: fontsize renge 在没有值字段的情况下不起作用。修复[#522](https://github.com/VisActor/VChart/issues/522)
**@visactor/vchart**: 锁定十字准线标签以使其无法交互，因为它会影响轴标签的事件捕获
**@visactor/vchart**: 修复在[#915](https://github.com/VisActor/VChart/issues/915)中读取 null 选项的 onError 问题

**🔨 功能重构**

**@visactor/vchart**: 将生命周期的 updateSpec 拆分为规范转换和比较
**@visactor/vchart**: 删除未使用的代码，并将 ticks 转换转换为 vutils-extension
**@visactor/vchart**: 统一组件的清除
**@visactor/vchart**: 为更好的层控制将网格与轴分离
**@visactor/vchart**: 使用@visctor/vgrammar-core 替换@visctor/vgrammar

[更多详情请查看 v1.4.0](https://github.com/VisActor/VChart/releases/tag/v1.4.0)

# v1.3.4

2023-09-20

**🐛 功能修复**

- **@visactor/vchart**: 圆形进度图在执行`updateSpec`时可能会抛出错误，相关问题编号[#994](https://github.com/VisActor/VChart/issues/994)
- **@visactor/vchart**: 在执行`updateSpec`时，规范中的主题未正确更新，相关问题编号[#996](https://github.com/VisActor/VChart/issues/996)
- **@visactor/vchart**: 圆形进度图中规范中的`track`无法工作，相关问题编号[#600](https://github.com/VisActor/VChart/issues/600)
- **@visactor/vchart**: 修复图表执行`updateSpec`时触发的错误，已修复[#988](https://github.com/VisActor/VChart/issues/988)，[#1002](https://github.com/VisActor/VChart/issues/1002)
- **@visactor/vchart**: 修复播放器组件执行`updateSpec`的问题，已修复[#967](https://github.com/VisActor/VChart/issues/967)

[更多详情请查看 v1.3.4](https://github.com/VisActor/VChart/releases/tag/v1.3.4)

# v1.3.3

2023-09-18

**🐛 功能修复**

- **@visactor/vchart**: 修复播放器组件执行`updateSpec`的问题，已修复[#967](https://github.com/VisActor/VChart/issues/967)

[更多详情请查看 v1.3.3](https://github.com/VisActor/VChart/releases/tag/v1.3.3)

# v1.3.2

2023-09-14

**🆕 新增功能**

- **@visactor/vchart**: setDimensionIndex api 支持通过传入 null 来取消选择的能力
- **@visactor/vchart**: 在瀑布图中使用精确计算以避免标签出现意外值，详情见[#721](https://github.com/VisActor/VChart/issues/721)
- **@visactor/vchart**: 交互默认配置。

**🐛 功能修复**

- **@visactor/vchart**: 对数刻度在条形堆叠具有零基线值时，零值周围没有结果。修复[#634](https://github.com/VisActor/VChart/issues/634)
- **@visactor/vchart**: 修复 updateSpec 后用户事件监听器失效的问题
- **@visactor/vchart**: 修复更新规范时系列标记静态样式未更新的 bug
- **@visactor/vchart**: 修复更新规范时数据字段未更新的 bug，详情见[#829](https://github.com/VisActor/VChart/issues/829)
- **@visactor/vchart**: 修复通用图表中动画配置不起作用的问题，相关[#814](https://github.com/VisActor/VChart/issues/814)

**⚡ 性能优化**

- **@visactor/vchart**: 优化维度统计的性能
- **@visactor/vchart**: 仅在需要时计算维度树

[更多详情请查看 v1.3.2](https://github.com/VisActor/VChart/releases/tag/v1.3.2)

# v1.3.1

2023-09-05

**🆕 新增功能**

- **@visactor/vchart**: `lineHeight`支持字符串比例值，相关[#744](https://github.com/VisActor/VChart/issues/744)
- **@visactor/vchart**: 升级 vdataset 以在调用 updateData 时克隆源数据

**🐛 功能修复**

- **@visactor/vchart**: 将'SeriesMarkNameEnum'移动到单个文件中，解决 Codesandbox 无法工作的问题，看起来像是 Codesandbox 打包程序的错误，参见https://github.com/codesandbox/codesandbox-client/issues/6435
- **@visactor/vchart**: 修复 updateData 后 sortDataByAxis 不起作用
- **@visactor/vchart**: 修复 updateData 后图例不更新的问题，修复[#769](https://github.com/VisActor/VChart/issues/769)
- **@visactor/vchart**: 修复图例的 maxHeight 不起作用的问题
- **@visactor/vchart**: 修复饼图中的 null 值问题，已修复https://github.com/VisActor/VChart/issues/748
- **@visactor/vchart**: 修复数据全部为 0 时饼图绘制完整圆的问题，因为最后一条数据的 endAngle 被强制配置为极坐标的 endAngle
- **@visactor/vchart**: 修复离散图例中 seriesIndex 不起作用的问题，见[#732](https://github.com/VisActor/VChart/issues/732)
  [更多详情请查看 v1.3.1](https://github.com/VisActor/VChart/releases/tag/v1.3.1)
