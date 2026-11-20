---
category: demo
group: axis
title: 坐标轴组件标签布局组合使用
keywords: barChart,animation,axis,trend,comparison,rectangle
order: 25-14
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/axis/axis-label-autoHide-and-autoRotate.png
option: barChart#axes
---

# 坐标轴组件标签布局组合使用

## 关键配置

在 `axes` 属性上为对应方向的轴配置：

- `sampling` 属性配置为 `false` 关闭轴采样
- `label.autoRotate` 属性配置为 `true` 来开启轴组件的标签自动旋转。
- `label.autoHide` 属性配置为 `true` 来开启轴组件的标签自动隐藏。

## 代码演示

```javascript livedemo
const spec = {
  type: 'bar',

  xField: 'x',
  yField: 'y',
  axes: [
    {
      orient: 'bottom',
      sampling: false,
      label: {
        autoRotate: true,
        autoHide: true
      }
    }
  ],
  data: [
    {
      id: 'event_analysis_stack',
      values: [
        { x: '0', y: 28, c: 0 },
        { x: 0.5, y: 20, c: 1 },
        { x: 1, y: 43, c: 0 },
        { x: 1.5, y: 35, c: 1 },
        { x: 2, y: 81, c: 0 },
        { x: 2.5, y: 10, c: 1 },
        { x: 3, y: 19, c: 0 },
        { x: 3.5, y: 15, c: 1 },
        { x: 4, y: 52, c: 0 },
        { x: 4.5, y: 48, c: 1 },
        { x: 5, y: 24, c: 0 },
        { x: 5.5, y: 28, c: 1 },
        { x: 6, y: 87, c: 0 },
        { x: 6.5, y: 66, c: 1 },
        { x: 7, y: 17, c: 0 },
        { x: 7.5, y: 27, c: 1 },
        { x: 8, y: 68, c: 0 },
        { x: 8.5, y: 16, c: 1 },
        { x: 9, y: 49, c: 0 },
        { x: 9.5, y: 25, c: 1 },
        { x: 10, y: 28, c: 0 },
        { x: 10.5, y: 20, c: 1 },
        { x: 11, y: 43, c: 0 },
        { x: 11.5, y: 35, c: 1 },
        { x: 12, y: 81, c: 0 },
        { x: 12.5, y: 10, c: 1 },
        { x: 13, y: 19, c: 0 },
        { x: 13.5, y: 15, c: 1 },
        { x: 14, y: 52, c: 0 },
        { x: 14.5, y: 48, c: 1 },
        { x: 15, y: 24, c: 0 },
        { x: 15.5, y: 28, c: 1 },
        { x: 16, y: 87, c: 0 },
        { x: 16.5, y: 66, c: 1 },
        { x: 17, y: 17, c: 0 },
        { x: 17.5, y: 27, c: 1 },
        { x: 18, y: 68, c: 0 },
        { x: 18.5, y: 16, c: 1 },
        { x: 19, y: 49, c: 0 },
        { x: 19.5, y: 25, c: 1 },
        { x: 20, y: 28, c: 0 },
        { x: 20.5, y: 20, c: 1 },
        { x: 21, y: 43, c: 0 },
        { x: 21.5, y: 35, c: 1 },
        { x: 22, y: 81, c: 0 },
        { x: 22.5, y: 10, c: 1 },
        { x: 23, y: 19, c: 0 },
        { x: 23.5, y: 15, c: 1 },
        { x: 24, y: 52, c: 0 },
        { x: 24.5, y: 48, c: 1 },
        { x: 25, y: 24, c: 0 },
        { x: 25.5, y: 28, c: 1 },
        { x: 26, y: 87, c: 0 },
        { x: 26.5, y: 66, c: 1 },
        { x: 27, y: 17, c: 0 },
        { x: 27.5, y: 27, c: 1 },
        { x: 28, y: 68, c: 0 },
        { x: 28.5, y: 16, c: 1 },
        { x: 29, y: 49, c: 0 },
        { x: 29.5, y: 25, c: 1 },
        { x: 30, y: 28, c: 0 },
        { x: 30.5, y: 20, c: 1 },
        { x: 31, y: 43, c: 0 },
        { x: 31.5, y: 35, c: 1 },
        { x: 32, y: 81, c: 0 },
        { x: 32.5, y: 10, c: 1 },
        { x: 33, y: 19, c: 0 },
        { x: 33.5, y: 15, c: 1 },
        { x: 34, y: 52, c: 0 },
        { x: 34.5, y: 48, c: 1 },
        { x: 35, y: 24, c: 0 },
        { x: 35.5, y: 28, c: 1 },
        { x: 36, y: 87, c: 0 },
        { x: 36.5, y: 66, c: 1 },
        { x: 37, y: 17, c: 0 },
        { x: 37.5, y: 27, c: 1 },
        { x: 38, y: 68, c: 0 },
        { x: 38.5, y: 16, c: 1 },
        { x: 39, y: 49, c: 0 },
        { x: 39.5, y: 25, c: 1 }
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
