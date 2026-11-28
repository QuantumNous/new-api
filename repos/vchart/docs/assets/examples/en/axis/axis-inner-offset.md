---
category: demo
group: axis
title: Axis InnerOffset
keywords: lineChar,axis,offset,innerOffset
cover: /vchart/preview/axis-inner-offset_1.12.9.png
option: barChart#axes
---

# Axis InnerOffset

For the coordinate axis in the rectangular coordinate system, if in the scene of line graph and scatter graph, sometimes you want the data points not to be truncated by the edge or overlap with the axis, you can use this configuration.

## Key configuration

Configure the expected blank pixel value on the [`axes.innerOffset`](/vchart/option/barChart#axes-linear.innerOffset) property.

## Demo source

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
