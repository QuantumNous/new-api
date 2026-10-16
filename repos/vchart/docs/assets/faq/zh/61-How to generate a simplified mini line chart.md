# 如何生成一个 mini 折线图？

## 问题描述

我想制作一个非常精简的折线图，尽可能的节省空间，快速有效地传达数据的趋势和变化。
因此我期望这个折线图除了这线段以外，不再需要坐标轴、标签、图例等组件。

## 解决方案

VChart 的各个图表组件提供了丰富的样式配置，在组件中配置 `visible:false` 就能够让组件隐藏，以绘制更加精简的图表。

## 代码示例

```javascript livedemo
const spec = {
  type: 'line',
  // type: 'area',
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
  padding: 0,
  margin: 0,
  point: {
    visible: false
  },
  line: {
    style: {
      curveType: 'monotone'
    }
  },
  axes: [
    {
      type: 'linear',
      orient: 'left',
      nice: true,
      zero: true,
      visible: false
    },
    {
      type: 'band',
      paddingOuter: 0,
      paddingInner: 0,
      orient: 'bottom',
      visible: false
    }
  ],
  legends: [
    {
      visible: false
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
- [VChart 坐标轴教程](https://visactor.io/vchart/guide/concepts/axes)
- [VChart 折线图教程](https://visactor.io/vchart/guide/chart/line)
