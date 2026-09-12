{{ target: chart-treemap }}

# treemapChart

矩形树图

{{ use: common-chart-spec(
    prefix = '#' ,
    chartType = 'treemap',
    isHierarchy = true,
) }}

{{ use: series-treemap(
  prefix = '#',
  noType = true,
  noMorph = true,
  useInChart = true,
  noStack = true
) }}

{{ use: chart-component(
  noDataZoom = true,
  noCrosshair = true
) }}
