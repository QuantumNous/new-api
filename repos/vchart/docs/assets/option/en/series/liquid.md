{{ target: series-liquid }}

<!-- ILiquidSeriesSpec -->

**liquid series**, Can be used to draw water liquid chart.

{{ use: common-cartesian-series(
  prefix = ${prefix},
  noType = ${noType},
  noData = ${noData},
  noMorph = ${noMorph},
  useInChart = ${useInChart},
  seriesType = 'liquid',
  seriesMarks = ['liquid', 'liquidBackground', 'liquidOutline'],
  preset = 'grow' + '|' + 'wave' + '|' + 'waveGrow',
  defaultPreset = 'wave'
) }}

#${prefix} valueField(string)

value field.

#${prefix} maskShape(string) = 'circle'

Contour shape.

Optional values:
- `'drop'`
- `'circle'`
- `'cross'`
- `'diamond'`
- `'square'`
- `'arrow'`
- `'arrow2Left'`
- `'arrow2Right'`
- `'wedge'`
- `'thinTriangle'`
- `'triangle'`
- `'triangleUp'`
- `'triangleDown'`
- `'triangleRight'`
- `'triangleLeft'`
- `'stroke'`
- `'star'`
- `'wye'`
- `'rect'`

#${prefix} outlineMargin(Object|number|number[])

The padding between the outer contour and the region boundary.

#${prefix} outlinePadding(Object|number|number[])

The padding between the inner contour and the outer contour.

#${prefix} indicatorSmartInvert(boolean) = false

When there is an indicator card, whether to enable indicator smart inversion.

#${prefix} reverse(boolean) = false

Supported since version 1.11.10, whether graphics are drawn from top to bottom.

#${prefix} liquid(Object)

liquid mark style

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: mark-style(
  markName = 'liquid'
) }}

{{ use: mark-liquid(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

{{ use: mark-state-style() }}

#${prefix} liquidBackground(Object)

liquid background mark style.

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: mark-style(
  markName = 'liquidBackground'
) }}

{{ use: mark-group(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

{{ use: mark-state-style() }}

#${prefix} liquidBackground(Object)

liquid outline mark style.

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: mark-style(
  markName = 'liquidOutline'
) }}

{{ use: mark-group(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

{{ use: mark-state-style() }}

