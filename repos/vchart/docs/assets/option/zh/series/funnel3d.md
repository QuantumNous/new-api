{{ target: series-funnel3d }}

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

#${prefix} funnel3d(Object)
漏斗层图元样式设置。

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: mark-style(
  markName = 'funnel3d'
) }}

{{ use: mark-polygon(
  prefix = '##' + ${prefix}
) }}

###${prefix} face(boolean[])
由于 3d funnel 在某些视角下会存在一定的问题（canvas2d 难以进行精确的深度测试）所以通过`boolean[]`配置哪些面是可以显示的，数组内的顺序分别为`上下左右前后`

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

###${prefix} style(Object)

{{ use: graphic-line(
  prefix = '###' + ${prefix}
) }}

###${prefix} state(Object)

{{ use: mark-state-style() }}
