{{ target: component-base-legend }}

<!-- ILegendCommonSpec Legend Common Configuration -->

#${prefix} visible(boolean) = true

Whether to show the legend. It's displayed by default and the type defaults to `'discrete'`.

#${prefix} orient(string)

Legend position, optional values: `'left'`, `'top'`, `'right'`, `'bottom'`, which represent left, up, right, and down directions.

#${prefix} position(string) = 'middle'

The alignment of the legend in the current row or column. Start | Middle | End.

- `'start'` Start
- `'middle'` Middle
- `'end'` End

#${prefix} layout('horizontal' | 'vertical')

The layout configuration of the legend component is automatically adjusted according to the display position by default.

1. When `orient` is 'top' or 'bottom', the default is 'horizontal' horizontal layout
2. When `orient` is 'left' or 'right', the default is 'vertical' vertical layout

#${prefix} interactive(boolean) = true

Whether to enable legend interaction, enabled by default.

#${prefix} filter(boolean) = true

Whether to perform data filtering, the default is true. When this property is turned off, the legend click event will not trigger data filtering.

#${prefix} customFilter(Function)

Supported since version `1.13.1`

Custom legend filter callback function, defined as follows:

```
/**
  * Custom filter function
  * @param data Current data
  * @param selectedRange Selected data range
  * @param datumField Field corresponding to the filtered data
  * @returns The final displayed data
  */
 (data: any, selectedRange: StringOrNumber[], datumField: string) => any;
```

#${prefix} title(Object)

Legend title configuration, not displayed by default.

##${prefix} visible(boolean) = false

Whether to display the title, not displayed by default.

##${prefix} text(string|string[]|number|number[])

Legend title content. If a line break is required, use the array format, such as ['abc', '123'].

##${prefix} align(string) = 'start'

The alignment of the title in the current display area. Optional values are: `'start'`, `'center'`, `'end'`, representing start, center, and end.

##${prefix} space(number)

The distance between the title and the legend content.

##${prefix} padding(number|number[]|Object)

{{ use: common-padding(
  componentName='Legend Title'
) }}

##${prefix} textStyle(Object)

Legend text style configuration.

{{ use: graphic-text(
prefix = '##' + ${prefix}
) }}

##${prefix} shape(Object)

The shape configuration of the legend marker, not displayed by default.

###${prefix} visible(boolean) = false

Whether to display, not displayed by default.

###${prefix} space(number)

The spacing between the shape and the text.

###${prefix} style(Object)

The style configuration of the shape, which can configure the shape, size, color, etc.

{{ use: graphic-symbol(
  prefix = '###' + ${prefix}
) }}

##${prefix} background(Object)

The background panel configuration of the title, not displayed by default.

###${prefix} visible(boolean) = false

Whether to draw the title background.

###${prefix} style(Object)

Title background style configuration.

{{
  use: graphic-rect(
    prefix = '###' + ${prefix}
  )
}}

##${prefix} minWidth(number) = 30

The title's minimum width configuration, in pixels.

##${prefix} maxWidth(number)

The title's maximum width configuration, in pixels. When the text exceeds the maximum width, it will be automatically truncated.

#${prefix} background(Object)

Legend background configuration.

##${prefix} visible(boolean) = false

Whether to draw the legend background, not drawn by default.

##${prefix} padding(number|number[]|Object)

{{ use: common-padding(
  componentName='Legend Background'
) }}

##${prefix} style(Object)

Legend background style configuration.

{{
  use: graphic-rect(
    prefix = '##' + ${prefix}
  )
}}
