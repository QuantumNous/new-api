{{ target: chart-heatmap }}

# heatmapChart

热力图。

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
