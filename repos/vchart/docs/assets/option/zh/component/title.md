{{ target: component-title }}

## title(Object)

图表标题配置。

### visible(boolean) = true

是否显示标题。

### text(string|number|Array)

主标题内容。
从 1.7.0 版本开始，支持富文本内容配置。

### textType(string)

从 1.7.0 版本开始，支持主标题文本类型。

可选值：

- 'text'
- 'rich'

### subtext(string|number|Array)

副标题内容。
从 1.7.0 版本开始，支持富文本内容配置。

### subtextType(string)

从 1.7.0 版本开始，支持副标题文本类型。

可选值：

- 'text'
- 'rich'

### orient(string) = 'top'

标题方向。

可选值：

- 'left'
- 'top'
- 'right'
- 'bottom'

### minWidth(number)

标题最小宽度，像素值。

### maxWidth(number)

标题最大宽度，像素值。当文字超过最大宽度时，会自动省略。

### minHeight(number)

标题最小高度，像素值。

### maxHeight(number)

标题最大高度，像素值。

### innerPadding(Object|number) = 0

标题的边距留白。

### align(string) = 'left'

标题文字水平对齐方式。

可选值：

- 'left'
- 'center'
- 'right'

### verticalAlign(string) = 'top'

标题文字垂直对齐方式。

可选值：

- 'top'
- 'middle'
- 'bottom'

### textStyle(Object)

主标题样式。

#### width(number)

主标题宽度。

#### height(number)

主标题高度。

#### align(string) = 'left'

主标题文字水平对齐方式。

可选值：

- 'left'
- 'center'
- 'right'

#### verticalAlign(string) = 'top'

主标题文字垂直对齐方式。

可选值：

- 'top'
- 'middle'
- 'bottom'

#### wordBreak(string) = 'break-word'

主标题折行方式。

可选值：

- "break-all": 允许任意非 CJK（中文/日文/韩文）文本间的单词断行。
- "break-word": 不允许 CJK（中文/日文/韩文）文本中的单词换行，只能在半角空格或连字符处换行。
- "keep-all": CJK（中文/日文/韩文）文本不断行。非 CJK 文本单词不断行。（从 1.12.8 版本开始支持）

#### maxLineWidth(number)

主标题按照宽度限制自动折行或显示省略。
默认设置为标题宽度。

#### heightLimit(number)

主标题高度限制控制显示内容及省略。

#### lineClamp(number)

主标题行数限制显示内容及省略。

#### character(Array)

主标题富文本配置。

{{ use: graphic-rich-text-character(
  prefix = '####'
) }}

{{ use: graphic-text(
  prefix = '###'
) }}

### subtextStyle(Object)

副标题样式。

#### width(number)

副标题宽度。

#### height(number)

副标题高度。

#### align(string) = 'left'

副标题文字水平对齐方式。

可选值：

- 'left': 将文本元素沿容器的左侧对齐。即文本的左边缘与容器的左边缘对齐。
- 'center': 将文本元素在水平方向上居中对齐。即文本在容器中的位置左右对称。
- 'right': 将文本元素沿容器的右侧对齐。即文本的右边缘与容器的右边缘对齐。

#### verticalAlign(string) = 'top'

副标题文字垂直对齐方式。

可选值：

- 'top': 将文本元素放置在容器的顶部位置。即文本上沿与容器顶部对齐。
- 'middle': 将文本元素放置在容器的中间位置。即文本在容器中的位置上下对称。
- 'bottom': 将文本元素放置在容器的底部位置。即文本下沿与容器底部对齐。

#### wordBreak(string) = 'break-word'

副标题折行方式。

可选值：

- "break-all ": 允许任意非 CJK(Chinese/Japanese/Korean)文本间的单词断行。
- "break-word": 不允许 CJK(Chinese/Japanese/Korean)文本中的单词换行，只能在半角空格或连字符处换行。
- “keep-all”: CJK(Chinese/Japanese/Korean) 文本不断行。非 CJK 文本单词不断行

#### maxLineWidth(number)

副标题按照宽度限制自动折行或显示省略。
默认设置为标题宽度。

#### heightLimit(number)

副标题高度限制控制显示内容及省略。

#### lineClamp(number)

副标题行数限制显示内容及省略。

#### character(Array)

副标题富文本配置。

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
