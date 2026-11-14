{{ target: series-dot }}

<!-- IDotSeriesSpec -->

**dot 系列**，可用于绘制时序图。**仅适用于直角坐标系**。

{{ use: common-cartesian-series(
  prefix = ${prefix},
  noType = ${noType},
  noData = ${noData},
  noMorph = ${noMorph},
  useInChart = ${useInChart},
  seriesType = 'dot',
  noPreset = true
) }}

#${prefix} seriesGroupField(string)

系列分组字段，用于区分系列上的grid、symbol的填充和描边逻辑。如果未配置,默认跟随yField字段。

#${prefix} dotTypeField(string)
dot类型字段，用于区分dot的填充逻辑。

#${prefix} titleField(string)
title类型字段，用于显示title。如果未配置，默认跟随yField字段。

#${prefix} subTitleField(string)
subTitle类型字段，用于显示subTitle。如果未配置，默认跟随yField字段。

#${prefix} highLightSeriesGroup(string)
高亮分组配置，用于高亮某个特定类型的系列分组。

#${prefix} name(string)
name字段，用于标记点的name，便于绘制边系列（link series）。

#${prefix} dot(Object)
dot 图元样式配置。

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: mark-style(
  markName = 'dot'
) }}

{{ use: mark-symbol(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

{{ use: mark-state-style() }}

#${prefix} title(Object)
标题样式配置。

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} visible(boolean)
标题可见性配置。

##${prefix} formatMethod(Function)

标题文本格式化配置，使用回调函数的形式配置。

{{ use:text-format-callback(
  description = '标题'
) }}

##${prefix} style(Object)

{{ use: mark-style(
  markName = 'title'
) }}

{{ use: mark-text(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

{{ use: mark-state-style() }}

#${prefix} subTitle(Object)
副标题样式配置。

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} visible(boolean)
副标题可见性配置。

##${prefix} formatMethod(Function)

副标题文本格式化配置，使用回调函数的形式配置。

{{ use:text-format-callback(
  description = '副标题'
) }}

##${prefix} style(Object)

{{ use: mark-style(
  markName = 'subTitle'
) }}

{{ use: mark-text(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

{{ use: mark-state-style() }}


#${prefix} symbol(Object)
标识符图元样式配置。

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: mark-style(
  markName = 'symbol'
) }}

{{ use: mark-symbol(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

{{ use: mark-state-style() }}

#${prefix} grid(Object)
线样式配置。

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} visible(boolean)
线可见性配置。

##${prefix} background(Object)

线背景颜色(进在该系列分组被高亮时生效)

###${prefix} fill(string)
背景颜色。

###${prefix} fillOpacity(number)
背景颜色透明度。

{{ use:text-format-callback(
  description = '线'
) }}

##${prefix} style(Object)

{{ use: mark-style(
  markName = 'grid'
) }}

{{ use: mark-line(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

{{ use: mark-state-style() }}

#${prefix} leftAppendPadding(number)
dot 系列的左边距(主要用于放置title和subTitle)。

#${prefix} clipHeight(number)
dot 系列的可视高度，超出可视高度的部分可以通过鼠标滚动展示。
