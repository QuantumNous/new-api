---
category: examples
group: bar chart
title: 渐变圆角柱图
keywords: barChart,comparison,distribution,rank,rectangle,gradient
order: 2-9
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/bar-chart/gradient-column.png
option: barChart
---

# 渐变圆角柱图

通过配置 bar 图元的样式，实现渐变色和圆角柱图。

## 关键配置

在 `bar.style` 属性中配置：

- `cornerRadius` 属性，设置圆角大小，当类型为数值时，表示四个角的圆角大小，当类型为数组时，表示左上、右上、右下、左下四个角的圆角大小。
- `fill` 属性中根据渐变色配置进行渐变色配置。

## 代码演示

```javascript livedemo
const spec = {
  type: 'bar',
  data: [
    {
      id: 'data',
      values: [
        {
          x: 'Mon',
          y: 100,
          type: 'sales'
        },
        {
          x: 'Tues',
          y: 66,
          type: 'sales'
        },
        {
          x: 'Wed',
          y: 95,
          type: 'sales'
        },
        {
          x: 'Thus',
          y: 52,
          type: 'sales'
        },
        {
          x: 'Fri',
          y: 68,
          type: 'sales'
        },
        {
          x: 'Sat',
          y: 52,
          type: 'sales'
        },
        {
          x: 'sun',
          y: 48,
          type: 'sales'
        },
        {
          x: 'Mon',
          y: 43,
          type: 'profit'
        },
        {
          x: 'Tues',
          y: 80,
          type: 'profit'
        },
        {
          x: 'Wed',
          y: 68,
          type: 'profit'
        },
        {
          x: 'Thus',
          y: 40,
          type: 'profit'
        },
        {
          x: 'Fri',
          y: 53,
          type: 'profit'
        },
        {
          x: 'Sat',
          y: 72,
          type: 'profit'
        },
        {
          x: 'sun',
          y: 71,
          type: 'profit'
        }
      ]
    }
  ],
  xField: ['x', 'type'],
  yField: 'y',
  seriesField: 'type',
  bar: {
    style: {
      cornerRadius: 10,
      fill: {
        gradient: 'linear',
        x0: 0.5,
        y0: 0,
        x1: 0.5,
        y1: 1,
        stops: [
          {
            offset: 0,
            color: '#86DF6C'
          },
          {
            offset: 1,
            color: '#468DFF'
          }
        ]
      }
    },
    state: {
      selected: {
        stroke: '#000',
        lineWidth: 1
      }
    }
  },
  axes: [
    {
      orient: 'bottom',
      domainLine: {
        visible: false
      },
      bandPadding: 0,
      paddingInner: 0.1
    },
    {
      orient: 'left',
      grid: {
        visible: false
      },
      tick: {
        visible: true,
        tickCount: 3
      },
      domainLine: {
        visible: false
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

[柱状图](link)
