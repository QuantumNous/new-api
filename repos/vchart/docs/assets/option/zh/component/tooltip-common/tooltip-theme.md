{{ target: component-tooltip-theme }}

<!-- ITooltipTheme -->

#${prefix} panel(Object)

配置 tooltip 背景框样式。

##${prefix} padding(Object)

{{ use: common-padding(
  prefix = '#' + ${prefix},
  componentName = 'tooltip 背景框'
) }}

##${prefix} backgroundColor(string)

**可选** 配置背景色。

##${prefix} border(Object)

**可选** 配置背景框边框。

###${prefix} color(string)

**可选** 配置背景框边框颜色。

###${prefix} width(number)

**可选** 配置背景框边框宽度。

###${prefix} radius(number)

**可选** 配置背景框圆角半径。

##${prefix} shadow(Object)

**可选** 配置背景框阴影。

###${prefix} x(number)

**可选** 配置背景框阴影偏移 x。

###${prefix} y(number)

**可选** 配置背景框阴影偏移 y。

###${prefix} blur(number)

**可选** 配置背景框阴影模糊半径。

###${prefix} spread(number)

**可选** 配置背景框阴影扩展半径。

###${prefix} color(string)

**可选** 配置背景框阴影颜色。

#${prefix} shape(Object)

**可选** 配置 tooltip shape 样式。

##${prefix} size(number)

**可选** 配置 tooltip shape 宽高，和 `shapeSize` 通用。

##${prefix} spacing(number)

**可选** 配置 tooltip shape 与右边相邻元素的水平间距。

{{ use: component-tooltip-shape-pattern(
  prefix = '#' + ${prefix},
  type = 'style'
) }}

#${prefix} titleLabel(Object)

**可选** 配置 tooltip 标题行样式。

{{ use: component-tooltip-text-theme(
  prefix = '#' + ${prefix},
  componentName = 'tooltip 标题行',
  labelType = 'title',
  spacing = false
) }}

#${prefix} keyLabel(Object)

**可选** 配置 tooltip 内容行 key 列样式。

{{ use: component-tooltip-text-theme(
  prefix = '#' + ${prefix},
  componentName = 'tooltip 内容行 key 列',
  labelType = 'key',
  spacing = true
) }}

#${prefix} valueLabel(Object)

**可选** 配置 tooltip 内容行 value 列样式。

{{ use: component-tooltip-text-theme(
  prefix = '#' + ${prefix},
  componentName = 'tooltip 内容行 value 列',
  labelType = 'value',
  spacing = true
) }}

#${prefix} spaceRow(number)

**可选** 配置 tooltip 内容行间距。

#${prefix} maxContentHeight(number)

**可选** 设置最大内容区高度，内容区若超过该高度将显示局部滚动条（适用于 dom tooltip）。自 1.9.0 版本开始支持。


#${prefix} align('left' | 'right')

自 1.11.5 版本开始支持。

**可选** 设置内容的对齐方式：

- 'left': shape、标题、数值从左到右展示，左对齐
- 'right': shape、标题、数值从右到左展示，右对齐

