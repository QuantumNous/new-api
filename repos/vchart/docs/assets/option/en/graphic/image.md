{{ target: graphic-image }}

<!-- Canopus IImageGraphicAttribute -->

#${prefix} width(number)

Image width.

#${prefix} height(number)

Image height.

#${prefix} repeatX(string)

The repeat mode for the image in the x direction.

 Optional values:
- `'no-repeat'`
- `'repeat'`
- `'stretch'`

#${prefix} repeatY(string)

The repeat mode for the image in the y direction.

 Optional values:
- `'no-repeat'`
- `'repeat'`
- `'stretch'`

#${prefix} imageMode(string)

Supported since version `2.0.21`. Image drawing mode. Only effective when `repeatX` and `repeatY` both resolve to `no-repeat`.

Optional values:
- `'cover'`: Scale proportionally and crop to cover the whole graphic area
- `'contain'`: Scale proportionally and fit entirely inside the graphic area
- `'fill'`: Stretch to fill the graphic area
- `'auto'`: Draw with the image's intrinsic size

#${prefix} imagePosition(string|Array<string | number>)

Supported since version `2.0.21`. Image anchor position, similar to CSS `background-position`.

Supported forms:
- Single keyword: `'left'`, `'center'`, `'right'`, `'top'`, `'bottom'`
- Preset position: `'top-left'`, `'top-center'`, `'top-right'`, `'center-left'`, `'center'`, `'center-right'`, `'bottom-left'`, `'bottom-center'`, `'bottom-right'`
- Tuple: `[x, y]`, where `x` / `y` can be a number, keyword, or percentage string, for example `['25%', '75%']`

#${prefix} imageScale(number)

Supported since version `2.0.21`. Additional image scale ratio. Only effective when the image is not repeated.

#${prefix} imageOffsetX(number)

Supported since version `2.0.21`. Additional x offset of the image. Only effective when the image is not repeated.

#${prefix} imageOffsetY(number)

Supported since version `2.0.21`. Additional y offset of the image. Only effective when the image is not repeated.

#${prefix} image(string | Object)

Image resource, can be a url, HTMLImageElement, or HTMLCanvasElement.

{{ use: graphic-attribute(
  prefix = ${prefix},
) }}
