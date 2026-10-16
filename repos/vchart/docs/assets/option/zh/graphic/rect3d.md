{{ target: graphic-rect3d }}

<!-- Canopus 图形属性，IRectGraphicAttribute -->

#${prefix} cornerRadius(number|number[])

矩形的圆角配置，cornerRadius 的值可以是单个数字或者数组，分别指定 4 个方向的圆角大小。

#${prefix} length(number|number[])

矩形的深度（长度）3d 柱子有长宽高三个属性 2d 有宽高属性，所以 3d 多加了一个长度属性 length，代表 z 方向的深度。

{{ use: graphic-attribute(
  prefix = ${prefix},
) }}
