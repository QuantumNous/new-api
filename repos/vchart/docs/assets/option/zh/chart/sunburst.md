{{ target: chart-sunburst }}

# sunburstChart

旭日图

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
