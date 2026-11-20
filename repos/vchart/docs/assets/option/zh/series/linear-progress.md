{{ target: series-linear-progress }}

<!-- ILinearProgressSeriesSpec -->

{{ use: common-cartesian-series(
  prefix = ${prefix},
  noType = ${noType},
  noData = ${noData},
  noMorph = ${noMorph},
  useInChart = ${useInChart},
  seriesType = 'linearProgress',
  seriesMarks = ['progress', 'track'],
  preset = 'grow' + '|' + 'fadeIn',
  defaultPreset = 'grow'
) }}

#${prefix} progress(Object)

进度条样式配置。

{{ use: common-mark(
  prefix = '#' + ${prefix}
) }}

##${prefix} topPadding(number) = 0

进度条上侧内边距。水平方向时生效。

##${prefix} bottomPadding(number) = 0

进度条下侧内边距。水平方向时生效。

##${prefix} leftPadding(number) = 0

进度条左侧内边距。垂直方向时生效。

##${prefix} rightPadding(number) = 0

进度条右侧内边距。垂直方向时生效。

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

背景条样式配置。

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

进度条宽度。
以像素值(px)为单位。

#${prefix} clamp(boolean) = false
自`1.13.9`版本支持，超出轴范围是否被裁剪。
