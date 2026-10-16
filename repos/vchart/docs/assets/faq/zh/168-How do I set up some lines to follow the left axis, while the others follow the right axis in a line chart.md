# 折线图有多条线，如何设置右侧坐标轴，并且某条线是根据右侧坐标轴绘制的?

## 问题描述

我有一张折线图。如何明确指定线段跟随左轴或右轴？
这是一个复杂的场景， 因为要让折线图中一些线条遵循左轴， 其他的遵循右轴， 同时，所有线条又都跟随底轴。
更抽象一些， 就意味着每一轴可以对应多个折线。

## 解决方案

VChart 图表已经提供了对应的功能。VChart 支持：

- 在 series 上配置 dataId 维护 data 与 series 的一对一关系。
- 在 axis 上配置 seriesId 维护 axis 与 series 的一对多关系。

[折线图系列配置文档](https://visactor.io/vchart/option/commonChart#series-line.type)

## 代码示例

```javascript livedemo
const spec = {
  type: 'common',
  data: [
    {
      id: 'profit',
      values: [
        { time: '2019', value: 100000 },
        { time: '2020', value: 200000 },
        { time: '2021', value: 300000 },
        { time: '2022', value: 400000 },
        { time: '2023', value: 500000 }
      ]
    },
    {
      id: 'saleDiscount',
      values: [
        { time: '2019', value: 0.2 },
        { time: '2020', value: 0.35 },
        { time: '2021', value: 0.25 },
        { time: '2022', value: 0.2 },
        { time: '2023', value: 0.1 }
      ]
    }
  ],
  axes: [
    {
      orient: 'left',
      seriesId: ['profit'],
      id: 'left'
    },
    {
      sync: {
        axisId: 'left',
        tickAlign: true,
        zeroAlign: true
      },
      id: 'right',
      label: {
        formatMethod: v => parseFloat(v).toFixed(2)
      },
      orient: 'right',
      seriesId: ['saleDiscount']
    },
    {
      orient: 'bottom',
      seriesId: ['saleDiscount', 'profit']
    }
  ],
  series: [
    {
      id: 'profit',
      type: 'line',
      xField: 'time',
      yField: 'value',
      dataId: 'profit'
    },
    {
      id: 'saleDiscount',
      type: 'line',
      xField: 'time',
      yField: 'value',
      dataId: 'saleDiscount'
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关文档

- [github](https://github.com/VisActor/VChart)
- [坐标轴 教程](http://visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Axes)
- [组合图教程](http://visactor.io/vchart/guide/tutorial_docs/Chart_Types/Combination)
- [折线图配置文档 ](https://visactor.io/vchart/option/commonChart#series-line.type)
- [双轴图示例 Demo](http://visactor.io/vchart/demo/combination/dual-axis)
