{{ target: chart-liquid }}

# liquidChart

水波图。 
自从`1.9.0`版本。
注意: 在业务中使用时, 请额外引入registerLiquidChart并注册。
示例:
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
