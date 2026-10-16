{{ target: graphic-rect }}

<!-- Canopus 图形属性，IRectGraphicAttribute -->

#${prefix} cornerRadius(number|number[])

矩形的圆角配置，cornerRadius 的值可以是单个数字或者数组，分别指定 4 个方向的圆角大小。

#${prefix} width(number)
宽度。

#${prefix} height(number)
高度。

{{ use: graphic-attribute(
  prefix = ${prefix},
) }}
