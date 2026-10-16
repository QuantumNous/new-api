---
category: demo
group: interaction
title: 图例触发系列高亮
keywords: commonChart
order: 42-1
cover: /vchart/preview/interaction-highlight-by-legend_1.9.0.gif
option: commonChart
---

# 图例触发系列高亮

通过配置`element-highlight-by-legend` 交互类型，图例触发图元的高亮(`highlight`)、失焦(`blur`)状态

## 关键配置

- `interactions` 设置系列的交互
- `bar.state.highlight` 设置柱图元`highlight`状态对应的样式
- `bar.state.blur` 设置柱图元`blur`状态对应的样式
- `line.state.highlight` 设置线图元`highlight`状态对应的样式
- `line.state.blur` 设置线图元`blur`状态对应的样式
- `point.state.highlight` 设置点图元`highlight`状态对应的样式
- `point.state.blur` 设置点图元`blur`状态对应的样式
- `label.syncState` 设置标签状态和扇区状态联动
- `label.state.highlight` 设置标签`highlight`状态样式

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
      label: {
        visible: true,
        syncState: true,
        state: {
          highlight: { fontWeight: 'bold' },
          blur: { opacity: 0.2 }
        }
      },
      seriesField: 'type',
      dataIndex: 0,
      xField: ['x', 'type'],
      yField: 'y',
      bar: {
        state: {
          highlight: {
            stroke: '#000',
            lineWidth: 2
          },
          blur: {
            opacity: 0.2
          }
        }
      },
      interactions: [
        {
          type: 'element-highlight-by-legend'
        }
      ]
    },
    {
      type: 'line',
      id: 'line',
      dataIndex: 1,
      label: {
        visible: true,
        syncState: true,
        state: {
          highlight: { fontWeight: 'bold' },
          blur: { opacity: 0.2 }
        }
      },
      seriesField: 'type',
      xField: 'x',
      yField: 'y',
      stack: false,
      line: {
        state: {
          highlight: {
            lineWidth: 4
          },
          blur: {
            opacity: 0.2
          }
        }
      },
      point: {
        state: {
          highlight: {
            size: 10
          },
          blur: {
            opacity: 0.2
          }
        }
      },
      interactions: [
        {
          type: 'element-highlight-by-legend'
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
