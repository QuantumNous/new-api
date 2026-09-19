{{ target: chart-range-column }}

# rangeColumnChart

Range Column Chart

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