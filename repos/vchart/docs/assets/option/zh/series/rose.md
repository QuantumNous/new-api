{{ target: series-rose }}

<!-- IRadarSeriesSpec -->

**rose 系列**，用于绘制玫瑰图。**仅适用于极坐标系**。

{{ use: common-polar-series(
  prefix = ${prefix},
  noType = ${noType},
  noData = ${noData},
  noMorph = ${noMorph},
  useInChart = ${useInChart},
  seriesType = 'rose',
  seriesMarks = ['rose'],
  noInvalidType = true,
  preset = 'growAngle' + '|' + 'growRadius' + '|' + 'fadeIn',
  defaultPreset = 'growRadius'
) }}

#${prefix} rose(Object)

rose 图元样式配置。

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

#${prefix} label(Object)

标签配置。

{{ use: component-label(
  prefix = '#' + ${prefix},
) }}

##${prefix} position(string)

自`1.3.0`版本开始支持，标签布局方式。
默认值为`'outside'`。

可选值：

- `'outside'`
- `'inside'`
- `'inside-outer'`
- `'inside-inner'`

##${prefix} offsetRadius(number)

自`1.4.2`版本开始支持，标签距离外半径或内半径的径向偏移值。

如果 `posision` 设为 `'inside-outer'`，则相对于外半径，如果 `posision` 设为 `'inside-inner'`，则相对于内半径。

##${prefix} coverEnable(boolean)

是否允许标签重叠。
默认值为`false`。

##${prefix} rotate(boolean)

是否允许标签旋转。
默认值为`true`。

##${prefix} spaceWidth(number)

文字与引导线间隔宽度。
默认值为`5`。

##${prefix} layoutArcGap(number)

扇区间标签的间隔。
默认值为`6`。

##${prefix} line(Object)

标签引导线样式。

###${prefix} visible(boolean)

是否显示引导线。
默认值为`true`。

###${prefix} line1MinLength(number)

引导线 line1 部分最小长度。
默认值为`20`。

###${prefix} line2MinLength(number)

引导线 line2 部分最小长度。
默认值为`10`。

###${prefix} smooth(boolean)

引导线是否光滑。
默认值为`false`。
从 1.4.0 版本开始支持。

{{ use: common-mark(
  prefix = '##' + ${prefix}
) }}

###${prefix} style(Object)

引导线样式。

{{ use: mark-style(
  markName = 'line'
) }}

{{ use: mark-path(
  prefix = '###' + ${prefix}
) }}

###${prefix} state(Object)

{{ use: mark-state-style() }}

##${prefix} layout(Object)

标签布局配置。

###${prefix} align(string)

标签对齐方式。
默认值为`'arc'`。

可选值：

- `'arc'`
- `'labelLine'`
- `'edge'`

###${prefix} strategy(string)

标签布局策略。
默认值为`'priority'`。

可选值：

- `'priority'`
- `'vertical'`
- `'none'`

###${prefix} tangentConstraint(boolean)

是否启用切线约束。
默认值为`true`。

{{ use: component-label(
  prefix = '#' + ${prefix},
  noPosition = true
) }}
