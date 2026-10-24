---
category: examples
group: bar chart
title: Group histogram interval
keywords: barChart,comparison,distribution,rank,rectangle
order: 2-12
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/55297520732ada18bb7183f00.png
option: barChart
---

# Group histogram interval

## Key option

- `type: bar` Property declared as a column chart
- `xField` Property declared as category field or timing field
- `yField` Property declared as numeric field
- `axes.paddingInner`Property declared as column spacing

## Demo source

```javascript livedemo
const spec = {
  type: 'bar',
  color: ['#becef3', '#6a8edc', '#77caeb', '#52c93b', '#d3f5e8'],
  data: [
    {
      id: 'barData',
      values: [
        { type: 'A', year: '2000', value: 25 },
        { type: 'A', year: '2010', value: 28 },
        { type: 'A', year: '2018', value: 18 },
        { type: 'B', year: '2000', value: 23 },
        { type: 'B', year: '2010', value: 32 },
        { type: 'B', year: '2018', value: 22 },
        { type: 'C', year: '2000', value: 18 },
        { type: 'C', year: '2010', value: 18 },
        { type: 'C', year: '2018', value: 18 },
        { type: 'D', year: '2000', value: 15 },
        { type: 'D', year: '2010', value: 22 },
        { type: 'D', year: '2018', value: 19 },
        { type: 'E', year: '2000', value: 5 },
        { type: 'E', year: '2010', value: 12 },
        { type: 'E', year: '2018', value: 5 }
      ]
    }
  ],
  xField: ['year', 'type'],
  yField: 'value',
  seriesField: 'type',
  axes: [
    {
      orient: 'bottom',
      paddingInner: 0.3
    }
  ],
  bar: {
    style: {
      fillOpacity: 0.9
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
```

## Related Tutorials

[histogram](link)
