{{ target: chart-rose }}

# roseChart

Rose Chart

{{ use: common-chart-spec(
    prefix = '#',
    chartType = 'rose'
) }}

{{ use: series-rose(
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