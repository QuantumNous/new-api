# 线图和堆积柱状图组合，如何定义轴的映射关系？

## 问题描述

在一个柱线组合图中，有 2 条线，我希望下面的线与柱子都是对应左轴，顶部的线对应右轴。在 vchart 里应该如何配置呢？

## 解决方案

在 VChart 中轴和系列可以灵活的配置对应关系，在轴上有配置 seriesId 可以配置为一个系列 id 的数组或者单个系列 id

1. 将线的数据分成 2 份，如果已经是 2 份可以不处理，假设他们的 id 分别是 line0 和 line1 , 同时柱子的 id 是 bar0
2. 将左轴的 seriesId 设置为 ['line0','bar0']，将右轴的 seriesId 设置为['line1']。

## 代码示例

```javascript livedemo
const spec = {
  type: 'common',
  seriesField: 'color',
  data: [
    {
      id: 'data0',
      values: [
        { x: '周一', type: '早餐', y: 15 },
        { x: '周一', type: '午餐', y: 25 },
        { x: '周二', type: '早餐', y: 12 },
        { x: '周二', type: '午餐', y: 30 },
        { x: '周三', type: '早餐', y: 15 },
        { x: '周三', type: '午餐', y: 24 },
        { x: '周四', type: '早餐', y: 10 },
        { x: '周四', type: '午餐', y: 25 },
        { x: '周五', type: '早餐', y: 13 },
        { x: '周五', type: '午餐', y: 20 },
        { x: '周六', type: '早餐', y: 10 },
        { x: '周六', type: '午餐', y: 22 },
        { x: '周日', type: '早餐', y: 12 },
        { x: '周日', type: '午餐', y: 19 }
      ]
    },
    {
      id: 'data1',
      values: [
        { x: '周一', type: '酒水', y: 22 },
        { x: '周二', type: '酒水', y: 23 },
        { x: '周三', type: '酒水', y: 13 },
        { x: '周四', type: '酒水', y: 12 },
        { x: '周五', type: '酒水', y: 10 },
        { x: '周六', type: '酒水', y: 20 },
        { x: '周日', type: '酒水', y: 10 }
      ]
    },
    {
      id: 'data2',
      values: [
        { x: '周一', type: '饮料', y: 132 },
        { x: '周二', type: '饮料', y: 143 },
        { x: '周三', type: '饮料', y: 143 },
        { x: '周四', type: '饮料', y: 132 },
        { x: '周五', type: '饮料', y: 130 },
        { x: '周六', type: '饮料', y: 130 },
        { x: '周日', type: '饮料', y: 150 }
      ]
    }
  ],
  series: [
    {
      type: 'bar',
      id: 'bar',
      dataIndex: 0,
      seriesField: 'type',
      dataIndex: 0,
      xField: ['x', 'type'],
      yField: 'y'
    },
    {
      type: 'line',
      id: 'line0',
      dataId: 'data1',
      seriesField: 'type',
      xField: 'x',
      yField: 'y',
      stack: false
    },
    {
      type: 'line',
      id: 'line1',
      dataId: 'data2',
      seriesField: 'type',
      xField: 'x',
      yField: 'y',
      stack: false
    }
  ],
  axes: [
    { orient: 'left', seriesId: ['line0', 'bar'] },
    { orient: 'right', seriesId: 'line1' },
    ,
    { orient: 'bottom', label: { visible: true }, type: 'band' }
  ],
  legends: {
    visible: true,
    orient: 'bottom'
  }
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关文档

- [github](https://github.com/VisActor/VChart)
- [轴配置](<https://www.visactor.io/vchart/option/barChart-axes-linear#seriesId(string%7Cnumber%7C(string%20%7C%20number)%5B%5D)>)
