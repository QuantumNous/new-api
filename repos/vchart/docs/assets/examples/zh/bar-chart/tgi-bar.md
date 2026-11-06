---
category: examples
group: bar chart
title: TGI 柱图
keywords: barChart,comparison,distribution,rank,rectangle
cover: /vchart/preview/tgi-bar_1.10.5.png
option: barChart
---

# TGI 柱图

在柱图和线图的基础上实现的 tgi 柱图。

## 代码演示

```javascript livedemo
const pointHeight = 5;
const spec = {
  type: 'common',
  data: [
    {
      id: 'dataBar',
      values: [
        { type: 'Nail polish', country: 'Africa', value: 4229 },
        { type: 'Nail polish', country: 'EU', value: 4376 },
        { type: 'Nail polish', country: 'China', value: 3054 },
        { type: 'Nail polish', country: 'USA', value: 12814 },
        { type: 'Eyebrow pencil', country: 'Africa', value: 3932 },
        { type: 'Eyebrow pencil', country: 'EU', value: 3987 },
        { type: 'Eyebrow pencil', country: 'China', value: 5067 },
        { type: 'Eyebrow pencil', country: 'USA', value: 13012 },
        { type: 'Rouge', country: 'Africa', value: 5221 },
        { type: 'Rouge', country: 'EU', value: 3574 },
        { type: 'Rouge', country: 'China', value: 7004 },
        { type: 'Rouge', country: 'USA', value: 11624 },
        { type: 'Lipstick', country: 'Africa', value: 9256 },
        { type: 'Lipstick', country: 'EU', value: 4376 },
        { type: 'Lipstick', country: 'China', value: 9054 },
        { type: 'Lipstick', country: 'USA', value: 8814 },
        { type: 'Eyeshadows', country: 'Africa', value: 3308 },
        { type: 'Eyeshadows', country: 'EU', value: 4572 },
        { type: 'Eyeshadows', country: 'China', value: 12043 },
        { type: 'Eyeshadows', country: 'USA', value: 12998 }
      ]
    },
    {
      id: 'dataLine',
      values: [
        { type: 'Nail polish', country: 'Africa', value: 13229 },
        { type: 'Nail polish', country: 'EU', value: 16376 },
        { type: 'Nail polish', country: 'China', value: 14054 },
        { type: 'Nail polish', country: 'USA', value: 15814 },
        { type: 'Eyebrow pencil', country: 'Africa', value: 17932 },
        { type: 'Eyebrow pencil', country: 'EU', value: 18987 },
        { type: 'Eyebrow pencil', country: 'China', value: 15067 },
        { type: 'Eyebrow pencil', country: 'USA', value: 16012 },
        { type: 'Rouge', country: 'Africa', value: 15221 },
        { type: 'Rouge', country: 'EU', value: 16574 },
        { type: 'Rouge', country: 'China', value: 13004 },
        { type: 'Rouge', country: 'USA', value: 15624 },
        { type: 'Lipstick', country: 'Africa', value: 14256 },
        { type: 'Lipstick', country: 'EU', value: 15376 },
        { type: 'Lipstick', country: 'China', value: 13054 },
        { type: 'Lipstick', country: 'USA', value: 16814 },
        { type: 'Eyeshadows', country: 'Africa', value: 16308 },
        { type: 'Eyeshadows', country: 'EU', value: 15572 },
        { type: 'Eyeshadows', country: 'China', value: 16043 },
        { type: 'Eyeshadows', country: 'USA', value: 18998 }
      ]
    }
  ],
  series: [
    {
      type: 'bar',
      dataId: 'dataBar',
      xField: ['type', 'country'],
      yField: 'value',
      seriesField: 'country'
    },
    {
      type: 'line',
      dataId: 'dataLine',
      xField: ['type', 'country'],
      yField: 'value',
      seriesField: 'country',
      point: {
        visible: false
      },
      line: {
        style: {
          lineDash: [3, 3]
        }
      },
      tooltip: {
        visible: false
      }
    },
    {
      type: 'bar',
      stack: false,
      dataId: 'dataLine',
      xField: ['type', 'country'],
      yField: 'value',
      seriesField: 'country',
      bar: {
        style: {
          y: (datum, ctx) => {
            const y = ctx.valueToY(datum['value']);
            return y - pointHeight / 2;
          },
          y1: (datum, ctx) => {
            const y = ctx.valueToY(datum['value']);
            return y + pointHeight / 2;
          }
        }
      },
      animationAppear: false
    }
  ],
  legends: [{ visible: true, position: 'middle', orient: 'bottom' }],
  axes: [
    {
      orient: 'left',
      type: 'linear'
    },
    {
      orient: 'bottom',
      type: 'band'
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
