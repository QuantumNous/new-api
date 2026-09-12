{{ target: graphic-image }}

<!-- Canopus IImageGraphicAttribute -->

#${prefix} width(number)

图片宽度。

#${prefix} height(number)

图片高度。

#${prefix} repeatX(string)

图片在x方向的repeat方式。

可选值：
- `'no-repeat'` 
- `'repeat'` 
- `'stretch'`

#${prefix} repeatY(string)

图片在y方向的repeat方式。

可选值：
- `'no-repeat'`
- `'repeat'` 
- `'stretch'`

#${prefix} imageMode(string)

自 `2.0.21` 版本开始支持。图片绘制模式，仅在 `repeatX` 和 `repeatY` 最终都为 `no-repeat` 时生效。

可选值：
- `'cover'`: 等比缩放并裁剪，覆盖整个图元区域
- `'contain'`: 等比缩放，完整包含在图元区域内
- `'fill'`: 拉伸填满图元区域
- `'auto'`: 按图片原始尺寸绘制

#${prefix} imagePosition(string|Array<string | number>)

自 `2.0.21` 版本开始支持。图片锚定位置，语义类似 CSS `background-position`。

支持以下写法：
- 单关键字：`'left'`、`'center'`、`'right'`、`'top'`、`'bottom'`
- 预设位置：`'top-left'`、`'top-center'`、`'top-right'`、`'center-left'`、`'center'`、`'center-right'`、`'bottom-left'`、`'bottom-center'`、`'bottom-right'`
- 元组：`[x, y]`，其中 `x` / `y` 支持数值、关键字或百分比字符串，例如 `['25%', '75%']`

#${prefix} imageScale(number)

自 `2.0.21` 版本开始支持。图片额外缩放比例，仅在不重复平铺时生效。

#${prefix} imageOffsetX(number)

自 `2.0.21` 版本开始支持。图片在 x 方向上的额外偏移量，仅在不重复平铺时生效。

#${prefix} imageOffsetY(number)

自 `2.0.21` 版本开始支持。图片在 y 方向上的额外偏移量，仅在不重复平铺时生效。

#${prefix} image(string | Object)

图片资源，可传入url、HTMLImageElement 或 HTMLCanvasElement。

{{ use: graphic-attribute(
  prefix = ${prefix},
) }}
