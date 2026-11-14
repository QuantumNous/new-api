# How to add transition animations when clicking the legend of a funnel chart?

## Question Description

I am developing a funnel chart. When I click on the legend, there is no animation effect, and it's a bit stiff. Is there any chart library that supports animation effects configuration for legend clicks?
![funnel animation](/vchart/faq/16-0.gif)

## Solution

VChart funnel chart has a default transition animation when filtering the legend. You can refer to the official website (demo)[https://visactor.io/vchart/demo/funnel-chart/basic-funnel]

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
          value: 100,
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
          value: 20,
          name: 'Step5'
        }
      ]
    }
  ],
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

- [funnel demo](https://visactor.io/vchart/demo/funnel-chart/basic-funnel)
- [github](https://github.com/VisActor/VChart)
