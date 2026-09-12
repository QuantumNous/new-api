{{ target: series-gauge-pointer }}

<!-- IGaugePointerSeriesSpec -->

**gaugePointer series** is used to draw gauge pointers. **Applies to polar coordinates only**.

{{ use: series-progress-like(
  prefix = ${prefix},
  noType = ${noType},
  noData = ${noData},
  noMorph = ${noMorph},
  useInChart = ${useInChart},
  seriesType = 'gaugePointer',
) }}

#${prefix} radiusField(string)

Radius field, which can map data to pointer length. (GaugePointerSeries has no categoryField)

#${prefix} pointer(Object)

Pointer graphic style configuration, optional `rect` or `path` element.

##${prefix} type('rect'|'path')

Configure the mark type.

##${prefix} width(number)

Configure the width.

##${prefix} height(number)

Configure the height.

##${prefix} innerPadding(number)

The distance between the pointer end near the center and the center.

##${prefix} outerPadding(number)

The distance between the pointer end near the edge and the edge.

##${prefix} center([number,number])

Center coordinate. Proportional value, range 0~1.

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} style (rect version) (Object)

{{ use: mark-style(
  markName = 'pointer'
) }}

{{ use: graphic-rect(
  prefix = '##' + ${prefix}
) }}

##${prefix} style (path version) (Object)

{{ use: mark-style(
  markName = 'pointer'
) }}

{{ use: mark-path(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

{{ use: mark-state-style() }}

#${prefix} pin(Object)

Pointer pin foreground style configuration.

##${prefix} width(number)

Configure the width.

##${prefix} height(number)

Configure the height.

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: mark-style(
  markName = 'pin'
) }}

{{ use: mark-path(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

{{ use: mark-state-style() }}

#${prefix} pinBackground(Object)

Pointer pin background style configuration.

##${prefix} width(number)

Configure the width.

##${prefix} height(number)

Configure the height.

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: mark-style(
  markName = 'pinBackground'
) }}

{{ use: mark-path(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

{{ use: mark-state-style() }}
