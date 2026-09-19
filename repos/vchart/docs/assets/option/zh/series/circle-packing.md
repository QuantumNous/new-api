{{ target: series-circle-packing }}

{{ use: common-series(
  prefix = ${prefix},
  noType = ${noType},
  noData = ${noData},
  isHierarchy = true,
  seriesType = 'circlePacking',
  noMorph = ${noMorph},
  noStack = ${noStack},
  useInChart = ${useInChart},
  preset = 'growIn' + '|' + 'fadeIn',
  seriesMarks = ['leaf', 'nonLeaf'],
  defaultPreset = 'growIn'
) }}

#${prefix} categoryField(string)

分类字段。

#${prefix} valueField(string)

权重字段。

#${prefix} layoutPadding(number|Array) = 5
层内边距，支持传入数组，单独控制某一层的内边距。

<!-- 下钻 -->

{{ use: common-drill(
  prefix = ${prefix}
) }}

<!-- Label 图元 -->

#${prefix} label(Object)

标签 图元配置

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: mark-style(
  markName = 'label'
) }}

{{ use: mark-text(
  prefix = '##' + ${prefix}
)}}

##${prefix} state(Object)

{{ use: mark-state-style() }}

<!-- circlePacking 图元 -->

#${prefix} circlePacking(Object)

circlePacking 图元配置

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: mark-style(
  markName = 'circlePacking'
) }}

{{ use: mark-arc(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

{{ use: mark-state-style() }}
