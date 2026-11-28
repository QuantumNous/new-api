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

The corner radius of the arc element.

#${prefix} roundCap(boolean|[boolean,boolean]) = false

<!-- TODO: Add illustrations -->

Whether the rounded part of the arc element protrudes (can be set separately for the left and right sides).
