# How do I configure the default scroll position for chart scrollbars?

## Question Description

What do I do when I need to configure where the scrollbar scrolls by default? Sometimes I want the scrollbar to start and end at a point that I specify, rather than a default range.

## Solution

You need to configure the parameters `scrollBar.start` and `scrollBar.end`, which represent the start and end points of the scroll bar, and take the values [0, 1], which represent the percentage layout range where the position is located.
In addition to this, you can configure the start and end points with `scrollBar.startValue` and `scrollBar.endValue`, which represent the data values of the start and end points, respectively.

[scrollbar position](/vchart/faq/13-0.png)

## Code Example

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

window['vchart'] = vchart;
```

## Quote

- [ScrollBar Demo](https://www.visactor.io/vchart/demo/scrollbar/basic-scrollbar-bar-chart)
- [ScrollBar Tutorial](https://www.visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Scrollbar)
- [Related api](https://www.visactor.io/vchart/option/commonChart#scrollbar)
- [github](https://github.com/VisActor/VChart)
