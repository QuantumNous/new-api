---
category: examples
group: bar chart
title: Basic Column Chart
keywords: barChart, comparison, distribution, rank, rectangle
order: 2-0
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/bar-chart/basic-column.png
option: barChart
---

# Basic Column Chart

The most basic column chart requires a categorical variable and a numerical variable. In this example, we created a simple column chart to display a week's sales data, where the categorical variable is `month` and the numerical variable is `sales`.

## Key option

- `type: bar` attribute declares it as a column chart
- `xField` attribute declares the categorical or temporal field
- `yField` attribute declares the numerical field

## Demo source

```javascript livedemo
const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        { month: 'Monday', sales: 22 },
        { month: 'Tuesday', sales: 13 },
        { month: 'Wednesday', sales: 25 },
        { month: 'Thursday', sales: 29 },
        { month: 'Friday', sales: 38 }
      ]
    }
  ],
  xField: 'month',
  yField: 'sales'
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
```

## Related Tutorials

[Column Chart](link)
