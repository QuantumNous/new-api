---
category: examples
group: gauge
title: 使用gauge系列声明仪表图
keywords: gauge,comparison,circle
order: 15-4
cover: /vchart/preview/gauge-segment_1.4.2.png
option: gaugeChart
---

# 使用 gauge 系列声明仪表图

## 关键配置

- `categoryField`、`valueField` 属性分别用于指定数据类别与指针角度字段
- `innerRadius`、`outerRadius` 属性用于指定仪表盘的内外半径
- `startAngle`、`endAngle` 属性用于指定仪表盘的开始、结束角度
- `gauge`属性可以配置[仪表图的背景板系列](../../option/gaugeChart#gauge)
- `centerY` 设置中心点的 y 坐标
- `layoutRadius` 设置布局半径

## 代码演示

```javascript livedemo
const spec = {
  type: 'gauge',
  data: [
    {
      id: 'pointer',
      values: [
        {
          type: 'A',
          value: 0.6
        }
      ]
    },
    {
      id: 'segment',
      values: [
        {
          type: 'Level 1',
          color: '#07A35A',
          value: 0.4
        },
        {
          type: 'Level 2',
          color: '#FFC528',
          value: 0.6
        },
        {
          type: 'Level 3',
          color: '#E33232',
          value: 0.8
        }
      ]
    }
  ],
  gauge: {
    type: 'gauge',
    dataIndex: 1,
    categoryField: 'type',
    valueField: 'value',
    seriesField: 'type',
    segment: {
      style: {
        cornerRadius: 10,
        fill: datum => datum['color']
      }
    },
    label: {
      visible: true,
      position: 'inside-outer',
      offsetRadius: 10,
      style: {
        text: datum => datum['type']
      }
    }
  },
  pointer: {
    style: {
      fill: '#666666'
    }
  },
  categoryField: 'type',
  valueField: 'value',
  outerRadius: 0.9,
  innerRadius: 0.6,
  startAngle: -180,
  endAngle: 0,
  centerY: '100%',
  layoutRadius: 'auto',
  axes: [
    {
      type: 'linear',
      orient: 'angle',
      inside: true,
      grid: { visible: false }
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[仪表图](link)
