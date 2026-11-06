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

Minimum value field for the range.

#${prefix} maxField(string)

Maximum value field for the range.
