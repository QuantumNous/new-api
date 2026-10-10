{{ target: chart-venn }}

# vennChart

韦恩图。

`1.11.0` 版本开始支持。

注意: 在业务中使用时, 请额外引入 registerVennChart 并注册。

示例:

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
