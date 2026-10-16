3d 柱状图/条形图

## 简介

3d 柱状图大部分配置项继承于 2d 面积图，其是 series 或者 chart 类型由`bar`变成`bar3d`来启用

![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/45df54929d214e7453e228f27.png)

条形图是在柱状图的基础上，做了 x 轴和 y 轴的转置，在配置上和柱状图基本一致，只是 x 轴和 y 轴的配置需要对调，同时需要加上 `direction` 属性配置为 `'horizontal'`。

![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/350c0511133d336e62252321d.png)

## 图表构成

柱状图由矩形图元、坐标轴及其他组件构成。

![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/03421afda76ced0240204bf04.png)
矩形图元为柱状图/条形图的基本要素，相关的绘制配置必不可少:

- `barChart.type`: 图表类型，柱状体 / 条形图的类型为`'bar3d'`
- `barChart.data`: 图表绘制的数据源
- `barChart.xField`: 分类字段，映射图元的 x 坐标 / 宽度
- `barChart.yField`: 数值字段，映射图元的高度 / y 坐标

坐标轴、提示信息等作为辅助图表展示的组件，属于可选配置，自带默认效果和功能:

- `barChart.axes`: 坐标轴组件，默认显示并根据图表类型自动推断坐标系及数据映射逻辑，详情配置见[VChart 坐标轴组件配置](../../../option/barChart#axes)
- `barChart.tooltip`: 提示信息，默认交互时显示，详细配置见[VChart 提示信息组件配置](../../../option/barChart#tooltip)
- 更多组件配置见[VChart barChart 配置](../../../option/barChart)
  作为 3d 图表，3d 散点图需要开启 3d 视图，需要在 vchart 的初始化参数中配置 3d 视角:

- `options3d.enable`: 启用 3d 视角

## 快速上手

```javascript livedemo
/**
 * 自2.0.0版本后，3d图表从vchart-extension中引入
 *
 * import { registerBar3dChart } from '@visactor/vchart-extension';
 *
 * registerBar3dChart();
 */

/** --Remove the following code when using in business-- */
if (VChartExtension.registerBar3dChart) {
  VChartExtension.registerBar3dChart();
}
/** --Remove the above code when using in business-- */

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

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

其他配置参考[柱状图]()
