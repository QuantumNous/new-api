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

- **@visactor/vchart**: fix: Replace all the vchartConstructor to vchartConstructor, and ensure backward compatibility with older versions.

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

- **@visactor/vchart**: add `alwayCalculateTotal` for total label
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
- **@visactor/vchart**: support `clamp` in linear scales, [#3738](https://github.com/VisActor/VChart/issues/3738)

**🐛 Bug fix**

- **@visactor/vchart**: display line label normally when seriesField is missing, [#3709](https://github.com/VisActor/VChart/issues/3709)
- **@visactor/vchart**: customMark should return components in `getVRenderComponents()`, fix [#3727](https://github.com/VisActor/VChart/issues/3727)
- **@visactor/vchart**: map zoom error bug. fix[#3743](https://github.com/VisActor/VChart/issues/3743)
- **@visactor/vchart**: Fix the issue where the maximum internal layer of the Sankey diagram is not updated when `setNodeLayer` is set.
- **@visactor/vchart**: Fix the issue where nodes are not displayed when the number of nodes in the Sankey diagram is 1 and the number of edges is 0, fix [#3749](https://github.com/VisActor/VChart/issues/3749).

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

- **@visactor/vchart**: Added `insertZerosToArray` configuration to `wordCloudConfig` in the word cloud series to address performance issues in specific browsers.
- **@visactor/vchart**: `markArea` labels now support more positions, including: `'insideBottom'`, `'topLeft'`, `'topRight'`, `'bottomLeft'`, `'bottomRight'`, `'insideTopLeft'`, `'insideTopRight'`, `'insideBottomLeft'`, `'insideBottomRight'`.

**🐛 Bug fix**

- **@visactor/vchart**: fix error of tooltip about `showDelay`, fix [#3663](https://github.com/VisActor/VChart/issues/3663)
- **@visactor/vchart**: fix offset of tooltip, fix [#3666](https://github.com/VisActor/VChart/issues/3666)
- **@visactor/vchart**: fix bug of parse lineHeight of tooltip row, fix [#3643](https://github.com/VisActor/VChart/issues/3643)
- **@visactor/vchart**: axis break's scope calculate error, fix[#3656](https://github.com/VisActor/VChart/issues/3656)
- **@visactor/vchart**: fix the issue where map drag interaction cannot be terminated outside the canvas, [#3650](https://github.com/VisActor/VChart/issues/3650)
- **@visactor/vchart**: fix the issue where map drag interaction cannot be terminated outside the canvas.
- **@visactor/vchart**: fix the issue where the line shape is incorrect when there are invalid points in the line or area and `invalidType` is set to `link`, fix [#3146](https://github.com/VisActor/VChart/issues/3146)

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
- **@visactor/vchart**: page should not crash when `tickStep` is too small, fix [#3591](https://github.com/VisActor/VChart/issues/3591)
- **@visactor/vchart**: fix updating of customized DOM when has interactive layer, fix [#3587](https://github.com/VisActor/VChart/issues/3587)
- **@visactor/vchart**: fix axis breaks when set `tickStep`, fix [#3560](https://github.com/VisActor/VChart/issues/3560)

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
- **@visactor/vchart**: when the `invalidType` of line is `"link"`, line should be connected rightly. fix [#3436](https://github.com/VisActor/VChart/issues/3436), fix [#3238](https://github.com/VisActor/VChart/issues/3238)
- **@visactor/vchart**: richtext should work when set state, fix [#3465](https://github.com/VisActor/VChart/issues/3465)

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

- **@visactor/vchart**: fix params of tickCount in linear-axis-mixin, fix [#3053](https://github.com/VisActor/VChart/issues/3053)
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
- **@visactor/vchart**: prevent trigger original event in panEnd composite event [#2931](https://github.com/VisActor/VChart/issues/2931)
- **@visactor/vchart**: charts should not stack when only specify `stackValue` but `stack` is false, fix [#3005](https://github.com/VisActor/VChart/issues/3005)
- **@visactor/vchart**: `updateData` incorrect with datazoom, related [#3041](https://github.com/VisActor/VChart/issues/3041)
- **@visactor/vchart**: fix issue of `updateSpec` when visible of grid in axis change, fix [#3004](https://github.com/VisActor/VChart/issues/3004)
- **@visactor/vchart**: fix fontFamily when update theme, fix [#3028](https://github.com/VisActor/VChart/issues/3028)
- **@visactor/vchart**: fix:curveType `monotone` in seriesStyle not work

[more detail about v1.11.11](https://github.com/VisActor/VChart/releases/tag/v1.11.11)

# v1.11.10

2024-07-24

**🆕 New feature**

- **@visactor/vchart**: liquid support reverse and target mark. close [#2977](https://github.com/VisActor/VChart/issues/2977) & close [#2978](https://github.com/VisActor/VChart/issues/2978)
- **@visactor/vchart**: add `totalScale` params in geo zoom event
- **@visactor/vchart**: support `geoZoomByIndex`/`geoZoomById` API, close [#2925](https://github.com/VisActor/VChart/issues/2925)
- **@visactor/vchart**: marker label background support custom path. close [#2959](https://github.com/VisActor/VChart/issues/2959)

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

2024-07-17

**🐛 Bug fix**

- @visactor/vchart: fix statistics confict of linear and discrete field, close [#2926](https://github.com/VisActor/VChart/issues/2926)
- @visactor/vchart: fix theme error of update spec
- @visactor/vchart: fix update of label when udpate spec
- @visactor/vchart: fix bug of polar point update aniamtion
- @visactor/vchart: react attributes should support react 17
- @visactor/vchart: fix height of link when set `minNodeHeight` of sankey

[more detail about v1.11.9](https://github.com/VisActor/VChart/releases/tag/v1.11.9)

# v1.11.7

2024-07-06

**🆕 New feature**

- **@visactor/vchart**: support configuring callback function in indicator text style attributes, related [#2540](https://github.com/VisActor/VChart/issues/2540)
- **@visactor/vchart**: add options hideTimer in tooltip, to hide tooltip by timer
- **@visactor/vchart**: support updateIndicatorDataById/updateIndicatorDataByIndex API, related [#2776](https://github.com/VisActor/VChart/issues/2776)
- **@visactor/vchart**: add userUpdateOptions to let user specify update type of charts, fix some animation bug

**🐛 Bug fix**

- **barbackground**: datakey is undefined when set custom datakey fix[#2908](https://github.com/VisActor/VChart/issues/2908)
- **@visactor/vchart**: fix the issue where barMaxWidth does not work when barWidth is configured, fix[#2885](https://github.com/VisActor/VChart/issues/2885)
- **@visactor/vchart**: line/area clip animation by incorrect direction
- **crosshair**: fix bug of crosshair position when legend filter data. fix fix[#2905](https://github.com/VisActor/VChart/issues/2905)
- **@visactor/vchart**: fix polar animation logic for radar charts
- **@visactor/vchart**: type define fix

[more detail about v1.11.7](https://github.com/VisActor/VChart/releases/tag/v1.11.7)

# v1.11.6

2024-06-27

**🐛 Bug fix**

- **@visactor/vchart**: background of chart should support gradient color
- **animation**: rose animation not work when update twice. fix[#2856](https://github.com/VisActor/VChart/issues/2856)
- **@visactor/vchart**: fix the type of `ITooltipTheme`, fix [#2850](https://github.com/VisActor/VChart/issues/2850)
- **@visactor/vchart**: fix the issue of update animation not executed when updateSpec, [#2835](https://github.com/VisActor/VChart/issues/2835) [#2836](https://github.com/VisActor/VChart/issues/2836)

[more detail about v1.11.6](https://github.com/VisActor/VChart/releases/tag/v1.11.6)

# v1.11.5

2024-06-21

**🆕 New feature**

- **@visactor/vchart**: add option `style.align` of Tooltip, support RTL tooltip
- **🐛 Bug fix**

- **@visactor/vchart**: optimize discrete legend pager color in dark theme, related [#2654](https://github.com/VisActor/VChart/issues/2654)
- **@visactor/vchart**: fix the issue issue with stacked waterfall charts where positive and negative values were not stacked separately when there were both positive and negative values in the same stack, fix [#2212](https://github.com/VisActor/VChart/issues/2212)

[more detail about v1.11.5](https://github.com/VisActor/VChart/releases/tag/v1.11.5)

# v1.11.4

2024-06-18

**🐛 Bug fix**

- **@visactor/vchart**: fix bug of `updateSpec` when has `scales`, close [#2744](https://github.com/VisActor/VChart/issues/2744)
- **@visactor/vchart**: gauge chart might throw error when the value is close to its maximum, fix [#2783](https://github.com/VisActor/VChart/issues/2783)
- **@visactor/vchart**: fix the behavior of the gauge pointer when it exceeds the axis range, fix [#2780](https://github.com/VisActor/VChart/issues/2780)
- **@visactor/vchart**: normal animation not work when appear animation is disabled, fix [#2807](https://github.com/VisActor/VChart/issues/2807)
- **@visactor/vchart**: upgrade vrender to 0.19.10, vgrammar to 0.13.9

[more detail about v1.11.4](https://github.com/VisActor/VChart/releases/tag/v1.11.4)

# v1.11.3

2024-06-06

**🆕 New feature**

- **@visactor/vchart**: add option `showBackgroundChart` of DataZoom

**🐛 Bug fix**

- **@visactor/vchart**: bar chart should work normally when x-axis is linear, fix [#2758](https://github.com/VisActor/VChart/issues/2758)
- **@visactor/vchart**: fix issue of continuous legend filter in treemap
- **@visactor/vchart**: fixed the issue that the newly added component type could not take effect when updateSpec
- **@visactor/vchart**: fixed `setSelected` of sankey chart, fix [#2757](https://github.com/VisActor/VChart/issues/2757) , fix [#2765](https://github.com/VisActor/VChart/issues/2765)

[more detail about v1.11.3](https://github.com/VisActor/VChart/releases/tag/v1.11.3)

# v1.11.2

2024-05-30

**🐛 Bug fix**

- **@visactor/vchart**: fix the bug that `animationThreshold` not work, close [#2745](https://github.com/VisActor/VChart/issues/2745)
- **@visactor/vchart**: fix the issue of update animation in area chart is not work
- **common**: bar series support auto band size in common chart. fix[#2704](https://github.com/VisActor/VChart/issues/2704)
- **@visactor/vchart**: corsshair should hide when pointer out view, fix [#2726](https://github.com/VisActor/VChart/issues/2726)
- **@visactor/vchart**: close animation cause by datazoom/scrollbar
- **@visactor/vchart**: \`type-step\` markLine's label should consider the refX/refY/dx/dy set by user, fixed[#2739](https://github.com/VisActor/VChart/issues/2739)
- **react-vchart**: fix the issue of `<Axis />` that the props `id` not work
- **@visactor/vchart**: `polarAxis.grid.smooth` not work in theme configuratio

**🔧 Configuration releated**

- **@visactor/vchart**: when build es5 , `targets` of `@babel/preset-env` should be `defaults`, fix [#2702](https://github.com/VisActor/VChart/issues/2702)

[more detail about v1.11.2](https://github.com/VisActor/VChart/releases/tag/v1.11.2)

# v1.11.1

2024-05-21

**🆕 New feature**
**marker**：mark-point support arc line and targetSymbol.close [#2590](https://github.com/VisActor/VChart/issues/2590)
**@visactor/vchart**：add new options followTooltip to crosshair
**🐛 Bug fix**
**@visactor/vchart**：fix the issue of missing defaultDataIndex in extensionMarks
**@visactor/vchart**：fix error of empty spec, fix[#1193](https://github.com/VisActor/VChart/issues/1193)
**@visactor/vchart**：fix the error caused by renderNextTick after release
**@visactor/vchart**： layout-model should read layoutLevel in spec, and dont create layoutItem for hidden components, related[#1674](https://github.com/VisActor/VChart/issues/1674)
**@visactor/vchart**：when marker's spec update, it should update when call vchart.updateSpec
**@visactor/vchart**：fix effect of sampling when flush is true, fix [#2272](https://github.com/VisActor/VChart/issues/2272)
**@visactor/vchart**：fix the api valueToPositionX and valueToPositionY of sankey
**@visactor/vchart**： sankey should color by seriesField, fix[#2678](https://github.com/VisActor/VChart/issues/2678)
**@visactor/vchart**：fix bug of setDimensionIndex when axis is linear
**@visactor/vchart**：fix issue with import registerTTEnv
**@visactor/vchart**：fix issue with taro tt env, closed[#2648](https://github.com/VisActor/VChart/issues/2648)
**@visactor/vchart**：fix error of call updateFullDataSync() before renderSync(), fix [#2655](https://github.com/VisActor/VChart/issues/2655)
**📖 docs**
**@visactor/vchart**：add custom animate doc
**@visactor/vchart**：perfect document for react-lynx-vchart

[more detail about v1.11.1](https://github.com/VisActor/VChart/releases/tag/v1.11.1)

# v1.11.0

2024-05-08

**🆕 New feature**

- **@visactor/vchart**: support `animation` config of custom-mark
- **@visactor/vchart**: legend should keep unselected when update spec or data, fix [#2531](https://github.com/VisActor/VChart/issues/2531), related [#2443](https://github.com/VisActor/VChart/issues/2443)
- **marker**: marker enhance about state and animation and support polar and geo axis. close[#1165](https://github.com/VisActor/VChart/issues/1165)
- **marker**: add interactive event listener of marker. close[#2248](https://github.com/VisActor/VChart/issues/2248)
- **marker**: add config about custom data of all relative series. close[#2183](https://github.com/VisActor/VChart/issues/2183)
- **@visactor/vchart**: support data update when spec is same in react-vchart
- **@visactor/vchart**: support `softMin` and `softMax` in linear-axis, close [#2498](https://github.com/VisActor/VChart/issues/2498)
- **@visactor/vchart**: add new properties `tooltipSpec` and `tooltipActual` to tooltip event params, related [#2454](https://github.com/VisActor/VChart/issues/2454)
- **@visactor/vchart**: add `othersLine` to customize the the "Others" line content displayed after the tooltip content exceeds the maximum number of displayed lines
- **@visactor/vchart**: the new chart type venn chart, related [#2144](https://github.com/VisActor/VChart/issues/2144)
- **@visactor/vchart**: enhanced capabilities for waterfall chart total label
- **@visactor/vchart**: add api of `clearState()`, `clearSelected()`, `clearHovered()`, fix [#2552](https://github.com/VisActor/VChart/issues/2552)
- **@visactor/vchart**: support `simplify.tolerance` config in `registerMap` API

**🐛 Bug fix**

- **wordCloud**: wordCloud layout error and color scale error when updateData. fix[#2605](https://github.com/VisActor/VChart/issues/2605)'
- **@visactor/vchart**: fix error of position when update viewBox
- **scroll**: scroll not work in ios. fix[#1224](https://github.com/VisActor/VChart/issues/1224)
- **@visactor/vchart**: fix range-column-chart spec
- **marker**: fix mark point position about offset. fix[#2579](https://github.com/VisActor/VChart/issues/2579)
- **@visactor/vchart**: extension-mark should update when data is update
- **@visactor/vchart**: duplicated categoryField data in funnel will result to unexpected rendering result
- **@visactor/vchart**: the x-axis and y-axis of scatter can be band-axis
- **@visactor/vchart**: vchart should not remake of same spec
- **@visactor/vchart**: fixed the problem that when the label of the sankey chart is hidden, an error will be reported when clicking on the blank space
- **@visactor/vchart**: fix the issue of scatter when the legend switch visible encode, close [#2625](https://github.com/VisActor/VChart/issues/2625)
- **@visactor/vchart**: fix the trigger off of default select interactions

**🔨 Refactor**

- **@visactor/vchart**: react-vchart will require component by need by default
- **@visactor/vchart**: remove built-in simplify data transform

**🔧 Configuration releated**

- **@visactor/vchart**: upgrade dependencies

[more detail about v1.11.0](https://github.com/VisActor/VChart/releases/tag/v1.11.0)

# v1.10.6

2024-05-08

**🆕 New feature**

- **@visactor/vchart**: enhanced capabilities for waterfall chart total label

**🐛 Bug fix**

- **wordCloud**: wordCloud layout error and color scale error when updateData. fix [#2605](https://github.com/VisActor/VChart/issues/2605)
- **@visactor/vchart**: fix error of position when update viewBox
- **scroll**: scroll not work in ios. fix[#1224](https://github.com/VisActor/VChart/issues/1224)
- **@visactor/vchart**: fix range-column-chart spec
- **@visactor/vchart**: duplicated categoryField data in funnel will result to unexpected rendering result
- **@visactor/vchart**: fixed the problem that when the label of the sankey chart is hidden, an error will be reported when clicking on the blank space
- **@visactor/vchart**: fix the issue of scatter when the legend switch visible encode, close [#2625](https://github.com/VisActor/VChart/issues/2625)
- **@visactor/vchart**: fix the trigger off of default select interactions

[more detail about v1.10.6](https://github.com/VisActor/VChart/releases/tag/v1.10.6)

# v1.10.5

2024-04-26

**🆕 New feature**

- **@visactor/vchart**: player support play when hidden. feat[#2524](https://github.com/VisActor/VChart/issues/2524)

**🐛 Bug fix**

- **datazoom**: when drag start and end handler outside, min and max span not work. fix[#2559](https://github.com/VisActor/VChart/issues/2559)
- **@visactor/vchart**: fix domain of continuous legend when specify seriesId or seriesIndex
- **@visactor/vchart**: fix eventsBinded update in react-vchart
- **scrollbar**: label position not align with mark. fix[#2534](https://github.com/VisActor/VChart/issues/2534)
- **scrollbar**: enable bubble when scroll to boundary. fix[#2521](https://github.com/VisActor/VChart/issues/2521)
- **@visactor/vchart**: fix error of update theme when series reduce

**⚡ Performance optimization**

- **@visactor/vchart**: optimize the performance of pie chart, fix [#2568](https://github.com/VisActor/VChart/issues/2568)

[more detail about v1.10.5](https://github.com/VisActor/VChart/releases/tag/v1.10.5)

# v1.10.4

2024-04-03

**🆕 New feature**

- **@visactor/vchart**: increase chart stacking capabilities, provide `stackSort` to support sorting when stacking

**🐛 Bug fix**

- **@visactor/vchart**: axis unit in wrong position when hiding the axis domainLine
- **@visactor/vchart**: fix issue of the order of data is not uniform in stack
- **@visactor/vchart**: type defination of markArea & markPoint in common chart
- **@visactor/vchart**: formatMethod of crosshair label runs multiple times (Tip: After fixing it, the process of retaining two decimal places in the crosshair label has been changed to the default formatMethod. After replacing the formatMethod, users will no longer retain decimal places), related [#2501](https://github.com/VisActor/VChart/issues/2501)
- **@visactor/vchart**: crosshair can't move when axis domain is very small, related [#2492](https://github.com/VisActor/VChart/issues/2492)
- **@visactor/vchart**: `updateDataSync` produces inconsistent results compared to direct drawing, related [#2503](https://github.com/VisActor/VChart/issues/2503)

**🔨 Refactor**

- **@visactor/vchart**: add event params `vchart`, which will updated in lifecycle events, close [#2502](https://github.com/VisActor/VChart/issues/2502)

[more detail about v1.10.4](https://github.com/VisActor/VChart/releases/tag/v1.10.4)

# v1.10.3

2024-03-28

**🆕 New feature**

- **@visactor/vchart**: support interaction events of `element-select` and `element-highlight`
- **@visactor/vchart**: support `showDefaultName` in map chart to display unmatched name in map data

**🐛 Bug fix**

- **@visactor/vchart**: tooltip cliped if set border width. fix[#2471](https://github.com/VisActor/VChart/issues/2471)
- **@visactor/vchart**: `lineWidth` is invalid in rect-type-crosshair, related [#2432](https://github.com/VisActor/VChart/issues/2432)
- **@visactor/vchart**: should use `series.getMarkInName` to get the mark for total label's caculation, fixed [#2448](https://github.com/VisActor/VChart/issues/2448)
- **@visactor/vchart**: fix the issue of event trigger count after `updateSpecSync()`
- **@visactor/vchart**: map data will not show if not configured in nameMap
- **@visactor/vchart**: axis label missing in the sampled angle axis, related [#2439](https://github.com/VisActor/VChart/issues/2439)
- **@visactor/vchart**: fix radar chart clipAngle animation error when loading on demand.
- **@visactor/vchart**: fix the release order of \_eventDispatcher
- **@visactor/vchart**: should use series's \_seriesMark to calculate total mark, not all series mark names are the same as series.type

[more detail about v1.10.3](https://github.com/VisActor/VChart/releases/tag/v1.10.3)

# v1.10.2

2024-03-26

## 🆕 New feat

- **@visactor/vchart**: support interaction events of `element-select` and `element-highlight`

## 🐛 Bug fix

- **@visactor/vchart**: `lineWidth` is invalid in rect-type-crosshair, related [#2432](https://github.com/VisActor/VChart/issues/2432)
- **@visactor/vchart**: should use `series.getMarkInName` to get the mark for total label's caculation, fixed [#2448](https://github.com/VisActor/VChart/issues/2448)
- **@visactor/vchart**: fix the issue of event trigger count after `updateSpecSync()`
- **@visactor/vchart**: fix radar chart clipAngle animation error when loading on demand.

[more detail about v1.10.2](https://github.com/VisActor/VChart/releases/tag/v1.10.2)

# v1.10.0

2024-03-13

**🆕 New feature**

- **@visactor/vchart**: bar chart supports `autoBandSize` to automatically calculate bandSize based on the incoming configuration such as `barWidth`, thereby affecting the actual length of the axis, related [#2268](https://github.com/VisActor/VChart/issues/2268)
- **@visactor/vchart**: stacked bar chart supports the config `stackCornerRadius` to configure the corner radius of stacked bar groups, releated [#2185](https://github.com/VisActor/VChart/issues/2185)
- **dataZoom**: enhance when big data and brush releated
- **dataZoom**: add sampler for preview chart
- **@visactor/vchart**: support scrollbar in legend
- **@visactor/vchart**: the theme of the legend supports separate configuration of different themes in different directions, related [#2216](https://github.com/VisActor/VChart/issues/2216)
- **@visactor/vchart**: react-vchart supports custom tooltip render, related [#2288](https://github.com/VisActor/VChart/issues/2288)
- **@visactor/vchart**: theme supports for configuring series themes in stack state, related [#2331](https://github.com/VisActor/VChart/issues/2331)
- **@visactor/vchart**: theme supports custom tokens, related [#2255](https://github.com/VisActor/VChart/issues/2255)
- **@visactor/vchart**: tooltip supports the same `lockAfterClick` as crosshair, related [#2352](https://github.com/VisActor/VChart/issues/2352)
- **@visactor/vchart**: `x` & `y` of the tooltip position can be fixed separately, related [#2320](https://github.com/VisActor/VChart/issues/2320)
- **@visactor/vchart**: add more tooltip shape configs in `tooltip.style` of the chart spec, related [#2292](https://github.com/VisActor/VChart/issues/2292)
- **@visactor/vchart**: state style of arc marks support `innerPadding` and `outerPadding`, related [#2038](https://github.com/VisActor/VChart/issues/2038)
- **@visactor/vchart**: register hover/select interaction by default
- **@visactor/vchart**: remove advanced interaction in simple bundle

**🐛 Bug fix**

- **@visactor/vchart**: enterable tooltip will not hide when mouse moves directly from the tooltip to a non-chart area, related [#2315](https://github.com/VisActor/VChart/issues/2315)
- **@visactor/vchart**: upgrade version of vgrammar to fix end state of animation
- **@visactor/vchart**: `tickMask` is invalid in circular progress charts, related [#2316](https://github.com/VisActor/VChart/issues/2316)
- **@visactor/vchart**: rect crosshair should lock when lockAfterClick is true
- **@visactor/vchart**: when region style is empty, should not create \_backgroundMark or \_foregroundMark
- **@visactor/vchart**: fixed the issue of being unable to listen to customMark events on vchart
- **@visactor/vchart**: grid component should not be pickable expect its children
- **@visactor/vchart**: events on `<Bar />` should not trigged twice
- **@visactor/vchart**: plugin should be released in `release()`

**🔨 Refactor**

- **react-vchart**: refactor react-vchart to support render in strict mode

**🔧 Configuration releated**

- **@visactor/vchart**: use `rimraf` to replace `rm -rf`

[more detail about v1.10.0](https://github.com/VisActor/VChart/releases/tag/v1.10.0)

# v1.9.6

2024-03-11

**🆕 New feature**

- **@visactor/vchart**: support dataKey in CustomMark and ExtensionMark
- **@visactor/vchart**: support mulity data in waterfal total dimensions

**🐛 Bug fix**

- **@visactor/vchart**: `animationAppear: false` not work
- **@visactor/vchart**: fix bug that throws error when setting mark style to invlaid value
- **@visactor/vchart**: fix the issue of duplicate event registration, fixed [#2336](https://github.com/VisActor/VChart/issues/2336)
- **@visactor/vchart**: fixed the issue of being unable to listen to label and totalLabel component events on vchart, `vchart.on('click', { level: 'model', type: 'label' })`
- **@visactor/vchart**: optimize totoal label position when axis is inversed
- **@visactor/vchart**: upgrade vrender to 0.17.27, vgrammar to 0.11.15
- **scrollbar**: click stopped by zoomable. fix[#2333](https://github.com/VisActor/VChart/issues/2333)

[more detail about v1.9.6](https://github.com/VisActor/VChart/releases/tag/v1.9.6)

# v1.9.5

2024-03-04

**🆕 New feature**

- **@visactor/vchart**: support dataKey in CustomMark and ExtensionMark
- **@visactor/vchart**: support mulity data in waterfal total dimensions

**🐛 Bug fix**

- **@visactor/vchart**: `animationAppear: false` not work
- **@visactor/vchart**: optimize totoal label position when axis is inversed

[more detail about v1.9.5](https://github.com/VisActor/VChart/releases/tag/v1.9.5)

# v1.9.3

2024-02-07

**🆕 New feature**

- **@visactor/vchart**: supply pie percent data as `data._percent_`

**🐛 Bug fix**

- **@visactor/vchart**: axis zero not work beacause of collect data. fix[#2226](https://github.com/VisActor/VChart/issues/2226)
- **@visactor/vchart**: marker area xy layout needs to deal with the problem of empty coordinate points
- **player**: default attr leades to layout error. fix[#241](https://github.com/VisActor/VChart/issues/241)
- **@visactor/vchart**: wordcloud support rect shape. fix[#2220](https://github.com/VisActor/VChart/issues/2220)

[more detail about v1.9.3](https://github.com/VisActor/VChart/releases/tag/v1.9.3)

# v1.9.2

2024-02-05

**🐛 Bug fix**

- **@visactor/vchart**: bar label issue when position is 'inside-bottom' or 'inside-top'
- **@visactor/vchart**: in block-vchart demo, the `dpr` acquisition method is wrong and needs to be obtained in real time
- **@visactor/vchart**: series can read `direction` from chart spec, releated to [#2181](https://github.com/VisActor/VChart/issues/2181)
- **@visactor/vchart**: dataZoom min and max span does not effect, related [#2195](https://github.com/VisActor/VChart/issues/2195)
- **@visactor/vchart**: fix the problem that multi-layer axis labels are not displayed after closing tail labels, related [#2179](https://github.com/VisActor/VChart/issues/2179)
- **@visactor/vchart**: fix polar animation interpolation
- **@visactor/react-vchart**: fix the error when `onClick` of `<VChart />` is null, close [#2186](https://github.com/VisActor/VChart/issues/2186)
- **@visactor/vchart**: charts should not stack toggle when series has same type but differernt axes, related [#2210](https://github.com/VisActor/VChart/issues/2210)
- **@visactor/vchart**: there is some offset in the position of the dom tooltip shape, related [#2188](https://github.com/VisActor/VChart/issues/2188)

**🔧 Configuration releated**

- **@visactor/vchart**: add react-lynx doc

[more detail about v1.9.2](https://github.com/VisActor/VChart/releases/tag/v1.9.2)

# v1.9.1

2024-01-31

**🐛 Bug fix**

- **@visactor/vchart**: custom mark should run after all the series marks, fix [#2156](https://github.com/VisActor/VChart/issues/2156)
- **@visactor/vchart**: interactions should be closed by `option.disableTriggerEvent`
- **@visactor/vchart**: in the case of multiple band axes in a chart, the same datum corresponds to multiple rows of dimension tooltip content, related [#2148](https://github.com/VisActor/VChart/issues/2148)
- **@visactor/vchart**: fix error of vchart in strict-mode
- **@visactor/vchart**: fix the zero-align of axes, fix [#2167](https://github.com/VisActor/VChart/issues/2167)

[more detail about v1.9.1](https://github.com/VisActor/VChart/releases/tag/v1.9.1)

# v1.9.0

2024-01-26

**🆕 New feature**

- **@visactor/vchart**: axis supports `hasDimensionTooltip` for force specification of dimension tooltip, related [#1678](https://github.com/VisActor/VChart/issues/1678)
- **@visactor/vchart**: `triggerOff` of crosshair support number to close crosshair by setTimeout, fix [#1676](https://github.com/VisActor/VChart/issues/1676)
- **@visactor/vchart**: the `barBackground` mark in the bar chart supports `fieldLevel` config to indicate whether the `barBackground` mark is displayed at the group level and at which level it is displayed, related [#1601](https://github.com/VisActor/VChart/issues/1601)
- **@visactor/vchart**: histogram chart supports bar background, related [#1979](https://github.com/VisActor/VChart/issues/1979)
- **@visactor/vchart**: support fitStrategy for indicator
- **liquid**: liquid chart. close[#1158](https://github.com/VisActor/VChart/issues/1158)
- **@visactor/vchart**: band type axis supports multi-layer axis label display
- **@visactor/vchart**: support separately configuring interactive for line/area mark in area chart, see [#1592](https://github.com/VisActor/VChart/issues/1592)
- **@visactor/vchart**: support `stateSort` of mark, fix [#2003](https://github.com/VisActor/VChart/issues/2003)
- **@visactor/vchart**: support customized vrender component in extensionMark
- **@visactor/vchart**: split tooltip handler into plugins for on-demand importing, related [#1397](https://github.com/VisActor/VChart/issues/1397)

**🐛 Bug fix**

- **@visactor/vchart**: fix the bug of crosshair trigger when hover and click are both configed, fix [#1574](https://github.com/VisActor/VChart/issues/1574)
- **@visactor/vchart**: tooltip supports content area scrolling, related [#2001](https://github.com/VisActor/VChart/issues/2001)
- **@visactor/vchart**: remove label line height in default themes, related [#1983](https://github.com/VisActor/VChart/issues/1983)
- **@visactor/vchart**: fix the issue where tooltip content callbacks may not be effective in certain situations, related [#1943](https://github.com/VisActor/VChart/issues/1943)

**🔨 Refactor**

- **@visactor/vchart**: deprecated `useSyncRender` in react-vchart

[more detail about v1.9.0](https://github.com/VisActor/VChart/releases/tag/v1.9.0)

# v1.8.10

2024-01-25

**🆕 New feature**

- **@visactor/vchart**: support innerOffset in vchart cartesian axis

**🐛 Bug fix**

- **@visactor/vchart**: fix issue of continous color scale, close [#2131](https://github.com/VisActor/VChart/issues/2131)
- **@visactor/vchart**: dont return min,max of empty data, fix [#1711](https://github.com/VisActor/VChart/issues/1711)
- **@visactor/vchart**: fixed polar coordinate relative axis tickValues acquisition error problem, fixed[#2117](https://github.com/VisActor/VChart/issues/2117)
- **@visactor/vchart**: fix the issue mark line is not filter by legend, close [#2127](https://github.com/VisActor/VChart/issues/2127)
- **@visactor/vchart**: sequence chart region bind error. fix[#2115](https://github.com/VisActor/VChart/issues/2115)
- **@visactor/vchart**: star shapes on dom tooltip do not display correctly, related [#1905](https://github.com/VisActor/VChart/issues/1905)
- **@visactor/vchart**: treemap drill event error
- **@visactor/vchart**: treemap drill error when turn off the animation

[more detail about v1.8.10](https://github.com/VisActor/VChart/releases/tag/v1.8.10)

# v1.8.9

2024-01-23

**🆕 New feature**

- **@visactor/vchart**: support supportsTouchEvents and supportsPointerEvents config
- **@visactor/vchart**: support `alignSelf` of layout `normal-inline` elements, fix [#2072](https://github.com/VisActor/VChart/issues/2072)
- **@visactor/vchart**: upgrade vrender

**🐛 Bug fix**

- **@visactor/vchart**: fix bug of crosshair timer, fix [#2088](https://github.com/VisActor/VChart/issues/2088)
- **@visactor/vchart**: fix the bugs of axis's onZero property, fixed [#2098](https://github.com/VisActor/VChart/issues/2098),[#2099](https://github.com/VisActor/VChart/issues/2099)
- **@visactor/vchart**: update animation should exludes `defined` channel

[more detail about v1.8.9](https://github.com/VisActor/VChart/releases/tag/v1.8.9)

# v1.8.8

2024-01-19

**🆕 New feature**

- **@visactor/vchart**: enhance scroll effect, closed [#2037](https://github.com/VisActor/VChart/issues/2037)
- **@visactor/vchart**: upgrade @visactor/vrender-core to locked 0.17.14
- **@visactor/vchart**: sankey chart supports disableTriggerEvent configuration
- **@visactor/vchart**: support new layout type region-relative-overlap

**🐛 Bug fix**

- **@visactor/vchart**: `area.interactive` in area series spec is not available, related [#2030](https://github.com/VisActor/VChart/issues/2030)
- **@visactor/vchart**: fix sortDataByAxis not work after datazoom changed axis
- **@visactor/vchart**: crosshair should show when `trimPadding` of axis is true, fix [#2054](https://github.com/VisActor/VChart/issues/2054)
- **@visactor/vchart**: calculate layer transform for dimension tooltip
- **@visactor/vchart**: fixed the issue where activePoint does not take effect when the visible configuration of line chart point is false
- **@visactor/vchart**: different effect when configuring label.overlap:true in [#1956](https://github.com/VisActor/VChart/issues/1956)
- **@visactor/vchart**: label position incorrect with region indent
- **scroll**: event error in lynx env. fix[#2041](https://github.com/VisActor/VChart/issues/2041)
- **@visactor/vchart**: map scale ratio not correct after updateSpec or resize
- **@visactor/vchart**: fix the bug of nice when tickCount is a function, fix [#2050](https://github.com/VisActor/VChart/issues/2050)

[more detail about v1.8.8](https://github.com/VisActor/VChart/releases/tag/v1.8.8)

# v1.8.7

2024-01-11

**🆕 New feature**

- **markPoint**: mark point support item content confine. fix [#1573](https://github.com/VisActor/VChart/issues/1573)
- **@visactor/vchart**: support indent in region layout

**🐛 Bug fix**

- **@visactor/vchart**: mark tooltip not work in rangeColumn chart, closes [#1959](https://github.com/VisActor/VChart/issues/1959)
- **brush**: hover not effect when draw a small brush. fix[#1985](https://github.com/VisActor/VChart/issues/1985)
- **@visactor/vchart**: fix the problem that indent.top cannot take effect normally
- **@visactor/vchart**: the crosshair should only be triggered when the point is in some x-axis and y-axis, fix [#1954](https://github.com/VisActor/VChart/issues/1954)
- **@visactor/vchart**: fixed the issue where legend filtering fails after customizing data for discrete legends, fixed [#1994](https://github.com/VisActor/VChart/issues/1994)
- **@visactor/vchart**: range column chart's `barMinHeight` property does not take effect, closed[#1999](https://github.com/VisActor/VChart/issues/1999)
- **@visactor/vchart**: tooltip value is stacked in stacked radar charts, related [#450](https://github.com/VisActor/VChart/issues/450)
- **@visactor/vchart**: fix the onebyone symbol animation order, closes [#1932](https://github.com/VisActor/VChart/issues/1932)

[more detail about v1.8.7](https://github.com/VisActor/VChart/releases/tag/v1.8.7)

# v1.8.5

2024-01-04

**🆕 New feature**

- **@visactor/vchart**: add zAxis theme and set label space to 0, closed [#149](https://github.com/VisActor/VChart/issues/149)

**🐛 Bug fix**

- **@visactor/vchart**: compute layer translate for crosshair
- **@visactor/vchart**: optimize funnel clip animation without extensionMarks
- **@visactor/vchart**: fix the hover state of multiple series, close [#1899](https://github.com/VisActor/VChart/issues/1899)
- **@visactor/vchart**: waterfall.label not work in [#1897](https://github.com/VisActor/VChart/issues/1897)

[more detail about v1.8.5](https://github.com/VisActor/VChart/releases/tag/v1.8.5)

# v1.8.4

2024-01-02

**🐛 Bug fix**

- **@visactor/vchart**: add media query spec interface to default chart spec
- **@visactor/vchart**: fix the bug of extension mark when no valid animation, fix [#1877](https://github.com/VisActor/VChart/issues/1877)

[more detail about v1.8.4](https://github.com/VisActor/VChart/releases/tag/v1.8.4)

# v1.8.3

2024-01-02

**🆕 New feature**

- **@visactor/vchart**: add props `useSyncRender` to react-vchart, close [#1685](https://github.com/VisActor/VChart/issues/1685)
- **@visactor/vchart**: Supports the initialization parameter `disableTriggerEvent` to turn off the default interactive effect of the chart

**🐛 Bug fix**

- **@visactor/vchart**: chart option.animation not work
- **@visactor/vchart**: fix error in strict mode of react-vchart, fix [#1669](https://github.com/VisActor/VChart/issues/1669)
- **@visactor/vchart**: error in chart level modification of media query action
- **@visactor/vchart**: dimension tooltip in the dual-dimension chart contains data of only one dimension, related [#1841](https://github.com/VisActor/VChart/issues/1841)
- **@visactor/vchart**: fix bug in layout when band axis has no domain
- **@visactor/vchart**: funnel clipIn animation has delay for marks which overflows the range of region in [#1839](https://github.com/VisActor/VChart/issues/1839)
- **@visactor/vchart**: when marker label's padding is an object, it should work
- **@visactor/vchart**: undefined globalThis in tt miniprogram, see [#1854](https://github.com/VisActor/VChart/issues/1854)
  **🔨 Refactor**
- **@visactor/vchart**: optimize the style configuration of marker

[more detail about v1.8.3](https://github.com/VisActor/VChart/releases/tag/v1.8.3)

# v1.8.2

2023-12-22

**🆕 feat**

- **@visactor/vchart**: Supports the initialization parameter `disableTriggerEvent` to turn off the default interactive effect of the chart

**🐛 fix**

- **@visactor/vchart**: Config `animation` in the chart option doesn't work
- **@visactor/vchart**: Error in chart level modification of media query action

[more detail about v1.8.2](https://github.com/VisActor/VChart/releases/tag/v1.8.2)

# v1.8.1

2023-12-21

**🐛 fix**

- **@visactor/vchart**: improve the stability of spec transformer and media query
- **@visactor/vchart**: `select.triggerOff: none` not work

[more detail about v1.8.1](https://github.com/VisActor/VChart/releases/tag/v1.8.1)

# v1.8.0

2023-12-19

**🆕 feat**

- **@visactor/vchart**: add getPoints api in funnel mark attribute context
- **@visactor/vchart**: vchart supports chart-level plugin, related [#1784](https://github.com/VisActor/VChart/issues/1784)
- **@visactor/vchart**: new media query plugin to support self-adaptive charts, related [#1413](https://github.com/VisActor/VChart/issues/1413)
- **@visactor/vchart**: support optimize config, and auto set disableCheckGraphicWidthOutRange to true
- **@visactor/vchart**: remove legacy theme for legends

**🐛 fix**

- **@visactor/vchart**: fix the api: `getComponentsByKey` not work
- **@visactor/vchart**: animation support for gauge pointer series, related [#1699](https://github.com/VisActor/VChart/issues/1699)
- **@visactor/vchart**: fix issue with secondary dataflow, closed [#1760](https://github.com/VisActor/VChart/issues/1760)

**🔨 refactor**

- **@visactor/vchart**: update datazoom and brush updatecallback, use event

**⚡ perf**

- **@visactor/vchart**: when visible is false, dont parse detail attrs

[more detail about v1.8.0](https://github.com/VisActor/VChart/releases/tag/v1.8.0)

# v1.7.5

2023-12-15

**🐛 fix**

- **brush**: brush release error after update spec. fix[#1720](https://github.com/VisActor/VChart/issues/1720)
- **@visactor/vchart**: series should pick `morph` config in chart
- **@visactor/vchart**: fix type defination of vchart spec in [#1486](https://github.com/VisActor/VChart/issues/1486)

[more detail about v1.7.5](https://github.com/VisActor/VChart/releases/tag/v1.7.5)

# v1.7.4

2023-12-12

**🆕 feat**

- **@visactor/vchart**: support interaction group in region

**🐛 fix**

- **@visactor/vchart**: label style not update when change current theme in [#1698](https://github.com/VisActor/VChart/issues/1698)

[more detail about v1.7.4](https://github.com/VisActor/VChart/releases/tag/v1.7.4)

# v1.7.3

2023-12-06

**🆕 feat**

- **@visactor/vchart**: marker supports `coordinatesOffset` for points adjusting
- **@visactor/vchart**: markLine supports x,y,y1 y,x,x1 and x,y,x1,y1 position
- **@visactor/vchart**: markPoint support xy position
- **@visactor/vchart**: marker's position property support relative coordinate
- **@visactor/vchart**: marker's coordinate property supports callback
- **@visactor/vchart**: cartesion crosshair's rect width support callback, support [#1567](https://github.com/VisActor/VChart/issues/1567)
- **@visactor/vchart**: polar crosshair supports default show
- **@visactor/vchart**: support text omission position configuration `suffixPosition`
- **@visactor/vchart**: supports `pickStrokeBuffer` style attribute for extending the stroke picking range

**🐛 fix**

- **@visactor/vchart**: fix 3d bar chart with seriesField issue, closed [#1646](https://github.com/VisActor/VChart/issues/1646)
- **@visactor/vchart**: fix 3d chart z axis not work noamally issue, closed [#1668](https://github.com/VisActor/VChart/issues/1668)
- **@visactor/vchart**: clear old encode when update, fix [#1630](https://github.com/VisActor/VChart/issues/1630)
- **@visactor/vchart**: fix the problem that track mark has multiple elements in gauge series, related [#1643](https://github.com/VisActor/VChart/issues/1643)
- **@visactor/vchart**: fix the problem that gaugePointer series doesn't support custom `innerRadius`, related [#1644](https://github.com/VisActor/VChart/issues/1644)
- **@visactor/vchart**: fix the type error of markArea
- **@visactor/vchart**: the outerBorder's color should be equal with labelBackground's fill by default
- **@visactor/vchart**: fix oneByOne loop animation
- **@visactor/vchart**: add `align` property for size legend, and fix the issue of the attribute assignment does not take effect, related [#1553](https://github.com/VisActor/VChart/issues/1553)

**🔨 refactor**

- **@visactor/vchart**: unify `getVRenderComponents` method in Component model

**⚡ perf**

- **@visactor/vchart**: only call `cloneDeepSpec()` when need

[more detail about v1.7.3](https://github.com/VisActor/VChart/releases/tag/v1.7.3)

# v1.7.2

2023-11-30

**🐛 fix**

- **@visactor/vchart**: clear old encode when update, fix [#1630](https://github.com/VisActor/VChart/issues/1630)
- **@visactor/vchart**: fix the problem that track mark has multiple elements in gauge series, related [#1643](https://github.com/VisActor/VChart/issues/1643)
- **@visactor/vchart**: fix the problem that gaugePointer series doesn't support custom `innerRadius`, related [#1644](https://github.com/VisActor/VChart/issues/1644)

**🔨 refactor**

- **@visactor/vchart**: unify `getVRenderComponents` method in Component model

[more detail about v1.7.2](https://github.com/VisActor/VChart/releases/tag/v1.7.2)

# v1.7.1

2023-11-30

**🐛 fix**

- **@visactor/vchart**: read dataview of extension-mark by `dataId`
- **@visactor/vchart**: fixed the issue where the layout size of the axis is incorrect when only domainLine is displayed
- **@visactor/vchart**: fix bug of changed spec when create series
- **pie**: get center error. fix [#1610](https://github.com/VisActor/VChart/issues/1610)
- **@visactor/vchart**: optimize the effect of `tooltip.enterable` that user's pointer can easily enter the tooltip, related [#1598](https://github.com/VisActor/VChart/issues/1598)

[more detail about v1.7.1](https://github.com/VisActor/VChart/releases/tag/v1.7.1)

# v1.7.0

2023-11-24

**🆕 feat**

- **@visactor/vchart**: support `trimPadding` for band type axis, which used to remove the blank space at both ends of the aixs, closed [#1174](https://github.com/VisActor/VChart/issues/1174)
- **@visactor/vchart**: custom mark support animation config
- **@visactor/vchart**: support customShape of mark
- **@visactor/vchart**: optimize auto mode of data-zoom, related [#1416](https://github.com/VisActor/VChart/issues/1416)
- **@visactor/vchart**: enhance marker's position ability
- **@visactor/vchart**: mark area should support specify x x1 y and y1 both
- **@visactor/vchart**: add light-mobile and dark-mobile theme, related [#1414](https://github.com/VisActor/VChart/issues/1414)
- **@visactor/vchart**: optmize performance of computing data
- **@visactor/vchart**: support none in component layoutType
- **@visactor/vchart**: support line/area label
- **@visactor/vchart**: no longer register mobile theme in vchart
- **@visactor/vchart**: feature: supports registered function expression syntax, related [#1187](https://github.com/VisActor/VChart/issues/1187)

**🐛 fix**

- **@visactor/vchart**: chart padding won't update when switching global theme
- **@visactor/vchart**: fix spec modified unexpectedly in data model, details in [#1514](https://github.com/VisActor/VChart/issues/1514)
- **@visactor/vchart**: update enableSegements implemention

**🔨 refactor**

- **@visactor/vchart**: refactor the inheritance structure of the chart module to make the layout system independent, details in [#1428](https://github.com/VisActor/VChart/issues/1428)

**⚡ perf**

- **@visactor/vchart**: dont need to call `attrTransform()` in compilable-mark
- **@visactor/vchart**: remove getStatisticsDomain()
- **@visactor/vchart**: dont call bounds calculate when user specify width/height of components

[more detail about v1.7.0](https://github.com/VisActor/VChart/releases/tag/v1.7.0)

# v1.6.7

2023-11-21

**🐛 fix**

- **@visactor/wx-vchart**: fixed package delivery error issue, fixed [#1570](https://github.com/VisActor/VChart/issues/1570) , PR in [#1571](https://github.com/VisActor/VChart/pull/1571)

[more detail about v1.6.7](https://github.com/VisActor/VChart/releases/tag/v1.6.7)

# v1.6.6

2023-11-21

**🐛 fix**

- **@visactor/vchart**: fix chart screen remains when using updateSpecSync, details in [#1421](https://github.com/VisActor/VChart/issues/1421)
- **@visactor/vchart**: is mouse click in empty region, the hover shape should reset, fixed [#1538](https://github.com/VisActor/VChart/issues/1538)

[more detail about v1.6.6](https://github.com/VisActor/VChart/releases/tag/v1.6.6)

# v1.6.5

2023-11-17

**🆕 feat**

- **@visactor/vchart**: add `skipFunctionDiff` in react-vchart to skip difference of functions

**🐛 fix**

- **@visactor/vchart**: dimension click not effect after update spec. fix [#1532](https://github.com/VisActor/VChart/issues/1532)

[more detail about v1.6.5](https://github.com/VisActor/VChart/releases/tag/v1.6.5)

# v1.6.4

2023-11-16

**🐛 fix**

- **@visactor/vchart**: fixed the problem of unreasonable automatic indentation being triggered after modifying the axis range in datazoom
- **@visactor/vchart**: default realtime not effect in scrollbar and datazoom. fix [#1462](https://github.com/VisActor/VChart/issues/1462)
- **@visactor/vchart**: filter mode error when roam in scrollbar and datazoom. fix [#1460](https://github.com/VisActor/VChart/issues/1460)
- **@visactor/lark-vchart**: fix `options` can not work in lark-vchart, wx-vchart
- **@visactor/wx-vchart**: fix `options` can not work in lark-vchart, wx-vchart
- **@visactor/vchart**: `legendItemHover` and `legendItemUnHover` should trigger once, https://github.com/VisActor/VRender/pull/678

**⚡ perf**

- **@visactor/vchart**: optimize the dataflow of sankey

[more detail about v1.6.4](https://github.com/VisActor/VChart/releases/tag/v1.6.4)

# v1.6.3

2023-11-10

**🐛 fix**

- **@visactor/vchart**: fix the issue of update animation not work for line mark
- **@visactor/vchart**: update vgrammar to ~0.8.3 to fix the issue that, vrender should not auto render during renderAsync
- **@visactor/vchart**: fix the error when quick release vchart during async render
- **@visactor/vchart**: tooltip value is forced to wrap when the user globally configures css overflow-warp, related [#1446](https://github.com/VisActor/VChart/issues/1446)
- **@visactor/vchart**: fix: svg model's id should be uniq, fixed [#1422](https://github.com/VisActor/VChart/issues/1422), [#1442](https://github.com/VisActor/VChart/issues/1442)
- **@visactor/vchart**: fix: empty string should not be a valid number, fix [#1463](https://github.com/VisActor/VChart/issues/1463)

**⚡ perf**

- **@visactor/vchart**: optimize the encode performance of sankey

[more detail about v1.6.3](https://github.com/VisActor/VChart/releases/tag/v1.6.3)

# v1.6.2

2023-11-08

**🐛 fix**

- **@visactor/vchart**: tooltip value is forced to wrap when the user globally configures css overflow-warp, related [#1446](https://github.com/VisActor/VChart/issues/1446)

[more detail about v1.6.2](https://github.com/VisActor/VChart/releases/tag/v1.6.2)

# v1.6.1

2023-11-08

**🆕 feat**

- **@visactor/vchart**: label formatMethod callback add context parmas to provide series object
- **@visactor/vchart**: add components `<Title />` and `<Indicator />` of react-vchart, close [#1424](https://github.com/VisActor/VChart/issues/1424)

**🐛 fix**

- **@visactor/vchart**: `centroidProperty` not work in map chart
- **@visactor/vchart**: fix incorrect legend filter result caused by animation in [#1403](https://github.com/VisActor/VChart/issues/1403)
- **@visactor/vchart**: if layout item is invisible, do not participate in grid layout, related [#1425](https://github.com/VisActor/VChart/issues/1425)
- **@visactor/vchart**: aggregation return value infinity problem. fix[#1380](https://github.com/VisActor/VChart/issues/1380)'

[more detail about v1.6.1](https://github.com/VisActor/VChart/releases/tag/v1.6.1)

# v1.6.0

2023-11-03

**🆕 feat**

- **@visactor/vchart**: add bar background mark for bar-like series, related [#1154](https://github.com/VisActor/VChart/issues/1154)
- **@visactor/vchart**: add `updateElement` callback in tooltip spec to configure custom tooltip DOM elements based on the default tooltip handler, related [#1338](https://github.com/VisActor/VChart/issues/1338)
- **@visactor/vchart**: enable exit animation while updating data
- **@visactor/vchart**: support functional label.position config in line/area/scatter/bar series
- **@visactor/vchart**: load browser or node env code dynamically
- **@visactor/vchart**: dataScheme supports configuration by distinguishing series directions, related [#1209](https://github.com/VisActor/VChart/issues/1209)
- **@visactor/vchart**: data sampling & point overlap. close [#460](https://github.com/VisActor/VChart/issues/460)
- **@visactor/taro-vchart**: support weapp

**🐛 fix**

- **@visactor/vchart**: react-vchart mode not work
- **@visactor/vchart**: optimize the trigger of hover in non-browser env
- **@visactor/vchart**: if series mark is line, return stroke value when user want fill value, fixed [#1388](https://github.com/VisActor/VChart/issues/1388)
- **@visactor/vchart**: fix the angle offset in rose dimension tooltip, related [#1263](https://github.com/VisActor/VChart/issues/1263)

**⚡ perf**

- **@visactor/vchart**: create Stack and calculate stack attributes when need

[more detail about v1.6.0](https://github.com/VisActor/VChart/releases/tag/v1.6.0)

# v1.5.4

2023-10-30

**🐛 fix**

- **@visactor/vchart**: unexpected funnel transform ratio label, see [#1348](https://github.com/VisActor/VChart/issues/1348)
- **@visactor/vchart**: tooltip value label clipped on lark mini app, related [#1346](https://github.com/VisActor/VChart/issues/1346)

[more detail about v1.5.4](https://github.com/VisActor/VChart/releases/tag/v1.5.4)

# v1.5.3

2023-10-27

**🆕 feat**

- **@visactor/vchart**: support the exportCanvas api of vchart

**🐛 fix**

- **@visactor/vchart**: sankey chart downstream highlight, related [#1269](https://github.com/VisActor/VChart/issues/1269)
- **@visactor/vchart**: slove first select not effect problem. fix [#1129](https://github.com/VisActor/VChart/issues/1129)
- **@visactor/vchart**: new layout method for circle axis label, related [#1123](https://github.com/VisActor/VChart/issues/1123)
- **@visactor/vchart**: change default zIndex of axis in gauge chart, related [#1122](https://github.com/VisActor/VChart/issues/1122)
- **@visactor/vchart**: datazoom location error when resize. fix [#520](https://github.com/VisActor/VChart/issues/520)
- **@visactor/vchart**: slove event off error after release
- **@visactor/vchart**: fix the issue where invalidType of scatter chart checks x and y at the same time
- **@visactor/vchart**: fix the issue in markline as min/max aggr result is not correct, see [#1261](https://github.com/VisActor/VChart/issues/1261)
- **@visactor/vchart**: fix: fix the issue that the map tooltip title does not display the name from nameMap, see [#1260](https://github.com/VisActor/VChart/issues/1260)
- **@visactor/vchart**: sankey supports string value
- **@visactor/vchart**: fix the issue of crosshair can not trigger in weapp, fixed [#1322](https://github.com/VisActor/VChart/issues/1322)

[more detail about v1.5.3](https://github.com/VisActor/VChart/releases/tag/v1.5.3)

# v1.5.2

2023-10-24

**🆕 feat**

- **@visactor/vchart**: support the exportCanvas api of vchart

**🐛 fix**

- **@visactor/vchart**: new layout method for circle axis label, related [#1123](https://github.com/VisActor/VChart/issues/1123)
- **@visactor/vchart**: change default zIndex of axis in gauge chart, related [#1122](https://github.com/VisActor/VChart/issues/1122)
- **@visactor/vchart**: datazoom location error when resize. fix [#520](https://github.com/VisActor/VChart/issues/520)
- **@visactor/vchart**: fix the issue in markline as min/max aggr result is not correct, see [#1261](https://github.com/VisActor/VChart/issues/1261)
- **@visactor/vchart**: fix: fix the issue that the map tooltip title does not display the name from nameMap, see [#1260](https://github.com/VisActor/VChart/issues/1260)

[more detail about v1.5.2](https://github.com/VisActor/VChart/releases/tag/v1.5.2)

# v1.5.1

2023-10-20

**🆕 feat**

- **@visactor/vchart**: support correlation Chart
- **@visactor/vchart**: add getGraphicBounds api in layoutItem to support get graphic size
- **@visactor/vchart**: optimize the autoindent logic in layout to ensure padding effect is correct
- **@visactor/vchart**: support `centroidProperty` in map series
- **@visactor/vchart**: scrollbar enhance zoom & drag & scroll. close [#965](https://github.com/VisActor/VChart/issues/965)
- **@visactor/vchart**: datazoom enhance zoomLock & span config. close [#1082](https://github.com/VisActor/VChart/issues/1082)
- **@visactor/vchart**: supply the attributeContext params for customMark's attribute callback
- **@visactor/vchart**: provide afterLayout event to support users to modify layout effects
- **@visactor/vchart**: provide datum in the params of `updateContent` callback of tooltip, related [#1244](https://github.com/VisActor/VChart/issues/1244)
- **@visactor/vchart**: add the default theme (light, dark) of markLine, markArea and funnel series
- **@visactor/vchart**: support load environment code on demand

**🐛 fix**

- **@visactor/vchart**: optimized the display of `padAngle` in the gauge series and changed the unit of `padAngle` to angle, related [#1215](https://github.com/VisActor/VChart/issues/1215)
- **@visactor/vchart**: link 'adjacency' interaction highlighting effect of Sankey Chart is wrong, [#1121](https://github.com/VisActor/VChart/issues/1121)
- **@visactor/vchart**: fix the issue of boxplot outlier animation will throw error
- **@visactor/vchart**: fix the duplicate event registration in scrollbar, fixed[#1241](https://github.com/VisActor/VChart/issues/1241)

**🔨 refactor**

- **@visactor/vchart**: add register function for chart/series/component to collect side effect code
- **@visactor/vchart**: add register function for animation

[more detail about v1.5.1](https://github.com/VisActor/VChart/releases/tag/v1.5.1)

# v1.4.3

2023-10-17

**🆕 feat**

- **@visactor/vchart**: brush state proxy to state spec

**🐛 fix**

- **@visactor/vchart**: fix when the legend item only has stroke it cannot be consistent with the graphic color, details in [#1147](https://github.com/VisActor/VChart/issues/1147)

[more detail about v1.4.3](https://github.com/VisActor/VChart/releases/tag/v1.4.3)

# v1.4.2

2023-10-12

**🆕 feat**

- **@visactor/vchart**: gauge series supports label component, related [#1039](https://github.com/VisActor/VChart/issues/1039)
- **@visactor/vchart**: add static tools in `VChart.Utils`
- **@visactor/vchart**: supports afterResize and afterRender events
- **@visactor/vchart**: add new config `autoWidth` to the tooltip label style, related [#688](https://github.com/VisActor/VChart/issues/688)

**🐛 fix**

- **@visactor/vchart**: `tooltipRelease` event may be invalid when being released by VTable
- **@visactor/vchart**: select error when setting brush. fix [#1129](https://github.com/VisActor/VChart/issues/1129)
- **@visactor/vchart**: optimize the default performance of the long tooltip title, related [#688](https://github.com/VisActor/VChart/issues/688)
- **@visactor/vchart**: if `markLine` is empty like `{}` or `[]`, it should not create marker component
- **@visactor/vchart**: fix the issue when use `positions` to create marker component, fixed [#1084](https://github.com/VisActor/VChart/issues/1084)
- **@visactor/vchart**: auto visible with linear axis. fix [#1118](https://github.com/VisActor/VChart/issues/1118)

[more detail about v1.4.2](https://github.com/VisActor/VChart/releases/tag/v1.4.2)

# v1.4.1

2023-09-27

**🆕 feat**

- **@visactor/vchart**: optimize updateSpec to avoid additional theme updates

**🐛 fix**

- **@visactor/vchart**: fix updateViewBox api will fail after resize
- **datazoom**: fix bounds error when there is no preview chart. fix [#1050](https://github.com/VisActor/VChart/issues/1050)
- **@visactor/vchart**: the rose chart's first sector's startAngle should start from polar coordinate's startAngle, fix [#900](https://github.com/VisActor/VChart/issues/900)
- **@visactor/vchart**: fix `theme.fontFamily` can not work
- **@visactor/vchart**: fix the problem that updateFullData cannot update data in series

[more detail about v1.4.1](https://github.com/VisActor/VChart/releases/tag/v1.4.1)

# v1.4.0

2023-09-25

**🆕 feat**

- **@visactor/vchart**: add scrollbar layout spec to sequence. close [#792](https://github.com/VisActor/VChart/issues/792)
- **@visactor/vchart**: linear axis support `tooltipFilterRange` to configure the relative data range of dimension tooltip, related [#933](https://github.com/VisActor/VChart/issues/933)
- **@visactor/vchart**: add vchart to context in params of mark function style
- **@visactor/vchart**: add default dark theme for scrollBar
- **@visactor/vchart**: add configure items `bandSize`, `maxBandSize`, `minBandSize` to the spec of band axis, related [#263](https://github.com/VisActor/VChart/issues/263)
- **@visactor/vchart**: support `barMinHeight` for bar series, relate [#722](https://github.com/VisActor/VChart/issues/722)
- **@visactor/vchart**: enhance default wordcloud appear animation, details in [#675](https://github.com/VisActor/VChart/issues/675)
- **@visactor/vchart**: tick mask support for polar progress-like charts, related [#596](https://github.com/VisActor/VChart/issues/596)
- **@visactor/vchart**: pie label line support smooth
- **@visactor/vchart**: support custom callback for tickCount, see [#951](https://github.com/VisActor/VChart/issues/951)
- **@visactor/vchart**: support `label.confine` for markLine and markPoint to auto adjust label's position, relate https://github.com/VisActor/VChart/issues/699
- **@visactor/vchart**: support `minAngle` for pie chart, relate [#738](https://github.com/VisActor/VChart/issues/738)
- **@visactor/vchart**: disable label animation as default in map series
- **@visactor/vchart**: increase chart stacking capabilities, provide stackValue to support independent stacking of multiple series
- **@visactor/vchart**: increase chart stacking capabilities, provide stackInverse support for stacking in reverse order
- **@visactor/vchart**: support `scaleCenter` attribute for mark, see [#781](https://github.com/VisActor/VChart/issues/781)
- **@visactor/vchart**: provide updateModelSpec api, so that users can update the configuration of a chart module individually
- **@visactor/vchart**: supports deleting all events of the corresponding type without passing through the handler when calling off
- **@visactor/vchart**: tooltip supports custom shape type, related [#496](https://github.com/VisActor/VChart/issues/496)
- **@visactor/vchart**: tooltip supports custom `spaceRow` for each line, related [#949](https://github.com/VisActor/VChart/issues/949)
- **@visactor/vchart**: tooltip supports custom fixed position relative to the cursor, related [#541](https://github.com/VisActor/VChart/issues/541)
- **@visactor/vchart**: fix issue about updateSpec not work with only data change, details in [#912](https://github.com/VisActor/VChart/issues/912)
- **@visactor/vchart**: support wx env
- **@visactor/vchart**: remove compatibility code of threshold
- **@visactor/vchart**: access label in map series

**🐛 fix**

- **@visactor/vchart**: when stack is false and no `fieldX2` or `fieldY2`, `dataToPositionX1` and `dataToPositionY1` should use 0, close [#647](https://github.com/VisActor/VChart/issues/647)
- **@visactor/vchart**: label stroke should follow default color when stroke is set to null, detail see [#985](https://github.com/VisActor/VChart/issues/985)
- **@visactor/vchart**: `offsetX` and `offsetY` can not work in mark component
- **@visactor/vchart**: sankey chart support color config'
- **@visactor/vchart**: style not effect when set mark hover. fix [#976](https://github.com/VisActor/VChart/issues/976)
- **@visactor/vchart**: tooltipHide event may be inavailable when the computer runs slow
- **@visactor/vchart**: chart pass-through serDataByAxis config to series
- **@visactor/vchart**: when call updateSpec, the prev scrollbar had not been clear, relate [#1044](https://github.com/VisActor/VChart/issues/1044)
- **@visactor/vchart**: add protect for this.\_spec, fixed [#1045](https://github.com/VisActor/VChart/issues/1045)
- **@visactor/vchart**: fix the issue of `seriesId` does not work in legends, closed [#910](https://github.com/VisActor/VChart/issues/910)
- **@visactor/vchart**: state scale domain error when domain is locked. fix [#629](https://github.com/VisActor/VChart/issues/629)
- **@visactor/vchart**: fix unoff event when passing through handler
- **@visactor/vchart**: fix userEvent is added multiple times
- **@visactor/vchart**: line and area mark should set closePath default, fix [#654](https://github.com/VisActor/VChart/issues/654)
- **@visactor/vchart**: fix the issue of radar area's invalidType not work, fixed [#867](https://github.com/VisActor/VChart/issues/867)
- **@visactor/vchart**: fix invalidType not working after invoking updataDataSync, details in [#1057](https://github.com/VisActor/VChart/issues/1057)
- **@visactor/vchart**: marker don not render after updateData. fix [#882](https://github.com/VisActor/VChart/issues/882)
- **@visactor/vchart**: fix the issue of markLine symbol.size not work
- **@visactor/vchart**: optimize the layout of normal-inline, fixed [#989](https://github.com/VisActor/VChart/issues/989)
- **@visactor/vchart**: do the product of this.\_spec, fixed [#1062](https://github.com/VisActor/VChart/issues/1062)
- **@visactor/vchart**: fix the issue of progress layout in multi-region
- **@visactor/vchart**: render error when dot and link data is empty. fix [#1019](https://github.com/VisActor/VChart/issues/1019)
- **@visactor/vchart**: fontsize renge not effect with no value field. fix [#522](https://github.com/VisActor/VChart/issues/522)
- **@visactor/vchart**: lock crosshair label to uninteractive, because it will affect axis label's event pick
- **@visactor/vchart**: fix the issue of reading onError of null option in [#915](https://github.com/VisActor/VChart/issues/915)
  **🔨 refactor**
- **@visactor/vchart**: split the updateSpec of life cycle to spec transform & compare
- **@visactor/vchart**: remove unused code, and transform ticks transform to vutils-extension
- **@visactor/vchart**: unify the clear of component
- **@visactor/vchart**: seperate grid from axis for better layer control
- **@visactor/vchart**: use @visctor/vgrammar-core to replace @visctor/vgrammar

[more detail about v1.4.0](https://github.com/VisActor/VChart/releases/tag/v1.4.0)

# v1.3.4

2023-09-20

**🐛 fix**

- **@visactor/vchart**: circularProgress chart may throw error when executing `updateSpec`, related [#994](https://github.com/VisActor/VChart/issues/994)
- **@visactor/vchart**: the theme in spec does not update correctly when executing `updateSpec`, related [#996](https://github.com/VisActor/VChart/issues/996)
- **@visactor/vchart**: `track` in spec is not working in circularProgress charts, related [#600](https://github.com/VisActor/VChart/issues/600)
- **@visactor/vchart**: fix the error triggered by chart updateSpec, fixed [#988](https://github.com/VisActor/VChart/issues/988), [#1002](https://github.com/VisActor/VChart/issues/1002)
- **@visactor/vchart**: fix the issue of player component updateSpec, fixed [#967](https://github.com/VisActor/VChart/issues/967)

[more detail about v1.3.4](https://github.com/VisActor/VChart/releases/tag/v1.3.4)

# v1.3.3

2023-09-18

**🐛 fix**

- **@visactor/vchart**: fix the issue of player component updateSpec, fixed [#967](https://github.com/VisActor/VChart/issues/967)

[more detail about v1.3.3](https://github.com/VisActor/VChart/releases/tag/v1.3.3)

# v1.3.2

2023-09-14

**🆕 feat**

- **@visactor/vchart**: the setDimensionIndex api supports deselecting ability by passing in null
- **@visactor/vchart**: use precision calculations in waterfall charts to avoid unexpected values for labels, details in [#721](https://github.com/VisActor/VChart/issues/721)
- **@visactor/vchart**: interactive default config.

**🐛 fix**

- **@visactor/vchart**: log scale has no result about zero when bar stack has a zero baseline value. fix [#634](https://github.com/VisActor/VChart/issues/634)
- **@visactor/vchart**: fix the user event listener becomes invalid after updateSpec
- **@visactor/vchart**: fix bug of series mark static style are not updated when updateSpec
- **@visactor/vchart**: fix bug data fields are not updated when updateSpec, details in [#829](https://github.com/VisActor/VChart/issues/829)
- **@visactor/vchart**: fix the issue of animation config not work in common chart, related [#814](https://github.com/VisActor/VChart/issues/814)

**⚡ perf**

- **@visactor/vchart**: optimize the performance of dimension-statistics
- **@visactor/vchart**: only calculate dimensionTree when need

[more detail about v1.3.2](https://github.com/VisActor/VChart/releases/tag/v1.3.2)

# v1.3.1

2023-09-05

**🆕 feat**

- **@visactor/vchart**: `lineHeight` supports string proportional values, related [#744](https://github.com/VisActor/VChart/issues/744)
- **@visactor/vchart**: upgrade vdataset for clone source data when call updateData

**🐛 fix**

- **@visactor/vchart**: move \'SeriesMarkNameEnum\' to single file, solve the issue of codesandbox can not work, it looks like an error in the Codesandbox' bundler, see https://github.com/codesandbox/codesandbox-client/issues/6435
- **@visactor/vchart**: fix sortDataByAxis not work after updateData
- **@visactor/vchart**: fix the issue of legend does not update after updateData, fix [#769](https://github.com/VisActor/VChart/issues/769)
- **@visactor/vchart**: fix the issue of legend's maxHeight not work
- **@visactor/vchart**: the issue of pie chart with null value, fixed https://github.com/VisActor/VChart/issues/748
- **@visactor/vchart**: fix the problem that the pie chart draws a full circle when the data is all 0, because the endAngle of the last piece of data is forced to configure the endAngle of polar coordinates
- **@visactor/vchart**: fix the issue of `seriesIndex` not work in discrete legend, see [#732](https://github.com/VisActor/VChart/issues/732)

[more detail about v1.3.1](https://github.com/VisActor/VChart/releases/tag/v1.3.1)
