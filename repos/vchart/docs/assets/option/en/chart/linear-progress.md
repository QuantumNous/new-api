{{ target: chart-linear-progress }}

# linearProgressChart

Linear Progress Chart

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