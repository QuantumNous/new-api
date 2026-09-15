{{ target: chart-waterfall }}

# waterfallChart

瀑布图

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

