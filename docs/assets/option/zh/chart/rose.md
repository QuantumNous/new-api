{{ target: chart-rose }}

# roseChart

玫瑰图

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
