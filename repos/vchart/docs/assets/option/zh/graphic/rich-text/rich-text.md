{{ target: graphic-rich-text }}

<!-- Canopus IRichTextGraphicAttribute -->

#${prefix} width(number)

富文本容器宽度。

#${prefix} height(number)

富文本容器高度。

#${prefix} maxHeight(number) = Infinity

最大高度

#${prefix} maxWidth(number) = Infinity

最大宽度

#${prefix} ellipsis(boolean|string) = false

超出容器范围后文字的省略方式。

#${prefix} wordBreak(string) = 'break-all'

富文本文字折行方式。

可选值：

- `'break-word'`: 在单词间折行
- `'break-all'`: 可在任意字符间折行

#${prefix} verticalDirection(string)

富文本文字对齐方向。

可选值：

- `'top'`
- `'middle'`
- `'bottom'`

#${prefix} maxHeight(number)

富文本容器最小高度。

#${prefix} maxWidth(number)

富文本容器最小宽度。

#${prefix} textAlign(string)

富文本文字对齐方式。

可选值：

- `'left'`: 左对齐
- `'right'`: 右对齐
- `'center'`: 居中对齐

#${prefix} textBaseline(string)

富文本文字基线。

可选值：

- `'top'`
- `'middle'`
- `'bottom'`

#${prefix} layoutDirection(string) = 'horizontal'

富文本文字排列方向。

可选值：

- `'horizontal'`: 横排
- `'vertical'`: 纵排

#${prefix} singleLine(boolean) = false

富文本是否单行排列。

#${prefix} textConfig(Array)

富文本文字配置。

{{ use: graphic-rich-text-character(
  prefix = '#' + ${prefix},
) }}

<!-- 支持部分文字常规配置，会被 textConfig 继承 -->

#${prefix} fontSize(number)

字号。配置于所有文字段落的，会被 `textConfig` 中的配置覆盖。

#${prefix} fontFamily(string)

字体。。配置于所有文字段落的，会被 `textConfig` 中的配置覆盖。

#${prefix} fontWeight(string|number)

文字字体的粗细。配置于所有文字段落的，会被 `textConfig` 中的配置覆盖。

可选：

- `'normal'`
- `'bold'`
- `'bolder'`
- `'lighter'`
- `100 | 200 | 300 | 400`...

#${prefix} fontStyle(string) = 'normal'

文字字体的风格。

可选：

- `'normal'`
- `'italic'`
- `'oblique'`

#${prefix} fill(string)

填充颜色。支持使用 `rgb(255,255,255)`，`rgba(255,255,255,1)`，`#fff` 等方式设置为纯色。
配置于所有文字段落的，会被 `textConfig` 中的配置覆盖。

#${prefix} stroke(string)

描边颜色。支持使用 `'rgb(255,255,255)'`，`'rgba(255,255,255,1)'`，`'#fff'` 等方式设置为纯色。
配置于所有文字段落的，会被 `textConfig` 中的配置覆盖。

#${prefix} lineWidth(number)

描边宽度。配置于所有文字段落的，会被 `textConfig` 中的配置覆盖。

#${prefix} fillOpacity(number)

填充透明度。配置于所有文字段落的，会被 `textConfig` 中的配置覆盖。

#${prefix} strokeOpacity(number)

描边透明度。配置于所有文字段落的，会被 `textConfig` 中的配置覆盖。
