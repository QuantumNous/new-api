{{ target: chart-heatmap }}

# heatmapChart

Heatmap.

{{ use: common-chart-spec(
    prefix = '#',
    chartType = 'heatmap'
) }}

{{ use: series-heatmap(
  prefix = '#',
  noType = true,
  noData = true,
  noMorph = true,
  useInChart = true
) }}

{{ use: chart-component(
  axisType = 'cartesian'
) }}