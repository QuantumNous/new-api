{{ target: chart-circular-progress }}

# circularProgressChart

Circular Progress Chart

{{ use: common-chart-spec(
    prefix = '#',
    chartType = 'circularProgress'
) }}

{{ use: series-circular-progress(
  prefix = '#',
  noType = true,
  noData = true,
  noMorph = true,
  useInChart = true
) }}

{{ use: chart-component(
  axisType = 'polar',
  isPolar = true
) }}