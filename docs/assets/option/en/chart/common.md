{{ target: chart-common }}

<!-- TODO: series 还差 IBar3dSeriesSpec IPie3dSeriesSpec -->

# commonChart

Combined chart.

**Instructions for use:**

**Because the combination chart does not limit the coordinate system, it is not possible to determine internally what type of coordinate axes should be created. Therefore, when configuring the combination chart, you must declare the `axes` attribute to declare what type of coordinate axes to use. **

1. For the Cartesian coordinate system, we need to declare the coordinate axis and type of the corresponding direction, for example:

```ts
axes: [
  { orient: 'left', type: 'linear' }, // Declare the left axis as a linear axis
  { orient: 'bottom', type: 'band' } // Declare the lower axis as a discrete axis
];
```

2. For the polar coordinate system, we need to declare the coordinate axis and type of the corresponding direction, for example:

```ts
axes: [
  { orient: 'angle', type: 'band' }, // Declare the arc axis as a discrete axis
  { orient: 'radius', type: 'linear' } // Declare the radius axis as a linear axis
];
```

{{ use: common-chart-spec(
    prefix = '#',
    chartType = 'common'
) }}

## seriesField(string)

Series grouping field.

## series(Array)

Configuration of series in combined chart.

## series.area(Object)

{{ use: series-area(
  prefix = '##',
  noMorph = true,
  useInChart = false,
  seriesType = 'area'
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
  useInChart = false
) }}

## series.waterfall(Object)

{{ use: series-waterfall(
 prefix = '##',
  noMorph = true,
  useInChart = false
) }}

## series.radar(Object)

{{ use: series-radar(
  prefix = '##',
  noMorph = true,
  useInChart = false
) }}

## series.pie(Object)

{{ use: series-pie(
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
  useInChart = true,
  noStack = false
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

## series.circularProgress(Object)

{{ use: series-circular-progress(
  prefix = '##',
  noMorph = true,
  useInChart = false
) }}

## series.gauge(Object)

{{ use: series-gauge(
  prefix = '##',
  noMorph = true,
  useInChart = false
) }}

## series.gaugePointer(Object)

{{ use: series-gauge-pointer(
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
  useInChart = false
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
  prefix = '##',
  useInChart = false
) }}

## series.link(Object)

{{ use: series-link(
  prefix = '##',
  useInChart = false
) }}

{{ use: component-cartesian-axis(
  noBandAxis = ${noBandAxis}
) }}

{{ use: chart-component(
  axisType = 'cartesian'
) }}

## autoBandSize(boolean | Object)

Whether to enable automatic bandSize. If enabled, the bandSize will be automatically calculated based on the incoming configuration such as barWidth, thereby affecting the actual length of the axis. Supported since version 1.11.2.

### extend(number)

The expansion value added after calculating the bandSize based on barWidth to fix the overall length of the axis. The unit is px.
