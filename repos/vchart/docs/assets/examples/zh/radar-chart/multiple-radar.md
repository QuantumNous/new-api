---
category: examples
group: radar chart
title: 分组雷达图
keywords: radarChart,comparison,line,circle,axis
order: 10-1
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/radar-chart/multiple-radar.png
option: radarChart
---

# 分组雷达图

分组雷达图

## 关键配置

- `seriesField`：声明分组字段
- `axes`：配置雷达图的两个轴
  - 半径轴声明：`orient: 'radius'`
  - 角度轴声明：`orient: 'angle'`
- 半径轴网格线平滑配置：`grid.smooth: true`
- 网格线间的背景色配置：`grid.alternateColor: '#f5f5f5'`
- `legends`：配置图例
  - `visible: true`：展示图例
  - `orient: 'top'`：图例位置

## 代码演示

```javascript livedemo
const mockData = [];
const types = ['A', 'B', 'C'];

types.forEach(type => {
  for (let i = 1; i <= 12; i++) {
    mockData.push({ month: i + 'th', value: Math.random() * 100 + 10, type });
  }
});

const spec = {
  type: 'radar',
  data: [
    {
      values: mockData
    }
  ],
  categoryField: 'month',
  valueField: 'value',
  seriesField: 'type',
  axes: [
    {
      orient: 'radius',
      grid: {
        smooth: true, // smooth grid lines
        style: {
          lineDash: [0]
        },
        alternateColor: '#f5f5f5' // Configure the background color between grid lines
      }
    },
    {
      orient: 'angle',
      tick: {
        visible: false
      },
      domainLine: {
        visible: true,
        style: {
          stroke: '#333'
        }
      },
      grid: {
        style: {
          lineDash: [0]
        }
      }
    }
  ],
  legends: {
    visible: true,
    orient: 'top'
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[区间柱状图](link)
