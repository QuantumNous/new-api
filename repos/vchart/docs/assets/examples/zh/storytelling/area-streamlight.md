---
category: examples
group: storytelling
title: 面积图流光动画
keywords: animation,area,lineChart
order: 42-1
cover: /vchart/preview/area-streamlight_1.8.3.gif
option: areeaChart#animationNormal
---

# 面积图流光动画

在大屏中常见的流光动画特效。

## 关键配置

## 代码演示

```javascript livedemo
const spec = {
  type: 'area',
  data: {
    values: [
      {
        time: '2:00',
        value: 8
      },
      {
        time: '4:00',
        value: 9
      },
      {
        time: '6:00',
        value: 11
      },
      {
        time: '8:00',
        value: 14
      },
      {
        time: '10:00',
        value: 16
      },
      {
        time: '12:00',
        value: 17
      },
      {
        time: '14:00',
        value: 17
      },
      {
        time: '16:00',
        value: 16
      },
      {
        time: '18:00',
        value: 15
      }
    ]
  },
  xField: 'time',
  yField: 'value',
  animationNormal: {
    area: {
      loop: 100,
      duration: 1500,
      easing: 'quadIn',
      custom: VRender.StreamLight,
      customParameters: {
        streamLength: 30,
        attribute: { stroke: 'white', strokeOpacity: 0.8, lineWidth: 2 }
      }
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });

vchart.renderSync();
```

## 相关教程

[散点图](link)
