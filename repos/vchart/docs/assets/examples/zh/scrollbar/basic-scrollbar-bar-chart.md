---
category: examples
group: scrollBar
title: scrollBar 基础用法
keywords: scrollBar
order: 30-0
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/scrollbar/basic-scrollbar-bar-chart.png
option: barChart#scrollbar
---

# scrollBar 基础用法

`scrollBar` 最基础的用法，用于控制柱图中柱子的个数，在这个例子中，我们创建了一个简单的柱形图用来展示一周的销售数据，其中分类变量为 `year`，数值变量为 `sales`， `scrollBar`和分类变量 `year` 自动绑定，用于控制数据展示的范围。

## 关键配置

- `orient` 属性声明为字符串类型，用于设置 `scollBar` 的方位，可选值有: `bottom`, `right`
- `start` 属性声明为数值字段，取值范围为 `[0, 1]`
- `end` 属性声明为数值字段，取值范围为 `[0, 1]`，注意属性 `start` 的值要小于 `end` 的值
- `roam` 属性声明为 `Boolean`类型，用于设置是否开启缩放平移功能

## 代码演示

```javascript livedemo
const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        { year: '2000', sales: 22 },
        { year: '2001', sales: 13 },
        { year: '2002', sales: 25 },
        { year: '2003', sales: 29 },
        { year: '2004', sales: 38 },
        { year: '2005', sales: 49 },
        { year: '2006', sales: 58 },
        { year: '2007', sales: 29 },
        { year: '2008', sales: 78 },
        { year: '2009', sales: 19 },
        { year: '2010', sales: 23 },
        { year: '2011', sales: 20 },
        { year: '2012', sales: 98 },
        { year: '2013', sales: 49 },
        { year: '2014', sales: 28 }
      ]
    }
  ],
  xField: 'year',
  yField: 'sales',
  scrollBar: [
    {
      orient: 'bottom',
      start: 0,
      end: 0.5,
      roam: true
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[scrollBar](link)
