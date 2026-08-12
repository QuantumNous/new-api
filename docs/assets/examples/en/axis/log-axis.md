---
category: demo
group: axis
title: log轴
keywords: lineChart,comparison,composition,trend,axis
order: 25-6
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/ffc3a9b5518762d274121ff06.jpeg
option: lineChart#axes
---

# log axis

In charting, the log axis is a coordinate axis used to display data. Unlike the regular linear axis, the log axis uses a logarithmic scale instead of a linear scale. This way you can better display the data when displaying a large data range within a certain range.

The characteristic of the log axis is that the interval between scales is calculated according to the logarithmic function (usually base 10). This means that each logarithmic unit (size unit) of the data has the same physical length, e.g. from 1 to 10, 10 to 100, 100 to 1000, etc. For exponential growth or exponential decline of data, the log axis can better show the relative change of data.

## Key option

exist `axes` Configure the axis type on the property:

- `type` Properties are set to`'log'`, used to configure the axis type

## Demo source

```javascript livedemo
const spec = {
  type: 'common',
  title: {
    text: 'the example shows difference of linear axis and log axis',
    id: 'title'
  },
  layout: {
    type: 'grid',
    col: 2,
    row: 6,
    rowHeight: [
      {
        index: 0,
        size: 30
      },
      {
        index: 3,
        size: 20
      }
    ],
    elements: [
      {
        modelId: 'title',
        col: 1,
        row: 0
      },
      {
        modelId: 'line-region-A',
        col: 1,
        row: 1
      },
      {
        modelId: 'axis-left-A',
        col: 0,
        row: 1
      },
      {
        modelId: 'axis-bottom-A',
        col: 1,
        row: 2
      },
      {
        modelId: 'line-region-B',
        col: 1,
        row: 4
      },
      {
        modelId: 'axis-left-B',
        col: 0,
        row: 4
      },
      {
        modelId: 'axis-bottom-B',
        col: 1,
        row: 5
      }
    ]
  },
  region: [
    {
      id: 'line-region-A'
    },
    {
      id: 'line-region-B'
    }
  ],
  series: [
    {
      regionId: 'line-region-A',
      type: 'line',
      xField: 'time',
      yField: 'a',
      data: {
        id: 'line-A',
        values: [
          {
            time: 1,
            a: 0,
            b: 117,
            c: 145
          },
          {
            time: 10,
            a: 1,
            b: 1317,
            c: 2345
          },
          {
            time: 100,
            a: 2,
            b: 2500,
            c: 3100
          },
          {
            time: 1000,
            a: 3,
            b: 7500,
            c: 6100
          },
          {
            time: 10000,
            a: 4,
            b: 7500,
            c: 6100
          },
          {
            time: 100000,
            a: 5,
            b: 7500,
            c: 6100
          },
          {
            time: 1000000,
            a: 6,
            b: 7500,
            c: 6100
          }
        ]
      }
    },
    {
      regionId: 'line-region-B',
      type: 'line',
      xField: 'time',
      yField: 'a',
      data: {
        id: 'line-B',
        values: [
          {
            time: 1,
            a: 0,
            b: 117,
            c: 145
          },
          {
            time: 10,
            a: 1,
            b: 1317,
            c: 2345
          },
          {
            time: 100,
            a: 2,
            b: 2500,
            c: 3100
          },
          {
            time: 1000,
            a: 3,
            b: 7500,
            c: 6100
          },
          {
            time: 10000,
            a: 4,
            b: 7500,
            c: 6100
          },
          {
            time: 100000,
            a: 5,
            b: 7500,
            c: 6100
          },
          {
            time: 1000000,
            a: 6,
            b: 7500,
            c: 6100
          }
        ]
      }
    }
  ],
  title: {
    text: 'the example shows difference of linear axis and log axis',
    id: 'title'
  },
  axes: [
    {
      id: 'axis-left-A',
      regionId: 'line-region-A',
      orient: 'left',
      type: 'linear'
    },

    {
      id: 'axis-bottom-A',
      regionId: 'line-region-A',
      orient: 'bottom',
      type: 'linear',
      title: 'log-axis'
    },
    {
      id: 'axis-left-B',
      regionId: 'line-region-B',
      orient: 'left',
      type: 'linear'
    },

    {
      id: 'axis-bottom-B',
      regionId: 'line-region-B',
      orient: 'bottom',
      type: 'log',
      title: 'log-axis'
    }
  ]
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Related Tutorials

Attach a link to the tutorial or API documentation associated with this demo configuration.
