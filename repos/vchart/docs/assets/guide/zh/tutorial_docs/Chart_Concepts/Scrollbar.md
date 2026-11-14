# Scrollbar 滚动条

Scrollbar 滚动条是 VChart 图表提供的一个交互组件，它和普通的 dom 滚动条类似，当图表的内容区域大于显示区域时，可以通过配置滚动条，来辅助查看图表。本教程主要讲解 Scrollbar 组件的相关概念以及组成，关于 Scrollbar 组件更加详细的配置及示例，详见[配置项文档](../../../option)及[示例](../../../example)页面。

## 组成

Scrollbar 组件主要由两部分组成：滚动块 (`slider`)、轨道 (`rail`) 这两部分组成，我们可以通过指定滚动条的配置来调整滚动条的外观和行为。

<div style="text-align: center;">
  <img src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/0a2e223bdcd7410c08f6a6a18.png" alt="Scrollbar 组成图示">
</div>

## 示例

本节将介绍如何使用 VChart 中的 Scrollbar，以实现一个简单的柱状图，并演示如何通过配置 `scrollbar` 配置数据可见范围，将数据通过滚动查看。

滚动条配置是一个数组，包括了滚动条的方向(`orient`)，滚动条初始范围的起始值(`startValue`)和结束值(`endValue`)，以及是否开启鼠标缩放和平移漫游(roam)：

```ts
const spec = {
  ...
  scrollBar: [
    {
      orient: 'right',
      startValue: '2011',
      endValue: '2014',
      roam: true
    }
  ],
  ...
};
```

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
```
