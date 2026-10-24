{{ target: series-rangeArea }}

{{ use: series-area(
  prefix = ${prefix},
  noType = ${noType},
  noData = ${noData},
  noMorph = ${noMorph},
  useInChart = ${useInChart},
  seriesType = 'rangeArea',
  seriesMarks = ['line', 'point','area'],
) }}

#${prefix} minField(string)

区间最小值字段。

#${prefix} maxField(string)

区间最大值字段。
