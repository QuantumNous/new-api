{{ target: component-title }}

## title(Object)

Chart title configuration.

### visible(boolean) = true

Whether to display the title.

### text(string|number|Array)

Maintitle content.
Starting from version 1.7.0, rich text content configuration is supported.

### textType(string)

Starting with version 1.7.0, the main title text type is supported.

Optional values:

- 'text'
- 'rich'

### subtext(string|number|Array)

Subtitle content.
Starting from version 1.7.0, rich text content configuration is supported.

### subtextType(string)

Starting with version 1.7.0, the subtitle text type is supported.

Optional values:

- 'text'
- 'rich'

### orient(string) = 'top'

Title direction.

Optional values:

- 'left'
- 'top'
- 'right'
- 'bottom'

### minWidth(number)

Title's minimum width, in pixels.

### maxWidth(number)

Title's maximum width, in pixels. When the text exceeds the maximum width, it will automatically be truncated.

### minHeight(number)

Title's minimum height, in pixels.

### maxHeight(number)

Title's maximum height, in pixels.

### innerPadding(Object|number) = 0

Title margin space. It supports direct setting of values, or configuration for the top, bottom, left, and right directions separately through an object type.

- number: Units in px, configure all four directions simultaneously
- Object: Object type uses the following

#### left(ILayoutNumber)

Left margin configuration.

#### right(ILayoutNumber)

Right margin configuration.

#### top(ILayoutNumber)

Top margin configuration.

#### bottom(ILayoutNumber)

Bottom margin configuration.

### align(string) = 'left'

Title text horizontal alignment.

Optional values:

- 'left'
- 'center'
- 'right'

### verticalAlign(string) = 'top'

Title text vertical alignment.

Optional values:

- 'top'
- 'middle'
- 'bottom'

### textStyle(Object)

Main title style.

#### width(number)

Main title width.

#### height(number)

Main title height.

#### align(string) = 'left'

Main title text horizontal alignment.

Optional values:

- 'left'
- 'center'
- 'right'

#### verticalAlign(string) = 'top'

Main title text vertical alignment.

Optional values:

- 'top'
- 'middle'
- 'bottom'

#### wordBreak(string) = 'break-word'

Main title line break mode.

Optional values:

- "break-all": Allows any non-CJK (Chinese/Japanese/Korean) text between words to break.
- "break-word": Does not allow CJK (Chinese/Japanese/Korean) text words to wrap, can only wrap at half-width spaces or hyphens.

#### maxLineWidth(number)

Main title auto-wrap or truncate according to the width limit.
Default setting is the title width.

#### heightLimit(number)

Main title height limit to control display content and truncate.

#### lineClamp(number)

Main title line limit to control display content and truncate.

#### character(Array)

Main title rich text configuration.

{{ use: graphic-rich-text-character(
  prefix = '####'
) }}

{{ use: graphic-text(
  prefix = '###'
) }}

### subtextStyle(Object)

Subtitle style.

#### width(number)

Subtitle width.

#### height(number)

Subtitle height.

#### align(string) = 'left'

Subtitle text horizontal alignment.

Optional values:

- 'left': Aligns the text element along the left side of the container. That is, the left edge of the text is aligned to the left edge of the container.
- 'center': Centers the text element horizontally. That is, the text is symmetrically positioned within the container.
- 'right': Aligns the text element along the right side of the container. That is, the right edge of the text is aligned to the right edge of the container.

#### verticalAlign(string) = 'top'

Subtitle text vertical alignment.

Optional values:

- 'top': Places the text element at the top of the container. That is, the upper edge of the text aligns with the top of the container.
- 'middle': Places the text element in the middle of the container. That is, the text is symmetrically positioned within the container.
- 'bottom': Places the text element at the bottom of the container. That is, the lower edge of the text aligns with the bottom of the container.

#### wordBreak(string) = 'break-word'

Subtitle line break mode.

Optional values:

- "break-all ": Allows any non-CJK(Chinese/Japanese/Korean) text between words to break.
- "break-word": Does not allow CJK(Chinese/Japanese/Korean) text words to wrap, can only wrap at half-width spaces or hyphens.
- "keep-all": CJK (Chinese/Japanese/Korean) text does not break. Non-CJK text words do not break.(support since 1.12.8)

#### maxLineWidth(number)

Subtitle auto-wrap or truncate according to the width limit.
Default setting is the title width.

#### heightLimit(number)

Subtitle height limit to control display content and truncate.

#### lineClamp(number)

Subtitle line limit to control display content and truncate.

#### character(Array)

Subtitle rich text configuration.

{{ use: graphic-rich-text-character(
  prefix = '####'
) }}

{{ use: graphic-text(
  prefix = '###'
) }}

{{ use: common-layout-item(
  prefix = '##',
  defaultLayoutType = 'normal',
  defaultLayoutLevel = 50,
  defaultLayoutZIndex = 500,
  noOrient = true
) }}
