---
category: examples
group: area chart
title: Step Area Chart
keywords: areaChart,comparison,trend,area
order: 1-8
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/area-chart/step-area.png
option: areaChart
---

# Step Area Chart

A step area chart is a chart that connects a series of data points using step-shaped lines.

## Key Configuration

- Configure the `curveType: 'step' | 'stepAfter' | 'stepBefore'` attribute in the `line.style` property

## Demo source

```javascript livedemo
const spec = {
  type: 'area',
  data: {
    values: [
      {
        time: '2:00',
        value: 38
      },
      {
        time: '4:00',
        value: 56
      },
      {
        time: '6:00',
        value: 10
      },
      {
        time: '8:00',
        value: 70
      },
      {
        time: '10:00',
        value: 36
      },
      {
        time: '12:00',
        value: 94
      },
      {
        time: '14:00',
        value: 24
      },
      {
        time: '16:00',
        value: 44
      },
      {
        time: '18:00',
        value: 36
      },
      {
        time: '20:00',
        value: 68
      },
      {
        time: '22:00',
        value: 22
      }
    ]
  },
  xField: 'time',
  yField: 'value',
  point: {
    visible: false
  },
  line: {
    style: {
      curveType: 'stepAfter'
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
```

## Related Tutorials

[Line Chart](link)
