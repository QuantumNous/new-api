---
category: examples
group: pie
title: 饼图指标卡自适应策略
keywords: pieChart,comparison,composition,proportion,circle,indicator
order: 6-3
cover: /vchart/preview/pie-indicator-fitstrategy_1.9.0.png
option: pieChart
---

# 饼图指标卡自适应策略

饼图可通过配置 `indicator` 组件来设置指标卡，并通过 `autoFit` 以及 `fitStrategy` 配置项来设置指标卡文字大小自适应。

## 关键配置

- `indicator` 属性用于配置饼图指标卡
- `autoFit` 属性用于配置饼图指标卡文本是否开启自适应
- `fitStrategy` 属性用于配置饼图指标卡的自适应策略

## 代码演示

```javascript livedemo
const data = [
  { type: 'oxygen', value: '46.60', formula: 'O', texture: 'circle' },
  { type: 'silicon', value: '27.72', formula: 'Si', texture: 'horizontal-line' },
  { type: 'aluminum', value: '8.13', formula: 'Al', texture: 'vertical-line' },
  { type: 'iron', value: '5', formula: 'Fe', texture: 'rect' },
  { type: 'calcium', value: '3.63', formula: 'Ca', texture: 'grid' },
  { type: 'sodium', value: '2.83', formula: 'Na', texture: 'bias-rl' },
  { type: 'potassium', value: '2.59', formula: 'K', texture: 'diamond' },
  { type: 'others', value: '3.5', formula: 'Others', texture: 'bias-lr' }
];
const spec = {
  type: 'pie',
  data: [
    {
      id: 'id0',
      values: data
    }
  ],
  outerRadius: 0.8,
  innerRadius: 0.5,
  padAngle: 0.6,
  valueField: 'value',
  categoryField: 'type',
  pie: {
    style: {
      cornerRadius: 10,
      texture: datum => datum['texture']
    },
    state: {
      hover: {
        outerRadius: 0.85,
        stroke: '#000',
        lineWidth: 1
      },
      selected: {
        outerRadius: 0.85,
        stroke: '#000',
        lineWidth: 1
      }
    }
  },
  title: {
    visible: true,
    text: 'Statistics of Surface Element Content'
  },
  indicator: {
    visible: true,
    trigger: 'hover',
    limitRatio: 0.5, // same as inner radius
    title: {
      visible: true,
      autoFit: true,
      fitStrategy: 'inscribed',
      style: {
        fontWeight: 'bolder',
        fontFamily: 'Times New Roman',
        fill: '#888',
        text: datum => {
          const d = datum ?? data[0];
          return d['formula'];
        }
      }
    },
    content: [
      {
        visible: true,
        autoFit: true,
        fitStrategy: 'inscribed',
        style: {
          fill: 'orange',
          fontWeight: 'bolder',
          fontFamily: 'Times New Roman',
          text: datum => {
            const d = datum ?? data[0];
            return d['type'];
          }
        }
      },
      {
        visible: true,
        autoFit: true,
        fitStrategy: 'inscribed',
        style: {
          fill: 'orange',
          fontFamily: 'Times New Roman',
          text: datum => {
            const d = datum ?? data[0];
            return d['value'] + '%';
          }
        }
      }
    ]
  },
  legends: {
    visible: true,
    orient: 'left',
    item: {
      shape: {
        style: {
          symbolType: 'circle',
          texture: datum => datum['texture']
        }
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
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[饼图](link)
