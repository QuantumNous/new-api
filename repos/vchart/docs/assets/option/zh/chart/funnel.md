{{ target: chart-funnel }}

# funnelChart

漏斗图

{{ use: common-chart-spec(
    prefix = '#',
    chartType = 'funnel'
) }}

{{ use: series-funnel(
  prefix = '#',
  noType = true,
  noData = true,
  noMorph = true,
  noStack = true,
  useInChart = true,
) }}

{{ use: chart-component() }}
