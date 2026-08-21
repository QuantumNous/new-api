---
category: examples
group: bar chart
title: Grouped Bar Chart
keywords: barChart, comparison, distribution, rank, rectangle
order: 2-9
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/bar-chart/group-bar.png
option: barChart
---

# Grouped Bar Chart

Grouped bar charts are used to display data for multiple categories, comparing different categories of data through bar height.

## Key option

- Set the `direction` property to 'horizontal'
- Declare the `xField` property as a numerical field
- Declare the `yField` property as a categorical field, set it as an array type, and set the second value in the array as the grouping field
- Declare the `seriesField` property as the color mapping field
- Adjust the group spacing by setting the `paddingInner` property for the coordinate axis with `orient: left`

## Demo source

```javascript livedemo
const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        {
          x: '2:00',
          y: 82,
          type: 'sales'
        },
        {
          x: '4:00',
          y: 50,
          type: 'sales'
        },
        {
          x: '6:00',
          y: 64,
          type: 'sales'
        },
        {
          x: '8:00',
          y: 30,
          type: 'sales'
        },
        {
          x: '10:00',
          y: 40,
          type: 'sales'
        },
        {
          x: '12:00',
          y: 40,
          type: 'sales'
        },
        {
          x: '14:00',
          y: 56,
          type: 'sales'
        },
        {
          x: '16:00',
          y: 40,
          type: 'sales'
        },
        {
          x: '18:00',
          y: 64,
          type: 'sales'
        },
        {
          x: '20:00',
          y: 74,
          type: 'sales'
        },
        {
          x: '22:00',
          y: 98,
          type: 'sales'
        },
        {
          x: '2:00',
          y: 62,
          type: 'profit'
        },
        {
          x: '4:00',
          y: 30,
          type: 'profit'
        },
        {
          x: '6:00',
          y: 32,
          type: 'profit'
        },
        {
          x: '8:00',
          y: 10,
          type: 'profit'
        },
        {
          x: '10:00',
          y: 20,
          type: 'profit'
        },
        {
          x: '12:00',
          y: 20,
          type: 'profit'
        },
        {
          x: '14:00',
          y: 36,
          type: 'profit'
        },
        {
          x: '16:00',
          y: 20,
          type: 'profit'
        },
        {
          x: '18:00',
          y: 44,
          type: 'profit'
        },
        {
          x: '20:00',
          y: 74,
          type: 'profit'
        },
        {
          x: '22:00',
          y: 78,
          type: 'profit'
        }
      ]
    }
  ],
  direction: 'horizontal',
  xField: 'y',
  yField: ['x', 'type'],
  seriesField: 'type',
  legends: {
    visible: true,
    orient: 'bottom'
  },
  axes: [
    {
      orient: 'left',
      paddingInner: 0
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Related Tutorials

[Bar Chart](link)
