{{ target: graphic-fill-style }}

<!-- IFillStyle -->

#${prefix} fill(string|Object)

填充颜色。支持使用 `rgb(255,255,255)`，`rgba(255,255,255,1)`，`#fff` 等方式设置为纯色，也支持设置为渐变色填充。

- 渐变色使用

{{ use: graphic-gradient }}

#${prefix} fillOpacity(number)

填充透明度。

#${prefix} shadowBlur(number)

图形阴影的模糊大小。该属性配合 shadowColor,shadowOffsetX, shadowOffsetY 一起设置图形的阴影效果。

示例：

```ts
{
  shadowColor: 'rgba(0, 0, 0, 0.5)',
  shadowBlur: 10
}
```

#${prefix} shadowColor(string)

阴影颜色。

#${prefix} shadowOffsetX(number)

阴影水平方向上的偏移距离。

#${prefix} shadowOffsetY(number)

阴影垂直方向上的偏移距离。

#${prefix} background(string|HtmlImageElement|HtmlCanvasElement)

自`1.2.0`版本开始支持，图形的背景配置，可以配置为纯色、图片元素或canvas元素。

> 注意配置为图片地址时，透明度受 `fillOpacity` 影响，请务必配置 `fillOpacity`

使用示例:

```
// 直接设置颜色
// color name
background: 'red';
// HEX
background: '#ff0000';
// rgb or rgba
background: 'rgba(255,0,0,0.5)';

// 设置为图片背景
const svgImage = '<svg width="26" height="26" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg" href="/" style="height: 24px; width: 24px; margin-right: 10px;"><path fill-rule="evenodd" clip-rule="evenodd" d="M13 0C20.1797 0 26 5.8203 26 13C26 14.1592 25.8483 15.283 25.5636 16.3525L18.2377 4.25581H18.2291C17.5709 3.254 16.4371 2.59256 15.1489 2.59256C13.8606 2.59256 12.7268 3.254 12.0686 4.25581H12.0599L11.9686 4.41693C11.951 4.44707 11.9337 4.47747 11.9169 4.50815L3.88731 18.6779C3.56947 19.2224 3.38736 19.8558 3.38736 20.5318C3.38736 21.1089 3.52009 21.655 3.75667 22.1412C1.43409 19.7928 0 16.5639 0 13C0 5.8203 5.8203 0 13 0ZM6.27755 24.1292C6.53287 24.1852 6.79812 24.2147 7.07026 24.2147C9.10427 24.2147 10.7532 22.5658 10.7532 20.5318C10.7532 19.8794 10.5835 19.2667 10.286 18.7353L10.2879 18.7345L8.49328 15.6288C7.52634 13.954 8.10016 11.8124 9.77496 10.8455C11.4498 9.87854 13.5913 10.4524 14.5582 12.1272L20.8887 22.8559L20.8912 22.8548C20.9571 22.962 21.0284 23.0655 21.1045 23.1651C18.8821 24.9394 16.0649 26 13 26C10.5397 26 8.23908 25.3166 6.27755 24.1292Z" fill="#0040FF"></path></svg>'
// svg
background: svgImage,
// image url
background: 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/chart-3d/area3d.png',

// 完整配置路径
const spec = {
  region: [
    {
      style: {
        background:'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/chart-3d/area3d.png',
        // 请务必配置透明度
        fillOpacity: 1
      }
    }
  ]
}

```

#${prefix} backgroundMode(string)

背景填充模式，与具体图元有关。可选值：

- `'repeat'`: 平铺背景
- `'repeat-x'`: 水平方向平铺
- `'repeat-y'`: 垂直方向平铺
- `'no-repeat'`: 不平铺
- `'no-repeat-cover'`: 自 `2.0.21` 版本开始支持，不平铺，等比缩放并覆盖整个图元区域
- `'no-repeat-contain'`: 自 `2.0.21` 版本开始支持，不平铺，等比缩放并完整包含在图元区域内
- `'no-repeat-fill'`: 自 `2.0.21` 版本开始支持，不平铺，拉伸填满图元区域
- `'no-repeat-auto'`: 自 `2.0.21` 版本开始支持，不平铺，按图片原始尺寸绘制

#${prefix} backgroundPosition(string|Array<string | number>)

自 `2.0.21` 版本开始支持。背景图锚定位置，语义类似 CSS `background-position`，仅在图片背景且最终为 `no-repeat` 时生效。

支持以下写法：

- 单关键字：`'left'`、`'center'`、`'right'`、`'top'`、`'bottom'`
- 预设位置：`'top-left'`、`'top-center'`、`'top-right'`、`'center-left'`、`'center'`、`'center-right'`、`'bottom-left'`、`'bottom-center'`、`'bottom-right'`
- 元组：`[x, y]`，其中 `x` / `y` 支持数值、关键字或百分比字符串，例如 `['25%', '75%']`

#${prefix} backgroundFit(boolean)

是否正好填充背景，只在 `repeat-x`、`repeat-y` 或 `no-repeat` 模式下生效。

#${prefix} backgroundKeepAspectRatio(boolean)

是否保持背景图的宽高比。

#${prefix} backgroundScale(number)

背景图缩放比例，只在 `no-repeat` 模式下生效。

#${prefix} backgroundOffsetX(number)

背景图水平方向偏移，只在 `no-repeat` 模式下生效。

#${prefix} backgroundOffsetY(number)

背景图垂直方向偏移，只在 `no-repeat` 模式下生效。

#${prefix} backgroundClip(boolean)

背景图是否裁切，是否调用 clip 避免绘制到图元外部。

#${prefix} backgroundCornerRadius(number|Array<number>)

背景圆角半径。可以配置为：

- 数值：统一设置四个角的圆角
- 数组：分别设置 [左上, 右上, 右下, 左下] 四个角的圆角

#${prefix} backgroundOpacity(number)

背景透明度，取值范围 0-1。
