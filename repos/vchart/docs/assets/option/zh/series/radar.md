{{ target: series-radar }}

<!-- IRadarSeriesSpec -->

**radar 系列**，用于绘制雷达图，包含点线面等配置。**仅适用于极坐标系**。

{{ use: common-polar-series(
  prefix = ${prefix},
  noType = ${noType},
  noData = ${noData},
  noMorph = ${noMorph},
  useInChart = ${useInChart},
  seriesType = 'radar',
  seriesMarks = ['line', 'point','area'],
  preset = 'clipIn' + '|' + 'fadeIn' + '|' + 'grow',
  defaultPreset = 'clipIn'
) }}

#${prefix} seriesMark('point'|'line'|'area') = 'area'

自 `1.2.0` 版本开始支持，用于配置 radar 系列主 mark 类型配置，该配置会影响图例的展示。

#${prefix} point(Object)

点图元样式配置。

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: mark-style(
  markName = 'point'
) }}

{{ use: mark-symbol(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

{{ use: mark-state-style() }}

#${prefix} line(Object)

线图元样式配置。

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: mark-style(
  markName = 'line'
) }}

{{ use: mark-line(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

{{ use: mark-state-style() }}

#${prefix} area(Object)

area 图元样式配置。

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: mark-style(
  markName = 'area'
) }}

{{ use: mark-area(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

{{ use: mark-state-style() }}

#${prefix} label(Object)

标签配置。

{{ use: component-label(
  prefix = '#' + ${prefix},
  defaultOffset = 5,
) }}

#${prefix} markOverlap(boolean) = false
防重叠 - 是否允许标记图形相互覆盖。 自`1.6.0`版本开始支持。

#${prefix} pointDis(number)
防重叠 - 标记点之间的距离，px。 自`1.6.0`版本开始支持。

#${prefix} pointDisMul(number) = 1
防重叠 - 标记点之间的距离，pointSize 的倍数。 自`1.6.0`版本开始支持。
