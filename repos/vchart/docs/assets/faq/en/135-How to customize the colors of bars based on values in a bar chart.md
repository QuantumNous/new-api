# How to customize the colors of bars based on values in a bar chart?

## Question Description

I need to draw a histogram that can be configured with different colors according to the values of different columns. How should I do it?

## Solution

You can use the callback to configure the column style in VChart to customize the color based on the data content.

## Code Example

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
  yField: 'sales',
  bar: {
    style: {
      fill: datum => {
        return datum.sales > 25 ? 'red' : 'blue';
      }
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Quote

- [github](https://github.com/VisActor/VChart)
- [barChart style spec](https://www.visactor.io/vchart/option/barChart#bar.style.fill)
