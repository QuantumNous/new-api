{{ target: chart-treemap }}

# treemapChart

Treemap

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