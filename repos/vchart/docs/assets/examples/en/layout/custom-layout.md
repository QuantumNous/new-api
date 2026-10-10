---
category: examples
group: layout
title: Custom Layout
order: 37-0
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/7b82fb013e7c6319c065b3d01.png
option: commonChart#layout
---

# Custom Layout

In the chart, in addition to the built-in layout logic, users can also achieve a fully customized layout by using the custom layout interface.

## Key option

Configure the texture-related properties on the graphics element:

- `layout` Configure the function in the secondary configuration of the initialization parameters. The function type is as follows:

```ts
export type LayoutCallBack = (
  chart: IChart, // Chart object
  item: ILayoutItem[], // Chart modules involved in the layout
  chartLayoutRect: IRect, // the available layout space of the chart after subtracting the padding
  chartViewBox: IBoundsLike // The position of the chart on the canvas, including the chart's padding.
) => void;
```

## Demo source

```javascript livedemo
const spec = {
  type: 'common',
  padding: 0,
  region: [],
  series: []
};

// 随机生成 12 组
for (let i = 0; i < 12; i++) {
  spec.region.push({ id: 'clock' + i });
  const series = {
    regionId: 'clock' + i,
    type: 'pie',
    valueField: 'value',
    categoryField: 'type',
    seriesField: 'type',
    label: {
      style: {
        visible: false
      }
    }
  };
  series.data = {
    id: 'data' + i,
    values: []
  };
  for (let d = 0; d < 4; d++) {
    series.data.values.push({ value: Math.random() * 100, type: 'type' + d });
  }
  spec.series.push(series);
}

const vchart = new VChart(spec, {
  dom: CONTAINER_ID,
  layout: (chart, item, chartLayoutRect, chartViewBox) => {
    /**
     * chart is the chart object
     * item is the chart module participating in the layout
     * chartLayoutRect is the available layout space after subtracting padding from the chart
     * chartViewBox is the position of the chart in the canvas, including the padding of the chart.
     */
    const radius = Math.min(chartLayoutRect.width / 2, chartLayoutRect.height / 2);
    const center = { x: chartLayoutRect.width / 2, y: chartLayoutRect.height / 2 };
    const regionSize = radius * 0.2;
    const regionPosRadius = radius - regionSize * 0.5 * 1.415;
    // Complete the layout using the properties of the layout element and the provided methods
    item.forEach((i, index) => {
      const angle = (index / 12) * Math.PI * 2;
      // Be sure to call after the layout is complete
      i.setLayoutStartPosition({
        x: center.x + Math.sin(angle) * regionPosRadius - regionSize * 0.5,
        y: center.y + Math.cos(angle) * regionPosRadius - regionSize * 0.5
      });
      i.setLayoutRect({ width: regionSize, height: regionSize });
      i.updateLayoutAttribute && i.updateLayoutAttribute();
    });
  }
});
vchart.renderSync();
```

## Related Tutorials

[Layout](link)
