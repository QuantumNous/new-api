{{ target: chart-bar }}

# barChart

Bar Chart

{{ use: common-chart-spec(
    prefix = '#',
    chartType = 'bar'
) }}

{{ use: series-bar(
  prefix = '#',
  noType = true,
  noData = true,
  noMorph = true,
  useInChart = true
) }}

## autoBandSize(boolean | Object)

Whether to enable automatic bandSize. If enabled, it will automatically calculate the bandSize based on the provided configurations such as barWidth, thereby affecting the actual length of the axis. Supported since version 1.10.0.

### extend(number)

After calculating the bandSize based on barWidth and fixing the overall length of the axis, this is the additional extension value. The unit is px.

{{ use: chart-component(
  axisType = 'cartesian'
) }}
