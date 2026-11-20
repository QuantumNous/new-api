{{ target: chart-range-area }}

# Range Area Chart

区间面积图

{{ use: common-chart-spec(
    prefix = '#',
    chartType = 'rangeArea'
) }}

{{ use: series-rangeArea(
  prefix = '#',
  noType = true,
  noData = true,
  noMorph = true,
  useInChart = true
) }}

{{ use: chart-component(
  axisType = 'cartesian'
) }}