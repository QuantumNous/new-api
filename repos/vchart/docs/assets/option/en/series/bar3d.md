{{ target: series-bar3d }}

<!-- IBarSeriesSpec -->

**Bar Series** can be used for drawing 3d bar charts, bar graphs, and histograms, etc. **Only applicable to the Cartesian coordinate system**.

{{ use: common-cartesian-series(
  prefix = ${prefix},
  noType = ${noType},
  noData = ${noData},
  noMorph = ${noMorph},
  useInChart = ${useInChart},
  seriesType = 'bar',
  seriesMarks = ['bar'],
  preset = 'grow' + '|' + 'fadeIn' + '|' + 'scaleIn',
  defaultPreset = 'grow'
) }}

#${prefix} bar3d(Object)

bar3d style configuration.

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: mark-style(
  markName = 'bar3d'
) }}

{{ use: mark-rect3d(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

{{ use: mark-state-style() }}

#${prefix} label(Object)

Label configuration.

##${prefix} position(string) = 'outside'

Label position. Optional values include:

- `'outside'`
- `'top'`
- `'bottom'`
- `'left'`
- `'right'`
- `'inside'`
- `'inside-top'`
- `'inside-bottom'`
- `'inside-right'`
- `'inside-left'`

{{ use: component-label(
  prefix = '#' + ${prefix},
  noPosition = true,
  hasOverlap = true,
  hasSmartInvert = true,
  defaultOffset = 5,
) }}

#${prefix} barWidth(number)

The width of the bar, in px. If not configured, it will automatically adapt.

#${prefix} barMinWidth(number)

The minimum width of the bar, in px.

#${prefix} barMaxWidth(number)

The maximum width of the bar, in px.
