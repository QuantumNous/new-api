---
category: demo
group: axis
title: 坐标轴文本自动旋转
keywords: barChart,animation,axis,trend,comparison,rectangle
order: 25-12
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/axis/axis-label-autoRotate.png
option: barChart#axes
---

# 坐标轴文本自动旋转

直角坐标系的坐标轴标签提供了自动旋转的防重叠能力，可以通过 `autoRotate` 属性来开启，同时通过 `autoRotateAngle` 属性配置可选的旋转范围，默认为 [0, 45, 90]。

## 关键配置

在 `axes` 属性上为对应方向的轴配置：

- `label.autoRotate` 属性配置为 `true` 来开启轴组件的标签自动旋转
- 配置 `label.autoRotateAngle` 来调整可选的旋转范围

## 代码演示

```javascript livedemo
const spec = {
  type: 'bar',
  width: 350,
  xField: 'month',
  yField: 'sales',
  axes: [
    {
      orient: 'bottom',
      sampling: false,
      label: {
        autoRotate: true,
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
