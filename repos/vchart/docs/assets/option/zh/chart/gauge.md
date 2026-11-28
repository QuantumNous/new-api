{{ target: chart-gauge }}

# gaugeChart

仪表图

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

配置仪表图背景板系列。可选配`gauge`以及`circularProgress`系列。

##${prefix} gauge（gauge 系列版本）(Object)
gauge 系列版本。

###${prefix} type('gauge')

指定系列类型为`gauge`。

{{ use: series-gauge(
  prefix = '##',
  noType = true,
  noData = true,
  noMorph = true,
  useInChart = true
) }}

##${prefix} gauge（circularProgress 系列版本）(Object)
circularProgress 系列版本。

###${prefix} type('circularProgress')

指定系列类型为`circularProgress`。

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
