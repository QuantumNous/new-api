{{ target: component-data-zoom }}

## dataZoom(Array)

缩略轴配置。

### valueField(string)

背景趋势线对应的字段。

### startText(string)

起点文字样式配置。

#### padding(number)

起点文字外边距配置。

#### style(Object)

起点文字文本样式配置。

{{ use: graphic-text(
  prefix = '####'
) }}

#### formatMethod(Function)

起点文字格式化配置，使用回调函数的形式配置。

{{ use:text-format-callback(
  description = '起点文字'
) }}

### endText(string)

终点文字样式配置。

#### padding(number)

终点文字外边距配置。

#### style(Object)

终点文字文本样式配置。

{{ use: graphic-text(
  prefix = '####'
) }}

#### formatMethod(Function)

终点文字格式化配置, 使用回调函数的形式配置。

{{ use:text-format-callback(
  description = '终点文字'
) }}

### brushSelect(string) = true

是否开启框选，如果不开启则支持 selectedBackground 拖拽（框选和拖拽两者互斥）。

### showDetail(string | boolean) = 'auto'

是否显示起点文字和终点文字。

### middleHandler(Object)

中间手柄样式。

#### visible(boolean) = false

中间手柄是否可见。

#### icon(Object)

中间手柄的中点图标。

##### style(Object)

中间手柄的中点图标样式。

{{ use: graphic-symbol(
  prefix = '#####'
) }}

#### background(Object)

中间手柄的背景矩形。

##### size(number)

中间手柄背景矩形的尺寸（当缩略轴为横向时，该尺寸代表高度；同理，当缩略轴为纵向时，该尺寸代表宽度）。

##### style(Object)

中间手柄背景矩形的样式。

{{ use: graphic-rect(
  prefix = '#####'
) }}

### background(Object)

缩略轴的背景矩形。

#### size(Object)

缩略轴背景矩形的尺寸（当缩略轴为横向时，该尺寸代表高度；同理，当缩略轴为纵向时，该尺寸代表宽度）。

#### style(Object)

缩略轴背景矩形的样式。

{{ use: graphic-rect(
  prefix = '####'
) }}

### startHandler(Object)

缩略轴的起点手柄。

#### style(Object)

起点手柄的样式。

{{ use: graphic-symbol(
  prefix = '####'
) }}

### endHandler(Object)

缩略轴的终点手柄。

#### style(Object)

终点手柄的样式。

{{ use: graphic-symbol(
  prefix = '####'
) }}

### dragMask(Object)

缩略轴的拖拽轨迹图元。

#### style(Object)

拖拽轨迹图元的样式。

{{ use: graphic-rect(
  prefix = '####'
) }}

### selectedBackground(Object)

缩略轴的选中部分背景。

#### style(Object)

选中部分背景的样式。

{{ use: graphic-rect(
  prefix = '####'
) }}

### showBackgroundChart(boolean)

自**1.11.3**版本开始支持
是否显示背景图

### backgroundChart(Object)

缩略轴的预览图表。

#### line(Object)

缩略轴的预览图表描边。

##### style(Object)

预览图表描边的样式。

{{ use: graphic-line(
  prefix = '#####'
) }}

#### area(Object)

缩略轴的预览图表填充。

##### style(Object)

预览图表填充的样式。

{{ use: graphic-polygon(
  prefix = '#####'
) }}

### selectedBackgroundChart(Object)

缩略轴的选中部分预览图表。

#### line(Object)

缩略轴的选中部分预览图表描边。

##### style(Object)

选中部分预览图表描边的样式。

{{ use: graphic-line(
  prefix = '#####'
) }}

#### area(Object)

缩略轴的选中部分预览图表填充。

##### style(Object)

选中部分预览图表填充的样式。

{{ use: graphic-polygon(
  prefix = '#####'
) }}

### ignoreBandSize(boolean)

是否忽略轴上配置的固定 bandSize。自 1.7.0 版本开始支持。

如果置为 true，则 datazoom 可以任意改变轴的 bandSize。但如果轴上配置了 bandSize 范围，则第一次渲染会保持 bandSize 在配置范围内。

该配置仅在 `auto` 设为 true 时生效。

### tolerance(number)

背景图表节点压缩率, 如果不配置则默认将节点限制在 10000 个。自 1.10.0 版本开始支持。

{{ use: component-data-filter-base(
  prefix = '##'
) }}
