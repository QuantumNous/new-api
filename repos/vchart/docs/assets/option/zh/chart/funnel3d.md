{{ target: chart-funnel3d }}

# funnelChart3d

3d 漏斗图

{{ use: common-chart-spec(
    prefix = '#',
    chartType = 'funnel3d'
) }}

{{ use: series-funnel3d(
  prefix = '#',
  noType = true,
  noData = true,
  noMorph = true,
  noStack = true,
  useInChart = true,
) }}

{{ use: chart-component() }}
