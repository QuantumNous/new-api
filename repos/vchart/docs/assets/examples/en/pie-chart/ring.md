---
category: examples
group: pie
title: Ring Chart
keywords: pieChart,comparison,composition,proportion,circle
order: 6-5
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/c0de7ff0a101bd4cb25c8170b.png
option: pieChart
---

# Ring Chart

Pie charts can be adjusted by configuring the `innerRadius` and `outerRadius` attributes to specify the inner and outer radius of a sector, thereby forming a ring chart.

## Key option

- The `categoryField` and `valueField` attributes are used to specify the pie chart category and sector angle fields, respectively.
- The `innerRadius` and `outerRadius` attributes are used to specify the inner and outer radius of the sector.

## Demo source

```javascript livedemo
const spec = {
  type: 'pie',
  data: [
    {
      id: 'id0',
      values: [
        { type: 'oxygen', value: '46.60' },
        { type: 'silicon', value: '27.72' },
        { type: 'aluminum', value: '8.13' },
        { type: 'iron', value: '5' },
        { type: 'calcium', value: '3.63' },
        { type: 'sodium', value: '2.83' },
        { type: 'potassium', value: '2.59' },
        { type: 'others', value: '3.5' }
      ]
    }
  ],
  outerRadius: 0.8,
  innerRadius: 0.5,
  padAngle: 0.6,
  valueField: 'value',
  categoryField: 'type',
  pie: {
    style: {
      cornerRadius: 10
    },
    state: {
      hover: {
        outerRadius: 0.85,
        stroke: '#000',
        lineWidth: 1
      },
      selected: {
        outerRadius: 0.85,
        stroke: '#000',
        lineWidth: 1
      }
    }
  },
  title: {
    visible: true,
    text: 'Statistics of Surface Element Content'
  },
  legends: {
    visible: true,
    orient: 'left'
  },
  label: {
    visible: true
  },
  tooltip: {
    mark: {
      content: [
        {
          key: datum => datum['type'],
          value: datum => datum['value'] + '%'
        }
      ]
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Related Tutorials

[Pie Chart](link)
