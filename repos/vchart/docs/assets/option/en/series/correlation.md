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

Node name field configuration.

#${prefix} valueField(string)

Correlation data field configuration.

#${prefix} sizeField(string)

Node size data field configuration.

#${prefix} sizeRange(Array)

Node size mapping range.

#${prefix} centerX(number)

The X coordinate of the center point of the chart.

#${prefix} centerY(number)

The Y coordinate of the center point of the chart.

#${prefix} innerRadius(string | number)

The inner radius of node distribution. Supports both pixel value and percentage formats.

#${prefix} outerRadius(string | number)

Node distribution outer radius. Supports both pixel value and percentage formats.

#${prefix} startAngle(number) = -90

Chart starting angle. Use the angle system.

#${prefix} endAngle(number) = 270

Chart end angle. Use the angle system.

#${prefix} centerPoint(Object)

Center point element attribute configuration.

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

Water ripple primitive attribute configuration.

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

Center point label attribute configuration.

##${prefix} position(string) = 'center'

Label position, optional values ​​are:

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

Node primitive attribute configuration.

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

Label configuration.

##${prefix} position(string) = 'bottom'

Label position, optional values ​​are:

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
