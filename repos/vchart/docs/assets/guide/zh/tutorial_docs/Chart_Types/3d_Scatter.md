3d 散点图

## 简介

3d 散点图大部分配置项继承于 2d 面积图，其是对 2d 散点图增加 zField 映射以及 z 轴而得到

### 图表构成

散点图由点图元、坐标轴、提示信息及其他组件构成。  
![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/a222eb3ecfe32db85220dda0a.png)

- `scatterChart.type`: 图表类型，散点图的类型为`'scatter'`
- `scatterChart.data`: 图表绘制的数据源
- `scatterChart.xField`: 分类/数值字段，映射图元的 x 坐标
- `scatterChart.yField`: 分类/数值字段，映射图元的 y 坐标
- `scatterChart.zField`: 分类/数值字段，映射图元的 z 坐标
- `scatterChart.sizeField`: 数值字段，映射图元的大小

坐标轴、提示信息等作为辅助图表展示的组件，属于可选配置，自带默认效果和功能:

- `scatterChart.axes`: 坐标轴组件，默认显示并根据图表类型自动推断坐标系及数据映射逻辑，详情配置见[VChart 坐标轴组件配置](../../../option/scatterChart#axes)
- `scatterChart.tooltip`: 提示信息，默认交互时显示，详细配置见[VChart 提示信息组件配置](../../../option/scatterChart#tooltip)
- 更多组件配置见[VChart scatterChart 配置](../../../option/scatterChart)

作为 3d 图表，3d 散点图需要开启 3d 视图，需要在 vchart 的初始化参数中配置 3d 视角:

- `options3d.enable`: 启用 3d 视角
- `options3d.enableView3dTransform`: 支持 3d 的自由变换

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

其他配置参考[散点图]()
