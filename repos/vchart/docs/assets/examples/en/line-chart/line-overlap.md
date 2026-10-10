---
category: examples
group: line chart
title: Line Chart Overlap
keywords: lineChart,comparison,trend,line
order: 0-11
cover: /vchart/preview/line-overlap_1.6.0.png
option: lineChart
---

# line chart overlap

In a line chart, when data points are too densely packed, prevent the data points from overlapping to ensure a clearer representation of the trend and value of each line.

## Key option

- `markOverlap` declared as whether to enable anti-overlap

## Demo source

```javascript livedemo
const response = await fetch('https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/overlap-data.json');
const data = await response.json();

const dataSeries = [];
data.forEach(d => {
  dataSeries.push({
    ...d,
    type: 'a'
  });
  dataSeries.push({
    ...d,
    y: d.y + 20,
    type: 'b'
  });
});
const spec = {
  type: 'line',
  xField: 'x',
  yField: 'y',
  seriesField: 'type',
  markOverlap: true,
  stack: true,
  data: [
    {
      name: 'line',
      values: dataSeries
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Related Tutorials

[Line Chart](link)
