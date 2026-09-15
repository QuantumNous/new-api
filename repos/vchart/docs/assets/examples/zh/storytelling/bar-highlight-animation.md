---
category: examples
group: storytelling
title: 柱状图高亮动画
keywords: animation,bar,barChart,comparison
order: 42-6
cover: /vchart/preview/bar-highlight_1.8.3.gif
option: barChart#animationNormal
---

# 柱状图高亮动画

## 关键配置

## 代码演示

```javascript livedemo
const spec = {
  type: 'bar',
  data: [
    {
      id: 'id0',
      values: [
        { x: '1', y: 22 },
        { x: '2', y: 43 },
        { x: '3', y: 33 },
        { x: '4', y: 22 },
        { x: '5', y: 10 },
        { x: '6', y: 30 },
        { x: '7', y: 46 },
        { x: '8', y: 21 },
        { x: '9', y: 33 },
        { x: '10', y: 43 },
        { x: '11', y: 42 },
        { x: '12', y: 30 },
        { x: '13', y: 9 },
        { x: '14', y: 46 }
      ]
    }
  ],
  xField: ['x'],
  yField: 'y',
  axes: [
    { orient: 'bottom', type: 'band' },
    { orient: 'left', type: 'linear' }
  ],
  animationNormal: {
    bar: [
      {
        loop: true,
        startTime: 100,
        oneByOne: 100,
        timeSlices: [
          {
            delay: 1000,
            effects: {
              channel: {
                fillOpacity: { to: 0.5 }
              },
              easing: 'linear'
            },
            duration: 500
          },
          {
            effects: {
              channel: {
                fillOpacity: { to: 1 }
              },
              easing: 'linear'
            },
            duration: 500
          }
        ]
      }
    ]
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });

vchart.renderSync();
```

## 相关教程

[散点图](link)
