{{ target: chart-common }}

<!-- TODO: series 还差 IBar3dSeriesSpec IPie3dSeriesSpec ICircularProgressSeriesSpec IGaugeSeriesSpec
IGaugePointerSeriesSpec-->

# commonChart

组合图。

{{ use: common-chart-spec(
    prefix = '#',
    chartType = 'common'
) }}

## seriesField(string)

系列分组字段。

## series(Array)

组合图内系列的配置。

## series.area(Object)

{{ use: series-area(
  prefix = '##',
  noMorph = true,
  useInChart = false,
  seriesType = 'area',
) }}

## series.line(Object)

{{ use: series-line(
  prefix = '##',
  noMorph = true,
  useInChart = false
) }}

## series.bar(Object)

{{ use: series-bar(
  prefix = '##',
  noMorph = true,
  useInChart = false
) }}

## series.rangeColumn(Object)

{{ use: series-range-column(
  prefix = '##',
  noMorph = true,
  useInChart = false
) }}

## series.rangeArea(Object)

{{ use: series-rangeArea(
 prefix = '##',
  noMorph = true,
  useInChart = false,
) }}

## series.heatmap(Object)

{{ use: series-heatmap(
 prefix = '##',
  noMorph = true,
  useInChart = false,
) }}

## series.waterfall(Object)

{{ use: series-waterfall(
 prefix = '##',
  noMorph = true,
  useInChart = false,
) }}

## series.radar(Object)

{{ use: series-radar(
  prefix = '##',
  noMorph = true,
  useInChart = false
) }}

## series.rose(Object)

{{ use: series-rose(
 prefix = '##',
  noMorph = true,
  useInChart = false
) }}

## series.boxPlot(Object)

{{ use: series-box-plot(
 prefix = '##',
  noMorph = true,
  useInChart = false
) }}

## series.map(Object)

{{ use: series-map(
  prefix = '##',
  noMorph = true,
  useInChart = false,
  noStack = true
) }}

## series.scatter(Object)

{{ use: series-scatter(
 prefix = '##',
  noMorph = true,
  useInChart = false
) }}

## series.linearProgress(Object)

{{ use: series-linear-progress(
 prefix = '##',
  noMorph = true,
  useInChart = false
) }}

## series.wordCloud(Object)

{{ use: series-word-cloud(
 prefix = '##',
  noMorph = true,
  useInChart = false
) }}

## series.funnel(Object)

{{ use: series-funnel(
  prefix = '##',
  noMorph = true,
  noStack = true,
) }}

## series.sankey(Object)

{{ use: series-sankey(
  prefix = '##',
  noMorph = true,
  useInChart = false
) }}

## series.treemap(Object)

{{ use: series-treemap(
  prefix = '##',
  noMorph = true,
  useInChart = false,
  noStack = true
) }}

## series.sunburst(Object)

{{ use: series-sunburst(
 prefix = '##',
  noMorph = true,
  useInChart = false
) }}

## series.circlePacking(Object)

{{ use: series-circle-packing(
  prefix = '##',
  noMorph = true,
  useInChart = false
) }}

## series.dot(Object)

{{ use: series-dot(
  prefix = '##'
) }}

## series.link(Object)

{{ use: series-link(
  prefix = '##'
) }}

{{ use: component-cartesian-axis(
  noBandAxis = ${noBandAxis}
) }}

{{ use: chart-component(
  axisType = 'cartesian'
) }}

## autoBandSize(boolean | Object)

是否开启自动 bandSize。如果开启，会根据传入的 barWidth 等配置自动计算 bandSize，从而影响轴实际长度。自 1.11.2 版本开始支持。

### extend(number)

根据 barWidth 计算出 bandSize，从而固定轴整体长度之后，添加的扩增值。单位为 px。
