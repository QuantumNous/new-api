---
category: demo
group: axis
title: 轴内侧留白
keywords: lineChar,axis,offset,innerOffset
cover: /vchart/preview/axis-inner-offset_1.12.9.png
option: barChart#axes
---

# 轴内侧留白

对于直角坐标系下的坐标轴，如果在线图，散点图的场景，有时会期望数据点不要被边缘截断，或者不要与轴重叠，可以使用这个 api。

## 关键配置

在 [`axes.innerOffset`](/vchart/option/barChart#axes-linear.innerOffset) 属性上配置期望的留白像素值。

## 代码演示

```javascript livedemo
const spec = {
  type: 'line',
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
        value: 20
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
  padding: 0,
  point: {
    style: {
      size: 20
    }
  },
  axes: [
    {
      orient: 'bottom',
      trimPadding: true,
      innerOffset: {
        left: 10,
        right: 10
      }
    },
    {
      orient: 'left',
      innerOffset: {
        top: 10
      }
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```
