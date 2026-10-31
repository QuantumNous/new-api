{{ target: graphic-rich-text }}

<!-- Canopus IRichTextGraphicAttribute -->

#${prefix} width(number)

Rich text container width.

#${prefix} height(number)

Rich text container height.

#${prefix} ellipsis(boolean|string)

Text ellipsis method when exceeding the container scope.

#${prefix} wordBreak(string) = 'break-all'

Rich text line wrap mode.

Optional values:

- `'break-word'`: Wrap between words
- `'break-all'`: Wrap between any characters

#${prefix} verticalDirection(string)

Rich text text alignment direction.

Optional values:

- `'top'`
- `'middle'`
- `'bottom'`

#${prefix} maxHeight(number)

Rich text container minimum height.

#${prefix} maxWidth(number)

Rich text container minimum width.

#${prefix} textAlign(string)

Rich text text alignment mode.

Optional values:

- `'left'`: Left aligned
- `'right'`: Right aligned
- `'center'`: Center aligned

#${prefix} textBaseline(string)

Rich text text baseline.

Optional values:

- `'top'`
- `'middle'`
- `'bottom'`

#${prefix} layoutDirection(string) = 'horizontal'

Rich text text layout direction.

Optional values:

- `'horizontal'`: Horizontal arrangement
- `'vertical'`: Vertical arrangement

#${prefix} singleLine(boolean)

Whether the rich text is arranged in a single line or not.

#${prefix} textConfig(Array)

Rich text text configuration.

{{ use: graphic-rich-text-character(
  prefix = '#' + ${prefix},
) }}

<!-- Supports only regular text configurations, which will be inherited by textConfig. -->

#${prefix} fontSize(number)

Font size. The configuration in all text paragraphs will be overridden by the configuration in `textConfig`.

#${prefix} fontFamily(string)

Font family. The configuration in all text paragraphs will be overridden by the configuration in `textConfig`.

#${prefix} fontWeight(string|number)

Font weight of the text. The configuration in all text paragraphs will be overridden by the configuration in `textConfig`.

Optional:

- `'normal'`
- `'bold'`
- `'bolder'`
- `'lighter'`
- `100 | 200 | 300 | 400`...

#${prefix} fontStyle(string) = 'normal'

FontStyle.

Optional:

- `'normal'`
- `'italic'`
- `'oblique'`

#${prefix} fill(string)

Fill color. Supports setting to solid color using methods such as `rgb(255,255,255)`, `rgba(255,255,255,1)`,` #fff`, etc.
The configuration in all text paragraphs will be overridden by the configuration in `textConfig`.

#${prefix} stroke(string)

Stroke color. Supports setting to solid color using methods such as `rgb(255,255,255)`, `rgba(255,255,255,1)`,` #fff`, etc.
The configuration in all text paragraphs will be overridden by the configuration in `textConfig`.

#${prefix} lineWidth(number)

Stroke width. The configuration in all text paragraphs will be overridden by the configuration in `textConfig`.

#${prefix} fillOpacity(number)

Fill Opacity. The configuration in all text paragraphs will be overridden by the configuration in `textConfig`.

#${prefix} strokeOpacity(number)

Stroke opacity. The configuration in all text paragraphs will be overridden by the configuration in `textConfig`.
