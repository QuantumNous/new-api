---
category: examples
group: chart-3d
title: 3D Base Bar Chart
keywords: space
order: 23-1
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/chart-3d/bar3d.png
option: bar3dChart
---

# Basic Bar Chart

The configuration of the 3D bar chart inherits most of the configuration of a regular bar chart. The difference is that the `type` needs to be configured to `rect3d`, and the ChartSpace instance is instantiated with the `option3d` configuration. The 3D bar chart has Cartesian axes, and the axes can also be configured with `mode: 3d` to support 3D mode.

## Key option

- `type: bar3d` attribute declares a bar chart
- The `xField` attribute declares the category field or the time series field
- The `yField` attribute declares the numeric field
- `length` is the 3d length property of the `rect`, which controls the length in the z direction
- In the 3d mode, `z` is the z-coordinate position of the `rect`
- Axes support different modes with `mode: 3d` configuration

## Demo source

```javascript livedemo
/**
 * Since version 2.0.0, 3D charts are imported from vchart-extension.
 *
 * import { registerBar3dChart } from '@visactor/vchart-extension';
 *
 * registerBar3dChart();
 */

/** --Remove the following code when using in production-- */
if (VChartExtension.registerBar3dChart) {
  VChartExtension.registerBar3dChart();
}
/** --Remove the above code when using in production-- */

const spec = {
  type: 'bar3d',
  data: [
    {
      id: 'barData',
      values: [
        { month: 'Monday', sales: 22 },
        { month: 'Tuesday', sales: 13 },
        { month: 'Wednesday', sales: 25 },
        { month: 'Thursday', sales: 29 },
        { month: 'Friday', sales: 38 }
      ]
    }
  ],
  xField: 'month',
  yField: 'sales',
  bar3d: {
    style: {
      length: 20,
      z: -20
    },
    state: {
      selected: {
        stroke: '#000',
        strokeWidth: 1
      }
    }
  },
  axes: [
    { orient: 'bottom', type: 'band', tick: { tickSize: 20 }, mode: '3d' },
    { orient: 'left', type: 'linear', tick: { tickSize: 20 }, mode: '3d' }
  ]
};

const vchart = new VChart(spec, {
  dom: CONTAINER_ID,
  disableDirtyBounds: true,
  options3d: {
    enable: true
  }
});
vchart.renderSync();

// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
```

## Related Tutorial

[3D Bar Chart](link)
