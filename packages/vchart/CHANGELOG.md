# Change Log - @visactor/vchart

This log was last generated on Thu, 25 Jun 2026 03:26:39 GMT and should not be manually modified.

## 2.1.1
Thu, 25 Jun 2026 03:26:39 GMT

_Version update only_

## 2.1.0
Tue, 23 Jun 2026 08:17:08 GMT

### Minor changes

- feat: support function type for `maxRow` / `maxCol` of the discrete legend, evaluated during layout against the legend's allocated rect, so the row / column count can adapt to the available space

### Patches

- fix: preserve discrete legend filtering after updateSpec when `legends.data` is a callback (Issue #4566)
- fix: re-nice the cartesian linear axis with the real plot-area length after layout when `tick.tickCount` is a function, so the length-based tick count and nice ceiling match the final plot area instead of the pre-layout chart viewRect
- refactor: introduce scoped updateSpec effects to make chart, component, series, data, layout, render, and animation update ranges explicit; local component updates such as marker exit, title text, legend appearance, axis appearance, mark style, field, label, animation, and layout-related series changes now avoid unnecessary chart remake/recompile paths when the existing chart model can be updated in place
- refactor: align VChart with the VRender 1.1.0 app-scoped runtime, state resolver, and animation contracts while keeping standard VChart spec usage compatible; consolidate mark shared-state handling, glyph sub-graphic state isolation, word-cloud scaleIn initialization, and interaction-state behavior for Sankey, brush, legend textures, marker rich text, and circular progress tick masks

### Updates

- update changes for 009-fix-map-roam-pointer-drag: This plan fixes a map roam drag bug where mobile browsers lose stable vertical dragging after supportsTouchEvents is forced to false
- feat: markLine expandDistancesupport callback. close#4568
- fix: waterfall lead line bug. fix#4580
- fix: vchart relayout api not work bug. fix#4537
- fix: label not follow when drag. fix#4547
- fix: prcoess render error. fix#4578

## 2.0.21
Mon, 13 Apr 2026 12:57:51 GMT

### Patches

- fix: correct stacked bar corner clipping when barMinHeight is applied (Issue #4543)
- fix: handle sankey tooltip labels when source index is 0 (Issue #4488)

### Updates

- fix: relayout api not work bug. fix#4537
- fix: custom mark not release after update spec. fix#4537
- fix: map error when roam or drag canvas. fix#4547

## 2.0.19
Thu, 26 Mar 2026 08:32:46 GMT

### Updates

- update changes for 008-fix-size-legend-handler-text: Allow size legend handlerText.style to accept function-based values in the same way other legend style hooks already do, and add regression coverage proving the style callback is preserved through continuous legend attribute transformation.
- update changes for 009-fix-heatmap-scrollbar-axis-direction: Align ScrollBar with DataZoom by using the shared reverse-axis detection when converting scrollbar state percentages back into domain values.
- update changes for 009-fix-issue-of-mark-state-when-updateSpec: Fix an issue where mark states were not properly cleared when updateSpec was called, causing incorrect state persistence.
- update changes for 010-hide-empty-axes: Add an opt-in hideWhenEmpty axis option for cartesian axes.
- fix: fix theme config of spec and option


- update changes for 009-fix-issue-of-mark-state-when-updateSpec: Fix an issue where mark states were not properly cleared when updateSpec was called, causing incorrect state persistence.
- fix: datazoom update domain after data change. fix#4186
- chore: upgrade vutils, vdataset, vscale, vlayouts to ~1.0.23

## 2.0.18
Fri, 06 Mar 2026 11:34:27 GMT

### Patches

- chore: remove unused GitHub Actions workflows

## 2.0.17
Thu, 05 Mar 2026 11:35:47 GMT

### Patches

- fix: ensure DataZoom updates when data source changes (Issue #4185)
- fix: Fix memory leaks in Player component and BaseComponent release logic.

### Updates

- feat: optimiz workflows for release


- fix: fix default lineWidth for heatmap label



## 2.0.16
Thu, 26 Feb 2026 08:40:19 GMT

### Updates

- fix: support functional alternateColor in axis grid configuration

## 2.0.15
Fri, 06 Feb 2026 12:13:39 GMT

### Patches

- fix: markPoint.itemContent.text.style.fontSize setting invalid

### Updates

- feat: optimiz word-cloud-shape

## 2.0.14
Fri, 30 Jan 2026 03:53:56 GMT

### Updates

- fix: fix issue of wordCloud


- fix: fix style of react-vchart tooltip render



## 2.0.13
Wed, 21 Jan 2026 12:36:39 GMT

### Minor changes

- feat: support fixed pixel step scrolling on wheel event and minimum scrollbar slider height

### Updates

- chore(auto-flow): optimize auto flow
- fix(react-vchart): fix default registers of CommonChart


- feat: add brush api before change
- git commit -m 'feat: add interactive api
- feat: add brush clear api and disable dimension hover config. close#4400
- fix: fix issue of wordCloud


- feat: interactive params add event. feat #4421

## 2.0.11
Thu, 25 Dec 2025 10:15:24 GMT

### Updates

- chore(vchart): 热力图矩形单元支持非等宽高；默认形状统一为 rect；修复颜色映射字段访问；新增单测与浏览器示例

## 2.0.10
Thu, 11 Dec 2025 11:05:38 GMT

### Updates

- feat: support label of boxPlot
- feat: support componentShowContent in initOption


- fix: update outlier data handling in BoxPlotSeries, fix #4317



## 2.0.9
Fri, 28 Nov 2025 03:44:56 GMT

### Updates

- feat: add `outlier` to boxplot, close #4301


- feat: upgrade vrender to 1.0.32


- fix: extensionMark can remove animation


- fix: fix issue of font family



## 2.0.7
Tue, 18 Nov 2025 11:36:57 GMT

### Updates

- support stage animation and add various exit animation effects based on stage
- fix: fix the issue of markline autoRange


- fix: bar always display when set bar minHeight. fix#3284
- fix: dot series display bug. fix #3283
- fix: brush range not correct. fix #3091
- fix: datazoom layout when set scale. fix #2574 & #2424
- fix: domain will follow axis. fix #2770
- fix: update perview when update data. fix #3331
- fix: bind right axis when swtich orient. fix#3373
- performance: enhance datazoom and scrollbar performance. close#2525 & #2781

## 2.0.6
Fri, 31 Oct 2025 03:26:00 GMT

### Updates

- feat: boxplot support transform


- feat: support resize zoom chart plugin


- fix: crosshair should hide when mouseleave chart


- fix: fix the vchart-extension packaged artifacts contained an extra vrender


- fix: fix issue of legends label layout when resize


- fix: update demo about regression line


- fix: upgrade-vutil to 1.0.12


- fix: fix issue of waterfall compute total on `field` totalType



## 2.0.5
Tue, 14 Oct 2025 07:08:54 GMT

### Updates

- feat: support calc in formatter


- fix: fix issue of markline will report an error when series has no data



## 2.0.4
Fri, 19 Sep 2025 07:45:43 GMT

### Updates

- feat: support vchart rotate plugin


- feat: scrollbar support auto visible. close #3972
- feat: support includFullBand api in markArea


- fix: fix bug of the rangeArea chart line and point config


- fix: fix the issue of className miss in react-vchart


- fix: when color is gradient string, tooltip icon should show correctly



## 2.0.3
Fri, 08 Aug 2025 09:24:12 GMT

### Updates

- fix: fix bug of vchart onError will be overwritten by undefined


- fix: animtion should be run after `spec.animation` is updated, fix #4104


- fix: fix issue with normal after no-animate enter state
- fix: fix height of tooltip element when set transform of container, fix #4109



## 2.0.2
Mon, 28 Jul 2025 08:19:21 GMT

_Version update only_

## 2.0.1
Thu, 24 Jul 2025 02:07:41 GMT

### Updates

- feat: add config to avoid brush state update. close #4035
- feat: optimize datazoom animation effect
- feat: add the afterClearScreen hook of render


- fix: fix issue with 3d chart grid
- fix: tickData of axis should update when `sampling` is changed, fix #4059


- fix: only calculate multi layer label items when need, fix #4056


- fix: fix resize error when remake, and re-normal aniamtion bug, fix #4070


- fix: fix issue with feishu block and call setenv when create vchart
- fix: fix bug of tooltip triggerOff & tooltip lock


- fix: fix tooltip throw error when some tooltip processor is undefined, fix #4044


- fix: fix `textAlign` not works in tooltip.style.titleLabel, fix #4043



## 2.0.0
Tue, 10 Jun 2025 13:40:24 GMT

### Updates

- feat: remove marker type. close #3782
- fix: mark interactive problem when brush. fix visactor/vchart#4017
- fix: markLine position error when domain is a same array. fix#4016
- refactor: migrate mapLabel component into vchart-extension package

## 1.13.11
Thu, 29 May 2025 09:26:04 GMT

### Updates

- feat: add `barGap` option for histogram chart
- feat: support tooltip.trigger and crosshair.trigger in theme
- fix: fix data-zoom domain when the label of band size is number-like string, fix #3982


- fix: fix the order of title in mark tooltip when dimension tooltip has no title, fix #3991


- fix: option `{ poptip: true } should load `poptipForText`


- fix(react-vchart): when use children to render customized tooltip, react-vchart should update


- fix: customized render of tooltip should be render in react 17 and react 18


- fix:Replace all the vchartConstrouctor to vchartConstructor,and ensure backward compatibility with older versions.

## 1.13.10
Thu, 15 May 2025 12:13:18 GMT

### Updates

- feat: tooltip support inside position


- feat: mosaic chart supports bandWidthField and percent config, closed #3945
- fix: export ManualTicker & StreamLight


- fix: tooltip should hide when enterable, fix #3965, fix #3922


- fix: fix error of enterable tooltip when multiple charts in a page, fix #3940


- fix: upgrade vgrammar to 0.16.7, fix #3965



## 1.13.9
Mon, 21 Apr 2025 08:22:38 GMT

### Updates

- feat: axis datafilter support context. close#3332
- feat: gauge support clip when mark outof axis. close#3859
- feat: markLine and markArea supports render multiple labels
- fix: clear event listener for normal animation when updateSpec, #3881
- fix: fix coordinate of rect crosshair when bandSize is 0, fix #3907


- fix: when set defaultSelect of crosshair, `axisIndex` should have a default value: 0


- fix: fix type error of datazoom texts


- fix: the width of title label should auto fit content width when `autoWidth` is true, fix #3880


- fix: mark line valid judgement. fix#3857
- fix: empty placeholder should update after data is updated, fix #3855


- docs: supply interface of docs. fix#3877
- refactor: brush interactive. close#3765 & #3262 & #2802 & #3885

## 1.13.8
Fri, 28 Mar 2025 08:38:27 GMT

### Updates

- feat: add \`alwayCalculateTotal\` for total label
- fix: fix the issue where the bar chart grow animation does not work correctly when the axis `zero: false`, #3808
- fix: crosshair should hide when label is invalid


- fix: crosshair should hide when datazoom change


-  fix: fix the bubble level issue prevented by event.prevent, #3728
- fix: fix error when load gauge chart on demand, #3836
- fix: `legends.title.visible` should change visiblity of title in legend, fix #3846


- fix: fix the issue of pictogram svg path has not been drawn
- fix(react-vchart): children of tooltip should not be set to spec
- fix: data.fields can set domain of field


- feat: add options `full` to lockStatisticsByDomain


- fix: fix bug of zoomable in mobile device which only use pointer event


- fix: fix datazoom drag and zoom triggered at the same time, fix #3819



## 1.13.7
Fri, 14 Mar 2025 04:02:23 GMT

### Updates

- chore: add util to export


-  feat: support `position` config in totalLabel, #3396
- fix: vchart should not merge original options, fix #3798


- fix(react-vchart): lifecycle event callback should be fired, fix #3792
- fix: react-vchart should export `WaterfallChart`, fix #3791


- fix: fix fontFamily of richtext, fix #3768


- fix: fix issue with wx get context

## 1.13.6
Mon, 03 Mar 2025 02:00:52 GMT

### Updates

- 'feat: support `clamp` in linear scales, #3738'
- feat: optimize the display effect of waterfall chart lieaderLine


- feat: add `transformRatioText` config for transformRatio text content in funnel tooltip, #3704
- fix: display line label normally when seriesField is missing, #3709
- fix: customMark should return components in `getVRenderComponents()`, fix #3727


- fix: map zoom error bug. fix#3743

## 1.13.5
Fri, 14 Feb 2025 08:49:08 GMT

### Updates

- fix: incorrect update animation of funnel transform mark, #3685
- docs: update options of poptip, close #3139


- feat: add params of startvalue and endvalue in brushend event
- feat: label support triggering mark tooltip, #3634
- feat: export getCartesianDimensionInfo and getPolarDimensionInfo, fix #3668


- feat: support stackInverse for waterfall chart


- fix: fix the issue where the upper mark in stacked area overlaps the border of lower mark, #3684
- fix: fix cache of crosshair value when hide crosshair, fix #3686


- fix: allow dispatch roam zoom in datazoom component. fix#3714
- fix: datazoom and scrollbar realtime not work. fix#3716
- fix: fix the issue of tickAlign accuracy


- fix: indicator should show when switch `visible`, fix #3675


- fix: circular progress should support morphing


- fix: tooltip should not handle mousemove or mouseout when enter tooltip, fix #3708


- fix: tooltip should auto wrap when `maxWidth` is valid and `multiLine` is not false, fix #3718


- fix: fix the type definition of text mark


- refactor: optimize performance of pictogram

## 1.13.4
Thu, 16 Jan 2025 07:01:11 GMT

### Updates

- fix: fix error of tooltip about `showDelay`, fix #3663


- fix: fix offset of tooltip, fix #3666


- fix: fix bug of parse lineHeight of tooltip row, fix #3643


- feat: add wordCloudConfig in _wordCloudTransformOption()
- fix: axis break's scope calculate error, fix#3656
- fix: fix the issue where map drag interaction cannot be terminated outside the canvas, #3650
- fix: fix the issue where map drag interaction cannot be terminated outside the canvas.

## 1.13.3
Tue, 07 Jan 2025 10:21:06 GMT

### Updates

- feat: add datum to params on axis-label event 
- feat: package some hook in vgrammar


- fix: fix the issue of incorrect label display in 3D charts, #3584
- fix: fix the issue of animation in 3d wordcloud not work
- fix: brush data will be undefined when mark is hovered. fix#3623
- fix: fix style of dom tooltip when tooltip has customized child, fix #3615


- fix: fix error update of dom tooltip when update theme, fix #3619


- fix: fix position of html tooltip when confine is false, fix #3632


- fix: fix the typographical error of dataset tutorial


- fix: compilier should add dpr to vrender


- fix: fix invisible region blocking mark events, #3638
- fix: undefined points shoulde not show when dimension hover, fix #3610



## 1.13.2
Mon, 23 Dec 2024 12:30:04 GMT

### Updates

- feat: add miss Series and Chart in react vchart, close #3578
- feat: vchart support clickInterval params
- fix: support percentage state radius config in gauge segment mark, #3459
- fix: media query should not throw error when has empty axis, related to #3575


- fix: tooltip should not render empty column when `hasShape` of tooltip is `false`, related to #3572


- fix: `othersLine` of tooltip can be hidden by `visible: false`, related to #3572


- fix: fix position of tooltip, related to #3590



## 1.13.1
Fri, 13 Dec 2024 08:29:40 GMT

### Updates

- fix: fix break of waterfall, fix #3544


- feat: add config `customFilter` to legend, support cutomized filter function, close #3492


- fix: fix the bug of updateModelSpecSync can not set axis.tick.forceTickCount


- fix: fix filter of lock domain when field is array, related #3469


- fix: fix size of datazoom when update, fix #3521


- fix: html tooltip can reuse the dom content and fix the unneed animation


- fix: fix update of extensionMark when mark has `name`, fix #3547


- fix: fix indicator when change visible to be false, fix #3506


- fix: fix tooltip content when only has `valueFormatter` or `keyFormatter`


- fix: fix style of dom tooltip


- fix(vchart-extension): series-break should keep align width axis break, related to #3560


- fix: breaks should consider the `min` and `max` of axis, related to #3560

## 1.13.0
Fri, 06 Dec 2024 07:17:54 GMT

### Updates

- feat: react vchart support event filter, close #3461


- feat: tooltip key/content support config by field, close #2576


- feat: support max height of tooltip, by percent value , close #2675


- fix: upgrade vrender to 0.21.2, vgrammar to 0.15.1



## 1.12.15
Thu, 05 Dec 2024 09:50:08 GMT

### Updates

- feat: support `restorePosition` in position/bound label overlap strategy
- fix: optimize `shiftY` of label

## 1.12.14
Wed, 04 Dec 2024 11:27:00 GMT

### Updates

- feat: support `autoRefreshDpr` in chart options


- feat: dataZoom can do filter when has `lockStatisticsByDomain`, close #3469


- feat: add marker context to support the same color as series. close#3437
- fix: upgrade scrollbar visible after layout. fix#3452
- fix: fix `adjacency` in sankey, fix #3460


- feat: update options `maxNodeHeight`, `maxLinkHeight` in sankey, close 3439


- fix: not update layout when scrollbar domain is the same as before. fix#3452
- fix: value in scale range should consider about whole range. fix#3446

## 1.12.13
Fri, 22 Nov 2024 06:14:56 GMT

### Updates

- fix: fix `groupKey` of boxplot series, fix #3409, related to #2855


- fix: fix the issue where the length of the outerlabel line is incorrect when richtext

## 1.12.12
Fri, 15 Nov 2024 15:21:31 GMT

### Updates

- fix: fix: fix the issue where modifying area.visible through updateSpec does not take effect, related #3393
- fix: fix incorrect rendering when changing `direction` via updateSpec in area chart, related #3406
- fix: fix zIndex of background image, fix #3403


- perf: optimize the effect of break data


- fix: fix error of tooltip when chart is released, fix #3428



## 1.12.11
Wed, 13 Nov 2024 10:27:47 GMT

### Updates

- feat: support axis sync to the axis that has breaks


- feat: tooltip can support customized `trigger` and `triggerOff`


-   fix: fix the issue where the axis breaks render incorrectly in some cases
- fix: fix `zIndex` of series, fix #3395


- fix: fix layout of title when orient is "left" or "right", fix #3401


- fix: fix the issue of custom svg string in tooltip shape, related #3384
- fix: tooltip `enterable` should work when update, fix #3405


- fix: fix tooltip position by `mode: pointer`, close #3367


- fix: wordcloud should not throw error when `word.visible` is `false`, fix #3378


-  fix: fix the issue where the scrolling legend triggers map zooming under certain conditions, related #3391

## 1.12.10
Thu, 31 Oct 2024 12:08:50 GMT

### Updates

- fix: scroll not dispatch view update when axis is not display. fix#3278
- fix: changes to `roam` via  updateSpec do not take effect
- feat: pie series support center of percent string


- docs: update changlog of rush


- fix: fix the issue of symbolActiveMark visible setting


- fix: fix issue with chart background in harmony
- fix: fix event of angle axis in radarchart, fix #3343


- fix: type issue of title theme
- refactor: optimize setter and getter about markConfig



## 1.12.9
Thu, 24 Oct 2024 10:01:43 GMT

### Updates

- fix: fixed the issue where map labels do not scale accordingly after updateSpec.
- feat: support tooltip for overlapped points, close #3224


- fix: all the SeriesData should call `compileData()`, fix #3322


- fix: clear throttle timer when out, fix #3326


- fix: fix `tooltipHide` event when handler is empty


- fix: tooltip data should has `datum` in each line



## 1.12.8
Tue, 15 Oct 2024 09:20:45 GMT

### Updates

- fix: upgrade vrender to 0.20.9, vgrammar to 0.14.10


- feat: support `firstVisible` of axis label, close #3200
- feat: support `roam.blank` to enable dragging from blank area of region in map chart
- feat: optimize data empty condition


- fix: chart should `remake` when visible of axis change, fix #3287


- fix: fix visible change of label, fix #3277


- fix: custom theme by chartType cannot work in initial options, #3285
- fix: fix issue of `html` and `dom` not work correctly in label
- fix: axis line on zero should consider the bindAxis's inverse, fixed#3306
- fix(react-vchart): register labels by default in circlePacking, sankey, sunburst, treemap, venn, fix #3148
- refactor: refactor implement of `enterable` in tooltip component



## 1.12.7
Fri, 27 Sep 2024 10:40:30 GMT

### Updates

- fix: fix error of `updateSpec` when data changed, fix #3261


- feat: feat: support `minLength` in funnel outerlabel line
- feat(react-vchart): support `morphConfig` of react-vchart, close #3219


- fix: color of linear progress track in dark mode


- fix: datazoom state field and value field is incomplete problem. fix#3199
- fix: fix title of axis when the bounds is empty, fix #3265


- fix: fix media-query when `updateSpec`


- fix: fix updateSpec when add attributes `width`, `height` to `spec`



## 1.12.6
Fri, 20 Sep 2024 11:03:33 GMT

### Updates

- feat: add life cycle hooks


- fix: allow indicator spec in polar chart


- chore: delete useless code in test demo


- fix: default value


- fix: type of pointermarkspec is not required anymore
- fix: use `throttle` when trigger resize


- fix: fix the compare of label in series



## 1.12.5
Thu, 12 Sep 2024 14:07:06 GMT

### Updates

-  fix: optimize first axis label autolimit effect
-  fix: `animationUpdate` should also control labels animation
- fix: fix default value of circular-progress, fix #2683


- feat: extension mark and customized mark support `markName` event filter


- fix: fix typos in FAQ documents 86


- fix: fix display of radar-chart when has negative radius


- fix: `word.style.fontWeight` should change the style of text in wordcloud


- refactor: reduce duplicated `getSpecInfo`



## 1.12.4
Mon, 09 Sep 2024 08:09:07 GMT

### Updates

- feat: support axis break
- feat: stackCornerRadius support callback. feat#3164
- feat: add `crossNodeAlign` to sankey


- fix: bind first axis to series but not last. fix#3139
- chore: clear state when updateSpec. fix#3162
- fix: crosshair won't update when switch theme
- fix: wordcloud text overlap. fix#3177
- fix: fix zIndex of label in pie-chart



## 1.12.3
Thu, 05 Sep 2024 05:54:53 GMT

### Updates

- fix: cannot disable label update animation by `option.animation:false`
- fix: upgrade vrender to 0.20.2, vgrammar to 0.14.3



## 1.12.2
Tue, 03 Sep 2024 12:46:51 GMT

### Updates

- fix: rangeMode of scrollbar not work. fix#3147
- docs: fix issue of treemap.label not shown in option pages, fix #2562
- docs: update docs about circular progress, close #2987


- feat(brush): add config to control zoom when brush empty data. close#2934
- feat: support 'inside-center' label position in pie chart
- fix: fix error of `barWidth`, `barMinWidth`, `barMaxWidth` when value is null


- fix: x brush filter not work. fix#3111
- fix: indicator stop tooltip interactive. fix#3123
- fix: fix error of `getCenter` when layoutRadius is a customized function in radar


- fix: media query causes incorrect render result, #3102
-  fix: normal animation not work since v1.12.0
- fix: sankey scale update not work
- fix: fix error of sankey when some customized mark has name "node"


- fix: fix dimension value of tooltip when has innerOffset, fix #2923


- fix: vchart should not throw error when the values of series data is empty, fix #3082


- fix: fix error of `updateSpec` when array change


- fix: wordcloud fill not update after updateSpec. fix#3122
- fix: wordcloud scale update not work. fix#3129
- refactor: refactor the parser of tooltip pattern



## 1.12.1
Wed, 21 Aug 2024 01:09:17 GMT

### Updates

- fix: x brush filter not work. fix#3111
- fix: fix error of `getCenter` when layoutRadius is a customized function in radar


- fix: media query causes incorrect render result, #3102
- fix: vchart should not throw error when the values of series data is empty, fix #3082



## 1.12.0
Fri, 16 Aug 2024 06:12:54 GMT

### Updates

- feat: marker's `coordinates` and `positions` property support callback
- add emptyPlaceholder and emptyCircle for pie chart
- sequence support bottom axes. fix#2927
- feat: support `animationState` config
- feat: show evenly divided pie chart with showAllZero
- feat: enable supportNegative option to treat negative values as absolute values
- feat: support theme config by chart type
- feat: support text shape of word-cloud


- fix: y-axis is reverted after brush zoomin. fix#3089
- fix: mark-point position type error fix
- refactor: refactor the graphics in linear-progress chart
- refactor: use label component to refactor sankey label
- refactor: stack can be required by need



## 1.11.12
Wed, 14 Aug 2024 14:51:54 GMT

### Updates

- fix: fix params of tickCount in linear-axis-mixin,  fix #3053


- feat: support `layoutRadius` of pie


- fix: fix `padding` of region not work


- fix: brush error after legend filter. fix#3061
- fix: fix funnel chart color bug with different category and series fields
-  git push --set-upstream origin fix/gauge-angle
- fix: fix issue with harmony event
- fix: fix type error of react vchart, fix #3065


- fix: tooltip should show when chart has multiple regions


- fix: fix the issue background of chart not updated, fix #3054


- fix: fix the update of `startAngle` and `endAngle` in pie chart, fix #3059


- fix: fix switch `visible` of legend, fix #3060



## 1.11.11
Tue, 06 Aug 2024 09:20:16 GMT

### Updates

- feat: label line support custom path. close#3000
- feat: upgrade vrender to 0.19.20, to support `catmullRom` and `catmullRomClosed` curveType, related #2610


- fix: fix crosshair of histogram, fix #2826


- fix: use `vglobal.getElementById` to replace `document.getElementById`


- fix: liquid gradient not work after reverse
- fix: add group mark to fix gradient color bug of liquid and add rect shape to fix rect symbol padding bug
- fix: fix `lockAfterClick` of tooltip, related #1574


- fix:  prevent trigger original event in panEnd composite event #2931
- fix:curveType `monotone` in seriesStyle not work 
- fix: charts should not stack when only specify `stackValue` but `stack` is false, fix #3005


- fix: `updateData` incorrect with datazoom, related #3041
- fix: fix issue of `updateSpec` when visible of grid in axis change, fix #3004


- fix: fix fontFamily when update theme, fix #3028



## 1.11.10
Wed, 24 Jul 2024 13:32:11 GMT

### Updates

- chore: update rollup.config.js to fix es5/index.js, fix #2971


- fix: prevent issue with ios bug while pointEvent is configed
- feat: liquid support reverse and target mark. close#2977 & close#2978
- feat: add `totalScale` params in geo zoom event
-  feat: support `geoZoomByIndex`/`geoZoomById` API
- feat: marker label background support  custom path. close#2959
- fix: liquid gradient not work after reverse
- fix: prevent trigger original event in zoomEnd composite event #2931
- fix: fix error of setDimentionIndex when dimension axis is linear



## 1.11.7
Tue, 16 Jul 2024 12:19:22 GMT

### Updates

- feat: support configuring callback function in indicator text style attributes, #2540
- feat: add options `hideTimer` in toolti, to hide tooltip by timer


- feat: support `transitionDuration` in tooltip theme
- feat: support `updateIndicatorDataById`/`updateIndicatorDataByIndex` API, related #2776
- feat: add `userUpdateOptions` to let user specify update type of charts, fix some animation bug


- fix(barbackground): datakey is undefined when set custom datakey
- fix: fix the issue where `barMaxWidth` does not work when `barWidth` is configured, #2885`
-  fix: line/area clip animation by incorrect direction
- fix(crosshair): fix bug of crosshair position when legend filter data. fix#2905
- fix: fix the error caused by theme change when updatingSpec


- fix: clear the timer of tooltip when has update


- fix: statistics confict of linear and discrete field. fix#2926 
- fix: fix polar animation logic for radar charts
- fix: fix PolarPointUpdate when from point is center


- fix: type define fix
- fix: label should not update when label is set in series, related #2928



## 1.11.6
Thu, 27 Jun 2024 09:53:20 GMT

### Updates

- fix: background of chart should support gradient color
- fix(animation): rose animation not work when update twice. fix#2856
- fix: fix the type of `ITooltipTheme`, fix #2850


- fix: fix the issue of update animation not executed when updateSpec, #2835 #2836

## 1.11.5
Thu, 20 Jun 2024 10:18:10 GMT

### Updates

- fix: optimize discrete legend pager color in dark theme, related #2654
- fix: fix the issue issue with stacked waterfall charts where positive and negative values were not stacked separately when there were both positive and negative values in the same stack



## 1.11.4
Tue, 18 Jun 2024 06:15:31 GMT

### Updates

- fix: fix bug of `updateSpec` when has `scales`, close #2744


- fix: gauge chart might throw error when the value is close to its maximum, fix #2783
- fix: fix the behavior of the gauge pointer when it exceeds the axis range, fix #2780
- fix: normal animation not work when appear animation is disabled, fix #2807
- fix: upgrade vrender to 0.19.10, vgrammar to 0.13.9



## 1.11.3
Thu, 06 Jun 2024 05:55:31 GMT

### Updates

- feat: add option `showBackgroundChart` of DataZoom


- fix: bar chart should work normally when x-axis is linear, fix #2758


- fix: fix issue of continuous legend filter in treemap
- fix: fixed the issue that the newly added component type could not take effect when updateSpec



## 1.11.2
Thu, 30 May 2024 09:40:24 GMT

### Updates

- chore: when build es5 , `targets` of `@babel/preset-env` should be `defaults`, fix #2702


- fix: fix the bug that `animationThreshold` not work, close #2745


- fix: fix the issue of  update animation in area chart is not work
- fix(common): bar series support auto band size in common chart. fix#2704
- fix: corsshair should hide when pointer out view, fix #2726


- fix: close animation cause by datazoom/scrollbar


- fix: \`type-step\` markLine's label should consider the refX/refY/dx/dy set by user, fixed#2739
- fix(react-vchart): fix the issue of `<Axis />` that the props `id` not work


- fix: `polarAxis.grid.smooth` not work in theme configuratio

## 1.11.1
Mon, 20 May 2024 15:49:14 GMT

### Updates

- feat(marker): mark-point support arc line and targetSymbol. close#2590'
- docs: add custom animate doc
- docs: perfect document for react-lynx-vchart
- feat: add new options `followTooltip` to crosshair


- fix: fix the issue of missing defaultDataIndex in extensionMarks
- fix: fix error of empty spec, fix #1193


- fix: fix the error caused by renderNextTick after release


- fix: layout-model should read `layoutLevel` in `spec`, and dont create layoutItem for hidden components, related #1674


- fix: when marker's spec update, it should update when call vchart.updateSpec
- fix: fix effect of sampling when flush is `true`, fix  #2272


- fix: fix the api `valueToPositionX` and `valueToPositionY` of sankey


- fix: sankey should color by seriesField, fix #2678


- fix: fix bug of `setDimensionIndex` when axis is linear
- fix: fix issue with import registerTTEnv
- fix: fix issue with taro tt env, closed #2648
- fix: fix error of call `updateFullDataSync()` before `renderSync()`, fix #2655



## 1.11.0
Wed, 08 May 2024 11:01:15 GMT

### Updates

- fix(wordCloud): wordCloud layout error and color scale error when updateData. fix#2605'
- fix: fix error of position when update viewBox


- fix(scroll): scroll not work in ios. fix#1224
- fix: fix range-column-chart spec


- feat: support `animation` config of custom-mark


- feat: legend should keep unselected when update spec or data, fix #2531, related #2443


- feat(marker): marker enhance about state and animation and support polar and geo axis. close#1165
- fix(marker): fix mark point position about offset. fix#2579
- feat(marker): add interactive event listener of marker. close#2248
- feat(marker): add config about custom data of all relative series. close#2183
- chore: upgrade dependencies


- feat: support data update when spec is same in react-vchart


- feat: support `softMin` and `softMax` in linear-axis, close #2498


- feat: add new properties `tooltipSpec` and `tooltipActual` to tooltip event params, related #2454
- feat: add `othersLine` to customize the the "Others" line content displayed after the tooltip content exceeds the maximum number of displayed lines
- feat: the new chart type venn chart, related #2144
- feat: enhanced capabilities for waterfall chart total label


- fix: extension-mark should update when data is update


- fix: duplicated categoryField data in funnel will result to unexpected rendering result
- fix: the x-axis and y-axis of scatter can be band-axis


- fix: vchart should not remake of same spec


- fix: fixed the problem that when the label of the sankey chart is hidden, an error will be reported when clicking on the blank space


- feat: add api of `clearState()`, `clearSelected()`, `clearHovered()`, fix #2552


- fix: fix the issue of scatter when the legend switch visible encode, close #2625


- fix: fix the trigger off of default select interactions


- refactor: react-vchart will require component by need by default
- refactor: remove built-in simplify data transform
- feat: support `simplify.tolerance` config in `registerMap` API 

## 1.10.5
Thu, 25 Apr 2024 11:57:23 GMT

### Updates

- fix(datazoom): when drag start and end handler outside, min and max span not work. fix#2559
- feat: player support play when hidden. feat#2524
- fix: fix domain of continuous legend when specify seriesId or seriesIndex


- fix: fix eventsBinded update in react-vchart
- fix(scrollbar): label position not align with mark. fix#2534
- fix(scrollbar): enable bubble when scroll to boundary. fix#2521
- fix: fix error of update theme when series reduce


- perf: optimize the performance of pie chart, fix #2568



## 1.10.4
Wed, 03 Apr 2024 09:30:23 GMT

### Updates

- fix: axis unit in wrong position when hiding the axis domainLine
- fix: fix issue of the order of data is not uniform in stack


- feat: increase chart stacking capabilities, provide stackSort to support sorting when stacking


-  fix: type defination of markArea & markPoint in common chart
- fix: formatMethod of crosshair label runs multiple times, related #2501
- fix: crosshair can't move when axis domain is very small, related #2492
- fix: `updateDataSync` produces inconsistent results compared to direct drawing, related #2503
- refactor: add event params `vchart`, which will updated in lifecycle events, close #2502



## 1.10.3
Thu, 28 Mar 2024 07:09:45 GMT

### Updates

- fix: tooltip cliped if set border width. fix#2471
- feat: support interaction events of `element-select` and `element-highlight`


- fix: `lineWidth` is invalid in rect-type-crosshair, related #2432
- fix: should use `series.getMarkInName` to get the mark for total label's caculation, fixed #2448
- fix: fix the issue of event trigger count after `updateSpecSync()`
- fix: map data will not show if not configured in nameMap
- feat: support `showDefaultName` in map chart to display unmatched name in map data
- fix: axis label missing in the sampled angle axis, related #2439
- fix: tooltip cliped if set border width. fix#2471
- fix: fix radar chart clipAngle animation error when loading on demand.
- fix: fix the release order of _eventDispatcher


- fix: should use series's _seriesMark to calculate total mark, not all series mark names are the same as series.type

## 1.10.2
Tue, 26 Mar 2024 03:13:22 GMT

### Updates

- feat: support interaction events of `element-select` and `element-highlight`


- fix: `lineWidth` is invalid in rect-type-crosshair, related #2432
- fix: should use `series.getMarkInName` to get the mark for total label's caculation, fixed #2448
- fix: fix the issue of event trigger count after `updateSpecSync()`
- fix: fix radar chart clipAngle animation error when loading on demand.

## 1.10.1
Tue, 19 Mar 2024 14:59:23 GMT

### Updates

- fix: upgrade version of vgrammar to fix end state of animation


- fix: `convertDatumToPosition` still return the position of mark that is hidden by legend, related #2340
- fix: the default calculation for the maxLineWidth of outerLabel is incorrect when funnelAlign is not set to center.
- fix: `pie.centerX` & `pie.centerY` do not work, releated #2309
- fix: react vchart tooltip is not displayed by default, related #2404
- feat: register hover/select interaction by default

## 1.10.0
Wed, 13 Mar 2024 04:23:20 GMT

### Updates

- chore: use `rimraf` to replace `rm -rf`


- feat: bar chart supports `autoBandSize` to automatically calculate bandSize based on the incoming configuration such as `barWidth`, thereby affecting the actual length of the axis, related #2268
- feat: stacked bar chart supports the config `stackCornerRadius` to configure the corner radius of stacked bar groups, releated #2185
- feat(dataZoom): enhance when big data and brush releated
- feat(dataZoom): add sampler for preview chart
- feat: support scrollbar in legend
- feat: the theme of the legend supports separate configuration of different themes in different directions, related #2216
- feat: react-vchart supports custom tooltip render, related #2288
- fix: enterable tooltip will not hide when mouse moves directly from the tooltip to a non-chart area, related #2315
- feat: theme supports for configuring series themes in stack state, related #2331
- feat: theme supports custom tokens, related #2255
- feat: tooltip supports the same `lockAfterClick` as crosshair, related #2352
- feat: `x` & `y` of the tooltip position can be fixed separately, related #2320
- feat: add more tooltip shape configs in `tooltip.style` of the chart spec, related #2292
- fix: upgrade version of vgrammar to fix end state of animation


- feat: state style of arc marks support `innerPadding` and `outerPadding`, related #2038
- fix: `tickMask` is invalid in circular progress charts, related #2316
- fix: rect crosshair should lock when lockAfterClick is true


- fix: when region style is empty, should not create _backgroundMark or _foregroundMark
- fix: fixed the issue of being unable to listen to customMark events on vchart
- fix: grid component should not be pickable expect its children
- fix: events on `<Bar />` should not trigged twice


- refactor(react-vchart): refactor react-vchart to support render in strict mode


- fix: plugin should be released in `release()`


- feat: register hover/select interaction by default
- feat: remove advanced interaction in simple bundle

## 1.9.6
Fri, 08 Mar 2024 06:37:04 GMT

### Updates

- feat: support dataKey in CustomMark and ExtensionMark
- feat: support mulity data in waterfal total dimensions


- fix: `animationAppear: false` not work
- fix: fix bug that throws error when setting mark style to invlaid value


- fix: fix the issue of duplicate event registration, fixed #2336
- fix: fixed the issue of being unable to listen to label and totalLabel component events on vchart, `vchart.on('click', { level: 'model', type: 'label' })`
- fix: optimize totoal label position when axis is inversed
- fix: upgrade vrender to 0.17.27, vgrammar to 0.11.15


- fix(scrollbar): click stopped by zoomable. fix#2333

## 1.9.5
Fri, 01 Mar 2024 08:24:59 GMT

### Updates

- feat: support dataKey in CustomMark and ExtensionMark
- feat: support mulity data in waterfal total dimensions


- fix: `animationAppear: false` not work
- fix: optimize totoal label position when axis is inversed

## 1.9.4
Wed, 28 Feb 2024 10:28:52 GMT

### Updates

- fix: `startAngle` and `endAngle` is invalid in polar axis spec, related #2243
- feat: supply pie percent data as `data._percent_`
- fix: fix the issue of axis title'angle does not work, fixed#2270
- fix: axis zero not work beacause of collect data. fix#2226
- fix: rect graphics will be reused when animation is true, and switch direction, the channels must be cleared, fix #2241


- fix: active point should can show in a dual chart, which has two line series, fix #2273


- fix: fix bug of sortDataByAxis not work well in combination chart


- fix: fixed the issue of `ChartEvent` being triggered multiple times, fixed#2276
- fix: marker area xy layout needs to deal with the problem of empty coordinate points
- fix(marker): point and line filter not work. fix#2245
- fix(player): default attr leades to layout error. fix#241
- fix: wordcloud support rect shape. fix#2220

## 1.9.3
Wed, 07 Feb 2024 11:02:59 GMT

### Updates

- feat: supply pie percent data as `data._percent_`
- fix: axis zero not work beacause of collect data. fix#2226
- fix: marker area xy layout needs to deal with the problem of empty coordinate points
- fix(player): default attr leades to layout error. fix#241
- fix: wordcloud support rect shape. fix#2220

## 1.9.2
Mon, 05 Feb 2024 09:28:49 GMT

### Updates

- chore: add react-lynx doc
- fix: bar label issue when position is 'inside-bottom' or 'inside-top'
- fix(block-vchart): in block-vchart demo, the `dpr` acquisition method is wrong and needs to be obtained in real time
- fix: series can read `direction` from chart spec, releated to #2181


- fix(datazom): min and max span not effect. fix#2195
- fix: fixed the problem that multi-layer axis labels are not displayed after closing  tail labels, fixed#2179
- fix: fix polar animation interpolation
- fix(react-vchart): fix the error when `onClick` of `<VChart />` is null, close #2186


- fix: charts should not stack toggle when series has same type but differernt axes, fix 2210


- fix: there is some offset in the position of the dom tooltip shape, related #2188

## 1.9.1
Wed, 31 Jan 2024 07:58:20 GMT

### Updates

- fix: custom mark should run after all the series marks, fix #2156


- fix: interactions should be closed by `option.disableTriggerEvent`


- fix: in the case of multiple band axes in a chart, the same datum corresponds to multiple rows of dimension tooltip content, related #2148
- fix: fix error of vchart in strict-mode


- fix: fix the zero-align of axes, fix #2167

## 1.9.0
Fri, 26 Jan 2024 02:20:43 GMT

### Updates

- feat: axis supports `hasDimensionTooltip` for force specification of dimension tooltip, related #1678
- feat: `triggerOff` of crosshair support number to close crosshair by setTimeout, fix #1676
- fix: fix the bug of crosshair trigger when hover and click are both configed, fix #1574
- feat: the `barBackground` mark in the bar chart supports `fieldLevel` config to indicate whether the `barBackground` mark is displayed at the group level and at which level it is displayed, related #1601
- feat: histogram chart supports bar background, related #1979
- feat: support fitStrategy for indicator
- feat(liquid): liquid chart. close#1158
- feat: band type axis supports multi-layer axis label display
-  feat: support separately configuring interactive for line/area mark in area chart, see #1592
- feat: support `stateSort` of mark, fix #2003
- feat: support customized vrender component in extensionMark


- feat: split tooltip handler into plugins for on-demand importing, related #1397
- fix: tooltip supports content area scrolling, related #2001
- fix: remove label line height in default themes, related #1983
- fix: fix the issue where tooltip content callbacks may not be effective in certain situations, related #1943
- refactor: deprecated `useSyncRender` in react-vchart



## 1.8.10
Thu, 25 Jan 2024 09:18:19 GMT

### Updates

- feat: support innerOffset in vchart cartesian axis


- fix: fix issue of continous color scale, close #2131


- fix: dont return min,max of empty data, fix #1711
- fix: fixed polar coordinate relative axis tickValues acquisition error problem, fixed#2117
- fix: fix the issue mark line is not filter by legend, close #2127
- fix: sequence chart region bind error. fix#2115
- fix: star shapes on dom tooltip do not display correctly, related #1905
- fix: treemap drill event error
-  fix: treemap drill error when turn off the animation

## 1.8.9
Mon, 22 Jan 2024 12:27:45 GMT

### Updates

- feat: support supportsTouchEvents and supportsPointerEvents config
- feat: support `alignSelf` of layout `normal-inline` elements, fix #2072 


- feat: upgrade vrender
- fix: fix bug of crosshair timer, fix #2088


- fix: fix the bugs of axis's onZero property, fixed #2098,#2099
- fix: update animation should exludes `defined` channel

## 1.8.8
Fri, 19 Jan 2024 05:31:20 GMT

### Updates

- feat: enhance scroll effect, closed #2037
- feat: upgrade @visactor/vrender-core to locked 0.17.14
- feat: sankey chart supports disableTriggerEvent configuration


- fix: `area.interactive` in area series spec is not available, related #2030
- fix: fix sortDataByAxis not work after datazoom changed axis


- fix: crosshair should show when `trimPadding` of axis is true, fix #2054


- fix: calculate layer transform for dimension tooltip
- fix: fixed the issue where activePoint does not take effect when the visible configuration of line chart point is false


- fix: different effect when configuring label.overlap:true in #1956
- fix: label position incorrect with region indent
- fix(scroll): event error in lynx env. fix#2041
- fix: map scale ratio not correct after updateSpec or resize
- feat: support new layout type region-relative-overlap


- fix: fix the bug of nice when tickCount is a function, fix #2050



## 1.8.7
Thu, 11 Jan 2024 09:36:17 GMT

### Updates

- fix: mark tooltip not work in rangeColumn chart, closes #1959
- fix(brush): hover not effect when draw a small brush. fix#1985
- feat(markPoint): mark point support item content confine. fix #1573
- feat: support indent in region layout


- fix: fix the problem that indent.top cannot take effect normally


- fix: the crosshair should only be triggered when the point is in some x-axis and y-axis, fix #1954


- fix: fixed the issue where legend filtering fails after customizing data for discrete legends, fixed #1994
- fix: range column chart's `barMinHeight` property does not take effect, closed#1999
- fix: tooltip value is stacked in stacked radar charts, related #450
- fix: fix the onebyone symbol animation order, closes #1932

## 1.8.6
Sat, 06 Jan 2024 05:10:05 GMT

### Updates

- fix: optimize viusal effect for duplicated data in funnel charts, see #1921
- fix: fix error of scatter when the shape is an array, close #1719



## 1.8.5
Wed, 03 Jan 2024 15:19:37 GMT

### Updates

- feat: add zAxis theme and set label space to 0, closed #149
- fix: compute layer translate for crosshair
- fix: optimize funnel clip animation without extensionMarks
- fix: fix the hover state of multiple series, close #1899


- fix: waterfall.label not work in #1897

## 1.8.4
Tue, 02 Jan 2024 11:27:39 GMT

### Updates

- fix: add media query spec interface to default chart spec
- fix: fix the bug of extension mark when no valid animation, fix #1877



## 1.8.3
Fri, 29 Dec 2023 14:44:05 GMT

### Updates

- fix: chart option.animation not work
- feat: add props `useSyncRender` to react-vchart, close #1685


- fix: fix error in strict mode of react-vchart, fix #1669


- feat: Supports the initialization parameter `disableTriggerEvent` to turn off the default interactive effect of the chart


- fix: error in chart level modification of media query action
- fix: dimension tooltip in the dual-dimension chart contains data of only one dimension, related #1841 
- fix: fix bug in layout when band axis has no domain


- fix: funnel clipIn animation has delay for marks which overflows the range of region in #1839
- fix: when marker label's padding is an object, it should work
- refactor: optimize the style configuration of marker
- fix: undefined globalThis in tt miniprogram, see #1854

## 1.8.2
Fri, 22 Dec 2023 12:49:18 GMT

### Updates

- fix: chart option.animation not work
- feat: Supports the initialization parameter `disableTriggerEvent` to turn off the default interactive effect of the chart


- fix: error in chart level modification of media query action

## 1.8.1
Thu, 21 Dec 2023 08:30:03 GMT

### Updates

- fix: improve the stability of spec transformer and media query
-  fix: `select.triggerOff: none` not work

## 1.8.0
Tue, 19 Dec 2023 12:04:29 GMT

### Updates

- feat: add getPoints api in funnel mark attribute context
- fix: fix the api: `getComponentsByKey` not work
- refactor: update datazoom and brush updatecallback, use event
- feat: vchart supports chart-level plugin, related #1784
- feat: new media query plugin to support self-adaptive charts, related #1413
- feat: support optimize config, and auto set disableCheckGraphicWidthOutRange to true
- fix: animation support for gauge pointer series, related #1699
- fix: fix issue with secondary dataflow, closed #1760
- perf: when visible is false, dont parse detail attrs


- feat: remove legacy theme for legends

## 1.7.5
Fri, 15 Dec 2023 08:36:30 GMT

### Updates

- fix(brush): brush release error after update spec. fix#1720
- fix: series should pick `morph` config in chart


- fix: fix type defination of vchart spec in #1486

## 1.7.4
Tue, 12 Dec 2023 07:55:54 GMT

### Updates

- feat: support interaction group in region


- fix: label style not update when change current theme in #1698

## 1.7.3
Wed, 06 Dec 2023 07:34:11 GMT

### Updates

- feat: marker supports `coordinatesOffset` for points adjusting
- feat: markLine supports x,y,y1 y,x,x1 and x,y,x1,y1 position
- feat: markPoint support xy position
-   feat: marker's position property support relative coordinate
- feat: marker's coordinate property supports callback
- fix: fix 3d bar chart with seriesField issue, closed #1646
- fix: fix 3d chart z axis not work noamally issue, closed #1668
- fix: clear old encode when update, fix #1630


- fix: fix the problem that track mark has multiple elements in gauge series, related #1643 
- fix: fix the problem that gaugePointer series doesn't support custom `innerRadius`, related #1644
- refactor: unify `getVRenderComponents` method in Component model
- fix: fix the type error of markArea
- feat: cartesion crosshair's rect width support callback, support #1567
- feat: polar crosshair supports default show
- fix: the outerBorder's color should be equal with labelBackground's fill by default
- fix: fix oneByOne loop animation
- fix: add `align` property for size legend, and fix the issue of the attribute assignment does not take effect, related #1553
- feat: support text omission position configuration `suffixPosition`
- feat: supports `pickStrokeBuffer` style attribute for extending the stroke picking range
- perf: only call `cloneDeepSpec()` when need



## 1.7.2
Wed, 29 Nov 2023 19:03:36 GMT

### Updates

- fix: clear old encode when update, fix #1630


- fix: fix the problem that track mark has multiple elements in gauge series, related #1643 
- fix: fix the problem that gaugePointer series doesn't support custom `innerRadius`, related #1644
- refactor: unify `getVRenderComponents` method in Component model

## 1.7.1
Tue, 28 Nov 2023 08:24:27 GMT

### Updates

- fix: read dataview of extension-mark by `dataId`


- fix: fixed the issue where the layout size of the axis is incorrect when only domainLine is displayed


- fix: fix bug of changed spec when create series


- fix(pie): get center error. fix #1610
- fix: optimize the effect of `tooltip.enterable` that user's pointer can easily enter the tooltip, related #1598

## 1.7.0
Fri, 24 Nov 2023 09:43:25 GMT

### Updates

- feat: support `trimPadding` for band type axis, which used to remove the blank space at both ends of the aixs, closed #1174
- feat: custom mark support animation config
- feat: support customShape of mark


- feat: optimize auto mode of data-zoom, related #1416
- feature: supports registered function expression syntax, related #1187
- feat: enhance marker's position ability
- feat: mark area should support specify x x1 y and y1 both
- feat: add light-mobile and dark-mobile theme, related #1414
- fix: chart padding won't update when switching global theme
- feat: optmize performance of computing data
- feat: support none in component layoutType


- feat: support line/area label
- fix: fix spec modified unexpectedly in data model, details in #1514


- fix: update enableSegements implemention


- perf: dont need to call `attrTransform()` in compilable-mark


- perf: remove getStatisticsDomain()


- perf: dont call bounds calculate when user specify width/height of components
- refactor: refactor the inheritance structure of the chart module to make the layout system independent, details in #1428


- feat: no longer register mobile theme in vchart

## 1.6.7
Tue, 21 Nov 2023 11:02:31 GMT

_Version update only_

## 1.6.6
Fri, 17 Nov 2023 09:42:57 GMT

### Updates

- fix: fix chart screen remains when using updateSpecSync, details in #1421


- fix: is mouse click in empty region, the hover shape should reset, fixed #1538

## 1.6.5
Fri, 17 Nov 2023 05:56:10 GMT

### Updates

- fix: dimension click not effect after update spec. fix #1532
- feat: add `skipFunctionDiff` in react-vchart to skip difference of functions



## 1.6.4
Thu, 16 Nov 2023 06:35:43 GMT

### Updates

- fix: fixed the problem of unreasonable automatic indentation being triggered after modifying the axis range in datazoom


- fix: default realtime not effect in scrollbar and datazoom. fix#1462
- fix: filter mode error when roam in scrollbar and datazoom. fix #1460
- fix: fix `options` can not work in lark-vchart, wx-vchart and tt-vchart


- perf: optimize the dataflow of sankey



## 1.6.3
Fri, 10 Nov 2023 09:56:51 GMT

### Updates

- fix: fix the issue of update animation not work for line mark
- fix: update vgrammar to ~0.8.3  to fix the issue that, vrender should not auto render during renderAsync
-  fix: fix the error when quick release vchart during async render
- fix: tooltip value is forced to wrap when the user globally configures css overflow-warp, related #1446
- perf: optimize the encode performance of sankey



## 1.6.2
Wed, 08 Nov 2023 11:05:21 GMT

### Updates

- fix: tooltip value is forced to wrap when the user globally configures css overflow-warp, related #1446

## 1.6.1
Wed, 08 Nov 2023 05:29:48 GMT

### Updates

- feat: label formatMethod callback add context parmas to provide series object
- feat: add components `<Title />` and `<Indicator />` of react-vchart, close #1424


- fix: `centroidProperty` not work in map chart
- fix: fix incorrect legend filter result caused by animation in #1403
- fix: if layout item is invisible, do not participate in grid layout, related #1425
- fix(marker): aggregation return value infinity problem. fix#1380'

## 1.6.0
Fri, 03 Nov 2023 05:16:41 GMT

### Updates

- feat: add `updateElement` callback in tooltip spec to configure custom tooltip DOM elements based on the default tooltip handler, related #1338
- feat: enable exit animation while updating data
-  feat: support functional label.position config in line/area/scatter/bar series
- feat: load browser or node env code dynamically
- feat: support functional label.position config in line/area/scatter/bar series
- feat: dataScheme supports configuration by distinguishing series directions, related #1209
- feat: data sampling & point overlap. close #460
- fix: react-vchart mode not work
- fix: optimize the trigger of hover in non-browser env
- fix: if series mark is line, return stroke value when user want fill value, fixed #1388
- fix: fix the angle offset in rose dimension tooltip, related #1263
- perf: create Stack and calculate stack attributes when need



## 1.5.4
Mon, 30 Oct 2023 06:09:01 GMT

### Updates

- feat: add bar background mark for bar-like series, related #1154
- fix: unexpected funnel transform ratio label, see #1348
- fix: tooltip value label clipped on lark mini app, related #1346

## 1.5.3
Fri, 27 Oct 2023 06:56:41 GMT

### Updates

- feat: support the exportCanvas api of vchart


- fix: sankey chart downstream highlight, related #1269
- fix(brush): slove first select not effect problem. fix #1129
- fix: new layout method for circle axis label, related #1123
- fix: change default zIndex of axis in gauge chart, related #1122
- fix(datazoom): datazoom location error when resize. fix #520
- fix: slove event off error after release
- fix: fix the issue where invalidType of scatter chart checks x and y at the same time


- fix: fix the issue in markline as min/max aggr result is not correct, see #1261
- fix: fix: fix the issue that the map tooltip title does not display the name from nameMap, see #1260
- fix: sankey supports string value
- fix: fix the issue of crosshair can not trigger in weapp, fixed #1322

## 1.5.2
Tue, 24 Oct 2023 01:48:10 GMT

### Updates

- feat: support the exportCanvas api of vchart


- fix: new layout method for circle axis label, related #1123
- fix: change default zIndex of axis in gauge chart, related #1122
- fix(datazoom): datazoom location error when resize. fix #520
- fix: fix the issue in markline as min/max aggr result is not correct, see #1261
- fix: fix: fix the issue that the map tooltip title does not display the name from nameMap, see #1260

## 1.5.1
Fri, 20 Oct 2023 07:22:00 GMT

### Updates

- feat: add getGraphicBounds api in layoutItem to support get graphic size


- fix: optimized the display of `padAngle` in the gauge series and changed the unit of `padAngle` to angle, related #1215
- feat: optimize the autoindent logic in layout to ensure padding effect is correct


- feat: support `centroidProperty` in map series
- feat: scrollbar enhance zoom & drag & scroll. close #965
- feat: datazoom enhance zoomLock & span config. close #1082
- feat: supply the attributeContext params for customMark's attribute callback
- feat: provide afterLayout event to support users to modify layout effects


- feat: provide datum in the params of `updateContent` callback of tooltip, related #1244
- fix: link 'adjacency' interaction highlighting effect of Sankey Chart is wrong, #1121
- fix: fix the issue of boxplot outlier animation will throw error
- feat: add the default theme (light, dark) of markLine, markArea and funnel series
- fix: fix the duplicate event registration in scrollbar, fixed#1241
- feat: support load environment code on demand
- refactor: add register function for chart/series/component to collect side effect code
- refactor: add register function for animation

## 1.4.3
Tue, 17 Oct 2023 04:00:20 GMT

### Updates

- feat: brush state proxy to state spec
- fix: fix when the legend item only has stroke it cannot be consistent with the graphic color, details in #1147



## 1.4.2
Thu, 12 Oct 2023 11:39:35 GMT

### Updates

- feat: gauge series supports label component, related #1039
- feat: add static tools in `VChart.Utils`
- fix: `tooltipRelease` event may be invalid when being released by VTable
- feat: supports afterResize and afterRender events


- fix(brush): select error when setting brush. fix #1129
- fix: optimize the default performance of the long tooltip title, related #688
- feat: add new config `autoWidth` to the tooltip label style, related #688
- fix: if `markLine` is empty like `{}` or `[]`, it should not create marker component
- fix: fix the issue when use `positions` to create marker component, fixed #1084
- fix(scrollbar): auto visible with linear axis. fix #1118

## 1.4.1
Wed, 27 Sep 2023 07:53:38 GMT

### Updates

- fix: fix updateViewBox api will fail after resize


- feat: optimize updateSpec to avoid additional theme updates


- fix(datazoom): fix bounds error when there is no preview chart. fix #1050
- fix: the rose chart's first sector's startAngle should start from polar coordinate's startAngle, fix #900
- fix: fix `theme.fontFamily` can not work
- fix: fix the problem that updateFullData cannot update data in series



## 1.4.0
Mon, 25 Sep 2023 10:49:42 GMT

### Patches

- feat: access label in map series
- fix: fix the issue of reading onError of null option in #915

### Updates

- feat(sequence): add scrollbar layout spec to sequence. close #792
- feat: linear axis support `tooltipFilterRange` to configure the relative data range of dimension tooltip, related #933
- feat: add vchart to context in params of mark function style


- feat: add default dark theme for scrollBar
- feat: add configure items `bandSize`, `maxBandSize`, `minBandSize` to the spec of band axis, related #263
- feat: support `barMinHeight` for bar series, relate #722
- fix: when stack is false and no `fieldX2` or `fieldY2`, `dataToPositionX1` and `dataToPositionY1` should use 0, close #647
- feat: enhance default wordcloud appear animation, details in #675
- feat: tick mask support for polar progress-like charts, related #596
- fix: label stroke should follow default color when stroke is set to null, detail see #985
- feat: pie label line support smooth
- refactor: split the updateSpec of life cycle to spec transform & compare


- feat(axis): support custom callback for tickCount, see #951
- feat: support `label.confine` for markLine and markPoint to auto adjust label's position, relate https://github.com/VisActor/VChart/issues/699
- fix: `offsetX` and `offsetY` can not work in mark component
- feat: support `minAngle` for pie chart, relate #738
- feat: disable label animation as default in map series 
- fix: sankey chart support color config'
- feat: increase chart stacking capabilities, provide stackValue to support independent stacking of multiple series


- feat: increase chart stacking capabilities, provide stackInverse support for stacking in reverse order


- feat: support `scaleCenter` attribute for mark, see #781
- feat: provide updateModelSpec api, so that users can update the configuration of a chart module individually


- feat: supports deleting all events of the corresponding type without passing through the handler when calling off


- feat: tooltip supports custom shape type, related #496
- feat: tooltip supports custom `spaceRow` for each line, related #949
- feat: tooltip supports custom fixed position relative to the cursor, related #541
- feat: fix issue about updateSpec not work with only data change, details in #912


- refactor: remove unused code, and transform ticks transform to vutils-extension
- feat: support wx env
- fix(brush): style not effect when set mark hover. fix #976
- fix: tooltipHide event may be inavailable when the computer runs slow
- fix: chart pass-through serDataByAxis config to series


- fix: when call updateSpec, the prev scrollbar had not been clear, relate #1044
- fix: add protect for this._spec, fixed #1045
- fix: fix the issue of `seriesId` does not work in legends, closed #910
- fix(datazoom): state scale domain error when domain is locked. fix #629
- fix: fix unoff event when passing through handler


- fix: fix userEvent is added multiple times


- fix: line and area mark should set closePath default, fix #654
- fix: fix the issue of radar area's invalidType not work, fixed #867
- fix: fix invalidType not working after invoking updataDataSync, details in #1057


- fix(marker): marker don not render after updateData. fix #882
- fix: fix the issue of markLine symbol.size not work
- fix: optimize the layout of normal-inline, fixed #989
- refactor: unify the clear of component
- fix: do the product of this._spec, fixed #1062
- fix: fix the issue of progress layout in multi-region
- fix(sequence): render error when dot and link data is empty. fix #1019
- feat: remove compatibility code of threshold


- fix(wordcloud): fontsize renge not effect with no value field. fix #522
- refactor: seperate grid from axis for better layer control
- fix: lock crosshair label to uninteractive, because it will affect axis label's event pick
- refactor: use @visctor/vgrammar-core to replace @visctor/vgrammar


- feat: support wx env

## 1.3.4
Wed, 20 Sep 2023 05:42:12 GMT

### Updates

- fix: circularProgress chart may throw error when executing `updateSpec`, related #994
- fix: the theme in spec does not update correctly when executing `updateSpec`, related #996
- fix: `track` in spec is not working in circularProgress charts, related #600
- fix: fix the error triggered by chart updateSpec, fixed #988, #1002
- fix: fix the issue of player component updateSpec, fixed #967

## 1.3.3
Mon, 18 Sep 2023 03:27:40 GMT

### Updates

- fix: fix the issue of player component updateSpec, fixed #967

## 1.3.2
Thu, 14 Sep 2023 12:36:21 GMT

### Patches

- fix: fix the issue of animation config not work in common chart, related #814

### Updates

- feat: the setDimensionIndex api supports deselecting ability by passing in null


- feat: use precision calculations in waterfall charts to avoid unexpected values for labels, details in #721


- fix(log-axis): log scale has no result about zero when bar stack has a zero baseline value. fix #634
- fix: fix the user event listener becomes invalid after updateSpec


- fix: fix bug of series mark static style are not updated when updateSpec


- fix: fix bug data fields are not updated when updateSpec, details in #829


- feat(scrollBar): interactive default config.
- perf: optimize the performance of dimension-statistics


- perf: only calculate dimensionTree when need



## 1.3.1
Tue, 05 Sep 2023 11:24:47 GMT

### Patches

- fix: fix the issue of `seriesIndex` not work in discrete legend, see #732 

### Updates

- feat: `lineHeight` supports string proportional values, related #744
- fix: move \'SeriesMarkNameEnum\' to single file, solve the issue of codesandbox can not work, it looks like an error in the Codesandbox' bundler, see https://github.com/codesandbox/codesandbox-client/issues/6435
- feat: upgrade vdataset for clone source data when call updateData


- fix: fix axis domain will in the wrong order after buildIn data filter


- fix: fix the issue of legend does not update after updateData, fix #769
- fix: fix the issue of legend's maxHeight not work
- fix: the issue of pie chart with null value, fixed https://github.com/VisActor/VChart/issues/748
- fix: fix the problem that the pie chart draws a full circle when the data is all 0, because the endAngle of the last piece of data is forced to configure the endAngle of polar coordinates

## 1.3.0
Thu, 31 Aug 2023 12:30:59 GMT

### Minor changes

- feat: add `clone` property in `data.parse` to control whether clone the user data
- feat: cartesian axis label support `containerAlign`, relate #380
- feat: tooltip support configure single content line style, related #338
- feat: support total label in stack charts. see #110

### Patches

- feat(invalidType): use the vrender function to realize the break and link of invalidType


- feat: added updateFullData api to allow users to update fields at the same time when updating data, details in #478


- feat: `innerBorder`/`outerBorder` supports the same configuration way as other graphic attributes.
- refactor: access arc label component in pie chart
- feat: add `getRegion()` and `getCenter()` method in _markAttributeContext for `extensionMark`
- feat: new method `pauseAnimation()`, `resumeAnimation()` and `stopAnimation()` which support pausing, resuming and stopping all animation via vchart instance, related #534
- feat: linear axis support `noDecimals` in tick configuration, see #396
- feat: label support dataFilter and custom layout
- feat: new builtin dark theme, related #294
- fix: improve the priority of markByName and mark in theme, related #418
- fix: dimension_hover resets the state when the mouse leaves the chart, related #513
- refactor(area): remove line mark of area-series, merge style into area mark

### Updates

- feat: support label component event in #614
- feat: support configuration of sortDataByAxis for sort series data with axis, details in #644


- feat: new component spec item `noOuterPadding` to hide the outer side of padding, related #663
- fix: dataZoom error when switching theme
- feat: add new property `theme` to vchart init option to configure custom theme without modifying spec, related #689
- feat: add `bandField` and `linearField` as common settings to crosshair's theme, related #698
- feat: enhance dataToPosition in common geo series for #567
- fix: SankeyChart legends not working, fix the bug #345
- feat: geo coordinate component support invert and getScale API
- feat: indicator offsetY support radius
- feat: supplement the callback parameters of discrete legend custom `data` to support obtaining scales, relate #667
- fix: fix the problem that selected clear not work after event filter check for mark


- fix(brush): brush callback not update when updateSpec. fix #672
- fix(brush): highlight was not correct beacasue of same key
- fix(dataZoom): when open roam and set dataZoom invisible, the interaction does not work as expected. fix #611
- feat: optimize the logic of updateSpec to ensure that chart series and components can be updated normally, details in #692


- fix: fix the issue where updateSpec not work when data.id is missing in spec, see #535
- fix: if only `level` is configured in the event filter parameter but `type` is not configured, then as long as the `level` is matched, it will be triggered, relate #623
- refactor: sink the axis label's flush logic to the vrender-component, relate #651
- fix: fix the infinite loop problem caused by arc adjustment, fixed #680
- fix: map label support formatMethod
- fix(marker): add config to control clip mode about marker. fix #181
- fix: fix the issue where bar charts do not stack when percent is set to false, see#557
- fix: fix the problem that the title component clear incompletely.
- perf: dont trigger resize of vgrammar view when initialize chart


- perf: dont create processor and tooltipHandler when create tooltip, create them when use them



## 1.2.3
Thu, 24 Aug 2023 07:23:56 GMT

### Patches

- fix: background will not update when spec or theme updating, related #545
- fix: tooltip shape style incorrect when configure custom key/value, related #336
- fix: when chart size is very small, the size assigned to title may be negative, which needs to be fault-tolerant, otherwise it will easily cause the page to freeze, closed #546
- feat(active): add active point for line & area series to optimization the performance of user interactive



### Updates

- fix: niceDomain should only works for linear scale, fixed #528
- fix: fix the issue of the chart's size is not correctly when updateSpec in lark block env, closed #566
- fix: handle the scenarios of with the same range in continuous legend, fixed #579
- fix: error when configuring `tooltip.parentElement` with a HTMLElement object, related #641
- fix: error when mouse hovering during updateSpec executing
- fix(wordCloud): fix position error of wordCloud chart. fix #521, fix #533
- fix: error when mouse hovering during `updateSpec()` executing.

## 1.2.2
Thu, 17 Aug 2023 02:45:43 GMT

### Patches

- fix: background will not update when spec or theme updating, related #545
- fix: tooltip shape style incorrect when configure custom key/value, related #336
- fix: when chart size is very small, the size assigned to title may be negative, which needs to be fault-tolerant, otherwise it will easily cause the page to freeze, closed #546
- feat(active): add active point for line & area series to optimization the performance of user interactive



## 1.2.1
Tue, 15 Aug 2023 07:25:04 GMT

### Patches

- build: add es5 build product
- feat: the api updateViewBox adds the relayout parameter, which supports not redrawing the chart immediately after updateViewbox, details in #497


- fix(axis-layout): fix the problem that the axis-component cannot take effect after configuring minWidth and maxWidth, details are in #379


- fix(axis-layout): fix the issue of axis move slighty when manual legend filtering, details are in #426


- fix: fix the issue about when axis.label is autoLimit, the chart layout can not work as expect after resize, details in #429


- fix: fix appear animation state fixed #327
- fix: cloneDeep user data, because we should not modify user data
- fix: fix the resize problem in progress chart, fixed #502
- fix: if the size of region is invalid, ignore the wordcloud layout, fixed #506, #410

## 1.2.0
Thu, 10 Aug 2023 05:23:25 GMT

### Minor changes

- feat(logAxis): support axis of type = 'log'. close #392
- feat(vchart): spilt 'finished' event into 'renderFinished' and 'animationEnd' event
- feat: support `barGapInGroup` for bar series and rangeColumn series, used to set the spacing between bars within a group, relate #328
- feat: support \`seriesMark\` for area, line and radar series, which can used to set series main mark, closed #330
- feat: extended data structures supported by sankey chart

### Patches

- feat: support `dataFilter` for axis label and axis tick
- fix: optimize the type definition related to padding on the bandAxis, and it only takes effect on the first layer of scale
- feat: dimension tooltip supports linear axis


- feat: filling full data to map mark data in #420 
- feat(background): support background of chart & series
- feat(onError): support configuration of onerror in chart instance initoption
- feat: supplement sync methods in vchart instance


- feat: support dimension tooltip for time axis, related #437
- feat: add tooltipShow event and tooltipHide event for vchart, related #337
- feat: add attribute dimensionInfo in tooltip handler event params when activeType is mark. related #475
- feat: add a new event type tooltipRelease. related #427
- fix: set the correct return type of `getLegendDataById` and `getLegendDataByIndex`, closed #472
- fix: the non-stack radar area should start from the minimum of radius axis, not o, fix #370
- fix: bar label does not show in the expected position when axis is inversed, fix #378
- fix: fix the issue of the title color configured on the theme does not take effect, fixed #408"
- fix: fix the issue that updateSpec of pie chart causes innerRadius/outerRadius to be incorrect when hovering in #435
- fix: fix the issue of y axis's title can not auto ellipsis, fixed #443, #417
- fix: fix the issue of axis label flush config disable when axis inverse is true, fixed #449
- fix: startAngle and endAngle of polar axis will be reset when executing updateSpec, related #332
- fix: solve the issue that tooltip content is out of bounds in some uncommon case, related #397
- perf(data): add animationThreshold configuration to support automatically close animationa when the amount of data is large
- perf(axis-tick): optimize the calculation times of axis ticks, optimize the discrete axis sampling algorithm


- perf(data): remove redundant data statistics calculations


- perf(stack): use 0 to replace Number.epsilon in stack operation closed #350

### Updates

- feat(logAxis): support axis of type = 'log'. close #392
- feat(logAxis): support axis of type = 'log'. close #392
- feat(logAxis): support axis of type = 'log'. close #392
- feat(logAxis): support axis of type = 'log'. close #392
- feat(marker): marker support formatMethod. fix #288, fix #298
- fix(brush): fix mark can not resume to unselected state when click blank space. fix #307
- fix(brush): fix brush interactive range cannot update when chart is resize. fix #194
- fix(wordCloud): fix wordCloud size error probelm. fix #400, fix #260

## 1.1.3
Thu, 03 Aug 2023 10:32:10 GMT

### Patches

- fix: fix the issue of sankeyChart sourceFiled and targetFiled not working, closed #341
- fix: fix the issue of SankeyChart can't render, when unset nodeAlign, closed #343
- fix: if series.getSeriesField() return undefined, use `DEFAULT_DATA_SERIES_FIELD` to ensure legend data filter, fixed #337"
- fix: fixing the issue where `updateSpec` does not have an effect on map type in #401
- fix: fixing the exception thrown when updating the map updateSpec
- fix: fix bar style could not work in waterfall chart



### Updates

- fix(dataZoom): fix backgroundChart data mapping problem. fix #306 fix #309
- fix(dataZoom): start and end cannot be setted correctly because of judging of data value. fix #334
- fix(wordCloud): word-cloud updateSpec not work as expected. fixed #302

## 1.1.2
Tue, 01 Aug 2023 09:47:58 GMT

### Patches

- feat: geo-coordinate support zoom api
- fix(pie): fix the issue of pie mark's \`key\` value duplication causes drawing error, closed #321
- fix: fix the issue where linearAxis.expand does not work when there are identical data values in #358
- fix: fix the issue of geo source lost
- fix(label): fix the issue that the update of label visible fails to take effect with updateSpec, closed #304
- fix(axis): fix the issue when the min and max of the axes are the same, closed #355

## 1.1.1
Fri, 28 Jul 2023 08:52:08 GMT

### Patches

- feat(logger): support static api `getLogger` in vchart class
- fix(vchart): fix the problem of default logLevel not sync to vgrammar
- fix(map): fix the issue that some map data cannot be drawn
- fix(map): fix the issue of misalignment of the map after interaction with legend
- fix(indicator): add `specKey` for Indicator to fix the issue that the indicator text does not display after the update, close#251
- fix(map): fix the issue that defaultFillColor does not work in map

## 1.1.0
Wed, 26 Jul 2023 03:18:52 GMT

### Minor changes

- support zeroAlign & tick align in two axes
- tooltip supports setting based on mark type and adaptive key
- sync maxLineCount api of 3.x version.
- feat: tooltip supports multiline config

### Patches

- chore: sync version
- chore: remove __DEV__
- fix the issue that mark dimension_hover state causes error when mark visible is false
- add bandwidth attribute to context that in mark function call
- support discrete legend bind scale
- feat: set default logger level to level error


- feat(axis): axis adds `sampling` property, which is used to control whether to enable the axis sampling logic, which is enabled by default
- feat(axis): add anti-overlapping logic for cartesian axis labels
- feat(axis): support \`dataFilter\` property for axis label and tick for data filter
- fix: unified borderRadius to cornerRadius
- fix: not support cornerRadiusXXX anymore, use cornerRadius
- feat: axis's label, tick's state style supports function
- feat: discrete legend's item's style and state style supports function
- feat: add a new api `convertDatumToPosition` for vchart, used for converting data to coordinate position
- feat: add `convertValueToPosition` api for vchart
- feat: modify function parameters to make it more user-friendly


- modify api setDimensionIndex  parameters to make it more user-friendly
- feat(image): support image-mark & add background attribute to fill-mark
- feat: support specified of scale in vchart


- support setDimensionIndex api for vchart
- feat: new config of global unique tooltip
- feat: add 'normal-inline' layoutType
- feat(axis): band type axis support domain property
- feat: add export folder unified export entry
- fix: cartesianAxis and polarAxis are abstract class, should not be imported by users
- refactor: series auto install mark
- refactor: chart auto install series
- feat: add default crosshair config for some cartesian charts
- feat: spec.theme can be a string, which means a registered theme name
- fix the issue that tooltip don't hide when the pointer taps the blank area in mobile mode
- optimize tooltip performance
- feat: optimize tooltip performance
- support unity dimension tooltip of several different series
- optimize tooltip style performance
- fix the default shape config when tooltip pattern has been set to a custom callback
- feat(map): support rewind geojson data
- feat: support poptip for ellipsis text
- feat(vchart): add poptip theme configuration
- fix: remove deprecated maxWidth/minWidth api in tooltip
- fix: pickable shoule be false if label component is configured `interactive: false`


- fix region getSeries bug when option.userId = []
- fix: change mark default stroke color to the series color
- fix discrete legend data sorted by js object attribute order
- fix(global-scale): Correctly update global-scale when updateSpec
- fix: typed chart cannot enable progressive render
- fix: add global-scale updateDomain on chart updateData


- fix(global-scale): add global-scale updateDomain on chart updateData
- fix(data): add miss params of data.parse in chart updateData
- fix barWidth not work in bar chart
- fix: the `type` should be a string
- fix: add isReleased tag for compiler to stop the render after chart's release
- fix(type): add more public methods for IAxis interface
- fix(event): fix the issue that markName filter can not work in event query
- fix(react-vchart): rebind event to chart after chart is re-render, fix #68


- fix: compact the globalThis in non-browser env
- fix: fix the bug in line chart when the xField and yField fields are the same, fixed#108
- fix: the issue that mode value does not exit in trigger config
- fix: delegated events on component models should not participate in bubbling
- feat: delegate the events on marker component
- fix: fix the issue that fieldX2 does not involved in statistics. closed#254
- feat: set default crosshair configuration for radar and rose chart
- fix: fix the bug that linear axis can not show crosshair
- fix: the issue where the legend component is hidden but still affect the layout calculation
- fix: symbol center label not work
- fix(label): pickable shoule be false if label component is configured `interactive: false`
- fix the layoutOffsetX|Y not work in normal items
- fix: line mark has a different easing in update animation causes strange animation effect
- fix: `channel` config not work in animation 
- No longer requires to hold down the Ctrl key for zoom interaction & fix zoomLimit bug
- fix: default tooltip handler needs to adapt to the scale property
- fix(vchart): export IRegionSpec from VChart
- fix(waterfall-position): fix the mistake of compute totalPosition in waterfall-series 
- fix: compact window variable for non-browser env
- fix: compact window variable for non-browser env

### Updates

- feat(marker): markline support autoRange and marker performance enhance
- feat(brush): add operate type about 'brushStart' | 'brushEnd' and export element data of inBrush and outOfBrush
- feat(marker): support interactive
- fix(component): upgrade some spec
- fix(dataZoom): fix bug of datazoom not clear when updateSpec and mark disappear when xField is array
- fix(dataZoom): preview compute and theme config
- fix(wordCloud): angle config not effect
- fix(wordCloud): text clip when layoutmode is fast
- fix(wordCloud): get padding from chartInstance padding

## 1.0.0
Tue, 20 Jun 2023 11:35:37 GMT

### Breaking changes

- chore: release major version

### Patches

- fix the bug of 3d pie label link
- fix the bug of 3d scatter in common chart
- fix the bug of z axis in layout stage
- when set legends's `visible` to false, the legend component should still needs to be instantiated, just not to create vrender components
- if layout model is hidden, igonre the size setting
- wordCloud text should not set default fontSize
- if legend'shape has same value of stroke and fill, then skip stroke
- Change `renderAsync()` to `renderSync()` in `compiler.reRenderAsync()`

### Updates

- reconfig dataZoom color theme
- refactor(marker): optimize performance
- release 0.0.1-alpha.0

