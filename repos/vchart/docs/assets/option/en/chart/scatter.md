{{ target: chart-scatter }}

# scatterChart

Scatter Plot

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