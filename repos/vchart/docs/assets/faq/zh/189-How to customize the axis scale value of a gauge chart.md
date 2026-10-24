# 如何自定义仪表图的刻度值？

## 问题描述

VChart 如何配置仪表图的刻度值？如下图所示，我只想要 0，25，50，75，100。

![description](/vchart/faq/68-0.png)

## 解决方案

可以参照以下 demo，更改仪表图角度轴上的 spec。你可以通过配置轴 tick 的最大最小值和步长来解决问题。

## 代码示例

```javascript livedemo
const spec = {
  type: 'gauge',
  data: [
    {
      id: 'id0',
      values: [
        {
          type: 'Target A',
          value: 60
        }
      ]
    }
  ],
  categoryField: 'type',
  valueField: 'value',
  outerRadius: 0.8,
  innerRadius: 0.6,
  startAngle: -240,
  endAngle: 60,
  axes: [
    {
      type: 'linear',
      orient: 'angle',
      max: 100,
      min: 0,
      tick: {
        visible: true,
        tickStep: 25
      },
      subTick: {
        visible: true
      },
      inside: true
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 结果展示

![demo](/vchart/faq/68-1.png)

## 相关文档

github：[https://github.com/VisActor/VChart](https://github.com/VisActor/VChart)

Demo page: [https://www.visactor.io/vchart/demo/gauge-chart/basic-gauge](https://www.visactor.io/vchart/demo/gauge-chart/basic-gauge)
