# 鼠标移入图表区域，hover 显示内容怎么更换？

## 问题描述

我把鼠标移动到一个柱状图里头之后，被 hover 的柱子会显示一个悬浮框展示柱子的数据信息。我想要把这个 hover 之后的显示内容换成其他的数据内容，请问应该怎么实现呢？

![bar](/vchart/faq/79-0.png)

## 解决方案

图表中图元被 hover 之后显示的提示信息一般被称为 tooltip。在 VChart 中，开发者可以通过 tooltip 组件的配置自定义提示信息的标题以及每行显示的内容。Tooltip 的提示信息包含两种交互形式，一种是 hover 在图元上的交互，另一种是 hover 在数据维度上的交互，两者可以分别通过 tooltip.mark 与 tooltip.dimension 来配置。

![tooltip](/vchart/faq/79-1.png)

除了自定义 tooltip 的显示文本，VChart 也允许用户通过 tooltip handler 渲染任意内容，例如在 tooltip 中展示一个额外的图表：

![tooltip-example](/vchart/faq/79-2.png)

[参考示例](https://www.visactor.io/vchart/demo/tooltip/custom-tooltip-handler?keyword=tooltip)

## 代码示例

```javascript livedemo
const data = [
  { year: '2012', type: 'Forest', value: 320 },
  { year: '2012', type: 'Steppe', value: 220 },
  { year: '2012', type: 'Desert', value: 150 },
  { year: '2012', type: 'Wetland', value: 98 },
  { year: '2013', type: 'Forest', value: 332 },
  { year: '2013', type: 'Steppe', value: 182 },
  { year: '2013', type: 'Desert', value: 232 },
  { year: '2013', type: 'Wetland', value: 77 },
  { year: '2014', type: 'Forest', value: 301 },
  { year: '2014', type: 'Steppe', value: 191 },
  { year: '2014', type: 'Desert', value: 201 },
  { year: '2014', type: 'Wetland', value: 101 },
  { year: '2015', type: 'Forest', value: 334 },
  { year: '2015', type: 'Steppe', value: 234 },
  { year: '2015', type: 'Desert', value: 154 },
  { year: '2015', type: 'Wetland', value: 99 },
  { year: '2016', type: 'Forest', value: 390 },
  { year: '2016', type: 'Steppe', value: 290 },
  { year: '2016', type: 'Desert', value: 190 },
  { year: '2016', type: 'Wetland', value: 40 }
];
const aggregation = {};
data.forEach(({ year, value }) => {
  if (!aggregation[year]) {
    aggregation[year] = 0;
  }
  aggregation[year] += value;
});
const spec = {
  type: 'bar',
  data: [
    {
      id: 'bar',
      values: data
    }
  ],
  xField: ['year', 'type'],
  yField: 'value',
  seriesField: 'type',
  bar: {
    state: {
      legend_hover_reverse: {
        fill: '#ccc'
      }
    }
  },
  legends: {
    visible: true
  },
  tooltip: {
    mark: {
      title: {
        value: datum => datum['year'] + '年'
      },
      content: [
        {
          key: datum => datum['type'],
          value: datum => datum['value']
        },
        {
          hasShape: false,
          key: 'Proportion',
          value: datum => Math.round((datum['value'] / aggregation[datum['year']]) * 10000) / 100 + '%'
        }
      ]
    },
    dimension: {
      title: {
        value: datum => datum['year'] + '年'
      },
      content: [
        {
          key: datum => datum['type'],
          value: datum => datum['value']
        },
        {
          hasShape: false,
          key: datum => datum['type'] + ' Proportion',
          value: datum => Math.round((datum['value'] / aggregation[datum['year']]) * 10000) / 100 + '%'
        }
      ]
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关文档

- [github](https://github.com/VisActor/VChart)
- [Tooltip Tutorial](https://visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Tooltip)
- [Related api](https://visactor.io/vchart/option/barChart#tooltip.visible)
