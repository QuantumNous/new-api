# 图表滚动条如何配置默认滚动的位置？

## 问题描述

当我需要配置滚动条默认滚动的位置的时候我该怎么做？有时我希望滚动条的起点和终点是我所指定的，而并非一个默认范围。

## 解决方案

你需要配置表示范围的参数`scrollBar.start`和`scrollBar.end`，它们表示滚动条的起点和终点，取值为[0, 1]，表示的该位置所在的百分比布局范围。
除此之外，你还可以通过`scrollBar.startValue`和`scrollBar.endValue`来配置起点和终点，它们分别表示起点和终点的数据值。
[scrollbar position](/vchart/faq/13-0.png)

## 代码示例

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

window['vchart'] = vchart;
```

## 相关文档

- [滚动条 Demo](https://www.visactor.io/vchart/demo/scrollbar/basic-scrollbar-bar-chart)
- [滚动条教程](https://www.visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Scrollbar)
- [相关 api](https://www.visactor.io/vchart/option/commonChart#scrollbar)
- [github](https://github.com/VisActor/VChart)
