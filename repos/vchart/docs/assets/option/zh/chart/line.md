{{ target: chart-line }}

# lineChart

折线图

{{ use: common-chart-spec(
    prefix = '#',
    chartType = 'line'
) }}

{{ use: series-line(
  prefix = '#',
  noType = true,
  noData = true,
  noMorph = true,
  useInChart = true
) }}

{{ use: chart-component(
  axisType = 'cartesian'
) }}
