{{ target: component-continuous-legend }}

<!-- IContinuousLegendSpec -->

#${prefix} field(string)

可选，声明关联的映射字段。

#${prefix} scale(string)

可选，连续图例关联的映射 scale id（该 scale 需要通过[全局 scale](todo) 的配置生成，即 `spec.scales`），如果没有指定则默认根据图例的类型自动匹配。

#${prefix} slidable(boolean) = true

是否开启滑动交互。

#${prefix} inverse(boolean)

自 1.11.0 版本支持

是否开启反向

#${prefix} defaultSelected(Array)

设置图例初始化时默认选中的图例项。数组中的元素为默认筛选的数据范围，如 `[0, 100]` 表示默认筛选出数值在 0 ~ 100 之间的数据。

#${prefix} rail(Object)

滑动轨道的配置。

##${prefix} width(number)

滑动轨道的宽度。

##${prefix} height(number)

滑动轨道的高度。

##${prefix} style(Object)

滑动轨道的样式配置。

{{ use: graphic-rect(
  prefix = '##' + ${prefix}
) }}

#${prefix} handler(Object)

滑动操作手柄的配置。

##${prefix} visible(boolean) = true

是否展示滑动操作手柄。默认展示。

##${prefix} style(Object)

滑动操作手柄的样式配置。

{{ use: graphic-symbol(
  prefix = '##' + ${prefix}
) }}

#${prefix} track(Object)

滑块选中区域的样式设置。

##${prefix} style(Object)

滑块选中区域的样式配置。

{{ use: graphic-rect(
  prefix = '##' + ${prefix}
) }}

#${prefix} startText(Object)

图例轨道左侧文本的配置。

##${prefix} visible(boolean) = false

是否展示图例轨道左侧文本。

##${prefix} text(string)

图例轨道左侧文本的内容。

##${prefix} space(number) = 6

图例轨道左侧文本与滑块的间距。

##${prefix} style(Object)

图例轨道左侧文本的样式配置。

{{ use: graphic-text(
  prefix = '##' + ${prefix}
) }}

#${prefix} endText(Object)

图例轨道右侧文本的配置。

##${prefix} visible(boolean) = false

是否展示图例轨道右侧文本。

##${prefix} text(string)

图例轨道右侧文本的内容。

##${prefix} space(number) = 6

图例轨道右侧文本与滑块的间距。

##${prefix} style(Object)

图例轨道右侧文本的样式配置。

{{ use: graphic-text(
  prefix = '##' + ${prefix}
) }}

#${prefix} handlerText(Object)

滑块操作按钮上的文本配置。

##${prefix} visible(boolean) = false

是否展示滑块操作按钮上的文本。

##${prefix} precision(number)

数据展示的小数精度，默认为 0，无小数点。

##${prefix} formatter(Function)

数据展示的格式化函数。函数定义为：`(text: string) => string`。

##${prefix} space(number) = 6

滑块操作按钮上的文本与滑块的间距。

##${prefix} style(Object)

滑块操作按钮上的文本的样式配置。

{{ use: graphic-text(
  prefix = '##' + ${prefix}
) }}

{{ use: component-base-legend(
  prefix = ${prefix}
) }}
