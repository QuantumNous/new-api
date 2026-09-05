---
category: examples
group: pie
title: Radius mappable pie chart
order: 6-4
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/c0de7ff0a101bd4cb25c8170a.png
option: pieChart
---

# Radius mappable pie chart

Pie charts can map data with internal and external radii by configuring custom scales.

## Key option

- `categoryField`,`valueField` Properties are used to specify the pie category and fan angle fields, respectively
- `innerRadius`,`outerRadius` Property is used to specify the inner and outer radii of the sector

## Demo source

```javascript livedemo
const spec = {
  type: 'pie',
  data: [
    {
      id: 'id0',
      values: [
        { type: '0~9', value: '39.12' },
        { type: '10~19', value: '43.01' },
        { type: '20~29', value: '43.91' },
        { type: '30~39', value: '45.4' },
        { type: '40~49', value: '40.89' },
        { type: '50~59', value: '42.48' },
        { type: '60~69', value: '39.63' },
        { type: '70~79', value: '25.17' },
        { type: '80 and over', value: '12.29' }
      ]
    }
  ],
  valueField: 'value',
  categoryField: 'type',
  outerRadius: {
    field: 'value',
    scale: 'outer-radius'
  },
  innerRadius: {
    field: 'value',
    scale: 'inner-radius'
  },
  scales: [
    {
      id: 'outer-radius',
      type: 'linear',
      domain: [10, 50],
      range: [120, 220]
    },
    {
      id: 'inner-radius',
      type: 'linear',
      domain: [10, 50],
      range: [110, 10]
    }
  ],
  label: {
    visible: true
  },
  color: ['#98abc5', '#8a89a6', '#7b6888', '#6b486b', '#a05d56', '#d0743c', '#ff8c00'],
  title: {
    visible: true,
    text: 'Population Distribution by Age in the United States, 2021 (in millions)',
    textStyle: {
      fontFamily: 'Times New Roman'
    }
  },
  legends: {
    visible: true,
    orient: 'right'
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Related Tutorials

[Pie chart](link)
