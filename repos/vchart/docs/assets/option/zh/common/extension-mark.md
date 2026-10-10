{{ target: common-extension-mark }}

<!-- IExtensionMarkSpec -->

#${prefix} extensionMark(Array)

extensionMark 是图表支持用户在图表系列上补充绘制任意内容的自定义接口。目前支持的图形类型如下

- `symbol` 点图形
- `rule` 一个线段，需要指定起点和终点
- `text` 文本
- `rect` 矩形
- `path` 路径
- `arc` 扇区
- `polygon` 多边形
- `image` 图片
- `group` 组，可以将其他 mark 放到组下

#${prefix} extensionMark.symbol(Object)

图形类型 `symbol`

##${prefix} type(string) = "symbol"

{{ use: common-custom-mark-base(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: graphic-symbol(
  prefix = '##' + ${prefix}
) }}

#${prefix} extensionMark.rule(Object)

图形类型 `rule`

##${prefix} type(string) = "rule"

必选配置，指定图形类型

{{ use: common-custom-mark-base(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: graphic-rule(
  prefix = '##' + ${prefix}
) }}

#${prefix} extensionMark.text(Object)

图形类型 `text`

##${prefix} type(string) = "text"

必选配置，指定图形类型

{{ use: common-custom-mark-base(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: graphic-text(
  prefix = '##' + ${prefix}
) }}

#${prefix} extensionMark.rect(Object)

图形类型 `rect`

##${prefix} type(string) = "rect"

必选配置，指定图形类型

{{ use: common-custom-mark-base(
  prefix ='#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: graphic-rect(
  prefix = '##' + ${prefix}
) }}

#${prefix} extensionMark.path(Object)

图形类型 `path`

##${prefix} type(string) = "path"

必选配置，指定图形类型

{{ use: common-custom-mark-base(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: graphic-path(
  prefix = '##' + ${prefix}
) }}

#${prefix} extensionMark.arc(Object)

图形类型 `arc`

##${prefix} type(string) = "arc"

必选配置，指定图形类型

{{ use: common-custom-mark-base(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: graphic-arc(
  prefix = '##' + ${prefix},
  markType = 'arc'
) }}

#${prefix} extensionMark.polygon(Object)

图形类型 `polygon`

##${prefix} type(string) = "polygon"

必选配置，指定图形类型

{{ use: common-custom-mark-base(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: graphic-polygon(
  prefix = '##' + ${prefix}
) }}

#${prefix} extensionMark.image(Object)

图形类型 `image`

##${prefix} type(string) = "image"

必选配置，指定图形类型

{{ use: common-custom-mark-base(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: graphic-image(
  prefix = '##' + ${prefix}
) }}

#${prefix} extensionMark.group(Object)

图形类型 `group`

##${prefix} type(string) = "group"

必选配置，指定图形类型

{{ use: common-custom-mark-base(
  prefix = '#' + ${prefix}
) }}

##${prefix} children(Array)

group 作为特殊的 mark。允许在 group 的 children 下配置新的 mark
