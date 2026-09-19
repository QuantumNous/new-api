{{ target: series-sunburst }}

{{ use: common-series(
  prefix = ${prefix},
  noType = ${noType},
  noData = ${noData},
  isHierarchy = true,
  seriesType = 'sunburst',
  seriesMarks = ['sunburst'],
  noMorph = ${noMorph},
  noStack = ${noStack},
  useInChart = ${useInChart},
  preset = 'growAngleIn' + '|' + 'growRadiusIn' + '|' + 'fadeIn',
  defaultPreset = 'growRadiusIn'
) }}

#${prefix} categoryField(string)

分类字段。

#${prefix} valueField(string)

权重字段。

#${prefix} centerX(number)

旭日图中心点，x 坐标，默认在正中心。

#${prefix} centerY(number)

旭日图中心点，y 坐标，默认在正中心。

#${prefix} offsetX(number) = 0

旭日图中心点，x 坐标偏移量。

#${prefix} offsetY(number) = 0

旭日图中心点，y 坐标偏移量。

#${prefix} startAngle(number) = -90

起始角度。

#${prefix} endAngle(number) = 270

终止角度，默认补齐整个圆。

#${prefix} innerRadius(number) = 0

扇区内半径，支持传入数组，逐层配置内半径。

#${prefix} outerRadius(number) = 1

扇区外半径，支持传入数组，逐层配置外半径。

#${prefix} gap(number) = 0

层级间隔，支持传入数组，逐层配置层级间隔。

#${prefix} labelLayout(SunburstLabelConfig)

标签布局相关参数，支持传入数组，逐层配置标签布局样式，传入 null 代表不进行布局。

##${prefix} align(string)

对齐方式，可选值

- `'start'`: 起始位置
- `'end'`: 结束位置
- `'center'`: 居中

##${prefix} rotate(string)

文字旋转朝向

- `'tangential'`: 切向
- `'radial'`: 径向

##${prefix} offset(number)

偏移距离

#${prefix} labelAutoVisible(LabelAutoVisibleType)

自动隐藏密集标签，支持设定一个周长阈值，当扇区周长小于该值时，则隐藏标签。

##${prefix} enable(boolean) = false
功能启用开关

##${prefix} circumference(number) = 10
周长阈值，扇区周长小于该值时，则隐藏标签，默认 10 像素。

<!-- 下钻 -->

{{ use: common-drill(
  prefix = ${prefix}
) }}

<!-- Label 图元 -->

#${prefix} label(Object)

标签 图元配置

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: mark-style(
  markName = 'label'
) }}

{{ use: mark-text(
  prefix = '##' + ${prefix}
)}}

##${prefix} state(Object)

{{ use: mark-state-style() }}

<!-- Sunburst 图元 -->

#${prefix} sunburst(Object)

sunburst 图元配置

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: mark-style(
  markName = 'sunburst'
) }}

{{ use: mark-arc(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

{{ use: mark-state-style() }}
