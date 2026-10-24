{{ target: graphic-text-font }}

<!-- Canopus Graphic Attributes, ITextGraphicAttribute -->

#${prefix} text(string|number|Array)

Text content. If an array is passed, it will be displayed with line breaks.

#${prefix} fontSize(number)

Font size.

#${prefix} fontFamily(string)

Font family.

#${prefix} fontWeight(string|number)

The weight of the text font.

Options:

- `'normal'`
- `'bold'`
- `'bolder'`
- `'lighter'`
- `100 | 200 | 300 | 400`...

#${prefix} fontStyle(string) = 'normal'

The style of the text font.

Options:

- `'normal'`
- `'italic'`
- `'oblique'`

#${prefix} fontVariant(string|number)

Same as CSS [font-variant](https://developer.mozilla.org/en-US/docs/Web/CSS/font-variant).

#${prefix} lineHeight(number)

Line height.

#${prefix} textAlign(string)

Horizontal alignment, values: `'left'`, `'center'`, `'right'`, `'start'`, `'end'`.

If it is `'left'`/`'start'`, the leftmost part of the text is at the `x` value. If it is `'right'`/`'end'`, the rightmost part of the text is at the `x` value.

#${prefix} textBaseline(string)

Vertical alignment, values: `'top'`, `'middle'`, `'bottom'`, `'alphabetic'`.

#${prefix} maxLineWidth(number)

The maximum length of the text. If `ellipsis` is not empty, it will be automatically truncated.

#${prefix} ellipsis(boolean|string) = '...'

Effective only when `maxLineWidth` is configured. If text exceeds, should it be automatically abbreviated? If the value is true, the default ellipsis is '...', or you can customize the ellipsis, like `ellipsis: 'etc.'`.

#${prefix} suffixPosition(string) = 'end'

Supported since `1.7.3` version, used to configure the position of text omission, the default is to omit the tail.

- 'start' text header is omitted
- 'middle' omitted from the middle of the text
- 'end' omit the end of the text

#${prefix} underline(boolean)

Enable underline.

#${prefix} lineThrough(boolean)

Enable strikethrough.

#${prefix} direction('horizontal'|'vertical') = 'horizontal'

The layout direction of the text. If you need the text to be arranged vertically, you can configure it to 'vertical'.

#${prefix} wordBreak(string) = 'break-word'
Word break mode.

Options:

- "break-all": Allows breaking words at any character for non-CJK (Chinese/Japanese/Korean) text.
- "break-word": Does not allow breaking words in CJK (Chinese/Japanese/Korean) text, only breaks at half-width spaces or hyphens.
- "keep-all": Does not break words in CJK (Chinese/Japanese/Korean) text. Non-CJK text words are not broken. (Supported since version 1.12.8)

#${prefix} whiteSpace(string) = 'no-wrap'

Whether to wrap

Options

- "no-wrap": Do not wrap
- "normal": Allow wrapping

#${prefix} suffixPosition(string) = 'end'

If the suffix is displayed, the position of the suffix

Options

- "start": The suffix is displayed at the beginning of the text
- "middle": The suffix is displayed in the middle of the text
- "end": The suffix is displayed at the end of the text

#${prefix} keepDirIn3d(boolean)

Whether to always maintain the direction facing the window in 3d mode (if set to false, it will rotate with the viewpoint, if set to true, the direction will always face the window)
