---
category: demo
group: axis
title: 坐标轴文本自动隐藏
keywords: barChart,animation,axis,trend,comparison,rectangle
order: 25-11
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/axis/axis-label-autoHide.png
option: barChart#axes
---

# 坐标轴文本自动隐藏

坐标轴默认开启了轴采样算法来处理轴文本重叠的问题，但是轴组件也提供了对应的轴标签布局能力，对应的配置为：`autoHide`, `autoRotate` 和 `autoLimit` 分别表示自动隐藏、自动旋转和自动省略，轴采样算法和轴组件的轴标签布局可以共存，但是建议还是按照实际情况择其一进行配置。由于实现方式的不同，在大数据量还是推荐使用轴采样布局，它的性能相比于轴组件标签布局会更好一些。

本例子介绍下 `autoHide` 的使用。

## 关键配置

在 `axes` 属性上为对应方向的轴配置：

- `sampling` 属性配置为 `false` 来关闭轴采样
- `label.autoHide` 属性配置为 `true` 来开启轴组件的标签布局策略 autoHide
- 配置 `label.autoHideMethod` 来调整策略

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
        autoHide: true,
        autoHideMethod: 'greedy',
        autoHideSeparation: 10
      }
    }
  ],
  data: [
    {
      name: 'bar',
      fields: {
        y: {
          alias: 'sales'
        }
      },
      values: [
        {
          x: '2021-12-21 2:00',
          y: 82
        },
        {
          x: '2021-12-21 4:00',
          y: 50
        },
        {
          x: '2021-12-21 6:00',
          y: 64
        },
        {
          x: '2021-12-21 8:00',
          y: 30
        },
        {
          x: '2021-12-21 10:00',
          y: 40
        },
        {
          x: '2021-12-21 12:00',
          y: 40
        },
        {
          x: '2021-12-21 14:00',
          y: 56
        },
        {
          x: '2021-12-21 16:00',
          y: 40
        },
        {
          x: '2021-12-21 18:00',
          y: 64
        },
        {
          x: '2021-12-21 20:00',
          y: 74
        },
        {
          x: '2021-12-21 22:00',
          y: 98
        }
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
