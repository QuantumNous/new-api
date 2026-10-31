{{ target: component-base-legend }}

<!-- ILegendCommonSpec 图例通用配置 -->

#${prefix} visible(boolean) = true

是否显示图例。默认显示，并且类型默认为 `'discrete'`。

#${prefix} orient(string)

图例位置，可选值：`'left'`, `'top'`, `'right'`, `'bottom'`，分别代表左、上、右、下四个方向。

#${prefix} position(string) = 'middle'

图例在当前行列的对齐方式。

- `'start'` 起始
- `'middle'` 居中
- `'end'` 末尾。

#${prefix} layout('horizontal' | 'vertical')

图例组件的布局配置，默认自动跟随显示位置进行调整。

1. `orient` 为 'top' 或者 'bottom' 时，默认为 'horizontal' 水平布局
2. `orient` 为 'left' 或者 'right' 时，默认为 'vertical' 垂直布局

#${prefix} interactive(boolean) = true

是否开启图例的交互，默认开启。

#${prefix} filter(boolean) = true

是否进行数据筛选，默认为 true。该属性关闭之后，图例的点击事件将不会触发数据筛选。

#${prefix} customFilter(Function)

自 `1.13.1`版本开始支持

自定义图例筛选的回调函数，类型定义如下：

```
/**
   * 自定义筛选函数
   * @param data 当前数据
   * @param selectedRange 选中的数据范围
   * @param datumField 筛选数据对应的字段
   * @returns 最终展示的数据
   */
 (data: any, selectedRange: StringOrNumber[], datumField: string) => any;
```

#${prefix} title(Object)

图例标题配置，默认不显示。

##${prefix} visible(boolean) = false

是否显示 title，默认不显示。

##${prefix} text(string|string[]|number|number[])

图例标题内容，如果需要进行换行，则使用数组形式，如 ['abc', '123']。

##${prefix} align(string) = 'start'

标题在当前显示区域的对齐方式，可选值为：`'start'`, `'center'`, `'end'`，分别代表起始、居中、末尾。

##${prefix} space(number)

标题与图例内容的距离。

##${prefix} padding(number|number[]|Object)

{{ use: common-padding(
  componentName='图例标题'
) }}

##${prefix} textStyle(Object)

图例文本样式配置。

{{ use: graphic-text(
prefix = '##' + ${prefix}
) }}

##${prefix} shape(Object)

图例标记的图形配置，默认不显示。

###${prefix} visible(boolean) = false

是否显示，默认不显示。

###${prefix} space(number)

shape 同 文本的间距。

###${prefix} style(Object)

shape 的样式配置，可以配置 shape 的形状、大小、颜色等。

{{ use: graphic-symbol(
  prefix = '###' + ${prefix}
) }}

##${prefix} background(Object)

标题的背景面板配置，默认不显示。

###${prefix} visible(boolean) = false

是否绘制标题背景。

###${prefix} style(Object)

标题背景样式配置。

{{
  use: graphic-rect(
    prefix = '###' + ${prefix}
  )
}}

##${prefix} minWidth(number) = 30

标题最小的宽度配置，单位 px。

##${prefix} maxWidth(number)

标题最大的宽度配置，像素值。当文字超过最大宽度时，会自动省略。

#${prefix} background(Object)

图例整理背景配置。

##${prefix} visible(boolean) = false

是否绘制图例背景，默认不绘制。

##${prefix} padding(number|number[]|Object)

{{ use: common-padding(
  componentName='图例背景'
) }}

##${prefix} style(Object)

图例背景样式配置。

{{
  use: graphic-rect(
    prefix = '##' + ${prefix}
  )
}}
