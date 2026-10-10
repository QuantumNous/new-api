{{ target: graphic-rich-text-character }}

<!-- Canopus 图形属性，IRichTextCharacter -->

#${prefix} type='text'

Text style configuration

##${prefix} text(string|number)

Text content.

##${prefix} fill(string)

Fill color. Supports setting to solid color using methods such as` rgb(255,255,255)`, `rgba(255,255,255,1)`, `#fff`, etc.

##${prefix} stroke(string)

Stroke color. Supports setting to solid color using methods such as` rgb(255,255,255)`, `rgba(255,255,255,1)`, `#fff`, etc.

#${prefix} lineWidth(number)

Stroke width.

##${prefix} strokeOpacity(number)

Stroke opacity.

##${prefix} fillOpacity(number)

Fill opacity.

##${prefix} fontSize(number)

Font size.

##${prefix} fontFamily(string)

Font family.

##${prefix} fontWeight(string|number)

The weight of the text font.

Options:

- `'normal'`
- `'bold'`
- `'bolder'`
- `'lighter'`
- `100 | 200 | 300 | 400`...

##${prefix} fontStyle(string) = 'normal'

The style of the text font.

Options:

- `'normal'`
- `'italic'`
- `'oblique'`

##${prefix} underline(boolean)

Enable underline.

##${prefix} lineThrough(boolean)

Enable strike through.

#${prefix} textDecoration(string) = 'none'

Text decoration.

Optional:

- `'none'`
- `'underline'`
- `'line-through'`

#${prefix} script(string) = 'normal'

Script format of the text. Supports superscript and subscript notation.

Options:

- `'normal'`
- `'sub'`
- `'super'`

##${prefix} direction('horizontal'|'vertical') = 'horizontal'

The layout direction of the text. If you need the text to be arranged vertically, you can configure it to 'vertical'.

##${prefix} lineHeight(number)

Line height.

##${prefix} textAlign(string)

Horizontal alignment, values: `'left'`, `'center'`, `'right'`。

##${prefix} textBaseline(string)

Vertical alignment, values: `'top'`, `'middle'`, `'bottom'`。

##${prefix} opacity(number)

Overall transparency.

#${prefix} type='image'

##${prefix} image(string | HTMLImageElement | HTMLCanvasElement)

Image icon, supports configuring url, svg string.

##${prefix} width(number)

Image width.

##${prefix} height(number)

Image height.

##${prefix} margin(number | number[]) = 0

Image margin.

##${prefix} backgroundShowMode(string) = 'always'

Background rectangle display mode.

- `'always'`：always displayed
- `'hover'`：displayed when interacting and hovering

##${prefix} backgroundFill(number)

Background rectangle fill color.

##${prefix} backgroundFillOpacity(number)

Background rectangle fill transparency.

##${prefix} backgroundStroke(string)

Background rectangle border color.

##${prefix} backgroundStrokeOpacity(number)

Background rectangle border transparency.

##${prefix} backgroundRadius(number) = 0

Background rectangle corner radius.

##${prefix} backgroundWidth(number)

Background rectangle width.

##${prefix} backgroundHeight(number)

Background rectangle height.

##${prefix} hoverImage(string | HTMLImageElement | HTMLCanvasElement)

mage when hovering.
