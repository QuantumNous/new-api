{{ target: series-liquid }}

<!-- ILiquidSeriesSpec -->

**水波系列**，可用于绘制水波图。

{{ use: common-cartesian-series(
  prefix = ${prefix},
  noType = ${noType},
  noData = ${noData},
  noMorph = ${noMorph},
  useInChart = ${useInChart},
  seriesType = 'liquid',
  seriesMarks = ['liquid', 'liquidBackground', 'liquidOutline'],
  preset = 'grow' + '|' + 'wave' + '|' + 'waveGrow',
  defaultPreset = 'wave'
) }}

#${prefix} valueField(string)

value字段。

#${prefix} maskShape(string) = 'circle'

轮廓形状。

可选值: 
- `'drop'`
- `'circle'`
- `'cross'`
- `'diamond'`
- `'square'`
- `'arrow'`
- `'arrow2Left'`
- `'arrow2Right'`
- `'wedge'`
- `'thinTriangle'`
- `'triangle'`
- `'triangleUp'`
- `'triangleDown'`
- `'triangleRight'`
- `'triangleLeft'`
- `'stroke'`
- `'star'`
- `'wye'`
- `'rect'`

#${prefix} outlineMargin(Object|number|number[])

外轮廓与region边界之间的padding。

#${prefix} outlinePadding(Object|number|number[])

内轮廓与外轮廓之间的padding。

#${prefix} indicatorSmartInvert(boolean) = false

当存在指标卡时, 是否开启指标智能反色。

#${prefix} reverse(boolean) = false

自1.11.10版本支持, 图形是否从上往下绘制。

#${prefix} liquid(Object)

liquid 图元样式配置。

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: mark-style(
  markName = 'liquid'
) }}

{{ use: mark-liquid(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

{{ use: mark-state-style() }}

#${prefix} liquidBackground(Object)

liquid 背景图元样式配置。

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: mark-style(
  markName = 'liquidBackground'
) }}

{{ use: mark-group(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

{{ use: mark-state-style() }}

#${prefix} liquidBackground(Object)

liquid 外轮廓图元样式配置。

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: mark-style(
  markName = 'liquidOutline'
) }}

{{ use: mark-group(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

{{ use: mark-state-style() }}

