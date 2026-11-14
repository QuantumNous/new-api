---
category: examples
group: scrollBar
title: Basic Usage of scrollBar
keywords: scrollBar
order: 30-0
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/scrollbar/basic-scrollbar-bar-chart.png
option: barChart#scrollbar
---

# Basic Usage of scrollBar

The most basic usage of `scrollBar`, used to control the number of bars in a bar chart. In this example, we create a simple bar chart to display a week's sales data, with the categorical variable `year` and the numerical variable `sales`. The `scrollBar` and the categorical variable `year` are automatically bound to control the range of data displayed.

## Key Configuration

- The `orient` attribute is declared as a string type and is used to set the orientation of the `scrollBar`. The available values are: `bottom`, `right`.
- The `start` attribute is declared as a numerical field, with a value range of `[0, 1]`.
- The `end` attribute is declared as a numerical field, with a value range of `[0, 1]`. Note that the value of the `start` attribute should be less than the value of `end`.
- The `roam` attribute is declared as a `Boolean` type and is used to set whether to enable the zoom and move function.

## Demo source

```javascript livedemo
const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        { year: '2000', sales: 22 },
        { year: '2001', sales: 13 },
        { year: '2002', sales: 25 },
        { year: '2003', sales: 29 },
        { year: '2004', sales: 38 },
        { year: '2005', sales: 49 },
        { year: '2006', sales: 58 },
        { year: '2007', sales: 29 },
        { year: '2008', sales: 78 },
        { year: '2009', sales: 19 },
        { year: '2010', sales: 23 },
        { year: '2011', sales: 20 },
        { year: '2012', sales: 98 },
        { year: '2013', sales: 49 },
        { year: '2014', sales: 28 }
      ]
    }
  ],
  xField: 'year',
  yField: 'sales',
  scrollBar: [
    {
      orient: 'bottom',
      start: 0,
      end: 0.5,
      roam: true
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, do not copy
window['vchart'] = vchart;
```

## Related Tutorials

[scrollBar](link)
