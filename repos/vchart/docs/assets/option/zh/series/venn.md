{{ target: series-venn }}

<!-- IVennSeriesSpec -->

**韦恩图系列**，可用于绘制韦恩图。

{{ use: common-series(
  prefix = ${prefix},
  noType = ${noType},
  noData = ${noData},
  seriesType = 'venn',
  seriesMarks = ['circle', 'overlap'],
  noMorph = ${noMorph},
  useInChart = ${useInChart},
  noPreset = ${noPreset},
  preset = 'growIn' + '|' + 'fadeIn' + '|' + 'scaleIn',
  defaultPreset = ${defaultPreset}
) }}

#${prefix} categoryField(string)

分类字段。

#${prefix} valueField(string)

权重字段。

#${prefix} circle(Object)

circle 图元样式配置。

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: mark-style(
  markName = 'arc'
) }}

{{ use: mark-arc(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

{{ use: mark-state-style() }}

#${prefix} overlap(Object)

overlap 图元样式配置。

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: mark-style(
  markName = 'path'
) }}

{{ use: mark-path(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

{{ use: mark-state-style() }}

#${prefix} label(Object)

circle 图元标签样式

{{ use: component-label(
  prefix = '#' + ${prefix},
  noPosition = true,
  noOffset = true,
) }}

#${prefix} overlapLabel(Object)

overlap 图元标签样式

{{ use: component-label(
  prefix = '#' + ${prefix},
  noPosition = true,
  noOffset = true,
) }}
