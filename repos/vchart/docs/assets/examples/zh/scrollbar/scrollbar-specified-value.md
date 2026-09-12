---
category: examples
group: scrollBar
title: 纵向 scrollBar
keywords: scrollBar
order: 30-2
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/scrollbar/scrollbar-specified-value.png
option: barChart#scrollbar
---

# 纵向 scrollBar

纵向的 `scrollBar`，用于控制横向柱图中柱子的个数，在这个例子中，我们创建了一个简单的柱形图用来展示一周的销售数据，其中分类变量为 `year`，数值变量为 `sales`， `scrollBar`和分类变量 `year` 自动绑定，用于控制数据展示的范围。

## 关键配置

- `orient` 属性声明为字符串类型，用于设置 `scollBar` 的方位，可选值有: `bottom`, `right`
- `startValue` 属性申明 `scollBar`关联字段的起始值，用于控制数据的显示范围
- `endValue` 属性申明 `scollBar`关联字段的结束值，用于控制数据的显示范围
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
  direction: 'horizontal',
  yField: 'year',
  xField: 'sales',
  scrollBar: [
    {
      orient: 'right',
      startValue: '2011',
      endValue: '2014',
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
