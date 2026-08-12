---
category: examples
group: rose
title: 基础玫瑰图
keywords: roseChart,comparison,composition,circle
order: 7-0
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/rose-chart/basic-rose.png
option: roseChart
---

# 基础玫瑰图

玫瑰图是在极坐标系下绘制的统计图表，数据中的每个类别被分成相等的部分，每个部分从中心向外延伸的距离取决于它所代表的值。玫瑰图适合展示循环数据（月份、季节等），曾被英国统计学家弗洛伦斯·南丁格尔用来展示克里米亚战争期间士兵的死亡人数。

## 何时使用

1. 展示循环数据（季节、月份等）。
2. 比较不同分类的大小，且各分类值差异不是太大。

## 关键配置

- `categoryField`、`valueField` 属性分别用于指定玫瑰图类别与半径字段
- `seriesField`字段用于指定不同系列
- `innerRadius`、`outerRadius`属性用于指定扇区的内外半径

## 代码演示

```javascript livedemo
const spec = {
  type: 'rose',
  data: [
    {
      values: [
        {
          value: '159',
          type: 'Tradition Industries'
        },
        {
          value: '50',
          type: 'Business Companies'
        },
        {
          value: '13',
          type: 'Customer-facing Companies'
        }
      ]
    }
  ],
  outerRadius: 0.8,
  innerRadius: 0.2,
  categoryField: 'type',
  valueField: 'value',
  seriesField: 'type',
  label: {
    visible: true,
    layout: {
      tangentConstraint: false
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[玫瑰图](link)
