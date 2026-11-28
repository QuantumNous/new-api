# 3d Area Chart

## Introduction

The 3d area chart inherits most of its configuration items from the 2d area chart. It is obtained by adding zField mapping and the z-axis to the 2d line chart.

![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/350c0511133d336e622523219.png)

## Chart Composition

The area chart consists of point elements, line elements, axes, and other components.
![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/b42a7699efcd4dfa8b8aa3a04.png)

Point elements and line elements are the basic components of an area chart, and the related drawing configurations are essential:

- `areaChart.type`: Chart type; the area chart's type is `'area'`
- `areaChart.data`: Data source for chart drawing
- `areaChart.xField`: Continuous time interval or ordered category field, mapping the x-coordinate of the element
- `areaChart.yField`: Value field, mapping the y-coordinate of the element
- `areaChart.zField`: Value field, mapping the z-coordinate of the element

Axes, tooltips, and other components that assist in chart display are optional configurations with default effects and functions:

- `areaChart.axes`: Axis component, default is to display and automatically infer the coordinate system and data mapping logic according to the chart type. For detailed configuration, see [VChart Axis Component Configuration](../../../option/areaChart#axes)
- `areaChart.tooltip`: Tooltip, default is displayed during interaction. For detailed configuration, see [VChart Tooltip Component Configuration](../../../option/areaChart#tooltip)
- For more component configurations, see [VChart areaChart Configuration](../../../option/areaChart)

As a 3d chart, the 3d area chart requires enabling the 3d view. Configure the 3d view in the vchart initialization parameters:

- `options3d.enable`: Enable the 3d view
- `options3d.enableView3dTransform`: Support for 3d free transform

## Quick Start

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
  axes: [
    {
      orient: 'bottom',
      mode: '3d',
      domainLine: { style: { stroke: '#000' } },
      tick: {
        style: { stroke: '#000' }
      }
    },
    {
      orient: 'left',
      mode: '3d',
      domainLine: { visible: false },
      tick: { visible: false },
      label: {
        style: {
          fill: 'rgb(162, 162, 162)'
        }
      },
      grid: {
        style: {
          lineDash: [0],
          stroke: 'rgb(231, 231, 231)'
        }
      }
    },
    {
      orient: 'z',
      mode: '3d',
      label: { visible: true },
      type: 'band',
      grid: { visible: true },
      width: 600,
      height: 200,
      depth: 200
    }
  ],
  stack: true,
  xField: 'type',
  yField: 'value',
  zField: 'country',
  seriesField: 'country',
  legends: [{ visible: true, position: 'middle', orient: 'bottom', padding: { top: 30 } }]
};

const vchart = new VChart(spec, {
  dom: CONTAINER_ID,
  disableDirtyBounds: true,
  options3d: {
    enable: true,
    enableView3dTransform: true,
    center: { x: 500, y: 250 }
  }
});
vchart.renderSync();

// 只为了方便控制台调试用，不要拷贝
window['vchart'] = vchart;
```

For other configurations, please refer to [Area Chart]()
