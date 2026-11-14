---
category: examples
group: tooltip
title: 在 line 图元上实现 group tooltip
keywords: tooltip
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/radar-chart/stack-radar.png
option: barChart#tooltip
---

# 在 line 图元上实现 group tooltip

可以通过配置 group tooltip 的 `triggerMark` 属性，在 line 图元上弹出带有同组所有数据的 tooltip。

## 代码演示

```javascript livedemo
const spec = {
  type: 'radar',
  data: [
    {
      values: [
        {
          month: 'Jan.',
          value: 45,
          type: 'A'
        },
        {
          month: 'Feb.',
          value: 61,
          type: 'A'
        },
        {
          month: 'Mar.',
          value: 92,
          type: 'A'
        },
        {
          month: 'Apr.',
          value: 57,
          type: 'A'
        },
        {
          month: 'May.',
          value: 46,
          type: 'A'
        },
        {
          month: 'Jun.',
          value: 36,
          type: 'A'
        },
        {
          month: 'Jul.',
          value: 33,
          type: 'A'
        },
        {
          month: 'Aug.',
          value: 63,
          type: 'A'
        },
        {
          month: 'Sep.',
          value: 57,
          type: 'A'
        },
        {
          month: 'Oct.',
          value: 53,
          type: 'A'
        },
        {
          month: 'Nov.',
          value: 69,
          type: 'A'
        },
        {
          month: 'Dec.',
          value: 40,
          type: 'A'
        },
        {
          month: 'Jan.',
          value: 31,
          type: 'B'
        },
        {
          month: 'Feb.',
          value: 39,
          type: 'B'
        },
        {
          month: 'Mar.',
          value: 81,
          type: 'B'
        },
        {
          month: 'Apr.',
          value: 39,
          type: 'B'
        },
        {
          month: 'May.',
          value: 64,
          type: 'B'
        },
        {
          month: 'Jun.',
          value: 21,
          type: 'B'
        },
        {
          month: 'Jul.',
          value: 58,
          type: 'B'
        },
        {
          month: 'Aug.',
          value: 72,
          type: 'B'
        },
        {
          month: 'Sep.',
          value: 47,
          type: 'B'
        },
        {
          month: 'Oct.',
          value: 37,
          type: 'B'
        },
        {
          month: 'Nov.',
          value: 80,
          type: 'B'
        },
        {
          month: 'Dec.',
          value: 74,
          type: 'B'
        },
        {
          month: 'Jan.',
          value: 90,
          type: 'C'
        },
        {
          month: 'Feb.',
          value: 95,
          type: 'C'
        },
        {
          month: 'Mar.',
          value: 62,
          type: 'C'
        },
        {
          month: 'Apr.',
          value: 52,
          type: 'C'
        },
        {
          month: 'May.',
          value: 74,
          type: 'C'
        },
        {
          month: 'Jun.',
          value: 87,
          type: 'C'
        },
        {
          month: 'Jul.',
          value: 80,
          type: 'C'
        },
        {
          month: 'Aug.',
          value: 69,
          type: 'C'
        },
        {
          month: 'Sep.',
          value: 74,
          type: 'C'
        },
        {
          month: 'Oct.',
          value: 84,
          type: 'C'
        },
        {
          month: 'Nov.',
          value: 94,
          type: 'C'
        },
        {
          month: 'Dec.',
          value: 23,
          type: 'C'
        }
      ]
    }
  ],
  categoryField: 'month',
  valueField: 'value',
  seriesField: 'type',
  stack: true,
  area: {
    visible: true
  },
  axes: [
    {
      orient: 'radius',
      min: 0,
      domainLine: {
        visible: true
      },
      label: {
        visible: true
      },
      grid: {
        smooth: true
      }
    },
    {
      orient: 'angle',
      tick: {
        visible: false
      },
      grid: {
        style: {
          lineDash: [0]
        }
      }
    }
  ],
  legends: {
    visible: true,
    orient: 'top'
  },
  tooltip: {
    group: {
      triggerMark: 'line'
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[tooltip](link)
