{{ target: chart-range-column }}

# rangeColumnChart

区间柱状图

{{ use: common-chart-spec(
    prefix = '#',
    chartType = 'rangeColumn'
) }}

{{ use: series-range-column(
  prefix = '#',
  noType = true,
  noData = true,
  noMorph = true,
  useInChart = true
) }}

{{ use: chart-component(
  axisType = 'cartesian'
) }}
