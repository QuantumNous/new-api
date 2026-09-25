---
category: examples
group: storytelling
title: 环形图轮播动画
keywords: animation,ring,pie,pieChart,comparison
order: 42-0
cover: /vchart/preview/ring-carousel-animation_1.8.3.gif
option: pieChart#animationNormal
---

# 环形图轮播动画

## 关键配置

## 代码演示

```javascript livedemo
const spec = {
  type: 'pie',
  data: [
    {
      name: 'data1',
      values: [
        {
          value: 300,
          name: 'A',
          radius: 100
        },
        {
          value: 120,
          name: 'B',
          radius: 95
        },
        {
          value: 100,
          name: 'C',
          radius: 90
        },
        {
          value: 80,
          name: 'D',
          radius: 85
        }
      ]
    }
  ],
  valueField: 'value',
  categoryField: 'name',
  seriesField: 'name',
  radius: 0.8,
  innerRadius: 0.5,
  startAngle: -90,
  endAngle: 250,
  pie: {
    style: {
      outerRadius: datum => {
        return datum.radius;
      },
      innerRadius: datum => {
        return 60;
      },
      cornerRadius: 2
    }
  },

  animationNormal: {
    pie: [
      {
        startTime: 100,
        loop: 0,
        timeSlices: [
          {
            effects: {
              channel: {
                fillOpacity: { to: 0.3 }
              }
            },
            duration: 500
          }
        ]
      },
      {
        loop: true,
        startTime: 800,
        oneByOne: true,
        timeSlices: [
          {
            effects: {
              channel: {
                fillOpacity: { to: 1 },
                outerRadius: { to: datum => datum.radius + 10 }
              }
            },
            duration: 500
          },
          {
            effects: {
              channel: {
                fillOpacity: { to: 1 },
                outerRadius: { to: datum => datum.radius + 10 }
              },
              easing: 'linear'
            },
            duration: 500
          },
          {
            effects: {
              channel: {
                fillOpacity: { to: 0.3 },
                outerRadius: { to: datum => datum.radius }
              }
            },
            duration: 500
          }
        ]
      }
    ]
  },
  tooltip: {
    visible: false
  },
  indicator: {
    id: 'indicator',
    visible: true,
    fixed: true,
    content: [
      {
        visible: true,
        style: {
          fontSize: 20,
          text: 'Total: 600',
          fillOpacity: 0.8,
          fontWeight: 600
        }
      }
    ]
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });

vchart.renderSync();
```

## 相关教程

[散点图](link)
