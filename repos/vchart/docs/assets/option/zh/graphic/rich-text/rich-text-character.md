{{ target: graphic-rich-text-character }}

<!-- Canopus 图形属性，IRichTextCharacter -->

#${prefix} type='text'

文本样式配置

##${prefix} text(string|number)
文本内容。

##${prefix} fill(string)

填充颜色。支持使用 `rgb(255,255,255)`，`rgba(255,255,255,1)`，`#fff` 等方式设置为纯色。

##${prefix} stroke(string)

描边颜色。支持使用 `'rgb(255,255,255)'`，`'rgba(255,255,255,1)'`，`'#fff'` 等方式设置为纯色。

##${prefix} lineWidth(number)

描边宽度。

##${prefix} fillOpacity(number)

填充透明度。

##${prefix} strokeOpacity(number)

描边透明度。

##${prefix} fontSize(number)

字号。

##${prefix} fontFamily(string)

字体。

##${prefix} fontWeight(string|number)

文字字体的粗细。

可选：

- `'normal'`
- `'bold'`
- `'bolder'`
- `'lighter'`
- `100 | 200 | 300 | 400`...

##${prefix} fontStyle(string) = 'normal'

文字字体的风格。

可选：

- `'normal'`
- `'italic'`
- `'oblique'`

##${prefix} underline(boolean)

是否开启下划线。

##${prefix} lineThrough(boolean)

是否开启删除线。

##${prefix} textDecoration(string) = 'none'

文字的装饰线。

可选：

- `'none'`
- `'underline'`
- `'line-through'`

##${prefix} script(string) = 'normal'

文字的脚本格式。支持上下角标写法。

可选：

- `'normal'`
- `'sub'`
- `'super'`

##${prefix} direction('horizontal'|'vertical') = 'horizontal'

文本的排布方向，如果需要文本纵向排布，可以配置为 'vertical'。

##${prefix} lineHeight(number)

行高。

##${prefix} textAlign(string)

水平对齐方式，取值：`'left'`, `'center'`, `'right'`。

##${prefix} textBaseline(string)

垂直对齐方式，取值：`'top'`, `'middle'`, `'bottom'`。

##${prefix} opacity(number)

整体透明度设置。

<!-- 图片配置 -->

#${prefix} type='image'

##${prefix} image(string | HTMLImageElement | HTMLCanvasElement)

图片 icon，支持配置 url、svg 字符串。

##${prefix} width(number)

图片宽度

##${prefix} height(number)

图片高度

##${prefix} margin(number | number[]) = 0

图片边距。

##${prefix} backgroundShowMode(string) = 'always'

背景矩形显示模式。

- `'always'`：常显
- `'hover'`：交互悬浮时显示

##${prefix} backgroundFill(number)

背景矩形填充颜色

##${prefix} backgroundFillOpacity(number)

背景矩形填充透明度

##${prefix} backgroundStroke(string)

背景矩形边框颜色

##${prefix} backgroundStrokeOpacity(number)

背景矩形边框透明度

##${prefix} backgroundRadius(number) = 0

背景矩形圆角

##${prefix} backgroundWidth(number)

背景矩形宽度

##${prefix} backgroundHeight(number)

背景矩形高度

##${prefix} hoverImage(string | HTMLImageElement | HTMLCanvasElement)

交互悬浮时的图片
