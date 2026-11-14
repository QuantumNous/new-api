{{ target: chart-venn }}

# vennChart

Venn chart.

Since version `1.11.0`.

Note: When using it in your code, please additionally introduce registerVennChart and register.

Example:

```ts
import { registerVennChart } from '@visactor/vchart';
registerVennChart();
```

{{ use: common-chart-spec(
    prefix = '#',
    chartType = 'venn'
) }}

{{ use: series-venn(
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
