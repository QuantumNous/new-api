# 在小程序中，柱图数据过多时，如何配置横向滚动条？

## 问题描述

在飞书小程序中使用 VChart 时，柱图数据过多时，如何配置横向滚动条？

## 解决方案

同 PC 端，配置 scrollBar 即可，通常而言，你还需要配置表示 scrollBar 位置的属性`scrollBar.orient`以及表示当前视窗范围的属性`scrollBar.start`和`scrollBar.end`。
[mini program scrollbar](/vchart/faq/12-0.png)

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

window['vchart'] = vchart;
```

## 相关文档

- [滚动条 Demo](https://www.visactor.io/vchart/demo/scrollbar/basic-scrollbar-bar-chart)
- [滚动条教程](https://www.visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Scrollbar)
- [相关 api](https://www.visactor.io/vchart/option/commonChart#scrollbar)
- [github](https://github.com/VisActor/VChart)
