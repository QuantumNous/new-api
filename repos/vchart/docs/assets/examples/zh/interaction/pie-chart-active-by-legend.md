---
category: demo
group: interaction
title: 图例激活饼图扇区
keywords: pieChart,comparison,composition,proportion,circle
order: 42-4
cover: /vchart/preview/interaction-pie-chart-active-by-legend_1.9.0.gif
option: pieChart
---

# 图例激活饼图扇区

通过配置`element-active-by-legend` 交互类型，图例触发图元的激活(`active`)状态

## 关键配置

- `interactions` 设置系列的交互
- `pie.state.active` 设置激活状态样式
- `label.syncState` 设置标签状态和扇区状态联动
- `label.state.active` 设置标签激活状态样式

## 代码演示

```javascript livedemo
const spec = {
  type: 'pie',
  data: [
    {
      id: 'id0',
      values: [
        { type: 'oxygen', value: '46.60' },
        { type: 'silicon', value: '27.72' },
        { type: 'aluminum', value: '8.13' },
        { type: 'iron', value: '5' },
        { type: 'calcium', value: '3.63' },
        { type: 'sodium', value: '2.83' },
        { type: 'potassium', value: '2.59' },
        { type: 'others', value: '3.5' }
      ]
    }
  ],
  outerRadius: 0.8,
  innerRadius: 0.5,
  padAngle: 0.6,
  valueField: 'value',
  categoryField: 'type',
  pie: {
    style: {
      cornerRadius: 10
    },
    state: {
      hover: {
        stroke: '#000',
        lineWidth: 1
      },
      selected: {
        stroke: '#000',
        lineWidth: 1
      },
      active: {
        outerRadius: 0.9
      }
    }
  },
  title: {
    visible: true,
    text: 'Statistics of Surface Element Content'
  },
  legends: {
    visible: true,
    orient: 'left'
  },
  label: {
    visible: true,
    syncState: true,
    state: {
      active: {
        fontWeight: 'bold'
      }
    }
  },
  tooltip: {
    mark: {
      content: [
        {
          key: datum => datum['type'],
          value: datum => datum['value'] + '%'
        }
      ]
    }
  },
  interactions: [
    {
      type: 'element-active-by-legend'
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[饼图](link)
