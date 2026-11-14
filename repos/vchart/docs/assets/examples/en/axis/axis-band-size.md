---
category: demo
group: axis
title: Axis fixed bandSize and auto scroll bar
keywords: areaChart,axis,scrollBar
order: 25-16
cover: /vchart/preview/axis-band-size_1.4.0.png
option: barChart#axes
---

# Axis fixed bandSize and auto scroll bar

Sometimes we have a requirement for a fixed discrete axis band width (the band width is the width occupied by a tick on the coordinate axis). The visual effect is that regardless of the size of the chart container, the distance between the ticks on the axis remains unchanged (if it is a bar chart, the column width also remains unchanged).

## Key Configuration

In the Cartesian coordinate system, if you want to fix the band width of the discrete axis, you can manually set the band width by configuring `bandSize` on the axis.

Furthermore, if you want to configure the maximum or minimum band width, you can do so by configuring `maxBandSize` or `minBandSize` on the axis.

Taking the minimum band width as an example, since the chart will display all the ticks in the container proportionally by default, the automatically calculated band width will also decrease proportionally when the chart container becomes smaller. When the automatically calculated band width is less than `minBandSize`, the band width will maintain the value of `minBandSize`.

When `bandSize` is already configured, `maxBandSize` and `minBandSize` will no longer take effect.

Additionally, if the band width is fixed, the chart size is likely to exceed the container. At this point, you can configure the scrollBar or dataZoom components, and configure 'auto' to 'true' in the component spec.

## Code Demo

```javascript livedemo
const spec = {
  type: 'area',
  data: {
    values: [
      { type: 'Nail polish', country: 'Africa', value: 4229 },
      { type: 'Nail polish', country: 'EU', value: 4376 },
      { type: 'Nail polish', country: 'China', value: 3054 },
      { type: 'Nail polish', country: 'USA', value: 12814 },
      { type: 'Eyebrow pencil', country: 'Africa', value: 3932 },
      { type: 'Eyebrow pencil', country: 'EU', value: 3987 },
      { type: 'Eyebrow pencil', country: 'China', value: 5067 },
      { type: 'Eyebrow pencil', country: 'USA', value: 13012 },
      { type: 'Rouge', country: 'Africa', value: 5221 },
      { type: 'Rouge', country: 'EU', value: 3574 },
      { type: 'Rouge', country: 'China', value: 7004 },
      { type: 'Rouge', country: 'USA', value: 11624 },
      { type: 'Lipstick', country: 'Africa', value: 9256 },
      { type: 'Lipstick', country: 'EU', value: 4376 },
      { type: 'Lipstick', country: 'China', value: 9054 },
      { type: 'Lipstick', country: 'USA', value: 8814 },
      { type: 'Eyeshadows', country: 'Africa', value: 3308 },
      { type: 'Eyeshadows', country: 'EU', value: 4572 },
      { type: 'Eyeshadows', country: 'China', value: 12043 },
      { type: 'Eyeshadows', country: 'USA', value: 12998 },
      { type: 'Eyeliner', country: 'Africa', value: 5432 },
      { type: 'Eyeliner', country: 'EU', value: 3417 },
      { type: 'Eyeliner', country: 'China', value: 15067 },
      { type: 'Eyeliner', country: 'USA', value: 12321 },
      { type: 'Foundation', country: 'Africa', value: 13701 },
      { type: 'Foundation', country: 'EU', value: 5231 },
      { type: 'Foundation', country: 'China', value: 10119 },
      { type: 'Foundation', country: 'USA', value: 10342 },
      { type: 'Lip gloss', country: 'Africa', value: 4008 },
      { type: 'Lip gloss', country: 'EU', value: 4572 },
      { type: 'Lip gloss', country: 'China', value: 12043 },
      { type: 'Lip gloss', country: 'USA', value: 22998 },
      { type: 'Mascara', country: 'Africa', value: 18712 },
      { type: 'Mascara', country: 'EU', value: 6134 },
      { type: 'Mascara', country: 'China', value: 10419 },
      { type: 'Mascara', country: 'USA', value: 11261 }
    ]
  },
  title: {
    visible: true,
    text: 'Stacked area chart of cosmetic products sales'
  },
  xField: 'type',
  yField: 'value',
  seriesField: 'country',
  legends: [{ visible: true, position: 'middle', orient: 'bottom' }],
  crosshair: {
    xField: { visible: true, label: { visible: true } },
    yField: { visible: true, label: { visible: true } }
  },
  axes: [
    {
      orient: 'bottom',
      type: 'band',
      bandSize: 100
    },
    { orient: 'left', type: 'linear' }
  ],
  scrollBar: [
    {
      orient: 'bottom',
      start: 0,
      filterMode: 'axis',
      axisIndex: 0,
      auto: true
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Related Tutorials

Attach links to tutorials or API documentation associated with this demo configuration.
