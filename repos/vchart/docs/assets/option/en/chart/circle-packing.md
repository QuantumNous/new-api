{{ target: chart-circle-packing }}

# circlePackingChart

circlePacking Chart

{{ use: common-chart-spec(
    prefix = '#',
    chartType = 'circlePacking',
   isHierarchy = true,
) }}

{{ use: series-circle-packing(
  prefix = '#',
  noType = true,
  noData = true,
  noMorph = true,
  useInChart = true
) }}

{{ use: chart-component() }}