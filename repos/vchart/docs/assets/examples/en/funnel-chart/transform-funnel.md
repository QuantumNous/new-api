---
category: examples
group: funnel chart
title: Conversion Funnel Chart
keywords: funnelChart,composition,trend,triangle
order: 8-3
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/funnel-chart/transform-funnel.png
option: funnelChart
---

# Conversion Funnel Chart

In this example, we created a conversion funnel chart to track the user conversion rate in the process from pushing to purchase.

## When to use

1. The data is ordered, and there is a logical sequence relationships between them, and it is best to have more than 3 stages.

2. The process should be a "consumptive" process, such as in the e-commerce field, registered users must go through layers of consumption to reach the order link; in the human resources field, the received resumes must go through several rounds of screening before entering the final interview.

## Key Configuration

- Specify the chart type `type: funnel` as funnel chart.
- `categoryField` specifies the category field.
- `valueField` specifies the value field.
- `isTransform: true` configure as a conversion funnel chart, and the conversion layer will be displayed in the chart.
- `transformLabel.visible: true` configure to display the labels of the conversion layer.
- `outerLabel` is the outer label configuration for funnel layers.
  - `outerLabel.visible: true` externally labeled is not displayed by default, and needs to be configured as true.
  - `outerLabel.position: 'right'` configures it to be displayed on the right.

## Demo source

```javascript livedemo
const spec = {
  type: 'funnel',
  categoryField: 'name',
  valueField: 'value',
  isTransform: true,
  isCone: false,
  data: [
    {
      id: 'funnel',
      values: [
        {
          value: 5676,
          name: 'Sent'
        },
        {
          value: 3872,
          name: 'Viewed'
        },
        {
          value: 1668,
          name: 'Clicked'
        },
        {
          value: 610,
          name: 'Add to Cart'
        },
        {
          value: 565,
          name: 'Purchased'
        }
      ]
    }
  ],
  title: {
    visible: true,
    text: 'Percentage of the customers have dropped from the sales process'
  },
  label: {
    visible: true
  },
  transformLabel: {
    visible: true
  },
  outerLabel: {
    position: 'right',
    visible: true
  },
  legends: {
    visible: true,
    orient: 'top'
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
```

## Related Tutorials

[Bar Chart](link)
