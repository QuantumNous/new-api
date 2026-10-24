---
category: examples
group: interaction
title: 组合图联合高亮
keywords: commonChart
order: 42-4
cover: /vchart/preview/interaction-combination-chart-highlight-by-key_1.9.0.gif
option: commonChart
---

# 组合图联合高亮

通过配置`element-highlight-by-key` 交互类型，高亮和选中元素具有相同`key`的元素，其他元素失焦；注意系列可以通过`dataKey` 设置每个图形对应的`key`；

## 关键配置

- `interactions` 设置系列的交互
- `dataKey` 设置图形元素的全局唯一的`key`
- `bar.state.blur` 设置柱系列中的`blur`状态对应的样式
- `point.state.blur` 设置线系列中点图元的`blur`状态对应的样式
- `line.state.blur` 设置线系列中线图元的`blur`状态对应的样式

## 代码演示

```javascript livedemo
const spec = {
  type: 'common',
  seriesField: 'color',
  data: [
    {
      id: 'id0',
      values: [
        { x: 'Mon-Tue', type: 'a', y: 19 },
        { x: 'Tue-Web', type: 'a', y: 18 },
        { x: 'Wed-Thur', type: 'a', y: 16 },
        { x: 'Thur-Fri', type: 'a', y: 14 },
        { x: 'Fri-Sat', type: 'a', y: 12 },
        { x: 'Sat-Sun', type: 'a', y: 11 }
      ]
    },
    {
      id: 'id1',
      values: [
        { x: 'Mon-Tue', type: 'b', y: 16 },
        { x: 'Tue-Web', type: 'b', y: 17 },
        { x: 'Wed-Thur', type: 'b', y: 18 },
        { x: 'Thur-Fri', type: 'b', y: 20 },
        { x: 'Fri-Sat', type: 'b', y: 24 },
        { x: 'Sat-Sun', type: 'b', y: 26 }
      ]
    }
  ],
  series: [
    {
      type: 'bar',
      dataKey: 'x',
      dataIndex: 0,
      seriesField: 'type',
      dataIndex: 0,
      xField: 'x',
      yField: 'y',

      bar: {
        state: {
          blur: {
            opacity: 0.2
          }
        }
      }
    },
    {
      type: 'line',
      dataKey: 'x',
      dataIndex: 1,
      seriesField: 'type',
      xField: 'x',
      yField: 'y',
      stack: false,

      point: {
        state: {
          blur: {
            opacity: 0.2
          }
        }
      },
      line: {
        state: {
          blur: {
            opacity: 0.2
          }
        }
      }
    }
  ],
  axes: [
    { orient: 'left' },
    {
      orient: 'bottom',
      visible: true,
      domain: ['Mon', 'Tue', 'Wed', 'Thur', 'Fri', 'Sat', 'Sun'],
      label: { visible: true },
      type: 'band',
      // bandPadding: 0,
      // paddingInner: 1,
      // paddingOuter: 0
      trimPadding: true
    },
    {
      orient: 'bottom',
      visible: false,
      label: { visible: true },
      type: 'band',
      bandPadding: 0,
      paddingInner: 0,
      paddingOuter: 0
    }
  ],
  interactions: [
    {
      type: 'element-highlight-by-key'
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 关键配置

无

## 相关教程

[折线图](link)
