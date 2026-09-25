# 3d 面积图

## 简介

3d 面积图大部分配置项继承于 2d 面积图，其是对 2d 折线图增加 zField 映射以及 z 轴而得到

![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/350c0511133d336e622523219.png)

## 图表构成

面积图由点图元、线图元、坐标轴及其他组件构成。
![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/b42a7699efcd4dfa8b8aa3a04.png)

点图元、线图元为面积图的基本要素，相关的绘制配置必不可少:

- `areaChart.type`: 图表类型，面积图的类型为`'area'`
- `areaChart.data`: 图表绘制的数据源
- `areaChart.xField`: 连续时间间隔或有序类别字段，映射图元的 x 坐标
- `areaChart.yField`: 数值字段，映射图元的 y 坐标
- `areaChart.zField`: 数值字段，映射图元的 z 坐标

坐标轴、提示信息等作为辅助图表展示的组件，属于可选配置，自带默认效果和功能:

- `areaChart.axes`: 坐标轴组件，默认显示并根据图表类型自动推断坐标系及数据映射逻辑，详情配置见[VChart 坐标轴组件配置](../../../option/areaChart#axes)
- `areaChart.tooltip`: 提示信息，默认交互时显示，详细配置见[VChart 提示信息组件配置](../../../option/areaChart#tooltip)
- 更多组件配置见[VChart areaChart 配置](../../../option/areaChart)

作为 3d 图表，3d 面积图需要开启 3d 视图，需要在 vchart 的初始化参数中配置 3d 视角:

- `options3d.enable`: 启用 3d 视角
- `options3d.enableView3dTransform`: 支持 3d 的自由变换
<!-- qAA -->

## 快速上手

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

其他配置参考[面积图]()
