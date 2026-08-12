---
category: examples
group: scrollBar
title: Vertical scrollBar
keywords: scrollBar
order: 30-2
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/scrollbar/scrollbar-specified-value.png
option: barChart#scrollbar
---

# Vertical scrollBar

Vertical `scrollBar` is used to control the number of bars in the horizontal bar chart. In this example, we created a simple bar chart to display a week's sales data, where the categorical variable is `year`, and the numeric variable is `sales`. The `scrollBar` and the categorical variable `year` are automatically bound, used to control the data display range.

## Key option

- The `orient` property is declared as a string type, used for setting the orientation of `scollBar`. The optional values are: `bottom`, `right`
- The `startValue` property declares the starting value of the `scollBar` associated field, used for controlling the display range of the data
- The `endValue` property declares the ending value of the `scollBar` associated field, used for controlling the display range of the data
- The `roam` property is declared as a `Boolean` type, used for setting whether to enable the zoom and pan feature

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
  direction: 'horizontal',
  yField: 'year',
  xField: 'sales',
  scrollBar: [
    {
      orient: 'right',
      startValue: '2011',
      endValue: '2014',
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
