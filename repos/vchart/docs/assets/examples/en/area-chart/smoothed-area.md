---
category: examples
group: area chart
title: Smoothed Area Chart
keywords: areaChart,comparison,trend,area
order: 1-7
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/area-chart/smoothed-area.png
option: areaChart
---

# Smoothed Area Chart

A smoothed area chart is an area chart that connects a series of data points with smooth curves.

## Key option

- Configure the `curveType: 'monotone'` property in the `line.style` attribute. The default `style.curveType` property of the area chart element will be automatically synchronized, so there is no need to configure it again.

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
  line: {
    style: {
      curveType: 'monotone'
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
```

## Key option

None

## Related Tutorials

[Area Chart](link)
