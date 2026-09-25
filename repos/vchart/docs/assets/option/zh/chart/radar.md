{{ target: chart-radar }}

# radarChart

雷达图

{{ use: common-chart-spec(
    prefix = '#',
    chartType = 'radar'
) }}

{{ use: series-radar(
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
