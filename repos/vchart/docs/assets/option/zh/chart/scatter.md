{{ target: chart-scatter }}

# scatterChart

散点图

{{ use: common-chart-spec(
    prefix = '#',
    chartType = 'scatter'
) }}

{{ use: series-scatter(
  prefix = '#',
  noType = true,
  noData = true,
  noMorph = true,
  useInChart = true
) }}

{{ use: chart-component(
  axisType = 'cartesian'
) }}
