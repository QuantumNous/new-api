---
category: examples
group: area chart
title: Basic Area Chart
keywords: areaChart,comparison,trend,area
order: 1-0
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/area-chart/basic-area.png
option: areaChart
---

# Basic Area Chart

Area charts visually display quantitative data. It is based on line charts. They typically use color, texture, and shading lines to emphasize the area between the axis and the lines. Generally, an area chart compares two or more quantities. Area charts are suitable for reflecting the trend changes of one or more sets of data under a continuous independent variable and their comparisons, and also for observing the changes in the total amount of data.

## Key option

- `type: area` attribute declares as an area chart
- `xField` attribute declares as a categorical field or temporal field
- `yField` attribute declares as a numerical field
- `crosshair` attribute declares as crosshair, used to display detailed information of the data, `xField.visible` enables the x-axis crosshair

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
        value: 17
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
