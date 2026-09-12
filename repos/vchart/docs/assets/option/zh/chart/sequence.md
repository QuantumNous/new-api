{{ target: chart-sequence }}

# sequenceChart

时序图

{{ use: common-chart-spec(
    prefix = '#',
    chartType = 'sequence'
) }}

## appendPadding(number|Object)

属性用于配置图表的内边距， 建议配置， 否则事件link 系列的 title 将会与 gridline 重叠。

## series(Object)

在时序图中，推荐至少配置一对事件link 系列，柱系列可根据需要配置0个或若干个。

## series.bar(Object)

{{ use: series-bar(
  prefix = '##'
) }}

## series.dot(Object)

{{ use: series-dot(
  prefix = '##'
) }}

## series.link(Object)

{{ use: series-link(
  prefix = '##'
) }}

{{ use: chart-component(
  axisType = 'cartesian',
  noBandAxis = true
) }}
