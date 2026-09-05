{{ target: component-axis-title }}

<!-- ITitle -->

轴标题配置。

#${prefix} visible(boolean) = false

是否显示轴标题。

#${prefix} type(string)

自 1.7.0 版本开始支持，文本类型。

可选：

- 'text'
- 'rich'

#${prefix} text(string|number|(string|number)[])

标题的文本内容。
自 1.7.0 版本开始，支持富文本内容

#${prefix} position(string)

可选参数：

- `'middle'`
- `'start'`
- `'end'`

标题的显示位置。

- 直角坐标系默认 'middle'。
- 极坐标系的圆弧轴如果配置了内半径，则默认 'middle'，否则 'end'。

#${prefix} space(number)

标题距离坐标轴(轴线、刻度、标签共同构成的包围盒)的距离。

#${prefix} padding(number|number[]|Object)

标题内边距配置。

{{ use: common-padding(
  componentName = '轴标题'
) }}

#${prefix} angle(number)

标题整体的旋转角度（如果标题配置了 background、shape 等属性的话，需要使用该属性进行整体的配置旋转）。

#${prefix} style(Object)

轴标题样式设置。

{{ use: graphic-text(
  prefix = '#' + ${prefix}
) }}

#${prefix} state(Object)

轴标题在不同交互状态下的样式配置，**当坐标轴开启 hover/select 交互时生效**，目前坐标轴支持如下四种交互状态：

- 1.  hover
- 2.  hover_reverse
- 3.  selected
- 4.  selected_reverse

##${prefix} hover(Object)

元素被 hover 时的样式配置。

{{ use: graphic-text(
  prefix = '##' + ${prefix}
) }}

##${prefix} hover_reverse(Object)

其他元素被 hover 时的样式配置。

{{ use: graphic-text(
  prefix = '##' + ${prefix}
) }}

##${prefix} selected(Object)

元素被选中时的样式配置。

{{ use: graphic-text(
  prefix = '##' + ${prefix}
) }}

##${prefix} selected_reverse(Object)

其他元素被选中时的样式配置。

{{ use: graphic-text(
  prefix = '##' + ${prefix}
) }}

#${prefix} background(Object)

标题背景色设置。

##${prefix} visible(boolean) = false

是否绘制标题背景。

##${prefix} style(Object)

标题背景样式设置。

{{ use: graphic-rect(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

标题背景在不同交互状态下的样式配置，**当坐标轴开启 hover/select 交互时生效**，目前坐标轴支持如下四种交互状态：

- 1.  hover
- 2.  hover_reverse
- 3.  selected
- 4.  selected_reverse

###${prefix} hover(Object)

元素被 hover 时的样式配置。

{{ use: graphic-rect(
  prefix = '###' + ${prefix}
) }}

###${prefix} hover_reverse(Object)

其他元素被 hover 时的样式配置。

{{ use: graphic-rect(
  prefix = '###' + ${prefix}
) }}

###${prefix} selected(Object)

元素被选中时的样式配置。

{{ use: graphic-rect(
  prefix = '###' + ${prefix}
) }}

###${prefix} selected_reverse(Object)

其他元素被选中时的样式配置。

{{ use: graphic-rect(
  prefix = '###' + ${prefix}
) }}

#${prefix} shape(Object)

标题内标记配置。

##${prefix} visible(boolean) = false

是否绘制标题标记。

##${prefix} space(number)

shape 同标题文本之间的间距。

##${prefix} style(Object)

标题标记样式设置。

{{ use: graphic-symbol(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

标题标记在不同交互状态下的样式配置，**当坐标轴开启 hover/select 交互时生效**，目前坐标轴支持如下四种交互状态：

- 1.  hover
- 2.  hover_reverse
- 3.  selected
- 4.  selected_reverse

###${prefix} hover(Object)

元素被 hover 时的样式配置。

{{ use: graphic-symbol(
  prefix = '###' + ${prefix}
) }}

###${prefix} hover_reverse(Object)

其他元素被 hover 时的样式配置。

{{ use: graphic-symbol(
  prefix = '###' + ${prefix}
) }}

###${prefix} selected(Object)

元素被选中时的样式配置。

{{ use: graphic-symbol(
  prefix = '###' + ${prefix}
) }}

###${prefix} selected_reverse(Object)

其他元素被选中时的样式配置。

{{ use: graphic-symbol(
  prefix = '###' + ${prefix}
) }}
