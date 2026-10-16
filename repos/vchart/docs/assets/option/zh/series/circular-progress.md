{{ target: series-circular-progress }}

<!-- ICircularProgressSeriesSpec -->

**环形进度条系列**

{{ use: common-polar-series(
  prefix = ${prefix},
  noType = ${noType},
  noData = ${noData},
  noMorph = ${noMorph},
  useInChart = ${useInChart},
  noCategoryField = true,
  noValueField = true,
  seriesType = 'circularProgress',
  seriesMarks = ['progress', 'track']
) }}

#${prefix} tickMask(Object)
tick 模式显示. 自`1.4.0`版本支持。

##${prefix} angle(number)
单个 tick 的默认宽度，角度值。

##${prefix} offsetAngle(number)
单个 tick 的偏移角度，角度值。

##${prefix} forceAlign(boolean)
tick mask 下的图元是否强制和 tick 的边线对齐。

##${prefix} style(Object)
{{ use: mark-style(
  markName = 'area'
) }}

{{ use: mark-area(
  prefix = '##' + ${prefix}
) }}

#${prefix} clamp(boolean) = false
自`1.13.9`版本支持，超出轴范围是否被裁剪（除tick模式外, 因为tick模式自带裁剪）。

#${prefix} categoryField(string|string[])

类别字段，映射到半径轴。可以声明为数组类型，内部会依次按照声明的字段进行数据分组。

#${prefix} valueField(string)

数值字段，映射到角度轴。

#${prefix} radiusField(string)

半径字段，同`categoryField`，建议统一使用`categoryField`，后续将废弃

#${prefix} maxValue(number)

数据最大值，默认为 1 。

#${prefix} progress(Object)

进度条样式。

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: mark-style(
  markName = 'arc'
) }}

###${prefix} innerPadding(number)

进度条内侧 padding（接受负值）。

###${prefix} outerPadding(number)

进度条外侧 padding（接受负值）。

{{ use: mark-arc(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

{{ use: mark-state-style() }}

#${prefix} track(Object)

背景样式。

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: mark-style(
  markName = 'arc'
) }}

###${prefix} innerPadding(number)

进度条内侧 padding（接受负值）。

###${prefix} outerPadding(number)

进度条外侧 padding（接受负值）。

{{ use: mark-arc(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

{{ use: mark-state-style() }}
