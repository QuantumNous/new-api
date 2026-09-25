{{ target: chart-area }}

# areaChart

面积图

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
