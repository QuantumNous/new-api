---
category: demo
group: axis
title: 坐标轴文本自动省略
keywords: barChart,animation,axis,trend,comparison,rectangle
order: 25-13
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/axis/axis-label-autoLimit.png
option: barChart#axes
---

# 坐标轴文本自动省略

直角坐标系的坐标轴标签提供了超出限制长度自动省略的能力，可以通过 `autoLimit` 属性来开启，同时通过 `limitEllipsis` 属性配置省略的文本，默认为 '...'。

目前对于着直角坐标系，x 和 y 轴默认垂直方向的展示的限制空间为图表高度或者宽度的 30%，如果你开启了轴标签的 `autoLimit`，一旦轴空间超出限制就会自动省略。

## 关键配置

在 `axes` 属性上为对应方向的轴配置：

- `label.autoLimit` 属性配置为 `true` 来开启轴组件的标签自动省略。

## 代码演示

```javascript livedemo
const spec = {
  type: 'bar',
  width: 300,
  height: 200,
  xField: 'month',
  yField: 'sales',
  axes: [
    {
      orient: 'left',
      label: {
        autoLimit: true,
        formatMethod: val => `+++++++++_${val}_+++++++++`
      }
    },
    {
      orient: 'bottom',
      maxHeight: '20%', // Limit maximum height to 20% of chart height
      sampling: false,
      label: {
        autoRotate: true,
        autoLimit: true,
        autoRotateAngle: [0, 90]
      }
    }
  ],
  data: [
    {
      id: 'barData',
      values: [
        { month: 'Monday', sales: 22 },
        { month: 'Tuesday', sales: 13 },
        { month: 'Wednesday', sales: 25 },
        { month: 'Thursday', sales: 29 },
        { month: 'Friday', sales: 38 }
      ]
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
