{{ target: series-funnel }}

{{ use: common-series(
  prefix = ${prefix},
  noType = ${noType},
  noData = ${noData},
  seriesType = 'funnel',
  seriesMarks = ['funnel'],
  noMorph = ${noMorph},
  noStack = ${noStack},
  useInChart = ${useInChart},
  preset = 'clipIn' + '|' + 'fadeIn',
  defaultPreset = 'clipIn'
) }}

#${prefix} categoryField(string)
分类字段

#${prefix} valueField(string)
数值字段

#${prefix} funnelOrient(string) = 'top'
漏斗图朝向。默认为 'top'

可选值：

- `'left'`
- `'top'`
- `'right'`
- `'bottom'`

#${prefix} funnelAlign(string) = 'center'
漏斗图对齐方式。默认为 'center'

可选值：

- `'left'`
- `'center'`
- `'right'`

#${prefix} heightRatio(number) = 0.5
自 `1.10.2` 版本支持，漏斗层与转化层的图形高度比例。
仅在转化漏斗图（即 `isTransform: true`）时生效。

#${prefix} shape(string) = 'trapezoid'

漏斗图形状。默认为梯形 'trapezoid'

可选值：

- `'trapezoid'`
- `'rect'`

#${prefix} isTransform(boolean) = false
是否是转化漏斗图。

#${prefix} isCone(boolean) = true
漏斗图最下层是否尖角。shape 为`rect`时不生效

#${prefix} gap(number) = 0
漏斗层之间的像素间隔。

#${prefix} maxSize(number|string) = '80%'
漏斗图最大宽度，支持配置像素值和百分比字符串。

#${prefix} minSize(number|string) = 0
漏斗图最小宽度，支持配置像素值和百分比字符串。

#${prefix} funnel(Object)
漏斗层图元样式设置。

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: mark-style(
  markName = 'funnel'
) }}

{{ use: mark-polygon(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

{{ use: mark-state-style() }}

#${prefix} transform(Object)
转化层样式设置。

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: mark-style(
  markName = 'transform'
) }}

{{ use: mark-polygon(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

{{ use: mark-state-style() }}

#${prefix} label(Object)
标签配置。

##${prefix} limit(number|'shapeSize')
文字长度限制

{{ use: component-label(
  prefix = '#' + ${prefix},
  noPosition = true,
  noOffset = true,
) }}

#${prefix} transformLabel(Object)
转化层标签配置。

##${prefix} limit(number|'shapeSize')
文字长度限制

{{ use: component-label(
  prefix = '#' + ${prefix},
  noPosition = true,
  noOffset = true,
) }}

#${prefix} outerLabel(Object)
漏斗层外部标签配置。

##${prefix} position('left'|'right'|'top'|'bottom') = 'left'
漏斗层外部标签默认位置。
当 funnelOrient 为 'top' 或 'bottom' 时，position 可配置为 'left' 或 'right'，默认为 'left'。
当 funnelOrient 为 'left' 或 'right' 时，position 可配置为 'top' 或 'bottom'，默认为 'bottom'。

##${prefix} alignLabel(boolean) = true
文字是否对齐。

##${prefix} spaceWidth(number) = 5
文字与引导线之间的间距，默认为 5px。

{{ use: component-label(
  prefix = '#' + ${prefix},
  noPosition = true,
  noOffset = true,
) }}

##${prefix} line(Object)
引导线样式设置。

###${prefix} minLength(number) = 20
引导线的最小长度，默认为 20px。自 `1.12.7` 版本支持。

###${prefix} style(Object)

{{ use: graphic-line(
  prefix = '###' + ${prefix}
) }}

###${prefix} state(Object)

{{ use: mark-state-style() }}

#${prefix} transformRatioText(String)

自`1.13.6`版本支持，漏斗图转化层的 tooltip 内置文案，默认为“转化率”中文。
