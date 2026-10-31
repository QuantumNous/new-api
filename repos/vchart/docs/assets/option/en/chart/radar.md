{{ target: chart-radar }}

# radarChart

Radar Chart

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