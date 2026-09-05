3D scatter plot

## Introduction

Most of the configuration items in the 3D scatter plot are inherited from the 2D area plot, which is obtained by adding zField mapping and z-axis to the 2D scatter plot

### Chart composition

Scatter plots are composed of point entities, coordinate axes, prompt information, and other components.
![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/a222eb3ecfe32db85220dda0a.png)

- `scatterChart.type`: Chart type, the type of line chart is`'scatterChart'`
- `scatterChart.data`: The data source for chart drawing
- `scatterChart.xField`: Continuous time interval or ordered category field, mapping the x-coordinate of the entity
- `scatterChart.yField`: Numerical field, mapping the y-coordinate of the entity
- `scatterChart.zField`: Numerical field, mapping the z-coordinate of the entity
- `scatterChart.sizeField`: Numeric fields, mapping the size of entities
  The coordinate axis, prompt information, and other components used as auxiliary chart displays are optional configurations with default effects and functions:

-`scatterChart.axes`: Coordinate axis component, displayed by default and automatically inferred coordinate system and data mapping logic based on chart type. For detailed configuration, please refer to [VChart Coordinate Axis Component Configuration](../../../option/line/axes/lineChart#axes)

-`scatterChart.tooltip`: prompt information, displayed by default during interaction. For detailed configuration, please refer to [VChart Prompt Information Component Configuration](../../../option/line/axes/lineChart#tooltip)

As a 3D chart, a 3D line chart needs to have a 3D view enabled, and the 3D perspective needs to be configured in the initialization parameters of vchart:

- `options3d.enable`: Enable 3D perspective
- `options3d.enableView3dTransform`: Supports 3D free transformation

```javascript livedemo
const data = [
  {
    values: [
      { x: 936196, size: 83431, y: 1371, type: 'Technology', area: 'Northeast' },
      { x: 1270911, size: 219815, y: 5590, type: 'office supplies', area: 'Zhongnan' },
      { x: 453898, size: 19061, y: 727, type: 'Technology', area: 'Southwest' },
      { x: 919743, size: 148800, y: 1199, type: 'furniture', area: 'North China' },
      { x: 1676224, size: 163453, y: 2517, type: 'furniture', area: 'East China' },
      { x: 1466575, size: 251487, y: 2087, type: 'Technology', area: 'Zhongnan' },
      { x: 824673, size: 86067, y: 3622, type: 'office supplies', area: 'Northeast' },
      { x: 230956, size: 24016, y: 347, type: 'Technology', area: 'Northwest' },
      { x: 1599653, size: 228179, y: 2183, type: 'Technology', area: 'East China' },
      { x: 745813, size: 137265, y: 3020, type: 'office supplies', area: 'North China' },
      { x: 267870, size: 49633, y: 970, type: 'office supplies', area: 'Northwest' },
      { x: 1408628, size: 215585, y: 6341, type: 'office supplies', area: 'East China' },
      { x: 781743, size: 144986, y: 927, type: 'Technology', area: 'North China' },
      { x: 501533, size: 29303, y: 814, type: 'furniture', area: 'Southwest' },
      { x: 920698, size: 72692, y: 1470, type: 'furniture', area: 'Northeast' },
      { x: 316212, size: 24903, y: 468, type: 'furniture', area: 'Northwest' },
      { x: 1399928, size: 199582, y: 2023, type: 'furniture', area: 'Zhongnan' },
      { x: 347692, size: 49272, y: 1858, type: 'office supplies', area: 'Southwest' }
    ]
  }
];

// 图表配置
const spec = {
  type: 'scatter',
  data: data,
  xField: 'x',
  yField: 'y',
  zField: 'area',
  seriesField: 'type',
  // shape
  shapeField: 'type',
  shape: {
    type: 'ordinal',
    range: ['star', 'triangleLeft', 'diamond']
  },
  // size
  sizeField: 'size',
  size: {
    type: 'linear',
    range: [5, 25]
  },
  // point
  point: {
    state: {
      hover: {
        scaleX: 1.2,
        scaleY: 1.2
      }
    }
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
  legends: [
    {
      visible: true,
      orient: 'left',
      position: 'start',
      title: {
        visible: true,
        style: {
          text: 'title'
        }
      },
      item: {
        visible: true
      }
    }
  ],
  direction: 'horizontal'
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

Other configurations refer to [Line Chart]()
