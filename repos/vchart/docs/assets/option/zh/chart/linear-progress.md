{{ target: chart-linear-progress }}

# linearProgressChart

条形进度图

{{ use: common-chart-spec(
    prefix = '#',
    chartType = 'linearProgress'
) }}

{{ use: series-linear-progress(
  prefix = '#',
  noType = true,
  noData = true,
  noMorph = true,
  useInChart = true
) }}

{{ use: chart-component(
  axisType = 'cartesian'
) }}
