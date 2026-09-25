{{ target: graphic-fill-style }}

<!-- IFillStyle -->

#${prefix} fill(string|Object)

Fill color. Supports setting to pure color in ways like `rgb(255,255,255)`, `rgba(255,255,255,1)`, `#fff`, and also supports setting to gradient color fill.

- Gradient color usage

{{ use: graphic-gradient }}

#${prefix} fillOpacity(number)

Fill opacity.

#${prefix} shadowBlur(number)

The blur size of the graphic shadow. This property is used together with shadowColor, shadowOffsetX, and shadowOffsetY to set the shadow effect of the graphic.

Example:

```ts
{
  shadowColor: 'rgba(0, 0, 0, 0.5)',
  shadowBlur: 10
}
```

#${prefix} shadowColor(string)

Shadow color.

#${prefix} shadowOffsetX(number)

The offset distance of the shadow in the horizontal direction.

#${prefix} shadowOffsetY(number)

The offset distance of the shadow in the vertical direction.

#${prefix} background(string|HtmlImageElement|HtmlCanvasElement)

Supported since `1.2.0` version, background configuration for graphics, which can be configured as a pure color, image element, or canvas element.

> Note that when configured as an image address, the transparency is affected by `fillOpacity`, please be sure to configure `fillOpacity`

Example usage:

```
// set with color string
// color name
background: 'red';
// HEX
background: '#ff0000';
// rgb or rgba
background: 'rgba(255,0,0,0.5)';

// set with image
const svgImage = '<svg width="26" height="26" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg" href="/" style="height: 24px; width: 24px; margin-right: 10px;"><path fill-rule="evenodd" clip-rule="evenodd" d="M13 0C20.1797 0 26 5.8203 26 13C26 14.1592 25.8483 15.283 25.5636 16.3525L18.2377 4.25581H18.2291C17.5709 3.254 16.4371 2.59256 15.1489 2.59256C13.8606 2.59256 12.7268 3.254 12.0686 4.25581H12.0599L11.9686 4.41693C11.951 4.44707 11.9337 4.47747 11.9169 4.50815L3.88731 18.6779C3.56947 19.2224 3.38736 19.8558 3.38736 20.5318C3.38736 21.1089 3.52009 21.655 3.75667 22.1412C1.43409 19.7928 0 16.5639 0 13C0 5.8203 5.8203 0 13 0ZM6.27755 24.1292C6.53287 24.1852 6.79812 24.2147 7.07026 24.2147C9.10427 24.2147 10.7532 22.5658 10.7532 20.5318C10.7532 19.8794 10.5835 19.2667 10.286 18.7353L10.2879 18.7345L8.49328 15.6288C7.52634 13.954 8.10016 11.8124 9.77496 10.8455C11.4498 9.87854 13.5913 10.4524 14.5582 12.1272L20.8887 22.8559L20.8912 22.8548C20.9571 22.962 21.0284 23.0655 21.1045 23.1651C18.8821 24.9394 16.0649 26 13 26C10.5397 26 8.23908 25.3166 6.27755 24.1292Z" fill="#0040FF"></path></svg>'
// svg
background: svgImage,
// image url
background: 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/chart-3d/area3d.png',

// full configuration path
const spec = {
  region: [
    {
      style: {
        background:'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/chart-3d/area3d.png',
        // Please be sure to configure transparency
        fillOpacity: 1
      }
    }
  ]
}

```

#${prefix} backgroundMode(string)

Background fill mode, related to specific graphic elements. Optional values:

- `'repeat'`: Tile the background
- `'repeat-x'`: Tile horizontally
- `'repeat-y'`: Tile vertically
- `'no-repeat'`: No tiling
- `'no-repeat-cover'`: Supported since version `2.0.21`. No repeat, scale proportionally and cover the whole graphic area
- `'no-repeat-contain'`: Supported since version `2.0.21`. No repeat, scale proportionally and fit entirely inside the graphic area
- `'no-repeat-fill'`: Supported since version `2.0.21`. No repeat, stretch to fill the graphic area
- `'no-repeat-auto'`: Supported since version `2.0.21`. No repeat, draw with the image's intrinsic size

#${prefix} backgroundPosition(string|Array<string | number>)

Supported since version `2.0.21`. Background image anchor position, similar to CSS `background-position`. Only effective when the background is an image and the final mode is `no-repeat`.

Supported forms:

- Single keyword: `'left'`, `'center'`, `'right'`, `'top'`, `'bottom'`
- Preset position: `'top-left'`, `'top-center'`, `'top-right'`, `'center-left'`, `'center'`, `'center-right'`, `'bottom-left'`, `'bottom-center'`, `'bottom-right'`
- Tuple: `[x, y]`, where `x` / `y` can be a number, keyword, or percentage string, for example `['25%', '75%']`

#${prefix} backgroundFit(boolean)

Whether to fit the background exactly, only effective in `repeat-x`, `repeat-y`, or `no-repeat` mode.

#${prefix} backgroundKeepAspectRatio(boolean)

Whether to maintain the aspect ratio of the background image.

#${prefix} backgroundScale(number)

Background image scale, only effective in `no-repeat` mode.

#${prefix} backgroundOffsetX(number)

Background image horizontal offset, only effective in `no-repeat` mode.

#${prefix} backgroundOffsetY(number)

Background image vertical offset, only effective in `no-repeat` mode.

#${prefix} backgroundClip(boolean)

Whether the background image is clipped, whether to call clip to avoid drawing outside the graphic element.

#${prefix} backgroundCornerRadius(number|Array<number>)

Background corner radius. Can be configured as:

- Number: Uniformly set the corner radius for all four corners
- Array: Set corner radius for [top-left, top-right, bottom-right, bottom-left] individually

#${prefix} backgroundOpacity(number)

Background opacity, value range 0-1.
