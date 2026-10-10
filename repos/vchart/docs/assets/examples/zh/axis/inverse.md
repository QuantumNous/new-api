---
category: demo
group: axis
title: 坐标轴反转
keywords: areaChart,comparison,trend,area,axis
order: 25-5
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/axis/inverse.png
option: lineChart#axes
---

# 坐标轴反转

在该示例中我们通过 `axes` 上提供的配置项 `inverse` 属性对指定的坐标轴进行反转，同时为坐标轴线添加箭头。

## 关键配置

在 `axes` 属性上为指定方向的坐标轴配置：

- `inverse` 属性为 true 开启坐标轴反转
- `domainLine` 属性上配置 `startSymbol` 或 `endSymbol` 属性，用于轴线两端的标记

## 代码演示

```javascript livedemo
const spec = {
  type: 'area',
  data: [
    {
      id: 'line',
      values: [
        { x: 'Monday', y: 12 },
        { x: 'Tuesday', y: 13 },
        { x: 'Wednesday', y: 11 },
        { x: 'Thursday', y: 10 },
        { x: 'Friday', y: 12 },
        { x: 'Saturday', y: 14 },
        { x: 'Sunday', y: 17 }
      ]
    }
  ],
  xField: 'x',
  yField: 'y',
  axes: [
    {
      zIndex: 100,
      orient: 'bottom'
    },
    {
      zIndex: 101,
      orient: 'left',
      inverse: true, // inverse the left axis
      domainLine: {
        visible: true,
        // show the endSymbol
        endSymbol: {
          visible: true,
          style: {
            fill: '#000'
          }
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
