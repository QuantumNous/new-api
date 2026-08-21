---
category: demo
group: gradient
title: Gradient Color - Color Segmentation on Mobile
keywords: lineChart,comparison,trend,line,gradient
order: 38-4
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/gradient/enhancement-gradient-line.png
option: lineChart
---

# Gradient Color - Color Segmentation on Mobile

Color segmentation for warning lines.

## Key Configuration

Achieved by controlling the offset value of the gradient color.

## Demo source

```javascript livedemo
const spec = {
  data: {
    id: 'data1',
    values: [
      {
        x: '2:00',
        y: 82
      },
      {
        x: '4:00',
        y: 50
      },
      {
        x: '6:00',
        y: 64
      },
      {
        x: '8:00',
        y: 30
      },
      {
        x: '10:00',
        y: 40
      },
      {
        x: '12:00',
        y: 40
      },
      {
        x: '14:00',
        y: 56
      },
      {
        x: '16:00',
        y: 40
      },
      {
        x: '18:00',
        y: 64
      },
      {
        x: '20:00',
        y: 74
      },
      {
        x: '22:00',
        y: 98
      }
    ]
  },
  type: 'line',
  xField: 'x',
  yField: 'y',
  point: {
    style: {
      fill: data => {
        if (data.y > 60) {
          return 'green';
        }
        return 'red';
      }
    }
  },
  line: {
    style: {
      stroke: {
        gradient: 'linear',
        x0: 0.5,
        y0: 0,
        x1: 0.5,
        y1: 1,
        stops: [
          {
            offset: 0,
            color: 'green'
          },
          {
            offset: 0.5588235294117647,
            color: 'green'
          },
          {
            offset: 0.5588235294117647,
            color: 'red'
          },
          {
            offset: 1,
            color: 'red'
          }
        ]
      }
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
```

## Related Tutorials

Attach a link to a tutorial or API documentation related to this demo configuration.
