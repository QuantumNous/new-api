# How to configure the transform width of the funnel chart?

## Question Description

When I was drawing the funnel chart, I found that when the data difference is relatively large (for example, the largest data is 1000, and the smallest data is only 10), the graphics elements at the bottom of the finally drawn funnel chart will be very narrow. Is there any way to configure the transform width of the funnel chart?

## Solution

VChart funnel chart allows developers to configure the minimum funnel width through `minSize` to avoid some funnels being too narrow.

## Code Example

```javascript livedemo
const spec = {
  type: 'funnel',
  categoryField: 'name',
  valueField: 'value',
  data: [
    {
      id: 'funnel',
      values: [
        {
          value: 1000,
          name: 'Step1'
        },
        {
          value: 80,
          name: 'Step2'
        },
        {
          value: 60,
          name: 'Step3'
        },
        {
          value: 40,
          name: 'Step4'
        },
        {
          value: 10,
          name: 'Step5'
        }
      ]
    }
  ],
  minSize: 20,
  label: {
    visible: true
  },
  legends: {
    visible: true,
    orient: 'bottom'
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## Quote

- [github](https://github.com/VisActor/VChart)
- [Funnel minSize spec](https://visactor.io/vchart/option/funnelChart#minSize)
