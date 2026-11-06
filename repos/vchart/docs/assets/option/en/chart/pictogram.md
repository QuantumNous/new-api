{{ target: chart-pictogram }}

# pictogramChart

Pictogram.
Since version 1.13.0.
Note: When using it in business, please additionally import `registerPictogramChart` and register it.
Example:

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
