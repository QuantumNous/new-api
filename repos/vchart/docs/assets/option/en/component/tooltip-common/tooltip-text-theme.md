{{ target: component-tooltip-text-theme }}

<!-- ITooltipTextTheme -->

#${prefix} fontFamily(string)

**Optional** Configure the font family for ${componentName}.

#${prefix} fontSize(number)

**Optional** Configure the font size for ${componentName}.

#${prefix} fontColor(string)

**Optional** Configure the font color for ${componentName}.

#${prefix} fontWeight(string|number)

**Optional** Configure the font weight for ${componentName} (property values can refer to CSS `fontWeight`).

#${prefix} textAlign('left'|'right'|'center')

**Optional** Configure the text alignment for ${componentName}.

#${prefix} textBaseline('top'|'bottom'|'middle'|'alphabetic')

**Optional** Configure the text baseline for ${componentName}.

#${prefix} lineHeight(number)

**Optional** Configure the line height for ${componentName}.

#${prefix} multiLine(boolean) = false

**Optional** Configure whether ${componentName} supports line breaks.

#${prefix} maxWidth(number)

**Optional** Configure the maximum width for ${componentName}.

#${prefix} wordBreak(string) = 'break-word'

**Optional** Configuration for the line break mode of ${componentName}, with the following three modes:

- "break-all ": Allows any non-CJK(Chinese/Japanese/Korean) text between words to break.
- "break-word": Does not allow CJK(Chinese/Japanese/Korean) text words to wrap, can only wrap at half-width spaces or hyphens.
- "keep-all": CJK (Chinese/Japanese/Korean) text does not break. Non-CJK text words do not break.(support since 1.12.8)

{{ if: ${labelType} === 'title' }}

#${prefix} autoWidth(boolean) = false

**Optional** Configure whether ${componentName} is adaptive to width. Supported since version 1.4.2.

`autoWidth` defaults to `false`. If configured as `true`, the tooltip title will maintain the same width as the tooltip content.

{{ /if }}

{{ if: ${labelType} === 'value' }}

#${prefix} autoWidth(boolean) = true

**Optional** Configure whether ${componentName} is adaptive to width. Supported since version 1.4.2.

`autoWidth` defaults to 'true'. If configured as `true`, the tooltip value label will automatically fill the remaining portion of the overall width of the tooltip.

{{ /if }}

{{ if: ${spacing} }}

#${prefix} spacing(number)

**Optional** Configure the horizontal spacing between ${componentName} and its adjacent element on the right.

{{ /if }}
