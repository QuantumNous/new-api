{{target: chart-pie}}

# pieChart

Pie Chart

{{ use: common-chart-spec(
    prefix = '#',
    chartType = 'pie'
) }}

{{ use: series-pie(
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