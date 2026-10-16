{{ target: chart-box-plot }}

# boxPlotChart

箱型图

{{ use: common-chart-spec(
    prefix = '#',
    chartType = 'boxPlot'
) }}

{{ use: series-box-plot(
  prefix = '#',
  noType = true,
  noData = true,
  noMorph = true,
  useInChart = true
) }}

{{ use: chart-component(
  axisType = 'cartesian'
) }}
