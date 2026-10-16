---
category: examples
group: funnel chart
title: Rectangular Conversion Funnel Chart
keywords: funnelChart, composition, trend, strip
order: 8-2
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/ffc3a9b5518762d274121ff04.png
option: funnelChart
---

# Rectangular Conversion Funnel Chart

## Key option

- `type: funnel` Specifies the chart type to be a funnel chart
- `categoryField` Specifies the category field
- `valueField` Specifies the value field
- `isTransform: true` Configure as a conversion funnel chart, the conversion layer will be displayed in the chart
- `shape: rect` Specifies the funnel layer shape to be rectangular

## Demo source

```javascript livedemo
const spec = {
  type: 'funnel',
  maxSize: '75%',
  minSize: '10%',
  isTransform: true,
  shape: 'rect',
  color: {
    type: 'ordinal',
    range: ['#00328E', '#0048AA', '#005FC5', '#2778E2', '#4E91FF', '#70ABFF', '#8FC7FF', '#AEE2FF']
  },
  funnel: {
    style: {
      cornerRadius: 4,
      stroke: 'white',
      lineWidth: 2
    },
    state: {
      hover: {
        stroke: '#4e83fd',
        lineWidth: 1
      }
    }
  },
  transform: {
    style: {
      stroke: 'white',
      lineWidth: 2
    },
    state: {
      hover: {
        stroke: '#4e83fd',
        lineWidth: 1
      }
    }
  },
  label: {
    visible: true,
    style: {
      lineHeight: 16,
      limit: Infinity,
      text: datum => [`${datum.name}`, `${datum.value}`]
    }
  },
  outerLabel: {
    visible: true,
    position: 'right',
    alignLabel: false,
    style: {
      text: datum => {
        return `${datum.percent * 100}%`;
      }
    },
    line: {
      style: {
        lineDash: [2, 2]
      }
    }
  },
  transformLabel: {
    visible: true,
    style: {
      fill: 'black'
    }
  },
  data: [
    {
      name: 'funnel',
      values: [
        {
          value: 100,
          name: 'Resume Screening',
          percent: 1
        },
        {
          value: 80,
          name: 'Resume Evaluation',
          percent: 0.8
        },
        {
          value: 50,
          name: 'Evaluation Passed',
          percent: 0.5
        },
        {
          value: 30,
          name: 'Interview',
          percent: 0.3
        },
        {
          value: 10,
          name: 'Final Pass',
          percent: 0.1
        }
      ]
    }
  ],
  categoryField: 'name',
  valueField: 'value'
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Related Tutorials

[Funnel Chart](link)
