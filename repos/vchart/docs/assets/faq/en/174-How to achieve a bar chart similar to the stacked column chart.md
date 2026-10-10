# How to achieve a bar chart similar to the stacked column chart?

## Question Description

Seemly to [https://www.visactor.io/vchart/demo/bar-chart/stack-column](https://www.visactor.io/vchart/demo/bar-chart/stack-column), how to make bars of different colors start from the y-axis zero scale and overlap with each other rather than stacking vertically?

![description](/vchart/faq/64-0.png)

## Solution

The solution varies depending on the chart library being used. Based on the provided demo, you simply need to set the corresponding field to false in order to disable stacking.

![solution](/vchart/faq/64-1.png)

## Code Example

```javascript livedemo
const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        {
          State: 'WY',
          Age: 'Under 5 Years',
          Population: 25635
        },
        {
          State: 'WY',
          Age: '5 to 13 Years',
          Population: 1890
        },
        {
          State: 'WY',
          Age: '14 to 17 Years',
          Population: 9314
        },
        {
          State: 'DC',
          Age: 'Under 5 Years',
          Population: 30352
        },
        {
          State: 'DC',
          Age: '5 to 13 Years',
          Population: 20439
        },
        {
          State: 'DC',
          Age: '14 to 17 Years',
          Population: 10225
        },
        {
          State: 'VT',
          Age: 'Under 5 Years',
          Population: 38253
        },
        {
          State: 'VT',
          Age: '5 to 13 Years',
          Population: 42538
        },
        {
          State: 'VT',
          Age: '14 to 17 Years',
          Population: 15757
        },
        {
          State: 'ND',
          Age: 'Under 5 Years',
          Population: 51896
        },
        {
          State: 'ND',
          Age: '5 to 13 Years',
          Population: 67358
        },
        {
          State: 'ND',
          Age: '14 to 17 Years',
          Population: 18794
        },
        {
          State: 'AK',
          Age: 'Under 5 Years',
          Population: 72083
        },
        {
          State: 'AK',
          Age: '5 to 13 Years',
          Population: 85640
        },
        {
          State: 'AK',
          Age: '14 to 17 Years',
          Population: 22153
        }
      ]
    }
  ],
  xField: 'State',
  yField: 'Population',
  seriesField: 'Age',
  stack: false,
  legends: {
    visible: true
  },
  bar: {
    // The state style of bar
    state: {
      hover: {
        stroke: '#000',
        lineWidth: 1
      }
    }
  }
};
```

## Result

Online demo：[https://codesandbox.io/s/bar-chart-stack-false-cr6667](https://codesandbox.io/s/bar-chart-stack-false-cr6667)

![demo](/vchart/faq/64-2.gif)

## Quote

Stacked Bar Chart Demo：[https://www.visactor.io/vchart/demo/bar-chart/stack-column](https://www.visactor.io/vchart/demo/bar-chart/stack-column)

Bar Chart Tutorial：[https://www.visactor.io/vchart/guide/tutorial_docs/Chart_Types/Bar](https://www.visactor.io/vchart/guide/tutorial_docs/Chart_Types/Bar)

Related api：[https://www.visactor.io/vchart/option/barChart#stack](https://www.visactor.io/vchart/option/barChart#stack)

github：[https://github.com/VisActor/VChart](https://github.com/VisActor/VChart)
