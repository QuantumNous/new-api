---
category: examples
group: radar chart
title: 空心雷达图
keywords: radarChart,comparison,line,circle,axis,label,indicator
order: 10-2
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/radar-chart/radar-with-innerRadius.png
option: radarChart
---

# 空心雷达图

通过配置 `innerRadius` 属性，可以将雷达图变成空心的。

## 关键配置

- `innerRadius`：配置雷达图的内半径
- `outerRadius`：配置雷达图的外半径
- `grid.alignWithLabel`：配置网格是否与刻度对齐
- `label.visible`：配置标签是否可见

## 代码演示

```javascript livedemo
const mockData = [];
for (let i = 0; i < 24; i++) {
  mockData.push({
    key: `key${i}`,
    value: parseInt(Math.random() * 10, 10)
  });
}
const spec = {
  type: 'radar',
  data: [
    {
      values: mockData
    }
  ],
  categoryField: 'key',
  valueField: 'value',
  innerRadius: 0.4,
  outerRadius: 0.9,
  label: {
    visible: true
  },
  axes: [
    {
      orient: 'radius',
      zIndex: 100,
      grid: {
        style: (data, index) => {
          if (index === 0) {
            return {
              lineDash: [0]
            };
          }
          return {
            visible: false
          };
        }
      }
    },
    {
      orient: 'angle',
      tick: {
        visible: false
      },
      domainLine: {
        visible: true
      },
      grid: {
        alignWithLabel: false,
        style: {
          lineDash: [0]
        },
        alternateColor: 'rgba(0, 0, 0, 0.04)'
      }
    }
  ],
  indicator: {
    visible: true,
    trigger: 'hover',
    limitRatio: 0.4,
    title: {
      visible: true,
      autoFit: true,
      style: {
        fontWeight: 'bolder',
        fontFamily: 'Times New Roman',
        fill: '#888',
        text: 'Radar'
      }
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[区间柱状图](link)
