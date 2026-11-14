---
category: examples
group: area chart
title: Area Chart with Negative Values
keywords: areaChart,comparison,trend,area
order: 1-2
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/area-chart/negative-values-area.png
option: areaChart
---

# Area Chart with Negative Values

An area chart with both positive and negative values.

## Key option

- `type: area` attribute declares it as an area chart
- `xField` attribute declares it as a categorical field or time field
- `yField` attribute declares it as a numerical field

## Demo source

```javascript livedemo
const spec = {
  type: 'area',
  data: {
    values: [
      {
        time: '2:00',
        value: 8
      },
      {
        time: '4:00',
        value: -9
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
        value: -16
      },
      {
        time: '12:00',
        value: -17
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
  yField: 'value'
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
```

## Related Tutorials

[Area Chart](link)
