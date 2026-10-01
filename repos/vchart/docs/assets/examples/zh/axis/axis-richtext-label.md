---
category: demo
group: axis
title: 轴富文本标签
keywords: barChar,axis,trend,comparison,rectangle,richtext
cover: /vchart/preview/axis-richtext-label-1.10.0.png
option: barChart#axes
---

# 轴富文本标签

我们为轴标签提供了富文本能力，支持更丰富的可视化表达。

## 关键配置

在 `axes.label.formatMethod` 属性上配置文本格式化表达式

- `formatMethod`: 标签格式化函数，其返回值中：
  - `type`字段为 'rich'，表示使用富文本标签；
  - `text`字段为[富文本文字配置](/vchart/option/barChart#title.textStyle.character)。

## 代码演示

```javascript livedemo
const rankIcon = {
  'Top 1': 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/gold-medal.svg',
  'Top 2': 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/silver-medal.svg',
  'Top 3': 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/bronze-medal.svg'
};
const spec = {
  type: 'bar',
  height: 300,
  data: [
    {
      id: 'barData',
      values: [
        { name: 'Top 1', value: 990 },
        { name: 'Top 2', value: 680 },
        { name: 'Top 3', value: 255 }
      ]
    }
  ],
  barWidth: 20,
  yField: 'name',
  xField: 'value',
  bar: {
    style: {
      cornerRadius: [0, 10, 10, 0],
      fill: {
        gradient: 'linear',
        x0: 0,
        y0: 0.5,
        x1: 1,
        y1: 0.5,
        stops: [
          { offset: 0, color: 'rgb(255,163,1)' },
          { offset: 1, color: 'rgb(255,4,0)' }
        ]
      }
    }
  },
  barBackground: {
    visible: true
  },
  label: {
    visible: true,
    position: 'center',
    style: {
      fill: 'white',
      stroke: false
    }
  },
  direction: 'horizontal',
  seriesField: 'type',
  padding: { left: 50 },
  axes: [
    {
      orient: 'left',
      minWidth: 50,
      label: {
        formatMethod: label => {
          return {
            type: 'rich',
            text: [
              { image: rankIcon[label], width: 40, height: 40 },
              {
                text: `${label}`,
                fontSize: 16,
                fontWeight: 'bold',
                fontStyle: 'italic'
              }
            ]
          };
        }
      }
    }
  ]
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

附上和该 demo 配置相关联的教程或者 api 文档的链接。
