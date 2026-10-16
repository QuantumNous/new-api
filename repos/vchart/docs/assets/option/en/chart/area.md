{{ target: chart-area }}

# AreaChart

Area Chart

{{ use: common-chart-spec(
    prefix = '#',
    chartType = 'area'
) }}

{{ use: series-area(
  prefix = '#',
  noType = true,
  noData = true,
  noMorph = true,
  useInChart = true
) }}

{{ use: chart-component(
  axisType = 'cartesian'
) }}