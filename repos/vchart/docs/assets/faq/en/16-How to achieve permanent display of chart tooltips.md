# How to achieve permanent display of chart tooltips?

## Question Description

How to configure tooltip permanent display for VChart, as shown in the following figure:

![tooltip](/vchart/faq/70-0.png)

## Solution

VChart currently can not retain two tooltips at the same time, but tooltips support resident display by configuring `triggerOff` to `none`. You can refer to the following demo:

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
  tooltip: {
    trigger: 'click',
    triggerOff: 'none',
    mark: {
      position: 'top'
    }
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Result

![demo](/vchart/faq/70-1.png)

## Quote

github：[https://github.com/VisActor/VChart](https://github.com/VisActor/VChart)

option docs: [https://www.visactor.io/vchart/option/barChart#tooltip.visible](https://www.visactor.io/vchart/option/barChart#tooltip.visible)
