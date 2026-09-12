{{ target: graphic-text-poptip }}

<!-- TextPoptip -->

#${prefix} poptip(object)
文本弹出框的配置。

##${prefix} position(string)

文本弹出框的位置，可选：

- `'auto'` 自动
- `'top'` 顶部
- `'tl'` 左上
- `'tr'` 右上
- `'bottom'` 底部
- `'bl'` 左下
- `'br'` 右下
- `'left'` 左侧
- `'lt'` 左上
- `'lb'` 左下
- `'right'` 右侧
- `'rt'` 右上
- `'rb'` 右下

##${prefix} maxWidth(number)

文本弹出框的最大宽度，单位为像素，当文字超过最大宽度时，会自动换行。

##${prefix} maxWidthPercent(number)

文本弹出框的最大宽度占比，分母为画布的总宽度；当文字超过最大宽度时，会自动换行。

##${prefix} minWidth(number)

文本弹出框的最小宽度，单位为像素。默认值为 30px

##${prefix} dx(number)
文本弹出框的 x 方向的偏移量，单位为像素。

##${prefix} dy(number)
文本弹出框的 y 方向的偏移量，单位为像素。

##${prefix} padding(number|number[]|Object)

{{ use: common-padding(
  componentName='文本弹出框'
) }}

##${prefix} contentStyle(object)

文本弹出框的内容样式，内容是通过文本图元实现的，所有文本图元的属性都可以配置。

{{
  use: graphic-text-font(
    prefix = ${prefix} + '##'
  )
}}

{{ use: graphic-fill-style(
  prefix = ${prefix} + '##'
) }}

{{ use: graphic-stroke-style(
  prefix = ${prefix} + '##',
  markType = 'rect'
) }}

##${prefix} contentFormatMethod(function)

弹出框内容的格式化方法，类型定义如下：

```ts
contentFormatMethod?: (t: string | string[] | number | number[]) => string | string[] | number | number[];
```

##${prefix} panel(object)

文本弹出框的背景面板配置，背景面板现在是通过矩形图元实现的，所以可以通过矩形图元的属性进行配置。

###${prefix} space(number)

文本弹出框与文本的间距，单位为像素。

###${prefix} cornerRadius(number|number[])

背景面板的圆角配置，cornerRadius 的值可以是单个数字或者数组，分别指定 4 个方向的圆角大小

{{ use: graphic-fill-style(
  prefix = ${prefix} + '##'
) }}

{{ use: graphic-stroke-style(
  prefix = ${prefix} + '##',
  markType = 'rect'
) }}
