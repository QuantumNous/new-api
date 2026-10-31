{{ target: chart-waterfall }}

# waterfallChart

Waterfall Chart

{{ use: common-chart-spec(
    prefix = '#',
    chartType = 'waterfall'
) }}

{{ use: series-waterfall(
  prefix = '#',
  noType = true,
  noData = true,
  noMorph = true,
  useInChart = true
) }}