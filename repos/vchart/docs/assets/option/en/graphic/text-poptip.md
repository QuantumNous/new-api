{{ target: graphic-text-poptip }}

<!-- TextPoptip -->

#${prefix} poptip(object)
Configuration for the text pop-up box.

##${prefix} position(string)

Position of the text pop-up box, options are:

- `'auto'` Automatic
- `'top'` Top
- `'tl'` Top left
- `'tr'` Top right
- `'bottom'` Bottom
- `'bl'` Bottom left
- `'br'` Bottom right
- `'left'` Left
- `'lt'` Left top
- `'lb'` Left bottom
- `'right'` Right
- `'rt'` Right top
- `'rb'` Right bottom

##${prefix} maxWidth(number)

Maximum width of the text pop-up box in pixels. When the text exceeds the maximum width, it will automatically wrap.

##${prefix} maxWidthPercent(number)

Maximum width percentage of the text pop-up box, with the denominator being the total width of the canvas. When the text exceeds the maximum width, it will automatically wrap.

##${prefix} minWidth(number)

Minimum width of the text pop-up box in pixels. The default value is 30px.

##${prefix} dx(number)
Offset of the text pop-up box in the x direction, in pixels.

##${prefix} dy(number)
Offset of the text pop-up box in the y direction, in pixels.

##${prefix} padding(number|number[]|Object)

{{ use: common-padding(
  componentName='poptip'
) }}

##${prefix} contentStyle(object)
The content style of the text pop-up box, which is implemented through text elements. All properties of text elements can be configured.

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
The method for formatting the content of the pop-up box, defined as follows:

```ts
contentFormatMethod?: (t: string | string[] | number | number[]) => string | string[] | number | number[];
```

##${prefix} panel(object)

Configuration for the background panel of the text pop-up box. The background panel is now implemented through rectangular elements, so it can be configured through the properties of rectangular elements.

###${prefix} space(number)

The spacing between the text pop-up box and the text, in pixels.

###${prefix} cornerRadius(number|number[])

Configuration for the corner radius of the background panel. The value of cornerRadius can be a single number or an array, specifying the corner radius size for four directions respectively.

{{ use: graphic-fill-style(
  prefix = ${prefix} + '##'
) }}

{{ use: graphic-stroke-style(
  prefix = ${prefix} + '##',
  markType = 'rect'
) }}
