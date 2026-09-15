---
category: examples
group: bar chart
title: 分组条形图
keywords: barChart,comparison,distribution,rank,rectangle
order: 2-9
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/bar-chart/group-bar.png
option: barChart
---

# 分组条形图

分组条形图用于展示多个分类的数据，通过条形的高度来对比不同分类的数据。

## 关键配置

- `direction` 属性配置为 'horizontal'
- `xField` 属性声明为数值字段
- `yField` 属性声明为分类字段，声明为数组类型，数组第二个值为分组字段
- `seriesField` 属性声明为颜色映射字段
- 通过为 `orient: left` 的坐标轴配置 `paddingInner` 属性为 0，调整组间间距

## 代码演示

```javascript livedemo
const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        {
          x: '2:00',
          y: 82,
          type: 'sales'
        },
        {
          x: '4:00',
          y: 50,
          type: 'sales'
        },
        {
          x: '6:00',
          y: 64,
          type: 'sales'
        },
        {
          x: '8:00',
          y: 30,
          type: 'sales'
        },
        {
          x: '10:00',
          y: 40,
          type: 'sales'
        },
        {
          x: '12:00',
          y: 40,
          type: 'sales'
        },
        {
          x: '14:00',
          y: 56,
          type: 'sales'
        },
        {
          x: '16:00',
          y: 40,
          type: 'sales'
        },
        {
          x: '18:00',
          y: 64,
          type: 'sales'
        },
        {
          x: '20:00',
          y: 74,
          type: 'sales'
        },
        {
          x: '22:00',
          y: 98,
          type: 'sales'
        },
        {
          x: '2:00',
          y: 62,
          type: 'profit'
        },
        {
          x: '4:00',
          y: 30,
          type: 'profit'
        },
        {
          x: '6:00',
          y: 32,
          type: 'profit'
        },
        {
          x: '8:00',
          y: 10,
          type: 'profit'
        },
        {
          x: '10:00',
          y: 20,
          type: 'profit'
        },
        {
          x: '12:00',
          y: 20,
          type: 'profit'
        },
        {
          x: '14:00',
          y: 36,
          type: 'profit'
        },
        {
          x: '16:00',
          y: 20,
          type: 'profit'
        },
        {
          x: '18:00',
          y: 44,
          type: 'profit'
        },
        {
          x: '20:00',
          y: 74,
          type: 'profit'
        },
        {
          x: '22:00',
          y: 78,
          type: 'profit'
        }
      ]
    }
  ],
  direction: 'horizontal',
  xField: 'y',
  yField: ['x', 'type'],
  seriesField: 'type',
  legends: {
    visible: true,
    orient: 'bottom'
  },
  axes: [
    {
      orient: 'left',
      paddingInner: 0
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[柱状图](link)
