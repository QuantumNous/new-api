3D Bar/Column Chart

## Introduction

The majority of configuration options for 3D bar charts are inherited from 2D area charts. They are enabled by changing the series or chart type from `bar` to `bar3d`.

![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/45df54929d214e7453e228f27.png)

Column charts are based on bar charts with the x-axis and y-axis transposed. The configuration is almost the same as bar charts, except that the x-axis and y-axis configurations need to be swapped, and the `direction` attribute should be configured as `'horizontal'`.

![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/350c0511133d336e62252321d.png)

## Chart Composition

Bar charts consist of rectangular chart elements, axes, and other components.

![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/03421afda76ced0240204bf04.png)
The rectangular chart element is an essential building block for bar/column charts, and the related drawing configurations cannot be omitted:

- `barChart.type`: Chart type, the type for bar/column charts is `'bar3d'`
- `barChart.data`: Data source for chart rendering
- `barChart.xField`: Category field, mapping the element's x-coordinate/width
- `barChart.yField`: Numeric field, mapping the element's height/y-coordinate

Axes, tooltips, and other components, which serve as auxiliary chart display components, are optional configurations with default effects and functionality:

- `barChart.axes`: Axis component, displayed by default and automatically inferring coordinate system and data mapping logic based on chart type. For detailed configurations, see [VChart Axis Component Configuration](../../../option/barChart#axes)
- `barChart.tooltip`: Tooltip information, displayed by default during interaction, for detailed configurations, see [VChart Tooltip Component Configuration](../../../option/barChart#tooltip)
- For more component configurations, see [VChart barChart Configuration](../../../option/barChart)
  As a 3D chart, 3D scatter plot needs to enable 3D view, which needs to be configured in the initialization parameters of vchart:

- `options3d.enable`: Enable 3D view

## Quick Start

```javascript livedemo
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
```

For other configurations, refer to [Bar Chart]()
