---
category: examples
group: pie
title: Linear Gradient Color Pie Chart
keywords: pieChart,comparison,composition,proportion,circle
order: 6-6
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/pie-chart/linear-color-pie.png
option: pieChart
---

# Linear Gradient Color Pie Chart

Configure the scale of the linear type through the `color` attribute to realize the color gradient of the fan shape, and at the same time use the custom data of the legend to keep the color of the legend item shape consistent with the color of the fan shape.

## Key option

- `color` defines a scale of linear type
- `pie.style.fill` performs color mapping based on the `value` field value
- `legends.data` customizes the data to make the color of the legend item shape consistent with the color of the sector.

## Demo source

```javascript livedemo
const pieData = [
  { type: 'oxygen', value: '46.60' },
  { type: 'silicon', value: '27.72' },
  { type: 'aluminum', value: '8.13' },
  { type: 'iron', value: '5' },
  { type: 'calcium', value: '3.63' },
  { type: 'sodium', value: '2.83' },
  { type: 'potassium', value: '2.59' },
  { type: 'others', value: '3.5' }
];
const spec = {
  type: 'pie',
  data: [
    {
      id: 'id0',
      values: pieData
    }
  ],
  outerRadius: 0.8,
  innerRadius: 0.5,
  padAngle: 0.6,
  valueField: 'value',
  categoryField: 'type',
  color: {
    id: 'color',
    type: 'linear',
    range: ['#1664FF', '#B2CFFF', '#1AC6FF', '#94EFFF'],
    domain: [
      {
        dataId: 'id0',
        fields: ['value']
      }
    ]
  },
  pie: {
    style: {
      cornerRadius: 10,
      fill: {
        scale: 'color',
        field: 'value'
      }
    }
  },
  legends: {
    visible: true,
    orient: 'left',
    data: (data, scale) => {
      return data.map(datum => {
        const pickDatum = pieData.find(pieDatum => pieDatum.type === datum.label);

        datum.shape.fill = scale?.scale?.(pickDatum?.value);
        return datum;
      });
    }
  },
  label: {
    visible: true
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Related Tutorials

Attach the links to tutorials or API documents related to this demo configuration.
