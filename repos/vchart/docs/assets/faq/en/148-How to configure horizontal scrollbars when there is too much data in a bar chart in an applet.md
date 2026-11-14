# How to configure horizontal scrollbars when there is too much data in a bar chart in an applet?

## Question Description

How to configure horizontal scrollbars when there is too much data in a bar chart in the lark mini app?

## Solution

Just like the PC side, just configure the `scrollBar`. Generally speaking, you also need to configure the `scrollBar.orient` property that represents the position of the scrollBar and the `scrollBar.start` and `scrollBar.end` properties that represent the scope of the current window.
[mini program scrollbar](/vchart/faq/12-0.png)

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

window['vchart'] = vchart;
```

## Quote

- [ScrollBar Demo](https://www.visactor.io/vchart/demo/scrollbar/basic-scrollbar-bar-chart)
- [ScrollBar Tutorial](https://www.visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Scrollbar)
- [Related api](https://www.visactor.io/vchart/option/commonChart#scrollbar)
- [github](https://github.com/VisActor/VChart)
