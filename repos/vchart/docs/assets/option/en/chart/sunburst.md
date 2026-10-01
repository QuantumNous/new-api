{{ target: chart-sunburst }}

# sunburstChart

Sunburst Chart

{{ use: common-chart-spec(
    prefix = '#',
    chartType = 'sunburst',
    isHierarchy = true,
) }}

{{ use: series-sunburst(
  prefix = '#',
  noType = true,
  noData = true,
  noMorph = true,
  useInChart = true
) }}

{{ use: chart-component() }}