---
category: demo
group: gradient
title: Gradient Area Chart
keywords: areaChart, comparison, trend, area, gradient
order: 38-2
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/gradient/area.png
option: areaChart
---

# Gradient Area Chart

You can configure gradient colors on color-configurable properties such as `fill` and `stroke` of graphic styles. Currently, three types of gradient configurations are supported: linear gradient, radial gradient, and conical gradient. This example demonstrates the use of linear gradients.

## Key option

- Linear gradient configuration is as follows

```javascript livedemo
// Linear gradient, the first four parameters are x0, y0, x1, y1, ranging from 0 - 1, which is equivalent to the percentage in the graphics bounding box
{
  gradient: 'linear',
  x0: 0,
  y0: 0,
  x1: 0,
  y1: 1,
  stops: [
    {
      offset: 0,
      color: 'red' // 0% color
    },
    {
      offset: 1,
      color: 'blue' // 100% color
    }
  ],
}
```

## Demo source

```javascript livedemo
const spec = {
  type: 'area',
  data: {
    id: 'data',
    values: [
      {
        x: 'Monday',
        y: 4
      },
      {
        x: 'Tuesday',
        y: 5
      },
      {
        x: 'Wednesday',
        y: 4
      },
      {
        x: 'Thursday',
        y: 6
      },
      {
        x: 'Friday',
        y: 8
      },
      {
        x: 'Saturday',
        y: 10
      },
      {
        x: 'Sunday',
        y: 9
      }
    ]
  },
  xField: 'x',
  yField: 'y',
  area: {
    style: {
      curveType: 'monotone',
      fill: {
        gradient: 'linear',
        x0: 0,
        y0: 0.5,
        x1: 1,
        y1: 0.5,
        stops: [
          {
            offset: 0,
            color: '#009DB5',
            opacity: 0.3
          },
          {
            offset: 1,
            color: '#F0B71F',
            opacity: 0.3
          }
        ]
      }
    }
  },
  line: {
    style: {
      curveType: 'monotone',
      stroke: {
        gradient: 'linear',
        x0: 0,
        y0: 0.5,
        x1: 1,
        y1: 0.5,
        stops: [
          {
            offset: 0,
            color: '#009DB5'
          },
          {
            offset: 1,
            color: '#F0B71F'
          }
        ]
      }
    }
  },
  point: {
    style: {
      fill: '#fff',
      stroke: {
        field: 'x',
        scale: 'color'
      }
    }
  },
  color: {
    type: 'ordinal',
    domain: [
      {
        dataId: 'data',
        fields: ['x']
      }
    ],
    range: ['#009DB5', '#009DB5', '#009DB5', '#92be92', '#9fae52', '#F0B71F', '#F0B71F']
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Related Tutorials

Attach links to tutorials or API documentation related to this demo configuration.
