{{ target: chart-mosaic }}

# mosaicChart
Mosaic chart.
Since version `1.12.0`.
Note: When using in business context, please additionally import registerMosaicChart and execute.
Example:

```ts
import { registerMosaicChart } from '@visactor/vchart';
registerMosaicChart();
```

{{ use: common-chart-spec(
    prefix = '#',
    chartType = 'mosaic'
) }}

{{ use: series-mosaic(
  prefix = '#',
  noType = true,
  noData = true,
  noMorph = true,
  useInChart = true,
  noStack = true
) }}

## autoBandSize(boolean | Object)
Whether to enable automatic bandSize. If enabled, bandSize will be automatically calculated based on the provided barWidth and other configurations, thereby affecting the actual length of the axis. Supported since version 1.10.0.

### extend(number)

Calculates the bandSize based on barWidth, adds the extended value after fixing the overall length of the axis. Measured in pixels.

{{ use: chart-component(
  axisType = 'cartesian'
) }}
