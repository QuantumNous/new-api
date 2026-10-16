{{ target: series-radar }}

<!-- IRadarSeriesSpec -->

**Radar series**, used to draw radar charts, including point, line, and area configurations. **Only applicable to polar coordinate systems**.

{{ use: common-polar-series(
  prefix = ${prefix},
  noType = ${noType},
  noData = ${noData},
  noMorph = ${noMorph},
  useInChart = ${useInChart},
  seriesType = 'radar',
  seriesMarks = ['line', 'point','area'],
  preset = 'clipIn' + '|' + 'fadeIn' + '|' + 'grow',
  defaultPreset = 'clipIn'
) }}

#${prefix} seriesMark('point'|'line'|'area') = 'area'

Supported since `1.2.0` version, it is used to configure the main mark type configuration of the radar series, which will affect the display of the legend.

#${prefix} point(Object)

Point mark style configuration.

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: mark-style(
  markName = 'point'
) }}

{{ use: mark-symbol(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

{{ use: mark-state-style() }}

#${prefix} line(Object)

Line mark style configuration.

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: mark-style(
  markName = 'line'
) }}

{{ use: mark-line(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

{{ use: mark-state-style() }}

#${prefix} area(Object)

Area mark style configuration.

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: mark-style(
  markName = 'area'
) }}

{{ use: mark-area(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

{{ use: mark-state-style() }}

#${prefix} label(Object)

Label configuration.

{{ use: component-label(
  prefix = '#' + ${prefix},
  defaultOffset = 5,
) }}

#${prefix} markOverlap(boolean) = false
Anti-overlap - Whether to allow marker graphics to overlap each other. Supported since version `1.6.0`

#${prefix} pointDis(number)
Anti-overlap - Distance between marker points, in px. Supported since version `1.6.0`

#${prefix} pointDisMul(number) = 1
Anti-overlap - distance between marker points, multiple of pointSize. Supported since version `1.6.0`

