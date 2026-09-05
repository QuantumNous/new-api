{{ target: series-correlation }}

**散点相关性图系列**

{{ use: common-series(
  prefix = ${prefix},
  noType = ${noType},
  noData = ${noData},
  seriesType = 'correlation',
  seriesMarks = ['point'],
  noMorph = ${noMorph},
  noStack = ${noStack},
  useInChart = ${useInChart},
  preset = 'scaleIn' + '|' + 'fadeIn',
  defaultPreset = 'scaleIn'
) }}

#${prefix} categoryField(string)

节点名称字段配置。

#${prefix} valueField(string)

相关性数据字段配置。

#${prefix} sizeField(string)

节点尺寸数据字段配置。

#${prefix} sizeRange(Array)

节点尺寸映射范围。

#${prefix} centerX(number)

图表中心点位置 X 坐标。

#${prefix} centerY(number)

图表中心点位置 Y 坐标。

#${prefix} innerRadius(string | number)

节点分布内半径。支持像素值和百分比两种格式。

#${prefix} outerRadius(string | number)

节点分布外半径。支持像素值和百分比两种格式。

#${prefix} startAngle(number) = -90

图表起始角度。使用角度制。

#${prefix} endAngle(number) = 270

图表终止角度。使用角度制。

#${prefix} centerPoint(Object)

中心点图元属性配置。

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: mark-style(
  markName = 'centerPoint'
) }}

{{ use: mark-symbol(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

{{ use: mark-state-style() }}

#${prefix} ripplePoint(Object)

水波纹图元属性配置。

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: mark-style(
  markName = 'ripplePoint'
) }}

{{ use: mark-ripple(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

{{ use: mark-state-style() }}

#${prefix} centerLabel(Object)

中心点 label 属性配置。

##${prefix} position(string) = 'center'

标签位置，可选值为：

- `'top'`
- `'bottom'`
- `'left'`
- `'right'`
- `'top-right'`
- `'top-left'`
- `'bottom-right'`
- `'bottom-left'`
- `'center'`

{{ use: component-label(
  prefix = '#' + ${prefix},
  noPosition = true,
  hasOverlap = true,
  hasSmartInvert = true,
  defaultOffset = 5,
) }}

#${prefix} nodePoint(Object)

节点图元属性配置。

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: mark-style(
  markName = 'nodePoint'
) }}

{{ use: mark-symbol(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

{{ use: mark-state-style() }}

#${prefix} label(Object)

标签配置。

##${prefix} position(string) = 'bottom'

标签位置，可选值为：

- `'top'`
- `'bottom'`
- `'left'`
- `'right'`
- `'top-right'`
- `'top-left'`
- `'bottom-right'`
- `'bottom-left'`
- `'center'`

{{ use: component-label(
  prefix = '#' + ${prefix},
  noPosition = true,
  hasOverlap = true,
  hasSmartInvert = true,
  defaultOffset = 5,
) }}
