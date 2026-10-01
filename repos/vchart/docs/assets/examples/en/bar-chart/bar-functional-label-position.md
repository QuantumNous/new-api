---
category: examples
group: bar chart
title: Bar Chart with functional label position
keywords: barChart,comparison,distribution,label,rectangle
cover: /vchart/preview/bar-functional-position_1.6.0.png
option: barChart
---

# Bar Chart with functional label position

In the bar chart, you can customize the label position by configuring the `label.position`.

## Key option

- `label.position` can be configured as a function in bar series, the function parameters are the data of the relevant graph elements, and the return value is the label position determined based on the data.

## Demo source

```javascript livedemo
const spec = {
  type: 'bar',
  height: 300,
  data: [
    {
      id: 'barData',
      values: [
        { type: 'A', year: '2000', value: 16727 },
        { type: 'B', year: '2000', value: 12546 },
        { type: 'C', year: '2000', value: 11085 },
        { type: 'D', year: '2000', value: 13506 },
        { type: 'E', year: '2000', value: 5765 },
        { type: 'A', year: '2010', value: 5546 },
        { type: 'B', year: '2010', value: 1505 },
        { type: 'C', year: '2010', value: 8375 },
        { type: 'D', year: '2010', value: 3375 },
        { type: 'E', year: '2010', value: 5960 }
      ]
    }
  ],
  barWidth: 20,
  yField: 'year',
  xField: 'value',
  legends: {},
  label: {
    visible: true,
    position: datum => {
      return datum.year === '2000' ? 'top-right' : 'bottom-right';
    },
    overlap: { strategy: [], clampForce: false },
    offset: 0,
    style: {
      fill: 'rgb(115,125,135)',
      fontSize: 12
    }
  },
  direction: 'horizontal',
  seriesField: 'type',
  axes: [
    {
      orient: 'bottom',
      paddingInner: 0.3
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Related Tutorials

[histogram](link)
