---
category: demo
group: interaction
title: 双轴图元素激活
keywords: commonChart
order: 42-0
cover: /vchart/preview/interaction-element-active_1.9.0.gif
option: commonChart
---

# 双轴图元素激活样式

通过配置`element-active` 交互类型，将选中的元素设置为`active`激活状态

## 关键配置

- `interactions` 设置系列的交互
- `line.state.active` 设置线图元激活状态样式
- `bar.state.active` 设置柱图元激活状态样式

## 代码演示

```javascript livedemo
const spec = {
  type: 'common',
  seriesField: 'color',
  data: [
    {
      id: 'id0',
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
      id: 'id1',
      values: [
        { x: '周一', type: '饮料', y: 22 },
        { x: '周二', type: '饮料', y: 43 },
        { x: '周三', type: '饮料', y: 33 },
        { x: '周四', type: '饮料', y: 22 },
        { x: '周五', type: '饮料', y: 10 },
        { x: '周六', type: '饮料', y: 30 },
        { x: '周日', type: '饮料', y: 50 }
      ]
    }
  ],
  series: [
    {
      type: 'bar',
      id: 'bar',
      dataIndex: 0,
      label: { visible: true, syncState: true },
      seriesField: 'type',
      dataIndex: 0,
      xField: ['x', 'type'],
      yField: 'y',
      bar: {
        state: {
          active: {
            stroke: '#000',
            lineWidth: 2
          }
        }
      },
      interactions: [
        {
          type: 'element-active'
        }
      ]
    },
    {
      type: 'line',
      id: 'line',
      dataIndex: 1,
      label: { visible: true, syncState: true },
      seriesField: 'type',
      xField: 'x',
      yField: 'y',
      stack: false,
      line: {
        state: {
          active: {
            lineWidth: 4
          }
        }
      },
      interactions: [
        {
          type: 'element-active'
        }
      ]
    }
  ],
  axes: [
    { orient: 'left', seriesIndex: [0] },
    { orient: 'right', seriesId: ['line'], grid: { visible: false } },
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

## 相关教程

TODO
