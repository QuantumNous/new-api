---
category: examples
group: area chart
title: 区间面积图
keywords: areaChart,comparison,trend,area,rangeAreaChart
order: 1-5
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/area-chart/range-area.png
option: areaChart
---

# 区间面积图

区间面积图是面积图的变体，可以绘制数据范围，图表中的每个点由两个数值属性指定。
经常与折线图共同创建成组合图进行使用。
在这个例子中，展示不同类别的最大最小值所构成的区间面积。

## 关键配置

- `yField` 属性配置为最小值数值属性与最大值数值属性共同构成的数组

## 代码演示

```javascript livedemo
const spec = {
  type: 'common',
  data: [
    {
      id: 'areaData',
      values: [
        { type: 'Category One', min: 76, max: 100 },
        { type: 'Category Two', min: 56, max: 108 },
        { type: 'Category Three', min: 38, max: 129 },
        { type: 'Category Four', min: 58, max: 155 },
        { type: 'Category Five', min: 45, max: 120 },
        { type: 'Category Six', min: 23, max: 99 },
        { type: 'Category Seven', min: 18, max: 56 },
        { type: 'Category Eight', min: 18, max: 34 }
      ]
    },
    {
      id: 'lineData',
      values: [
        { type: 'Category One', average: 88 },
        { type: 'Category Two', average: 82 },
        { type: 'Category Three', average: 83.5 },
        { type: 'Category Four', average: 106.5 },
        { type: 'Category Five', average: 82.5 },
        { type: 'Category Six', average: 61 },
        { type: 'Category Seven', average: 37 },
        { type: 'Category Eight', average: 26 }
      ]
    }
  ],
  series: [
    {
      type: 'rangeArea',
      dataIndex: 0,
      xField: 'type',
      yField: ['min', 'max'],
      stack: false,
      area: {
        style: {
          fillOpacity: 0.15
        }
      }
    },
    {
      type: 'line',
      dataIndex: 1,
      xField: 'type',
      yField: 'average',
      point: {
        state: {
          hover: {
            fillOpacity: 0.5,
            stroke: 'blue',
            lineWidth: 2
          },
          selected: {
            fill: 'red'
          }
        }
      }
    }
  ],

  axes: [
    {
      orient: 'left',
      label: {
        visible: true
      },
      type: 'linear'
    },
    { orient: 'bottom', type: 'band' }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[面积图](link)
