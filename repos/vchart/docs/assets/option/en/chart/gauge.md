{{ target: chart-gauge }}

# gaugeChart

Gauge Chart

{{ use: common-chart-spec(
    prefix = '#',
    chartType = 'gauge'
) }}

{{ use: series-gauge-pointer(
  prefix = '#',
  noType = true,
  noData = true,
  noMorph = true,
  useInChart = true
) }}

##${prefix} gauge(Object)

Configure the gauge chart background panel series. Optional for `gauge` and `circularProgress` series.

##${prefix} gauge（gauge series version）(Object)
gauge series version。

###${prefix} type('gauge')

Specify the series type as `gauge`.

{{ use: series-gauge(
  prefix = '##',
  noType = true,
  noData = true,
  noMorph = true,
  useInChart = true
) }}

##${prefix} gauge（circularProgress series version）(Object)
circularProgress series version。

###${prefix} type('circularProgress')

Specify the series type as `circularProgress`.

{{ use: series-circular-progress(
  prefix = '##',
  noType = true,
  noData = true,
  noMorph = true,
  useInChart = true
) }}

{{ use: chart-component(
  axisType = 'polar',
  isPolar = true
) }}