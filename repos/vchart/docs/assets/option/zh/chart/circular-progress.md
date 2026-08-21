{{ target: chart-circular-progress }}

# circularProgressChart

条形进度图

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
