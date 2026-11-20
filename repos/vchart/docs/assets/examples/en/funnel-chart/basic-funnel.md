---
category: examples
group: funnel chart
title: Basic Funnel Chart
keywords: funnelChart,composition,trend,triangle
order: 8-0
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/funnel-chart/basic-funnel.png
option: funnelChart
---

# Basic Funnel Chart

Funnel chart, shaped like a "funnel", is used for single-process analysis and is composed of N process links between the start and end points. Usually, these N process links have a logical sequential relationship.

## When to use

1. The data is ordered and has a logical sequential relationship between each other. Ideally, there should be more than 3 stages.
2. The process should be "consumptive", such as in the e-commerce field, registered users must go through layers of consumption to reach the order placement stage; in the human resources field, received resumes must go through multiple rounds of screening to reach the final interview stage.

## Key option

- `type: funnel` specifies the chart type as a funnel chart
- `categoryField` specifies the category field
- `valueField` specifies the value field

## Demo source

```javascript livedemo
const spec = {
  type: 'funnel',
  categoryField: 'name',
  valueField: 'value',
  data: [
    {
      id: 'funnel',
      values: [
        {
          value: 100,
          name: 'Step1'
        },
        {
          value: 80,
          name: 'Step2'
        },
        {
          value: 60,
          name: 'Step3'
        },
        {
          value: 40,
          name: 'Step4'
        },
        {
          value: 20,
          name: 'Step5'
        }
      ]
    }
  ],
  label: {
    visible: true
  },
  legends: {
    visible: true,
    orient: 'bottom'
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
```

## Related tutorials

[Funnel Chart](link)
