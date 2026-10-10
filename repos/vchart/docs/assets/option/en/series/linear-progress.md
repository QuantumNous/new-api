{{ target: series-linear-progress }}

<!-- ILinearProgressSeriesSpec -->

{{ use: common-cartesian-series(
  prefix = ${prefix},
  noType = ${noType},
  noData = ${noData},
  noMorph = ${noMorph},
  useInChart = ${useInChart},
  seriesType = 'linearProgress',
  preset = 'grow' + '|' + 'fadeIn',
  seriesMarks = ['progress', 'track'],
  defaultPreset = 'grow'
) }}

#${prefix} progress(Object)

Progress bar style configuration.

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} topPadding(number) = 0

Top padding of the progress bar. Effective when in the horizontal direction.

##${prefix} bottomPadding(number) = 0

Bottom padding of the progress bar. Effective when in the horizontal direction.

##${prefix} leftPadding(number) = 0

Left padding of the progress bar. Effective when in the vertical direction.

##${prefix} rightPadding(number) = 0

Right padding of the progress bar. Effective when in the vertical direction.

##${prefix} style(Object)

{{ use: mark-style(
  markName = 'progress'
) }}

{{ use: mark-rect(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

{{ use: mark-state-style() }}

#${prefix} track(Object)

Background bar style configuration.

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} style(Object)

{{ use: mark-style(
  markName = 'track'
) }}

{{ use: mark-rect(
  prefix = '##' + ${prefix}
) }}

##${prefix} state(Object)

{{ use: mark-state-style() }}

#${prefix} bandWidth(number)

Progress bar width.
In pixel (px) units.

#${prefix} clamp(boolean) = false
Supported since `1.13.9` version, whether the out-of-axis range is clipped.
