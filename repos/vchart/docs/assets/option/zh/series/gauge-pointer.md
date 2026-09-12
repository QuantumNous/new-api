{{ target: series-gauge-pointer }}

<!-- IGaugePointerSeriesSpec -->

**gaugePointer 系列**，用于绘制仪表盘指针。**仅适用于极坐标系**。

{{ use: series-progress-like(
  prefix = ${prefix},
  noType = ${noType},
  noData = ${noData},
  noMorph = ${noMorph},
  useInChart = ${useInChart},
  seriesType = 'gaugePointer',
) }}

#${prefix} radiusField(string)

半径字段，可将数据映射到指针长度。（GaugePointerSeries 没有 categoryField）

#${prefix} pointer(Object)

指针图元样式配置，可选配 `rect` 或者 `path` 图元。

##${prefix} type('rect'|'path')

配置 mark 类型。

##${prefix} width(number)

配置宽度。

##${prefix} height(number)

配置高度。

##${prefix} innerPadding(number)

指针靠近圆心的一端离圆心的距离。

##${prefix} outerPadding(number)

指针靠近边缘的一端离边缘的距离。

##${prefix} center([number,number])

中心点坐标。比例值，范围为 0~1。

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} style（rect 版本）(Object)

{{ use: mark-style(
  markName = 'pointer'
) }}

{{ use: graphic-rect(
  prefix = '##' + ${prefix}
) }}

##${prefix} style（path 版本）(Object)

{{ use: mark-style(
  markName = 'pointer'
) }}

{{ use: mark-path(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

{{ use: mark-state-style() }}

#${prefix} pin(Object)

指针图钉前景样式配置。

##${prefix} width(number)

配置宽度。

##${prefix} height(number)

配置高度。

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: mark-style(
  markName = 'pin'
) }}

{{ use: mark-path(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

{{ use: mark-state-style() }}

#${prefix} pinBackground(Object)

指针图钉背景样式配置。

##${prefix} width(number)

配置宽度。

##${prefix} height(number)

配置高度。

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: mark-style(
  markName = 'pinBackground'
) }}

{{ use: mark-path(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

{{ use: mark-state-style() }}
