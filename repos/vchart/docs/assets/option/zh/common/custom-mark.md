{{ target: common-custom-mark }}

<!-- ICustomMarkSpec -->

## customMark(Array)

自定义 mark 是图表支持用户在图表上绘制任意内容的自定义接口。目前支持的图形类型如下

- `symbol` 点图形
- `rule` 一个线段，需要指定起点和终点
- `text` 文本
- `rect` 矩形
- `path` 路径
- `arc` 扇区
- `polygon` 多边形
- `image` 图片
- `group` 组，可以将其他 mark 放到组下

注意：布局相关配置自`1.11.0`版本后支持

## customMark.symbol(Object)

图形类型 `symbol`

### type(string) = "symbol"

{{ use: common-custom-mark-base(
  prefix = '##'
) }}

### style(Object)

{{ use: graphic-symbol(
  prefix = '###'
) }}

{{ use: common-layout-item(
  prefix = '##',
  defaultLayoutType = 'none',
  defaultLayoutLevel = 70,
  defaultLayoutZIndex = 500,
  noOrient = true
) }}

## customMark.rule(Object)

图形类型 `rule`

### type(string) = "rule"

必选配置，指定图形类型

{{ use: common-custom-mark-base(
  prefix = '##'
) }}

### style(Object)

{{ use: graphic-rule(
  prefix = '###'
) }}

{{ use: common-layout-item(
  prefix = '##',
  defaultLayoutType = 'none',
  defaultLayoutLevel = 70,
  defaultLayoutZIndex = 500,
  noOrient = true
) }}

## customMark.text(Object)

图形类型 `text`

### type(string) = "text"

必选配置，指定图形类型

{{ use: common-custom-mark-base(
  prefix = '##'
) }}

### style(Object)

{{ use: graphic-text(
  prefix = '###'
) }}

{{ use: common-layout-item(
  prefix = '##',
  defaultLayoutType = 'none',
  defaultLayoutLevel = 70,
  defaultLayoutZIndex = 500,
  noOrient = true
) }}

## customMark.rect(Object)

图形类型 `rect`

### type(string) = "rect"

必选配置，指定图形类型

{{ use: common-custom-mark-base(
  prefix = '##'
) }}

### style(Object)

{{ use: graphic-rect(
  prefix = '###'
) }}

{{ use: common-layout-item(
  prefix = '##',
  defaultLayoutType = 'none',
  defaultLayoutLevel = 70,
  defaultLayoutZIndex = 500,
  noOrient = true
) }}

## customMark.path(Object)

图形类型 `path`

### type(string) = "path"

必选配置，指定图形类型

{{ use: common-custom-mark-base(
  prefix = '##'
) }}

### style(Object)

{{ use: graphic-path(
  prefix = '###'
) }}

{{ use: common-layout-item(
  prefix = '##',
  defaultLayoutType = 'none',
  defaultLayoutLevel = 70,
  defaultLayoutZIndex = 500,
  noOrient = true
) }}

## customMark.arc(Object)

图形类型 `arc`

### type(string) = "arc"

必选配置，指定图形类型

{{ use: common-custom-mark-base(
  prefix = '##'
) }}

### style(Object)

{{ use: graphic-arc(
  prefix = '###'
) }}

{{ use: common-layout-item(
  prefix = '##',
  defaultLayoutType = 'none',
  defaultLayoutLevel = 70,
  defaultLayoutZIndex = 500,
  noOrient = true
) }}

## customMark.polygon(Object)

图形类型 `polygon`

### type(string) = "polygon"

必选配置，指定图形类型

{{ use: common-custom-mark-base(
  prefix = '##'
) }}

### style(Object)

{{ use: graphic-polygon(
  prefix = '###'
) }}

{{ use: common-layout-item(
  prefix = '##',
  defaultLayoutType = 'none',
  defaultLayoutLevel = 70,
  defaultLayoutZIndex = 500,
  noOrient = true
) }}

## customMark.image(Object)

图形类型 `image`

### type(string) = "image"

必选配置，指定图形类型

{{ use: common-custom-mark-base(
  prefix = '##'
) }}

### style(Object)

{{ use: graphic-image(
  prefix = '###'
) }}

{{ use: common-layout-item(
  prefix = '##',
  defaultLayoutType = 'none',
  defaultLayoutLevel = 70,
  defaultLayoutZIndex = 500,
  noOrient = true
) }}

## customMark.group(Object)

图形类型 `group`

### type(string) = "group"

必选配置，指定图形类型

{{ use: common-custom-mark-base(
  prefix = '##'
) }}

### children(Array)

group 作为特殊的 mark。允许在 group 的 children 下配置新的 mark

{{ use: common-layout-item(
  prefix = '##',
  defaultLayoutType = 'none',
  defaultLayoutLevel = 70,
  defaultLayoutZIndex = 500,
  noOrient = true
) }}
