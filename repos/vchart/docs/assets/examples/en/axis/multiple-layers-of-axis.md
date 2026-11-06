---
category: demo
group: axis
title: Multi-level axis
keywords: barChart,axis
Order: 25-18
cover: /vchart/preview/multiple-layers-of-axis_1.9.0.png
option: barChart#axes
---

# Multi-level coordinate axes (example 1)

When the chart has multiple levels of grouping, you can draw the coordinate axes of multi-level labels by turning on the `showAllGroupLayers` attribute for the band axis.

## Key option

- Configure the axis in the corresponding direction: `showAllGroupLayers: true`
- Turn off the first layer axis label through the `layers` attribute `layers: [{ visible: false }]`

## Demo source

```javascript livedemo
const spec = {
  type: 'bar',
  data: [
    {
      name: 'data1',
      values: [
        {
          name: 'Product 1',
          industry: 'E-commerce',
          type: 'Contract amount',
          y: 88
        },
        {
          name: 'Product 1',
          industry: 'E-commerce',
          type: 'Paid for',
          y: 40
        },
        {
          name: 'Product 1',
          industry: 'E-commerce',
          type: 'Receivables',
          y: 78
        },
        {
          name: 'Product 1',
          industry: 'Game',
          type: 'Contract amount',
          y: 96
        },
        {
          name: 'Product 1',
          industry: 'Game',
          type: 'Paid for',
          y: 70
        },
        {
          name: 'Product 1',
          industry: 'Game',
          type: 'Receivables',
          y: 86
        },
        {
          name: 'Product 2',
          industry: 'E-commerce',
          type: 'Contract amount',
          y: 96
        },
        {
          name: 'Product 2',
          industry: 'E-commerce',
          type: 'Paid for',
          y: 45
        },
        {
          name: 'Product 2',
          industry: 'E-commerce',
          type: 'Receivables',
          y: 67
        },
        {
          name: 'Product 2',
          industry: 'Game',
          type: 'Contract amount',
          y: 89
        },
        {
          name: 'Product 2',
          industry: 'Game',
          type: 'Paid for',
          y: 34
        },
        {
          name: 'Product 2',
          industry: 'Game',
          type: 'Receivables',
          y: 50
        }
      ]
    }
  ],
  xField: ['name', 'industry', 'type'],
  yField: 'y',
  seriesField: 'type',
  barGapInGroup: 0,
  axes: [
    {
      orient: 'bottom',
      showAllGroupLayers: true,
      layers: [
        {
          visible: false
        }
      ]
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```
