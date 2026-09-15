{{ target: chart-pictogram }}

# pictogramChart

象形图。
自从`1.13.0`版本。
注意: 在业务中使用时, 请额外引入 `registerPictogramChart` 并注册。
示例:

```ts
import { registerPictogramChart } from '@visactor/vchart';
registerPictogramChart();
```

{{ use: common-chart-spec(
    prefix = '#',
    chartType = 'pictogram'
) }}

{{ use: series-pictogram(
  prefix = '#',
  noType = true,
  noMorph = true,
  useInChart = true,
  noStack = true,
  noInvalidType = true,
  noAnimation= true
) }}

{{ use: chart-component(
  noCrosshair = true,
  noDataZoom = true,
  noScrollbar = true,
  noBrush = true,
  regionType = 'geo'
) }}
