---
category: examples
group: gauge
title: 使用circularProgress系列声明仪表图
keywords: gauge,comparison,circle
order: 15-3
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/57a706137957fce7388f3ab0b.png
option: gaugeChart
---

# 使用 circularProgress 系列声明仪表图

## 关键配置

- `categoryField`、`valueField` 属性分别用于指定数据类别与指针角度字段
- `innerRadius`、`outerRadius` 属性用于指定仪表盘的内外半径
- `startAngle`、`endAngle` 属性用于指定仪表盘的开始、结束角度
- `gauge`属性可以配置[仪表图的背景板系列](../../option/gaugeChart#gauge)

## 代码演示

```javascript livedemo
const spec = {
  type: 'gauge',
  data: [
    {
      id: 'id0',
      values: [
        {
          type: '目标A',
          value: 0.7
        }
      ]
    }
  ],
  radiusField: 'type',
  categoryField: 'type',
  valueField: 'value',
  outerRadius: 0.8,
  innerRadius: 0.75,
  startAngle: -240,
  endAngle: 60,
  gauge: {
    type: 'circularProgress',
    cornerRadius: 20,
    progress: {
      style: {
        fill: '#1664ff'
      }
    },
    track: {
      style: {
        fill: '#000'
      }
    }
  },
  pointer: {
    style: {
      fill: '#333'
    }
  },
  indicator: [
    {
      visible: true,
      offsetY: '75%',
      title: {
        style: {
          text: '70%',
          fontSize: 60,
          fontWeight: 800
        }
      }
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
