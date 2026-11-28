{{ target: component-axis-domain-line }}

<!-- IDomainLine -->

坐标轴线配置。

#${prefix} visible(boolean) = true

是否显示坐标轴线。

#${prefix} style(Object)

坐标轴线样式设置。

{{ use: graphic-line(
  prefix = '#' + ${prefix}
) }}

#${prefix} state(Object)

坐标轴线在不同交互状态下的样式配置，**当坐标轴开启 hover/select 交互时生效**，目前坐标轴支持如下四种交互状态：

- 1.  hover
- 2.  hover_reverse
- 3.  selected
- 4.  selected_reverse

##${prefix} hover(Object)

元素被 hover 时的样式配置。

{{ use: graphic-line(
  prefix = '##' + ${prefix}
) }}

##${prefix} hover_reverse(Object)

其他元素被 hover 时的样式配置。

{{ use: graphic-line(
  prefix = '##' + ${prefix}
) }}

##${prefix} selected(Object)

元素被选中时的样式配置。

{{ use: graphic-line(
  prefix = '##' + ${prefix}
) }}

##${prefix} selected_reverse(Object)

其他元素被选中时的样式配置。

{{ use: graphic-line(
  prefix = '##' + ${prefix}
) }}
