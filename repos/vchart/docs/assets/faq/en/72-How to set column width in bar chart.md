# How to set column width in bar chart?

## Question Description

Because the amount of data is uncertain, when there is too little data, the columns of the histogram are too wide and do not conform to the design draft. How can I configure the column width to be narrowed? At the same time, when there is a lot of data, the column can maintain its original width.

## Solution

VChart's column chart provides configuration items that can set the width of the column.

1. bandWidth directly sets the width of the column
2. barMinWidth The minimum width of the column
3. barMaxWidth The maximum width of the column

This requirement should be solved using barMaxWidth, just set it to the maximum width in the design draft.

## Code Example

```javascript livedemo
const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        { month: 'Monday', sales: 22 },
        { month: 'Tuesday', sales: 13 }
      ]
    }
  ],
  barMinWidth: 20,
  xField: 'month',
  yField: 'sales',
  barMaxWidth: 50
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Quote

- [github](https://github.com/VisActor/VChart)
- [Bar chart configuration](https://www.visactor.io/vchart/option/barChart#barWidth)
