---
category: examples
group: line chart
title: Basic line chart
keywords: lineChart,comparison,trend,line
order: 0-0
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/line-chart/basic-line.png
option: lineChart
---

# Basic Line Chart

Line charts are constructed by connecting a series of data points to form a trend. Line charts are used to analyze the trends of things changing over time or ordered categories. If there are multiple sets of data, they are used to analyze the interaction and influence of multiple data sets over time or ordered categories. The line's direction indicates positive/negative changes. The slope of the line indicates the degree of change. In this example, we created a basic line chart to show the temperature change of a day.

## Key option

- Declare the `xField` attribute as continuous time intervals or ordered category fields
- Declare the `yField` attribute as numerical fields

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

[Line Chart](link)
