{{ target: chart-sequence }}

# sequenceChart

Sequence Chart

{{ use: common-chart-spec(
    prefix = '#',
    chartType = 'sequence'
) }}

## appendPadding(number|Object)

This property is used to configure the chart's inner padding. It is recommended to configure this, otherwise the event link series' title will overlap with the gridline.

## series(Object)

In the sequence chart, it is recommended to configure at least one pair of event link series. The bar series can be configured with 0 or several, according to the needs.

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
