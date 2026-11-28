# 坐标轴刻度的时间区间长度是给定的（一个季度），我怎么能设定比如只显示三个坐标轴刻度么？或者自适应的均匀些？

## 问题描述

类似 （https://www.visactor.io/vchart/demo/line-chart/multi-line）这样的折线图
坐标轴时间区间长度给定的情况下，该怎么设置坐标轴刻度的显示数量？例如我想只显示三个坐标轴刻度，或者自适应刻度数量。

## 解决方案

在 VChart 中，共有 linear、band、time、log4 种坐标轴类型。对于每种坐标轴，只需要设置 tick.tickCount=3，或者 tick.forceTickCount=3 即可指定坐标轴刻度的数量。

当未指定 tickCount 时，会采用自适应 tick 数量，自动寻找能够使所有轴标签都不重叠的最大 tick 数量

## 代码示例

```javascript livedemo
const spec = {
  type: 'line',
  data: {
    values: [
      {
        time: '2:00',
        value: 8
      },
      {
        time: '4:00',
        value: 9
      },
      {
        time: '6:00',
        value: 11
      },
      {
        time: '8:00',
        value: 14
      },
      {
        time: '10:00',
        value: 16
      },
      {
        time: '12:00',
        value: 17
      },
      {
        time: '14:00',
        value: 17
      },
      {
        time: '16:00',
        value: 16
      },
      {
        time: '18:00',
        value: 15
      }
    ]
  },
  xField: 'time',
  yField: 'value',
  seriesField: 'name',
  axes: [
    {
      orient: 'left',
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
      orient: 'bottom',
      domainLine: { visible: true, style: { stroke: '#000' } },
      tick: {
        style: { stroke: '#000' },
        tickCount: 3
      }
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 结果展示

- [在线效果参考](https://codesandbox.io/s/line-chart-tick-count-fxh599?file=/src/index.ts)

## 相关文档

- [折线图教程](https://www.visactor.io/vchart/guide/tutorial_docs/Chart_Types/Line)
- [相关 api](https://www.visactor.io/vchart/option/lineChart#axes-linear.tick.tickCount)
- [github](https://github.com/VisActor/VChart)
