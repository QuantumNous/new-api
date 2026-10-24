{{ target: series-progress-like }}

<!-- IProgressLikeSeriesSpec -->

{{ use: common-polar-series(
  prefix = ${prefix},
  noType = ${noType},
  noData = ${noData},
  noMorph = ${noMorph},
  useInChart = ${useInChart},
  seriesType = ${seriesType},
  seriesMarks = ${seriesMarks},
) }}

#${prefix} cornerRadius(number) = 0

arc 图元的圆角半径。

#${prefix} roundCap(boolean|[boolean,boolean]) = false

<!-- TODO: 补图 -->

arc 图元的圆角部分是否突出（可分别设置左侧和右侧）。
