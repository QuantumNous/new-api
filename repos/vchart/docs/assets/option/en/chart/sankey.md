{{ target: chart-sankey }}

# sankeyChart

Sankey Diagram

{{ use: common-chart-spec(
    prefix = '#',
    chartType = 'sankey',
    isHierarchy = true,
) }}

{{ use: series-sankey(
  prefix = '#',
  noType = true,
  noData = true,
  noMorph = true,
  useInChart = true
) }}

{{ use: chart-component(
  axisType = 'cartesian'
) }}