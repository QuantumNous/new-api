{{ target: chart-liquid }}

# liquidChart

liquid chart.
Since version `1.9.0`.
Note: When using it in your code, please additionally introduce registerLiquidChart and register.
Example:
```ts
import { registerLiquidChart } from '@visactor/vchart';
registerLiquidChart();
```

{{ use: common-chart-spec(
    prefix = '#',
    chartType = 'liquid'
) }}

{{ use: series-liquid(
  prefix = '#',
  noType = true,
  noData = true,
  noMorph = true,
  useInChart = true,
  noStack = true,
  noInvalidType = true
) }}

{{ use: chart-component(
  noCrosshair = true,
  noDataZoom = true,
  noScrollbar = true
) }}
