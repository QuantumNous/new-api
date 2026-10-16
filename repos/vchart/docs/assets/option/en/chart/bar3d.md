{{ target: chart-bar3d }}

# bar3dChart

3D Bar Chart

{{ use: common-chart-spec(
    prefix = '#',
    chartType = 'bar3d'
) }}

{{ use: series-bar3d(
  prefix = '#',
  noType = true,
  noData = true,
  noMorph = true,
  useInChart = true
) }}

{{ use: chart-component(
  axisType = 'cartesian'
) }}