{{ target: series-word-cloud3d }}

<!-- IWordCloudSeriesSpec -->

**wordCloud3d 系列**，用于绘制 3d 词云图。**仅适用于直角坐标系**。

{{ use: common-cartesian-series(
  prefix = ${prefix},
  noType = ${noType},
  noData = ${noData},
  noMorph = ${noMorph},
  useInChart = ${useInChart},
  seriesType = 'wordCloud',
  seriesMarks = ['word'],
) }}

#${prefix} nameField(string)

文本字段。

#${prefix} valueField(string)

权重字段。

#${prefix} fontFamilyField(string)

字体字段。

#${prefix} fontWeightField(string)

字重字段。

#${prefix} fontStyleField(string)

字体样式字段。

#${prefix} colorHexField(string)

直接指定 hex 颜色字段。

#${prefix} colorMode(string)

颜色模式。

可选值：

<!-- - `'linear'`: 线性着色（待开放） -->

- `'ordinal'`: 序数着色

#${prefix} colorList(Array)

颜色列表。

#${prefix} rotateAngles(Array)

可旋转角度 随机取范围列表。

#${prefix} fontWeightRange(Array)

字重范围，需要固定字重大小的话，数组里面的数就配置成一样的。

#${prefix} fontSizeRange(Array|string)

字体大小范围，需要固定字体大小的话，数组里面的数就配置成一样的。

当 valueField 存在时，默认值[20,40]; 当 valueField 不存在时，默认值[10, 10]。

自 1.8.7 版本支持'auto'配置。即如果配置为'auto', 则 fontSizeRange 不传入, 字体大小会随画布大小改变而改变。

#${prefix} maskShape(string)

词云形状，url 或 svg 字符串 或 base64，或内值字符串（svg 字符串、base64 暂未支持）。

内值字符串可选值：

- `'triangleForward'`: 右箭头
- `'triangle'`: 三角形
- `'diamond'`: 菱形
- `'square'`: 方形
- `'star'`: 星形
- `'cardioid'`: 心形
- `'circle'`: 圆形
- `'pentagon'`: 五角形
- `rect`: 矩形（自 1.9.3 版本支持）

#${prefix} random(boolean)

是否开始随机摆放方向(顺时针｜逆时针)。

#${prefix} wordCloudConfig(Object)

词云特殊配置（仅当词云的 maskShape 未指定 或 maskShape 为 shape 字符串时生效。

##${prefix} drawOutOfBound(string) = 'hidden'

超长文本省略策略，超出画布。

可选值：

- `'clip'`: 绘制超长文本，超出画布的部分裁剪掉
- `'hidden'`: 不绘制超长文本
- `'ellipsis'`: 绘制超长文本，且使用用户指定的字符串代替超出的文本（暂未支持）

##${prefix} ellipsis(Object)

省略文本的配置。

###${prefix} string(string) = '...'

超长文本替代字符串。

###${prefix} limitLength(number) = '...'

限制长度，超过该长度的部分展示用户指定字符串。

##${prefix} zoomToFit(Object)

自适应缩放配置。

###${prefix} shrink(boolean)

是否缩小。

###${prefix} enlarge(boolean)

是否放大。

###${prefix} fontSizeLimitMin(number)

缩小的最小字号，shrink: true 时生效。

###${prefix} fontSizeLimitMax(number)

放大的最大字号，enlarge: true 时生效。

##${prefix} layoutMode(string)

布局模式。

可选值：

- `'fast'`: 快速布局，用于小程序 & 小组件环境
- `'grid'`: 基于 grid 像素布局
- `'default'`: 基于像素布局

##${prefix} progressiveTime(number)

渐进式渲染配置 - 布局时间。

##${prefix} progressiveStep(number)

渐进式渲染配置 - 布局次数。

#${prefix} wordCloudShapeConfig(Object)

词云特殊配置（仅当词云的 maskShape 为 url、base64 或 svg 字符串时生效）。

##${prefix} fillingColorList(Array)

填充词 - 颜色通道。

##${prefix} fillingColorList(Array)

填充词 - 颜色列表。

##${prefix} fillingFontFamilyField(string)

填充词 - 字体字段。

##${prefix} fillingFontWeightField(string)

填充词 - 字重字段。

##${prefix} fillingFontStyleField(string)

填充词 - 字体样式字段。

##${prefix} fillingColorHexField(string)

填充词 - 直接指定 hex 颜色字段。

##${prefix} fillingRotateAngles(Array)

填充词 - 可旋转角度 随机取范围列表。

##${prefix} ratio(number)

整体布局 - 自动计算核心词时期望的比例。

##${prefix} removeWhiteBorder(boolean)

整体布局 - 是否对输入图片去除白边。

##${prefix} layoutMode(string)

整体布局 - 布局模式。

可选值：

- `'default'`
- `'ensureMapping'`
- `'ensureMappingEnlarge'`

##${prefix} fillingTimes(number)

填充布局 - 填充文字填充次数。

##${prefix} fillingXStep(number)

填充布局 - 填充时 x 的前进范围。

##${prefix} fillingYStep(number)

填充布局 - 填充时 y 的前进范围。

##${prefix} fillingXRatioStep(number)

填充布局 - 填充时 x 的前进范围（相对宽度比例）。

##${prefix} fillingYRatioStep(number)

填充布局 - 填充时 y 的前进范围（相对高度比例）。

##${prefix} fillingInitialFontSize(number)

填充布局 - 填充文字初始大小。

##${prefix} fillingDeltaFontSize(number)

填充布局 - 填充文字每次填充大小缩小值。

##${prefix} fillingInitialOpacity(number)

填充布局 - 填充文字初始透明度。

##${prefix} fillingDeltaOpacity(number)

填充布局 - 填充文字每次透明度缩小值。

##${prefix} textLayoutTimes(number)

填充布局 - 单词尝试布局次数。

##${prefix} fontSizeShrinkFactor(number)

填充布局 - 每次布局失败后，缩小字号的系数。

##${prefix} stepFactor(number)

填充布局 - 布局步长系数。

##${prefix} importantWordCount(number)

填充布局 - 重要词数。

##${prefix} globalShinkLimit(number)

填充布局 - 字号缩小限制。

##${prefix} fontSizeEnlargeFactor(number)

填充布局 - 每次布局成功后，放大字号的系数。

##${prefix} fillingDeltaFontSizeFactor(number)

填充布局 - 填充词自动计算字号后，每次迭代字号缩小的系数。

##${prefix} fillingRatio(number)

填充布局 - 自动计算填充词时期望的比例。

#${prefix} word(Object)

词云文字图元配置 或 形状词云核心词文字图元配置。

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} padding(number)

文字间距。

##${prefix} formatMethod(Function)

文字格式化回调函数。

{{ use:text-format-callback(
  description = '文字'
) }}

##${prefix} style(Object)

文字样式。

{{ use: mark-style(
  markName = 'word'
) }}

{{ use: mark-text(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

{{ use: mark-state-style() }}

#${prefix} fillingWord(Object)

形状词云填充词文字图元配置。

不增加 formatMethod 的原因：形状词云在做布局时，word 和 fillingWord 用的是同一份数据，即 text 相同，所以 fillingWords 的 format 不会生效。

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} padding(number)

文字间距。

##${prefix} style(Object)

文字样式。

{{ use: mark-style(
  markName = 'fillingWord'
) }}

{{ use: mark-text(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

{{ use: mark-state-style() }}

#${prefix} depth_3d(number)
3d 词云的中心点距离屏幕的深度大小
